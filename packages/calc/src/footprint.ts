import { assertNonNegative, checkFactor } from './errors';
import {
  FORMULA_VERSION,
  type CalcOptions,
  type Factor,
  type GasBasis,
  type ResultMeta,
} from './types';

export interface FuelInput {
  /** Confirmed quantity burned in the period, in the factor's unit (litres, kg...). */
  quantity: number;
  /** Emission factor in kg per unit of quantity. */
  factor: Factor;
}

export interface FootprintInput {
  /** Grid kWh (not kVAh) from the bill; imported kWh only when net-metered. */
  gridKwh: number;
  fuels: FuelInput[];
  /** Tonnes of good output in the period; 0 or missing gives null intensity. */
  outputTonnes?: number | null;
  /** Location-based grid factor in t CO2 per MWh. */
  gridFactor: Factor;
}

export interface FootprintResult extends ResultMeta {
  scope1Tonnes: number;
  scope2Tonnes: number;
  totalTonnes: number;
  intensityTPerTonne: number | null;
  energyIntensityKwhPerTonne: number | null;
  scope2GasBasis: GasBasis | null;
  /** Shared basis of all fuel factors; null when there are no fuels or bases are mixed/unstated. */
  scope1GasBasis: GasBasis | null;
  label: string;
  isEstimate: boolean;
}

/** Doc 03 "Carbon footprint formulas": S1 = sum(Q x EF) / 1000, S2 = kWh / 1000 x EF_grid. */
export function footprint(input: FootprintInput, options: CalcOptions = {}): FootprintResult {
  const { gridKwh, fuels, outputTonnes, gridFactor } = input;
  assertNonNegative('gridKwh', gridKwh);
  if (outputTonnes != null) assertNonNegative('outputTonnes', outputTonnes);

  let isEstimate = checkFactor(gridFactor, options.allowUnverified);
  const factorIds = [gridFactor.id];

  let scope1Kg = 0;
  for (const fuel of fuels) {
    assertNonNegative(`quantity for ${fuel.factor.id}`, fuel.quantity);
    if (checkFactor(fuel.factor, options.allowUnverified)) isEstimate = true;
    if (!factorIds.includes(fuel.factor.id)) factorIds.push(fuel.factor.id);
    scope1Kg += fuel.quantity * fuel.factor.value;
  }

  const scope1Tonnes = scope1Kg / 1000;
  const scope2Tonnes = (gridKwh / 1000) * gridFactor.value;
  const totalTonnes = scope1Tonnes + scope2Tonnes;
  const hasOutput = outputTonnes != null && outputTonnes > 0;

  const fuelBases = new Set(fuels.map((f) => f.factor.gasBasis));
  const scope1GasBasis = fuelBases.size === 1 ? ([...fuelBases][0] ?? null) : null;
  const scope2GasBasis = gridFactor.gasBasis;

  return {
    scope1Tonnes,
    scope2Tonnes,
    totalTonnes,
    intensityTPerTonne: hasOutput ? totalTonnes / outputTonnes : null,
    energyIntensityKwhPerTonne: hasOutput ? gridKwh / outputTonnes : null,
    scope2GasBasis,
    scope1GasBasis,
    label: footprintLabel(scope2GasBasis, scope1GasBasis, fuels.length > 0),
    factorIds,
    formulaVersion: FORMULA_VERSION,
    isEstimate,
  };
}

export interface Co2TonnesResult extends ResultMeta {
  tonnes: number;
  isEstimate: boolean;
}

/**
 * Tonnes of CO2 (grid) or CO2e (fuels) for an activity amount, e.g. an action's kWh saved.
 * Grid: kWh / 1000 x t CO2 per MWh. Fuel: quantity x kg per unit / 1000. Same arithmetic.
 */
export function co2Tonnes(
  quantity: number,
  factor: Factor,
  options: CalcOptions = {},
): Co2TonnesResult {
  assertNonNegative('quantity', quantity);
  const isEstimate = checkFactor(factor, options.allowUnverified);
  return {
    tonnes: (quantity / 1000) * factor.value,
    isEstimate,
    factorIds: [factor.id],
    formulaVersion: FORMULA_VERSION,
  };
}

function footprintLabel(grid: GasBasis | null, fuel: GasBasis | null, hasFuels: boolean): string {
  const gridPart = `t ${grid ?? '(gas basis not stated)'}`;
  if (!hasFuels) return `${gridPart} (grid)`;
  if (grid !== null && grid === fuel) return `t ${grid}`;
  return `${gridPart} (grid) + t ${fuel ?? '(gas basis mixed or not stated)'} (fuels)`;
}
