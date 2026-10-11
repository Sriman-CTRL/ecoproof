import { Router } from 'express';
import { prisma } from '../db.js';
import { notFound } from '../errors.js';
import { requireAuth } from '../middleware/auth.js';

export const resultsRouter = Router();

const FORMULA_TEXT = {
  scope2: 'Scope 2 (t CO2, grid) = grid kWh / 1000 x grid factor (t CO2 per MWh)',
  scope1: 'Scope 1 (t CO2e, fuels) = sum(litres x fuel factor kg CO2e per litre) / 1000',
  intensity: 'Intensity (t CO2e per tonne) = (Scope 1 + Scope 2) / tonnes of output',
};

resultsRouter.get('/results/:id/explain', requireAuth, async (req, res) => {
  const { orgId } = req.auth;
  const r = await prisma.result.findFirst({ where: { id: String(req.params.id), orgId } });
  if (!r) throw notFound('Result');

  const factors = await prisma.factor.findMany({ where: { id: { in: r.factorIds } } });
  const [energy, production, fuels] = await Promise.all([
    prisma.energyMonth.findMany({ where: { id: { in: r.inputIds }, orgId } }),
    prisma.productionMonth.findMany({ where: { id: { in: r.inputIds }, orgId } }),
    prisma.fuelEntry.findMany({ where: { id: { in: r.inputIds }, orgId } }),
  ]);
  res.json({
    resultId: r.id,
    month: r.month.toISOString().slice(0, 10),
    factors: factors.map((f) => ({
      id: f.id,
      sourceType: f.sourceType,
      value: Number(f.value),
      unit: f.unit,
      version: f.version,
      source: f.source,
      status: f.status,
      gasBasis: f.gasBasis,
    })),
    inputs: [
      ...energy.map((e) => ({ kind: 'kwh', value: Number(e.kwh), qualityTag: e.qualityTag })),
      ...fuels.map((f) => ({
        kind: 'litres',
        value: Number(f.quantity),
        qualityTag: f.qualityTag,
      })),
      ...production.map((p) => ({
        kind: 'tonnes',
        value: Number(p.quantity),
        qualityTag: p.qualityTag,
      })),
    ],
    formula: FORMULA_TEXT,
    formulaVersion: r.formulaVersion,
  });
});
