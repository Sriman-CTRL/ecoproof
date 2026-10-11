import type { RequestHandler } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config.js';
import { AppError } from '../errors.js';
import { prisma } from '../db.js';

export interface AuthContext {
  userId: string;
  orgId: string;
  role: string;
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      auth: AuthContext;
    }
  }
}

export function signToken(auth: AuthContext): string {
  return jwt.sign(auth, config.JWT_SECRET, { algorithm: 'HS256', expiresIn: '12h' });
}

export const requireAuth: RequestHandler = (req, _res, next) => {
  const header = req.headers.authorization ?? '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : '';
  try {
    const p = jwt.verify(token, config.JWT_SECRET, { algorithms: ['HS256'] }) as jwt.JwtPayload;
    req.auth = { userId: p.userId, orgId: p.orgId, role: p.role };
    next();
  } catch {
    next(new AppError(401, 'UNAUTHENTICATED', 'Missing or invalid token'));
  }
};

/** Upload routes need an active "processing" consent for the org (DPDP). */
export const requireConsent =
  (purpose: string): RequestHandler =>
  async (req, _res, next) => {
    try {
      const c = await prisma.consent.findFirst({
        where: { orgId: req.auth.orgId, purpose, withdrawnAt: null },
        select: { id: true },
      });
      if (!c) throw new AppError(403, 'CONSENT_REQUIRED', `Consent for "${purpose}" is required`);
      next();
    } catch (e) {
      next(e);
    }
  };
