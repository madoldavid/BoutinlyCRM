import type { NextFunction, Request, Response } from 'express';
import { UserRole } from '../../types.js';
import { ApiError } from '../errors.js';
import { verifyToken, verifyTokenWithKeys, type Principal } from './token.js';
import type { AppConfig } from '../config.js';
import type { KeyManager } from './jwks.js';
import type { TokenBlocklist } from './tokenBlocklist.js';
import { runWithTenant } from '../db/connection.js';

export interface AuthenticatedRequest extends Request {
  principal: Principal;
}

let _keyManager: KeyManager | undefined;
let _tokenBlocklist: TokenBlocklist | undefined;

/** Set the global key manager and token blocklist for authenticate() to use. */
export function setAuthDeps(keyManager?: KeyManager, tokenBlocklist?: TokenBlocklist) {
  _keyManager = keyManager;
  _tokenBlocklist = tokenBlocklist;
}

export function authenticate(config: AppConfig) {
  return (req: Request, _res: Response, next: NextFunction) => {
    const raw = req.header('authorization');
    if (!raw?.startsWith('Bearer ')) {
      next(new ApiError(401, 'Missing bearer token.', 'missing_token'));
      return;
    }

    try {
      const token = raw.slice('Bearer '.length);
      const principal = _keyManager
        ? verifyTokenWithKeys(token, _keyManager)
        : verifyToken(token, config.JWT_SECRET);

      // Check token blocklist for revoked tokens
      if (_tokenBlocklist) {
        try {
          const [, payloadEnc] = token.split('.');
          const payload = JSON.parse(Buffer.from(payloadEnc, 'base64url').toString());
          if (payload.jti && _tokenBlocklist.isBlocked(payload.jti)) {
            next(new ApiError(401, 'Token has been revoked.', 'token_revoked'));
            return;
          }
        } catch { /* best effort — if we can't parse, let verifyToken handle it */ }
      }

      (req as AuthenticatedRequest).principal = principal;
      // Set tenant context from the verified principal's organizationId
      runWithTenant(principal.organizationId, () => next());
    } catch (error) {
      next(error);
    }
  };
}

export function authorize(roles: UserRole[]) {
  return (req: Request, _res: Response, next: NextFunction) => {
    const principal = (req as AuthenticatedRequest).principal;
    if (!roles.includes(principal.role)) {
      next(new ApiError(403, 'Insufficient role permissions.', 'forbidden'));
      return;
    }
    next();
  };
}

export function requireWriteAccess(req: AuthenticatedRequest) {
  if (req.principal.role === UserRole.VIEWER) {
    throw new ApiError(403, 'Viewers cannot modify CRM records.', 'read_only_role');
  }
}

/**
 * Enforce that a single record fetched by ID actually belongs to the caller's
 * organization before it's returned or mutated. Throws 404 (not 403) so a
 * cross-tenant probe can't distinguish "doesn't exist" from "exists, but not
 * yours" (G-SEC-11).
 *
 * Records with no organization_id at all are treated as inaccessible rather
 * than globally visible — callers that legitimately need org-less/global
 * records should check for that explicitly before calling this.
 */
export function assertOwnedByOrg(record: { organization_id?: string } | null | undefined, principal: Principal): void {
  if (!record || record.organization_id !== principal.organizationId) {
    throw new ApiError(404, 'Record not found.', 'not_found');
  }
}

export function canAccessOwner(principal: Principal, ownerId: string, ownerTeamId?: string) {
  if ([UserRole.SUPER_ADMIN, UserRole.ADMIN].includes(principal.role)) {
    return true;
  }
  if (principal.role === UserRole.VIEWER) {
    // Viewers can only see records — never modify ownership
    return false;
  }
  if (principal.role === UserRole.MANAGER) {
    return Boolean(principal.teamId && ownerTeamId && principal.teamId === ownerTeamId);
  }
  return ownerId === principal.userId;
}
