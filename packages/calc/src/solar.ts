import { assertNonNegative, InvalidInputError } from './errors';
import { FORMULA_VERSION } from './types';

export interface SolarSizeInput {
  roofAreaM2: number;
  /** Area needed per kWp. Open research item: never defaulted in calc. */
  areaPerKwpM2?: number | null;
  daytimeKwhPerYear: number;
  /** Site yield, kWh per kWp per year. Open research item: never defaulted in calc. */
  yieldKwhPerKwpYear?: number | null;
  /** DISCOM net-metering cap, kWp. */
  capKwp: number;
  energyRatePerKwh: number;
  solarRebatePerKwh?: number;
  /** Names of inputs the caller filled from defaults; echoed back as assumptionsUsed. */
  defaults?: string[];
}

export type SolarLimit = 'roof' | 'consumption' | 'cap';

export interface SolarSizeResult {
  kwp: number;
  limitedBy: SolarLimit;
  generationKwh: number;
  inrSavedPerYear: number;
  assumptionsUsed: string[];
  formulaVersion: typeof FORMULA_VERSION;
}

/** Doc 03 "Rooftop solar size": kWp = min(roof / a, daytime / Y, cap). */
export function solarSize(input: SolarSizeInput): SolarSizeResult {
  const { areaPerKwpM2, yieldKwhPerKwpYear, solarRebatePerKwh = 0 } = input;
  if (areaPerKwpM2 == null || !(areaPerKwpM2 > 0)) {
    throw new InvalidInputError('areaPerKwpM2 is required and must be > 0');
  }
  if (yieldKwhPerKwpYear == null || !(yieldKwhPerKwpYear > 0)) {
    throw new InvalidInputError('yieldKwhPerKwpYear is required and must be > 0');
  }
  assertNonNegative('roofAreaM2', input.roofAreaM2);
  assertNonNegative('daytimeKwhPerYear', input.daytimeKwhPerYear);
  assertNonNegative('capKwp', input.capKwp);
  assertNonNegative('energyRatePerKwh', input.energyRatePerKwh);
  assertNonNegative('solarRebatePerKwh', solarRebatePerKwh);

  // Ties resolve in this order.
  const limits: [SolarLimit, number][] = [
    ['roof', input.roofAreaM2 / areaPerKwpM2],
    ['consumption', input.daytimeKwhPerYear / yieldKwhPerKwpYear],
    ['cap', input.capKwp],
  ];
  const [limitedBy, kwp] = limits.reduce((min, cur) => (cur[1] < min[1] ? cur : min));
  const generationKwh = kwp * yieldKwhPerKwpYear;

  return {
    kwp,
    limitedBy,
    generationKwh,
    inrSavedPerYear: generationKwh * (input.energyRatePerKwh - solarRebatePerKwh),
    assumptionsUsed: [...(input.defaults ?? [])],
    formulaVersion: FORMULA_VERSION,
  };
}

export interface SolarPlanSizeInput {
  roofAreaM2: number;
  /** Area needed per kWp (m2). */
  areaPerKwp: number;
  /** E: yearly units the system may cover (households: all units on the bills). */
  annualKwh: number;
  yieldKwhPerKwpYr: number;
  /** Net-metering cap, kW. */
  capKw: number;
}

export interface SolarPlanSizeResult {
  /** Rounded down to 0.5 kW; 0 when the limit is below the 1 kWp minimum. */
  kwp: number;
  limitedBy: 'roof' | 'use' | 'cap';
  annualGenKwh: number;
  /** True when min(roof, use, cap) is under the 1 kWp net-metering minimum (TGERC Reg 1/2025). */
  belowMinimum: boolean;
  formulaVersion: typeof FORMULA_VERSION;
}

/** A plan an owner can buy: Doc 03 size from solarSize, rounded down to a 0.5 kW step. */
export function solarPlanSize(input: SolarPlanSizeInput): SolarPlanSizeResult {
  const raw = solarSize({
    roofAreaM2: input.roofAreaM2,
    areaPerKwpM2: input.areaPerKwp,
    daytimeKwhPerYear: input.annualKwh,
    yieldKwhPerKwpYear: input.yieldKwhPerKwpYr,
    capKwp: input.capKw,
    energyRatePerKwh: 0,
  });
  const belowMinimum = raw.kwp < 1;
  const kwp = belowMinimum ? 0 : Math.floor(raw.kwp * 2) / 2;
  return {
    kwp,
    limitedBy: raw.limitedBy === 'consumption' ? 'use' : raw.limitedBy,
    annualGenKwh: kwp * input.yieldKwhPerKwpYr,
    belowMinimum,
    formulaVersion: FORMULA_VERSION,
  };
}

/**
 * PM Surya Ghar central financial assistance, residential only (R5, CFA guidelines p.3):
 * Rs 30,000/kWp for the first 2 kWp, Rs 18,000/kWp for capacity above that, max Rs 78,000.
 * The per-kWp rate applies to a part kW pro rata.
 */
export function pmSuryaGharCfa(kwp: number): number {
  assertNonNegative('kwp', kwp);
  const first = Math.min(kwp, 2) * 30000;
  const third = Math.max(Math.min(kwp, 3) - 2, 0) * 18000;
  return Math.min(first + third, 78000);
}

/**
 * MNRE benchmark cost used to set the CFA (R5, CFA guidelines p.6 §5(g)): Rs 50,000/kW for the
 * first 2 kW, Rs 45,000/kW after. Real quotes vary.
 */
export function rooftopBenchmarkCost(kwp: number): number {
  assertNonNegative('kwp', kwp);
  return Math.min(kwp, 2) * 50000 + Math.max(kwp - 2, 0) * 45000;
}
