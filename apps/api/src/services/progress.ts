import type { Site } from '@prisma/client';
import { prisma } from '../db.js';
import { AppError } from '../errors.js';
import { listActions } from './actions.js';
import {
  ACTION_CODE,
  BASELINE_RULES,
  computeInsights,
  type FindingCode,
  type Insights,
} from './insights.js';

// Plan 6.1 / Doc 04 "Milestones and leaderboard". Every stage, date and rupee below is read from
// stored rows; a milestone whose data does not exist is simply not reached.

export type MilestoneKey =
  | 'first_footprint'
  | 'baseline_ready'
  | 'first_action_done'
  | 'first_10k_saved'
  | 'one_lakh_saved'
  | 'loan_pack_sent'
  | 'buyer_approved';

export interface Milestone {
  key: MilestoneKey;
  reached: boolean;
  reachedAt: string | null;
  source: string;
}

export type StageKey = 'measured' | 'baseline' | 'saving' | 'finance' | 'buyer';

export interface Stage {
  n: 1 | 2 | 3 | 4 | 5;
  key: StageKey;
  reached: boolean;
  reachedAt: string | null;
  /** Milestones that make up this stage (all must be reached). */
  milestones: MilestoneKey[];
  /** What reaching the stage unlocks (plan 6.1 table); the web translates the key. */
  unlocks: string;
}

export type NextKey =
  'addBill' | 'moreBills' | 'startAction' | 'keepAdding' | 'makeLoanPack' | 'shareBuyer';

export interface Progress {
  stage: 0 | 1 | 2 | 3 | 4 | 5;
  stageName: string | null;
  stages: Stage[];
  milestones: Milestone[];
  next: { key: NextKey; params: Record<string, string | number>; text: string; href: string };
  headroom: {
    foundInrPerMonth: number;
    startedInrPerMonth: number;
    onTableInrPerMonth: number;
    basis: string;
  };
  ritual: {
    month: string | null;
    billReceived: boolean;
    valuesConfirmed: boolean;
    billChecked: boolean;
    actionChosen: boolean;
  };
}

/** Doc 04: "First ₹10,000 saved" and "₹1 lakh saved", from the verified savings ledger. */
const SAVED_MILESTONES = { first_10k_saved: 10000, one_lakh_saved: 100000 } as const;
const STARTED = new Set(['planned', 'in_progress', 'done']);
/** Headroom looks at the last 12 confirmed bills only (one year; keeps Home fast). */
const HEADROOM_MONTHS = 12;
/**
 * Months checked at once. All 12 together sometimes failed at ~5 s on a cold start (likely
 * Prisma's connect timeout while opening many pooler connections); 6 keeps the scan under ~1 s.
 */
const SCAN_CONCURRENCY = 6;

const STAGE_DEFS: Array<Omit<Stage, 'reached' | 'reachedAt'> & { name: string }> = [
  {
    n: 1,
    key: 'measured',
    name: 'Measured',
    milestones: ['first_footprint'],
    unlocks: 'billHealth',
  },
  {
    n: 2,
    key: 'baseline',
    name: 'Baseline set',
    milestones: ['baseline_ready'],
    unlocks: 'savingsTracking',
  },
  {
    n: 3,
    key: 'saving',
    name: 'Saving',
    milestones: ['first_action_done', 'first_10k_saved'],
    unlocks: 'shareCard',
  },
  {
    n: 4,
    key: 'finance',
    name: 'Finance-ready',
    milestones: ['loan_pack_sent'],
    unlocks: 'lenderTracker',
  },
  {
    n: 5,
    key: 'buyer',
    name: 'Buyer-ready',
    milestones: ['buyer_approved', 'one_lakh_saved'],
    unlocks: 'buyerRoom',
  },
];

const monthKey = (d: Date) => d.toISOString().slice(0, 7);
const n = (d: { toString(): string } | null | undefined) => (d == null ? null : Number(d));

export async function computeProgress(site: Site): Promise<Progress> {
  const orgId = site.orgId;
  const where = { orgId, siteId: site.id };
  const [months, firstResult, siteActions, ledger, firstShare, pending] = await Promise.all([
    prisma.energyMonth.findMany({ where, orderBy: { periodStart: 'asc' } }),
    prisma.result.findFirst({ where, orderBy: { month: 'asc' } }),
    prisma.siteAction.findMany({ where, include: { action: { select: { code: true } } } }),
    prisma.savingsLedger.findMany({ where, orderBy: { month: 'asc' } }),
    prisma.share.findFirst({
      where: { orgId, report: { orgId, type: 'loan_pack', snapshot: { siteId: site.id } } },
      orderBy: { createdAt: 'asc' },
    }),
    // Bills uploaded and read but not yet confirmed: they count as "received" for the ritual.
    prisma.extraction.findMany({
      where: {
        orgId,
        confirmedAt: null,
        document: { orgId, siteId: site.id, kind: 'power_bill', status: { not: 'confirmed' } },
      },
      select: { fieldsJson: true },
    }),
  ]);

  // ---- milestones
  const milestones: Milestone[] = [];
  const add = (key: MilestoneKey, at: Date | null, source: string) =>
    milestones.push({ key, reached: at != null, reachedAt: at ? at.toISOString() : null, source });

  add(
    'first_footprint',
    firstResult?.month ?? null,
    firstResult ? `results row for ${monthKey(firstResult.month)}` : 'no results yet',
  );
  const nth = months[BASELINE_RULES.minMonthsForRegression - 1];
  add(
    'baseline_ready',
    nth?.periodStart ?? null,
    nth
      ? `confirmed bill ${BASELINE_RULES.minMonthsForRegression} of ${months.length} (${monthKey(nth.periodStart)})`
      : `${months.length} of ${BASELINE_RULES.minMonthsForRegression} confirmed bills`,
  );
  const done = siteActions
    .filter((a) => a.status === 'done' && a.doneAt)
    .sort((a, b) => a.doneAt!.getTime() - b.doneAt!.getTime())[0];
  add(
    'first_action_done',
    done?.doneAt ?? null,
    done ? `site action ${done.action.code} marked done` : 'no action marked done',
  );

  // Verified ledger months only ("Too early to confirm" months do not count), in month order.
  const verifiedByMonth = new Map<number, number>();
  for (const row of ledger) {
    if (row.status !== 'verified') continue;
    const t = row.month.getTime();
    verifiedByMonth.set(t, (verifiedByMonth.get(t) ?? 0) + (n(row.inrSaved) ?? 0));
  }
  for (const [key, target] of Object.entries(SAVED_MILESTONES) as Array<
    [keyof typeof SAVED_MILESTONES, number]
  >) {
    let total = 0;
    let at: Date | null = null;
    for (const [t, inr] of [...verifiedByMonth].sort((a, b) => a[0] - b[0])) {
      total += inr;
      if (total >= target) {
        at = new Date(t);
        break;
      }
    }
    add(
      key,
      at,
      at
        ? `savings ledger, verified total reached in ${monthKey(at)}`
        : `savings ledger, verified total Rs ${Math.round(total)}`,
    );
  }
  add(
    'loan_pack_sent',
    firstShare?.createdAt ?? null,
    firstShare ? 'loan-ready summary shared' : 'no loan-ready summary shared',
  );
  add('buyer_approved', null, 'not built yet');

  // ---- stages, strictly in order
  const byKey = new Map(milestones.map((m) => [m.key, m]));
  const stages: Stage[] = [];
  for (const { n: num, key, milestones: keys, unlocks } of STAGE_DEFS) {
    const s = { n: num, key, milestones: keys, unlocks };
    const ms = keys.map((k) => byKey.get(k)!);
    const reached = (stages.at(-1)?.reached ?? true) && ms.every((m) => m.reached);
    // A stage is reached on the date its last milestone came true.
    const reachedAt = reached
      ? ms.map((m) => m.reachedAt!).reduce((a, b) => (a > b ? a : b))
      : null;
    stages.push({ ...s, reached, reachedAt });
  }
  const stage = (stages.filter((s) => s.reached).at(-1)?.n ?? 0) as Progress['stage'];

  // ---- headroom: most recent flagged value per finding over the last 12 confirmed bills
  const recent = months.slice(-HEADROOM_MONTHS);
  // The top action is needed only when the next step is "Start: <action>"; fetch it alongside.
  const needsTop = months.length >= BASELINE_RULES.minMonthsForRegression && !done;
  const topAction = needsTop
    ? listActions(site, months.at(-1)!.periodStart, null).then((r) => r.actions[0])
    : Promise.resolve(undefined);
  // Awaited below; this only stops a failure from going unhandled if the headroom scan fails first.
  topAction.catch(() => undefined);
  const insights = await mapLimit(recent, SCAN_CONCURRENCY, (m) =>
    computeInsights(site, m.periodStart, null, { card: false }).catch((e: unknown) => {
      if (e instanceof AppError) return null;
      throw e;
    }),
  );
  const latestByCode = new Map<FindingCode, number>();
  for (const ins of insights.filter((i): i is Insights => i != null)) {
    // Ascending months: later months overwrite earlier ones.
    for (const f of ins.findings) latestByCode.set(f.code, f.inrPerMonth ?? 0);
  }
  const startedCodes = new Set(
    siteActions.filter((a) => STARTED.has(a.status)).map((a) => a.action.code),
  );
  let found = 0;
  let started = 0;
  for (const [code, inr] of latestByCode) {
    found += inr;
    if (startedCodes.has(ACTION_CODE[code])) started += inr;
  }
  const headroom = {
    foundInrPerMonth: Math.round(found),
    startedInrPerMonth: Math.round(started),
    onTableInrPerMonth: Math.round(found - started),
    basis:
      'Found: each bill finding at its most recent flagged value over your last 12 confirmed bills. ' +
      'Started: the findings whose fix is planned, in progress or done. On the table: found minus started.',
  };

  // ---- ritual for the latest month (a read-but-unconfirmed bill can be newer than any confirmed one)
  const pendingMonths = pending
    .map((p) => (p.fieldsJson as { periodStart?: unknown } | null)?.periodStart)
    .filter((s): s is string => typeof s === 'string' && /^\d{4}-\d{2}/.test(s))
    .map((s) => s.slice(0, 7));
  const confirmedMonths = new Set(months.map((m) => monthKey(m.periodStart)));
  const candidates = [...confirmedMonths, ...pendingMonths].sort();
  const ritualMonth = candidates.at(-1) ?? null;
  let ritual: Progress['ritual'] = {
    month: null,
    billReceived: false,
    valuesConfirmed: false,
    billChecked: false,
    actionChosen: false,
  };
  if (ritualMonth) {
    const start = new Date(`${ritualMonth}-01T00:00:00Z`);
    const checked = await prisma.result.findFirst({
      where: { orgId, siteId: site.id, month: start },
      select: { id: true },
    });
    // site_actions has no updatedAt: the latest of its own timestamps stands in for it.
    const touched = (a: (typeof siteActions)[number]) =>
      Math.max(a.createdAt.getTime(), a.plannedAt?.getTime() ?? 0, a.doneAt?.getTime() ?? 0);
    ritual = {
      month: ritualMonth,
      billReceived: true,
      valuesConfirmed: confirmedMonths.has(ritualMonth),
      billChecked: checked != null,
      actionChosen: siteActions.some((a) => STARTED.has(a.status) && touched(a) >= start.getTime()),
    };
  }

  // ---- next: exactly one step, in the prompt's priority order
  const needed = BASELINE_RULES.minMonthsForRegression - months.length;
  const verifiedTotal = [...verifiedByMonth.values()].reduce((a, b) => a + b, 0);
  let next: Progress['next'];
  if (months.length === 0) {
    next = mk('addBill', {}, 'Add your latest electricity bill', '/bills/new');
  } else if (needed > 0) {
    next = mk(
      'moreBills',
      { count: needed },
      `Add ${needed} more bill${needed === 1 ? '' : 's'} to set your baseline`,
      '/bills/new',
    );
  } else if (!done) {
    const latest = months.at(-1)!.periodStart;
    const top = await topAction;
    next = top
      ? mk(
          'startAction',
          { code: top.code, title: top.title },
          `Start: ${top.title}`,
          `/actions/${top.code}?month=${monthKey(latest)}`,
        )
      : mk('addBill', {}, 'Add your latest electricity bill', '/bills/new');
  } else if (verifiedTotal < SAVED_MILESTONES.first_10k_saved) {
    next = mk(
      'keepAdding',
      {},
      'Keep adding monthly bills; savings are confirmed after a few months',
      '/bills/new',
    );
  } else if (!firstShare) {
    const pick =
      siteActions.find((a) => a.status === 'planned') ??
      siteActions.find((a) => a.status === 'done');
    next = mk(
      'makeLoanPack',
      {},
      'Make a loan-ready summary',
      pick ? `/actions/${pick.action.code}` : '/actions',
    );
  } else {
    next = mk('shareBuyer', {}, 'Share your data with a buyer (coming soon)', '/progress');
  }

  const current = STAGE_DEFS.find((s) => s.n === stage);
  return {
    stage,
    stageName: current?.name ?? null,
    stages,
    milestones,
    next,
    headroom,
    ritual,
  };
}

function mk(
  key: NextKey,
  params: Record<string, string | number>,
  text: string,
  href: string,
): Progress['next'] {
  return { key, params, text, href };
}

/** Promise.all with at most `limit` calls in flight; results keep the input order. */
async function mapLimit<T, R>(
  items: T[],
  limit: number,
  fn: (item: T) => Promise<R>,
): Promise<R[]> {
  const out = new Array<R>(items.length);
  let i = 0;
  const worker = async () => {
    while (i < items.length) {
      const k = i++;
      out[k] = await fn(items[k]!);
    }
  };
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return out;
}
