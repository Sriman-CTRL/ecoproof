import { describe, expect, it } from 'vitest';
import { dataQualityScore } from './dataQuality';
import { InvalidInputError } from './errors';

describe('dataQualityScore', () => {
  it('synthetic: 60 t measured + 40 t default is 60%, below threshold', () => {
    const r = dataQualityScore([
      { tonnes: 60, tag: 'measured' },
      { tonnes: 40, tag: 'default' },
    ]);
    expect(r.measuredSharePct).toBe(60);
    expect(r.belowThreshold).toBe(true);
    expect(r.byTag.default).toEqual({ tonnes: 40, sharePct: 40 });
    expect(r.byTag.estimated).toEqual({ tonnes: 0, sharePct: 0 });
  });

  it('synthetic: zero total throws', () => {
    expect(() => dataQualityScore([])).toThrow(InvalidInputError);
  });
});
