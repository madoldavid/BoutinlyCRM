import type { Router } from 'express';
import { z } from 'zod';
import type { AppConfig } from '../config.js';
import { ApiError, asyncHandler } from '../errors.js';
import type { EmailService } from '../email/service.js';
import type { CrmRepository } from '../repositories/crmRepository.js';
import { authenticate, type AuthenticatedRequest } from '../security/rbac.js';
import { hashPassword } from '../security/password.js';
import { issueToken, issueMfaChallengeToken, verifyMfaChallengeToken, verifyRefreshToken, issueRefreshToken, ACCESS_TOKEN_TTL } from '../security/token.js';
import { generateTotpSecret, generateTotpUri, verifyTotp } from '../security/totp.js';
import { forgotPasswordSchema, loginSchema, resetPasswordSchema, signupSchema } from '../validation/schemas.js';
import { runWithTenant } from '../db/connection.js';
import type { User } from '../../types.js';
import { UserRole } from '../../types.js';

const refreshSchema = z.object({
  refresh_token: z.string().min(1),
});

const mfaChallengeSchema = z.object({
  mfa_token: z.string().min(1),
  code: z.string().length(6),
});

const mfaSetupSchema = z.object({
  code: z.string().length(6),
});

const disableMfaSchema = z.object({
  password: z.string().min(1),
});

function makePrincipal(user: User) {
  return {
    userId: user.id,
    email: user.email,
    role: user.role,
    teamId: user.team_id,
    organizationId: user.organization_id || '',
  };
}

function slugify(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').substring(0, 50);
}

export function registerAuthRoutes(
  app: Router,
  config: AppConfig,
  repository: CrmRepository,
  emailService: EmailService,
) {
  app.post('/api/auth/signup', asyncHandler(async (req, res) => {
    // Only allow signup when no users exist (first-user self-registration)
    const userCount = await repository.countUsers();
    if (userCount > 0) {
      throw new ApiError(403, 'Signup is disabled. Contact your administrator.', 'signup_disabled');
    }

    const body = signupSchema.parse(req.body);
    const passwordHash = await hashPassword(body.password, config.PASSWORD_PEPPER);
    const org = await repository.createOrganization(body.company_name, slugify(body.company_name));

    // Create user, pipeline, and stages inside tenant context
    const result = await runWithTenant(org.id, async () => {
      const user = await repository.addUserWithPassword({
        name: body.name,
        email: body.email,
        passwordHash,
        role: UserRole.SUPER_ADMIN,
        organization_id: org.id,
      });

      const pipeline = await repository.addPipeline({
        name: `${body.company_name} Sales Pipeline`,
        is_default: true,
      });

      // Create default stages (7 stages matching a standard sales pipeline)
      await repository.addStage({ pipeline_id: pipeline.id, name: 'Lead Generated', probability: 10, order: 1, type: 'open' });
      await repository.addStage({ pipeline_id: pipeline.id, name: 'Qualified Opportunity', probability: 25, order: 2, type: 'open' });
      await repository.addStage({ pipeline_id: pipeline.id, name: 'Solution Demo', probability: 50, order: 3, type: 'open' });
      await repository.addStage({ pipeline_id: pipeline.id, name: 'Proposal Sent', probability: 75, order: 4, type: 'open' });
      await repository.addStage({ pipeline_id: pipeline.id, name: 'Contract Negotiation', probability: 90, order: 5, type: 'open' });
      await repository.addStage({ pipeline_id: pipeline.id, name: 'Closed Won', probability: 100, order: 6, type: 'won' });
      await repository.addStage({ pipeline_id: pipeline.id, name: 'Closed Lost', probability: 0, order: 7, type: 'lost' });

      // Log audit entries
      await repository.addAuditLog({
        action: 'organization.created',
        entity_type: 'organization',
        entity_id: org.id,
        user_name: body.name,
        ip_address: req.ip || 'unknown',
        user_agent: req.headers['user-agent'] || 'unknown',
        diff: { name: body.company_name, slug: org.slug },
      });

      await repository.addAuditLog({
        action: 'user.signup',
        entity_type: 'user',
        entity_id: user.id,
        user_name: body.name,
        ip_address: req.ip || 'unknown',
        user_agent: req.headers['user-agent'] || 'unknown',
        diff: { email: body.email, role: UserRole.SUPER_ADMIN },
      });

      const principal = makePrincipal(user);
      const token = issueToken(principal, config.JWT_SECRET, ACCESS_TOKEN_TTL);
      const refreshToken = issueRefreshToken(principal, config.JWT_SECRET);

      return { token, refresh_token: refreshToken, user };
    });

    res.status(201).json(result);
  }));

  app.post('/api/auth/login', asyncHandler(async (req, res) => {
    if (!config.DEMO_LOGIN_ENABLED && config.NODE_ENV !== 'test') {
      throw new ApiError(403, 'Password login is disabled until the identity provider is configured.', 'login_disabled');
    }

    const body = loginSchema.parse(req.body);
    const user = await repository.verifyLogin(body.email, body.password);
    if (!user) {
      // Log failed login attempt for security auditing
      repository.addAuditLog({
        action: 'login_failed',
        entity_type: 'user',
        user_name: body.email,
        ip_address: req.ip || 'unknown',
        user_agent: req.headers['user-agent'] || 'unknown',
        diff: { email: body.email },
      }).catch(() => { /* fire-and-forget, don't block error response */ });
      throw new ApiError(401, 'Invalid email or password.', 'invalid_credentials');
    }

    const principal = makePrincipal(user);

    // If MFA is enabled, require TOTP challenge before issuing full tokens
    if (user.mfa_enabled) {
      const mfaToken = issueMfaChallengeToken(principal, config.JWT_SECRET);
      res.json({ mfa_required: true, mfa_token: mfaToken, user_id: user.id });
      return;
    }

    const token = issueToken(principal, config.JWT_SECRET, ACCESS_TOKEN_TTL);
    const refreshToken = issueRefreshToken(principal, config.JWT_SECRET);

    res.json({ token, refresh_token: refreshToken, user });
  }));

  app.post('/api/auth/mfa/challenge', asyncHandler(async (req, res) => {
    const { mfa_token, code } = mfaChallengeSchema.parse(req.body);
    const principal = verifyMfaChallengeToken(mfa_token, config.JWT_SECRET);

    const secret = await repository.getTotpSecret(principal.userId);
    if (!secret || !verifyTotp(secret, code)) {
      throw new ApiError(401, 'Invalid MFA code.', 'invalid_mfa_code');
    }

    const user = await repository.getUserById(principal.userId);
    if (!user || !user.is_active) {
      throw new ApiError(401, 'User no longer active.', 'user_inactive');
    }

    const newPrincipal = makePrincipal(user);
    const token = issueToken(newPrincipal, config.JWT_SECRET, ACCESS_TOKEN_TTL);
    const refreshToken = issueRefreshToken(newPrincipal, config.JWT_SECRET);

    res.json({ token, refresh_token: refreshToken, user });
  }));

  app.post('/api/auth/mfa/setup', authenticate(config), asyncHandler<AuthenticatedRequest>(async (req, res) => {
    const user = await repository.getUserById(req.principal.userId);
    if (!user) throw new ApiError(404, 'User not found.', 'user_not_found');

    // Generate a fresh secret each time setup is initiated
    const secret = generateTotpSecret();
    await repository.setTotpSecret(user.id, secret);

    const uri = generateTotpUri(secret, user.email);
    res.json({ secret, uri });
  }));

  app.post('/api/auth/mfa/verify', authenticate(config), asyncHandler<AuthenticatedRequest>(async (req, res) => {
    const { code } = mfaSetupSchema.parse(req.body);
    const user = await repository.getUserById(req.principal.userId);
    if (!user) throw new ApiError(404, 'User not found.', 'user_not_found');
    if (user.mfa_enabled) throw new ApiError(400, 'MFA is already enabled.', 'mfa_already_enabled');

    const secret = await repository.getTotpSecret(user.id);
    if (!secret || !verifyTotp(secret, code)) {
      throw new ApiError(400, 'Invalid verification code.', 'invalid_mfa_setup_code');
    }

    await repository.enableMfa(user.id);
    res.json({ message: 'MFA has been enabled.' });
  }));

  app.post('/api/auth/mfa/disable', authenticate(config), asyncHandler<AuthenticatedRequest>(async (req, res) => {
    const { password } = disableMfaSchema.parse(req.body);

    // Verify password before disabling MFA
    const user = await repository.verifyLogin(req.principal.email, password);
    if (!user) {
      throw new ApiError(401, 'Invalid password.', 'invalid_credentials');
    }

    await repository.disableMfa(req.principal.userId);
    res.json({ message: 'MFA has been disabled.' });
  }));

  app.post('/api/auth/forgot-password', asyncHandler(async (req, res) => {
    const { email } = forgotPasswordSchema.parse(req.body);
    const user = await repository.getUserByEmail(email);
    // Always return success to prevent email enumeration
    if (user && user.is_active) {
      const rawToken = await repository.storePasswordResetToken(user.id);
      try {
        await emailService.sendPasswordResetEmail(user.email, rawToken);
      } catch (err) {
        // Log but don't reveal failure to the caller
        req.log?.error?.({ err }, 'Failed to send password reset email');
      }
      // In non-production, also return the token for debugging
      if (config.NODE_ENV !== 'production') {
        res.json({ message: 'If the email is registered, a reset link has been sent.', debug_token: rawToken });
        return;
      }
    }
    res.json({ message: 'If the email is registered, a reset link has been sent.' });
  }));

  app.post('/api/auth/reset-password', asyncHandler(async (req, res) => {
    const { token, password } = resetPasswordSchema.parse(req.body);
    const userId = await repository.consumePasswordResetToken(token);
    if (!userId) {
      throw new ApiError(400, 'Invalid or expired reset token.', 'invalid_reset_token');
    }
    const passwordHash = await hashPassword(password, config.PASSWORD_PEPPER);
    await repository.updateUserPassword(userId, passwordHash);
    res.json({ message: 'Password has been reset successfully.' });
  }));

  app.post('/api/auth/refresh', asyncHandler(async (req, res) => {
    const body = refreshSchema.parse(req.body);
    const principal = verifyRefreshToken(body.refresh_token, config.JWT_SECRET);

    // Verify user still exists and is active
    const user = await repository.getUserById(principal.userId);
    if (!user || !user.is_active) {
      throw new ApiError(401, 'User no longer active.', 'user_inactive');
    }

    const newPrincipal = makePrincipal(user);
    const token = issueToken(newPrincipal, config.JWT_SECRET, ACCESS_TOKEN_TTL);
    const refreshToken = issueRefreshToken(newPrincipal, config.JWT_SECRET);

    res.json({ token, refresh_token: refreshToken });
  }));

  app.get('/api/auth/me', authenticate(config), asyncHandler<AuthenticatedRequest>(async (req, res) => {
    const user = await repository.getUserById(req.principal.userId);
    if (!user) throw new ApiError(404, 'Authenticated user no longer exists.', 'user_not_found');
    res.json(user);
  }));
}
