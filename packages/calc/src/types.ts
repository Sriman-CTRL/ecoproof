export const FORMULA_VERSION = 'calc-1.0.0';

export type FactorStatus = 'confirmed' | 'confirmed_replace' | 'verify' | 'estimate_only' | 'rule';
export type GasBasis = 'CO2' | 'CO2e';

/** One row of the versioned factor table, passed in by the caller. */
export interface Factor {
  id: string;
  value: number;
  unit: string;
  status: FactorStatus;
  gasBasis: GasBasis | null;
}

export interface CalcOptions {
  /** Allow factors with status "verify"; the result is then marked isEstimate. */
  allowUnverified?: boolean;
}

export interface ResultMeta {
  formulaVersion: typeof FORMULA_VERSION;
  factorIds: string[];
}

/** Input quality tag (Doc 03 "Data quality tags"); mirrors QualityTag in @ecoproof/shared. */
export type QualityTag = 'measured' | 'owner_entered' | 'estimated' | 'default';
