import { describe, expect, it } from 'vitest';
import en from './en.json';
import te from './te.json';
import { findBanned } from './wording';

function strings(o: unknown, path = ''): [string, string][] {
  if (typeof o === 'string') return [[path, o]];
  if (o && typeof o === 'object') {
    return Object.entries(o).flatMap(([k, v]) =>
      k === '_comment' ? [] : strings(v, path ? `${path}.${k}` : k),
    );
  }
  return [];
}

describe('wording rules', () => {
  it('catches a bare banned word but allows the approved phrases', () => {
    expect(findBanned('Your plan is approved')).toEqual(['approved']);
    expect(findBanned('Verified')).toEqual(['verified']);
    expect(findBanned('Verified by your bills. Estimate, not verified.')).toEqual([]);
    expect(findBanned('Likely eligible; confirm with the scheme office')).toEqual([]);
    expect(findBanned('Not an energy audit. Apply for ZED certification.')).toEqual([]);
    expect(findBanned('unverified')).toEqual([]);
  });

  for (const [name, json] of [
    ['en', en],
    ['te', te],
  ] as const) {
    it(`${name}.json has no banned words`, () => {
      const hits = strings(json).flatMap(([key, value]) =>
        findBanned(value).map((w) => `${key}: ${w}`),
      );
      expect(hits).toEqual([]);
    });
  }
});
