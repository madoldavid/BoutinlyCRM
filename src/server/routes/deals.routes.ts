import type { Router } from 'express';
import type { AppConfig } from '../config.js';
import { ApiError, asyncHandler } from '../errors.js';
import type { CrmRepository } from '../repositories/crmRepository.js';
import { scopeSnapshot } from '../repositories/scope.js';
import { authenticate, canAccessOwner, requireWriteAccess, type AuthenticatedRequest } from '../security/rbac.js';
import {
  closeDealSchema,
  createDealSchema,
  dealQuerySchema,
  moveDealStageSchema,
  updateDealSchema,
} from '../validation/schemas.js';

export function registerDealsRoutes(
  app: Router,
  config: AppConfig,
  repository: CrmRepository,
) {
  app.get('/api/deals', authenticate(config), asyncHandler<AuthenticatedRequest>(async (req, res) => {
    const query = dealQuerySchema.parse(req.query);

    // Load deals with repository-side search + filters (DB-side WHERE clauses for Postgres)
    const deals = await repository.listDeals({
      pipeline_id: query.pipeline_id,
      stage_id: query.stage_id,
      owner_id: query.owner_id,
      search: query.search,
    });

    // Lightweight RBAC scoping: load users + accounts for visibility checks
    const users = await repository.listUsers();
    const accounts = await repository.listAccounts();
    const scoped = scopeSnapshot({
      users, accounts,
      deals,
      leads: [], contacts: [], pipelines: [], stages: [], tasks: [], activities: [],
      notifications: [], customFields: [], emailTemplates: [], emailCampaigns: [], auditLogs: [],
    }, req.principal);

    // Paginate after scoping
    const total = scoped.deals.length;
    const offset = (query.page - 1) * query.limit;
    const paged = scoped.deals.slice(offset, offset + query.limit);

    res.json({ deals: paged, total, page: query.page, limit: query.limit });
  }));

  app.get('/api/deals/:id', authenticate(config), asyncHandler<AuthenticatedRequest>(async (req, res) => {
    const deal = await repository.getDealById(req.params.id);
    if (!deal) throw new ApiError(404, 'Deal not found.', 'not_found');
    res.json({ deal });
  }));

  app.post('/api/deals', authenticate(config), asyncHandler<AuthenticatedRequest>(async (req, res) => {
    requireWriteAccess(req);
    const body = createDealSchema.parse(req.body);
    const snapshot = await repository.snapshot();
    const owner = snapshot.users.find(user => user.id === body.owner_id);
    const account = snapshot.accounts.find(item => item.id === body.account_id);
    const stage = snapshot.stages.find(s => s.id === body.stage_id);

    if (!owner) throw new ApiError(400, 'Deal owner does not exist.', 'invalid_owner');
    if (!account) throw new ApiError(400, 'Deal account does not exist.', 'invalid_account');
    if (!stage) throw new ApiError(400, 'Deal stage does not exist.', 'invalid_stage');
    if (!canAccessOwner(req.principal, body.owner_id, owner.team_id)) {
      throw new ApiError(403, 'You cannot create records for that owner.', 'owner_forbidden');
    }

    const deal = await repository.addDeal(body);
    await repository.addAuditLog({
      user_id: req.principal.userId,
      user_name: req.principal.email,
      action: 'deal.created',
      entity_type: 'deal',
      entity_id: deal.id,
      diff: { name: deal.name, value: deal.value },
      ip_address: String(req.ip || ''),
      user_agent: String(req.get('user-agent') || ''),
    });

    await repository.addActivity({
      type: 'stage_change',
      title: 'Deal Created',
      body: `Deal created in stage "${stage.name}" with value $${deal.value.toLocaleString()}`,
      user_id: req.principal.userId,
      deal_id: deal.id,
      metadata: { to_stage_id: deal.stage_id },
    });

    res.status(201).json({ deal });
  }));

  app.put('/api/deals/:id', authenticate(config), asyncHandler<AuthenticatedRequest>(async (req, res) => {
    requireWriteAccess(req);
    const body = updateDealSchema.parse(req.body);
    const deal = await repository.updateDeal(req.params.id, body);
    if (!deal) throw new ApiError(404, 'Deal not found.', 'not_found');

    await repository.addAuditLog({
      user_id: req.principal.userId,
      user_name: req.principal.email,
      action: 'deal.updated',
      entity_type: 'deal',
      entity_id: deal.id,
      diff: body,
      ip_address: String(req.ip || ''),
      user_agent: String(req.get('user-agent') || ''),
    });

    res.json({ deal });
  }));

  app.delete('/api/deals/:id', authenticate(config), asyncHandler<AuthenticatedRequest>(async (req, res) => {
    requireWriteAccess(req);
    const deal = await repository.getDealById(req.params.id);
    if (!deal) throw new ApiError(404, 'Deal not found.', 'not_found');

    await repository.deleteDeal(req.params.id);

    await repository.addAuditLog({
      user_id: req.principal.userId,
      user_name: req.principal.email,
      action: 'deal.deleted',
      entity_type: 'deal',
      entity_id: req.params.id,
      diff: { name: deal.name },
      ip_address: String(req.ip || ''),
      user_agent: String(req.get('user-agent') || ''),
    });

    res.status(204).send();
  }));

  app.post('/api/deals/:id/move-stage', authenticate(config), asyncHandler<AuthenticatedRequest>(async (req, res) => {
    requireWriteAccess(req);
    const body = moveDealStageSchema.parse(req.body);
    const snapshot = await repository.snapshot();
    const fromStage = snapshot.stages.find(s => s.id === snapshot.deals.find(d => d.id === req.params.id)?.stage_id);
    const toStage = snapshot.stages.find(s => s.id === body.target_stage_id);

    if (!toStage) throw new ApiError(400, 'Target stage not found.', 'invalid_stage');

    const deal = await repository.moveDealStage(req.params.id, body.target_stage_id);
    if (!deal) throw new ApiError(404, 'Deal not found.', 'not_found');

    await repository.addAuditLog({
      user_id: req.principal.userId,
      user_name: req.principal.email,
      action: 'deal.stage_changed',
      entity_type: 'deal',
      entity_id: deal.id,
      diff: { from_stage: fromStage?.name || '', to_stage: toStage.name },
      ip_address: String(req.ip || ''),
      user_agent: String(req.get('user-agent') || ''),
    });

    await repository.addActivity({
      type: 'stage_change',
      title: `Moved to ${toStage.name}`,
      body: `Stage changed from "${fromStage?.name || ''}" to "${toStage.name}". Win probability: ${toStage.probability}%`,
      user_id: req.principal.userId,
      deal_id: deal.id,
      metadata: { from_stage_id: fromStage?.id, to_stage_id: toStage.id },
    });

    res.json({ deal });
  }));

  app.post('/api/deals/:id/close', authenticate(config), asyncHandler<AuthenticatedRequest>(async (req, res) => {
    requireWriteAccess(req);
    const body = closeDealSchema.parse(req.body);
    const deal = await repository.closeDeal(req.params.id, body.outcome, body.reason);
    if (!deal) throw new ApiError(404, 'Deal not found.', 'not_found');

    await repository.addAuditLog({
      user_id: req.principal.userId,
      user_name: req.principal.email,
      action: `deal.${body.outcome === 'won' ? 'won' : 'lost'}`,
      entity_type: 'deal',
      entity_id: deal.id,
      diff: { outcome: body.outcome, reason: body.reason },
      ip_address: String(req.ip || ''),
      user_agent: String(req.get('user-agent') || ''),
    });

    // Record on the deal's activity timeline so closing a deal shows up
    // alongside calls/emails/notes (previously only move-stage did this).
    await repository.addActivity({
      type: 'deal_closed',
      title: body.outcome === 'won' ? 'Deal Won' : 'Deal Lost',
      body: body.outcome === 'won'
        ? `Deal closed as Won at $${deal.value.toLocaleString()}.`
        : `Deal closed as Lost.${body.reason ? ` Reason: ${body.reason}` : ''}`,
      user_id: req.principal.userId,
      deal_id: deal.id,
      outcome: body.outcome,
      metadata: { outcome: body.outcome, reason: body.reason },
    });

    res.json({ deal });
  }));
}
