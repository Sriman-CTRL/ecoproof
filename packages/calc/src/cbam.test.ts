import { describe, expect, it } from 'vitest';
import { cbamEstimate } from './cbam';

describe('cbamEstimate', () => {
  it('synthetic: castings with default pig-iron precursor', () => {
    const r = cbamEstimate({
      scope1AttributedTonnes: 3.21,
      precursors: [{ tonnes: 20, see: 2.53, isDefault: true }],
      scope2Tonnes: 65.43,
      outputTonnes: 100,
    });
    expect(r.seeDirect).toBeCloseTo(0.5381, 4);
    expect(r.seeIndirectInfo).toBeCloseTo(0.6543, 4);
    expect(Math.abs(r.defaultSharePct - 94.03)).toBeLessThanOrEqual(0.01);
    expect(r.label).toBe('Estimate, not verified');
    expect(r.isEstimate).toBe(true);
  });
});
