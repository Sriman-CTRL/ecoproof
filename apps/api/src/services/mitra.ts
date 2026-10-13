import type { MitraItem, MitraStep, Site } from '@prisma/client';
import { prisma } from '../db.js';
import { AppError, notFound } from '../errors.js';
import { computeCarbon } from './carbon.js';
import { computeSchemes, type ZedCard } from './schemes.js';

/**
 * D7 Mitra: free (₹0) NGO and government steps. Items are global reference rows; steps are
 * org-scoped and never seeded (no fake history with real bodies). EcoProof is not part of any of
 * these programmes and sends nothing to them.
 */
export const MITRA_PAGES = ['ngo', 'govt'] as const;
export type MitraPage = (typeof MITRA_PAGES)[number];
export const MITRA_STATUSES = ['not_started', 'started', 'done_self', 'confirmed'] as const;
export type MitraStatus = (typeof MITRA_STATUSES)[number];

/** The line at the bottom of each Mitra page and on every Mitra document. */
export const NOT_PART_LINE =
  'These are public programmes. EcoProof is not part of them; you contact them yourself.';

/** Next-step order: quick links and the pledge first, then hand-offs, then visits, then reading. */
const KIND_ORDER: Record<string, number> = {
  commitment: 0,
  link: 0,
  handoff: 1,
  visit: 2,
  learn: 3,
};
const DONE = new Set<string>(['done_self', 'confirmed']);
const DAY_MS = 24 * 60 * 60 * 1000;

export const onPage = (item: Pick<MitraItem, 'page'>, page: MitraPage) =>
  item.page === page || item.page === 'both';

/** The page a Home link opens for an item ("both" items open on Govt Mitra). */
export const homePage = (item: Pick<MitraItem, 'page'>): MitraPage =>
  item.page === 'ngo' ? 'ngo' : 'govt';

/**
 * Follow-up nudge for a step left "started": shown for a week from day 7, then again as the
 * 1, 3 and 6-month check-ins (day 30, 90, 180). Never more often (nudge cap, plan 6.3).
 */
export function followUpDue(startedAt: Date, now: Date): boolean {
  const days = Math.floor((now.getTime() - startedAt.getTime()) / DAY_MS);
  return [7, 30, 90, 180].some((d) => days >= d && days < d + 7);
}

export function orderItems<T extends Pick<MitraItem, 'kind' | 'sortOrder'>>(items: T[]): T[] {
  return [...items].sort(
    (a, b) => (KIND_ORDER[a.kind] ?? 9) - (KIND_ORDER[b.kind] ?? 9) || a.sortOrder - b.sortOrder,
  );
}

export async function loadMitraItem(code: string): Promise<MitraItem> {
  const item = await prisma.mitraItem.findUnique({ where: { code } });
  if (!item) throw notFound('Mitra step');
  return item;
}

async function loadSteps(site: Site): Promise<Map<string, MitraStep>> {
  const steps = await prisma.mitraStep.findMany({
    where: { orgId: site.orgId, siteId: site.id },
  });
  return new Map(steps.map((s) => [s.itemCode, s]));
}

export async function loadStep(site: Site, code: string): Promise<MitraStep | null> {
  return prisma.mitraStep.findFirst({
    where: { orgId: site.orgId, siteId: site.id, itemCode: code },
  });
}

const statusOf = (s: MitraStep | undefined | null): MitraStatus =>
  (s?.status as MitraStatus | undefined) ?? 'not_started';

export interface Commitment {
  /** Latest 12-month total, t CO2 (grid) + t CO2e (fuels). */
  baselineT: number;
  halfT: number;
  targetYear: number;
  periodFrom: string;
  periodTo: string;
  label: string;
  madeAt: string | null;
}

/** SME Climate Commitment numbers from the unit's own bills (null without bills). */
export async function computeCommitment(
  site: Site,
  step: MitraStep | null | undefined,
): Promise<Commitment | null> {
  const carbon = await computeCarbon(site).catch((e: unknown) => {
    if (e instanceof AppError && e.status === 404) return null;
    throw e;
  });
  if (!carbon || carbon.months.length === 0) return null;
  const baselineT = Math.round(carbon.months.reduce((t, m) => t + m.totalT, 0) * 100) / 100;
  const status = statusOf(step);
  return {
    baselineT,
    halfT: baselineT / 2,
    targetYear: Number(carbon.latestMonth.month.slice(0, 4)) + 10,
    periodFrom: carbon.months[0]!.month,
    periodTo: carbon.latestMonth.month,
    label: carbon.label,
    madeAt: status === 'not_started' ? null : (step?.updatedAt.toISOString() ?? null),
  };
}

export function itemView(item: MitraItem, step: MitraStep | undefined | null) {
  return {
    code: item.code,
    page: item.page,
    kind: item.kind,
    title: item.title,
    runBy: item.runBy,
    freeHelp: item.freeHelp,
    businessGain: item.businessGain,
    carbonLine: item.carbonLine,
    howToStart: item.howToStart,
    url: item.url,
    contactEmail: item.contactEmail,
    contactPhone: item.contactPhone,
    address: item.address,
    sourceUrl: item.sourceUrl,
    lastChecked: item.lastChecked.toISOString().slice(0, 10),
    datesUnconfirmed: item.datesUnconfirmed,
    status: statusOf(step),
    startedAt: step?.startedAt?.toISOString() ?? null,
    updatedAt: step?.updatedAt.toISOString() ?? null,
    hasProof: !!step?.proofFileKey,
    proofType: step?.proofType ?? null,
    eventDate: step?.eventDate?.toISOString().slice(0, 10) ?? null,
    packReportId: step?.packReportId ?? null,
    certificateReportId: step?.certificateReportId ?? null,
  };
}
export type MitraItemView = ReturnType<typeof itemView>;

function pageCounts(items: MitraItem[], steps: Map<string, MitraStep>, page: MitraPage) {
  const list = orderItems(items.filter((i) => onPage(i, page)));
  const next = list.find((i) => !DONE.has(statusOf(steps.get(i.code))));
  return {
    list,
    doneCount: list.filter((i) => DONE.has(statusOf(steps.get(i.code)))).length,
    totalCount: list.length,
    next: next ? { code: next.code, title: next.title, kind: next.kind } : null,
  };
}

export interface MitraPageView {
  page: MitraPage;
  nextStep: { code: string; title: string; kind: string } | null;
  items: MitraItemView[];
  doneCount: number;
  totalCount: number;
  commitment: Commitment | null;
  zed: ZedCard | null;
  peerCases: Awaited<ReturnType<typeof listPeerCases>>;
  notPartLine: string;
}

export async function listPeerCases(actionCode?: string) {
  const rows = await prisma.peerCase.findMany({
    where: actionCode ? { actionCode } : {},
    orderBy: { sortOrder: 'asc' },
  });
  return rows.map((p) => ({
    code: p.code,
    company: p.company,
    place: p.place,
    actionCode: p.actionCode,
    measure: p.measure,
    investmentText: p.investmentText,
    savingText: p.savingText,
    paybackText: p.paybackText,
    beforeAfterText: p.beforeAfterText,
    source: p.source,
    sourceUrl: p.sourceUrl,
    page: p.page,
    quotedLine: p.quotedLine,
  }));
}

export async function computeMitraPage(site: Site, page: MitraPage): Promise<MitraPageView> {
  const [items, steps] = await Promise.all([
    prisma.mitraItem.findMany({ orderBy: { sortOrder: 'asc' } }),
    loadSteps(site),
  ]);
  const c = pageCounts(items, steps, page);
  const hasCommitment = c.list.some((i) => i.kind === 'commitment');
  const hasZed = c.list.some((i) => i.code === 'zed_pledge');
  const [commitment, schemes, peerCases] = await Promise.all([
    hasCommitment
      ? computeCommitment(site, steps.get('sme_climate_commitment'))
      : Promise.resolve(null),
    hasZed ? computeSchemes(site) : Promise.resolve(null),
    c.list.some((i) => i.kind === 'learn') ? listPeerCases() : Promise.resolve([]),
  ]);
  return {
    page,
    nextStep: c.next,
    items: c.list.map((i) => itemView(i, steps.get(i.code))),
    doneCount: c.doneCount,
    totalCount: c.totalCount,
    commitment,
    zed: schemes?.zed ?? null,
    peerCases,
    notPartLine: NOT_PART_LINE,
  };
}

export async function computeMitraSummary(site: Site, now = new Date()) {
  const [items, steps] = await Promise.all([
    prisma.mitraItem.findMany({ orderBy: { sortOrder: 'asc' } }),
    loadSteps(site),
  ]);
  const view = (page: MitraPage) => {
    const { doneCount, totalCount, next } = pageCounts(items, steps, page);
    return { done: doneCount, total: totalCount, next };
  };
  const byCode = new Map(items.map((i) => [i.code, i]));
  const due = [...steps.values()]
    .filter((s) => s.status === 'started' && s.startedAt && followUpDue(s.startedAt, now))
    .sort((a, b) => a.startedAt!.getTime() - b.startedAt!.getTime())[0];
  const dueItem = due ? byCode.get(due.itemCode) : undefined;
  const nextOverall = orderItems(items).find((i) => !DONE.has(statusOf(steps.get(i.code))));
  return {
    ngo: view('ngo'),
    govt: view('govt'),
    next: nextOverall
      ? { code: nextOverall.code, title: nextOverall.title, page: homePage(nextOverall) }
      : null,
    followUp: dueItem
      ? {
          code: dueItem.code,
          title: dueItem.title,
          runBy: dueItem.runBy,
          page: homePage(dueItem),
        }
      : null,
  };
}

/** started: from not_started only (never downgrades a done or confirmed step). */
export async function markStarted(site: Site, item: MitraItem): Promise<MitraStep> {
  const step = await loadStep(site, item.code);
  if (step && step.status !== 'not_started') return step;
  const now = new Date();
  return prisma.mitraStep.upsert({
    where: {
      orgId_siteId_itemCode: { orgId: site.orgId, siteId: site.id, itemCode: item.code },
    },
    update: { status: 'started', startedAt: now },
    create: {
      orgId: site.orgId,
      siteId: site.id,
      itemCode: item.code,
      status: 'started',
      startedAt: now,
    },
  });
}

/** done_self: the owner says they did it (badge only, no Certificate of Participation). */
export async function markDone(site: Site, item: MitraItem): Promise<MitraStep> {
  const step = await loadStep(site, item.code);
  if (step?.status === 'confirmed') return step;
  const now = new Date();
  return prisma.mitraStep.upsert({
    where: {
      orgId_siteId_itemCode: { orgId: site.orgId, siteId: site.id, itemCode: item.code },
    },
    update: { status: 'done_self', startedAt: step?.startedAt ?? now },
    create: {
      orgId: site.orgId,
      siteId: site.id,
      itemCode: item.code,
      status: 'done_self',
      startedAt: now,
    },
  });
}

export function parsePage(v: unknown): MitraPage {
  if (v === 'ngo' || v === 'govt') return v;
  throw new AppError(400, 'VALIDATION', 'page must be ngo or govt');
}
