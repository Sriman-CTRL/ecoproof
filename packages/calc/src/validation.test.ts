import { describe, expect, it } from 'vitest';
import { validateBill } from './validation';

const history = [
  { billNo: 'B-001', periodStart: '2026-03-01', periodEnd: '2026-03-31', kwh: 50000 },
];
// April 2026 is 30 days = 720 h; 100 kW x 720 h = 72,000 kWh.
const clean = {
  billNo: 'B-002',
  periodStart: '2026-04-01',
  periodEnd: '2026-04-30',
  kwh: 55000,
  kvah: 60000,
  pf: 0.92,
  sanctionedLoadKw: 100,
};

describe('validateBill', () => {
  it('synthetic: a clean bill has no errors', () => {
    expect(validateBill({ bill: clean, history })).toEqual({ errors: [], needsConfirmation: [] });
  });

  it('synthetic: duplicate bill number is an error', () => {
    expect(validateBill({ bill: { ...clean, billNo: 'B-001' }, history }).errors).toHaveLength(1);
  });

  it('synthetic: overlapping period is an error', () => {
    const r = validateBill({ bill: { ...clean, periodStart: '2026-03-25' }, history });
    expect(r.errors).toHaveLength(1);
  });

  it('synthetic: kwh above kvah is an error', () => {
    expect(validateBill({ bill: { ...clean, kvah: 50000 }, history }).errors).toHaveLength(1);
  });

  it('synthetic: pf 1.1 is an error', () => {
    expect(validateBill({ bill: { ...clean, pf: 1.1 }, history }).errors).toHaveLength(1);
  });

  it('synthetic: 80,000 kWh on 100 kW over 720 h is an error', () => {
    const r = validateBill({ bill: { ...clean, kwh: 80000, kvah: 90000 }, history: [] });
    expect(r.errors).toHaveLength(1);
  });

  it('synthetic: 60% jump vs previous bill needs confirmation', () => {
    const r = validateBill({
      bill: { ...clean, kwh: 80000, kvah: 90000, sanctionedLoadKw: 200 },
      history,
    });
    expect(r.errors).toEqual([]);
    expect(r.needsConfirmation).toHaveLength(1);
  });
});
