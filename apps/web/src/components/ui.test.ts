import { describe, expect, it } from 'vitest';
import { yearMonths } from './ui';

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
