import type { Router } from 'express';
import type { AppConfig } from '../config.js';
import { ApiError, asyncHandler } from '../errors.js';
import type { CrmRepository } from '../repositories/crmRepository.js';
import { scopeSnapshot } from '../repositories/scope.js';
import { authenticate, canAccessOwner, requireWriteAccess, type AuthenticatedRequest } from '../security/rbac.js';
import {
  createAccountSchema,
  paginationSchema,
  updateAccountSchema,
} from '../validation/schemas.js';

export function registerAccountsRoutes(
  app: Router,
  config: AppConfig,
  repository: CrmRepository,
) {
  app.get('/api/accounts', authenticate(config), asyncHandler<AuthenticatedRequest>(async (req, res) => {
    const query = paginationSchema.parse(req.query);

    // Load accounts with repository-side search (DB-side WHERE for Postgres)
    const accounts = await repository.listAccounts({ search: query.search });

    // RBAC scoping: load users for visibility checks
    const users = await repository.listUsers();
    const scoped = scopeSnapshot({
      users, accounts,
      contacts: [], deals: [], pipelines: [], stages: [], tasks: [], activities: [],
      notifications: [], customFields: [], emailTemplates: [], emailCampaigns: [], auditLogs: [],
    }, req.principal);

    // Paginate after scoping
    const total = scoped.accounts.length;
    const offset = (query.page - 1) * query.limit;
    const paged = scoped.accounts.slice(offset, offset + query.limit);

    res.json({ accounts: paged, total, page: query.page, limit: query.limit });
  }));

  app.get('/api/accounts/:id', authenticate(config), asyncHandler<AuthenticatedRequest>(async (req, res) => {
    const account = await repository.getAccountById(req.params.id);
    if (!account) throw new ApiError(404, 'Account not found.', 'not_found');
    res.json({ account });
  }));

  app.post('/api/accounts', authenticate(config), asyncHandler<AuthenticatedRequest>(async (req, res) => {
    requireWriteAccess(req);
    const body = createAccountSchema.parse(req.body);
    const owner = await repository.getUserById(body.owner_id);

    if (!owner) throw new ApiError(400, 'Account owner does not exist.', 'invalid_owner');
    if (!canAccessOwner(req.principal, body.owner_id, owner.team_id)) {
      throw new ApiError(403, 'You cannot create records for that owner.', 'owner_forbidden');
    }

    const account = await repository.addAccount(body);
    await repository.addAuditLog({
      user_id: req.principal.userId,
      user_name: req.principal.email,
      action: 'account.created',
      entity_type: 'account',
      entity_id: account.id,
      diff: { name: account.name },
      ip_address: String(req.ip || ''),
      user_agent: String(req.get('user-agent') || ''),
    });

    res.status(201).json({ account });
  }));

  app.put('/api/accounts/:id', authenticate(config), asyncHandler<AuthenticatedRequest>(async (req, res) => {
    requireWriteAccess(req);
    const body = updateAccountSchema.parse(req.body);
    const account = await repository.updateAccount(req.params.id, body);
    if (!account) throw new ApiError(404, 'Account not found.', 'not_found');

    await repository.addAuditLog({
      user_id: req.principal.userId,
      user_name: req.principal.email,
      action: 'account.updated',
      entity_type: 'account',
      entity_id: account.id,
      diff: body,
      ip_address: String(req.ip || ''),
      user_agent: String(req.get('user-agent') || ''),
    });

    res.json({ account });
  }));

  app.delete('/api/accounts/:id', authenticate(config), asyncHandler<AuthenticatedRequest>(async (req, res) => {
    requireWriteAccess(req);
    const account = await repository.getAccountById(req.params.id);
    if (!account) throw new ApiError(404, 'Account not found.', 'not_found');

    await repository.deleteAccount(req.params.id);

    await repository.addAuditLog({
      user_id: req.principal.userId,
      user_name: req.principal.email,
      action: 'account.deleted',
      entity_type: 'account',
      entity_id: req.params.id,
      diff: { name: account.name },
      ip_address: String(req.ip || ''),
      user_agent: String(req.get('user-agent') || ''),
    });

    res.status(204).send();
  }));
}
