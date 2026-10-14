import { checkGstin, gstinCheckDigit, SAMPLE_GSTIN, udyamFormat } from '@ecoproof/shared';
import { describe, expect, it } from 'vitest';

describe('udyamFormat', () => {
  it('accepts UDYAM-XX-00-0000000, marks the demo number, rejects others', () => {
    expect(udyamFormat('UDYAM-TS-02-0012345')).toBe('ok');
    expect(udyamFormat('udyam-ts-02-0012345')).toBe('ok');
    expect(udyamFormat('UDYAM-SAMPLE-0001')).toBe('sample');
    expect(udyamFormat('UDYAM-TS-2-12345')).toBe('bad');
    expect(udyamFormat('123456789012')).toBe('bad');
  });
});

describe('GSTIN', () => {
  it('computes the standard check digit (published example 27AAPFU0939F1ZV)', () => {
    expect(gstinCheckDigit('27AAPFU0939F1Z')).toBe('V');
  });
  it('the sample GSTIN passes for Telangana', () => {
    const c = checkGstin(SAMPLE_GSTIN);
    expect(c.ok).toBe(true);
    expect(c.panInside).toBe('AAAAA0000A');
  });
  it('changing any one character fails', () => {
    const chars = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    for (let i = 0; i < 15; i++) {
      const c = SAMPLE_GSTIN[i]!;
      const other = chars[(chars.indexOf(c) + 1) % 36]!;
      const mutated = SAMPLE_GSTIN.slice(0, i) + other + SAMPLE_GSTIN.slice(i + 1);
      expect(checkGstin(mutated).ok, mutated).toBe(false);
    }
  });
  it('names the problem: length, state, Z', () => {
    expect(checkGstin('36AAAAA0000A1Z').problem).toMatch(/15 characters/);
    expect(checkGstin('27AAPFU0939F1ZV').problem).toMatch(/not Telangana/);
    expect(checkGstin('27AAPFU0939F1ZV', '27').ok).toBe(true);
  });
});
