import { adjustedBaseline, type Baseline } from './baseline';
import { assertNonNegative, checkFactor } from './errors';
import { FORMULA_VERSION, type CalcOptions, type Factor, type ResultMeta } from './types';

export interface FuelSaved {
  /** Activity quantity saved (e.g. litres); factor is kg CO2 per unit. */
  quantity: number;
  factor: Factor;
}

export interface MonthlySavingsInput extends CalcOptions {
  baseline: Pick<Baseline, 'a' | 'b'>;
  productionTonnes: number;
  actualKwh: number;
  /**
   * Non-routine adjustment (Doc 03 step 4, "± NRA"). Convention: nraKwh is the owner-declared
   * extra energy a non-routine change adds to the month (positive = new machine or shift,
   * negative = equipment removed). It raises the adjusted baseline: adjusted = Ehat + nraKwh.
   */
  nraKwh?: number;
  /** Energy charges / kWh on that bill (fixed and demand charges excluded), passed in. */
  effectiveRatePerKwh: number;
  /** Grid factor in t CO2 per MWh (= kg per kWh). */
  gridFactor: Factor;
  fuelSaved?: FuelSaved[];
}

export interface MonthlySavingsResult extends ResultMeta {
  adjustedBaselineKwh: number;
  savedKwh: number;
  inrSaved: number;
  co2SavedTonnes: number;
  isEstimate: boolean;
}

/** Doc 03 steps 3-5: savedKwh = (Ehat + NRA) - actual, then Rs and CO2. */
export function monthlySavings(input: MonthlySavingsInput): MonthlySavingsResult {
  const { nraKwh = 0, fuelSaved = [], allowUnverified } = input;
  assertNonNegative('actualKwh', input.actualKwh);
  assertNonNegative('effectiveRatePerKwh', input.effectiveRatePerKwh);

  let isEstimate = checkFactor(input.gridFactor, allowUnverified);
  const factorIds = [input.gridFactor.id];
  let fuelKgCo2 = 0;
  for (const fuel of fuelSaved) {
    if (checkFactor(fuel.factor, allowUnverified)) isEstimate = true;
    fuelKgCo2 += fuel.quantity * fuel.factor.value;
    if (!factorIds.includes(fuel.factor.id)) factorIds.push(fuel.factor.id);
  }

  const adjustedBaselineKwh = adjustedBaseline(input.baseline, input.productionTonnes) + nraKwh;
  const savedKwh = adjustedBaselineKwh - input.actualKwh;

  return {
    adjustedBaselineKwh,
    savedKwh,
    inrSaved: savedKwh * input.effectiveRatePerKwh,
    co2SavedTonnes: (savedKwh / 1000) * input.gridFactor.value + fuelKgCo2 / 1000,
    isEstimate,
    formulaVersion: FORMULA_VERSION,
    factorIds,
  };
}

export type SavingsStatus = 'verified' | 'too_early_to_confirm' | 'indicative';

/**
 * Doc 03 step 6. "Verified" when cumulative savings exceed twice the standard error of the
 * cumulative saving, taken as s * sqrt(reportingMonths) (see docs/OPEN_ITEMS.md).
 */
export function savingsStatus(input: {
  baseline: Pick<Baseline, 'method' | 's'>;
  cumulativeSavedKwh: number;
  reportingMonths: number;
}): SavingsStatus {
  const { baseline, cumulativeSavedKwh, reportingMonths } = input;
  if (baseline.method !== 'regression' || baseline.s === null) return 'indicative';
  assertNonNegative('reportingMonths', reportingMonths);
  return cumulativeSavedKwh > 2 * baseline.s * Math.sqrt(reportingMonths)
    ? 'verified'
    : 'too_early_to_confirm';
}
