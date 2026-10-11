import { footprint, type Factor } from '@ecoproof/calc';
import type { Factor as FactorRow } from '@prisma/client';
import { prisma } from '../db.js';
import { AppError } from '../errors.js';

export const toCalcFactor = (f: FactorRow): Factor => ({
  id: f.id,
  value: Number(f.value),
  unit: f.unit,
  status: f.status,
  gasBasis: f.gasBasis,
});

/** CALC-1: not superseded, valid on or before the period end (null valid-from counts), latest first. */
export async function factorFor(sourceType: string, periodEnd: Date): Promise<FactorRow> {
  const row = await prisma.factor.findFirst({
    where: {
      sourceType,
      supersededBy: null,
      OR: [{ validFrom: null }, { validFrom: { lte: periodEnd } }],
    },
    orderBy: [{ validFrom: { sort: 'desc', nulls: 'last' } }, { createdAt: 'desc' }],
  });
  if (!row) throw new AppError(500, 'FACTOR_MISSING', `No ${sourceType} factor valid for period`);
  return row;
}

/** Idempotent per site-month. `month` is the ISO first day of the billing period. */
export async function calculateJob(p: {
  siteId: string;
  month: string;
}): Promise<{ resultId: string }> {
  const monthDate = new Date(`${p.month}T00:00:00Z`);
  const site = await prisma.site.findUniqueOrThrow({ where: { id: p.siteId } });
  const existing = await prisma.result.findUnique({
    where: { siteId_month: { siteId: site.id, month: monthDate } },
  });
  if (existing) return { resultId: existing.id };

  const energy = await prisma.energyMonth.findUniqueOrThrow({
    where: { siteId_periodStart: { siteId: site.id, periodStart: monthDate } },
  });
  const production = await prisma.productionMonth.findUnique({
    where: { siteId_month: { siteId: site.id, month: monthDate } },
  });
  const fuels = await prisma.fuelEntry.findMany({
    where: {
      siteId: site.id,
      orgId: site.orgId,
      fuelType: 'diesel',
      date: { gte: energy.periodStart, lte: energy.periodEnd },
    },
  });

  const grid = await factorFor('grid_electricity_india', energy.periodEnd);
  const diesel = await factorFor('diesel_litre', energy.periodEnd);
  const outputTonnes = production ? Number(production.quantity) : null;
  const r = footprint({
    gridKwh: Number(energy.kwh ?? 0),
    fuels: fuels.map((f) => ({ quantity: Number(f.quantity), factor: toCalcFactor(diesel) })),
    outputTonnes,
    gridFactor: toCalcFactor(grid),
  });

  const saved = await prisma.result.create({
    data: {
      orgId: site.orgId,
      siteId: site.id,
      month: monthDate,
      scope1: r.scope1Tonnes,
      scope2: r.scope2Tonnes,
      intensity: r.intensityTPerTonne,
      factorIds: r.factorIds,
      formulaVersion: r.formulaVersion,
      inputIds: [energy.id, ...(production ? [production.id] : []), ...fuels.map((f) => f.id)],
    },
  });
  return { resultId: saved.id };
}
