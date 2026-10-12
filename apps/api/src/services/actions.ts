import { rankActions, simplePaybackYears } from '@ecoproof/calc';
import type { Site } from '@prisma/client';
import { prisma } from '../db.js';
import { ACTION_CODE, computeInsights, type Finding, type Insights } from './insights.js';

const n = (d: { toString(): string } | null | undefined) => (d == null ? null : Number(d));

const BILL_DERIVED = new Set(Object.values(ACTION_CODE));

export interface ActionItem {
  code: string;
  title: string;
  isZeroCost: boolean;
  inrPerMonthLow: number | null;
  inrPerMonthHigh: number | null;
  annualInrMid: number | null;
  costLow: number | null;
  costHigh: number | null;
  paybackYears: number | null;
  co2TonnesPerYear: number | null;
  co2Note: string | null;
  source: string;
  finding: string | null;
  status: string;
  /** Library end use: only "electricity" savings that cut kWh can claim CO2. */
  enduse: string;
}

/** Ranked action plan for a site and bill month (same numbers as GET /sites/:id/actions). */
export async function listActions(
  site: Site,
  month: Date,
  shiftableKwh: number | null,
): Promise<{ insights: Insights; actions: ActionItem[] }> {
  const orgId = site.orgId;
  const [insights, org, planned] = await Promise.all([
    computeInsights(site, month, shiftableKwh),
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
    const siteAction = planned.find((p) => p.actionId === a.id);
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
        status: siteAction?.status ?? 'suggested',
        enduse: a.enduse as string,
        co2SavedTonnes: 0,
      },
    ];
  });
  // co2SavedTonnes only feeds the ranking; no CO2 saving is claimed for bill-derived fixes.
  const actions = rankActions(items).map((a) => {
    const out: Partial<typeof a> = { ...a };
    delete out.co2SavedTonnes;
    return out as ActionItem;
  });
  return { insights, actions };
}
