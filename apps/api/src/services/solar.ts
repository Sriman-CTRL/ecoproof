import {
  domesticBill,
  netBilledUnits,
  pmSuryaGharCfa,
  rooftopBenchmarkCost,
  solarPlanSize,
} from '@ecoproof/calc';
import type { EnergyMonth, Site } from '@prisma/client';
import { prisma } from '../db.js';
import { notFound } from '../errors.js';
import { factorFor } from '../jobs/calculate.js';
import { billParts, FSA_DUTY_NOTE, loadDomesticTariff } from './domesticTariff.js';

const n = (d: { toString(): string } | null | undefined) => (d == null ? null : Number(d));
const r2 = (x: number) => Math.round(x * 100) / 100;
const iso = (d: Date) => d.toISOString().slice(0, 10);

/** Sourced rooftop solar defaults (research R5, docs/research/findings-all.md). */
export const SOLAR_DEFAULTS = {
  yieldKwhPerKwpYr: {
    value: 1462.9,
    source:
      'NREL PVWatts v8 (now at developer.nlr.gov), Hyderabad 17.385, 78.4867; 1 kWdc fixed roof mount, tilt 20°, azimuth 180°, losses 14%',
    url: 'https://developer.nlr.gov/api/pvwatts/v8.json?api_key=DEMO_KEY&lat=17.385&lon=78.4867&system_capacity=1&module_type=0&losses=14&azimuth=180&array_type=1&tilt=20',
    page: null,
    quotedLine: '"ac_annual": 1462.883772674314',
    date: 'queried 12 Oct 2026',
  },
  areaPerKwp: {
    value: 10,
    source: 'MNRE FAQ: Grid Connected Solar Rooftop System',
    url: 'https://jbvnl.co.in/SOLAR/MNRE FAQ for consumer.pdf',
    page: 'p.3, §1.3',
    quotedLine: 'A 1 kW rooftop system generally requires 10 sq. metres of shadow-free area.',
    date: null,
  },
  areaPerKwpConservative: {
    value: 12,
    source: 'SECI Frequently Asked Questions',
    url: 'https://www.seci.co.in/upload/static/files/FAQ(1).pdf',
    page: 'Section A, Q1',
    quotedLine:
      'A 1 kW rooftop system generally requires 12 sq. metres (130 square feet) of flat, shadow-free area (preferably south-facing).',
    date: null,
  },
  domesticCap: {
    /** Share of sanctioned load. */
    value: 1,
    maxKwp: 500,
    source:
      'TGERC (Rooftop Solar PV Grid Interactive Systems) Regulation, 2025 (Regulation No. 1 of 2025)',
    url: 'https://tgerc.telangana.gov.in/file_upload/uploads/Regulations/Final/tserc/2025/Final%20Solar%20Roof%20top%20Regulation%201%20of%202025%2015112025.pdf',
    page: 'p.8 cl.4.9; 500 kWp: p.7 cl.4.2',
    quotedLine:
      "For residential and Government Consumers: upto a maximum of 100% of consumer's sanctioned load.",
    date: '15.11.2025',
  },
  settlement: {
    source: 'TGERC Regulation No. 1 of 2025',
    url: 'https://tgerc.telangana.gov.in/file_upload/uploads/Regulations/Final/tserc/2025/Final%20Solar%20Roof%20top%20Regulation%201%20of%202025%2015112025.pdf',
    page: 'p.17 cl.8.1.3(a)',
    quotedLine:
      'the excess quantum of electricity units shall be settled at the rate equal to that of lowest tariff rate as per solar PPAs/PSAs/PUAs entered by TGDiscoms under Section 63 of the Electricity Act, in the preceding Financial Year.',
    date: '15.11.2025',
  },
  cfa: {
    source:
      "PM Surya Ghar Scheme Guidelines 'CFA to Residential Consumers' (MNRE OM F.No.318/140/2024-GCRT, 31 Aug 2026)",
    url: 'https://pmsuryaghar.gov.in/',
    page: 'p.3 §2(d), §3(b)',
    quotedLine:
      'Residential Sector (first 2 kWp of RTS capacity or part thereof) Rs 30,000/kWp; Residential Sector (with additional RTS capacity of 1 kWp or part thereof) Rs 18,000/kWp; For residential maximum subsidy of Rs. 78000/-',
    date: '31 Aug 2026',
  },
  benchmarkCost: {
    source: 'PM Surya Ghar CFA Guidelines (MNRE benchmark used to set the subsidy)',
    url: 'https://pmsuryaghar.gov.in/',
    page: 'p.6 §5(g)',
    quotedLine:
      'The benchmark cost for 1 kW system is fixed at ₹ 50,000/kW for the first 2 kW of RTS capacity and ₹ 45,000 for the additional kW with effect from 13th February, 2024.',
    date: '13 Feb 2024',
  },
} as const;

export const SOLAR_CONDITIONS = [
  'DCR modules and a registered vendor are required',
  'Apply on pmsuryaghar.gov.in',
  'Scheme open till 31 March 2027',
];

export const RATE_NOTE =
  'Uses TGSPDCL LT-I slabs (FY 2026-27); your slab drops when net units fall. Excess export credit not counted.';

/** Solar screens exist only for households: PM Surya Ghar is residential only (R5 legal check 6). */
async function requireHousehold(site: Site) {
  const org = await prisma.organisation.findFirst({
    where: { id: site.orgId },
    select: { type: true },
  });
  if (org?.type !== 'household') throw notFound('Solar plan');
}

/** Units the DISCOM bills after netting import and export within the month (TGERC cl. 8.1.3). */
const billedKwh = (m: EnergyMonth) => netBilledUnits(n(m.kwh) ?? 0, n(m.exportKwh));

/**
 * Average Rs per kWh from the household's own bills: energy charges / billed units. Null when any
 * bill has no rupees.
 */
function averageRate(months: EnergyMonth[]): number | null {
  if (!months.length || months.some((m) => m.energyCharges == null)) return null;
  const kwh = months.reduce((t, m) => t + billedKwh(m), 0);
  const inr = months.reduce((t, m) => t + Number(m.energyCharges), 0);
  return kwh > 0 ? inr / kwh : null;
}

export async function computeSolarPlan(site: Site) {
  await requireHousehold(site);
  const months = await prisma.energyMonth.findMany({
    where: { orgId: site.orgId, siteId: site.id, solarInstalledKwp: null },
    orderBy: { periodStart: 'desc' },
    take: 12,
  });
  const latest = months[0];
  if (!latest) throw notFound('Bills');
  // E: all units on the bills (TGERC nets within the month and pays surplus only at the lowest
  // solar PPA rate, so size to the year's use, not more). Fewer than 12 bills scale to a year.
  const annualKwh = (months.reduce((t, m) => t + (n(m.kwh) ?? 0), 0) * 12) / months.length;
  const sanctioned = n(site.sanctionedLoadKw);
  const roof = n(site.roofAreaM2);
  if (sanctioned == null || roof == null) {
    return {
      missing: [
        sanctioned == null ? 'sanctionedLoadKw' : null,
        roof == null ? 'roofAreaM2' : null,
      ].filter(Boolean),
    };
  }
  const d = SOLAR_DEFAULTS;
  const capKw = Math.min(sanctioned * d.domesticCap.value, d.domesticCap.maxKwp);
  const size = (areaPerKwp: number) =>
    solarPlanSize({
      roofAreaM2: roof,
      areaPerKwp,
      annualKwh,
      yieldKwhPerKwpYr: d.yieldKwhPerKwpYr.value,
      capKw,
    });
  const plan = size(d.areaPerKwp.value);
  const conservative = size(d.areaPerKwpConservative.value);

  const rate = averageRate(months);
  // Saving: for each before-solar month, the bill at its units less the bill at its units minus an
  // even share of the year's generation (even monthly generation is a simplification, OPEN_ITEMS).
  const { tariff, sources: tariffSources } = await loadDomesticTariff();
  const genPerMonth = plan.annualGenKwh / 12;
  const bill = (units: number) =>
    domesticBill({ units, sanctionedLoadKw: sanctioned, tariff }).totalInr;
  const savingSum = months.reduce(
    (t, m) => t + bill(billedKwh(m)) - bill(Math.max(billedKwh(m) - genPerMonth, 0)),
    0,
  );
  const benchmarkCostInr = rooftopBenchmarkCost(plan.kwp);
  const cfaInr = pmSuryaGharCfa(plan.kwp);
  const netCostInr = benchmarkCostInr - cfaInr;
  const monthlySavingInr = plan.kwp > 0 ? r2(savingSum / months.length) : null;
  const grid = await factorFor('grid_electricity_india', latest.periodEnd);

  return {
    kwp: plan.kwp,
    limitedBy: plan.limitedBy,
    belowMinimum: plan.belowMinimum,
    annualGenKwh: r2(plan.annualGenKwh),
    inputs: {
      annualKwh,
      billMonths: months.length,
      roofAreaM2: roof,
      areaPerKwp: d.areaPerKwp.value,
      yieldKwhPerKwpYr: d.yieldKwhPerKwpYr.value,
      capKw,
      sanctionedLoadKw: sanctioned,
    },
    conservative: { areaPerKwp: d.areaPerKwpConservative.value, kwp: conservative.kwp },
    rateInrPerKwh: rate == null ? null : r2(rate),
    rateNote: RATE_NOTE,
    fsaDutyNote: FSA_DUTY_NOTE,
    monthlySavingInr,
    benchmarkCostInr,
    benchmarkNote: 'MNRE benchmark used to set the subsidy; real quotes vary.',
    cfaInr,
    netCostInr,
    paybackYears:
      monthlySavingInr == null || monthlySavingInr <= 0
        ? null
        : r2(netCostInr / (monthlySavingInr * 12)),
    co2AvoidedT: Math.round(plan.annualGenKwh * Number(grid.value)) / 1000, // kWh x t/MWh
    co2Label: 't CO2 (grid)',
    factorIds: [grid.id],
    formulaVersion: plan.formulaVersion,
    conditions: SOLAR_CONDITIONS,
    portalUrl: 'https://pmsuryaghar.gov.in/',
    sources: [
      {
        key: 'yield',
        value: d.yieldKwhPerKwpYr.value,
        unit: 'kWh/kWp/yr',
        ...omitValue(d.yieldKwhPerKwpYr),
      },
      { key: 'area', value: d.areaPerKwp.value, unit: 'm2/kWp', ...omitValue(d.areaPerKwp) },
      {
        key: 'areaConservative',
        value: d.areaPerKwpConservative.value,
        unit: 'm2/kWp',
        ...omitValue(d.areaPerKwpConservative),
      },
      {
        key: 'cap',
        value: 100,
        unit: '% of the load limit on your bill',
        ...omitValue(d.domesticCap),
      },
      { key: 'settlement', value: null, unit: null, ...d.settlement },
      { key: 'cfa', value: 78000, unit: 'Rs max', ...d.cfa },
      { key: 'benchmark', value: null, unit: null, ...d.benchmarkCost },
      ...tariffSources.map((t) => ({
        key: t.ruleType,
        value: null,
        unit: null,
        source: t.source,
        url: t.url,
        page: t.page,
        quotedLine: t.quotedLine,
        date: 'valid 2026-04-01 to 2027-03-31',
      })),
      {
        key: 'grid',
        value: Number(grid.value),
        unit: grid.unit,
        source: grid.source,
        url: grid.sourceUrl,
        page: grid.page,
        quotedLine: grid.quotedLine,
        date: grid.version,
      },
    ],
  };
}

function omitValue<T extends { value: unknown }>(o: T): Omit<T, 'value' | 'maxKwp'> {
  const out: Record<string, unknown> = { ...o };
  delete out.value;
  delete out.maxKwp;
  return out as Omit<T, 'value' | 'maxKwp'>;
}

export async function computeSolarResults(site: Site) {
  await requireHousehold(site);
  const where = { orgId: site.orgId, siteId: site.id };
  const [months, results, ledger] = await Promise.all([
    prisma.energyMonth.findMany({ where, orderBy: { periodStart: 'asc' } }),
    prisma.result.findMany({ where }),
    prisma.savingsLedger.findMany({ where }),
  ]);
  const after = months.filter((m) => m.solarInstalledKwp != null);
  const byStart = new Map(months.map((m) => [iso(m.periodStart), m]));
  const scope2 = new Map(results.map((r) => [iso(r.month), n(r.scope2)]));

  const rows = after.map((m) => {
    const lastYearStart = new Date(m.periodStart);
    lastYearStart.setUTCFullYear(lastYearStart.getUTCFullYear() - 1);
    const ly = byStart.get(iso(lastYearStart)) ?? null;
    const importKwh = n(m.kwh) ?? 0;
    const exportKwh = n(m.exportKwh) ?? 0;
    // Full monthly bill (energy + fixed + customer charge), before FSA and electricity duty.
    const billInr = billParts(m.otherChargesJson)?.totalInr ?? null;
    const lastYearBillInr = ly ? (billParts(ly.otherChargesJson)?.totalInr ?? null) : null;
    return {
      month: iso(m.periodStart),
      importKwh,
      exportKwh,
      netKwh: importKwh - exportKwh,
      billedKwh: billedKwh(m),
      lastYearKwh: ly ? n(ly.kwh) : null,
      savedKwh: ly ? (n(ly.kwh) ?? 0) - billedKwh(m) : null,
      billInr,
      lastYearBillInr,
      savedInr: billInr == null || lastYearBillInr == null ? null : r2(lastYearBillInr - billInr),
      gridTco2: scope2.get(iso(m.periodStart)) ?? null,
    };
  });
  const sum = (f: (r: (typeof rows)[number]) => number | null) =>
    rows.some((r) => f(r) == null) ? null : r2(rows.reduce((t, r) => t + f(r)!, 0));
  // S8a status rule: "Verified by your bills" only when every ledger month passed the baseline
  // test. A home has no production driver for that test yet, so this stays "too early".
  const status =
    ledger.length > 0 && ledger.every((l) => l.status === 'verified') ? 'verified' : 'too_early';

  return {
    installedKwp: after.length ? n(after[0]!.solarInstalledKwp) : null,
    installedFrom: after.length ? iso(after[0]!.periodStart) : null,
    months: rows,
    totals: {
      importKwh: sum((r) => r.importKwh),
      exportKwh: sum((r) => r.exportKwh),
      netKwh: sum((r) => r.netKwh),
      savedKwh: sum((r) => r.savedKwh),
      billInr: sum((r) => r.billInr),
      savedInr: sum((r) => r.savedInr),
      gridTco2: sum((r) => r.gridTco2),
    },
    status,
    fsaDutyNote: FSA_DUTY_NOTE,
    co2Label: 't CO2 (grid)',
    surplusNote:
      'Units exported beyond what you import in a month are paid at the lowest solar PPA rate (TGERC); that credit is not counted here.',
  };
}
