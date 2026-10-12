import { describe, expect, it } from 'vitest';
import type { TFunction } from 'i18next';
import i18n from '../i18n';
import { co2Parts } from './Home';

const t = i18n.getFixedT('en') as TFunction;

describe('co2Parts (insight sentence CO2 fragment)', () => {
  it('names the grid source instead of pasting the total label', () => {
    const s = co2Parts({ tCo2Grid: 12.722, tCo2eFuels: 0 }, t);
    expect(s).toBe(', 12.72 t CO2 more from grid electricity');
    expect(s).not.toContain('t CO2 (grid) + t CO2e');
  });

  it('adds the fuel part only when fuel CO2e changed', () => {
    expect(co2Parts({ tCo2Grid: -1.5, tCo2eFuels: 0.4 }, t)).toBe(
      ', 1.5 t CO2 less from grid electricity, 0.4 t CO2e more from fuels',
    );
  });
});
