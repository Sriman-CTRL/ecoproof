import { assertNonNegative, InvalidInputError } from './errors';
import { FORMULA_VERSION, type ResultMeta } from './types';

export interface ActionSavingInput {
  baselineKwhPerYear: number;
  /** Share (0-1) of energy used by the affected equipment. */
  enduseShare: number;
  /** Saving rate range from the action library, in percent. */
  savingPctLow: number;
  savingPctHigh: number;
}

export interface ActionSavingResult extends ResultMeta {
  kwhLow: number;
  kwhHigh: number;
}

/** Delta E = E_baseline x s_enduse x [r_low, r_high]. */
export function actionSavingRange(input: ActionSavingInput): ActionSavingResult {
  const { baselineKwhPerYear, enduseShare, savingPctLow, savingPctHigh } = input;
  assertNonNegative('baselineKwhPerYear', baselineKwhPerYear);
  assertNonNegative('savingPctLow', savingPctLow);
  if (!(enduseShare >= 0 && enduseShare <= 1)) {
    throw new InvalidInputError(`enduseShare must be within 0-1, got ${enduseShare}`);
  }
  if (!(savingPctHigh >= savingPctLow && savingPctHigh <= 100)) {
    throw new InvalidInputError(`saving range ${savingPctLow}-${savingPctHigh}% is invalid`);
  }
  const base = baselineKwhPerYear * enduseShare;
  return {
    kwhLow: (base * savingPctLow) / 100,
    kwhHigh: (base * savingPctHigh) / 100,
    formulaVersion: FORMULA_VERSION,
    factorIds: [],
  };
}

export interface RankableAction {
  isZeroCost: boolean;
  paybackYears: number | null;
  co2SavedTonnes: number;
}

/** Sorted copy: zero-cost first, then payback ascending (null last), then CO2 saved descending. */
export function rankActions<T extends RankableAction>(actions: readonly T[]): T[] {
  return [...actions].sort((a, b) => {
    if (a.isZeroCost !== b.isZeroCost) return a.isZeroCost ? -1 : 1;
    if (a.paybackYears !== b.paybackYears) {
      if (a.paybackYears === null) return 1;
      if (b.paybackYears === null) return -1;
      return a.paybackYears - b.paybackYears;
    }
    return b.co2SavedTonnes - a.co2SavedTonnes;
  });
}
