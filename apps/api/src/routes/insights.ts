import { Router } from 'express';
import { z } from 'zod';
import { rankActions, simplePaybackYears } from '@ecoproof/calc';
import { prisma } from '../db.js';
import { AppError, notFound } from '../errors.js';
import { requireAuth } from '../middleware/auth.js';
import { ACTION_CODE, computeInsights, resolveMonth, type Finding } from '../services/insights.js';
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

const BILL_DERIVED = new Set(Object.values(ACTION_CODE));

insightsRouter.get('/sites/:siteId/actions', requireAuth, async (req, res) => {
  const { orgId } = req.auth;
  const site = await loadSite(orgId, String(req.params.siteId));
  const q = Query.parse(req.query);
  const month = await resolveMonth(orgId, site.id, q.month);
  const [insights, org, planned] = await Promise.all([
    computeInsights(site, month, q.shiftableKwh ?? null),
    prisma.organisation.findFirst({ where: { id: orgId }, select: { sector: true } }),
    prisma.siteAction.findMany({ where: { orgId, siteId: site.id } }),
  ]);
  const library = await prisma.actionLibrary.findMany({ where: { sector: org?.sector ?? '' } });
  const byAction = new Map<string, Finding>();
  for (const f of insights.findings) byAction.set(ACTION_CODE[f.code], f);

  const items = library.flatMap((a) => {
    const finding = byAction.get(a.code);
    // Bill-derived actions exist only while their finding is flagged.
    if (BILL_DERIVED.has(a.code) && !finding) return [];
    const monthly = finding?.inrPerMonth ?? null;
    const costLow = a.isZeroCost ? 0 : n(a.costLow);
    const costHigh = a.isZeroCost ? 0 : n(a.costHigh);
    const annualInrMid = monthly == null ? null : monthly * 12;
    const payback =
      costLow == null || costHigh == null || annualInrMid == null
        ? null
        : simplePaybackYears({
            capexInr: (costLow + costHigh) / 2,
            annualSavingInrMid: annualInrMid,
          });
    const site_action = planned.find((p) => p.actionId === a.id);
    return [
      {
        code: a.code,
        title: a.equipment,
        isZeroCost: a.isZeroCost,
        inrPerMonthLow: monthly,
        inrPerMonthHigh: monthly,
        annualInrMid,
        costLow,
        costHigh,
        paybackYears: payback,
        // kVAh, demand and billing fixes save rupees, not kWh, so there is no CO2 figure.
        co2TonnesPerYear: null as number | null,
        co2Note: finding
          ? 'This fix saves rupees on the bill, not kWh, so no CO2 saving is claimed.'
          : null,
        source: finding ? `${finding.rule.line}; ${a.source}` : a.source,
        finding: finding?.code ?? null,
        status: site_action?.status ?? 'suggested',
        co2SavedTonnes: 0,
      },
    ];
  });
  // co2SavedTonnes only feeds the ranking; no CO2 saving is claimed for bill-derived fixes.
  const ranked = rankActions(items).map((a) => {
    const out: Partial<typeof a> = { ...a };
    delete out.co2SavedTonnes;
    return out;
  });
  res.json({
    month: insights.month,
    total: ranked.length,
    actions: q.all ? ranked : ranked.slice(0, 3),
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
