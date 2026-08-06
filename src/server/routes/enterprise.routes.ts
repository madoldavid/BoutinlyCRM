import type { Router } from 'express';
import { createHmac } from 'node:crypto';
import { UserRole } from '../../types.js';
import type { AppConfig } from '../config.js';
import { ApiError, asyncHandler } from '../errors.js';
import type { CrmRepository } from '../repositories/crmRepository.js';
import { authenticate, authorize, type AuthenticatedRequest } from '../security/rbac.js';

const adminRoles = [UserRole.SUPER_ADMIN, UserRole.ADMIN];
const managerRoles = [UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.MANAGER];

const WEBHOOK_EVENTS = [
  'contact.created', 'contact.updated', 'contact.deleted',
  'deal.created', 'deal.updated', 'deal.stage_changed', 'deal.closed',
  'account.created', 'account.updated',
  'task.created', 'task.completed',
  'approval.requested', 'approval.decided',
] as const;

export function registerEnterpriseRoutes(
  app: Router,
  config: AppConfig,
  repository: CrmRepository,
) {
  // ─── Bulk contacts ──────────────────────────────────
  app.patch('/api/contacts/bulk', authenticate(config), authorize([UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.MANAGER, UserRole.SALES_REP]), asyncHandler<AuthenticatedRequest>(async (req, res) => {
    const ids = Array.isArray(req.body?.ids) ? req.body.ids.map(String) : [];
    const patch = req.body?.patch && typeof req.body.patch === 'object' ? req.body.patch : null;
    if (!ids.length || !patch) throw new ApiError(400, 'ids and patch are required.', 'invalid_body');
    const allowed = ['owner_id', 'account_id', 'tags', 'title', 'custom_fields'] as const;
    const clean: Record<string, unknown> = {};
    for (const k of allowed) {
      if (patch[k] !== undefined) clean[k] = patch[k];
    }
    if (!Object.keys(clean).length) throw new ApiError(400, 'No allowed fields in patch.', 'invalid_patch');
    const contacts = await repository.bulkUpdateContacts(ids, clean);
    await repository.addAuditLog({
      user_id: req.principal.userId,
      user_name: req.principal.email,
      action: 'contact.bulk_updated',
      entity_type: 'contact',
      diff: { ids, patch: clean },
      ip_address: String(req.ip || ''),
      user_agent: String(req.get('user-agent') || ''),
    });
    await repository.dispatchWebhookEvent('contact.updated', { bulk: true, ids, patch: clean });
    res.json({ contacts, updated: contacts.length });
  }));

  // ─── Bulk deals ─────────────────────────────────────
  app.patch('/api/deals/bulk', authenticate(config), authorize([UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.MANAGER, UserRole.SALES_REP]), asyncHandler<AuthenticatedRequest>(async (req, res) => {
    const ids = Array.isArray(req.body?.ids) ? req.body.ids.map(String) : [];
    const patch = req.body?.patch && typeof req.body.patch === 'object' ? req.body.patch : null;
    if (!ids.length || !patch) throw new ApiError(400, 'ids and patch are required.', 'invalid_body');
    const allowed = ['owner_id', 'stage_id', 'forecast_category', 'close_date', 'custom_fields'] as const;
    const clean: Record<string, unknown> = {};
    for (const k of allowed) {
      if (patch[k] !== undefined) clean[k] = patch[k];
    }
    if (!Object.keys(clean).length) throw new ApiError(400, 'No allowed fields in patch.', 'invalid_patch');
    const deals = await repository.bulkUpdateDeals(ids, clean);
    await repository.addAuditLog({
      user_id: req.principal.userId,
      user_name: req.principal.email,
      action: 'deal.bulk_updated',
      entity_type: 'deal',
      diff: { ids, patch: clean },
      ip_address: String(req.ip || ''),
      user_agent: String(req.get('user-agent') || ''),
    });
    await repository.dispatchWebhookEvent('deal.updated', { bulk: true, ids, patch: clean });
    res.json({ deals, updated: deals.length });
  }));

  // ─── Audit export ───────────────────────────────────
  app.get('/api/audit-logs/export', authenticate(config), authorize(adminRoles), asyncHandler(async (req, res) => {
    const format = String(req.query.format || 'json').toLowerCase();
    const logs = await repository.listAuditLogs({ limit: 10000 });
    if (format === 'csv') {
      const headers = ['id', 'created_at', 'user_name', 'action', 'entity_type', 'entity_id', 'ip_address'];
      const rows = logs.map(l =>
        headers.map(h => {
          const v = (l as unknown as Record<string, unknown>)[h];
          const s = v == null ? '' : String(v);
          return `"${s.replace(/"/g, '""')}"`;
        }).join(','),
      );
      const csv = [headers.join(','), ...rows].join('\n');
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="audit-export-${new Date().toISOString().slice(0, 10)}.csv"`);
      res.send(csv);
      return;
    }
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="audit-export-${new Date().toISOString().slice(0, 10)}.json"`);
    res.json({ exported_at: new Date().toISOString(), count: logs.length, logs });
  }));

  // ─── API keys ───────────────────────────────────────
  app.get('/api/admin/api-keys', authenticate(config), authorize(adminRoles), asyncHandler(async (_req, res) => {
    res.json({ api_keys: await repository.listApiKeys() });
  }));

  app.post('/api/admin/api-keys', authenticate(config), authorize(adminRoles), asyncHandler<AuthenticatedRequest>(async (req, res) => {
    const name = String(req.body?.name || '').trim();
    if (!name) throw new ApiError(400, 'Name is required.', 'invalid_body');
    const scopes = Array.isArray(req.body?.scopes) ? req.body.scopes.map(String) : ['read', 'write'];
    const key = await repository.createApiKey({
      name,
      scopes,
      created_by_id: req.principal.userId,
      expires_at: req.body?.expires_at || null,
    });
    await repository.addAuditLog({
      user_id: req.principal.userId,
      user_name: req.principal.email,
      action: 'api_key.created',
      entity_type: 'api_key',
      entity_id: key.id,
      diff: { name, scopes },
      ip_address: String(req.ip || ''),
      user_agent: String(req.get('user-agent') || ''),
    });
    res.status(201).json({ api_key: key });
  }));

  app.delete('/api/admin/api-keys/:id', authenticate(config), authorize(adminRoles), asyncHandler<AuthenticatedRequest>(async (req, res) => {
    const key = await repository.revokeApiKey(req.params.id);
    if (!key) throw new ApiError(404, 'API key not found.', 'not_found');
    await repository.addAuditLog({
      user_id: req.principal.userId,
      user_name: req.principal.email,
      action: 'api_key.revoked',
      entity_type: 'api_key',
      entity_id: key.id,
      ip_address: String(req.ip || ''),
      user_agent: String(req.get('user-agent') || ''),
    });
    res.json({ api_key: key });
  }));

  // ─── Webhooks ───────────────────────────────────────
  app.get('/api/admin/webhooks', authenticate(config), authorize(adminRoles), asyncHandler(async (_req, res) => {
    res.json({ webhooks: await repository.listWebhooks(), available_events: WEBHOOK_EVENTS });
  }));

  app.post('/api/admin/webhooks', authenticate(config), authorize(adminRoles), asyncHandler<AuthenticatedRequest>(async (req, res) => {
    const name = String(req.body?.name || '').trim();
    const url = String(req.body?.url || '').trim();
    const events = Array.isArray(req.body?.events) ? req.body.events.map(String) : [];
    if (!name || !url) throw new ApiError(400, 'name and url are required.', 'invalid_body');
    if (!/^https?:\/\//i.test(url)) throw new ApiError(400, 'url must be http(s).', 'invalid_url');
    if (!events.length) throw new ApiError(400, 'At least one event is required.', 'invalid_events');
    const webhook = await repository.createWebhook({
      name, url, events, created_by_id: req.principal.userId,
    });
    await repository.addAuditLog({
      user_id: req.principal.userId,
      user_name: req.principal.email,
      action: 'webhook.created',
      entity_type: 'webhook',
      entity_id: webhook.id,
      diff: { name, url, events },
      ip_address: String(req.ip || ''),
      user_agent: String(req.get('user-agent') || ''),
    });
    res.status(201).json({ webhook });
  }));

  app.put('/api/admin/webhooks/:id', authenticate(config), authorize(adminRoles), asyncHandler(async (req, res) => {
    const webhook = await repository.updateWebhook(req.params.id, {
      name: req.body?.name,
      url: req.body?.url,
      events: req.body?.events,
      status: req.body?.status,
    });
    if (!webhook) throw new ApiError(404, 'Webhook not found.', 'not_found');
    res.json({ webhook });
  }));

  app.delete('/api/admin/webhooks/:id', authenticate(config), authorize(adminRoles), asyncHandler<AuthenticatedRequest>(async (req, res) => {
    const ok = await repository.deleteWebhook(req.params.id);
    if (!ok) throw new ApiError(404, 'Webhook not found.', 'not_found');
    await repository.addAuditLog({
      user_id: req.principal.userId,
      user_name: req.principal.email,
      action: 'webhook.deleted',
      entity_type: 'webhook',
      entity_id: req.params.id,
      ip_address: String(req.ip || ''),
      user_agent: String(req.get('user-agent') || ''),
    });
    res.json({ ok: true });
  }));

  app.get('/api/admin/webhooks/:id/deliveries', authenticate(config), authorize(adminRoles), asyncHandler(async (req, res) => {
    res.json({ deliveries: await repository.listWebhookDeliveries(req.params.id) });
  }));

  app.post('/api/admin/webhooks/:id/test', authenticate(config), authorize(adminRoles), asyncHandler(async (req, res) => {
    const hooks = await repository.listWebhooks();
    const wh = hooks.find(w => w.id === req.params.id);
    if (!wh) throw new ApiError(404, 'Webhook not found.', 'not_found');
    const payload = { event: 'webhook.test', at: new Date().toISOString(), sample: true };
    const signature = createHmac('sha256', wh.secret).update(JSON.stringify(payload)).digest('hex');
    await repository.dispatchWebhookEvent(wh.events[0] || 'deal.updated', { ...payload, signature });
    res.json({ ok: true, signature });
  }));

  // ─── Quotas ─────────────────────────────────────────
  app.get('/api/admin/quotas', authenticate(config), authorize(managerRoles), asyncHandler(async (_req, res) => {
    res.json({ quotas: await repository.listQuotas() });
  }));

  app.post('/api/admin/quotas', authenticate(config), authorize(adminRoles), asyncHandler<AuthenticatedRequest>(async (req, res) => {
    const amount = Number(req.body?.amount);
    if (!Number.isFinite(amount) || amount < 0) throw new ApiError(400, 'Valid amount required.', 'invalid_amount');
    if (!req.body?.user_id && !req.body?.team_id) throw new ApiError(400, 'user_id or team_id required.', 'invalid_body');
    const year = Number(req.body?.fiscal_year) || new Date().getFullYear();
    const period = Number(req.body?.fiscal_period) || 1;
    const quota = await repository.upsertQuota({
      user_id: req.body.user_id || null,
      team_id: req.body.team_id || null,
      period: req.body.period || 'quarterly',
      amount,
      currency: req.body.currency || 'USD',
      fiscal_year: year,
      fiscal_period: period,
    });
    await repository.addAuditLog({
      user_id: req.principal.userId,
      user_name: req.principal.email,
      action: 'quota.upserted',
      entity_type: 'quota',
      entity_id: quota.id,
      diff: { amount, user_id: quota.user_id, team_id: quota.team_id },
      ip_address: String(req.ip || ''),
      user_agent: String(req.get('user-agent') || ''),
    });
    res.status(201).json({ quota });
  }));

  app.delete('/api/admin/quotas/:id', authenticate(config), authorize(adminRoles), asyncHandler(async (req, res) => {
    const ok = await repository.deleteQuota(req.params.id);
    if (!ok) throw new ApiError(404, 'Quota not found.', 'not_found');
    res.json({ ok: true });
  }));

  // ─── Approvals ──────────────────────────────────────
  app.get('/api/approvals', authenticate(config), authorize(managerRoles), asyncHandler(async (req, res) => {
    const status = req.query.status ? String(req.query.status) : undefined;
    res.json({ approvals: await repository.listApprovals({ status }) });
  }));

  app.post('/api/approvals', authenticate(config), asyncHandler<AuthenticatedRequest>(async (req, res) => {
    const entity_type = req.body?.entity_type;
    const entity_id = String(req.body?.entity_id || '');
    const title = String(req.body?.title || '').trim();
    if (!['deal', 'discount', 'stage_change'].includes(entity_type) || !entity_id || !title) {
      throw new ApiError(400, 'entity_type, entity_id, and title are required.', 'invalid_body');
    }
    const approval = await repository.createApproval({
      entity_type,
      entity_id,
      requested_by_id: req.principal.userId,
      title,
      reason: req.body?.reason ? String(req.body.reason) : undefined,
      payload: req.body?.payload && typeof req.body.payload === 'object' ? req.body.payload : {},
      approver_id: req.body?.approver_id || null,
    });
    await repository.dispatchWebhookEvent('approval.requested', { approval_id: approval.id, entity_type, entity_id });
    res.status(201).json({ approval });
  }));

  app.post('/api/approvals/:id/decide', authenticate(config), authorize(managerRoles), asyncHandler<AuthenticatedRequest>(async (req, res) => {
    const decision = req.body?.decision;
    if (decision !== 'approved' && decision !== 'rejected') {
      throw new ApiError(400, 'decision must be approved or rejected.', 'invalid_decision');
    }
    const approval = await repository.decideApproval(
      req.params.id,
      decision,
      req.principal.userId,
      req.body?.note ? String(req.body.note) : undefined,
    );
    if (!approval) throw new ApiError(404, 'Approval not found or already decided.', 'not_found');
    await repository.dispatchWebhookEvent('approval.decided', {
      approval_id: approval.id,
      decision,
      entity_type: approval.entity_type,
      entity_id: approval.entity_id,
    });
    res.json({ approval });
  }));

  // ─── Security policy ────────────────────────────────
  app.get('/api/admin/security-policy', authenticate(config), authorize(adminRoles), asyncHandler(async (_req, res) => {
    const policy = await repository.getSecurityPolicy();
    res.json({
      policy: policy || {
        organization_id: '',
        ip_allowlist: [],
        session_idle_minutes: 480,
        max_sessions_per_user: 10,
        enforce_mfa: false,
        enforce_sso: false,
        password_min_length: 8,
        updated_at: new Date().toISOString(),
      },
    });
  }));

  app.put('/api/admin/security-policy', authenticate(config), authorize(adminRoles), asyncHandler<AuthenticatedRequest>(async (req, res) => {
    const body = req.body || {};
    const policy = await repository.upsertSecurityPolicy({
      ip_allowlist: Array.isArray(body.ip_allowlist) ? body.ip_allowlist.map(String) : undefined,
      session_idle_minutes: body.session_idle_minutes != null ? Number(body.session_idle_minutes) : undefined,
      max_sessions_per_user: body.max_sessions_per_user != null ? Number(body.max_sessions_per_user) : undefined,
      enforce_mfa: body.enforce_mfa != null ? Boolean(body.enforce_mfa) : undefined,
      enforce_sso: body.enforce_sso != null ? Boolean(body.enforce_sso) : undefined,
      password_min_length: body.password_min_length != null ? Number(body.password_min_length) : undefined,
    });
    await repository.addAuditLog({
      user_id: req.principal.userId,
      user_name: req.principal.email,
      action: 'security_policy.updated',
      entity_type: 'organization',
      diff: body,
      ip_address: String(req.ip || ''),
      user_agent: String(req.get('user-agent') || ''),
    });
    res.json({ policy });
  }));

  // ─── Field permissions ──────────────────────────────
  app.get('/api/admin/field-permissions', authenticate(config), authorize(adminRoles), asyncHandler(async (_req, res) => {
    res.json({ field_permissions: await repository.listFieldPermissions() });
  }));

  app.post('/api/admin/field-permissions', authenticate(config), authorize(adminRoles), asyncHandler(async (req, res) => {
    const entity_type = req.body?.entity_type;
    const field_key = String(req.body?.field_key || '').trim();
    const role = req.body?.role;
    if (!['contact', 'account', 'deal'].includes(entity_type) || !field_key || !role) {
      throw new ApiError(400, 'entity_type, field_key, and role are required.', 'invalid_body');
    }
    const fp = await repository.upsertFieldPermission({
      entity_type,
      field_key,
      role,
      can_read: bodyBool(req.body?.can_read, true),
      can_write: bodyBool(req.body?.can_write, false),
    });
    res.status(201).json({ field_permission: fp });
  }));

  app.delete('/api/admin/field-permissions/:id', authenticate(config), authorize(adminRoles), asyncHandler(async (req, res) => {
    const ok = await repository.deleteFieldPermission(req.params.id);
    if (!ok) throw new ApiError(404, 'Field permission not found.', 'not_found');
    res.json({ ok: true });
  }));
}

function bodyBool(v: unknown, fallback: boolean): boolean {
  if (v === undefined || v === null) return fallback;
  return Boolean(v);
}
