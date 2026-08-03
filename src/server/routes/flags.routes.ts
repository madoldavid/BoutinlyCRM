/**
 * Feature-flag routes (G-AI-14 / G-OPS-06).
 *  - GET /api/flags          — effective flags for the caller's organization (any authenticated user)
 *  - GET /api/admin/flags    — flag list with sources (admin)
 *  - PUT /api/admin/flags/:key — toggle a flag globally or for the caller's org (admin; audited)
 *  - DELETE /api/admin/flags/:key/override — clear the org-level override (admin; audited)
 */
import type { Router } from 'express';
import { z } from 'zod';
import { UserRole } from '../../types.js';
import type { AppConfig } from '../config.js';
import { ApiError, asyncHandler } from '../errors.js';
import type { CrmRepository } from '../repositories/crmRepository.js';
import { authenticate, authorize, type AuthenticatedRequest } from '../security/rbac.js';
import type { FeatureFlagService } from '../services/featureFlags.js';

const adminRoles = [UserRole.SUPER_ADMIN, UserRole.ADMIN];

const updateFlagSchema = z.object({
  enabled: z.boolean(),
  scope: z.enum(['global', 'organization']).default('organization'),
});

const FLAG_KEY_PATTERN = /^[a-z0-9_.-]{1,100}$/;

export function registerFlagsRoutes(
  app: Router,
  config: AppConfig,
  repository: CrmRepository,
  featureFlags: FeatureFlagService,
) {
  app.get('/api/flags', authenticate(config), asyncHandler<AuthenticatedRequest>(async (req, res) => {
    const flags = featureFlags.list(req.principal.organizationId)
      .map(({ key, enabled }) => ({ key, enabled }));
    res.json({ flags });
  }));

  app.get('/api/admin/flags', authenticate(config), authorize(adminRoles), asyncHandler<AuthenticatedRequest>(async (req, res) => {
    res.json({ flags: featureFlags.list(req.principal.organizationId) });
  }));

  app.put('/api/admin/flags/:key', authenticate(config), authorize(adminRoles), asyncHandler<AuthenticatedRequest>(async (req, res) => {
    const key = req.params.key;
    if (!FLAG_KEY_PATTERN.test(key)) {
      throw new ApiError(400, 'Invalid flag key.', 'invalid_flag_key');
    }
    const body = updateFlagSchema.parse(req.body);

    if (body.scope === 'global') {
      // Global kill switches are reserved for super admins.
      if (req.principal.role !== UserRole.SUPER_ADMIN) {
        throw new ApiError(403, 'Only super admins can change global flags.', 'forbidden');
      }
      featureFlags.setGlobal(key, body.enabled);
    } else {
      featureFlags.setForOrganization(req.principal.organizationId, key, body.enabled);
    }

    await repository.addAuditLog({
      user_id: req.principal.userId,
      user_name: req.principal.email,
      action: 'feature_flag.changed',
      entity_type: 'feature_flag',
      entity_id: key,
      diff: { key, enabled: body.enabled, scope: body.scope },
      ip_address: String(req.ip || ''),
      user_agent: String(req.get('user-agent') || ''),
    });

    res.json({
      flag: featureFlags.list(req.principal.organizationId).find(f => f.key === key) ?? null,
    });
  }));

  app.delete('/api/admin/flags/:key/override', authenticate(config), authorize(adminRoles), asyncHandler<AuthenticatedRequest>(async (req, res) => {
    const key = req.params.key;
    const cleared = featureFlags.clearOrganizationOverride(req.principal.organizationId, key);

    if (cleared) {
      await repository.addAuditLog({
        user_id: req.principal.userId,
        user_name: req.principal.email,
        action: 'feature_flag.override_cleared',
        entity_type: 'feature_flag',
        entity_id: key,
        diff: { key },
        ip_address: String(req.ip || ''),
        user_agent: String(req.get('user-agent') || ''),
      });
    }

    res.json({ cleared });
  }));
}

/** Express middleware — gate an endpoint behind a feature flag. */
export function requireFlag(featureFlags: FeatureFlagService, key: string) {
  return (req: AuthenticatedRequest, _res: unknown, next: (err?: unknown) => void) => {
    const orgId = req.principal?.organizationId;
    if (!featureFlags.isEnabled(key, orgId)) {
      next(new ApiError(403, `Feature '${key}' is disabled.`, 'feature_disabled'));
      return;
    }
    next();
  };
}
