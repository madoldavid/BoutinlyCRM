/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Idempotency-Key support (G-DAT-12).
 *
 * Opt-in per request: any POST carrying an `Idempotency-Key` header has its
 * successful (2xx) JSON response cached for the configured TTL. Replaying the
 * same key against the same caller + endpoint returns the original response
 * (marked with `Idempotency-Replayed: true`) and creates nothing new.
 * Failed requests are not cached, so clients can safely retry after errors.
 *
 * The cache key is scoped by caller credentials + method + path + key, so
 * keys cannot collide across users or endpoints.
 *
 * NOTE: In-memory store (single instance). Migrates to the shared store with
 * G-SEC-01/G-DAT-01; the middleware contract stays the same.
 */
import crypto from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';
import { ApiError } from '../errors.js';

interface CachedResponse {
  status: number;
  body: unknown;
  expiresAt: number;
}

type Entry = CachedResponse | 'in-flight';

export function idempotencyMiddleware(options: { ttlMs: number }) {
  const store = new Map<string, Entry>();

  setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of store) {
      if (entry !== 'in-flight' && entry.expiresAt <= now) store.delete(key);
    }
  }, 60_000).unref();

  return (req: Request, res: Response, next: NextFunction) => {
    if (req.method !== 'POST') return next();
    const key = req.header('idempotency-key');
    if (!key) return next();
    if (key.length < 1 || key.length > 200) {
      throw new ApiError(400, 'Idempotency-Key must be 1-200 characters.', 'invalid_idempotency_key');
    }

    const caller = req.header('authorization') || req.ip || 'anonymous';
    const storeKey = crypto.createHash('sha256')
      .update(`${caller}|${req.method}|${req.path}|${key}`)
      .digest('hex');

    const existing = store.get(storeKey);
    if (existing === 'in-flight') {
      throw new ApiError(409, 'A request with this Idempotency-Key is still in progress.', 'idempotency_conflict');
    }
    if (existing && existing.expiresAt > Date.now()) {
      res.setHeader('Idempotency-Replayed', 'true');
      res.status(existing.status).json(existing.body);
      return;
    }

    store.set(storeKey, 'in-flight');

    const originalJson = res.json.bind(res);
    res.json = ((body: unknown) => {
      if (res.statusCode >= 200 && res.statusCode < 300) {
        store.set(storeKey, { status: res.statusCode, body, expiresAt: Date.now() + options.ttlMs });
      } else {
        // Do not cache failures — the client should be able to retry.
        store.delete(storeKey);
      }
      return originalJson(body);
    }) as Response['json'];

    // If the handler never produced JSON (stream, crash, abort), release the key.
    res.on('finish', () => {
      if (store.get(storeKey) === 'in-flight') store.delete(storeKey);
    });
    res.on('close', () => {
      if (store.get(storeKey) === 'in-flight') store.delete(storeKey);
    });

    next();
  };
}
