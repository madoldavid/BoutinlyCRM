/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * OIDC SSO routes — Google Workspace & Microsoft Entra ID login.
 */

import type { Router } from 'express';
import { UserRole } from '../../types.js';
import type { AppConfig } from '../config.js';
import { ApiError, asyncHandler } from '../errors.js';
import type { CrmRepository } from '../repositories/crmRepository.js';
import { hashPassword } from '../security/password.js';
import { issueTokenWithKey, issueRefreshToken } from '../security/token.js';
import type { KeyManager } from '../security/jwks.js';
import { generateJti } from '../security/tokenBlocklist.js';
import { OidcService } from '../services/oidcService.js';
import type { AppLogger } from '../logger.js';
import type { User } from '../../types.js';

function makePrincipal(user: User) {
  return {
    userId: user.id,
    email: user.email,
    role: user.role,
    teamId: user.team_id,
    organizationId: user.organization_id || '',
  };
}

export function registerOidcRoutes(
  app: Router,
  config: AppConfig,
  repository: CrmRepository,
  logger: AppLogger,
  keyManager: KeyManager,
) {
  const oidcService = new OidcService(config, logger);

  // List configured SSO providers
  app.get('/api/auth/oidc/providers', (_req, res) => {
    const providers = oidcService.getConfiguredProviders();
    res.json({ providers });
  });

  // Initiate SSO login
  app.get('/api/auth/oidc/login/:provider', asyncHandler(async (req, res) => {
    const provider = req.params.provider;
    if (provider !== 'google' && provider !== 'microsoft') {
      throw new ApiError(400, 'Provider must be "google" or "microsoft".', 'invalid_provider');
    }

    const redirectAfter = (req.query.redirect as string) || '/';
    try {
      const url = await oidcService.getAuthorizationUrl(provider, redirectAfter);
      res.redirect(url);
    } catch (err) {
      throw new ApiError(500, `SSO login failed: ${err instanceof Error ? err.message : 'Unknown error'}`, 'oidc_error');
    }
  }));

  // OIDC callback
  app.get('/api/auth/oidc/callback/:provider', asyncHandler(async (req, res) => {
    const provider = req.params.provider;
    if (provider !== 'google' && provider !== 'microsoft') {
      throw new ApiError(400, 'Provider must be "google" or "microsoft".', 'invalid_provider');
    }

    const { code, state, error: oauthError } = req.query;
    if (oauthError) {
      res.redirect(`${config.APP_URL}/login?oidc_error=${encodeURIComponent(String(oauthError))}`);
      return;
    }
    if (!code || !state) {
      res.redirect(`${config.APP_URL}/login?oidc_error=missing_code_or_state`);
      return;
    }

    try {
      const profile = await oidcService.exchangeCode(provider, String(code), String(state));
      if (!profile) {
        res.redirect(`${config.APP_URL}/login?oidc_error=token_exchange_failed`);
        return;
      }

      // Find existing user by email or create one
      let user = await repository.getUserByEmail(profile.email);

      if (!user) {
        // Open registration: any new OIDC user is provisioned with their own
        // org and becomes its System Admin (Salesforce-style org provisioning).
        const { runWithTenant } = await import('../db/connection.js');
        const orgEntity = await repository.createOrganization(profile.name || 'My Company', profile.email.split('@')[1] || 'company');
        const passwordHash = await hashPassword(randomId(), config.PASSWORD_PEPPER);

        // Wrap org-scoped operations in tenant context for Postgres RLS
        await runWithTenant(orgEntity.id, async () => {
          user = await repository.addUserWithPassword({
            name: profile.name || profile.email,
            email: profile.email,
            passwordHash,
            role: UserRole.SUPER_ADMIN,
            organization_id: orgEntity.id,
          });

          await repository.addAuditLog({
            action: 'user.oidc_signup',
            entity_type: 'user',
            entity_id: user.id,
            user_name: profile.name || profile.email,
            diff: { provider, email: profile.email },
            ip_address: String(req.ip || ''),
            user_agent: String(req.get('user-agent') || ''),
          });
        });
      }

      if (!user.is_active) {
        res.redirect(`${config.APP_URL}/login?oidc_error=account_disabled`);
        return;
      }

      const principal = makePrincipal(user);
      const token = issueTokenWithKey(principal, keyManager, config.ACCESS_TOKEN_TTL_SECONDS, generateJti());
      const refreshToken = issueRefreshToken(principal, config.JWT_SECRET, config.REFRESH_TOKEN_TTL_SECONDS, generateJti());

      await repository.addAuditLog({
        user_id: user.id,
        user_name: user.email,
        action: 'user.oidc_login',
        entity_type: 'user',
        entity_id: user.id,
        diff: { provider },
        ip_address: String(req.ip || ''),
        user_agent: String(req.get('user-agent') || ''),
      });

      // Redirect to frontend with token in URL fragment
      const redirectAfter = oidcService.getRedirectAfter(String(state));
      res.redirect(`${config.APP_URL}${redirectAfter}#token=${encodeURIComponent(token)}&refresh_token=${encodeURIComponent(refreshToken)}`);
    } catch (err) {
      logger.error({ err, provider }, 'OIDC callback error');
      res.redirect(`${config.APP_URL}/login?oidc_error=${encodeURIComponent(err instanceof Error ? err.message : 'Unexpected error')}`);
    }
  }));
}

function randomId(): string {
  return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
}
