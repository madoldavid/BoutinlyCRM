import crypto from 'node:crypto';
import { ApiError } from '../errors.js';
import type { UserRole } from '../../types.js';
import type { KeyManager } from './jwks.js';

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
  jti?: string;
}

function base64Url(input: Buffer | string) {
  return Buffer.from(input).toString('base64url');
}

function sign(data: string, secret: string) {
  return crypto.createHmac('sha256', secret).update(data).digest('base64url');
}

/**
 * Constant-time signature comparison. crypto.timingSafeEqual throws a
 * RangeError when the two buffers have different lengths instead of
 * returning false, which a malformed or truncated token's signature
 * segment can easily trigger — that would otherwise surface as an
 * unhandled 500 instead of the expected 401 (G-SEC-11).
 */
function signaturesMatch(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

export function issueToken(principal: Principal, secret: string, ttlSeconds: number, jti?: string) {
  const now = Math.floor(Date.now() / 1000);
  const header = base64Url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const payload = base64Url(JSON.stringify({ ...principal, iat: now, exp: now + ttlSeconds, ...(jti ? { jti } : {}) }));
  const signature = sign(`${header}.${payload}`, secret);
  return `${header}.${payload}.${signature}`;
}

/** Issue a token signed with the current key from KeyManager (includes kid in header). */
export function issueTokenWithKey(principal: Principal, keyManager: KeyManager, ttlSeconds: number, jti?: string) {
  const now = Math.floor(Date.now() / 1000);
  const payloadObj = { ...principal, iat: now, exp: now + ttlSeconds, ...(jti ? { jti } : {}) };
  const payload = base64Url(JSON.stringify(payloadObj));
  const headerObj = { alg: 'HS256', typ: 'JWT', kid: keyManager.getCurrentKey().version };
  const header = base64Url(JSON.stringify(headerObj));
  const { signature } = keyManager.sign(`${header}.${payload}`);
  return `${header}.${payload}.${signature}`;
}

export function verifyToken(token: string, secret: string): Principal {
  const [headerEnc, payloadEnc, signature] = token.split('.');
  if (!headerEnc || !payloadEnc || !signature) {
    throw new ApiError(401, 'Invalid bearer token.', 'invalid_token');
  }

  let header: any, parsed: TokenPayload;
  try {
    header = JSON.parse(Buffer.from(headerEnc, 'base64url').toString('utf8'));
    parsed = JSON.parse(Buffer.from(payloadEnc, 'base64url').toString('utf8')) as TokenPayload;
  } catch {
    throw new ApiError(401, 'Invalid bearer token.', 'invalid_token');
  }

  if (!signaturesMatch(signature, sign(`${headerEnc}.${payloadEnc}`, secret))) {
    throw new ApiError(401, 'Invalid bearer token.', 'invalid_token');
  }

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

/** Verify a token using KeyManager-aware multi-key verification. */
export function verifyTokenWithKeys(token: string, keyManager: KeyManager): Principal {
  const [headerEnc, payloadEnc, signature] = token.split('.');
  if (!headerEnc || !payloadEnc || !signature) {
    throw new ApiError(401, 'Invalid bearer token.', 'invalid_token');
  }

  let header: any, parsed: TokenPayload;
  try {
    header = JSON.parse(Buffer.from(headerEnc, 'base64url').toString('utf8'));
    parsed = JSON.parse(Buffer.from(payloadEnc, 'base64url').toString('utf8')) as TokenPayload;
  } catch {
    throw new ApiError(401, 'Invalid bearer token.', 'invalid_token');
  }
  const kid = header.kid || 'v1';

  const key = keyManager.getKey(kid);
  if (!key) {
    throw new ApiError(401, 'Unknown signing key version.', 'unknown_key');
  }
  if (!keyManager.verify(`${headerEnc}.${payloadEnc}`, signature, kid)) {
    throw new ApiError(401, 'Invalid bearer token.', 'invalid_token');
  }

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

/** Default refresh TTL (7 days) — override via REFRESH_TOKEN_TTL_SECONDS (G-SEC-08). */
export const REFRESH_TOKEN_TTL = 7 * 24 * 60 * 60;

export function issueRefreshToken(principal: Principal, secret: string, ttlSeconds: number = REFRESH_TOKEN_TTL, jti?: string) {
  const now = Math.floor(Date.now() / 1000);
  const header = base64Url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const payload = base64Url(JSON.stringify({ ...principal, type: 'refresh', iat: now, exp: now + ttlSeconds, ...(jti ? { jti } : {}) }));
  const signature = sign(`${header}.${payload}`, secret);
  return `${header}.${payload}.${signature}`;
}

export function verifyRefreshToken(token: string, secret: string): Principal {
  const [header, payload, signature] = token.split('.');
  if (!header || !payload || !signature) {
    throw new ApiError(401, 'Invalid refresh token.', 'invalid_token');
  }

  if (!signaturesMatch(signature, sign(`${header}.${payload}`, secret))) {
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
