import { assertNonNegative, InvalidInputError } from './errors';
import { FORMULA_VERSION } from './types';

/** One energy-charge band inside a slab group. `upToUnits` null = no upper limit. */
export interface DomesticBand {
  upToUnits: number | null;
  rateInrPerKwh: number;
}

/** TGSPDCL LT-I domestic tariff, assembled by the caller from tariff_rules rows (R9). */
export interface DomesticTariff {
  /** Slab groups in order. A home is in the first group whose `upToUnits` covers its units. */
  groups: { id: string; upToUnits: number | null; bands: DomesticBand[] }[];
  /** Fixed charge Rs per kW per month; `aboveUnits` switches to `rateAboveInrPerKw`. */
  fixed: { rateInrPerKw: number; aboveUnits: number; rateAboveInrPerKw: number };
  /** Customer charge by the home's total monthly units. */
  customer: { upToUnits: number | null; inrPerMonth: number }[];
  /** How a net-metered home's billed units are found (tariff_rules `domestic_net_metering`). */
  netMetering: { billedOn: NetMeteringBasis };
}

/** The only basis the FY 2026-27 order gives (para 3.30.4): import minus export for the month. */
export type NetMeteringBasis = 'import_minus_export';

export interface DomesticBillInput {
  /** Billed units for the month. For a net-metered home: max(import - export, 0). */
  units: number;
  sanctionedLoadKw: number;
  tariff: DomesticTariff;
}

export interface DomesticBillLine {
  kind: 'energy' | 'fixed' | 'customer';
  label: string;
  units: number | null;
  rateInr: number | null;
  inr: number;
}

export interface DomesticBillResult {
  group: string;
  energyInr: number;
  fixedInr: number;
  customerInr: number;
  totalInr: number;
  lines: DomesticBillLine[];
  formulaVersion: typeof FORMULA_VERSION;
}

const r2 = (x: number) => Math.round(x * 100) / 100;

/**
 * Monthly LT-I domestic bill before FSA and electricity duty (R9). Slabs apply telescopically
 * within the group: each rate only to the units inside its band. Telescopic reading is inferred
 * from the order's table layout (OPEN_ITEMS). Fixed charge = rate x sanctioned load.
 */
export function domesticBill(input: DomesticBillInput): DomesticBillResult {
  const { units, sanctionedLoadKw, tariff } = input;
  assertNonNegative('units', units);
  assertNonNegative('sanctionedLoadKw', sanctionedLoadKw);
  const group = tariff.groups.find((g) => g.upToUnits == null || units <= g.upToUnits);
  if (!group) throw new InvalidInputError('tariff has no slab group for these units');

  const lines: DomesticBillLine[] = [];
  let from = 0;
  for (const band of group.bands) {
    const top = band.upToUnits ?? Infinity;
    const inBand = Math.max(Math.min(units, top) - from, 0);
    if (inBand > 0) {
      lines.push({
        kind: 'energy',
        label: `${group.id} energy`,
        units: inBand,
        rateInr: band.rateInrPerKwh,
        inr: r2(inBand * band.rateInrPerKwh),
      });
    }
    from = top;
  }
  const energyInr = r2(lines.reduce((t, l) => t + l.inr, 0));

  const f = tariff.fixed;
  const fixedRate = units > f.aboveUnits ? f.rateAboveInrPerKw : f.rateInrPerKw;
  const fixedInr = r2(fixedRate * sanctionedLoadKw);
  lines.push({
    kind: 'fixed',
    label: 'Fixed charge',
    units: sanctionedLoadKw,
    rateInr: fixedRate,
    inr: fixedInr,
  });

  const band = tariff.customer.find((c) => c.upToUnits == null || units <= c.upToUnits);
  if (!band) throw new InvalidInputError('tariff has no customer charge for these units');
  const customerInr = band.inrPerMonth;
  lines.push({
    kind: 'customer',
    label: 'Customer charge',
    units: null,
    rateInr: null,
    inr: customerInr,
  });

  return {
    group: group.id,
    energyInr,
    fixedInr,
    customerInr,
    totalInr: r2(energyInr + fixedInr + customerInr),
    lines,
    formulaVersion: FORMULA_VERSION,
  };
}

/**
 * Billed units for a net-metered home, by the stored net-metering rule (R9, TGERC order para
 * 3.30.4): import minus export, floor 0. Excess export is not valued (rate not in the order).
 */
export function netBilledUnits(
  importKwh: number,
  exportKwh: number | null,
  rule: DomesticTariff['netMetering'],
): number {
  if (rule.billedOn !== 'import_minus_export') {
    throw new InvalidInputError(`Unsupported net-metering basis: ${String(rule.billedOn)}`);
  }
  return Math.max(importKwh - (exportKwh ?? 0), 0);
}
