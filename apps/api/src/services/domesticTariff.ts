import type { DomesticTariff } from '@ecoproof/calc';
import { prisma } from '../db.js';

/** The tariff order household bills are priced at (R9). Older domestic rows would keep their own version. */
export const DOMESTIC_TARIFF_VERSION = 'TGERC-RST-FY2026-27';
export const DOMESTIC_PRICING_LABEL = 'priced at FY 2026-27 LT-I rates (synthetic bills)';
export const FSA_DUTY_NOTE = 'Excludes fuel surcharge (FSA) and electricity duty';

const RULES = [
  'domestic_slab_groups',
  'domestic_energy_charge',
  'domestic_fixed_charge',
  'domestic_customer_charge',
  'domestic_net_metering',
] as const;

type Up = number | null;
interface Band {
  up_to_units: Up;
  rate_inr_per_kwh: number;
}

export interface DomesticTariffSource {
  ruleType: string;
  ruleId: string;
  source: string;
  url: string | null;
  page: string | null;
  quotedLine: string | null;
}

/** Builds the pure calc tariff from the stored tariff_rules rows; ids and quotes travel with it. */
export async function loadDomesticTariff(): Promise<{
  tariff: DomesticTariff;
  ruleIds: string[];
  sources: DomesticTariffSource[];
}> {
  const rows = await prisma.tariffRule.findMany({
    where: {
      discom: 'TGSPDCL',
      category: 'LT-I',
      version: DOMESTIC_TARIFF_VERSION,
      ruleType: { in: [...RULES] },
    },
  });
  const by = new Map(rows.map((r) => [r.ruleType, r]));
  const p = (t: string) => {
    const row = by.get(t);
    if (!row) throw new Error(`tariff_rules row ${t} missing: run pnpm db:seed`);
    return row.paramsJson as Record<string, unknown>;
  };
  const groups = (p('domestic_slab_groups').groups as { id: string; up_to_units: Up }[]).map(
    (g) => ({
      id: g.id,
      upToUnits: g.up_to_units,
      bands: (p('domestic_energy_charge').bands_by_group as Record<string, Band[]>)[g.id]!.map(
        (b) => ({ upToUnits: b.up_to_units, rateInrPerKwh: b.rate_inr_per_kwh }),
      ),
    }),
  );
  const fx = p('domestic_fixed_charge');
  // The stored rule says, in the order's words, what the bill nets; only import - export is known.
  const billedUnits = p('domestic_net_metering').billed_units;
  if (billedUnits !== 'import - export for the month') {
    throw new Error(
      `tariff_rules domestic_net_metering: unsupported billed_units ${String(billedUnits)}`,
    );
  }
  const customer = (
    p('domestic_customer_charge').bands as { up_to_units: Up; inr_per_month: number }[]
  ).map((b) => ({ upToUnits: b.up_to_units, inrPerMonth: b.inr_per_month }));
  return {
    tariff: {
      groups,
      fixed: {
        rateInrPerKw: fx.rate_inr_per_kw_month as number,
        aboveUnits: fx.above_units as number,
        rateAboveInrPerKw: fx.rate_above_inr_per_kw_month as number,
      },
      customer,
      netMetering: { billedOn: 'import_minus_export' },
    },
    ruleIds: rows.map((r) => r.id).sort(),
    sources: RULES.map((t) => by.get(t)!).map((r) => ({
      ruleType: r.ruleType,
      ruleId: r.id,
      source: r.source,
      url: r.sourceUrl,
      page: r.page,
      quotedLine: r.quotedLine,
    })),
  };
}

/** Rupee parts stored on a household energy_months row (otherChargesJson). */
export interface HouseholdBillParts {
  energyInr: number;
  fixedInr: number;
  customerInr: number;
  totalInr: number;
}

export function billParts(other: unknown): HouseholdBillParts | null {
  const o = other as { bill?: HouseholdBillParts } | null;
  return o?.bill && typeof o.bill.totalInr === 'number' ? o.bill : null;
}
