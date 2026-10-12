import { describe, expect, it } from 'vitest';
import { domesticBill, netBilledUnits, type DomesticTariff } from './domestic';

// Rates from docs/research/findings-r9.md (TGERC RST Order FY 2026-27, pp. 247, 266).
const tariff: DomesticTariff = {
  groups: [
    {
      id: 'LT-I(A)',
      upToUnits: 100,
      bands: [
        { upToUnits: 50, rateInrPerKwh: 1.95 },
        { upToUnits: 100, rateInrPerKwh: 3.1 },
      ],
    },
    {
      id: 'LT-I(B)(i)',
      upToUnits: 200,
      bands: [
        { upToUnits: 100, rateInrPerKwh: 3.4 },
        { upToUnits: 200, rateInrPerKwh: 4.8 },
      ],
    },
    {
      id: 'LT-I(B)(ii)',
      upToUnits: null,
      bands: [
        { upToUnits: 200, rateInrPerKwh: 5.1 },
        { upToUnits: 300, rateInrPerKwh: 7.7 },
        { upToUnits: 400, rateInrPerKwh: 9 },
        { upToUnits: 800, rateInrPerKwh: 9.5 },
        { upToUnits: null, rateInrPerKwh: 10 },
      ],
    },
  ],
  fixed: { rateInrPerKw: 10, aboveUnits: 800, rateAboveInrPerKw: 50 },
  customer: [
    { upToUnits: 50, inrPerMonth: 40 },
    { upToUnits: 100, inrPerMonth: 70 },
    { upToUnits: 200, inrPerMonth: 90 },
    { upToUnits: 300, inrPerMonth: 100 },
    { upToUnits: 400, inrPerMonth: 120 },
    { upToUnits: 800, inrPerMonth: 140 },
    { upToUnits: null, inrPerMonth: 160 },
  ],
  netMetering: { billedOn: 'import_minus_export' },
};
const bill = (units: number, kw = 3) => domesticBill({ units, sanctionedLoadKw: kw, tariff });

describe('domesticBill', () => {
  it('40 units: LT-I(A), energy 78.00, customer 40', () => {
    const b = bill(40);
    expect(b.group).toBe('LT-I(A)');
    expect(b.energyInr).toBe(78);
    expect(b.customerInr).toBe(40);
  });
  it('150 units: LT-I(B)(i), energy 580.00, customer 90', () => {
    const b = bill(150);
    expect(b.group).toBe('LT-I(B)(i)');
    expect(b.energyInr).toBe(580);
    expect(b.customerInr).toBe(90);
  });
  it('250 units: LT-I(B)(ii), energy 1,405.00, customer 100', () => {
    const b = bill(250);
    expect(b.group).toBe('LT-I(B)(ii)');
    expect(b.energyInr).toBe(1405);
    expect(b.customerInr).toBe(100);
  });
  it('900 units: energy 7,490.00, fixed Rs 50/kW, customer 160', () => {
    const b = bill(900);
    expect(b.energyInr).toBe(7490);
    expect(b.fixedInr).toBe(150);
    expect(b.lines.find((l) => l.kind === 'fixed')?.rateInr).toBe(50);
    expect(b.customerInr).toBe(160);
  });
  it('0 units: energy 0, customer 40, fixed still charged on the load', () => {
    const b = bill(0);
    expect(b.energyInr).toBe(0);
    expect(b.customerInr).toBe(40);
    expect(b.fixedInr).toBe(30);
    expect(b.totalInr).toBe(70);
  });
  it('total is the sum of the three charges; band edges stay in the lower group', () => {
    const b = bill(100);
    expect(b.group).toBe('LT-I(A)');
    expect(b.totalInr).toBe(b.energyInr + b.fixedInr + b.customerInr);
    expect(bill(101).group).toBe('LT-I(B)(i)');
  });
  it('rejects negative units', () => {
    expect(() => bill(-1)).toThrow();
  });
});

describe('netBilledUnits', () => {
  it('is import minus export, never below zero', () => {
    const nm = tariff.netMetering;
    expect(netBilledUnits(210, 190, nm)).toBe(20);
    expect(netBilledUnits(160, 170, nm)).toBe(0);
    expect(netBilledUnits(300, null, nm)).toBe(300);
  });

  it('refuses a net-metering basis it does not know', () => {
    const rule = { billedOn: 'gross' } as unknown as DomesticTariff['netMetering'];
    expect(() => netBilledUnits(210, 190, rule)).toThrow(/net-metering basis/);
  });
});
