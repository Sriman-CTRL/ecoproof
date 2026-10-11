import { assertNonNegative, InvalidInputError } from './errors';
import { FORMULA_VERSION } from './types';

export interface GreenProgressScoreInput {
  /** Intensity reduction vs own baseline, in percent (10 = 10%). */
  intensityReductionPct: number;
  monthsUploadedOnTimeOfLast6: number;
  verifiedActions: number;
  /** Intensity percentile among peers, 0-1; null until 10 peers exist. */
  peerPercentile: number | null;
  kwhPerTonne: number;
  /** Fallback benchmark range in kWh per tonne (BEE induction foundries: 700-2,000). */
  benchmark: { low: number; high: number };
}

export interface GreenProgressScore {
  improvement: number;
  habit: number;
  actions: number;
  peer: number;
  total: number;
  formulaVersion: typeof FORMULA_VERSION;
}

const clip = (x: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, x));

/** Doc 03 "Green Progress Score (0-100)". */
export function greenProgressScore(input: GreenProgressScoreInput): GreenProgressScore {
  const { monthsUploadedOnTimeOfLast6: onTime, peerPercentile, benchmark } = input;
  if (!Number.isFinite(onTime) || onTime < 0 || onTime > 6) {
    throw new InvalidInputError(`monthsUploadedOnTimeOfLast6 must be 0-6, got ${onTime}`);
  }
  assertNonNegative('verifiedActions', input.verifiedActions);
  assertNonNegative('kwhPerTonne', input.kwhPerTonne);
  if (peerPercentile !== null && !(peerPercentile >= 0 && peerPercentile <= 1)) {
    throw new InvalidInputError(`peerPercentile must be 0-1, got ${peerPercentile}`);
  }
  if (!(benchmark.high > benchmark.low)) {
    throw new InvalidInputError(
      `benchmark high must exceed low, got ${benchmark.low}-${benchmark.high}`,
    );
  }

  const improvement = 40 * Math.min(1, Math.max(0, input.intensityReductionPct) / 20);
  const habit = (20 * onTime) / 6;
  const actions = 20 * Math.min(1, input.verifiedActions / 3);
  const peer =
    peerPercentile !== null
      ? 20 * (1 - peerPercentile)
      : clip((20 * (benchmark.high - input.kwhPerTonne)) / (benchmark.high - benchmark.low), 0, 20);

  return {
    improvement,
    habit,
    actions,
    peer,
    total: improvement + habit + actions + peer,
    formulaVersion: FORMULA_VERSION,
  };
}
