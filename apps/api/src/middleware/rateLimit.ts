import type { RequestHandler } from 'express';
import { AppError } from '../errors.js';

/** Simple fixed-window, in-memory, per-IP limiter for public routes (single API process). */
export function rateLimit(limitPerMinute: number): RequestHandler {
  const windowMs = 60_000;
  const hits = new Map<string, { count: number; resetAt: number }>();
  return (req, _res, next) => {
    const now = Date.now();
    if (hits.size > 10_000) {
      for (const [ip, h] of hits) if (h.resetAt <= now) hits.delete(ip);
    }
    const ip = req.ip ?? 'unknown';
    const h = hits.get(ip);
    if (!h || h.resetAt <= now) {
      hits.set(ip, { count: 1, resetAt: now + windowMs });
      next();
      return;
    }
    h.count += 1;
    if (h.count > limitPerMinute) {
      next(new AppError(429, 'RATE_LIMITED', 'Too many requests, try again in a minute'));
      return;
    }
    next();
  };
}
