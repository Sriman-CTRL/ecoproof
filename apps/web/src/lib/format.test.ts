import { describe, expect, it } from 'vitest';
import { displayDigits, formatInr, formatNumber, inrWords, parseDigits } from './format';

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

describe('loan amount input', () => {
  it('keeps plain digits while typing and groups them the Indian way after', () => {
    // Deleting one digit from "10,00,000" used to leave "10,00,00" on screen.
    expect(parseDigits('1000000')).toBe(1000000);
    expect(parseDigits('100000')).toBe(100000);
    expect(displayDigits('100000')).toBe('1,00,000');
    expect(displayDigits('2775000')).toBe('27,75,000');
    expect(parseDigits('27,75,000')).toBe(2775000);
    expect(displayDigits('')).toBe('');
  });
});
