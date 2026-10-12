import type { Site } from '@prisma/client';
import { prisma } from '../db.js';
import { BASELINE_RULES } from './insights.js';

// VER-1 read model. Everything here comes from stored rows (baselines, savings_ledger, results,
// factors); the ledger is never recomputed on read (Doc 03: past results stay as published).

export const SAVINGS_METHOD_NOTE =
  "Checked against your own electricity bills by EcoProof's method; not a third-party verification.";

export type SavingsReason = 'no_baseline' | 'no_action_done' | 'no_savings_yet';

const REASON_TEXT: Record<SavingsReason, string> = {
  no_baseline: 'No baseline yet: it needs at least 9 confirmed monthly bills.',
  no_action_done:
    'No action is marked done yet, so there is nothing to measure against the baseline.',
  no_savings_yet:
    'An action is done, but no month after it has been compared with the baseline yet.',
};

export interface SavingsMonth {
  month: string;
  adjustedBaselineKwh: number;
  actualKwh: number;
  savedKwh: number;
  savedInr: number;
  savedTco2: number;
  cumulativeInr: number;
  status: 'verified' | 'too_early';
}

export interface Savings {
  baseline: {
    method: string;
    cvRmse: number | null;
    nmbe: number | null;
    passes: boolean;
    monthsUsed: number;
    a: number;
    b: number;
    formula: string;
  } | null;
  actions: Array<{ code: string; title: string; doneAt: string }>;
  months: SavingsMonth[];
  totals: { savedInr: number; savedKwh: number; savedTco2: number; verifiedInr: number };
  thisMonth: { month: string; savedInr: number; status: 'verified' | 'too_early' } | null;
  methodNote: string;
  reason?: string;
  reasonCode?: SavingsReason;
}

const num = (d: { toString(): string } | null | undefined) => (d == null ? null : Number(d));
const monthKey = (d: Date) => d.toISOString().slice(0, 7);
const r2 = (x: number) => Math.round(x * 100) / 100;

export async function computeSavings(site: Site): Promise<Savings> {
  const where = { orgId: site.orgId, siteId: site.id };
  const [baselineRow, doneActions, ledger, energy, results] = await Promise.all([
    prisma.baseline.findFirst({ where, orderBy: { createdAt: 'desc' } }),
    prisma.siteAction.findMany({
      where: { ...where, status: 'done', doneAt: { not: null } },
      include: { action: { select: { code: true, equipment: true } } },
      orderBy: { doneAt: 'asc' },
    }),
    prisma.savingsLedger.findMany({ where, orderBy: { month: 'asc' } }),
    prisma.energyMonth.findMany({ where, select: { periodStart: true, kwh: true } }),
    prisma.result.findMany({ where, select: { month: true, factorIds: true } }),
  ]);

  const baseline: Savings['baseline'] = baselineRow
    ? (() => {
        const a = Number(baselineRow.a);
        const b = Number(baselineRow.b);
        const monthsUsed = energy.filter(
          (e) => e.periodStart >= baselineRow.start && e.periodStart <= baselineRow.end,
        ).length;
        const cvRmse = num(baselineRow.cvRmse);
        const nmbe = num(baselineRow.nmbe);
        return {
          method: baselineRow.method,
          cvRmse,
          nmbe,
          passes:
            cvRmse != null &&
            nmbe != null &&
            monthsUsed >= BASELINE_RULES.minMonthsForRegression &&
            cvRmse <= BASELINE_RULES.maxCvRmsePct &&
            Math.abs(nmbe) <= BASELINE_RULES.maxAbsNmbePct,
          monthsUsed,
          a,
          b,
          formula: `Expected kWh in a month = ${a.toFixed(0)} kWh + ${b.toFixed(2)} kWh x tonnes produced that month`,
        };
      })()
    : null;

  const actions = doneActions.map((s) => ({
    code: s.action.code,
    title: s.action.equipment,
    doneAt: s.doneAt!.toISOString(),
  }));

  const empty = (reasonCode: SavingsReason): Savings => ({
    baseline,
    actions,
    months: [],
    totals: { savedInr: 0, savedKwh: 0, savedTco2: 0, verifiedInr: 0 },
    thisMonth: null,
    methodNote: SAVINGS_METHOD_NOTE,
    reason: REASON_TEXT[reasonCode],
    reasonCode,
  });
  if (!baseline) return empty('no_baseline');
  if (doneActions.length === 0) return empty('no_action_done');
  if (ledger.length === 0) return empty('no_savings_yet');

  // Grid factor version used for each month's result (its stored factor ids), not a constant.
  const factorIds = [...new Set(results.flatMap((r) => r.factorIds))];
  const gridFactors = new Map(
    (
      await prisma.factor.findMany({
        where: { id: { in: factorIds }, sourceType: 'grid_electricity_india' },
        select: { id: true, value: true },
      })
    ).map((f) => [f.id, Number(f.value)]),
  );
  const gridByMonth = new Map<number, number>();
  for (const r of results) {
    const id = r.factorIds.find((i) => gridFactors.has(i));
    if (id) gridByMonth.set(r.month.getTime(), gridFactors.get(id)!);
  }
  const actualByMonth = new Map(energy.map((e) => [e.periodStart.getTime(), Number(e.kwh)]));

  // One row per month: several actions can share a month in the ledger.
  const byMonth = new Map<number, typeof ledger>();
  for (const row of ledger) {
    const k = row.month.getTime();
    byMonth.set(k, [...(byMonth.get(k) ?? []), row]);
  }
  let cumulative = 0;
  const months: SavingsMonth[] = [...byMonth].map(([t, rows]) => {
    const savedKwh = rows.reduce((s, r) => s + Number(r.kwhSaved), 0);
    const savedInr = rows.reduce((s, r) => s + Number(r.inrSaved), 0);
    const grid = gridByMonth.get(t);
    // t CO2 = kWh / 1000 x grid factor (t CO2 per MWh); the ledger's own figure is the fallback
    // for a month with no result row.
    const savedTco2 =
      grid != null ? (savedKwh / 1000) * grid : rows.reduce((s, r) => s + Number(r.co2Saved), 0);
    const actualKwh = actualByMonth.get(t) ?? 0;
    cumulative += savedInr;
    return {
      month: monthKey(new Date(t)),
      adjustedBaselineKwh: Math.round(actualKwh + savedKwh),
      actualKwh: Math.round(actualKwh),
      savedKwh: r2(savedKwh),
      savedInr: r2(savedInr),
      savedTco2: Math.round(savedTco2 * 1000) / 1000,
      cumulativeInr: r2(cumulative),
      status: rows.every((r) => r.status === 'verified') ? 'verified' : 'too_early',
    };
  });

  const sum = (f: (m: SavingsMonth) => number) => months.reduce((s, m) => s + f(m), 0);
  const last = months.at(-1)!;
  return {
    baseline,
    actions,
    months,
    totals: {
      savedInr: r2(sum((m) => m.savedInr)),
      savedKwh: r2(sum((m) => m.savedKwh)),
      savedTco2: Math.round(sum((m) => m.savedTco2) * 1000) / 1000,
      verifiedInr: r2(sum((m) => (m.status === 'verified' ? m.savedInr : 0))),
    },
    thisMonth: { month: last.month, savedInr: last.savedInr, status: last.status },
    methodNote: SAVINGS_METHOD_NOTE,
  };
}
