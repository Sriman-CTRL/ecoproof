import type { Organisation, Scheme, Site } from '@prisma/client';
import { z } from 'zod';
import { prisma } from '../db.js';
import { notFound } from '../errors.js';

/** FIN-1 statuses. Display text uses the Doc 02 / Doc 05 fixed phrases only. */
export type SchemeStatus = 'likely' | 'check_lender' | 'check_office' | 'not_eligible';

export const STATUS_TEXT: Record<Exclude<SchemeStatus, 'not_eligible'>, string> = {
  likely: 'Likely eligible; confirm with the scheme office',
  check_lender: 'Check with lender',
  check_office: 'Check with the scheme office',
};
const statusText = (status: SchemeStatus, reason: string) =>
  status === 'not_eligible' ? `Not eligible: ${reason}` : STATUS_TEXT[status];

/** Doc 02 FIN-1: rules not checked for more than 60 days show a warning. */
export const STALE_AFTER_DAYS = 60;

const Status = z.enum(['likely', 'check_lender', 'check_office', 'not_eligible']);
const Field = z.enum([
  'udyam_no',
  'udyam_category',
  'years_in_operation',
  'cash_profits_last_2y',
  'commenced_on',
  'sector',
]);
type Field = z.infer<typeof Field>;

const Clause = z.object({
  field: Field,
  op: z.enum(['eq', 'lt', 'before', 'after']),
  value: z.union([z.string(), z.number(), z.boolean()]),
  status: Status,
  reason: z.string(),
});

const Zed = z.object({
  fees_inr: z.object({ bronze: z.number(), silver: z.number(), gold: z.number() }),
  subsidy_pct: z.object({ micro: z.number(), small: z.number(), medium: z.number() }),
  women_sc_st_extra_pct: z.number(),
  reward_note: z.string(),
  fees_source_url: z.string(),
  bank_concessions: z.array(
    z.object({ bank: z.string(), bronze: z.string(), silver: z.string(), gold: z.string() }),
  ),
  bank_note: z.string(),
  bank_source_url: z.string(),
});

/** The rule format stored in schemes.rules_json (seed-data/schemes.json). First matching clause wins. */
export const SchemeRules = z.object({
  org_types: z.array(z.enum(['msme', 'household'])),
  states: z.array(z.string()).optional(),
  requires: z.array(Field),
  unknown_status: Status,
  when: z.array(Clause),
  otherwise: z.object({ status: Status, reason: z.string() }),
  money_inr: z.number().optional(),
  money_label: z.string().optional(),
  zed: Zed.optional(),
});
export type SchemeRules = z.infer<typeof SchemeRules>;

const FIELD_LABEL: Record<Field, string> = {
  udyam_no: 'Udyam number',
  udyam_category: 'Udyam category (micro, small or medium)',
  years_in_operation: 'years in operation',
  cash_profits_last_2y: 'cash profits',
  commenced_on: 'date of commencement',
  sector: 'sector',
};

type Profile = Record<Field, string | number | boolean | null>;

const profileOf = (org: Organisation): Profile => ({
  udyam_no: org.udyamNo,
  udyam_category: org.udyamCategory,
  years_in_operation: org.yearsInOperation,
  cash_profits_last_2y: org.cashProfitsLast2y,
  commenced_on: org.commencedOn ? org.commencedOn.toISOString().slice(0, 10) : null,
  sector: org.sector,
});

function matches(c: z.infer<typeof Clause>, v: string | number | boolean): boolean {
  switch (c.op) {
    case 'eq':
      return v === c.value;
    case 'lt':
      return typeof v === 'number' && v < Number(c.value);
    case 'before':
      return String(v) < String(c.value);
    case 'after':
      return String(v) > String(c.value);
  }
}

/** Pure FIN-1 rule evaluation for one scheme. Missing profile data is never "likely". */
export function evaluate(
  rules: SchemeRules,
  org: Pick<Organisation, 'type' | 'state'>,
  profile: Profile,
): { status: SchemeStatus; reason: string } | null {
  if (!rules.org_types.includes(org.type)) return null;
  if (rules.states && !rules.states.includes(org.state ?? '')) return null;
  const missing = rules.requires.filter((f) => profile[f] == null);
  if (missing.length > 0) {
    return {
      status: rules.unknown_status,
      reason: `Add your ${missing.map((f) => FIELD_LABEL[f]).join(' and ')} to the profile`,
    };
  }
  for (const c of rules.when) {
    const v = profile[c.field];
    if (v != null && matches(c, v)) return { status: c.status, reason: c.reason };
  }
  return rules.otherwise;
}

export interface SchemeMatch {
  code: string;
  name: string;
  status: SchemeStatus;
  statusText: string;
  reason: string;
  benefit: string | null;
  rateNote: string | null;
  lastChecked: string | null;
  stale: boolean;
  sourceUrl: string | null;
}

export interface ZedCard {
  status: SchemeStatus;
  statusText: string;
  rewardInr: number;
  feesInr: { bronze: number; silver: number; gold: number };
  /** Subsidy for this unit's size, plus the women/SC/ST extra when the profile says so. */
  subsidyPct: number | null;
  udyamCategory: string | null;
  womenScStExtraPct: number;
  womenScStApplied: boolean;
  rewardNote: string;
  bankConcessions: Array<{ bank: string; bronze: string; silver: string; gold: string }>;
  bankNote: string;
  sourceUrl: string | null;
  bankSourceUrl: string;
  lastChecked: string | null;
  stale: boolean;
}

export interface SchemesView {
  moneyFound: { inr: number; items: Array<{ code: string; label: string; inr: number }> };
  zed: ZedCard | null;
  matches: SchemeMatch[];
  topMatch: { code: string; sourceUrl: string | null } | null;
}

const DAY_MS = 24 * 60 * 60 * 1000;
const isStale = (lastChecked: Date | null, now: Date) =>
  lastChecked == null || now.getTime() - lastChecked.getTime() > STALE_AFTER_DAYS * DAY_MS;

export function matchSchemes(org: Organisation, schemes: Scheme[], now: Date): SchemesView {
  const profile = profileOf(org);
  const matches: SchemeMatch[] = [];
  const rulesOf = new Map<string, SchemeRules>();
  for (const s of schemes) {
    if (!s.active || !s.code) continue;
    const rules = SchemeRules.parse(s.rulesJson);
    const r = evaluate(rules, org, profile);
    if (!r) continue;
    matches.push({
      code: s.code,
      name: s.name,
      status: r.status,
      statusText: statusText(r.status, r.reason),
      reason: r.reason,
      benefit: s.benefitText,
      rateNote: s.rateRange,
      lastChecked: s.lastCheckedAt ? s.lastCheckedAt.toISOString().slice(0, 10) : null,
      stale: isStale(s.lastCheckedAt, now),
      sourceUrl: s.sourceUrl,
    });
    rulesOf.set(s.code, rules);
  }

  // Only fixed rupee amounts the unit is "likely" for. Never subventions or percentages.
  const items = matches.flatMap((m) => {
    const r = rulesOf.get(m.code)!;
    return m.status === 'likely' && r.money_inr != null
      ? [{ code: m.code, label: r.money_label ?? m.name, inr: r.money_inr }]
      : [];
  });

  const zedMatch = matches.find((m) => rulesOf.get(m.code)!.zed);
  const zed: ZedCard | null = zedMatch
    ? (() => {
        const zr = rulesOf.get(zedMatch.code)!;
        const z = zr.zed!;
        const size = profile.udyam_category as keyof typeof z.subsidy_pct | null;
        const base = size && size in z.subsidy_pct ? z.subsidy_pct[size] : null;
        const extra = org.womenScStOwned === true;
        return {
          status: zedMatch.status,
          statusText: zedMatch.statusText,
          rewardInr: zr.money_inr ?? 0,
          feesInr: z.fees_inr,
          subsidyPct: base == null ? null : base + (extra ? z.women_sc_st_extra_pct : 0),
          udyamCategory: size,
          womenScStExtraPct: z.women_sc_st_extra_pct,
          womenScStApplied: extra,
          rewardNote: z.reward_note,
          bankConcessions: z.bank_concessions,
          bankNote: z.bank_note,
          sourceUrl: zedMatch.sourceUrl,
          bankSourceUrl: z.bank_source_url,
          lastChecked: zedMatch.lastChecked,
          stale: zedMatch.stale,
        };
      })()
    : null;

  const order: Record<SchemeStatus, number> = {
    likely: 0,
    check_lender: 1,
    check_office: 2,
    not_eligible: 3,
  };
  const out = [...matches].sort((a, b) => order[a.status] - order[b.status]);
  const top = out.find((m) => m.status !== 'not_eligible') ?? null;
  return {
    moneyFound: { inr: items.reduce((t, i) => t + i.inr, 0), items },
    zed,
    matches: out,
    topMatch: top ? { code: top.code, sourceUrl: top.sourceUrl } : null,
  };
}

export async function computeSchemes(site: Site, now = new Date()): Promise<SchemesView> {
  const org = await prisma.organisation.findFirst({ where: { id: site.orgId } });
  if (!org) throw notFound('Organisation');
  const schemes = await prisma.scheme.findMany({
    where: { active: true },
    orderBy: { sortOrder: 'asc' },
  });
  return matchSchemes(org, schemes, now);
}
