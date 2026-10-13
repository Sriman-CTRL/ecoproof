/**
 * Figures for the SYNTHETIC Oct 2026 sample bill (Demo A live upload), worked out with the same
 * calc functions the API uses, from the bill's answer key. Landing copy reads these instead of
 * hard-coded rupees, so they follow the bill whenever it is re-rendered (`bills:render`).
 */
import { checkContractedDemand, checkPowerFactor, footprint, type Factor } from '@ecoproof/calc';
import bill from '../../../api/prisma/demo/bills/expected.json';
import factorRows from '../../../api/prisma/seed-data/factors.json';

// Rule parameters as seeded in apps/api/prisma/seed-data/tariff_rules.json (TGSPDCL HT-I(A),
// TGERC RST Order FY 2026-27): PF flag (Doc 03), billing demand 80% of CMD (p.282) and the
// flag after 6 months (Doc 03), ToD +1.50 / -0.50 Rs per kVAh (p.269).
const PF_FLAG_BELOW = 0.98;
const MIN_BILLING_PCT_OF_CD = 80;
const FLAG_MONTHS = 6;
const TOD_PEAK_SURCHARGE = 1.5;
const TOD_DAY_REBATE = 0.5;

const billingDemand = Math.max(
  bill.md_kva,
  (MIN_BILLING_PCT_OF_CD / 100) * bill.contracted_demand_kva,
);

// CALC-1 for the sample bill's month with the seeded factor rows valid then (rule 2: the rows,
// not a typed constant). Grid: CEA v22.0 FY 2025-26; diesel: the seeded per-litre row.
interface FactorRow {
  source_type: string;
  value: number;
  unit: string;
  source: string;
  status: string;
  gas_basis: string | null;
  version: string | null;
  page: string | null;
  valid_from: string | null;
  valid_to: string | null;
}
function factorAt(sourceType: string, day: string): FactorRow {
  const row = (factorRows as FactorRow[]).find(
    (f) =>
      f.source_type === sourceType &&
      (f.valid_from == null || f.valid_from <= day) &&
      (f.valid_to == null || f.valid_to >= day),
  );
  if (!row) throw new Error(`sample bill: no ${sourceType} factor for ${day}`);
  return row;
}
const calcFactor = (f: FactorRow): Factor => ({
  id: `${f.source_type}:${f.version ?? '-'}`,
  value: f.value,
  unit: f.unit,
  status: f.status as Factor['status'],
  gasBasis: f.gas_basis as Factor['gasBasis'],
});
const gridRow = factorAt('grid_electricity_india', bill.period_end);
const dieselRow = factorAt('diesel_litre', bill.period_end);
const fp = footprint({
  gridKwh: bill.kwh,
  fuels: [{ quantity: bill.diesel_litres, factor: calcFactor(dieselRow) }],
  outputTonnes: bill.production_tonnes,
  gridFactor: calcFactor(gridRow),
});

const pfLossInr = checkPowerFactor({
  kwh: bill.kwh,
  kvah: bill.kvah,
  energyRatePerKvah: bill.energy_charges / bill.kvah,
  rules: { pfFlagBelow: PF_FLAG_BELOW },
}).lossInrPerMonth;
const demandOverpayInr = checkContractedDemand({
  contractedKva: bill.contracted_demand_kva,
  last12MdKva: Array<number>(12).fill(bill.md_kva),
  demandRatePerKva: bill.demand_charges / billingDemand,
  rules: { minBillingPctOfCd: MIN_BILLING_PCT_OF_CD, flagMonths: FLAG_MONTHS },
}).overpayInrPerMonth;

export const SAMPLE_BILL = {
  /** Bill month, e.g. "2026-10-01". */
  periodStart: bill.period_start,
  kwh: bill.kwh,
  dieselLitres: bill.diesel_litres,
  productionTonnes: bill.production_tonnes,
  /** Rs a month lost to power factor (extra kVAh at the bill's rate). */
  pfLossInr,
  /** Rs a month paid for contracted demand above real maximum demand (MD steady all year). */
  demandOverpayInr,
  /** PF loss + contracted demand overpay: the zero-cost bill fixes, Rs a month. */
  atStakeInr: pfLossInr + demandOverpayInr,
  /** Rs saved per unit moved from peak hours into 10 am-6 pm. */
  peakShiftPerUnitInr: TOD_PEAK_SURCHARGE + TOD_DAY_REBATE,
  /** t CO2 (grid) + t CO2e (fuels) for the sample bill's month. */
  carbon: {
    scope2T: fp.scope2Tonnes,
    scope1T: fp.scope1Tonnes,
    totalT: fp.totalTonnes,
    grid: {
      value: gridRow.value,
      unit: gridRow.unit,
      version: gridRow.version,
      source: gridRow.source,
      page: gridRow.page,
    },
    diesel: { value: dieselRow.value, unit: dieselRow.unit, source: dieselRow.source },
  },
} as const;
