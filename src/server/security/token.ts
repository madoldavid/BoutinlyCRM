import crypto from 'node:crypto';
import { ApiError } from '../errors.js';
import type { UserRole } from '../../types.js';

export interface Principal {
  userId: string;
  email: string;
  role: UserRole;
  teamId?: string;
  organizationId: string;
}

interface TokenPayload extends Principal {
  exp: number;
  iat: number;
}

function base64Url(input: Buffer | string) {
  return Buffer.from(input).toString('base64url');
}

function sign(data: string, secret: string) {
  return crypto.createHmac('sha256', secret).update(data).digest('base64url');
}

export function issueToken(principal: Principal, secret: string, ttlSeconds: number) {
  const now = Math.floor(Date.now() / 1000);
  const header = base64Url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const payload = base64Url(JSON.stringify({ ...principal, iat: now, exp: now + ttlSeconds }));
  const signature = sign(`${header}.${payload}`, secret);
  return `${header}.${payload}.${signature}`;
}

export function verifyToken(token: string, secret: string): Principal {
  const [header, payload, signature] = token.split('.');
  if (!header || !payload || !signature) {
    throw new ApiError(401, 'Invalid bearer token.', 'invalid_token');
  }

  const expected = sign(`${header}.${payload}`, secret);
  if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) {
    throw new ApiError(401, 'Invalid bearer token.', 'invalid_token');
  }

  const parsed = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as TokenPayload;

  // Refresh tokens are not valid as access tokens
  if ((parsed as any).type === 'refresh') {
    throw new ApiError(401, 'Refresh token used as access token.', 'invalid_token');
  }

  if (parsed.exp < Math.floor(Date.now() / 1000)) {
    throw new ApiError(401, 'Expired bearer token.', 'expired_token');
  }

  return {
    userId: parsed.userId,
    email: parsed.email,
    role: parsed.role,
    teamId: parsed.teamId,
    organizationId: parsed.organizationId,
  };
}

// ─── Refresh tokens ──────────────────────────────────

const REFRESH_TTL = 7 * 24 * 60 * 60; // 7 days

export function issueRefreshToken(principal: Principal, secret: string) {
  const now = Math.floor(Date.now() / 1000);
  const header = base64Url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const payload = base64Url(JSON.stringify({ ...principal, type: 'refresh', iat: now, exp: now + REFRESH_TTL }));
  const signature = sign(`${header}.${payload}`, secret);
  return `${header}.${payload}.${signature}`;
}

export function verifyRefreshToken(token: string, secret: string): Principal {
  const [header, payload, signature] = token.split('.');
  if (!header || !payload || !signature) {
    throw new ApiError(401, 'Invalid refresh token.', 'invalid_token');
  }

  const expected = sign(`${header}.${payload}`, secret);
  if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) {
    throw new ApiError(401, 'Invalid refresh token.', 'invalid_token');
  }

  const parsed = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as TokenPayload & { type?: string };
  if (parsed.type !== 'refresh') {
    throw new ApiError(401, 'Not a refresh token.', 'invalid_token');
  }

  if (parsed.exp < Math.floor(Date.now() / 1000)) {
    throw new ApiError(401, 'Expired refresh token.', 'expired_token');
  }

  return {
    userId: parsed.userId,
    email: parsed.email,
    role: parsed.role,
    teamId: parsed.teamId,
    organizationId: parsed.organizationId,
  };
}

/** Short-lived access token (15 min default) */
export const ACCESS_TOKEN_TTL = 15 * 60;

/** MFA challenge token TTL (5 minutes) */
export const MFA_CHALLENGE_TTL = 5 * 60;

export function issueMfaChallengeToken(principal: Principal, secret: string) {
  return issueToken({ ...principal } as Principal, secret, MFA_CHALLENGE_TTL);
}

export function verifyMfaChallengeToken(token: string, secret: string): Principal {
  const principal = verifyToken(token, secret);
  return principal;
}
