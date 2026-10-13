import { carbonSentence } from '@ecoproof/shared';
import { describe, expect, it } from 'vitest';

describe('carbonSentence', () => {
  it('names the grid and diesel parts', () => {
    expect(carbonSentence({ scope2T: 63.6, scope1T: 3.2 })).toBe(
      '66.8 t CO2 (63.6 t from grid electricity, 3.2 t from diesel)',
    );
  });
  it('drops the fuel part when scope 1 is 0', () => {
    expect(carbonSentence({ scope2T: 63.64, scope1T: 0 })).toBe(
      '63.6 t CO2 (all from grid electricity)',
    );
  });
  it('uses Indian grouping and never the old broken label', () => {
    const s = carbonSentence({ scope2T: 1234.56, scope1T: 40.04 });
    expect(s).toBe('1,274.6 t CO2 (1,234.6 t from grid electricity, 40 t from diesel)');
    expect(s).not.toContain('(fuels)');
  });
});
