import { describe, expect, it } from 'vitest';
import { greenProgressScore } from './score';

const base = {
  intensityReductionPct: 10,
  monthsUploadedOnTimeOfLast6: 4,
  verifiedActions: 1,
  peerPercentile: null,
  kwhPerTonne: 900,
  benchmark: { low: 700, high: 2000 },
};

describe('greenProgressScore', () => {
  it('synthetic: 10% reduction, 4/6 on time, 1 action, no peers, 900 kWh/t', () => {
    const r = greenProgressScore(base);
    expect(r.improvement).toBeCloseTo(20, 10);
    expect(r.habit).toBeCloseTo(13.333, 3);
    expect(r.actions).toBeCloseTo(6.667, 3);
    expect(r.peer).toBeCloseTo(16.923, 3);
    expect(r.total).toBeCloseTo(56.923, 3);
  });

  it('synthetic: negative reduction scores 0 improvement', () => {
    expect(greenProgressScore({ ...base, intensityReductionPct: -5 }).improvement).toBe(0);
  });

  it('synthetic: 2,100 kWh/t clips peer to 0', () => {
    expect(greenProgressScore({ ...base, kwhPerTonne: 2100 }).peer).toBe(0);
  });

  it('synthetic: 600 kWh/t clips peer to 20', () => {
    expect(greenProgressScore({ ...base, kwhPerTonne: 600 }).peer).toBe(20);
  });

  it('synthetic: peer percentile used when peers exist', () => {
    expect(greenProgressScore({ ...base, peerPercentile: 0.25 }).peer).toBeCloseTo(15, 10);
  });
});
