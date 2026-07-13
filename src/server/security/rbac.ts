import type { NextFunction, Request, Response } from 'express';
import { UserRole } from '../../types.js';
import { ApiError } from '../errors.js';
import { verifyToken, type Principal } from './token.js';
import type { AppConfig } from '../config.js';

export interface AuthenticatedRequest extends Request {
  principal: Principal;
}

export function authenticate(config: AppConfig) {
  return (req: Request, _res: Response, next: NextFunction) => {
    const raw = req.header('authorization');
    if (!raw?.startsWith('Bearer ')) {
      next(new ApiError(401, 'Missing bearer token.', 'missing_token'));
      return;
    }

    try {
      (req as AuthenticatedRequest).principal = verifyToken(raw.slice('Bearer '.length), config.JWT_SECRET);
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
