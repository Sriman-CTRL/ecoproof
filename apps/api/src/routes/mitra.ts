import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { Router } from 'express';
import multer from 'multer';
import { z } from 'zod';
import { storage } from '../adapters/storage.js';
import { prisma } from '../db.js';
import { DEMO_ORG_IDS } from '../demo/ids.js';
import { AppError, notFound } from '../errors.js';
import { requireAuth } from '../middleware/auth.js';
import { createCertificate } from '../reports/mitraDocs.js';
import {
  computeMitraPage,
  computeMitraSummary,
  itemViewWithPack,
  loadMitraItem,
  listPeerCases,
  loadStep,
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
  res.json(await itemViewWithPack(site, item, step));
});

mitraRouter.post('/sites/:siteId/mitra/:code/done', requireAuth, async (req, res) => {
  const site = await loadSite(req.auth.orgId, String(req.params.siteId));
  const item = await loadMitraItem(String(req.params.code));
  const step = await markDone(site, item);
  res.json(await itemViewWithPack(site, item, step));
});

// Published case studies for one action (ActionDetail peer card). Global reference rows.
mitraRouter.get('/peer-cases', requireAuth, async (req, res) => {
  const actionCode = z.string().trim().min(1).max(80).safeParse(req.query.actionCode);
  res.json(await listPeerCases(actionCode.success ? actionCode.data : undefined));
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

// ------------------------------------------------ proof and Certificate of Participation

const DOWNLOAD_SECONDS = 600;
const MIME_EXT: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'application/pdf': 'pdf',
};
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024, files: 1 },
  fileFilter: (_req, file, cb) => {
    if (MIME_EXT[file.mimetype]) cb(null, true);
    else cb(new AppError(400, 'UNSUPPORTED_FILE', 'Only png, jpg, jpeg or pdf files are accepted'));
  },
});

const ProofBody = z.object({
  proofType: z.enum(['organiser_email', 'organiser_document', 'attendance_photo']).optional(),
  eventDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional()
    .or(z.literal('').transform(() => undefined)),
  note: z.string().trim().max(300).optional(),
  /** Demo orgs only: a bundled, clearly labelled sample proof (no real outside step). */
  sample: z.union([z.boolean(), z.literal('true').transform(() => true)]).optional(),
});

let sampleProof: Buffer | null = null;
const sha256 = (b: Buffer) => createHash('sha256').update(b).digest('hex');

mitraRouter.post(
  '/sites/:siteId/mitra/:code/proof',
  requireAuth,
  upload.single('file'),
  async (req, res) => {
    const { orgId } = req.auth;
    const site = await loadSite(orgId, String(req.params.siteId));
    const item = await loadMitraItem(String(req.params.code));
    const step = await loadStep(site, item.code);
    if (!step || step.status === 'not_started') {
      throw new AppError(409, 'NOT_STARTED', 'Start this step before uploading proof');
    }
    const body = ProofBody.parse(req.body ?? {});
    let bytes: Buffer;
    let mime: string;
    let proofType: string;
    if (req.file) {
      bytes = req.file.buffer;
      mime = req.file.mimetype;
      proofType = body.proofType ?? 'attendance_photo';
    } else if (body.sample === true && DEMO_ORG_IDS.includes(orgId)) {
      sampleProof ??= readFileSync(
        new URL('../../prisma/demo/mitra-sample-proof.png', import.meta.url),
      );
      bytes = sampleProof;
      mime = 'image/png';
      proofType = 'sample';
    } else {
      throw new AppError(400, 'VALIDATION', 'Missing file field "file"');
    }
    const sha = sha256(bytes);
    const key = `mitra/${orgId}/${sha}.${MIME_EXT[mime]}`;
    await storage.put(key, bytes, mime);
    const confirmed = await prisma.mitraStep.update({
      where: { id: step.id },
      data: {
        status: 'confirmed',
        proofFileKey: key,
        proofSha256: sha,
        proofType,
        proofNote: body.note ?? null,
        eventDate: body.eventDate ? new Date(`${body.eventDate}T00:00:00Z`) : null,
      },
    });
    const cert = await createCertificate(site, item, confirmed);
    const saved = await prisma.mitraStep.update({
      where: { id: step.id },
      data: { certificateReportId: cert.reportId },
    });
    res.status(201).json({
      ...(await itemViewWithPack(site, item, saved)),
      certificate: {
        reportId: cert.reportId,
        version: cert.version,
        sha256: cert.sha256,
        downloadUrl: await storage.signedUrl(cert.fileKey, DOWNLOAD_SECONDS),
      },
    });
  },
);

// The owner's proof file: a 10-minute signed link, same as bills. Another org: 404.
mitraRouter.get('/sites/:siteId/mitra/:code/proof', requireAuth, async (req, res) => {
  const site = await loadSite(req.auth.orgId, String(req.params.siteId));
  const step = await loadStep(site, String(req.params.code));
  if (!step?.proofFileKey) throw notFound('Proof');
  res.json({ downloadUrl: await storage.signedUrl(step.proofFileKey, DOWNLOAD_SECONDS) });
});

// Certificate of Participation: only for a confirmed step (403 otherwise). Returns the latest.
mitraRouter.post('/sites/:siteId/mitra/:code/certificate', requireAuth, async (req, res) => {
  const site = await loadSite(req.auth.orgId, String(req.params.siteId));
  const item = await loadMitraItem(String(req.params.code));
  const step = await loadStep(site, item.code);
  if (!step || step.status !== 'confirmed') {
    throw new AppError(
      403,
      'NOT_CONFIRMED',
      'A Certificate of Participation needs a confirmed step: upload proof first',
    );
  }
  const existing = step.certificateReportId
    ? await prisma.report.findFirst({ where: { id: step.certificateReportId, orgId: site.orgId } })
    : null;
  if (existing) {
    res.json({
      reportId: existing.id,
      version: existing.version,
      sha256: existing.sha256,
      downloadUrl: await storage.signedUrl(existing.fileKey, DOWNLOAD_SECONDS),
    });
    return;
  }
  const cert = await createCertificate(site, item, step);
  await prisma.mitraStep.update({
    where: { id: step.id },
    data: { certificateReportId: cert.reportId },
  });
  res.status(201).json({
    reportId: cert.reportId,
    version: cert.version,
    sha256: cert.sha256,
    downloadUrl: await storage.signedUrl(cert.fileKey, DOWNLOAD_SECONDS),
  });
});
