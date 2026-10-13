import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../db.js';
import { requireAuth } from '../middleware/auth.js';
import {
  computeMitraPage,
  computeMitraSummary,
  itemView,
  loadMitraItem,
  markDone,
  markStarted,
  parsePage,
} from '../services/mitra.js';
import { loadSite } from '../services/scope.js';

/** D7 Mitra: free NGO and government steps. Every step query is filtered by the caller's org. */
export const mitraRouter = Router();

mitraRouter.get('/sites/:siteId/mitra/summary', requireAuth, async (req, res) => {
  const site = await loadSite(req.auth.orgId, String(req.params.siteId));
  res.json(await computeMitraSummary(site));
});

mitraRouter.get('/sites/:siteId/mitra', requireAuth, async (req, res) => {
  const site = await loadSite(req.auth.orgId, String(req.params.siteId));
  res.json(await computeMitraPage(site, parsePage(req.query.page)));
});

mitraRouter.post('/sites/:siteId/mitra/:code/start', requireAuth, async (req, res) => {
  const site = await loadSite(req.auth.orgId, String(req.params.siteId));
  const item = await loadMitraItem(String(req.params.code));
  const step = await markStarted(site, item);
  res.json(itemView(item, step));
});

mitraRouter.post('/sites/:siteId/mitra/:code/done', requireAuth, async (req, res) => {
  const site = await loadSite(req.auth.orgId, String(req.params.siteId));
  const item = await loadMitraItem(String(req.params.code));
  const step = await markDone(site, item);
  res.json(itemView(item, step));
});

const ProfileBody = z
  .object({ womenOwned: z.boolean().optional(), scStOwned: z.boolean().optional() })
  .strict();

// Owner-entered business profile flags (ZED subsidy line). Only the caller's own org.
mitraRouter.patch('/org/profile', requireAuth, async (req, res) => {
  const body = ProfileBody.parse(req.body ?? {});
  const org = await prisma.organisation.update({
    where: { id: req.auth.orgId },
    data: body,
    select: { womenOwned: true, scStOwned: true },
  });
  res.json({ womenOwned: org.womenOwned === true, scStOwned: org.scStOwned === true });
});
