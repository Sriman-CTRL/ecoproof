import { describe, expect, it } from 'vitest';
import { cashTest, emi, simplePaybackYears } from './finance';
import { FORMULA_VERSION } from './types';

describe('emi', () => {
  it('Doc 03 worked example: Rs 10,00,000 at 8% for 60 months', () => {
    expect(emi({ principal: 1_000_000, annualRatePct: 8, months: 60 })).toBeCloseTo(20_276.39, 2);
  });

  it('synthetic: EMI at 0% is principal / months', () => {
    expect(emi({ principal: 1_000_000, annualRatePct: 0, months: 60 })).toBeCloseTo(
      16_666.666666666668,
      10,
    );
  });

  it('synthetic: zero months throws', () => {
    expect(() => emi({ principal: 1_000, annualRatePct: 8, months: 0 })).toThrow();
  });
});

describe('cashTest', () => {
  it('Doc 03 worked example: saving Rs 30,000 against the 8% EMI', () => {
    const e = emi({ principal: 1_000_000, annualRatePct: 8, months: 60 });
    const r = cashTest({ emi: e, monthlySavingLow: 30_000 });
    expect(r.netMonthly).toBeCloseTo(9_723.61, 2);
    expect(r.cashPositiveFromMonth1).toBe(true);
    expect(r.formulaVersion).toBe(FORMULA_VERSION);
  });

  it('synthetic: saving below EMI is not cash-positive', () => {
    const r = cashTest({ emi: 20_000, monthlySavingLow: 15_000 });
    expect(r.netMonthly).toBe(-5_000);
    expect(r.cashPositiveFromMonth1).toBe(false);
  });
});

describe('simplePaybackYears', () => {
  it('Doc 03 worked example: 10,00,000 / 3,60,000', () => {
    const p = simplePaybackYears({ capexInr: 1_000_000, annualSavingInrMid: 360_000 });
    expect(p).toBeCloseTo(2.7777777777777777, 10);
    expect(p).toBeCloseTo(2.8, 1);
  });

  it('synthetic: zero or negative saving gives null', () => {
    expect(simplePaybackYears({ capexInr: 1_000, annualSavingInrMid: 0 })).toBeNull();
    expect(simplePaybackYears({ capexInr: 1_000, annualSavingInrMid: -5 })).toBeNull();
  });
});
