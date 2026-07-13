import type { Router } from 'express';
import { z } from 'zod';
import type { AppConfig } from '../config.js';
import { ApiError, asyncHandler } from '../errors.js';
import type { CrmRepository } from '../repositories/crmRepository.js';
import { authenticate, type AuthenticatedRequest } from '../security/rbac.js';

const confirmPasswordSchema = z.object({
  password: z.string().min(1),
});

export function registerGdprRoutes(
  app: Router,
  config: AppConfig,
  repository: CrmRepository,
) {
  // Export all personal data (GDPR Art. 20 — Right to data portability)
  app.get('/api/gdpr/export', authenticate(config), asyncHandler<AuthenticatedRequest>(async (req, res) => {
    const userId = req.principal.userId;
    const user = await repository.getUserById(userId);
    if (!user) throw new ApiError(404, 'User not found.', 'user_not_found');

    const exportData = await repository.exportUserData(userId);
    res.json({
      exported_at: new Date().toISOString(),
      user,
      ...exportData,
    });
  }));

  // Delete account and personal data (GDPR Art. 17 — Right to erasure)
  app.post('/api/gdpr/delete', authenticate(config), asyncHandler<AuthenticatedRequest>(async (req, res) => {
    const { password } = confirmPasswordSchema.parse(req.body);
    const userId = req.principal.userId;

    // Require password re-verification before deletion
    const user = await repository.verifyLogin(req.principal.email, password);
    if (!user) {
      throw new ApiError(401, 'Invalid password.', 'invalid_credentials');
    }

    await repository.deleteUserData(userId);
    res.json({ message: 'Account and associated personal data have been deleted.' });
  }));
}
