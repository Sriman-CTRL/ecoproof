import { describe, expect, it } from 'vitest';
import {
  checkContractedDemand,
  checkLtSurcharges,
  checkMinimumCharges,
  checkPeakUse,
  checkPowerFactor,
} from './billHealth';
import { FORMULA_VERSION } from './types';

describe('checkPowerFactor', () => {
  it('Doc 03 worked example: 1,00,000 kVAh, 92,000 kWh at Rs 7.50', () => {
    const r = checkPowerFactor({
      kwh: 92_000,
      kvah: 100_000,
      energyRatePerKvah: 7.5,
      rules: { pfFlagBelow: 0.98 },
    });
    expect(r.pf).toBeCloseTo(0.92, 10);
    expect(r.flagged).toBe(true);
    expect(r.lossKvah).toBeCloseTo(8_000, 10);
    expect(r.lossInrPerMonth).toBeCloseTo(60_000, 10);
    expect(r.formulaVersion).toBe(FORMULA_VERSION);
    expect(r.factorIds).toEqual([]);
  });

  it('synthetic: PF 0.99 is not flagged', () => {
    const r = checkPowerFactor({
      kwh: 99_000,
      kvah: 100_000,
      energyRatePerKvah: 7.5,
      rules: { pfFlagBelow: 0.98 },
    });
    expect(r.flagged).toBe(false);
  });

  it('synthetic: PF guard - kwh > kvah throws', () => {
    expect(() =>
      checkPowerFactor({
        kwh: 101_000,
        kvah: 100_000,
        energyRatePerKvah: 7.5,
        rules: { pfFlagBelow: 0.98 },
      }),
    ).toThrow();
  });

  it('synthetic: PF guard - PF 0.4 throws', () => {
    expect(() =>
      checkPowerFactor({
        kwh: 40_000,
        kvah: 100_000,
        energyRatePerKvah: 7.5,
        rules: { pfFlagBelow: 0.98 },
      }),
    ).toThrow();
  });
});

describe('checkPeakUse', () => {
  const rules = { peakSurchargePerKwh: 1.5, solarRebatePerKwh: 0.5, flagAbovePct: 20 };

  it('synthetic: 25% peak share is flagged, shift saving Rs 20,000', () => {
    const r = checkPeakUse({ totalKwh: 100_000, peakKwh: 25_000, shiftableKwh: 10_000, rules });
    expect(r.peakSharePct).toBeCloseTo(25, 10);
    expect(r.flagged).toBe(true);
    expect(r.savingInrPerMonth).toBeCloseTo(20_000, 10);
    expect(r.formulaVersion).toBe(FORMULA_VERSION);
  });

  it('synthetic: 15% peak share is not flagged', () => {
    const r = checkPeakUse({ totalKwh: 100_000, peakKwh: 15_000, shiftableKwh: 10_000, rules });
    expect(r.peakSharePct).toBeCloseTo(15, 10);
    expect(r.flagged).toBe(false);
  });

  it('synthetic: no shiftable kWh from owner gives null saving', () => {
    const r = checkPeakUse({ totalKwh: 100_000, peakKwh: 25_000, rules });
    expect(r.flagged).toBe(true);
    expect(r.savingInrPerMonth).toBeNull();
  });
});

describe('checkContractedDemand', () => {
  const rules = { minBillingPctOfCd: 80, flagMonths: 6 };

  it('synthetic: MD 300 for 12 months on CD 500 is flagged, overpay Rs 10,000', () => {
    const r = checkContractedDemand({
      contractedKva: 500,
      last12MdKva: Array<number>(12).fill(300),
      demandRatePerKva: 100,
      rules,
    });
    expect(r.maxMd).toBe(300);
    expect(r.monthsBelow).toBe(12);
    expect(r.flagged).toBe(true);
    expect(r.overpayInrPerMonth).toBeCloseTo(10_000, 10);
    expect(r.formulaVersion).toBe(FORMULA_VERSION);
  });

  it('synthetic: only 5 months below 400 kVA is not flagged', () => {
    const mds = [...Array<number>(5).fill(300), ...Array<number>(7).fill(450)];
    const r = checkContractedDemand({
      contractedKva: 500,
      last12MdKva: mds,
      demandRatePerKva: 100,
      rules,
    });
    expect(r.monthsBelow).toBe(5);
    expect(r.flagged).toBe(false);
    expect(r.overpayInrPerMonth).toBe(0);
  });
});

describe('checkMinimumCharges', () => {
  const rules = { kvahPerKvaPerMonth: 50 };

  it('synthetic: 15,000 kVAh against 20,000 minimum is flagged, gap Rs 37,500', () => {
    const r = checkMinimumCharges({
      billingDemandKva: 400,
      actualKvah: 15_000,
      energyRatePerKvah: 7.5,
      rules,
    });
    expect(r.minimumKvah).toBeCloseTo(20_000, 10);
    expect(r.gapKvah).toBeCloseTo(5_000, 10);
    expect(r.flagged).toBe(true);
    expect(r.gapInrPerMonth).toBeCloseTo(37_500, 10);
    expect(r.assumption).toBe(
      "shortfall valued at the bill's energy rate (Doc 03 gives no Rs conversion; see OPEN_ITEMS)",
    );
    expect(r.formulaVersion).toBe(FORMULA_VERSION);
  });

  it('synthetic: 25,000 kVAh above minimum is not flagged, gap 0', () => {
    const r = checkMinimumCharges({
      billingDemandKva: 400,
      actualKvah: 25_000,
      energyRatePerKvah: 7.5,
      rules,
    });
    expect(r.flagged).toBe(false);
    expect(r.gapKvah).toBe(0);
    expect(r.gapInrPerMonth).toBe(0);
  });
});

describe('checkLtSurcharges', () => {
  it('synthetic: one non-zero surcharge line is flagged', () => {
    const r = checkLtSurcharges({
      lineItems: { low_pf_surcharge: 1_200, capacitor_surcharge: 0, energy_charges: 50_000 },
      rules: { readLineItems: ['low_pf_surcharge', 'capacitor_surcharge'] },
    });
    expect(r.flagged).toBe(true);
    expect(r.items).toEqual([{ name: 'low_pf_surcharge', inr: 1_200 }]);
    expect(r.formulaVersion).toBe(FORMULA_VERSION);
  });

  it('synthetic: all-zero or missing surcharge lines are not flagged', () => {
    const r = checkLtSurcharges({
      lineItems: { capacitor_surcharge: 0 },
      rules: { readLineItems: ['low_pf_surcharge', 'capacitor_surcharge'] },
    });
    expect(r.flagged).toBe(false);
    expect(r.items).toEqual([]);
  });
});
