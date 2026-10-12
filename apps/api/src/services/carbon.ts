import type { Site } from '@prisma/client';
import { prisma } from '../db.js';
import { notFound } from '../errors.js';
import { listActions } from './actions.js';
import { computeSavings } from './savings.js';
import { computeSolarPlan } from './solar.js';

// Carbon read model (D6a): everything comes from stored results rows and the factor rows they
// name, plus the action plan's kWh savings. Nothing is recomputed from a constant.

const GRID = 'grid_electricity_india';
const DIESEL = 'diesel_litre';

export interface CarbonMonth {
  month: string;
  scope2T: number;
  scope1T: number;
  totalT: number;
  intensity: number | null;
}

export interface Carbon {
  household: boolean;
  latestMonth: CarbonMonth & {
    intensityTPerTonne: number | null;
    kwh: number | null;
    outputTonnes: number | null;
    factor: {
      id: string;
      value: number;
      unit: string;
      version: string | null;
      source: string;
      page: string | null;
    } | null;
  };
  /** Up to 12 months, oldest first. */
  months: CarbonMonth[];
  bySource: Array<{ source: 'grid_electricity' | 'diesel'; t: number; pct: number }>;
  reducible: Array<{
    actionCode: string;
    title: string;
    tPerYearLow: number;
    tPerYearHigh: number;
  }>;
  chargeOnly: Array<{ actionCode: string; title: string; annualInr: number | null }>;
  /** Demo B: CO2 avoided from the savings ledger; verifiedTco2 counts "verified" months only. */
  savedSoFar: { tco2: number; months: number; verifiedTco2: number } | null;
  /** Households: what the sized rooftop plan would avoid a year (grid factor). */
  solar: { kwp: number; tPerYear: number } | null;
  method: { lines: string[] };
  label: string;
  factorIds: string[];
  formulaVersion: string;
}

const num = (d: { toString(): string } | null | undefined) => (d == null ? null : Number(d));
const r3 = (x: number) => Math.round(x * 1000) / 1000;
const int = new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 });
const dec2 = new Intl.NumberFormat('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const dec3 = new Intl.NumberFormat('en-IN', { maximumFractionDigits: 3 });

export async function computeCarbon(site: Site): Promise<Carbon> {
  const where = { orgId: site.orgId, siteId: site.id };
  const [org, results] = await Promise.all([
    prisma.organisation.findFirst({ where: { id: site.orgId }, select: { type: true } }),
    prisma.result.findMany({ where, orderBy: { month: 'desc' }, take: 12 }),
  ]);
  const latest = results[0];
  if (!latest) throw notFound('Results');
  const household = org?.type === 'household';

  const [energy, production, factors, fuels] = await Promise.all([
    prisma.energyMonth.findFirst({ where: { ...where, periodStart: latest.month } }),
    prisma.productionMonth.findFirst({ where: { ...where, month: latest.month } }),
    prisma.factor.findMany({ where: { id: { in: latest.factorIds } } }),
    prisma.fuelEntry.findMany({ where: { ...where, id: { in: latest.inputIds } } }),
  ]);
  const grid = factors.find((f) => f.sourceType === GRID) ?? null;
  const diesel = factors.find((f) => f.sourceType === DIESEL) ?? null;

  const row = (r: (typeof results)[number]): CarbonMonth => {
    const scope2T = num(r.scope2) ?? 0;
    const scope1T = household ? 0 : (num(r.scope1) ?? 0);
    return {
      month: r.month.toISOString().slice(0, 10),
      scope2T,
      scope1T,
      totalT: r3(scope2T + scope1T),
      intensity: household ? null : num(r.intensity),
    };
  };
  const head = row(latest);
  const kwh = num(energy?.kwh);

  // Method lines from the same inputs the result was calculated from.
  const lines: string[] = [];
  if (grid && kwh != null) {
    lines.push(
      `${int.format(kwh)} kWh x ${dec3.format(Number(grid.value))} t CO2/MWh / 1000 = ${dec2.format(head.scope2T)} t CO2 (grid)`,
    );
  }
  const litres = fuels
    .filter((f) => f.fuelType === 'diesel')
    .reduce((t, f) => t + Number(f.quantity), 0);
  if (!household && diesel && litres > 0) {
    lines.push(
      `${int.format(litres)} L diesel x ${dec3.format(Number(diesel.value))} kg CO2e/L / 1000 = ${dec2.format(head.scope1T)} t CO2e (fuels)`,
    );
  }
  const outputTonnes = num(production?.quantity);
  if (head.intensity != null && outputTonnes) {
    lines.push(
      `${dec2.format(head.totalT)} t / ${int.format(outputTonnes)} t of output = ${dec2.format(head.intensity)} t per tonne`,
    );
  }

  const total = head.scope2T + head.scope1T;
  const pct = (t: number) => (total > 0 ? Math.round((t / total) * 1000) / 10 : 0);
  const bySource: Carbon['bySource'] = [
    { source: 'grid_electricity' as const, t: head.scope2T, pct: pct(head.scope2T) },
    ...(head.scope1T > 0
      ? [{ source: 'diesel' as const, t: head.scope1T, pct: pct(head.scope1T) }]
      : []),
  ];

  let reducible: Carbon['reducible'] = [];
  let chargeOnly: Carbon['chargeOnly'] = [];
  let savedSoFar: Carbon['savedSoFar'] = null;
  let solar: Carbon['solar'] = null;
  if (household) {
    const plan = await computeSolarPlan(site).catch(() => null);
    if (plan?.kwp != null && plan.kwp > 0 && plan.co2AvoidedT != null) {
      solar = { kwp: plan.kwp, tPerYear: plan.co2AvoidedT };
    }
  } else {
    const [{ actions }, savings] = await Promise.all([
      listActions(site, latest.month, null),
      computeSavings(site),
    ]);
    reducible = actions.flatMap((a) =>
      a.co2 && a.co2.tPerYearHigh > 0
        ? [
            {
              actionCode: a.code,
              title: a.title,
              tPerYearLow: r3(a.co2.tPerYearLow),
              tPerYearHigh: r3(a.co2.tPerYearHigh),
            },
          ]
        : [],
    );
    chargeOnly = actions
      .filter((a) => a.co2Note === 'bill_charge_only')
      .map((a) => ({
        actionCode: a.code,
        title: a.title,
        annualInr: a.annualInrMid == null ? null : Math.round(a.annualInrMid),
      }));
    if (savings.months.length > 0) {
      savedSoFar = {
        tco2: savings.totals.savedTco2,
        months: savings.months.length,
        verifiedTco2: r3(
          savings.months.reduce((t, m) => t + (m.status === 'verified' ? m.savedTco2 : 0), 0),
        ),
      };
    }
  }

  return {
    household,
    latestMonth: {
      ...head,
      intensityTPerTonne: head.intensity,
      kwh,
      outputTonnes,
      factor: grid
        ? {
            id: grid.id,
            value: Number(grid.value),
            unit: grid.unit,
            version: grid.version,
            source: grid.source,
            page: grid.page,
          }
        : null,
    },
    months: results.map(row).reverse(),
    bySource,
    reducible,
    chargeOnly,
    savedSoFar,
    solar,
    method: { lines },
    label: household ? 't CO2 (grid)' : 't CO2 (grid) + t CO2e (fuels)',
    factorIds: latest.factorIds,
    formulaVersion: latest.formulaVersion,
  };
}
