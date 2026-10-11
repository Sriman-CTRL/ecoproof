import { createHash } from 'node:crypto';
import { Router } from 'express';
import multer from 'multer';
import { ConfirmBody, ManualBody, POWER_BILL_FIELD_NAMES, PowerBillFields } from '@ecoproof/shared';
import { prisma } from '../db.js';
import { AppError } from '../errors.js';
import { storage } from '../adapters/storage.js';
import { runJob } from '../jobs/index.js';
import { requireAuth, requireConsent } from '../middleware/auth.js';
import { lowConfidenceFields, validateFields } from '../services/billValidation.js';
import { loadDocument, loadSite } from '../services/scope.js';

export const documentsRouter = Router();

const MIME_EXT: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'application/pdf': 'pdf',
};
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024, files: 1 },
  fileFilter: (_req, file, cb) => {
    if (MIME_EXT[file.mimetype]) cb(null, true);
    else cb(new AppError(400, 'UNSUPPORTED_FILE', 'Only png, jpg, jpeg or pdf files are accepted'));
  },
});

const sha256 = (b: Buffer | string) => createHash('sha256').update(b).digest('hex');
const iso = (d: Date) => d.toISOString().slice(0, 10);

documentsRouter.post(
  '/sites/:siteId/documents',
  requireAuth,
  requireConsent('processing'),
  upload.single('file'),
  async (req, res) => {
    const { orgId } = req.auth;
    const site = await loadSite(orgId, String(req.params.siteId));
    if (!req.file) throw new AppError(400, 'VALIDATION', 'Missing file field "file"');
    const sha = sha256(req.file.buffer);

    const existing = await prisma.document.findFirst({
      where: { orgId, sha256: sha },
      select: { id: true },
    });
    if (existing) {
      res.status(200).json({ status: 'already_received', documentId: existing.id });
      return;
    }
    const key = `${orgId}/${sha}.${MIME_EXT[req.file.mimetype]}`;
    await storage.put(key, req.file.buffer, req.file.mimetype);
    const doc = await prisma.document.create({
      data: {
        orgId,
        siteId: site.id,
        kind: 'power_bill',
        fileKey: key,
        sha256: sha,
        source: 'web',
        status: 'received',
      },
    });
    void runJob('extract', { documentId: doc.id }).catch((e) => console.error('extract failed', e));
    res.status(202).json({ documentId: doc.id, status: doc.status });
  },
);

documentsRouter.post(
  '/sites/:siteId/documents/manual',
  requireAuth,
  requireConsent('processing'),
  async (req, res) => {
    const { orgId } = req.auth;
    const site = await loadSite(orgId, String(req.params.siteId));
    const { fields } = ManualBody.parse(req.body);
    const sha = sha256(JSON.stringify(fields));
    const existing = await prisma.document.findFirst({
      where: { orgId, sha256: sha },
      select: { id: true },
    });
    if (existing) {
      res.status(200).json({ status: 'already_received', documentId: existing.id });
      return;
    }
    const confidence = Object.fromEntries(POWER_BILL_FIELD_NAMES.map((k) => [k, 1]));
    const doc = await prisma.$transaction(async (tx) => {
      const d = await tx.document.create({
        data: {
          orgId,
          siteId: site.id,
          kind: 'power_bill',
          fileKey: '',
          sha256: sha,
          source: 'web',
          status: 'extracted',
        },
      });
      await tx.extraction.create({
        data: {
          orgId,
          documentId: d.id,
          model: 'manual',
          fieldsJson: fields,
          confidenceJson: confidence,
        },
      });
      return d;
    });
    res.status(201).json({ documentId: doc.id, status: doc.status });
  },
);

documentsRouter.get('/sites/:siteId/documents/latest', requireAuth, async (req, res) => {
  const { orgId } = req.auth;
  const site = await loadSite(orgId, String(req.params.siteId));
  const doc = await prisma.document.findFirst({
    where: { orgId, siteId: site.id },
    orderBy: { createdAt: 'desc' },
    select: { id: true, status: true },
  });
  res.json(doc);
});

documentsRouter.get('/documents/:id', requireAuth, async (req, res) => {
  const { orgId } = req.auth;
  const doc = await loadDocument(orgId, String(req.params.id));
  const site = await loadSite(orgId, doc.siteId);
  const extraction = await prisma.extraction.findFirst({
    where: { orgId, documentId: doc.id },
    orderBy: { createdAt: 'desc' },
  });
  const fileUrl = doc.fileKey ? await storage.signedUrl(doc.fileKey, 600) : null;
  if (!extraction) {
    res.json({
      status: doc.status,
      fields: null,
      confidence: null,
      lowConfidence: [],
      validation: { errors: [], needsConfirmation: [] },
      fileUrl,
    });
    return;
  }
  const fields = PowerBillFields.parse(extraction.fieldsJson);
  const confidence = (extraction.confidenceJson ?? {}) as Record<string, number>;
  // A confirmed bill would clash with its own energy_months row, so it is not re-validated.
  const v =
    doc.status === 'confirmed'
      ? { errors: [], needsConfirmation: [], flaggedFields: [] as string[] }
      : await validateFields(site, fields);
  res.json({
    status: doc.status,
    fields,
    confidence,
    lowConfidence: lowConfidenceFields(confidence, v),
    validation: { errors: v.errors, needsConfirmation: v.needsConfirmation },
    fileUrl,
  });
});

documentsRouter.post('/documents/:id/confirm', requireAuth, async (req, res) => {
  const { orgId, userId } = req.auth;
  const body = ConfirmBody.parse(req.body);
  const doc = await loadDocument(orgId, String(req.params.id));
  if (doc.status !== 'extracted') {
    throw new AppError(409, 'NOT_CONFIRMABLE', `Document is ${doc.status}, not extracted`);
  }
  const site = await loadSite(orgId, doc.siteId);
  const f = body.fields;

  const v = await validateFields(site, f);
  if (v.errors.length) {
    throw new AppError(422, 'VALIDATION_FAILED', 'Bill failed validation', v.errors);
  }
  const ack = new Set(body.acknowledged ?? []);
  const unacknowledged = v.needsConfirmation.filter((m) => !ack.has(m));
  if (unacknowledged.length) {
    throw new AppError(409, 'NEEDS_ACKNOWLEDGEMENT', 'Please confirm these items', unacknowledged);
  }

  const periodStart = new Date(`${f.periodStart}T00:00:00Z`);
  const periodEnd = new Date(`${f.periodEnd}T00:00:00Z`);
  const extraction = await prisma.extraction.findFirst({
    where: { orgId, documentId: doc.id },
    orderBy: { createdAt: 'desc' },
  });
  if (!extraction) throw new AppError(409, 'NOT_CONFIRMABLE', 'Document has no extraction');

  await prisma.$transaction(async (tx) => {
    await tx.energyMonth.create({
      data: {
        orgId,
        siteId: site.id,
        periodStart,
        periodEnd,
        kwh: f.kwh,
        kvah: f.kvah,
        pf: f.pf,
        mdKva: f.mdKva,
        peakKwh: f.peakKwh,
        energyCharges: f.energyCharges,
        demandCharges: f.demandCharges,
        otherChargesJson: f.otherCharges,
        qualityTag: 'measured',
      },
    });
    await tx.productionMonth.upsert({
      where: { siteId_month: { siteId: site.id, month: periodStart } },
      update: { quantity: body.productionTonnes, unit: 'tonne', qualityTag: 'owner_entered' },
      create: {
        orgId,
        siteId: site.id,
        month: periodStart,
        quantity: body.productionTonnes,
        unit: 'tonne',
        qualityTag: 'owner_entered',
      },
    });
    if (body.dieselLitres != null) {
      await tx.fuelEntry.create({
        data: {
          orgId,
          siteId: site.id,
          date: periodStart,
          fuelType: 'diesel',
          quantity: body.dieselLitres,
          unit: 'litre',
          qualityTag: 'owner_entered',
        },
      });
    }
    // Keep the raw reading as extracted; the owner-confirmed values go in a second row.
    await tx.extraction.update({
      where: { id: extraction.id },
      data: { confirmedBy: userId, confirmedAt: new Date() },
    });
    await tx.extraction.create({
      data: {
        orgId,
        documentId: doc.id,
        model: 'owner_confirmed',
        fieldsJson: f,
        confidenceJson: Object.fromEntries(POWER_BILL_FIELD_NAMES.map((k) => [k, 1])),
        confirmedBy: userId,
        confirmedAt: new Date(),
      },
    });
    await tx.document.update({ where: { id: doc.id }, data: { status: 'confirmed' } });
  });

  const { resultId } = await runJob('calculate', { siteId: site.id, month: iso(periodStart) });
  res.json({ resultId });
});
