import { Router } from 'express';
import { ConsentBody } from '@ecoproof/shared';
import { prisma } from '../db.js';
import { requireAuth } from '../middleware/auth.js';

export const consentsRouter = Router();

consentsRouter.post('/consents', requireAuth, async (req, res) => {
  const body = ConsentBody.parse(req.body);
  const consent = await prisma.consent.create({
    data: {
      orgId: req.auth.orgId,
      userId: req.auth.userId,
      noticeVersion: body.noticeVersion,
      purpose: body.purpose,
      grantedAt: new Date(),
    },
  });
  res.status(201).json({ id: consent.id, purpose: consent.purpose, grantedAt: consent.grantedAt });
});

consentsRouter.get('/consents/status', requireAuth, async (req, res) => {
  const c = await prisma.consent.findFirst({
    where: { orgId: req.auth.orgId, purpose: 'processing', withdrawnAt: null },
    orderBy: { grantedAt: 'desc' },
    select: { noticeVersion: true },
  });
  res.json(c ? { processing: true, noticeVersion: c.noticeVersion } : { processing: false });
});
