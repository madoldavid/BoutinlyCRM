/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * CSRF protection via double-submit cookie pattern.
 * On first authenticated GET, issues a cryptographically random token as a cookie
 * (SameSite=Strict, HttpOnly=false so JS can read it for the custom header).
 * All mutating requests must include the matching token in the X-CSRF-Token header.
 */

import { randomBytes } from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';
import { ApiError } from '../errors.js';

/** Minimal cookie parser — avoids adding cookie-parser dependency */
export function parseCookies(req: Request): Record<string, string> {
  const header = req.headers.cookie;
  if (!header) return {};
  const cookies: Record<string, string> = {};
  for (const pair of header.split(';')) {
    const eq = pair.indexOf('=');
    if (eq > 0) {
      cookies[pair.substring(0, eq).trim()] = decodeURIComponent(pair.substring(eq + 1).trim());
    }
  }
  return cookies;
}

const isProd = process.env.NODE_ENV === 'production';
const CSRF_COOKIE = isProd ? '__Host-boutinly-csrf' : 'boutinly-csrf';
const CSRF_HEADER = 'x-csrf-token';
const CSRF_TOKEN_LENGTH = 32;

// Exempt paths that don't need CSRF (login, health, static files)
const CSRF_EXEMPT_PATHS = ['/api/health', '/api/auth/login', '/api/auth/signup',
  '/api/auth/refresh', '/api/auth/forgot-password', '/api/auth/reset-password',
  '/api/auth/mfa/challenge', '/api/auth/oidc'];

const MUTATING_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

function generateToken(): string {
  return randomBytes(CSRF_TOKEN_LENGTH).toString('base64url');
}

/**
 * CSRF middleware.
 * - Issues a CSRF token cookie on the first GET request that doesn't have one.
 * - Validates X-CSRF-Token header matches cookie on all mutating methods.
 * - Skips validation for exempt paths (login, health, etc.).
 */
export function csrfProtection() {
  return (req: Request, res: Response, next: NextFunction) => {
    const isExempt = CSRF_EXEMPT_PATHS.some(p => req.path.startsWith(p));

    // Issue or refresh the CSRF cookie on safe reads
    if (!MUTATING_METHODS.has(req.method)) {
      const existing = req.cookies?.[CSRF_COOKIE];
      if (!existing) {
        const token = generateToken();
        res.cookie(CSRF_COOKIE, token, {
          httpOnly: false,       // JS must read it for the custom header
          sameSite: 'strict',
          secure: process.env.NODE_ENV === 'production',
          path: '/',
          maxAge: 24 * 60 * 60 * 1000, // 24 hours
        });
        // Also expose in a response header so the SPA can cache it
        res.setHeader('X-CSRF-Token', token);
      }
      return next();
    }

    // Tests bypass unconditionally (supertest doesn't manage cookies).
    // Everywhere else, CSRF is enforced unless a developer explicitly opts
    // out — deliberately NOT keyed off NODE_ENV=="development", since a real
    // deployment that simply forgets to export NODE_ENV=production would
    // otherwise silently lose CSRF protection with no warning (G-SEC-11).
    // Set DISABLE_CSRF=true in your local .env for API-testing convenience.
    if (process.env.NODE_ENV === 'test' || process.env.DISABLE_CSRF === 'true') return next();

    // Validate CSRF on mutating methods (skip exempt paths)
    if (isExempt) return next();

    const cookieToken = req.cookies?.[CSRF_COOKIE];
    const headerToken = req.headers[CSRF_HEADER] as string | undefined;

    if (!cookieToken || !headerToken) {
      throw new ApiError(403, `CSRF token missing. Include ${CSRF_HEADER} header matching the ${CSRF_COOKIE} cookie.`, 'csrf_missing');
    }

    // Constant-time comparison to prevent timing attacks
    if (!timingSafeEqual(cookieToken, headerToken)) {
      throw new ApiError(403, 'CSRF token mismatch. Request rejected.', 'csrf_mismatch');
    }

    next();
  };
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let result = 0;
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  for (let i = 0; i < bufA.length; i++) {
    result |= bufA[i] ^ bufB[i];
  }
  return result === 0;
}
