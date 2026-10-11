import { describe, expect, it } from 'vitest';
import { adjustedBaseline, fitBaseline, type BaselineRules } from './baseline';
import { InvalidInputError } from './errors';
import { FORMULA_VERSION } from './types';

const rules: BaselineRules = { minMonthsForRegression: 9, maxCvRmsePct: 15, maxAbsNmbePct: 5 };
const P = [80, 85, 90, 95, 100, 105, 110, 115, 90, 95, 100, 105];
const E = [74500, 78600, 82300, 86800, 90400, 93700, 98900, 102100, 81800, 86300, 90900, 94200];
const months = (p: number[], e: number[]) =>
  p.map((productionTonnes, i) => ({ productionTonnes, kwh: e[i]! }));

describe('fitBaseline', () => {
  it('synthetic: 12-month regression fits and is accepted', () => {
    const b = fitBaseline({ months: months(P, E), rules });
    expect(b.method).toBe('regression');
    expect(b.n).toBe(12);
    expect(Math.abs(b.a - 10727.66)).toBeLessThanOrEqual(0.01);
    expect(Math.abs(b.b - 796.383)).toBeLessThanOrEqual(0.001);
    expect(Math.abs(b.s! - 410.747)).toBeLessThanOrEqual(0.01);
    expect(Math.abs(b.cvRmsePct! - 0.4648)).toBeLessThanOrEqual(0.001);
    expect(Math.abs(b.nmbePct!)).toBeLessThan(1e-9);
    expect(b.formulaVersion).toBe(FORMULA_VERSION);
  });

  it('synthetic: noisy data fails CV(RMSE) and is "indicative" but keeps a, b and stats', () => {
    const noisy = E.slice();
    noisy[1]! += 30000;
    noisy[4]! -= 25000;
    noisy[7]! += 30000;
    noisy[10]! -= 28000;
    const b = fitBaseline({ months: months(P, noisy), rules });
    expect(b.cvRmsePct!).toBeCloseTo(20.02, 2);
    expect(b.method).toBe('indicative');
    expect(b.s).not.toBeNull();
    expect(b.b).toBeGreaterThan(0);
  });

  it('synthetic: 8 months falls back to average intensity', () => {
    const p8 = P.slice(0, 8);
    const e8 = E.slice(0, 8);
    const b = fitBaseline({ months: months(p8, e8), rules });
    const sumE = e8.reduce((x, y) => x + y, 0);
    const sumP = p8.reduce((x, y) => x + y, 0);
    expect(b.method).toBe('intensity');
    expect(b.a).toBe(0);
    expect(b.b).toBe(sumE / sumP);
    expect(b.s).toBeNull();
    expect(b.cvRmsePct).toBeNull();
    expect(b.nmbePct).toBeNull();
  });

  it('synthetic: fewer than 2 months throws', () => {
    expect(() => fitBaseline({ months: months([100], [90000]), rules })).toThrow(InvalidInputError);
  });

  it('synthetic: zero production throws', () => {
    expect(() => fitBaseline({ months: months([100, 0], [90000, 1000]), rules })).toThrow(
      InvalidInputError,
    );
  });
});

describe('adjustedBaseline', () => {
  it('synthetic: Ehat at 100 t', () => {
    const b = fitBaseline({ months: months(P, E), rules });
    expect(adjustedBaseline(b, 100)).toBeCloseTo(90365.96, 2);
  });
});
