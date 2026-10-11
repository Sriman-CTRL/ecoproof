import { describe, expect, it } from 'vitest';
import { InvalidInputError } from './errors';
import { solarSize } from './solar';

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
