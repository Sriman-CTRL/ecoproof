import type { Factor } from './types';

export class UnverifiedFactorError extends Error {
  readonly factorId: string;

  constructor(factor: Factor) {
    super(`Factor ${factor.id} has status "verify"; pass allowUnverified to use it as an estimate`);
    this.name = 'UnverifiedFactorError';
    this.factorId = factor.id;
  }
}

export class InvalidInputError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidInputError';
  }
}

/** Throws unless value is a finite number >= 0. */
export function assertNonNegative(name: string, value: number): void {
  if (!Number.isFinite(value) || value < 0) {
    throw new InvalidInputError(`${name} must be a finite number >= 0, got ${value}`);
  }
}

/**
 * Checks a factor may be used. Returns true when the result must be labelled an estimate
 * ("verify" factors allowed by the caller, or "estimate_only" factors).
 */
export function checkFactor(factor: Factor, allowUnverified = false): boolean {
  assertNonNegative(`factor ${factor.id} value`, factor.value);
  if (factor.status === 'verify') {
    if (!allowUnverified) throw new UnverifiedFactorError(factor);
    return true;
  }
  return factor.status === 'estimate_only';
}
