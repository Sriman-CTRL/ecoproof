import { describe, expect, it } from 'vitest';
import en from './en.json';
import te from './te.json';
import { findBanned, findMitraBanned } from './wording';

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

  it('skips a stored source quote shown inside quote marks, but not our own words', () => {
    const q = 'based on the sanctioned load of the consumer';
    expect(findBanned(`Source: “${q}”`, [q])).toEqual([]);
    expect(findBanned(`Source: ${q}`, [q])).toEqual(['sanctioned']);
    expect(findBanned(`Your plan is approved. “${q}”`, [q])).toEqual(['approved']);
  });

  for (const [name, json] of [
    ['en', en],
    ['te', te],
  ] as const) {
    it(`${name}.json never mentions Gruha Jyothi, free units or 300 units`, () => {
      expect(JSON.stringify(json)).not.toMatch(/gruha|free units|300 units/i);
    });

    it(`${name}.json Mitra strings pass the Mitra scan (no partner, official, must...)`, () => {
      const hits = strings(json)
        .filter(([key]) => key.startsWith('mitra.') || key.startsWith('reports.mitra'))
        .flatMap(([key, value]) => findMitraBanned(value).map((w) => `${key}: ${w}`));
      expect(hits).toEqual([]);
    });

    it(`${name}.json has no banned words`, () => {
      const hits = strings(json).flatMap(([key, value]) =>
        findBanned(value).map((w) => `${key}: ${w}`),
      );
      expect(hits).toEqual([]);
    });
  }
});
