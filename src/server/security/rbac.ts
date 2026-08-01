import type { NextFunction, Request, Response } from 'express';
import { UserRole } from '../../types.js';
import { ApiError } from '../errors.js';
import { verifyToken, verifyTokenWithKeys, type Principal } from './token.js';
import type { AppConfig } from '../config.js';
import type { KeyManager } from './jwks.js';
import type { TokenBlocklist } from './tokenBlocklist.js';

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
      next();
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

export function canAccessOwner(principal: Principal, ownerId: string, ownerTeamId?: string) {
  if ([UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.VIEWER].includes(principal.role)) {
    return true;
  }
  if (principal.role === UserRole.MANAGER) {
    return Boolean(principal.teamId && ownerTeamId && principal.teamId === ownerTeamId);
  }
  return ownerId === principal.userId;
}
