import type { Router } from 'express';
import type { AppConfig } from '../config.js';
import { ApiError, asyncHandler } from '../errors.js';
import type { CrmRepository } from '../repositories/crmRepository.js';
import { scopeSnapshot } from '../repositories/scope.js';
import { authenticate, requireWriteAccess, type AuthenticatedRequest } from '../security/rbac.js';
import {
  callLogQuerySchema,
  createCallLogSchema,
  createRecordTaskSchema,
  recordTaskQuerySchema,
  updateRecordTaskSchema,
} from '../validation/schemas.js';

/**
 * Activity Timeline sub-system — record-linked to-do items (`record_tasks`)
 * and historical call notes (`call_logs`). Both carry a polymorphic
 * `associated_to_id` pointing at a lead, contact, or opportunity.
 */
export function registerTimelineRoutes(
  app: Router,
  config: AppConfig,
  repository: CrmRepository,
) {
  // ─── Record Tasks ────────────────────────────────────

  app.get('/api/record-tasks', authenticate(config), asyncHandler<AuthenticatedRequest>(async (req, res) => {
    const query = recordTaskQuerySchema.parse(req.query);

    const recordTasks = await repository.listRecordTasks({
      associated_to_id: query.associated_to_id,
      search: query.search,
    });

    const users = await repository.listUsers();
    const scoped = scopeSnapshot({
      users,
      recordTasks,
      callLogs: [],
      accounts: [], contacts: [], leads: [], deals: [], pipelines: [], stages: [], tasks: [], activities: [],
      notifications: [], customFields: [], emailTemplates: [], emailCampaigns: [], auditLogs: [],
    }, req.principal);

    const total = scoped.recordTasks?.length ?? 0;
    const offset = (query.page - 1) * query.limit;
    const paged = (scoped.recordTasks ?? []).slice(offset, offset + query.limit);

    res.json({ recordTasks: paged, total, page: query.page, limit: query.limit });
  }));

  app.get('/api/record-tasks/:id', authenticate(config), asyncHandler<AuthenticatedRequest>(async (req, res) => {
    const recordTask = await repository.getRecordTaskById(req.params.id);
    if (!recordTask) throw new ApiError(404, 'Task not found.', 'not_found');
    res.json({ recordTask });
  }));

  app.post('/api/record-tasks', authenticate(config), asyncHandler<AuthenticatedRequest>(async (req, res) => {
    requireWriteAccess(req);
    const body = createRecordTaskSchema.parse(req.body);

    const recordTask = await repository.addRecordTask({
      ...body,
      user_id: req.principal.userId,
    });

    await repository.addAuditLog({
      user_id: req.principal.userId,
      user_name: req.principal.email,
      action: 'record_task.created',
      entity_type: 'record_task',
      entity_id: recordTask.id,
      diff: { subject: recordTask.subject, associated_to_id: recordTask.associated_to_id },
      ip_address: String(req.ip || ''),
      user_agent: String(req.get('user-agent') || ''),
    });

    res.status(201).json({ recordTask });
  }));

  app.patch('/api/record-tasks/:id', authenticate(config), asyncHandler<AuthenticatedRequest>(async (req, res) => {
    requireWriteAccess(req);
    const body = updateRecordTaskSchema.parse(req.body);
    const recordTask = await repository.updateRecordTask(req.params.id, body);
    if (!recordTask) throw new ApiError(404, 'Task not found.', 'not_found');

    await repository.addAuditLog({
      user_id: req.principal.userId,
      user_name: req.principal.email,
      action: 'record_task.updated',
      entity_type: 'record_task',
      entity_id: recordTask.id,
      diff: body,
      ip_address: String(req.ip || ''),
      user_agent: String(req.get('user-agent') || ''),
    });

    res.json({ recordTask });
  }));

  app.delete('/api/record-tasks/:id', authenticate(config), asyncHandler<AuthenticatedRequest>(async (req, res) => {
    requireWriteAccess(req);
    const recordTask = await repository.getRecordTaskById(req.params.id);
    if (!recordTask) throw new ApiError(404, 'Task not found.', 'not_found');

    await repository.deleteRecordTask(req.params.id);

    await repository.addAuditLog({
      user_id: req.principal.userId,
      user_name: req.principal.email,
      action: 'record_task.deleted',
      entity_type: 'record_task',
      entity_id: req.params.id,
      diff: { subject: recordTask.subject },
      ip_address: String(req.ip || ''),
      user_agent: String(req.get('user-agent') || ''),
    });

    res.status(204).send();
  }));

  // ─── Call Logs ───────────────────────────────────────

  app.get('/api/call-logs', authenticate(config), asyncHandler<AuthenticatedRequest>(async (req, res) => {
    const query = callLogQuerySchema.parse(req.query);

    const callLogs = await repository.listCallLogs({
      associated_to_id: query.associated_to_id,
      search: query.search,
    });

    const users = await repository.listUsers();
    const scoped = scopeSnapshot({
      users,
      recordTasks: [],
      callLogs,
      accounts: [], contacts: [], leads: [], deals: [], pipelines: [], stages: [], tasks: [], activities: [],
      notifications: [], customFields: [], emailTemplates: [], emailCampaigns: [], auditLogs: [],
    }, req.principal);

    const total = scoped.callLogs?.length ?? 0;
    const offset = (query.page - 1) * query.limit;
    const paged = (scoped.callLogs ?? []).slice(offset, offset + query.limit);

    res.json({ callLogs: paged, total, page: query.page, limit: query.limit });
  }));

  app.get('/api/call-logs/:id', authenticate(config), asyncHandler<AuthenticatedRequest>(async (req, res) => {
    const callLog = await repository.getCallLogById(req.params.id);
    if (!callLog) throw new ApiError(404, 'Call log not found.', 'not_found');
    res.json({ callLog });
  }));

  app.post('/api/call-logs', authenticate(config), asyncHandler<AuthenticatedRequest>(async (req, res) => {
    requireWriteAccess(req);
    const body = createCallLogSchema.parse(req.body);

    const callLog = await repository.addCallLog({
      ...body,
      user_id: req.principal.userId,
    });

    await repository.addAuditLog({
      user_id: req.principal.userId,
      user_name: req.principal.email,
      action: 'call_log.created',
      entity_type: 'call_log',
      entity_id: callLog.id,
      diff: { subject: callLog.subject, associated_to_id: callLog.associated_to_id },
      ip_address: String(req.ip || ''),
      user_agent: String(req.get('user-agent') || ''),
    });

    res.status(201).json({ callLog });
  }));
}
