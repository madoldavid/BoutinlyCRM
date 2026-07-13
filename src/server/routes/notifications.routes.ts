import type { Router } from 'express';
import type { AppConfig } from '../config.js';
import { ApiError, asyncHandler } from '../errors.js';
import type { CrmRepository } from '../repositories/crmRepository.js';
import { authenticate, type AuthenticatedRequest } from '../security/rbac.js';

export function registerNotificationsRoutes(
  app: Router,
  config: AppConfig,
  repository: CrmRepository,
) {
  app.get('/api/notifications', authenticate(config), asyncHandler<AuthenticatedRequest>(async (req, res) => {
    const notifications = await repository.listNotifications(req.principal.userId);
    res.json({ notifications });
  }));

  app.post('/api/notifications/:id/read', authenticate(config), asyncHandler<AuthenticatedRequest>(async (req, res) => {
    // Verify ownership before marking read
    const existing = await repository.getNotificationById(req.params.id);
    if (!existing) throw new ApiError(404, 'Notification not found.', 'not_found');
    if (existing.user_id !== req.principal.userId) {
      throw new ApiError(403, 'Cannot modify another user\'s notification.', 'forbidden');
    }
    const notification = await repository.markNotificationRead(req.params.id);
    res.json({ notification });
  }));

  app.post('/api/notifications/read-all', authenticate(config), asyncHandler<AuthenticatedRequest>(async (req, res) => {
    await repository.markAllNotificationsRead(req.principal.userId);
    res.json({ ok: true });
  }));
}
