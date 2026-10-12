import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../db.js';
import { AppError, notFound } from '../errors.js';
import { requireAuth } from '../middleware/auth.js';
import { listActions } from '../services/actions.js';
import { computeInsights, resolveMonth } from '../services/insights.js';
import { loadSite } from '../services/scope.js';

export const insightsRouter = Router();

const Query = z.object({
  month: z.string().optional(),
  shiftableKwh: z.coerce.number().nonnegative().optional(),
  all: z.enum(['1', 'true']).optional(),
});

const n = (d: { toString(): string } | null | undefined) => (d == null ? null : Number(d));

insightsRouter.get('/sites/:siteId/insights', requireAuth, async (req, res) => {
  const { orgId } = req.auth;
  const site = await loadSite(orgId, String(req.params.siteId));
  const q = Query.parse(req.query);
  const month = await resolveMonth(orgId, site.id, q.month);
  res.json(await computeInsights(site, month, q.shiftableKwh ?? null));
});

insightsRouter.get('/sites/:siteId/actions', requireAuth, async (req, res) => {
  const { orgId } = req.auth;
  const site = await loadSite(orgId, String(req.params.siteId));
  const q = Query.parse(req.query);
  const month = await resolveMonth(orgId, site.id, q.month);
  const { insights, actions } = await listActions(site, month, q.shiftableKwh ?? null);
  res.json({
    month: insights.month,
    total: actions.length,
    actions: q.all ? actions : actions.slice(0, 3),
  });
});

const PlanBody = z.object({
  status: z.enum(['planned', 'in_progress', 'done']),
  doneAt: z.iso.datetime().optional(),
  actualCost: z.number().nonnegative().optional(),
});

insightsRouter.post('/sites/:siteId/actions/:code/plan', requireAuth, async (req, res) => {
  const { orgId } = req.auth;
  const site = await loadSite(orgId, String(req.params.siteId));
  const body = PlanBody.parse(req.body);
  const action = await prisma.actionLibrary.findUnique({
    where: { code: String(req.params.code) },
  });
  if (!action) throw notFound('Action');
  if (body.status !== 'done' && (body.doneAt || body.actualCost != null)) {
    throw new AppError(400, 'VALIDATION', 'doneAt and actualCost only apply to "done"');
  }
  const data = {
    status: body.status,
    ...(body.status === 'planned' ? { plannedAt: new Date() } : {}),
    ...(body.status === 'done'
      ? { doneAt: body.doneAt ? new Date(body.doneAt) : new Date(), actualCost: body.actualCost }
      : {}),
  };
  const existing = await prisma.siteAction.findFirst({
    where: { orgId, siteId: site.id, actionId: action.id },
  });
  const saved = existing
    ? await prisma.siteAction.update({ where: { id: existing.id }, data })
    : await prisma.siteAction.create({
        data: { orgId, siteId: site.id, actionId: action.id, plannedAt: new Date(), ...data },
      });
  res.json({
    code: action.code,
    status: saved.status,
    plannedAt: saved.plannedAt,
    doneAt: saved.doneAt,
    actualCost: n(saved.actualCost),
  });
});
