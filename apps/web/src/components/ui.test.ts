import { describe, expect, it } from 'vitest';
import i18n from '../i18n';
import { actionCo2Text, tonnesText, yearMonths } from './ui';

describe('yearMonths', () => {
  it('lays out 12 months ending at the newest bill and fills the ones that have a bill', () => {
    const tiles = yearMonths([{ month: '2026-10-01' }, { month: '2026-09-01' }], 'en');
    expect(tiles).toHaveLength(12);
    expect(tiles.at(-1)).toEqual({ label: 'Oct', confirmed: true });
    expect(tiles.at(-2)).toEqual({ label: 'Sept', confirmed: true });
    expect(tiles.filter((t) => t.confirmed)).toHaveLength(2);
    expect(tiles[0]!.label).toBe('Nov');
  });

  it('is empty without bills', () => {
    expect(yearMonths([], 'en')).toEqual([]);
  });
});

describe('actionCo2Text', () => {
  const t = i18n.getFixedT('en');
  it('gives the CO2 partner of a kWh-saving action as a whole-tonne range', () => {
    const co2 = { tPerYearLow: 41.089, tPerYearHigh: 49.894 };
    expect(actionCo2Text({ co2, co2Note: null }, t)).toBe('41-50 t CO2 a year');
  });

  it('says a bill charge fix has no CO2 change, and nothing when there is no kWh figure', () => {
    expect(actionCo2Text({ co2: null, co2Note: 'bill_charge_only' }, t)).toBe(
      'no CO2 change: bill charge fix',
    );
    expect(actionCo2Text({ co2: null, co2Note: null }, t)).toBeNull();
  });

  it('keeps one decimal under 10 t', () => {
    expect(tonnesText(2.469)).toBe('2.5');
    expect(tonnesText(42.8)).toBe('43');
  });
});
