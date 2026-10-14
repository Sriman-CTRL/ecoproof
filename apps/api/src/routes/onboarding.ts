import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { readPdfMeta, pdfFlags } from '@ecoproof/calc';
import { POWER_BILL_FIELD_NAMES, PowerBillFields } from '@ecoproof/shared';
import { Prisma, type EnergyMonth } from '@prisma/client';
import { Router } from 'express';
import multer from 'multer';
import { z } from 'zod';
import { storage } from '../adapters/storage.js';
import { prisma } from '../db.js';
import { DEMO_ORG_IDS } from '../demo/ids.js';
import { AppError, notFound } from '../errors.js';
import { requireAuth, requireConsent } from '../middleware/auth.js';
import {
  businessCheckView,
  consumerNoTaken,
  documentChecks,
  levelOf,
  readUdyamCertificate,
  typedChecks,
  type BusinessCheckItem,
} from '../services/businessCheck.js';
import {
  billChecks,
  checkContext,
  fileInfo,
  fromMonth,
  METHOD_NOTE,
  SOURCE_TEXT,
  STRENGTH_TEXT,
  strengthOf,
  yearStrip,
  type SourceKind,
} from '../services/dataChecks.js';
import { loadSite } from '../services/scope.js';

export const onboardingRouter = Router();

const iso = (d: Date) => d.toISOString().slice(0, 10);
const sha256 = (b: Buffer | string) => createHash('sha256').update(b).digest('hex');
const num = (d: { toString(): string } | null | undefined) => (d == null ? null : Number(d));

// ------------------------------------------------------------------ wizard state

const OnboardingState = z.object({
  step: z.number().int().min(1).max(5).optional(),
  documentId: z.string().uuid().nullable().optional(),
  dieselLitres: z.number().nonnegative().nullable().optional(),
  productionTonnes: z.number().nonnegative().nullable().optional(),
  sample: z.record(z.string(), z.boolean()).optional(),
});
type OnboardingState = z.infer<typeof OnboardingState>;

async function loadOrg(orgId: string) {
  const org = await prisma.organisation.findFirst({ where: { id: orgId } });
  if (!org) throw notFound('Organisation');
  return org;
}

onboardingRouter.get('/sites/:siteId/onboarding', requireAuth, async (req, res) => {
  const { orgId } = req.auth;
  const site = await loadSite(orgId, String(req.params.siteId));
  const org = await loadOrg(orgId);
  const [business, diesel, production] = await Promise.all([
    businessCheckView(org, site),
    prisma.fuelEntry.findFirst({
      where: { orgId, siteId: site.id, fuelType: 'diesel' },
      orderBy: { date: 'desc' },
    }),
    prisma.productionMonth.findFirst({
      where: { orgId, siteId: site.id },
      orderBy: { month: 'desc' },
    }),
  ]);
  res.json({
    done: org.onboardingDoneAt != null,
    state: (org.onboardingJson ?? {}) as OnboardingState,
    business,
    // "Fill with sample data": the unit's own latest values from the DB (SYNTHETIC for demos).
    samples: {
      isDemo: DEMO_ORG_IDS.includes(orgId),
      dieselLitres: num(diesel?.quantity),
      dieselMonth: diesel ? iso(diesel.date) : null,
      productionTonnes: num(production?.quantity),
      productionMonth: production ? iso(production.month) : null,
    },
  });
});

onboardingRouter.put('/sites/:siteId/onboarding', requireAuth, async (req, res) => {
  const { orgId } = req.auth;
  await loadSite(orgId, String(req.params.siteId));
  const body = OnboardingState.parse(req.body);
  const org = await loadOrg(orgId);
  const prev = (org.onboardingJson ?? {}) as OnboardingState;
  const next = { ...prev, ...body, sample: { ...prev.sample, ...body.sample } };
  await prisma.organisation.update({
    where: { id: org.id },
    data: { onboardingJson: next as Prisma.InputJsonValue },
  });
  res.json({ state: next });
});

onboardingRouter.post('/sites/:siteId/onboarding/finish', requireAuth, async (req, res) => {
  const { orgId } = req.auth;
  await loadSite(orgId, String(req.params.siteId));
  await prisma.organisation.update({
    where: { id: orgId },
    data: { onboardingDoneAt: new Date() },
  });
  res.json({ done: true });
});

// ------------------------------------------------------------------ step 1: business check

const BusinessBody = z.object({
  udyamNo: z.string().trim().min(1).max(40),
  gstin: z
    .string()
    .trim()
    .max(20)
    .nullable()
    .optional()
    .transform((v) => (v ? v.toUpperCase() : null)),
  consumerNo: z.string().trim().min(1).max(40),
  sample: z.boolean().optional(),
});

onboardingRouter.get('/sites/:siteId/business-check', requireAuth, async (req, res) => {
  const { orgId } = req.auth;
  const site = await loadSite(orgId, String(req.params.siteId));
  res.json(await businessCheckView(await loadOrg(orgId), site));
});

onboardingRouter.post('/sites/:siteId/business-check', requireAuth, async (req, res) => {
  const { orgId } = req.auth;
  const site = await loadSite(orgId, String(req.params.siteId));
  const b = BusinessBody.parse(req.body);
  const udyamNo = b.udyamNo.toUpperCase();
  const taken = await consumerNoTaken(orgId, b.consumerNo);
  const checks = typedChecks({ udyamNo, gstin: b.gstin, consumerNo: b.consumerNo }, taken);
  const level = levelOf(checks, false);
  const data = {
    udyamNo,
    gstin: b.gstin,
    consumerNo: b.consumerNo,
    level,
    checksJson: checks as unknown as Prisma.InputJsonValue,
    docJson: Prisma.DbNull,
    isSample: b.sample ?? false,
  };
  const row = await prisma.$transaction(async (tx) => {
    // Typed numbers go on the business only when they pass; a taken consumer number never does.
    if (level !== 'none') {
      await tx.organisation.update({ where: { id: orgId }, data: { udyamNo, gstin: b.gstin } });
      await tx.site.update({ where: { id: site.id }, data: { consumerNo: b.consumerNo } });
    }
    return tx.businessCheck.upsert({
      where: { orgId },
      update: data,
      create: { orgId, ...data },
    });
  });
  const org = await loadOrg(orgId);
  const freshSite = await loadSite(orgId, site.id);
  res.json(await businessCheckView(org, freshSite, row));
});

const memUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024, files: 1 },
});

/**
 * Udyam certificate: read in memory, keep only the business details listed, never the file and
 * never Aadhaar or PAN. Demo mode reads a fixed sample (a real certificate reader is not built).
 */
onboardingRouter.post(
  '/sites/:siteId/business-check/udyam-certificate',
  requireAuth,
  requireConsent('processing'),
  memUpload.single('file'),
  async (req, res) => {
    const { orgId } = req.auth;
    const site = await loadSite(orgId, String(req.params.siteId));
    const row = await prisma.businessCheck.findUnique({ where: { orgId } });
    if (!row?.udyamNo || !row.consumerNo) {
      throw new AppError(409, 'TYPE_NUMBERS_FIRST', 'Type the Udyam and consumer numbers first');
    }
    const doc = readUdyamCertificate(orgId);
    if (!doc) {
      throw new AppError(
        422,
        'CANT_READ_YET',
        "We can't read a Udyam certificate yet outside demo mode. Your typed numbers stay as Self-declared.",
      );
    }
    // The uploaded bytes (if any) are dropped here: nothing is stored.
    const org = await loadOrg(orgId);
    const typed = { udyamNo: row.udyamNo, gstin: row.gstin, consumerNo: row.consumerNo };
    const taken = await consumerNoTaken(orgId, row.consumerNo);
    const checks: BusinessCheckItem[] = [
      ...typedChecks(typed, taken),
      ...documentChecks(typed, org, doc),
    ];
    const level = levelOf(checks, true);
    const updated = await prisma.businessCheck.update({
      where: { orgId },
      data: {
        level,
        checksJson: checks as unknown as Prisma.InputJsonValue,
        docJson: doc as unknown as Prisma.InputJsonValue,
        isSample: doc.isSample,
      },
    });
    res.json(await businessCheckView(org, site, updated));
  },
);

// ------------------------------------------------------------------ step 2: sample bills

const SampleBody = z.object({ variant: z.enum(['clean', 'edited']) });

const answerKey = () =>
  JSON.parse(
    readFileSync(new URL('../../prisma/demo/bills/expected.json', import.meta.url), 'utf8'),
  ) as Record<string, unknown>;

let samplePdf: Buffer | null = null;
/**
 * The sample bill PDF, and an "edited" copy (SYNTHETIC, labelled "Sample edited bill (demo)"):
 * same rupee lines, kWh and kVAh lowered, saved again by editing software (same byte length, so
 * the PDF stays valid).
 */
function sampleFile(variant: 'clean' | 'edited'): Buffer {
  samplePdf ??= readFileSync(new URL('../../prisma/demo/bills/bill-2026-10.pdf', import.meta.url));
  if (variant === 'clean') return samplePdf;
  const src = samplePdf.toString('latin1');
  const from = '/Producer (Skia/PDF m156)';
  const to = '/Producer (Word         )';
  if (!src.includes(from) || from.length !== to.length)
    return Buffer.concat([samplePdf, Buffer.from('\n% edited\n')]);
  return Buffer.from(src.replace(from, to), 'latin1');
}

/** The edited sample: energy lowered to a quarter, rupee lines unchanged. */
export const EDITED_SHARE = 0.25;

function sampleFields(variant: 'clean' | 'edited'): PowerBillFields {
  const e = answerKey();
  const f = PowerBillFields.parse({
    consumerNo: e.consumer_no,
    billNo: variant === 'clean' ? e.bill_no : `${String(e.bill_no)}-EDITED`,
    periodStart: e.period_start,
    periodEnd: e.period_end,
    kwh: e.kwh,
    kvah: e.kvah,
    pf: e.pf,
    mdKva: e.md_kva,
    contractedDemandKva: e.contracted_demand_kva,
    peakKwh: e.tod_peak_kwh,
    energyCharges: e.energy_charges,
    demandCharges: e.demand_charges,
    otherCharges: e.other_charges,
    total: e.total,
  });
  if (variant === 'clean') return f;
  return {
    ...f,
    kwh: Math.round(f.kwh * EDITED_SHARE),
    kvah: Math.round(f.kvah * EDITED_SHARE),
    peakKwh: Math.round(f.peakKwh * EDITED_SHARE),
  };
}

onboardingRouter.post(
  '/sites/:siteId/documents/sample',
  requireAuth,
  requireConsent('processing'),
  async (req, res) => {
    const { orgId } = req.auth;
    const site = await loadSite(orgId, String(req.params.siteId));
    const { variant } = SampleBody.parse(req.body);
    const bytes = sampleFile(variant);
    const sha = sha256(bytes);
    const existing = await prisma.document.findFirst({
      where: { orgId, sha256: sha },
      select: { id: true, status: true },
    });
    if (existing) {
      res.status(200).json({ status: 'already_received', documentId: existing.id, variant });
      return;
    }
    const fields = sampleFields(variant);
    const meta = readPdfMeta(bytes);
    const fileCheck = {
      isPdf: meta != null,
      flags: meta ? pdfFlags(meta, { periodStart: fields.periodStart }) : [],
      meta,
      sample: variant,
    };
    const key = `${orgId}/${sha}.pdf`;
    await storage.put(key, bytes, 'application/pdf');
    const confidence = Object.fromEntries(POWER_BILL_FIELD_NAMES.map((k) => [k, 0.99]));
    const doc = await prisma.$transaction(async (tx) => {
      const d = await tx.document.create({
        data: {
          orgId,
          siteId: site.id,
          kind: 'power_bill',
          fileKey: key,
          sha256: sha,
          source: 'web',
          status: 'extracted',
          sourceKind: 'discom_pdf',
          fileCheckJson: fileCheck as unknown as Prisma.InputJsonValue,
        },
      });
      await tx.extraction.create({
        data: {
          orgId,
          documentId: d.id,
          model: variant === 'clean' ? 'fake' : 'fake-edited',
          fieldsJson: fields,
          confidenceJson: confidence,
        },
      });
      return d;
    });
    res.status(201).json({ documentId: doc.id, status: doc.status, variant });
  },
);

onboardingRouter.post('/documents/:id/discard', requireAuth, async (req, res) => {
  const { orgId } = req.auth;
  const doc = await prisma.document.findFirst({ where: { id: String(req.params.id), orgId } });
  if (!doc) throw notFound('Document');
  if (doc.status === 'confirmed') {
    throw new AppError(
      409,
      'CONFIRMED',
      'A confirmed bill is not discarded; correct the month instead',
    );
  }
  await prisma.document.update({ where: { id: doc.id }, data: { status: 'discarded' } });
  res.json({ status: 'discarded' });
});

/** Checks for a bill that is read but not yet confirmed (wizard steps 2-4). */
onboardingRouter.get('/documents/:id/checks', requireAuth, async (req, res) => {
  const { orgId } = req.auth;
  const doc = await prisma.document.findFirst({ where: { id: String(req.params.id), orgId } });
  if (!doc) throw notFound('Document');
  const site = await loadSite(orgId, doc.siteId);
  const extraction = await prisma.extraction.findFirst({
    where: { orgId, documentId: doc.id },
    orderBy: { createdAt: 'desc' },
  });
  if (!extraction) {
    res.json({ status: doc.status, fields: null, checks: [], strip: [], methodNote: METHOD_NOTE });
    return;
  }
  const fields = PowerBillFields.parse(extraction.fieldsJson);
  const ctx = await checkContext(site);
  const org = await loadOrg(orgId);
  const state = (org.onboardingJson ?? {}) as OnboardingState;
  const tonnesQ = req.query.tonnes == null ? null : Number(req.query.tonnes);
  const tonnes =
    tonnesQ != null && Number.isFinite(tonnesQ)
      ? tonnesQ
      : (state.productionTonnes ?? ctx.tonnesByMonth.get(fields.periodStart) ?? null);
  const own = ctx.months.find((m) => m.documentId === doc.id);
  const ys = yearStrip(ctx.spans, fields.periodStart, {
    periodStart: fields.periodStart,
    periodEnd: fields.periodEnd,
    excludeId: own?.id,
  });
  const checks = billChecks({
    bill: {
      periodStart: fields.periodStart,
      periodEnd: fields.periodEnd,
      kwh: fields.kwh,
      kvah: fields.kvah,
      mdKva: fields.mdKva,
      contractedDemandKva: fields.contractedDemandKva,
      energyCharges: fields.energyCharges,
      demandCharges: fields.demandCharges,
      otherInr: Object.values(fields.otherCharges).reduce((t, v) => t + v, 0),
      total: fields.total,
      consumerNo: fields.consumerNo,
    },
    rules: ctx.rulesAt(fields.periodEnd),
    siteConsumerNo: site.consumerNo,
    tonnes,
    file: fileInfo(doc),
    duplicate: false,
    gaps: ys.gaps,
    overlaps: ys.overlaps,
  });
  const fc = fileInfo(doc).fileCheck as { sample?: string } | null;
  res.json({
    status: doc.status,
    fields,
    sourceKind: doc.sourceKind,
    sourceText: fc?.sample
      ? fc.sample === 'edited'
        ? 'Sample edited bill (demo)'
        : 'Sample bill (demo), from DISCOM PDF'
      : doc.sourceKind
        ? SOURCE_TEXT[doc.sourceKind as SourceKind]
        : null,
    sample: fc?.sample ?? null,
    checks,
    strength: strengthOf(doc.sourceKind, checks),
    strip: ys.strip,
    methodNote: METHOD_NOTE,
  });
});

// ------------------------------------------------------------------ step 5: months, lock, history

type Values = {
  kwh: number | null;
  kvah: number | null;
  mdKva: number | null;
  energyCharges: number | null;
  demandCharges: number | null;
};
const valuesOf = (m: EnergyMonth): Values => ({
  kwh: num(m.kwh),
  kvah: num(m.kvah),
  mdKva: num(m.mdKva),
  energyCharges: num(m.energyCharges),
  demandCharges: num(m.demandCharges),
});

async function monthCards(siteId: string, orgId: string) {
  const site = await loadSite(orgId, siteId);
  const ctx = await checkContext(site);
  const versions = await prisma.energyMonthVersion.groupBy({
    by: ['energyMonthId'],
    where: { orgId },
    _max: { version: true },
  });
  const vMax = new Map(versions.map((v) => [v.energyMonthId, v._max.version ?? 1]));
  const latest = ctx.spans.at(-1)?.periodStart ?? iso(new Date());
  const strip = yearStrip(ctx.spans, latest);
  const cards = ctx.months.map((m) => {
    const start = iso(m.periodStart);
    const doc = m.documentId ? ctx.docsById.get(m.documentId) : undefined;
    const ys = yearStrip(ctx.spans, start, {
      periodStart: start,
      periodEnd: iso(m.periodEnd),
      excludeId: m.id,
    });
    const checks = billChecks({
      bill: fromMonth(m, site, doc ? site.consumerNo : null),
      rules: ctx.rulesAt(iso(m.periodEnd)),
      siteConsumerNo: site.consumerNo,
      tonnes: ctx.tonnesByMonth.get(start) ?? null,
      file: fileInfo(doc ?? { sourceKind: m.sourceKind, fileCheckJson: null }),
      duplicate: false,
      gaps: [],
      overlaps: ys.overlaps,
    }).filter((c) => c.code !== 'B2' || c.result === 'flag');
    const strength = strengthOf(m.sourceKind, checks);
    const fc = fileInfo(doc).fileCheck as { sample?: string } | null;
    return {
      id: m.id,
      month: start,
      periodEnd: iso(m.periodEnd),
      values: valuesOf(m),
      sourceKind: m.sourceKind,
      sourceText:
        fc?.sample === 'edited'
          ? 'Sample edited bill (demo)'
          : m.sourceKind
            ? SOURCE_TEXT[m.sourceKind as SourceKind]
            : 'Typed by owner',
      fileSha256: doc?.sha256 ?? null,
      checks,
      strength,
      strengthText: STRENGTH_TEXT[strength],
      lockedAt: m.lockedAt?.toISOString() ?? null,
      lockReason: m.lockReason,
      version: vMax.get(m.id) ?? 1,
      tonnes: ctx.tonnesByMonth.get(start) ?? null,
    };
  });
  return { site, cards: cards.reverse(), strip: strip.strip, gaps: strip.gaps };
}

onboardingRouter.get('/sites/:siteId/data-months', requireAuth, async (req, res) => {
  const { orgId } = req.auth;
  const { cards, strip, gaps } = await monthCards(String(req.params.siteId), orgId);
  res.json({ months: cards, strip, gaps, methodNote: METHOD_NOTE });
});

async function loadMonth(orgId: string, id: string) {
  const m = await prisma.energyMonth.findFirst({ where: { id, orgId } });
  if (!m) throw notFound('Month');
  return m;
}

const LockBody = z.object({ reason: z.string().trim().max(300).optional() });

onboardingRouter.post('/energy-months/:id/lock', requireAuth, async (req, res) => {
  const { orgId } = req.auth;
  const m = await loadMonth(orgId, String(req.params.id));
  const { reason } = LockBody.parse(req.body ?? {});
  if (m.lockedAt) {
    res.json({ lockedAt: m.lockedAt.toISOString(), lockReason: m.lockReason });
    return;
  }
  const { cards } = await monthCards(m.siteId, orgId);
  const card = cards.find((c) => c.id === m.id)!;
  if (card.strength === 'second_look' && !reason) {
    throw new AppError(
      422,
      'REASON_NEEDED',
      'This month needs a second look: give a reason to lock it as it is',
    );
  }
  const updated = await prisma.energyMonth.update({
    where: { id: m.id },
    data: { lockedAt: new Date(), lockReason: reason ?? null },
  });
  res.json({ lockedAt: updated.lockedAt!.toISOString(), lockReason: updated.lockReason });
});

const ValuesBody = z
  .object({
    kwh: z.number().nonnegative(),
    kvah: z.number().positive(),
    mdKva: z.number().nonnegative(),
    energyCharges: z.number().nonnegative(),
    demandCharges: z.number().nonnegative(),
  })
  .partial();

const toData = (v: z.infer<typeof ValuesBody>, m: EnergyMonth) => {
  const kwh = v.kwh ?? num(m.kwh);
  const kvah = v.kvah ?? num(m.kvah);
  return {
    ...v,
    pf: kwh != null && kvah ? Math.round((kwh / kvah) * 10000) / 10000 : undefined,
  };
};

/** Unlocked months can be edited; a locked month is read-only (use a correction with a reason). */
onboardingRouter.patch('/energy-months/:id', requireAuth, async (req, res) => {
  const { orgId } = req.auth;
  const m = await loadMonth(orgId, String(req.params.id));
  if (m.lockedAt) {
    throw new AppError(
      409,
      'LOCKED',
      'This month is locked. Correct a value with a reason instead.',
    );
  }
  const v = ValuesBody.parse(req.body);
  const updated = await prisma.energyMonth.update({ where: { id: m.id }, data: toData(v, m) });
  res.json({ id: updated.id, values: valuesOf(updated) });
});

export const CORRECTION_REASONS = ['bill re-issued by DISCOM', 'typing mistake'] as const;
const CorrectionBody = z.object({
  values: ValuesBody,
  reason: z.string().trim().min(3).max(300),
});

/** Append-only: version 1 is the value as first confirmed; each correction adds the next. */
onboardingRouter.post('/energy-months/:id/corrections', requireAuth, async (req, res) => {
  const { orgId, userId } = req.auth;
  const m = await loadMonth(orgId, String(req.params.id));
  const { values, reason } = CorrectionBody.parse(req.body);
  if (Object.keys(values).length === 0) {
    throw new AppError(400, 'VALIDATION', 'Change at least one value');
  }
  const result = await prisma.$transaction(async (tx) => {
    const last = await tx.energyMonthVersion.findFirst({
      where: { orgId, energyMonthId: m.id },
      orderBy: { version: 'desc' },
    });
    let version = last?.version ?? 0;
    if (!last) {
      version = 1;
      await tx.energyMonthVersion.create({
        data: {
          orgId,
          energyMonthId: m.id,
          version,
          valuesJson: valuesOf(m) as unknown as Prisma.InputJsonValue,
          reason: 'As first confirmed',
          createdAt: m.createdAt,
        },
      });
    }
    const updated = await tx.energyMonth.update({ where: { id: m.id }, data: toData(values, m) });
    const row = await tx.energyMonthVersion.create({
      data: {
        orgId,
        energyMonthId: m.id,
        version: version + 1,
        valuesJson: valuesOf(updated) as unknown as Prisma.InputJsonValue,
        reason,
        createdBy: userId,
      },
    });
    return { version: row.version, values: valuesOf(updated) };
  });
  res.status(201).json(result);
});

onboardingRouter.get('/energy-months/:id/history', requireAuth, async (req, res) => {
  const { orgId } = req.auth;
  const m = await loadMonth(orgId, String(req.params.id));
  const rows = await prisma.energyMonthVersion.findMany({
    where: { orgId, energyMonthId: m.id },
    orderBy: { version: 'asc' },
  });
  res.json({
    month: iso(m.periodStart),
    lockedAt: m.lockedAt?.toISOString() ?? null,
    current: valuesOf(m),
    versions: rows.map((r) => ({
      version: r.version,
      values: r.valuesJson,
      reason: r.reason,
      createdAt: r.createdAt.toISOString(),
    })),
    note: 'Carbon results already calculated for this month keep the values they were calculated with; a recalculation is shown separately (Doc 03 rule 3).',
  });
});

/** For the statements: data strength mix across the months a report covers. */
export async function dataStrengthLine(orgId: string, siteId: string) {
  const { cards } = await monthCards(siteId, orgId);
  const y = cards.length;
  const x = cards.filter((c) => c.sourceKind === 'discom_pdf').length;
  const z = cards.filter((c) => c.strength === 'second_look').length;
  return {
    line: `Data: ${x} of ${y} months from DISCOM PDFs; ${z} need a second look.`,
    files: cards
      .filter((c) => c.fileSha256)
      .map((c) => ({ month: c.month, sha256: c.fileSha256! })),
  };
}
