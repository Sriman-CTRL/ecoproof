import { Router } from 'express';
import { prisma } from '../db.js';
import { requireAuth } from '../middleware/auth.js';
import { billParts } from '../services/domesticTariff.js';
import { computeProgress } from '../services/progress.js';
import { computeSavings } from '../services/savings.js';
import { computeSchemes } from '../services/schemes.js';
import { computeSolarPlan, computeSolarResults } from '../services/solar.js';
import { loadSite } from '../services/scope.js';

export const sitesRouter = Router();

export const CO2_LABEL = 't CO2 (grid) + t CO2e (fuels)';
const n = (d: { toString(): string } | null | undefined) => (d == null ? null : Number(d));

// Progress path, milestones, headroom and the monthly ritual (plan 6.1/6.2, Doc 04).
sitesRouter.get('/sites/:siteId/progress', requireAuth, async (req, res) => {
  const site = await loadSite(req.auth.orgId, String(req.params.siteId));
  res.json(await computeProgress(site));
});

// Verified savings (VER-1): baseline fit, ledger months, totals. Read from stored rows.
sitesRouter.get('/sites/:siteId/savings', requireAuth, async (req, res) => {
  const site = await loadSite(req.auth.orgId, String(req.params.siteId));
  res.json(await computeSavings(site));
});

// Scheme matcher (FIN-1), ZED readiness card and the money found counter (plan 6.2).
sitesRouter.get('/sites/:siteId/schemes', requireAuth, async (req, res) => {
  const site = await loadSite(req.auth.orgId, String(req.params.siteId));
  res.json(await computeSchemes(site));
});

// Household rooftop solar plan and PM Surya Ghar subsidy (HH-1); 404 for MSMEs.
sitesRouter.get('/sites/:siteId/solar-plan', requireAuth, async (req, res) => {
  const site = await loadSite(req.auth.orgId, String(req.params.siteId));
  res.json(await computeSolarPlan(site));
});

// Household net-metering bills after installation: import, export, saved vs last year (HH-1).
sitesRouter.get('/sites/:siteId/solar-results', requireAuth, async (req, res) => {
  const site = await loadSite(req.auth.orgId, String(req.params.siteId));
  res.json(await computeSolarResults(site));
});

sitesRouter.get('/sites/:siteId/months', requireAuth, async (req, res) => {
  const { orgId } = req.auth;
  const site = await loadSite(orgId, String(req.params.siteId));
  const [org, months, results] = await Promise.all([
    prisma.organisation.findFirst({ where: { id: orgId }, select: { type: true } }),
    prisma.energyMonth.findMany({
      where: { orgId, siteId: site.id },
      orderBy: { periodStart: 'desc' },
    }),
    prisma.result.findMany({ where: { orgId, siteId: site.id } }),
  ]);
  const byMonth = new Map(results.map((r) => [r.month.getTime(), r]));
  const household = org?.type === 'household';
  res.json(
    months.map((m) => {
      const r = byMonth.get(m.periodStart.getTime());
      const energy = n(m.energyCharges);
      const demand = n(m.demandCharges);
      // Households: the whole LT-I bill (energy + fixed + customer charge), before FSA and duty.
      const hhTotal = household ? (billParts(m.otherChargesJson)?.totalInr ?? null) : null;
      return {
        month: m.periodStart.toISOString().slice(0, 10),
        rupees: {
          energyCharges: energy,
          demandCharges: demand,
          total:
            hhTotal ?? (energy == null && demand == null ? null : (energy ?? 0) + (demand ?? 0)),
        },
        kwh: n(m.kwh),
        co2: r
          ? {
              scope2TCo2Grid: n(r.scope2),
              scope1TCo2eFuels: n(r.scope1),
              label: household ? 't CO2 (grid)' : CO2_LABEL,
            }
          : null,
        resultId: r?.id ?? null,
        // Households: no per-tonne intensity (no production); net-metering export instead.
        ...(household
          ? {
              exportKwh: n(m.exportKwh),
              // Units the DISCOM bills: import minus export, never below zero (TGERC para 3.30.4).
              billedKwh: Math.max((n(m.kwh) ?? 0) - (n(m.exportKwh) ?? 0), 0),
              solarInstalledKwp: n(m.solarInstalledKwp),
            }
          : { intensity: n(r?.intensity) }),
      };
    }),
  );
});
