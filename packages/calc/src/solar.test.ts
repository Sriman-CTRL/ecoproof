import { describe, expect, it } from 'vitest';
import { InvalidInputError } from './errors';
import { pmSuryaGharCfa, rooftopBenchmarkCost, solarPlanSize, solarSize } from './solar';

const base = {
  roofAreaM2: 500,
  areaPerKwpM2: 10,
  daytimeKwhPerYear: 60000,
  yieldKwhPerKwpYear: 1500,
  capKwp: 100,
  energyRatePerKwh: 7.5,
  solarRebatePerKwh: 0.5,
};

describe('solarSize', () => {
  it('synthetic: consumption-limited 40 kWp system', () => {
    const r = solarSize({ ...base, defaults: ['areaPerKwpM2'] });
    expect(r.kwp).toBe(40);
    expect(r.limitedBy).toBe('consumption');
    expect(r.generationKwh).toBe(60000);
    expect(r.inrSavedPerYear).toBeCloseTo(420000, 6);
    expect(r.assumptionsUsed).toEqual(['areaPerKwpM2']);
  });

  it('synthetic: roof-limited and cap-limited', () => {
    expect(solarSize({ ...base, roofAreaM2: 300 }).limitedBy).toBe('roof');
    expect(solarSize({ ...base, capKwp: 25 }).limitedBy).toBe('cap');
  });

  it('synthetic: missing yield throws', () => {
    expect(() => solarSize({ ...base, yieldKwhPerKwpYear: null })).toThrow(InvalidInputError);
  });

  it('synthetic: missing area per kWp throws', () => {
    expect(() => solarSize({ ...base, areaPerKwpM2: undefined })).toThrow(InvalidInputError);
  });
});

describe('solarPlanSize', () => {
  const plan = {
    roofAreaM2: 30,
    areaPerKwp: 10,
    annualKwh: 3840,
    yieldKwhPerKwpYr: 1462.9,
    capKw: 3,
  };

  it('use-limited: 3,840 kWh / 1,462.9 = 2.62 kWp, rounded down to 2.5', () => {
    const r = solarPlanSize(plan);
    expect(r.limitedBy).toBe('use');
    expect(r.kwp).toBe(2.5);
    expect(r.annualGenKwh).toBeCloseTo(2.5 * 1462.9, 6);
    expect(r.belowMinimum).toBe(false);
  });

  it('roof-limited: 18 m2 / 10 m2 per kWp = 1.8, rounded down to 1.5', () => {
    const r = solarPlanSize({ ...plan, roofAreaM2: 18, annualKwh: 10000 });
    expect(r.limitedBy).toBe('roof');
    expect(r.kwp).toBe(1.5);
  });

  it('cap-limited: sanctioned load 2 kW', () => {
    const r = solarPlanSize({ ...plan, roofAreaM2: 100, annualKwh: 10000, capKw: 2 });
    expect(r.limitedBy).toBe('cap');
    expect(r.kwp).toBe(2);
  });

  it('below the 1 kWp minimum gives 0 kWp, never more than the limit', () => {
    const r = solarPlanSize({ ...plan, roofAreaM2: 8 });
    expect(r.limitedBy).toBe('roof');
    expect(r.belowMinimum).toBe(true);
    expect(r.kwp).toBe(0);
    expect(r.annualGenKwh).toBe(0);
  });
});

describe('pmSuryaGharCfa', () => {
  it.each([
    [1, 30000],
    [2, 60000],
    [2.5, 69000],
    [3, 78000],
    [5, 78000],
  ])('%s kW -> Rs %s', (kw, inr) => expect(pmSuryaGharCfa(kw)).toBe(inr));
});

describe('rooftopBenchmarkCost', () => {
  it('Rs 50,000/kW to 2 kW, Rs 45,000/kW after', () => {
    expect(rooftopBenchmarkCost(2)).toBe(100000);
    expect(rooftopBenchmarkCost(2.5)).toBe(122500);
    expect(rooftopBenchmarkCost(3)).toBe(145000);
  });
});
