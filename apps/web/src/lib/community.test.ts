import { describe, expect, it } from 'vitest';
import { findBanned, findMitraBanned } from '../locales/wording';
import { findPrivateDetails, SAMPLE_POSTS } from './community';

const kinds = (s: string) => findPrivateDetails(s).map((m) => m.kind);

describe('findPrivateDetails', () => {
  it('passes plain and rough-range text', () => {
    expect(kinds('We pay about 1 lakh a month and want to cut it')).toEqual([]);
    expect(kinds('Rs 2 lakh a month')).toEqual([]);
  });
  it('flags consumer and service numbers', () => {
    expect(kinds('my service number 1234 56789')).toEqual(['consumer']);
    expect(kinds('Consumer No: 123456789')).toEqual(['consumer']);
  });
  it('flags Udyam, GSTIN, phone and email', () => {
    expect(kinds('UDYAM-TS-09-0012345')).toEqual(['udyam']);
    expect(kinds('GST 36ABCDE1234F1Z5')).toEqual(['gstin']);
    expect(kinds('call 98765 43210 or 9876543210')).toEqual(['phone', 'phone']);
    expect(kinds('mail me at owner@foundry.in')).toEqual(['email']);
  });
  it('flags exact rupee and energy amounts, with positions', () => {
    const m = findPrivateDetails('Bill was Rs 1,11,200 and 48,000 kWh');
    expect(m.map((x) => x.kind)).toEqual(['amount', 'amount']);
    expect(m[0]!.text).toBe('Rs 1,11,200');
  });
});

describe('sample posts', () => {
  it('has 8 posts, one helpful answer on a question, and clean wording', () => {
    expect(SAMPLE_POSTS).toHaveLength(8);
    expect(SAMPLE_POSTS.flatMap((p) => p.answers).some((a) => a.helpful)).toBe(true);
    const text = SAMPLE_POSTS.flatMap((p) => [p.title, p.body, ...p.answers.map((a) => a.text)]);
    for (const s of text) {
      expect(findBanned(s), s).toEqual([]);
      expect(findMitraBanned(s), s).toEqual([]);
    }
  });
});
