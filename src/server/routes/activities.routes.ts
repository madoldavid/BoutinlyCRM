import type { Router } from 'express';
import type { AppConfig } from '../config.js';
import { asyncHandler } from '../errors.js';
import type { CrmRepository } from '../repositories/crmRepository.js';
import { scopeSnapshot } from '../repositories/scope.js';
import { authenticate, requireWriteAccess, type AuthenticatedRequest } from '../security/rbac.js';
import { activityQuerySchema, createActivitySchema } from '../validation/schemas.js';

export function registerActivitiesRoutes(
  app: Router,
  config: AppConfig,
  repository: CrmRepository,
) {
  app.get('/api/activities', authenticate(config), asyncHandler<AuthenticatedRequest>(async (req, res) => {
    const query = activityQuerySchema.parse(req.query);

    // Load activities with repository-side filters (DB-side WHERE for Postgres)
    const activities = await repository.listActivities({
      contact_id: query.contact_id,
      deal_id: query.deal_id,
      lead_id: query.lead_id,
      user_id: query.user_id,
    });

    // RBAC scoping: load users, contacts, deals for visibility checks
    const users = await repository.listUsers();
    const contacts = await repository.listContacts();
    const deals = await repository.listDeals();
    const scoped = scopeSnapshot({
      users, contacts, deals, activities,
      leads: [], accounts: [], pipelines: [], stages: [], tasks: [],
      notifications: [], customFields: [], emailTemplates: [], emailCampaigns: [], auditLogs: [],
    }, req.principal);

    // Paginate after scoping
    const total = scoped.activities.length;
    const offset = (query.page - 1) * query.limit;
    const paged = scoped.activities.slice(offset, offset + query.limit);

    res.json({ activities: paged, total, page: query.page, limit: query.limit });
  }));

  app.post('/api/activities', authenticate(config), asyncHandler<AuthenticatedRequest>(async (req, res) => {
    requireWriteAccess(req);
    const body = createActivitySchema.parse(req.body);
    const activity = await repository.addActivity(body);

    await repository.addAuditLog({
      user_id: req.principal.userId,
      user_name: req.principal.email,
      action: 'activity.created',
      entity_type: 'activity',
      entity_id: activity.id,
      diff: { type: activity.type, title: activity.title },
      ip_address: String(req.ip || ''),
      user_agent: String(req.get('user-agent') || ''),
    });

    res.status(201).json({ activity });
  }));
}
