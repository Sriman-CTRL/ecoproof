import { assertNonNegative, InvalidInputError } from './errors';
import { FORMULA_VERSION, type ResultMeta } from './types';

// Doc 03 "Bill health check logic (Telangana)". Every rate comes from the bill and every
// threshold from the tariff_rules params passed in as `rules`.

const meta = (): ResultMeta => ({ formulaVersion: FORMULA_VERSION, factorIds: [] });

/** Sanity range for a measured power factor; values outside it mean a misread bill. */
const PF_PLAUSIBLE_MIN = 0.5;
const PF_PLAUSIBLE_MAX = 1.0;

export interface PowerFactorInput {
  kwh: number;
  kvah: number;
  energyRatePerKvah: number;
  rules: { pfFlagBelow: number };
}

export interface PowerFactorResult extends ResultMeta {
  pf: number;
  flagged: boolean;
  lossKvah: number;
  lossInrPerMonth: number;
}

/** PF = kWh / kVAh; loss = (kVAh - kWh) x energy rate. */
export function checkPowerFactor(input: PowerFactorInput): PowerFactorResult {
  const { kwh, kvah, energyRatePerKvah, rules } = input;
  assertNonNegative('kwh', kwh);
  assertNonNegative('energyRatePerKvah', energyRatePerKvah);
  if (!(kvah > 0)) throw new InvalidInputError(`kvah must be > 0, got ${kvah}`);
  if (kwh > kvah) throw new InvalidInputError(`kwh (${kwh}) cannot exceed kvah (${kvah})`);
  const pf = kwh / kvah;
  if (pf < PF_PLAUSIBLE_MIN || pf > PF_PLAUSIBLE_MAX) {
    throw new InvalidInputError(
      `power factor ${pf} is outside ${PF_PLAUSIBLE_MIN}-${PF_PLAUSIBLE_MAX}`,
    );
  }
  const lossKvah = kvah - kwh;
  return {
    pf,
    flagged: pf < rules.pfFlagBelow,
    lossKvah,
    lossInrPerMonth: lossKvah * energyRatePerKvah,
    ...meta(),
  };
}

export interface PeakUseInput {
  totalKwh: number;
  peakKwh: number;
  /** Owner's estimate of peak kWh that could move to other hours. */
  shiftableKwh?: number | null;
  rules: { peakSurchargePerKwh: number; solarRebatePerKwh: number; flagAbovePct: number };
}

export interface PeakUseResult extends ResultMeta {
  peakSharePct: number;
  flagged: boolean;
  savingInrPerMonth: number | null;
}

/** Shift saving = shiftable peak kWh x (peak surcharge + solar-hours rebate). */
export function checkPeakUse(input: PeakUseInput): PeakUseResult {
  const { totalKwh, peakKwh, shiftableKwh, rules } = input;
  assertNonNegative('peakKwh', peakKwh);
  if (!(totalKwh > 0)) throw new InvalidInputError(`totalKwh must be > 0, got ${totalKwh}`);
  if (peakKwh > totalKwh) throw new InvalidInputError('peakKwh cannot exceed totalKwh');
  if (shiftableKwh != null) {
    assertNonNegative('shiftableKwh', shiftableKwh);
    if (shiftableKwh > peakKwh) throw new InvalidInputError('shiftableKwh cannot exceed peakKwh');
  }
  const peakSharePct = (peakKwh / totalKwh) * 100;
  return {
    peakSharePct,
    flagged: peakSharePct > rules.flagAbovePct,
    savingInrPerMonth:
      shiftableKwh == null
        ? null
        : shiftableKwh * (rules.peakSurchargePerKwh + rules.solarRebatePerKwh),
    ...meta(),
  };
}

export interface ContractedDemandInput {
  contractedKva: number;
  last12MdKva: number[];
  demandRatePerKva: number;
  rules: { minBillingPctOfCd: number; flagMonths: number };
}

export interface ContractedDemandResult extends ResultMeta {
  maxMd: number;
  monthsBelow: number;
  flagged: boolean;
  overpayInrPerMonth: number;
}

/** Overpay = (min billing % x CD - max MD) x demand rate, floored at 0. */
export function checkContractedDemand(input: ContractedDemandInput): ContractedDemandResult {
  const { contractedKva, last12MdKva, demandRatePerKva, rules } = input;
  assertNonNegative('contractedKva', contractedKva);
  assertNonNegative('demandRatePerKva', demandRatePerKva);
  if (last12MdKva.length === 0) throw new InvalidInputError('last12MdKva is empty');
  last12MdKva.forEach((md, i) => assertNonNegative(`last12MdKva[${i}]`, md));

  const minBillingKva = (rules.minBillingPctOfCd / 100) * contractedKva;
  const maxMd = Math.max(...last12MdKva);
  const monthsBelow = last12MdKva.filter((md) => md < minBillingKva).length;
  return {
    maxMd,
    monthsBelow,
    flagged: monthsBelow >= rules.flagMonths,
    overpayInrPerMonth: Math.max(0, (minBillingKva - maxMd) * demandRatePerKva),
    ...meta(),
  };
}

export const MINIMUM_CHARGE_ASSUMPTION =
  "shortfall valued at the bill's energy rate (Doc 03 gives no Rs conversion; see OPEN_ITEMS)";

export interface MinimumChargesInput {
  billingDemandKva: number;
  actualKvah: number;
  energyRatePerKvah: number;
  rules: { kvahPerKvaPerMonth: number };
}

export interface MinimumChargesResult extends ResultMeta {
  minimumKvah: number;
  gapKvah: number;
  flagged: boolean;
  gapInrPerMonth: number;
  assumption: string;
}

/** Gap = kVAh-per-kVA minimum x billing demand - actual kVAh, floored at 0. */
export function checkMinimumCharges(input: MinimumChargesInput): MinimumChargesResult {
  const { billingDemandKva, actualKvah, energyRatePerKvah, rules } = input;
  assertNonNegative('billingDemandKva', billingDemandKva);
  assertNonNegative('actualKvah', actualKvah);
  assertNonNegative('energyRatePerKvah', energyRatePerKvah);
  const minimumKvah = rules.kvahPerKvaPerMonth * billingDemandKva;
  const gapKvah = Math.max(0, minimumKvah - actualKvah);
  return {
    minimumKvah,
    gapKvah,
    flagged: actualKvah < minimumKvah,
    gapInrPerMonth: gapKvah * energyRatePerKvah,
    assumption: MINIMUM_CHARGE_ASSUMPTION,
    ...meta(),
  };
}

export interface LtSurchargesInput {
  lineItems: Record<string, number>;
  rules: { readLineItems: string[] };
}

export interface LtSurchargesResult extends ResultMeta {
  flagged: boolean;
  items: { name: string; inr: number }[];
}

/** Flags any listed LT surcharge line item with a non-zero amount. */
export function checkLtSurcharges(input: LtSurchargesInput): LtSurchargesResult {
  const items = input.rules.readLineItems.flatMap((name) => {
    const inr = input.lineItems[name];
    return inr !== undefined && inr !== 0 ? [{ name, inr }] : [];
  });
  return { flagged: items.length > 0, items, ...meta() };
}
