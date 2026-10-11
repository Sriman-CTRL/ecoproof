import { describe, expect, it } from 'vitest';
import { footprint } from './footprint';
import { UnverifiedFactorError } from './errors';
import { FORMULA_VERSION, type Factor } from './types';

const grid: Factor = {
  id: 'f-grid',
  value: 0.727,
  unit: 't CO2/MWh',
  status: 'confirmed_replace',
  gasBasis: 'CO2',
};
const diesel: Factor = {
  id: 'f-diesel',
  value: 2.675,
  unit: 'kg CO2e/L',
  status: 'confirmed',
  gasBasis: 'CO2e',
};
const lpgVerify: Factor = {
  id: 'f-lpg',
  value: 2.9,
  unit: 'kg CO2e/kg',
  status: 'verify',
  gasBasis: 'CO2e',
};

describe('footprint', () => {
  it('Doc 03 worked example: 90,000 kWh, 1,200 L diesel, 100 t castings', () => {
    const r = footprint({
      gridKwh: 90_000,
      fuels: [{ quantity: 1_200, factor: diesel }],
      outputTonnes: 100,
      gridFactor: grid,
    });
    expect(r.scope2Tonnes).toBeCloseTo(65.43, 10);
    expect(r.scope1Tonnes).toBeCloseTo(3.21, 10);
    expect(r.totalTonnes).toBeCloseTo(68.64, 10);
    expect(r.intensityTPerTonne).toBeCloseTo(0.6864, 10);
    expect(r.intensityTPerTonne).toBeCloseTo(0.69, 2);
    expect(r.energyIntensityKwhPerTonne).toBeCloseTo(900, 10);
    expect(r.scope2GasBasis).toBe('CO2');
    expect(r.scope1GasBasis).toBe('CO2e');
    expect(r.label).toBe('t CO2 (grid) + t CO2e (fuels)');
    expect(r.factorIds).toEqual(expect.arrayContaining(['f-grid', 'f-diesel']));
    expect(r.factorIds).toHaveLength(2);
    expect(r.formulaVersion).toBe(FORMULA_VERSION);
    expect(FORMULA_VERSION).toBe('calc-1.0.0');
    expect(r.isEstimate).toBe(false);
  });

  it('synthetic: zero output tonnes gives null intensity, no throw', () => {
    const r = footprint({ gridKwh: 90_000, fuels: [], outputTonnes: 0, gridFactor: grid });
    expect(r.intensityTPerTonne).toBeNull();
    expect(r.energyIntensityKwhPerTonne).toBeNull();
    expect(r.totalTonnes).toBeCloseTo(65.43, 10);
  });

  it('synthetic: missing output tonnes gives null intensity', () => {
    const r = footprint({ gridKwh: 1_000, fuels: [], gridFactor: grid });
    expect(r.intensityTPerTonne).toBeNull();
    expect(r.energyIntensityKwhPerTonne).toBeNull();
  });

  it('synthetic: unverified LPG factor throws UnverifiedFactorError', () => {
    expect(() =>
      footprint({
        gridKwh: 1_000,
        fuels: [{ quantity: 100, factor: lpgVerify }],
        outputTonnes: 10,
        gridFactor: grid,
      }),
    ).toThrow(UnverifiedFactorError);
  });

  it('synthetic: unverified LPG factor with allowUnverified returns isEstimate true', () => {
    const r = footprint(
      {
        gridKwh: 1_000,
        fuels: [{ quantity: 100, factor: lpgVerify }],
        outputTonnes: 10,
        gridFactor: grid,
      },
      { allowUnverified: true },
    );
    expect(r.isEstimate).toBe(true);
    expect(r.scope1Tonnes).toBeCloseTo(0.29, 10);
    expect(r.factorIds).toContain('f-lpg');
  });

  it('synthetic: estimate_only factor marks result as estimate', () => {
    const r = footprint({
      gridKwh: 1_000,
      fuels: [{ quantity: 100, factor: { ...diesel, id: 'f-est', status: 'estimate_only' } }],
      gridFactor: grid,
    });
    expect(r.isEstimate).toBe(true);
  });

  it('synthetic: grid only, no fuels labels grid basis alone', () => {
    const r = footprint({ gridKwh: 1_000, fuels: [], outputTonnes: 1, gridFactor: grid });
    expect(r.scope1Tonnes).toBe(0);
    expect(r.scope1GasBasis).toBeNull();
    expect(r.label).toBe('t CO2 (grid)');
    expect(r.factorIds).toEqual(['f-grid']);
  });

  it('synthetic: negative quantity throws', () => {
    expect(() =>
      footprint({ gridKwh: -1, fuels: [], outputTonnes: 1, gridFactor: grid }),
    ).toThrow();
  });
});
