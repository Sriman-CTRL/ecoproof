import {
  adjustedBaseline,
  checkContractedDemand,
  checkLtSurcharges,
  checkMinimumCharges,
  checkPeakUse,
  checkPowerFactor,
  fitBaseline,
  type BaselineMethod,
} from '@ecoproof/calc';
import type { EnergyMonth, Site, TariffRule } from '@prisma/client';
import { prisma } from '../db.js';
import { AppError } from '../errors.js';

export type FindingCode =
  'power_factor' | 'peak_use' | 'contracted_demand' | 'minimum_charges' | 'lt_surcharges';

export interface RuleRef {
  id: string;
  discom: string;
  category: string;
  ruleType: string;
  source: string;
  validFrom: string | null;
  basisNote: string | null;
  /** e.g. "TGSPDCL HT-I(A), FY 2024-25 (valid from inferred)" */
  line: string;
}

export interface Finding {
  code: FindingCode;
  flagged: boolean;
  /** Rs per month; null when it cannot be valued yet (peak use without shiftable units). */
  inrPerMonth: number | null;
  oneLineFix: string;
  explain: Record<string, number | string | null>;
  rule: RuleRef;
  assumption?: string;
}

export const ONE_LINE_FIX: Record<FindingCode, string> = {
  power_factor:
    'Fit or repair a capacitor bank (APFC panel) to bring power factor to 0.98 or above.',
  peak_use: 'Move shiftable work out of 6-10 am and 6-10 pm into 10 am-6 pm.',
  contracted_demand: 'Ask TGSPDCL to reduce contracted demand closer to your real maximum demand.',
  minimum_charges: 'Your use is below the minimum billed units; check the contracted demand.',
  lt_surcharges: 'Your bill carries a power factor or capacitor surcharge; fit a capacitor.',
};

export const ACTION_CODE: Record<FindingCode, string> = {
  power_factor: 'fix_power_factor',
  peak_use: 'shift_peak_use_to_solar_hours',
  contracted_demand: 'reduce_contracted_demand',
  minimum_charges: 'avoid_minimum_charges',
  lt_surcharges: 'fix_power_factor',
};

// Doc 03 "Baseline and verified savings": ASHRAE Guideline 14 acceptance limits.
export const BASELINE_RULES = { minMonthsForRegression: 9, maxCvRmsePct: 15, maxAbsNmbePct: 5 };

const num = (d: { toString(): string } | null | undefined) => (d == null ? null : Number(d));
const iso = (d: Date) => d.toISOString().slice(0, 10);
const addMonths = (d: Date, k: number) =>
  new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + k, 1));

function ruleRef(r: TariffRule): RuleRef {
  const fy = /FY \d{4}-\d{2}/.exec(r.source)?.[0];
  const inferred = r.basisNote?.includes('inferred') ? ' (valid from inferred)' : '';
  return {
    id: r.id,
    discom: r.discom,
    category: r.category,
    ruleType: r.ruleType,
    source: r.source,
    validFrom: r.validFrom ? iso(r.validFrom) : null,
    basisNote: r.basisNote,
    line: `${r.discom} ${r.category}, ${fy ?? r.source}${inferred}`,
  };
}

/** Rule rows for the site's discom+category that are not withdrawn and valid for the bill period. */
async function loadRules(site: Site, periodEnd: Date): Promise<Map<string, TariffRule>> {
  if (!site.discom || !site.tariffCategory) return new Map();
  const rows = await prisma.tariffRule.findMany({
    where: { discom: site.discom, category: site.tariffCategory },
  });
  return new Map(
    rows
      .filter((r) => r.status !== 'withdrawn' && (r.validFrom == null || r.validFrom <= periodEnd))
      .map((r) => [r.ruleType, r]),
  );
}

function param(rule: TariffRule, key: string): number {
  const v = (rule.paramsJson as Record<string, unknown>)[key];
  if (typeof v !== 'number') {
    throw new AppError(500, 'RULE_PARAM_MISSING', `Tariff rule ${rule.ruleType} lacks ${key}`);
  }
  return v;
}

export interface Baseline {
  method: BaselineMethod;
  months: number;
  expectedKwh: number;
  actualKwh: number;
  diffKwh: number;
  diffPct: number;
}

export interface InsightCard {
  sentence: string | null;
  comparedWith: 'same month last year' | null;
  change: {
    inr: number | null;
    kwh: number | null;
    /** Grid + fuels total; kept for older clients. */
    tCo2: number | null;
    /** Scope 2 change, t CO2 (grid factor is CO2-only). */
    tCo2Grid: number | null;
    /** Scope 1 change, t CO2e (fuels). */
    tCo2eFuels: number | null;
  } | null;
  largestDriver: 'production' | 'power_factor' | 'peak_use' | 'diesel' | null;
  drivers: Array<{ code: string; inr: number | null; kwh: number | null; note: string }>;
  baseline: Baseline | null;
}

export interface Insights {
  siteId: string;
  month: string;
  findings: Finding[];
  passed: Finding[];
  /** Checks that could not run: no valid rule for the period, or bill fields missing. */
  skipped: Array<{ code: FindingCode; reason: string }>;
  /** Sum of flagged findings in Rs/month; findings not yet valued (null) count as 0. */
  atStake: { inrPerMonth: number; pendingCodes: FindingCode[] };
  insightCard: InsightCard;
}

const billTotal = (e: EnergyMonth) => (num(e.energyCharges) ?? 0) + (num(e.demandCharges) ?? 0);

export async function resolveMonth(orgId: string, siteId: string, month?: string): Promise<Date> {
  if (month) {
    if (!/^\d{4}-\d{2}$/.test(month)) {
      throw new AppError(400, 'VALIDATION', 'month must be YYYY-MM');
    }
    return new Date(`${month}-01T00:00:00Z`);
  }
  const latest = await prisma.energyMonth.findFirst({
    where: { orgId, siteId },
    orderBy: { periodStart: 'desc' },
    select: { periodStart: true },
  });
  if (!latest) throw new AppError(404, 'NO_BILLS', 'No confirmed bills yet');
  return latest.periodStart;
}

export async function computeInsights(
  site: Site,
  monthStart: Date,
  shiftableKwh: number | null,
): Promise<Insights> {
  const orgId = site.orgId;
  const em = await prisma.energyMonth.findFirst({
    where: { orgId, siteId: site.id, periodStart: monthStart },
  });
  if (!em) throw new AppError(404, 'NOT_FOUND', 'No confirmed bill for that month');

  const rules = await loadRules(site, em.periodEnd);
  const findings: Finding[] = [];
  const passed: Finding[] = [];
  const skipped: Insights['skipped'] = [];
  const push = (f: Finding) => (f.flagged ? findings : passed).push(f);

  const kwh = num(em.kwh);
  const kvah = num(em.kvah);
  const energyCharges = num(em.energyCharges);
  const demandCharges = num(em.demandCharges);
  const md = num(em.mdKva);
  const cd = num(site.contractedDemandKva);
  const isLt = (site.tariffCategory ?? '').startsWith('LT');

  const energyRate = energyCharges != null && kvah ? energyCharges / kvah : null;
  const billingDemand = md != null && cd != null ? Math.max(md, 0.8 * cd) : null;
  const demandRate = demandCharges != null && billingDemand ? demandCharges / billingDemand : null;

  const need = (code: FindingCode, ruleType: string, ok: boolean, missing: string) => {
    const rule = rules.get(ruleType);
    if (!rule) {
      skipped.push({ code, reason: `No ${ruleType} rule valid for this bill period` });
      return null;
    }
    if (!ok) {
      skipped.push({ code, reason: `Bill lacks ${missing}` });
      return null;
    }
    return rule;
  };

  if (isLt) {
    const rule = need('lt_surcharges', 'surcharges_from_bill', true, '');
    if (rule) {
      const names = (rule.paramsJson as { read_line_items?: string[] }).read_line_items ?? [];
      const lineItems = Object.fromEntries(
        Object.entries((em.otherChargesJson ?? {}) as Record<string, unknown>).filter(
          (kv): kv is [string, number] => typeof kv[1] === 'number',
        ),
      );
      const r = checkLtSurcharges({ lineItems, rules: { readLineItems: names } });
      const total = r.items.reduce((t, i) => t + i.inr, 0);
      push({
        code: 'lt_surcharges',
        flagged: r.flagged,
        inrPerMonth: total,
        oneLineFix: ONE_LINE_FIX.lt_surcharges,
        explain: Object.fromEntries(r.items.map((i) => [i.name, i.inr])),
        rule: ruleRef(rule),
      });
    }
  } else {
    const pfRule = need(
      'power_factor',
      'kvah_billing',
      kwh != null && kvah != null && energyRate != null,
      'kWh, kVAh or energy charges',
    );
    if (pfRule && kwh != null && kvah != null && energyRate != null) {
      const r = checkPowerFactor({
        kwh,
        kvah,
        energyRatePerKvah: energyRate,
        rules: { pfFlagBelow: param(pfRule, 'pf_flag_below') },
      });
      push({
        code: 'power_factor',
        flagged: r.flagged,
        inrPerMonth: r.lossInrPerMonth,
        oneLineFix: ONE_LINE_FIX.power_factor,
        explain: {
          kwh,
          kvah,
          powerFactor: r.pf,
          flagBelow: param(pfRule, 'pf_flag_below'),
          lossKvah: r.lossKvah,
          energyRatePerKvah: energyRate,
        },
        rule: ruleRef(pfRule),
      });
    }

    const peakKwh = num(em.peakKwh);
    const todRule = need('peak_use', 'tod', kwh != null && peakKwh != null, 'kWh or peak kWh');
    if (todRule && kwh != null && peakKwh != null) {
      const surcharge = param(todRule, 'peak_surcharge_inr_per_kwh');
      const rebate = param(todRule, 'solar_rebate_inr_per_kwh');
      const flagAbovePct = param(todRule, 'peak_flag_above_pct');
      const r = checkPeakUse({
        totalKwh: kwh,
        peakKwh,
        shiftableKwh: shiftableKwh == null ? null : Math.min(shiftableKwh, peakKwh),
        rules: { peakSurchargePerKwh: surcharge, solarRebatePerKwh: rebate, flagAbovePct },
      });
      push({
        code: 'peak_use',
        flagged: r.flagged,
        inrPerMonth: r.savingInrPerMonth,
        oneLineFix: ONE_LINE_FIX.peak_use,
        explain: {
          totalKwh: kwh,
          peakKwh,
          peakSharePct: r.peakSharePct,
          flagAbovePct,
          peakSurchargeInrPerKwh: surcharge,
          solarRebateInrPerKwh: rebate,
          shiftableKwh,
        },
        rule: ruleRef(todRule),
      });
    }

    const bdRule = need(
      'contracted_demand',
      'billing_demand',
      cd != null && demandRate != null,
      'contracted demand, maximum demand or demand charges',
    );
    if (bdRule && cd != null && demandRate != null) {
      const mds = await prisma.energyMonth.findMany({
        where: { orgId, siteId: site.id, periodStart: { lte: monthStart }, mdKva: { not: null } },
        orderBy: { periodStart: 'desc' },
        take: 12,
        select: { mdKva: true },
      });
      const minBillingPctOfCd = param(bdRule, 'flag_if_md_below_pct_of_cd');
      const flagMonths = param(bdRule, 'flag_months');
      const r = checkContractedDemand({
        contractedKva: cd,
        last12MdKva: mds.map((m) => Number(m.mdKva)),
        demandRatePerKva: demandRate,
        rules: { minBillingPctOfCd, flagMonths },
      });
      push({
        code: 'contracted_demand',
        flagged: r.flagged,
        inrPerMonth: r.overpayInrPerMonth,
        oneLineFix: ONE_LINE_FIX.contracted_demand,
        explain: {
          contractedDemandKva: cd,
          maxMdKva12Months: r.maxMd,
          monthsBelowThreshold: r.monthsBelow,
          monthsConsidered: mds.length,
          flagIfMdBelowPctOfCd: minBillingPctOfCd,
          flagMonths,
          demandRatePerKva: demandRate,
        },
        rule: ruleRef(bdRule),
      });
    }

    const minRule = need(
      'minimum_charges',
      'minimum_charge',
      billingDemand != null && kvah != null && energyRate != null,
      'maximum demand, kVAh or energy charges',
    );
    if (minRule && billingDemand != null && kvah != null && energyRate != null) {
      const perKva = param(minRule, 'kvah_per_kva_billing_demand_per_month');
      const r = checkMinimumCharges({
        billingDemandKva: billingDemand,
        actualKvah: kvah,
        energyRatePerKvah: energyRate,
        rules: { kvahPerKvaPerMonth: perKva },
      });
      push({
        code: 'minimum_charges',
        flagged: r.flagged,
        inrPerMonth: r.gapInrPerMonth,
        oneLineFix: ONE_LINE_FIX.minimum_charges,
        explain: {
          billingDemandKva: billingDemand,
          kvahPerKvaPerMonth: perKva,
          minimumKvah: r.minimumKvah,
          actualKvah: kvah,
          gapKvah: r.gapKvah,
          energyRatePerKvah: energyRate,
        },
        rule: ruleRef(minRule),
        assumption: r.assumption,
      });
    }
  }

  return {
    siteId: site.id,
    month: iso(monthStart),
    findings,
    passed,
    skipped,
    atStake: {
      inrPerMonth: findings.reduce((t, f) => t + (f.inrPerMonth ?? 0), 0),
      pendingCodes: findings.filter((f) => f.inrPerMonth == null).map((f) => f.code),
    },
    insightCard: await buildCard(site, em, energyRate, rules.get('tod') ?? null),
  };
}

async function buildCard(
  site: Site,
  em: EnergyMonth,
  energyRate: number | null,
  tod: TariffRule | null,
): Promise<InsightCard> {
  const orgId = site.orgId;
  const empty: InsightCard = {
    sentence: null,
    comparedWith: null,
    change: null,
    largestDriver: null,
    drivers: [],
    baseline: null,
  };
  const kwh = num(em.kwh);
  if (kwh == null) return empty;

  const prior = await prisma.energyMonth.findMany({
    where: { orgId, siteId: site.id, periodStart: { lt: em.periodStart }, kwh: { not: null } },
    orderBy: { periodStart: 'desc' },
    take: 12,
  });
  const production = await prisma.productionMonth.findMany({
    where: { orgId, siteId: site.id },
  });
  const prod = new Map(production.map((p) => [p.month.getTime(), Number(p.quantity)]));
  const thisP = prod.get(em.periodStart.getTime()) ?? null;

  // Baseline from up to 12 prior confirmed months that have production.
  let baseline: Baseline | null = null;
  const fitMonths = prior.flatMap((m) => {
    const p = prod.get(m.periodStart.getTime());
    return p && p > 0 ? [{ productionTonnes: p, kwh: Number(m.kwh) }] : [];
  });
  let slope: number | null = null;
  if (fitMonths.length >= 2 && thisP && thisP > 0) {
    try {
      const fit = fitBaseline({ months: fitMonths, rules: BASELINE_RULES });
      const expectedKwh = adjustedBaseline(fit, thisP);
      slope = fit.b;
      baseline = {
        method: fit.method,
        months: fit.n,
        expectedKwh,
        actualKwh: kwh,
        diffKwh: kwh - expectedKwh,
        diffPct: expectedKwh > 0 ? ((kwh - expectedKwh) / expectedKwh) * 100 : 0,
      };
    } catch {
      baseline = null; // identical production in every month: no fit
    }
  }

  const lastYearStart = addMonths(em.periodStart, -12);
  const ly = prior.find((m) => m.periodStart.getTime() === lastYearStart.getTime());
  if (!ly) return { ...empty, baseline };

  const [results, fuels] = await Promise.all([
    prisma.result.findMany({
      where: { orgId, siteId: site.id, month: { in: [em.periodStart, ly.periodStart] } },
    }),
    prisma.fuelEntry.findMany({
      where: {
        orgId,
        siteId: site.id,
        fuelType: 'diesel',
        date: { gte: ly.periodStart, lte: em.periodEnd },
      },
    }),
  ]);
  const resultFor = (month: Date) => results.find((x) => x.month.getTime() === month.getTime());
  const co2 = (month: Date, scope: 'scope1' | 'scope2') => {
    const r = resultFor(month);
    return r ? Number(r[scope] ?? 0) : null;
  };
  const litres = (e: EnergyMonth) =>
    fuels
      .filter((f) => f.date >= e.periodStart && f.date <= e.periodEnd)
      .reduce((t, f) => t + Number(f.quantity), 0);

  const lyKwh = num(ly.kwh) ?? 0;
  const lyKvah = num(ly.kvah);
  const kvah = num(em.kvah);
  const changeInr = billTotal(em) - billTotal(ly);
  const delta = (scope: 'scope1' | 'scope2') => {
    const now = co2(em.periodStart, scope);
    const then = co2(ly.periodStart, scope);
    return now != null && then != null ? now - then : null;
  };
  const tCo2Grid = delta('scope2');
  const tCo2eFuels = delta('scope1');
  const change = {
    inr: changeInr,
    kwh: kwh - lyKwh,
    tCo2: tCo2Grid != null && tCo2eFuels != null ? tCo2Grid + tCo2eFuels : null,
    tCo2Grid,
    tCo2eFuels,
  };

  // Each driver as a Rs/month effect on the bill versus last year.
  const drivers: InsightCard['drivers'] = [];
  const lyP = prod.get(ly.periodStart.getTime()) ?? null;
  if (slope != null && energyRate != null && thisP != null && lyP != null) {
    const dKwh = slope * (thisP - lyP);
    drivers.push({
      code: 'production',
      inr: dKwh * energyRate,
      kwh: dKwh,
      note: `${thisP - lyP} t more output than last year`,
    });
  }
  if (energyRate != null && kvah != null && lyKvah != null) {
    const lossNow = kvah - kwh;
    const lossThen = lyKvah - lyKwh;
    drivers.push({
      code: 'power_factor',
      inr: (lossNow - lossThen) * energyRate,
      kwh: 0,
      note: 'power factor loss in billed kVAh',
    });
  }
  const peakNow = num(em.peakKwh);
  const peakThen = num(ly.peakKwh);
  if (tod && peakNow != null && peakThen != null && lyKwh > 0) {
    const surcharge = param(tod, 'peak_surcharge_inr_per_kwh');
    const shareDelta = peakNow / kwh - peakThen / lyKwh;
    drivers.push({
      code: 'peak_use',
      inr: shareDelta * kwh * surcharge,
      kwh: 0,
      note: 'share of units used in peak hours',
    });
  }
  const dLitres = litres(em) - litres(ly);
  drivers.push({
    code: 'diesel',
    inr: null, // no diesel price in the data: Rs effect stays pending (see OPEN_ITEMS)
    kwh: 0,
    note: `${Math.abs(dLitres)} litres ${dLitres >= 0 ? 'more' : 'less'} diesel`,
  });

  const ranked = drivers
    .filter((d) => d.inr != null)
    .sort((a, b) => Math.abs(b.inr ?? 0) - Math.abs(a.inr ?? 0));
  const top = ranked[0] ?? (dLitres !== 0 ? drivers.find((d) => d.code === 'diesel') : undefined);
  const largestDriver = (top?.code as InsightCard['largestDriver']) ?? null;

  const dir = changeInr >= 0 ? 'higher' : 'lower';
  const parts = [
    `Your bill is Rs ${fmt(Math.abs(changeInr))} ${dir} than the same month last year`,
    `${fmt(Math.abs(change.kwh))} kWh ${change.kwh >= 0 ? 'more' : 'less'}`,
  ];
  const moreLess = (v: number) => (v >= 0 ? 'more' : 'less');
  if (tCo2Grid != null) {
    parts.push(`${fmt(Math.abs(tCo2Grid), 2)} t CO2 ${moreLess(tCo2Grid)} from grid electricity`);
  }
  // Fuel part only when fuel CO2e actually changed.
  if (tCo2eFuels != null && Math.abs(tCo2eFuels) >= 0.005) {
    parts.push(`${fmt(Math.abs(tCo2eFuels), 2)} t CO2e ${moreLess(tCo2eFuels)} from fuels`);
  }
  let sentence = `${parts[0]} (${parts.slice(1).join(', ')}).`;
  if (top) sentence += ` Largest driver: ${DRIVER_TEXT[top.code]} (${top.note}).`;

  return {
    sentence,
    comparedWith: 'same month last year',
    change,
    largestDriver,
    drivers,
    baseline,
  };
}

const DRIVER_TEXT: Record<string, string> = {
  production: 'production change',
  power_factor: 'power factor',
  peak_use: 'peak-hour share',
  diesel: 'diesel',
};

function fmt(n: number, digits = 0): string {
  return new Intl.NumberFormat('en-IN', { maximumFractionDigits: digits }).format(n);
}
