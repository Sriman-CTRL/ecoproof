import { Router } from 'express';
import { prisma } from '../db.js';
import { requireAuth } from '../middleware/auth.js';
import { loadSite } from '../services/scope.js';

export const sitesRouter = Router();

export const CO2_LABEL = 't CO2 (grid) + t CO2e (fuels)';
const n = (d: { toString(): string } | null | undefined) => (d == null ? null : Number(d));

sitesRouter.get('/sites/:siteId/months', requireAuth, async (req, res) => {
  const { orgId } = req.auth;
  const site = await loadSite(orgId, String(req.params.siteId));
  const [months, results] = await Promise.all([
    prisma.energyMonth.findMany({
      where: { orgId, siteId: site.id },
      orderBy: { periodStart: 'desc' },
    }),
    prisma.result.findMany({ where: { orgId, siteId: site.id } }),
  ]);
  const byMonth = new Map(results.map((r) => [r.month.getTime(), r]));
  res.json(
    months.map((m) => {
      const r = byMonth.get(m.periodStart.getTime());
      const energy = n(m.energyCharges);
      const demand = n(m.demandCharges);
      return {
        month: m.periodStart.toISOString().slice(0, 10),
        rupees: {
          energyCharges: energy,
          demandCharges: demand,
          total: energy == null && demand == null ? null : (energy ?? 0) + (demand ?? 0),
        },
        kwh: n(m.kwh),
        co2: r
          ? { scope2TCo2Grid: n(r.scope2), scope1TCo2eFuels: n(r.scope1), label: CO2_LABEL }
          : null,
        intensity: n(r?.intensity),
        resultId: r?.id ?? null,
      };
    }),
  );
});
