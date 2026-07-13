import type { Router } from 'express';
import { UserRole } from '../../types.js';
import type { AppConfig } from '../config.js';
import { ApiError, asyncHandler } from '../errors.js';
import type { CrmRepository } from '../repositories/crmRepository.js';
import { authenticate, authorize, type AuthenticatedRequest } from '../security/rbac.js';
import {
  createCustomFieldSchema,
  inviteUserSchema,
  paginationSchema,
  updateUserRoleSchema,
} from '../validation/schemas.js';

const adminRoles = [UserRole.SUPER_ADMIN, UserRole.ADMIN];

export function registerAdminRoutes(
  app: Router,
  config: AppConfig,
  repository: CrmRepository,
) {
  // ─── Users ──────────────────────────────────────────

  app.get('/api/users', authenticate(config), authorize(adminRoles), asyncHandler(async (_req, res) => {
    const users = await repository.listUsers();
    res.json({ users });
  }));

  app.post('/api/users/invite', authenticate(config), authorize(adminRoles), asyncHandler<AuthenticatedRequest>(async (req, res) => {
    const body = inviteUserSchema.parse(req.body);
    const user = await repository.addUser(body);

    await repository.addAuditLog({
      user_id: req.principal.userId,
      user_name: req.principal.email,
      action: 'user.invited',
      entity_type: 'user',
      entity_id: user.id,
      diff: { email: body.email, role: body.role },
      ip_address: String(req.ip || ''),
      user_agent: String(req.get('user-agent') || ''),
    });

    res.status(201).json({ user });
  }));

  app.put('/api/users/:id/role', authenticate(config), authorize(adminRoles), asyncHandler<AuthenticatedRequest>(async (req, res) => {
    const body = updateUserRoleSchema.parse(req.body);
    if (req.params.id === req.principal.userId) {
      throw new ApiError(400, 'Cannot change your own role.', 'self_role_change');
    }

    const user = await repository.updateUserRole(req.params.id, body.role);
    if (!user) throw new ApiError(404, 'User not found.', 'not_found');

    await repository.addAuditLog({
      user_id: req.principal.userId,
      user_name: req.principal.email,
      action: 'user.role_changed',
      entity_type: 'user',
      entity_id: user.id,
      diff: { email: user.email, new_role: body.role },
      ip_address: String(req.ip || ''),
      user_agent: String(req.get('user-agent') || ''),
    });

    res.json({ user });
  }));

  app.post('/api/users/:id/toggle-status', authenticate(config), authorize(adminRoles), asyncHandler<AuthenticatedRequest>(async (req, res) => {
    if (req.params.id === req.principal.userId) {
      throw new ApiError(400, 'Cannot toggle your own status.', 'self_status_change');
    }

    const user = await repository.toggleUserStatus(req.params.id);
    if (!user) throw new ApiError(404, 'User not found.', 'not_found');

    await repository.addAuditLog({
      user_id: req.principal.userId,
      user_name: req.principal.email,
      action: user.is_active ? 'user.reactivated' : 'user.deactivated',
      entity_type: 'user',
      entity_id: user.id,
      diff: { email: user.email, is_active: user.is_active },
      ip_address: String(req.ip || ''),
      user_agent: String(req.get('user-agent') || ''),
    });

    res.json({ user });
  }));

  // ─── Custom Fields ──────────────────────────────────

  app.get('/api/custom-fields', authenticate(config), asyncHandler(async (_req, res) => {
    const fields = await repository.listCustomFieldDefinitions();
    res.json({ customFields: fields });
  }));

  app.post('/api/custom-fields', authenticate(config), authorize(adminRoles), asyncHandler<AuthenticatedRequest>(async (req, res) => {
    const body = createCustomFieldSchema.parse(req.body);
    const field = await repository.addCustomFieldDefinition(body);

    await repository.addAuditLog({
      user_id: req.principal.userId,
      user_name: req.principal.email,
      action: 'custom_field.created',
      entity_type: 'custom_field_definition',
      entity_id: field.id,
      diff: { key: field.key, label: field.label },
      ip_address: String(req.ip || ''),
      user_agent: String(req.get('user-agent') || ''),
    });

    res.status(201).json({ customField: field });
  }));

  app.delete('/api/custom-fields/:id', authenticate(config), authorize(adminRoles), asyncHandler<AuthenticatedRequest>(async (req, res) => {
    const deleted = await repository.deleteCustomFieldDefinition(req.params.id);
    if (!deleted) throw new ApiError(404, 'Custom field not found.', 'not_found');

    await repository.addAuditLog({
      user_id: req.principal.userId,
      user_name: req.principal.email,
      action: 'custom_field.deleted',
      entity_type: 'custom_field_definition',
      entity_id: req.params.id,
      ip_address: String(req.ip || ''),
      user_agent: String(req.get('user-agent') || ''),
    });

    res.status(204).send();
  }));

  // ─── Audit Logs ─────────────────────────────────────

  app.get('/api/audit-logs', authenticate(config), authorize(adminRoles), asyncHandler(async (req, res) => {
    const query = paginationSchema.parse(req.query);
    let logs = await repository.listAuditLogs(query);

    const total = logs.length;
    const offset = (query.page - 1) * query.limit;
    const paged = logs.slice(offset, offset + query.limit);

    res.json({ auditLogs: paged, total, page: query.page, limit: query.limit });
  }));

  // ─── Pipelines & Stages ─────────────────────────────

  app.get('/api/pipelines', authenticate(config), asyncHandler(async (_req, res) => {
    const pipelines = await repository.listPipelines();
    res.json({ pipelines });
  }));

  app.get('/api/stages', authenticate(config), asyncHandler(async (_req, res) => {
    const stages = await repository.listStages();
    res.json({ stages });
  }));
}
