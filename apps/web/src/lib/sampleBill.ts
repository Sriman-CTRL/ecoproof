/**
 * Figures for the SYNTHETIC Oct 2026 sample bill (Demo A live upload), worked out with the same
 * calc functions the API uses, from the bill's answer key. Landing copy reads these instead of
 * hard-coded rupees, so they follow the bill whenever it is re-rendered (`bills:render`).
 */
import { checkContractedDemand, checkPowerFactor } from '@ecoproof/calc';
import bill from '../../../api/prisma/demo/bills/expected.json';

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

export const SAMPLE_BILL = {
  /** Rs a month lost to power factor (extra kVAh at the bill's rate). */
  pfLossInr: checkPowerFactor({
    kwh: bill.kwh,
    kvah: bill.kvah,
    energyRatePerKvah: bill.energy_charges / bill.kvah,
    rules: { pfFlagBelow: PF_FLAG_BELOW },
  }).lossInrPerMonth,
  /** Rs a month paid for contracted demand above real maximum demand (MD steady all year). */
  demandOverpayInr: checkContractedDemand({
    contractedKva: bill.contracted_demand_kva,
    last12MdKva: Array<number>(12).fill(bill.md_kva),
    demandRatePerKva: bill.demand_charges / billingDemand,
    rules: { minBillingPctOfCd: MIN_BILLING_PCT_OF_CD, flagMonths: FLAG_MONTHS },
  }).overpayInrPerMonth,
  /** Rs saved per unit moved from peak hours into 10 am-6 pm. */
  peakShiftPerUnitInr: TOD_PEAK_SURCHARGE + TOD_DAY_REBATE,
} as const;
