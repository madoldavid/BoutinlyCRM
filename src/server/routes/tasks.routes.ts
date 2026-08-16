import type { Router } from 'express';
import type { AppConfig } from '../config.js';
import { ApiError, asyncHandler } from '../errors.js';
import type { CrmRepository } from '../repositories/crmRepository.js';
import { scopeSnapshot } from '../repositories/scope.js';
import { authenticate, requireWriteAccess, type AuthenticatedRequest } from '../security/rbac.js';
import {
  createTaskSchema,
  taskQuerySchema,
  updateTaskSchema,
} from '../validation/schemas.js';

export function registerTasksRoutes(
  app: Router,
  config: AppConfig,
  repository: CrmRepository,
) {
  app.get('/api/tasks', authenticate(config), asyncHandler<AuthenticatedRequest>(async (req, res) => {
    const query = taskQuerySchema.parse(req.query);

    // Load tasks with repository-side filters (DB-side WHERE for Postgres)
    const tasks = await repository.listTasks({
      assigned_to_id: query.assigned_to_id,
      status: query.status,
      search: query.search,
    });

    // RBAC scoping: load users for visibility checks
    const users = await repository.listUsers();
    const scoped = scopeSnapshot({
      users,
      tasks,
      accounts: [], contacts: [], leads: [], deals: [], pipelines: [], stages: [], activities: [],
      notifications: [], customFields: [], emailTemplates: [], emailCampaigns: [], auditLogs: [],
    }, req.principal);

    // Paginate after scoping
    const total = scoped.tasks.length;
    const offset = (query.page - 1) * query.limit;
    const paged = scoped.tasks.slice(offset, offset + query.limit);

    res.json({ tasks: paged, total, page: query.page, limit: query.limit });
  }));

  app.get('/api/tasks/:id', authenticate(config), asyncHandler<AuthenticatedRequest>(async (req, res) => {
    const task = await repository.getTaskById(req.params.id);
    if (!task) throw new ApiError(404, 'Task not found.', 'not_found');
    res.json({ task });
  }));

  app.post('/api/tasks', authenticate(config), asyncHandler<AuthenticatedRequest>(async (req, res) => {
    requireWriteAccess(req);
    const body = createTaskSchema.parse(req.body);

    const task = await repository.addTask({
      ...body,
      created_by_id: req.principal.userId,
    });

    await repository.addAuditLog({
      user_id: req.principal.userId,
      user_name: req.principal.email,
      action: 'task.created',
      entity_type: 'task',
      entity_id: task.id,
      diff: { title: task.title },
      ip_address: String(req.ip || ''),
      user_agent: String(req.get('user-agent') || ''),
    });

    res.status(201).json({ task });
  }));

  app.put('/api/tasks/:id', authenticate(config), asyncHandler<AuthenticatedRequest>(async (req, res) => {
    requireWriteAccess(req);
    const body = updateTaskSchema.parse(req.body);
    const task = await repository.updateTask(req.params.id, body);
    if (!task) throw new ApiError(404, 'Task not found.', 'not_found');

    await repository.addAuditLog({
      user_id: req.principal.userId,
      user_name: req.principal.email,
      action: 'task.updated',
      entity_type: 'task',
      entity_id: task.id,
      diff: body,
      ip_address: String(req.ip || ''),
      user_agent: String(req.get('user-agent') || ''),
    });

    res.json({ task });
  }));

  app.post('/api/tasks/:id/complete', authenticate(config), asyncHandler<AuthenticatedRequest>(async (req, res) => {
    requireWriteAccess(req);
    const note = (req.body as any)?.note as string | undefined;
    const task = await repository.completeTask(req.params.id);
    if (!task) throw new ApiError(404, 'Task not found.', 'not_found');

    await repository.addAuditLog({
      user_id: req.principal.userId,
      user_name: req.principal.email,
      action: 'task.completed',
      entity_type: 'task',
      entity_id: task.id,
      diff: { title: task.title, note: note || null },
      ip_address: String(req.ip || ''),
      user_agent: String(req.get('user-agent') || ''),
    });

    await repository.addActivity({
      type: 'task_completed',
      title: `Completed Task: ${task.title}`,
      body: note || `Task of type "${task.type}" was marked as completed.`,
      user_id: req.principal.userId,
      contact_id: task.contact_id,
      deal_id: task.deal_id,
      task_id: task.id,
    });

    res.json({ task });
  }));

  app.delete('/api/tasks/:id', authenticate(config), asyncHandler<AuthenticatedRequest>(async (req, res) => {
    requireWriteAccess(req);
    const task = await repository.getTaskById(req.params.id);
    if (!task) throw new ApiError(404, 'Task not found.', 'not_found');

    await repository.deleteTask(req.params.id);

    await repository.addAuditLog({
      user_id: req.principal.userId,
      user_name: req.principal.email,
      action: 'task.deleted',
      entity_type: 'task',
      entity_id: req.params.id,
      diff: { title: task.title },
      ip_address: String(req.ip || ''),
      user_agent: String(req.get('user-agent') || ''),
    });

    res.status(204).send();
  }));
}
