import { Router } from 'express';
import { DemoLoginBody } from '@ecoproof/shared';
import { prisma } from '../db.js';
import { DEMOS } from '../demo/ids.js';
import { AppError } from '../errors.js';
import { signToken } from '../middleware/auth.js';

export const authRouter = Router();

authRouter.post('/auth/demo-login', async (req, res) => {
  const { demo } = DemoLoginBody.parse(req.body);
  const ids = DEMOS[demo];
  const [org, site, user] = await Promise.all([
    prisma.organisation.findUnique({ where: { id: ids.orgId } }),
    prisma.site.findFirst({ where: { id: ids.siteId, orgId: ids.orgId } }),
    prisma.user.findUnique({ where: { id: ids.userId }, select: { id: true, language: true } }),
  ]);
  if (!org || !site || !user) {
    throw new AppError(503, 'DEMO_NOT_SEEDED', 'Run db:seed:demo first');
  }
  const token = signToken({ userId: user.id, orgId: org.id, role: 'owner' });
  res.json({ token, org, site, user });
});
