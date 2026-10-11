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
