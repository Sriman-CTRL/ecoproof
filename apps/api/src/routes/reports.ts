import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { Router } from 'express';
import { z } from 'zod';
import { storage } from '../adapters/storage.js';
import { config } from '../config.js';
import { prisma } from '../db.js';
import { notFound } from '../errors.js';
import { requireAuth } from '../middleware/auth.js';
import {
  buildSnapshot,
  footerTemplate,
  LoanPackBody,
  renderHtml,
  verifyUrlFor,
  verifyView,
} from '../reports/loanPack.js';
import { pdfRenderer } from '../reports/pdfRenderer.js';
import { loadSite } from '../services/scope.js';

export const reportsRouter = Router();

const sha256 = (b: Buffer | string) => createHash('sha256').update(b).digest('hex');
const DOWNLOAD_SECONDS = 600;

reportsRouter.post('/sites/:siteId/reports/loan-pack', requireAuth, async (req, res) => {
  const { orgId } = req.auth;
  const site = await loadSite(orgId, String(req.params.siteId));
  const body = LoanPackBody.parse(req.body);

  // Regenerating for the same action makes version n+1; old versions stay valid.
  const previous = await prisma.report.count({
    where: { orgId, snapshot: { siteId: site.id, type: 'loan_pack', actionCode: body.actionCode } },
  });
  const ids = { reportId: randomUUID(), version: previous + 1, issuedAt: new Date() };
  const snapshotId = randomUUID();

  const snap = await buildSnapshot(site, body, ids);
  const html = await renderHtml(snap.resultsJson, snapshotId);
  const pdf = await pdfRenderer.render(html, {
    footerTemplate: footerTemplate(ids.reportId, verifyUrlFor(ids.reportId)),
  });
  const seal = sha256(pdf);
  const fileKey = `reports/${orgId}/${ids.reportId}.pdf`;
  await storage.put(fileKey, pdf, 'application/pdf');

  await prisma.$transaction([
    prisma.reportSnapshot.create({
      data: {
        id: snapshotId,
        orgId,
        siteId: site.id,
        type: 'loan_pack',
        language: body.language,
        actionCode: body.actionCode,
        inputsJson: snap.inputsJson,
        resultsJson: snap.resultsJson as object,
        factorIds: snap.factorIds,
        formulaVersion: snap.formulaVersion,
        dataQualityScore: snap.dataQualityScore,
        createdAt: ids.issuedAt,
      },
    }),
    prisma.report.create({
      data: {
        id: ids.reportId,
        orgId,
        snapshotId,
        type: 'loan_pack',
        language: body.language,
        fileKey,
        sha256: seal,
        version: ids.version,
        createdAt: ids.issuedAt,
      },
    }),
  ]);

  res.status(201).json({
    reportId: ids.reportId,
    version: ids.version,
    sha256: seal,
    downloadUrl: await storage.signedUrl(fileKey, DOWNLOAD_SECONDS),
  });
});

reportsRouter.get('/reports/:id', requireAuth, async (req, res) => {
  const { orgId } = req.auth;
  const id = z.uuid().safeParse(req.params.id);
  if (!id.success) throw notFound('Report');
  const report = await prisma.report.findFirst({
    where: { id: id.data, orgId },
    include: {
      snapshot: true,
      shares: {
        where: { orgId },
        orderBy: { createdAt: 'desc' },
        include: { views: { where: { orgId }, orderBy: { at: 'desc' } } },
      },
    },
  });
  if (!report) throw notFound('Report');
  const now = new Date();
  res.json({
    ...verifyView(report),
    type: report.type,
    language: report.language,
    snapshotId: report.snapshotId,
    actionCode: report.snapshot.actionCode,
    downloadUrl: await storage.signedUrl(report.fileKey, DOWNLOAD_SECONDS),
    shares: report.shares.map((s) => ({
      id: s.id,
      recipientName: s.recipient,
      createdAt: s.createdAt,
      expiresAt: s.expiresAt,
      revokedAt: s.revokedAt,
      status: s.revokedAt ? 'revoked' : s.expiresAt <= now ? 'expired' : 'active',
      views: s.views.filter((v) => v.kind === 'view').length,
      downloads: s.views.filter((v) => v.kind === 'download').length,
      log: s.views.map((v) => ({ kind: v.kind, at: v.at })),
    })),
  });
});

const ShareBody = z.object({
  recipientName: z.string().trim().min(1).max(200),
  expiresInDays: z.number().int().min(1).max(365).default(30),
});

reportsRouter.post('/reports/:id/shares', requireAuth, async (req, res) => {
  const { orgId } = req.auth;
  const body = ShareBody.parse(req.body);
  const id = z.uuid().safeParse(req.params.id);
  if (!id.success) throw notFound('Report');
  const report = await prisma.report.findFirst({ where: { id: id.data, orgId } });
  if (!report) throw notFound('Report');

  // Only the hash is stored: a database leak does not leak working links.
  const token = randomBytes(32).toString('base64url');
  const expiresAt = new Date(Date.now() + body.expiresInDays * 24 * 60 * 60 * 1000);
  const share = await prisma.share.create({
    data: {
      orgId,
      reportId: report.id,
      recipient: body.recipientName,
      tokenHash: sha256(token),
      expiresAt,
    },
  });
  res.status(201).json({
    id: share.id,
    shareUrl: `${config.PUBLIC_WEB_URL.replace(/\/$/, '')}/s/${token}`,
    expiresAt,
  });
});

reportsRouter.delete('/shares/:id', requireAuth, async (req, res) => {
  const { orgId } = req.auth;
  const id = z.uuid().safeParse(req.params.id);
  if (!id.success) throw notFound('Share');
  const share = await prisma.share.findFirst({ where: { id: id.data, orgId } });
  if (!share) throw notFound('Share');
  const saved = share.revokedAt
    ? share
    : await prisma.share.update({ where: { id: share.id }, data: { revokedAt: new Date() } });
  res.json({ id: saved.id, revokedAt: saved.revokedAt });
});
