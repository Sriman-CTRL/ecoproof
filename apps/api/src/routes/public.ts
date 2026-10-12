import { createHash } from 'node:crypto';
import { Router } from 'express';
import { z } from 'zod';
import { storage } from '../adapters/storage.js';
import { config } from '../config.js';
import { prisma } from '../db.js';
import { AppError, notFound } from '../errors.js';
import { rateLimit } from '../middleware/rateLimit.js';
import { verifyView } from '../reports/loanPack.js';

/**
 * No login. Reports are looked up by id or share token only, and the response is limited to
 * the verify fields (Doc 05 "Verification page"): no other business data leaves here.
 */
export const publicRouter = Router();
publicRouter.use('/public', rateLimit(config.PUBLIC_RATE_LIMIT_PER_MIN));

publicRouter.get('/public/reports/:id/verify', async (req, res) => {
  const id = z.uuid().safeParse(req.params.id);
  if (!id.success) throw notFound('Report');
  const report = await prisma.report.findUnique({
    where: { id: id.data },
    include: { snapshot: true },
  });
  if (!report) throw notFound('Report');
  res.json(verifyView(report));
});

publicRouter.get('/public/shares/:token', async (req, res) => {
  const tokenHash = createHash('sha256').update(String(req.params.token)).digest('hex');
  const share = await prisma.share.findUnique({
    where: { tokenHash },
    include: { report: { include: { snapshot: true } } },
  });
  if (!share) throw notFound('Share link');
  if (share.revokedAt || share.expiresAt <= new Date()) {
    throw new AppError(410, 'LINK_EXPIRED', 'This link has expired or was revoked');
  }
  const download = req.query.download === '1';
  await prisma.shareView.create({
    data: {
      orgId: share.orgId,
      shareId: share.id,
      kind: download ? 'download' : 'view',
      userAgent: req.get('user-agent')?.slice(0, 300) ?? null,
    },
  });
  res.json({
    ...verifyView(share.report),
    downloadUrl: await storage.signedUrl(share.report.fileKey, 600),
  });
});
