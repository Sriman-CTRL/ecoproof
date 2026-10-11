import { describe, expect, it } from 'vitest';
import { actionSavingRange, rankActions } from './actions';
import { FORMULA_VERSION } from './types';

describe('actionSavingRange', () => {
  it('synthetic: 10,00,000 kWh/yr, share 0.7, 5-10% gives 35,000 to 70,000 kWh', () => {
    const r = actionSavingRange({
      baselineKwhPerYear: 1_000_000,
      enduseShare: 0.7,
      savingPctLow: 5,
      savingPctHigh: 10,
    });
    expect(r.kwhLow).toBeCloseTo(35_000, 6);
    expect(r.kwhHigh).toBeCloseTo(70_000, 6);
    expect(r.formulaVersion).toBe(FORMULA_VERSION);
  });

  it('synthetic: low above high throws', () => {
    expect(() =>
      actionSavingRange({
        baselineKwhPerYear: 1_000,
        enduseShare: 0.5,
        savingPctLow: 10,
        savingPctHigh: 5,
      }),
    ).toThrow();
  });
});

describe('rankActions', () => {
  it('synthetic: zero-cost action with null payback ranks above a 1-year payback action', () => {
    const actions = [
      { id: 'vfd', isZeroCost: false, paybackYears: 1, co2SavedTonnes: 50 },
      { id: 'shift-load', isZeroCost: true, paybackYears: null, co2SavedTonnes: 1 },
    ];
    const ranked = rankActions(actions);
    expect(ranked.map((a) => a.id)).toEqual(['shift-load', 'vfd']);
    expect(actions[0]?.id).toBe('vfd');
  });

  it('synthetic: equal paybacks tie-break by higher CO2 saved', () => {
    const ranked = rankActions([
      { id: 'a', isZeroCost: false, paybackYears: 2, co2SavedTonnes: 10 },
      { id: 'b', isZeroCost: false, paybackYears: 2, co2SavedTonnes: 30 },
      { id: 'c', isZeroCost: false, paybackYears: null, co2SavedTonnes: 99 },
      { id: 'd', isZeroCost: false, paybackYears: 1.5, co2SavedTonnes: 1 },
    ]);
    expect(ranked.map((a) => a.id)).toEqual(['d', 'b', 'a', 'c']);
  });
});
