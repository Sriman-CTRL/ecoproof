import { actionSavingRange, rankActions, simplePaybackYears } from '@ecoproof/calc';
import type { ActionLibrary, EnergyMonth, Site } from '@prisma/client';
import { prisma } from '../db.js';
import { factorFor } from '../jobs/calculate.js';
import { ACTION_CODE, computeInsights, type Finding, type Insights } from './insights.js';

const n = (d: { toString(): string } | null | undefined) => (d == null ? null : Number(d));

const BILL_DERIVED = new Set(Object.values(ACTION_CODE));

/** Library rows kept for stored IDs (site actions, ledger) but no longer offered. */
const HIDDEN_STATUS = new Set(['retired']);

/**
 * How the saving was found: from the bill check, from a sourced % of an end use's share of site
 * kWh, or not yet (needs a measurement, or the source gives no figure for one unit).
 */
export type SavingBasis = 'bill' | 'enduse_share' | 'pending_measurement' | 'not_quantified';

export interface ActionItem {
  code: string;
  title: string;
  isZeroCost: boolean;
  inrPerMonthLow: number | null;
  inrPerMonthHigh: number | null;
  annualInrMid: number | null;
  costLow: number | null;
  costHigh: number | null;
  paybackYears: number | null;
  co2TonnesPerYear: number | null;
  co2Note: string | null;
  source: string;
  finding: string | null;
  status: string;
  /** Library end use: only "electricity" savings that cut kWh can claim CO2. */
  enduse: string;
  savingBasis: SavingBasis;
  /** kWh a year saved, low-high; only for end-use-share savings. */
  kwhPerYearLow: number | null;
  kwhPerYearHigh: number | null;
  /** e.g. "2011 / 2020": the year the sourced cost range was priced. */
  costYear: string | null;
  costNote: string | null;
  savingNote: string | null;
  page: string | null;
  quotedLine: string | null;
}

/**
 * End-use-share saving (Doc 03 action savings): kWh = 12-month site kWh x share x saving %, low
 * with the low share, high with the high share. Rupees: low at the bill's rate per kVAh (as if
 * power factor were already near 1, so it does not double-count the PF fix), high at the bill's
 * own rate per kWh (energy charges / kWh).
 */
function enduseSaving(
  a: ActionLibrary,
  months: EnergyMonth[],
  gridTPerKwh: number | null,
): Pick<
  ActionItem,
  'inrPerMonthLow' | 'inrPerMonthHigh' | 'kwhPerYearLow' | 'kwhPerYearHigh' | 'co2TonnesPerYear'
> | null {
  const [pctLow, pctHigh, shareLow, shareHigh] = [
    a.savingLow,
    a.savingHigh,
    a.enduseShareLow,
    a.enduseShareHigh,
  ].map(n);
  if (pctLow == null || pctHigh == null || shareLow == null || shareHigh == null) return null;
  const latest = months[0];
  const kwhs = months.map((m) => n(m.kwh));
  if (!latest || kwhs.some((k) => k == null)) return null;
  const kwh = n(latest.kwh);
  const kvah = n(latest.kvah);
  const charges = n(latest.energyCharges);
  if (!kwh || !kvah || charges == null) return null;
  // Fewer than 12 bills: scale the months on hand to a year.
  const yearKwh = ((kwhs as number[]).reduce((t, k) => t + k, 0) * 12) / months.length;
  const low = actionSavingRange({
    baselineKwhPerYear: yearKwh,
    enduseShare: shareLow,
    savingPctLow: pctLow,
    savingPctHigh: pctLow,
  }).kwhLow;
  const high = actionSavingRange({
    baselineKwhPerYear: yearKwh,
    enduseShare: shareHigh,
    savingPctLow: pctHigh,
    savingPctHigh: pctHigh,
  }).kwhHigh;
  return {
    kwhPerYearLow: low,
    kwhPerYearHigh: high,
    inrPerMonthLow: (low / 12) * (charges / kvah),
    inrPerMonthHigh: (high / 12) * (charges / kwh),
    co2TonnesPerYear: gridTPerKwh == null ? null : ((low + high) / 2) * gridTPerKwh,
  };
}

/** Ranked action plan for a site and bill month (same numbers as GET /sites/:id/actions). */
export async function listActions(
  site: Site,
  month: Date,
  shiftableKwh: number | null,
): Promise<{ insights: Insights; actions: ActionItem[] }> {
  const orgId = site.orgId;
  const [insights, org, planned, months] = await Promise.all([
    computeInsights(site, month, shiftableKwh),
    prisma.organisation.findFirst({ where: { id: orgId }, select: { sector: true } }),
    prisma.siteAction.findMany({ where: { orgId, siteId: site.id } }),
    prisma.energyMonth.findMany({
      where: { orgId, siteId: site.id, periodStart: { lte: month } },
      orderBy: { periodStart: 'desc' },
      take: 12,
    }),
  ]);
  const library = // Ordered by code so ties (unvalued rows) rank the same way every time.
    (
      await prisma.actionLibrary.findMany({
        where: { sector: org?.sector ?? '' },
        orderBy: { code: 'asc' },
      })
    ).filter((a) => !HIDDEN_STATUS.has(a.status));
  const grid =
    months[0] && library.some((a) => a.enduseShareLow != null)
      ? Number((await factorFor('grid_electricity_india', months[0].periodEnd)).value) / 1000
      : null;
  const byAction = new Map<string, Finding>();
  for (const f of insights.findings) byAction.set(ACTION_CODE[f.code], f);

  const items = library.flatMap((a) => {
    const finding = byAction.get(a.code);
    // Bill-derived actions exist only while their finding is flagged.
    if (BILL_DERIVED.has(a.code) && !finding) return [];
    const monthly = finding?.inrPerMonth ?? null;
    const share = finding ? null : enduseSaving(a, months, grid);
    const low = share ? share.inrPerMonthLow : monthly;
    const high = share ? share.inrPerMonthHigh : monthly;
    const costLow = a.isZeroCost ? 0 : n(a.costLow);
    const costHigh = a.isZeroCost ? 0 : n(a.costHigh);
    const annualInrMid = low == null || high == null ? null : ((low + high) / 2) * 12;
    const savingBasis: SavingBasis = finding
      ? 'bill'
      : share
        ? 'enduse_share'
        : a.savingLow != null
          ? 'pending_measurement'
          : 'not_quantified';
    const co2 = share?.co2TonnesPerYear ?? null;
    const payback =
      costLow == null || costHigh == null || annualInrMid == null
        ? null
        : simplePaybackYears({
            capexInr: (costLow + costHigh) / 2,
            annualSavingInrMid: annualInrMid,
          });
    const siteAction = planned.find((p) => p.actionId === a.id);
    return [
      {
        code: a.code,
        title: a.equipment,
        isZeroCost: a.isZeroCost,
        inrPerMonthLow: low,
        inrPerMonthHigh: high,
        annualInrMid,
        costLow,
        costHigh,
        paybackYears: payback,
        // kVAh, demand and billing fixes save rupees, not kWh, so there is no CO2 figure.
        co2TonnesPerYear: co2,
        co2Note: finding
          ? 'This fix saves rupees on the bill, not kWh, so no CO2 saving is claimed.'
          : null,
        source: finding ? `${finding.rule.line}; ${a.source}` : a.source,
        finding: finding?.code ?? null,
        status: siteAction?.status ?? 'suggested',
        enduse: a.enduse as string,
        savingBasis,
        kwhPerYearLow: share?.kwhPerYearLow ?? null,
        kwhPerYearHigh: share?.kwhPerYearHigh ?? null,
        costYear: a.costYear,
        costNote: a.costNote,
        savingNote: a.savingNote,
        page: a.page,
        quotedLine: a.quotedLine,
        co2SavedTonnes: co2 ?? 0,
      },
    ];
  });
  // co2SavedTonnes only feeds the ranking; no CO2 saving is claimed for bill-derived fixes.
  // Doc 02 ACT-1 order, with unvalued actions last so the #1 always shows rupees: (1) zero-cost
  // with a saving, by annual Rs; (2) paid with a saving, by payback, CO2 as tie-breaker, then
  // annual Rs (rankActions sorts stably); (3) not quantified, zero-cost before paid, by code.
  const byRupees = [...items].sort((a, b) => (b.annualInrMid ?? -1) - (a.annualInrMid ?? -1));
  const valued = byRupees.filter((a) => a.annualInrMid != null);
  const ranked = [
    ...valued.filter((a) => a.isZeroCost),
    ...rankActions(valued.filter((a) => !a.isZeroCost)),
    ...items
      .filter((a) => a.annualInrMid == null)
      .sort((a, b) => Number(b.isZeroCost) - Number(a.isZeroCost)),
  ];
  const actions = ranked.map((a) => {
    const out: Partial<typeof a> = { ...a };
    delete out.co2SavedTonnes;
    return out as ActionItem;
  });
  return { insights, actions };
}
