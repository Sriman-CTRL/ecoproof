import { createHash, randomBytes } from 'node:crypto';
import { Router } from 'express';
import { z } from 'zod';
import { storage } from '../adapters/storage.js';
import { config } from '../config.js';
import { prisma } from '../db.js';
import { notFound } from '../errors.js';
import { requireAuth } from '../middleware/auth.js';
import { CbamBody, createCbamSheet } from '../reports/cbamSheet.js';
import { createLoanPack, LoanPackBody, verifyView } from '../reports/loanPack.js';
import { loadSite } from '../services/scope.js';

export const reportsRouter = Router();

const sha256 = (b: Buffer | string) => createHash('sha256').update(b).digest('hex');
const DOWNLOAD_SECONDS = 600;

reportsRouter.post('/sites/:siteId/reports/loan-pack', requireAuth, async (req, res) => {
  const { orgId } = req.auth;
  const site = await loadSite(orgId, String(req.params.siteId));
  const body = LoanPackBody.parse(req.body);
  const { fileKey, ...made } = await createLoanPack(site, body);
  res.status(201).json({
    ...made,
    downloadUrl: await storage.signedUrl(fileKey, DOWNLOAD_SECONDS),
  });
});

// REP-2 CBAM supplier sheet (Excel): estimate, not verified. The owner picks each CN code.
reportsRouter.post('/sites/:siteId/reports/cbam', requireAuth, async (req, res) => {
  const { orgId } = req.auth;
  const site = await loadSite(orgId, String(req.params.siteId));
  const body = CbamBody.parse(req.body);
  const { fileKey, ...made } = await createCbamSheet(site, body);
  res.status(201).json({
    ...made,
    downloadUrl: await storage.signedUrl(fileKey, DOWNLOAD_SECONDS),
  });
});

// CN code picker (reference table, R4). Search by code or description.
reportsRouter.get('/cbam/cn-codes', requireAuth, async (req, res) => {
  const q = z.string().trim().max(60).catch('').parse(req.query.q);
  const digits = q.replace(/\s+/g, '');
  const rows = await prisma.cbamCnCode.findMany({ orderBy: { code: 'asc' } });
  const hits = q
    ? rows.filter(
        (r) =>
          r.code.replace(/\s+/g, '').startsWith(digits) ||
          r.description.toLowerCase().includes(q.toLowerCase()),
      )
    : rows;
  res.json(
    hits.map((r) => ({
      code: r.code,
      description: r.description,
      inScopeNow: r.inScopeNow,
      proposedFrom: r.proposedFrom ? r.proposedFrom.toISOString().slice(0, 10) : null,
      hasIndiaDefault: r.indiaDefaultTotal != null,
    })),
  );
});

reportsRouter.get('/sites/:siteId/reports', requireAuth, async (req, res) => {
  const { orgId } = req.auth;
  const site = await loadSite(orgId, String(req.params.siteId));
  const reports = await prisma.report.findMany({
    where: { orgId, snapshot: { orgId, siteId: site.id } },
    orderBy: { createdAt: 'desc' },
    include: {
      snapshot: { select: { actionCode: true } },
      shares: { where: { orgId }, include: { views: { where: { orgId, kind: 'view' } } } },
    },
  });
  res.json(
    reports.map((r) => ({
      id: r.id,
      type: r.type,
      version: r.version,
      createdAt: r.createdAt,
      actionCode: r.snapshot.actionCode,
      shareCount: r.shares.length,
      viewCount: r.shares.reduce((s, sh) => s + sh.views.length, 0),
    })),
  );
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
