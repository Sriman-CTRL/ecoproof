import { assertNonNegative, InvalidInputError } from './errors';
import { FORMULA_VERSION, type ResultMeta } from './types';

export interface CbamPrecursor {
  tonnes: number;
  /** Specific embedded emissions, t CO2e per t of precursor. */
  see: number;
  /** True when SEE is a regulatory default rather than supplier data. */
  isDefault: boolean;
}

export interface CbamEstimateInput {
  scope1AttributedTonnes: number;
  precursors: CbamPrecursor[];
  scope2Tonnes: number;
  outputTonnes: number;
}

export interface CbamEstimateResult extends ResultMeta {
  /** t CO2e per t of good: (S1 + sum T*SEE) / P. */
  seeDirect: number;
  /** S2 / P, shown for information only. */
  seeIndirectInfo: number;
  /** Share of direct embedded emissions resting on default precursor SEEs. */
  defaultSharePct: number;
  label: 'Estimate, not verified';
  isEstimate: true;
}

/** Doc 03 "CBAM estimate for an iron or steel good". */
export function cbamEstimate(input: CbamEstimateInput): CbamEstimateResult {
  const { scope1AttributedTonnes: s1, precursors, scope2Tonnes: s2, outputTonnes: p } = input;
  assertNonNegative('scope1AttributedTonnes', s1);
  assertNonNegative('scope2Tonnes', s2);
  if (!Number.isFinite(p) || p <= 0)
    throw new InvalidInputError(`outputTonnes must be > 0, got ${p}`);

  let precursorTotal = 0;
  let defaultTotal = 0;
  for (const [i, pre] of precursors.entries()) {
    assertNonNegative(`precursor ${i} tonnes`, pre.tonnes);
    assertNonNegative(`precursor ${i} see`, pre.see);
    const emissions = pre.tonnes * pre.see;
    precursorTotal += emissions;
    if (pre.isDefault) defaultTotal += emissions;
  }
  const direct = s1 + precursorTotal;

  return {
    seeDirect: direct / p,
    seeIndirectInfo: s2 / p,
    defaultSharePct: direct > 0 ? (100 * defaultTotal) / direct : 0,
    label: 'Estimate, not verified',
    isEstimate: true,
    formulaVersion: FORMULA_VERSION,
    factorIds: [],
  };
}
