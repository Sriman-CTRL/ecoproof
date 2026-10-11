import { describe, expect, it } from 'vitest';
import { formatInr, formatNumber, inrWords } from './format';

describe('format', () => {
  it('groups digits the Indian way', () => {
    expect(formatNumber(100000)).toBe('1,00,000');
    expect(formatInr(910000)).toBe('₹9,10,000');
  });
  it('adds lakh and crore words only over Rs 1 lakh', () => {
    expect(inrWords(2500000)).toBe('25 lakh');
    expect(inrWords(10000000)).toBe('1 crore');
    expect(inrWords(99999)).toBe('');
  });
});
