import type { Request, Response, NextFunction } from 'express';
import { ApiError } from '../errors.js';

interface WindowEntry {
  count: number;
  resetAt: number;
}

/**
 * In-memory sliding-window rate limiter.
 * Suitable for single-process deployments. For horizontal scaling,
 * replace with a Redis-backed implementation.
 */
export function createRateLimiter(opts: {
  windowMs: number;
  maxRequests: number;
  keyFn?: (req: Request) => string;
}) {
  const windows = new Map<string, WindowEntry>();
  const { windowMs, maxRequests, keyFn } = opts;

  // Periodically prune expired entries
  const pruneInterval = setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of windows) {
      if (entry.resetAt <= now) windows.delete(key);
    }
  }, Math.min(windowMs, 60_000)).unref();

  return (req: Request, _res: Response, next: NextFunction) => {
    const key = keyFn ? keyFn(req) : req.ip || req.socket.remoteAddress || 'unknown';
    const now = Date.now();
    const existing = windows.get(key);

    if (!existing || existing.resetAt <= now) {
      windows.set(key, { count: 1, resetAt: now + windowMs });
      return next();
    }

    existing.count++;
    if (existing.count > maxRequests) {
      const retryAfter = Math.ceil((existing.resetAt - now) / 1000);
      throw new ApiError(429, `Rate limit exceeded. Retry after ${retryAfter}s.`, 'rate_limit_exceeded');
    }

    next();
  };
}

// ─── Pre-built limiters ─────────────────────────

/** Global API limiter: 1000 requests per hour per IP */
export const globalLimiter = createRateLimiter({
  windowMs: 60 * 60 * 1000,
  maxRequests: 1000,
});

/** Auth endpoint limiter: 10 requests per minute per IP */
export const authLimiter = createRateLimiter({
  windowMs: 60 * 1000,
  maxRequests: 10,
});

/** Bootstrap endpoint limiter: 30 requests per hour per IP */
export const bootstrapLimiter = createRateLimiter({
  windowMs: 60 * 60 * 1000,
  maxRequests: 30,
});
