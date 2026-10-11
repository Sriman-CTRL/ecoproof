import { assertNonNegative, InvalidInputError } from './errors';
import { FORMULA_VERSION } from './types';

export interface BaselineRules {
  minMonthsForRegression: number;
  maxCvRmsePct: number;
  maxAbsNmbePct: number;
}

export interface BaselineMonth {
  productionTonnes: number;
  kwh: number;
}

export type BaselineMethod = 'regression' | 'indicative' | 'intensity';

export interface Baseline {
  a: number;
  b: number;
  n: number;
  /** Standard error of the regression, sqrt(SSE / (n - p)); null for intensity. */
  s: number | null;
  cvRmsePct: number | null;
  nmbePct: number | null;
  method: BaselineMethod;
  formulaVersion: typeof FORMULA_VERSION;
}

const PARAMS = 2;

/**
 * Doc 03 "Baseline and verified savings", steps 1-2. OLS fit E = a + b*P, accepted as
 * "regression" only within the ASHRAE Guideline 14 limits; otherwise "indicative".
 * With fewer than minMonthsForRegression months, falls back to intensity (a = 0, b = sumE/sumP).
 */
export function fitBaseline(input: { months: BaselineMonth[]; rules: BaselineRules }): Baseline {
  const { months, rules } = input;
  const n = months.length;
  if (n < 2) throw new InvalidInputError(`baseline needs at least 2 months, got ${n}`);
  for (const [i, m] of months.entries()) {
    if (!Number.isFinite(m.productionTonnes) || m.productionTonnes <= 0) {
      throw new InvalidInputError(
        `month ${i} productionTonnes must be > 0, got ${m.productionTonnes}`,
      );
    }
    assertNonNegative(`month ${i} kwh`, m.kwh);
  }

  const sumP = months.reduce((t, m) => t + m.productionTonnes, 0);
  const sumE = months.reduce((t, m) => t + m.kwh, 0);

  if (n < rules.minMonthsForRegression) {
    return {
      a: 0,
      b: sumE / sumP,
      n,
      s: null,
      cvRmsePct: null,
      nmbePct: null,
      method: 'intensity',
      formulaVersion: FORMULA_VERSION,
    };
  }

  const meanP = sumP / n;
  const meanE = sumE / n;
  let sxy = 0;
  let sxx = 0;
  for (const m of months) {
    sxy += (m.productionTonnes - meanP) * (m.kwh - meanE);
    sxx += (m.productionTonnes - meanP) ** 2;
  }
  if (sxx === 0) throw new InvalidInputError('production is identical in every month; cannot fit');
  const b = sxy / sxx;
  const a = meanE - b * meanP;

  let sse = 0;
  let sumResidual = 0;
  for (const m of months) {
    const residual = m.kwh - (a + b * m.productionTonnes);
    sse += residual ** 2;
    sumResidual += residual;
  }
  const s = Math.sqrt(sse / (n - PARAMS));
  const cvRmsePct = (100 * s) / meanE;
  const nmbePct = (100 * sumResidual) / ((n - PARAMS) * meanE);
  const fits = cvRmsePct <= rules.maxCvRmsePct && Math.abs(nmbePct) <= rules.maxAbsNmbePct;

  return {
    a,
    b,
    n,
    s,
    cvRmsePct,
    nmbePct,
    method: fits ? 'regression' : 'indicative',
    formulaVersion: FORMULA_VERSION,
  };
}

/** Doc 03 step 3: Ehat = a + b * P for a reporting month. */
export function adjustedBaseline(
  baseline: Pick<Baseline, 'a' | 'b'>,
  productionTonnes: number,
): number {
  assertNonNegative('productionTonnes', productionTonnes);
  return baseline.a + baseline.b * productionTonnes;
}
