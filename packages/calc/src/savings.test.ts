import { describe, expect, it } from 'vitest';
import { fitBaseline } from './baseline';
import { monthlySavings, savingsStatus } from './savings';
import type { Factor } from './types';

const P = [80, 85, 90, 95, 100, 105, 110, 115, 90, 95, 100, 105];
const E = [74500, 78600, 82300, 86800, 90400, 93700, 98900, 102100, 81800, 86300, 90900, 94200];
const baseline = fitBaseline({
  months: P.map((productionTonnes, i) => ({ productionTonnes, kwh: E[i]! })),
  rules: { minMonthsForRegression: 9, maxCvRmsePct: 15, maxAbsNmbePct: 5 },
});
const grid: Factor = {
  id: 'f-grid',
  value: 0.727,
  unit: 't CO2/MWh',
  status: 'confirmed',
  gasBasis: 'CO2',
};
const diesel: Factor = {
  id: 'f-diesel',
  value: 2.675,
  unit: 'kg CO2/l',
  status: 'confirmed',
  gasBasis: 'CO2',
};
const base = { baseline, productionTonnes: 100, effectiveRatePerKwh: 7.5, gridFactor: grid };

describe('monthlySavings', () => {
  it('synthetic: three reporting months at 100 t', () => {
    const saved = [85000, 84000, 86000].map(
      (actualKwh) => monthlySavings({ ...base, actualKwh }).savedKwh,
    );
    expect(saved[0]).toBeCloseTo(5365.96, 2);
    expect(saved[1]).toBeCloseTo(6365.96, 2);
    expect(saved[2]).toBeCloseTo(4365.96, 2);
  });

  it('synthetic: Rs and CO2 for 5365.96 kWh saved', () => {
    const r = monthlySavings({ ...base, actualKwh: 85000 });
    expect(r.inrSaved).toBeCloseTo(40244.68, 2);
    expect(r.co2SavedTonnes).toBeCloseTo(3.9011, 4);
    expect(r.factorIds).toEqual(['f-grid']);
  });

  it('synthetic: positive NRA adds to the adjusted baseline', () => {
    const r = monthlySavings({ ...base, actualKwh: 90000, nraKwh: 2000 });
    expect(r.adjustedBaselineKwh).toBeCloseTo(92365.96, 2);
    expect(r.savedKwh).toBeCloseTo(2365.96, 2);
  });

  it('synthetic: fuel saved adds CO2 and its factor id', () => {
    const r = monthlySavings({
      ...base,
      actualKwh: 85000,
      fuelSaved: [{ quantity: 100, factor: diesel }],
    });
    expect(r.co2SavedTonnes).toBeCloseTo(3.9011 + 0.2675, 4);
    expect(r.factorIds).toEqual(['f-grid', 'f-diesel']);
  });
});

describe('savingsStatus', () => {
  it('synthetic: 3-month cumulative 16097.87 > 1422.87 is verified', () => {
    const cumulative = [85000, 84000, 86000]
      .map((actualKwh) => monthlySavings({ ...base, actualKwh }).savedKwh)
      .reduce((x, y) => x + y, 0);
    expect(cumulative).toBeCloseTo(16097.87, 2);
    expect(2 * baseline.s! * Math.sqrt(3)).toBeCloseTo(1422.87, 2);
    expect(savingsStatus({ baseline, cumulativeSavedKwh: cumulative, reportingMonths: 3 })).toBe(
      'verified',
    );
  });

  it('synthetic: one month of 365.96 < 821.49 is too early to confirm', () => {
    const saved = monthlySavings({ ...base, actualKwh: 90000 }).savedKwh;
    expect(saved).toBeCloseTo(365.96, 2);
    expect(2 * baseline.s!).toBeCloseTo(821.49, 2);
    expect(savingsStatus({ baseline, cumulativeSavedKwh: saved, reportingMonths: 1 })).toBe(
      'too_early_to_confirm',
    );
  });

  it('synthetic: indicative and intensity baselines give "indicative"', () => {
    for (const method of ['indicative', 'intensity'] as const) {
      expect(
        savingsStatus({
          baseline: { ...baseline, method },
          cumulativeSavedKwh: 1e9,
          reportingMonths: 3,
        }),
      ).toBe('indicative');
    }
  });
});
