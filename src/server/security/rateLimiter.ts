import type { Request, Response, NextFunction } from 'express';
import { ApiError } from '../errors.js';

interface WindowEntry {
  count: number;
  resetAt: number;
}

interface RateLimiterOpts {
  windowMs: number;
  maxRequests: number;
  keyFn?: (req: Request) => string;
}

/** Unified rate limiter interface — works with any backend */
export interface RateLimiter {
  middleware: (req: Request, res: Response, next: NextFunction) => void;
}

/**
 * In-memory sliding-window rate limiter.
 * Suitable for single-process deployments.
 */
export function createRateLimiter(opts: RateLimiterOpts): RateLimiter {
  const windows = new Map<string, WindowEntry>();
  const { windowMs, maxRequests, keyFn } = opts;

  const pruneInterval = setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of windows) {
      if (entry.resetAt <= now) windows.delete(key);
    }
  }, Math.min(windowMs, 60_000)).unref();

  const middleware = (req: Request, _res: Response, next: NextFunction) => {
    if (process.env.NODE_ENV === 'test' || process.env.NODE_ENV === 'development') return next();
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

  return { middleware };
}

/**
 * Redis-backed sliding-window rate limiter.
 * Uses Lua scripting for atomicity. Falls back to in-memory if Redis is unavailable.
 */
export async function createRedisRateLimiter(opts: RateLimiterOpts): Promise<RateLimiter> {
  const redisUrl = process.env.REDIS_URL;

  if (!redisUrl) {
    // No Redis configured — use in-memory fallback
    console.warn('REDIS_URL not set — using in-memory rate limiter (not suitable for multi-instance deployments)');
    return createRateLimiter(opts);
  }

  try {
    // Dynamic import to keep ioredis optional
    const { Redis } = await eval('import("ioredis")');
    const redis = new Redis(redisUrl, { maxRetriesPerRequest: 2, lazyConnect: true });

    try {
      await redis.connect();
    } catch {
      console.warn('Redis connection failed — falling back to in-memory rate limiter');
      return createRateLimiter(opts);
    }

    const luaScript = `
      local key = KEYS[1]
      local maxRequests = tonumber(ARGV[1])
      local windowMs = tonumber(ARGV[2])
      local now = tonumber(ARGV[3])
      local current = redis.call('GET', key)
      if current == false then
        redis.call('SET', key, 1, 'PX', windowMs)
        return {1, windowMs}
      end
      local count = tonumber(current) + 1
      local ttl = redis.call('PTTL', key)
      redis.call('SET', key, count, 'PX', ttl)
      if count > maxRequests then
        return {count, ttl}
      end
      return {count, ttl}
    `;

    const middleware = async (req: Request, _res: Response, next: NextFunction) => {
      const key = `ratelimit:${opts.keyFn ? opts.keyFn(req) : req.ip || req.socket.remoteAddress || 'unknown'}`;
      const now = Date.now();

      try {
        const [count, ttl] = await redis.eval(
          luaScript, 1, key,
          opts.maxRequests.toString(),
          opts.windowMs.toString(),
          now.toString(),
        ) as [number, number];

        if (count > opts.maxRequests) {
          const retryAfter = Math.ceil(ttl / 1000);
          throw new ApiError(429, `Rate limit exceeded. Retry after ${retryAfter}s.`, 'rate_limit_exceeded');
        }
      } catch (err) {
        if (err instanceof ApiError) throw err;
        // Redis error — allow the request through
        console.warn('Redis rate limiter error, allowing request:', (err as Error).message);
      }
      next();
    };

    return { middleware };
  } catch {
    console.warn('ioredis not installed — using in-memory rate limiter');
    return createRateLimiter(opts);
  }
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
