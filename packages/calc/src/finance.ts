import { assertNonNegative, InvalidInputError } from './errors';
import { FORMULA_VERSION, type ResultMeta } from './types';

export interface EmiInput {
  principal: number;
  annualRatePct: number;
  months: number;
}

/** EMI = L r (1+r)^n / ((1+r)^n - 1), r = annual % / 12 / 100; L / n at 0%. */
export function emi({ principal, annualRatePct, months }: EmiInput): number {
  assertNonNegative('principal', principal);
  assertNonNegative('annualRatePct', annualRatePct);
  if (!Number.isInteger(months) || months <= 0) {
    throw new InvalidInputError(`months must be a positive integer, got ${months}`);
  }
  const r = annualRatePct / 12 / 100;
  if (r === 0) return principal / months;
  const growth = (1 + r) ** months;
  return (principal * r * growth) / (growth - 1);
}

export interface CashTestResult extends ResultMeta {
  netMonthly: number;
  cashPositiveFromMonth1: boolean;
}

/** "Cash-positive from month 1" when the low-end monthly saving exceeds the EMI. */
export function cashTest(input: { emi: number; monthlySavingLow: number }): CashTestResult {
  return {
    netMonthly: input.monthlySavingLow - input.emi,
    cashPositiveFromMonth1: input.monthlySavingLow > input.emi,
    formulaVersion: FORMULA_VERSION,
    factorIds: [],
  };
}

/** Simple payback = capex / mid-range annual Rs saving; null when there is no saving. */
export function simplePaybackYears(input: {
  capexInr: number;
  annualSavingInrMid: number;
}): number | null {
  assertNonNegative('capexInr', input.capexInr);
  if (!(input.annualSavingInrMid > 0)) return null;
  return input.capexInr / input.annualSavingInrMid;
}
