import type { Router } from 'express';
import type { AppConfig } from '../config.js';
import { ApiError, asyncHandler } from '../errors.js';
import type { CrmRepository } from '../repositories/crmRepository.js';
import { scopeSnapshot } from '../repositories/scope.js';
import { authenticate, canAccessOwner, requireWriteAccess, type AuthenticatedRequest } from '../security/rbac.js';
import {
  convertLeadSchema,
  createLeadSchema,
  leadQuerySchema,
  updateLeadSchema,
} from '../validation/schemas.js';

export function registerLeadsRoutes(
  app: Router,
  config: AppConfig,
  repository: CrmRepository,
) {
  app.get('/api/leads', authenticate(config), asyncHandler<AuthenticatedRequest>(async (req, res) => {
    const query = leadQuerySchema.parse(req.query);

    const leads = await repository.listLeads({
      status: query.status,
      owner_id: query.owner_id,
      search: query.search,
    });

    const users = await repository.listUsers();
    const scoped = scopeSnapshot({
      users,
      leads,
      accounts: [], contacts: [], deals: [], pipelines: [], stages: [], tasks: [], activities: [],
      notifications: [], customFields: [], emailTemplates: [], emailCampaigns: [], auditLogs: [],
    }, req.principal);

    const total = scoped.leads.length;
    const offset = (query.page - 1) * query.limit;
    const paged = scoped.leads.slice(offset, offset + query.limit);

    res.json({ leads: paged, total, page: query.page, limit: query.limit });
  }));

  app.get('/api/leads/:id', authenticate(config), asyncHandler<AuthenticatedRequest>(async (req, res) => {
    const lead = await repository.getLeadById(req.params.id);
    if (!lead) throw new ApiError(404, 'Lead not found.', 'not_found');
    res.json({ lead });
  }));

  app.post('/api/leads', authenticate(config), asyncHandler<AuthenticatedRequest>(async (req, res) => {
    requireWriteAccess(req);
    const body = createLeadSchema.parse(req.body);
    const snapshot = await repository.snapshot();
    const owner = snapshot.users.find(user => user.id === body.owner_id);

    if (!owner) throw new ApiError(400, 'Lead owner does not exist.', 'invalid_owner');
    if (!canAccessOwner(req.principal, body.owner_id, owner.team_id)) {
      throw new ApiError(403, 'You cannot create records for that owner.', 'owner_forbidden');
    }

    const lead = await repository.addLead(body);
    await repository.addAuditLog({
      user_id: req.principal.userId,
      user_name: req.principal.email,
      action: 'lead.created',
      entity_type: 'lead',
      entity_id: lead.id,
      diff: { first_name: lead.first_name, last_name: lead.last_name, company_name: lead.company_name, status: lead.status },
      ip_address: String(req.ip || ''),
      user_agent: String(req.get('user-agent') || ''),
    });

    await repository.addActivity({
      type: 'note',
      title: 'Lead Created',
      body: `Lead "${lead.first_name} ${lead.last_name}" from ${lead.company_name} created.`,
      user_id: req.principal.userId,
      lead_id: lead.id,
    });

    res.status(201).json({ lead });
  }));

  app.put('/api/leads/:id', authenticate(config), asyncHandler<AuthenticatedRequest>(async (req, res) => {
    requireWriteAccess(req);
    const body = updateLeadSchema.parse(req.body);
    const lead = await repository.updateLead(req.params.id, body);
    if (!lead) throw new ApiError(404, 'Lead not found.', 'not_found');

    await repository.addAuditLog({
      user_id: req.principal.userId,
      user_name: req.principal.email,
      action: 'lead.updated',
      entity_type: 'lead',
      entity_id: lead.id,
      diff: body,
      ip_address: String(req.ip || ''),
      user_agent: String(req.get('user-agent') || ''),
    });

    res.json({ lead });
  }));

  app.delete('/api/leads/:id', authenticate(config), asyncHandler<AuthenticatedRequest>(async (req, res) => {
    requireWriteAccess(req);
    const lead = await repository.getLeadById(req.params.id);
    if (!lead) throw new ApiError(404, 'Lead not found.', 'not_found');

    await repository.deleteLead(req.params.id);

    await repository.addAuditLog({
      user_id: req.principal.userId,
      user_name: req.principal.email,
      action: 'lead.deleted',
      entity_type: 'lead',
      entity_id: req.params.id,
      diff: { first_name: lead.first_name, last_name: lead.last_name },
      ip_address: String(req.ip || ''),
      user_agent: String(req.get('user-agent') || ''),
    });

    res.status(204).send();
  }));

  app.post('/api/leads/:id/convert', authenticate(config), asyncHandler<AuthenticatedRequest>(async (req, res) => {
    requireWriteAccess(req);
    const body = convertLeadSchema.parse(req.body);

    const lead = await repository.getLeadById(req.params.id);
    if (!lead) throw new ApiError(404, 'Lead not found.', 'not_found');
    if (lead.is_converted) {
      throw new ApiError(400, 'This lead has already been converted.', 'already_converted');
    }
    if (lead.status !== 'qualified') {
      throw new ApiError(400, 'Only qualified leads can be converted.', 'invalid_status');
    }

    const result = await repository.convertLead(req.params.id, body, req.principal.userId);
    if (!result) throw new ApiError(404, 'Lead not found.', 'not_found');

    await repository.addAuditLog({
      user_id: req.principal.userId,
      user_name: req.principal.email,
      action: 'lead.converted',
      entity_type: 'lead',
      entity_id: req.params.id,
      diff: {
        account_id: result.account?.id,
        contact_id: result.contact?.id,
        opportunity_id: result.opportunity?.id,
      },
      ip_address: String(req.ip || ''),
      user_agent: String(req.get('user-agent') || ''),
    });

    res.json(result);
  }));
}
