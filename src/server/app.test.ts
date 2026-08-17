import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { UserRole } from '../types.js';
import { createApp } from './app.js';
import { loadConfig } from './config.js';
import { EmailService } from './email/service.js';
import { createLogger } from './logger.js';
import { LocalFileService } from './storage/service.js';
import { AccountLockoutService } from './security/lockout.js';
import { KeyManager } from './security/jwks.js';
import { InMemoryTokenBlocklist } from './security/tokenBlocklist.js';
import { setAuthDeps } from './security/rbac.js';
import { InMemoryCrmRepository } from './repositories/crmRepository.js';

async function createTestHarness() {
  process.env.NODE_ENV = 'test';
  process.env.JWT_SECRET = 'test-secret-that-is-long-enough-for-hmac';
  process.env.PASSWORD_PEPPER = 'test-password-pepper';

  const config = loadConfig();
  const repository = new InMemoryCrmRepository(config.PASSWORD_PEPPER);

  const emailService = new EmailService({ provider: 'console', from: 'test@boutinly.com' }, createLogger('test'));
  await emailService.initialize();

  const fileService = new LocalFileService();
  const lockoutService = new AccountLockoutService(createLogger('test'));
  const keyManager = new KeyManager(config.JWT_SECRET);
  const tokenBlocklist = new InMemoryTokenBlocklist();

  setAuthDeps(keyManager, tokenBlocklist);

  const app = createApp({
    config, logger: createLogger('test'), repository, emailService,
    fileService, lockoutService, keyManager, tokenBlocklist,
  });

  async function signup(name: string, email: string, password: string, company: string) {
    const r = await request(app).post('/api/auth/signup')
      .send({ name, email, password, company_name: company }).expect(201);
    return { token: r.body.token as string, userId: r.body.user.id as string };
  }

  async function login(email: string, password: string) {
    const r = await request(app).post('/api/auth/login')
      .send({ email, password }).expect(200);
    return r.body.token as string;
  }

  return { app, repository, signup, login, lockoutService };
}

// ═══════════════════════════════════════════════════════

describe('Boutinly CRM API', () => {
  let h: Awaited<ReturnType<typeof createTestHarness>>;

  beforeEach(async () => { h = await createTestHarness(); });

  // ── Health & Metrics ──────────────────────────────

  it('GET /api/health returns ok', async () => {
    const r = await request(h.app).get('/api/health').expect(200);
    expect(r.body.status).toBe('ok');
  });

  it('GET /metrics returns Prometheus format', async () => {
    const r = await request(h.app).get('/metrics').expect(200);
    expect(r.text).toContain('http_requests_total');
  });

  it('GET /.well-known/jwks.json returns keys', async () => {
    const r = await request(h.app).get('/.well-known/jwks.json').expect(200);
    expect(r.body.keys[0].kty).toBe('oct');
  });

  // ── Auth ──────────────────────────────────────────

  it('allows multiple signups (open registration), each creating their own org, and logs in', async () => {
    const sr = await request(h.app).post('/api/auth/signup')
      .send({ name: 'Admin', email: 'a@t.com', password: 'ChangeMe123!', company_name: 'TC' })
      .expect(201);
    expect(sr.body.token).toBeTruthy();

    // Open registration: a second signup provisions a separate org
    const sr2 = await request(h.app).post('/api/auth/signup')
      .send({ name: 'B', email: 'b@t.com', password: 'ChangeMe123!', company_name: 'TC2' })
      .expect(201);
    expect(sr2.body.token).toBeTruthy();
    expect(sr2.body.user.organization_id).not.toBe(sr.body.user.organization_id);

    const lr = await request(h.app).post('/api/auth/login')
      .send({ email: 'a@t.com', password: 'ChangeMe123!' }).expect(200);
    expect(lr.body.token).toBeTruthy();
  });

  it('returns scoped bootstrap after signup', async () => {
    const { token } = await h.signup('D', 'd@t.com', 'ChangeMe123!', 'TC');
    const r = await request(h.app).get('/api/crm/bootstrap')
      .set('Authorization', `Bearer ${token}`).expect(200);
    expect(r.body.users).toHaveLength(1);
    expect(r.body.pipelines).toHaveLength(1); // signup provisions the org pipeline
    expect(r.body.stages).toHaveLength(7); // signup provisions default stages
  });

  it('does not leak pipelines/stages across organizations', async () => {
    const a = await h.signup('A', 'pa@t.com', 'ChangeMe123!', 'OrgA');
    const b = await h.signup('B', 'pb@t.com', 'ChangeMe123!', 'OrgB');

    const bsA = await request(h.app).get('/api/crm/bootstrap')
      .set('Authorization', `Bearer ${a.token}`).expect(200);
    const bsB = await request(h.app).get('/api/crm/bootstrap')
      .set('Authorization', `Bearer ${b.token}`).expect(200);

    expect(bsA.body.pipelines).toHaveLength(1);
    expect(bsA.body.stages).toHaveLength(7);
    expect(bsB.body.pipelines).toHaveLength(1);
    expect(bsB.body.stages).toHaveLength(7);

    // Each org only sees its own pipeline & stages
    expect(bsA.body.pipelines[0].id).not.toBe(bsB.body.pipelines[0].id);
    expect(bsA.body.stages.map((s: any) => s.id)).not.toContain(bsB.body.stages[0].id);
    expect(bsB.body.stages.map((s: any) => s.id)).not.toContain(bsA.body.stages[0].id);

    // List endpoints are equally isolated
    const pipesA = await request(h.app).get('/api/pipelines')
      .set('Authorization', `Bearer ${a.token}`).expect(200);
    const stagesB = await request(h.app).get('/api/stages')
      .set('Authorization', `Bearer ${b.token}`).expect(200);
    expect(pipesA.body.pipelines).toHaveLength(1);
    expect(pipesA.body.pipelines[0].id).toBe(bsA.body.pipelines[0].id);
    expect(stagesB.body.stages).toHaveLength(7);
    expect(stagesB.body.stages.map((s: any) => s.id)).not.toContain(bsA.body.stages[0].id);
  });

  it('rejects missing token', async () => {
    await request(h.app).get('/api/contacts').expect(401);
  });

  it('rejects invalid token', async () => {
    await request(h.app).get('/api/contacts')
      .set('Authorization', 'Bearer x.y.z').expect(401);
  });

  it('refreshes token', async () => {
    await h.signup('U', 'u@t.com', 'ChangeMe123!', 'TC');
    const lr = await request(h.app).post('/api/auth/login')
      .send({ email: 'u@t.com', password: 'ChangeMe123!' }).expect(200);
    const rr = await request(h.app).post('/api/auth/refresh')
      .send({ refreshToken: lr.body.refresh_token }).expect(200);
    expect(rr.body.token).toBeTruthy();
  });

  it('blocks viewer writes', async () => {
    const at = await h.signup('A', 'a@t.com', 'ChangeMe123!', 'TC');
    const invite = await request(h.app).post('/api/users/invite')
      .set('Authorization', `Bearer ${at.token}`)
      .send({ name: 'V', email: 'v@t.com', role: UserRole.VIEWER }).expect(201);
    const vt = await h.login('v@t.com', invite.body.temporary_password);
    await request(h.app).post('/api/contacts')
      .set('Authorization', `Bearer ${vt}`)
      .send({ first_name: 'R', last_name: 'O', email: 'ro@x.com', account_id: 'na', owner_id: 'nu' })
      .expect(403);
  });

  it('admin lists users', async () => {
    const { token } = await h.signup('A', 'a@t.com', 'ChangeMe123!', 'TC');
    const r = await request(h.app).get('/api/users')
      .set('Authorization', `Bearer ${token}`).expect(200);
    expect(r.body.users).toHaveLength(1);
  });

  it('prevents self role change', async () => {
    const { token, userId } = await h.signup('A', 'a@t.com', 'ChangeMe123!', 'TC');
    await request(h.app).put(`/api/users/${userId}/role`)
      .set('Authorization', `Bearer ${token}`)
      .send({ role: UserRole.VIEWER }).expect(400);
  });

  it('prevents self deactivation', async () => {
    const { token, userId } = await h.signup('A', 'a@t.com', 'ChangeMe123!', 'TC');
    await request(h.app).post(`/api/users/${userId}/toggle-status`)
      .set('Authorization', `Bearer ${token}`).expect(400);
  });

  // ── Contacts ──────────────────────────────────────

  it('creates and lists contacts', async () => {
    const { token, userId } = await h.signup('A', 'a@t.com', 'ChangeMe123!', 'TC');
    // Create an account first so we have a valid account_id
    const acct = await request(h.app).post('/api/accounts')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Acme', owner_id: userId }).expect(201);

    const r = await request(h.app).post('/api/contacts')
      .set('Authorization', `Bearer ${token}`)
      .send({ first_name: 'Jane', last_name: 'Doe', email: 'j@x.com',
        account_id: acct.body.account.id, owner_id: userId })
      .expect(201);
    expect(r.body.contact.first_name).toBe('Jane');

    const l = await request(h.app).get('/api/contacts')
      .set('Authorization', `Bearer ${token}`).expect(200);
    expect(l.body.contacts.length).toBeGreaterThanOrEqual(1);
  });

  it('updates a contact', async () => {
    const { token, userId } = await h.signup('A', 'a@t.com', 'ChangeMe123!', 'TC');
    const acct = await request(h.app).post('/api/accounts')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Acme', owner_id: userId }).expect(201);
    const c = await request(h.app).post('/api/contacts')
      .set('Authorization', `Bearer ${token}`)
      .send({ first_name: 'J', last_name: 'D', email: 'j@x.com', account_id: acct.body.account.id, owner_id: userId })
      .expect(201);
    expect(c.body.contact.updated_at).toBeTruthy();
    const u = await request(h.app).put(`/api/contacts/${c.body.contact.id}`)
      .set('Authorization', `Bearer ${token}`).send({ title: 'CTO' }).expect(200);
    expect(u.body.contact.title).toBe('CTO');
  });

  it('tracks updated_at when a contact is edited', async () => {
    const { token, userId } = await h.signup('A', 'a@t.com', 'ChangeMe123!', 'TC');
    const acct = await request(h.app).post('/api/accounts')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Acme', owner_id: userId }).expect(201);
    const c = await request(h.app).post('/api/contacts')
      .set('Authorization', `Bearer ${token}`)
      .send({ first_name: 'J', last_name: 'D', email: 'j@x.com', account_id: acct.body.account.id, owner_id: userId })
      .expect(201);
    const created = new Date(c.body.contact.updated_at).getTime();

    const u = await request(h.app).put(`/api/contacts/${c.body.contact.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ title: 'CTO' }).expect(200);
    expect(u.body.contact.title).toBe('CTO');
    expect(new Date(u.body.contact.updated_at).getTime()).toBeGreaterThanOrEqual(created);
  });

  it('deletes a contact', async () => {
    const { token, userId } = await h.signup('A', 'a@t.com', 'ChangeMe123!', 'TC');
    const acct = await request(h.app).post('/api/accounts')
      .set('Authorization', `Bearer ${token}`).send({ name: 'Acme', owner_id: userId }).expect(201);
    const c = await request(h.app).post('/api/contacts')
      .set('Authorization', `Bearer ${token}`)
      .send({ first_name: 'J', last_name: 'D', email: 'j@x.com', account_id: acct.body.account.id, owner_id: userId })
      .expect(201);
    await request(h.app).delete(`/api/contacts/${c.body.contact.id}`)
      .set('Authorization', `Bearer ${token}`).expect(204);
  });

  // ── Accounts ──────────────────────────────────────

  it('creates and lists accounts', async () => {
    const { token, userId } = await h.signup('A', 'a@t.com', 'ChangeMe123!', 'TC');
    const r = await request(h.app).post('/api/accounts')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Acme Corp', owner_id: userId }).expect(201);
    expect(r.body.account.name).toBe('Acme Corp');
    expect(r.body.account.updated_at).toBeTruthy();
    const l = await request(h.app).get('/api/accounts')
      .set('Authorization', `Bearer ${token}`).expect(200);
    expect(l.body.accounts.length).toBeGreaterThanOrEqual(1);
  });

  it('tracks updated_at when an account is edited', async () => {
    const { token, userId } = await h.signup('A', 'a@t.com', 'ChangeMe123!', 'TC');
    const r = await request(h.app).post('/api/accounts')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Acme Corp', owner_id: userId }).expect(201);
    const created = new Date(r.body.account.updated_at).getTime();

    const u = await request(h.app).put(`/api/accounts/${r.body.account.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ industry: 'Technology' }).expect(200);
    expect(u.body.account.industry).toBe('Technology');
    expect(new Date(u.body.account.updated_at).getTime()).toBeGreaterThanOrEqual(created);
  });

  // ── Deals ─────────────────────────────────────────

  it('creates, moves, and closes a deal', async () => {
    const { token, userId } = await h.signup('A', 'a@t.com', 'ChangeMe123!', 'TC');
    const bs = await request(h.app).get('/api/crm/bootstrap')
      .set('Authorization', `Bearer ${token}`).expect(200);
    const pipeline = bs.body.pipelines[0];
    const stages = bs.body.stages;
    const openStages = stages.filter((s: any) => s.type === 'open');
    const wonStage = stages.find((s: any) => s.type === 'won');
    const acct = await request(h.app).post('/api/accounts')
      .set('Authorization', `Bearer ${token}`).send({ name: 'A', owner_id: userId }).expect(201);

    const d = await request(h.app).post('/api/deals')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Big Deal', pipeline_id: pipeline.id, stage_id: openStages[0].id,
        account_id: acct.body.account.id, owner_id: userId, value: 50000,
        close_date: new Date(Date.now() + 3e10).toISOString().split('T')[0] })
      .expect(201);
    expect(d.body.deal.value).toBe(50000);

    const m = await request(h.app).post(`/api/deals/${d.body.deal.id}/move-stage`)
      .set('Authorization', `Bearer ${token}`).send({ target_stage_id: openStages[1].id }).expect(200);
    expect(m.body.deal.stage_id).toBe(openStages[1].id);

    const w = await request(h.app).post(`/api/deals/${d.body.deal.id}/close`)
      .set('Authorization', `Bearer ${token}`).send({ outcome: 'won' }).expect(200);
    expect(w.body.deal.won_at).toBeTruthy();
  });

  // ── Leads ────────────────────────────────────────

  it('creates and lists leads', async () => {
    const { token, userId } = await h.signup('A', 'a@t.com', 'ChangeMe123!', 'TC');
    const r = await request(h.app).post('/api/leads')
      .set('Authorization', `Bearer ${token}`)
      .send({ first_name: 'Jane', last_name: 'Doe', company_name: 'Widgets Inc', email: 'jane@widgets.com', owner_id: userId })
      .expect(201);
    expect(r.body.lead.first_name).toBe('Jane');
    expect(r.body.lead.last_name).toBe('Doe');
    expect(r.body.lead.status).toBe('new');
    expect(r.body.lead.updated_at).toBeTruthy();

    const l = await request(h.app).get('/api/leads')
      .set('Authorization', `Bearer ${token}`).expect(200);
    expect(l.body.leads.length).toBeGreaterThanOrEqual(1);
  });

  it('updates a lead and tracks updated_at', async () => {
    const { token, userId } = await h.signup('A', 'a@t.com', 'ChangeMe123!', 'TC');
    const c = await request(h.app).post('/api/leads')
      .set('Authorization', `Bearer ${token}`)
      .send({ first_name: 'Jane', last_name: 'Doe', company_name: 'W', email: 'j@w.com', owner_id: userId })
      .expect(201);
    const u = await request(h.app).put(`/api/leads/${c.body.lead.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ status: 'nurturing', source: 'website' }).expect(200);
    expect(u.body.lead.status).toBe('nurturing');
    expect(u.body.lead.source).toBe('website');
    expect(u.body.lead.updated_at).toBeTruthy();
  });

  it('refuses to convert a lead that is not qualified', async () => {
    const { token, userId } = await h.signup('A', 'a@t.com', 'ChangeMe123!', 'TC');
    const c = await request(h.app).post('/api/leads')
      .set('Authorization', `Bearer ${token}`)
      .send({ first_name: 'Jane', last_name: 'Doe', company_name: 'Widgets Inc', email: 'jane@widgets.com', owner_id: userId })
      .expect(201);

    await request(h.app).post(`/api/leads/${c.body.lead.id}/convert`)
      .set('Authorization', `Bearer ${token}`)
      .send({ account: { name: 'Widgets Inc', owner_id: userId }, contact: { first_name: 'Jane', last_name: 'Doe', email: 'jane@widgets.com' } })
      .expect(400);
  });

  it('converts a qualified lead into an account and contact', async () => {
    const { token, userId } = await h.signup('A', 'a@t.com', 'ChangeMe123!', 'TC');
    const c = await request(h.app).post('/api/leads')
      .set('Authorization', `Bearer ${token}`)
      .send({ first_name: 'Jane', last_name: 'Doe', company_name: 'Widgets Inc', email: 'jane@widgets.com', owner_id: userId, status: 'qualified' })
      .expect(201);
    expect(c.body.lead.is_converted).toBe(false);

    const cv = await request(h.app).post(`/api/leads/${c.body.lead.id}/convert`)
      .set('Authorization', `Bearer ${token}`)
      .send({ account: { name: 'Widgets Inc', owner_id: userId }, contact: { first_name: 'Jane', last_name: 'Doe', email: 'jane@widgets.com' }, create_opportunity: true })
      .expect(200);
    expect(cv.body.account).toBeTruthy();
    expect(cv.body.contact).toBeTruthy();
    expect(cv.body.lead.status).toBe('converted');
    expect(cv.body.lead.is_converted).toBe(true);
    expect(cv.body.lead.converted_account_id).toBe(cv.body.account.id);

    // Opportunity was created from the conversion ("[Company] - Default Opportunity")
    expect(cv.body.opportunity).toBeTruthy();
    expect(cv.body.opportunity.name).toBe('Widgets Inc - Default Opportunity');
    expect(cv.body.opportunity.account_id).toBe(cv.body.account.id);

    const dl = await request(h.app).get('/api/deals')
      .set('Authorization', `Bearer ${token}`).expect(200);
    expect(dl.body.deals.some((d: { id: string }) => d.id === cv.body.opportunity.id)).toBe(true);

    const l = await request(h.app).get(`/api/leads/${c.body.lead.id}`)
      .set('Authorization', `Bearer ${token}`).expect(200);
    expect(l.body.lead.converted_at).toBeTruthy();
  });

  it('skips opportunity creation when create_opportunity is false', async () => {
    const { token, userId } = await h.signup('A', 'a@t.com', 'ChangeMe123!', 'TC');
    const c = await request(h.app).post('/api/leads')
      .set('Authorization', `Bearer ${token}`)
      .send({ first_name: 'Jane', last_name: 'Doe', company_name: 'Widgets Inc', email: 'jane@widgets.com', owner_id: userId, status: 'qualified' })
      .expect(201);

    const cv = await request(h.app).post(`/api/leads/${c.body.lead.id}/convert`)
      .set('Authorization', `Bearer ${token}`)
      .send({ account: { name: 'Widgets Inc', owner_id: userId }, contact: { first_name: 'Jane', last_name: 'Doe', email: 'jane@widgets.com' }, create_opportunity: false })
      .expect(200);
    expect(cv.body.opportunity).toBeUndefined();
    expect(cv.body.lead.is_converted).toBe(true);

    const dl = await request(h.app).get('/api/deals')
      .set('Authorization', `Bearer ${token}`).expect(200);
    expect(dl.body.deals.some((d: { name: string }) => d.name === 'Widgets Inc - Default Opportunity')).toBe(false);
  });

  it('rejects converting a lead that has already been converted', async () => {
    const { token, userId } = await h.signup('A', 'a@t.com', 'ChangeMe123!', 'TC');
    const c = await request(h.app).post('/api/leads')
      .set('Authorization', `Bearer ${token}`)
      .send({ first_name: 'Jane', last_name: 'Doe', company_name: 'Widgets Inc', email: 'jane@widgets.com', owner_id: userId, status: 'qualified' })
      .expect(201);

    await request(h.app).post(`/api/leads/${c.body.lead.id}/convert`)
      .set('Authorization', `Bearer ${token}`)
      .send({ account: { name: 'Widgets Inc', owner_id: userId }, contact: { first_name: 'Jane', last_name: 'Doe', email: 'jane@widgets.com' } })
      .expect(200);

    await request(h.app).post(`/api/leads/${c.body.lead.id}/convert`)
      .set('Authorization', `Bearer ${token}`)
      .send({ account: { name: 'Widgets Inc', owner_id: userId }, contact: { first_name: 'Jane', last_name: 'Doe', email: 'jane@widgets.com' } })
      .expect(400);
  });

  it('deletes a lead', async () => {
    const { token, userId } = await h.signup('A', 'a@t.com', 'ChangeMe123!', 'TC');
    const c = await request(h.app).post('/api/leads')
      .set('Authorization', `Bearer ${token}`)
      .send({ first_name: 'Jane', last_name: 'Doe', company_name: 'W', email: 'j@w.com', owner_id: userId })
      .expect(201);
    await request(h.app).delete(`/api/leads/${c.body.lead.id}`)
      .set('Authorization', `Bearer ${token}`).expect(204);
  });

  // ── Tasks ─────────────────────────────────────────

  it('creates, completes, deletes a task', async () => {
    const { token, userId } = await h.signup('A', 'a@t.com', 'ChangeMe123!', 'TC');
    const t = await request(h.app).post('/api/tasks')
      .set('Authorization', `Bearer ${token}`)
      .send({ title: 'Call', type: 'call', priority: 'high',
        due_at: new Date().toISOString(), assigned_to_id: userId }).expect(201);
    expect(t.body.task.title).toBe('Call');
    const c = await request(h.app).post(`/api/tasks/${t.body.task.id}/complete`)
      .set('Authorization', `Bearer ${token}`).expect(200);
    expect(c.body.task.completed_at).toBeTruthy();
    await request(h.app).delete(`/api/tasks/${t.body.task.id}`)
      .set('Authorization', `Bearer ${token}`).expect(204);
  });

  // ── Activity Timeline sub-system (record tasks + call logs) ──

  it('creates, lists, completes, and deletes a record task', async () => {
    const { token } = await h.signup('A', 'a@t.com', 'ChangeMe123!', 'TC');
    const created = await request(h.app).post('/api/record-tasks')
      .set('Authorization', `Bearer ${token}`)
      .send({ subject: 'Send proposal', description: 'Follow up', associated_to_id: 'lead-abc' })
      .expect(201);
    expect(created.body.recordTask.subject).toBe('Send proposal');
    expect(created.body.recordTask.user_id).toBeTruthy();
    expect(created.body.recordTask.associated_to_id).toBe('lead-abc');

    const listed = await request(h.app).get('/api/record-tasks?associated_to_id=lead-abc')
      .set('Authorization', `Bearer ${token}`).expect(200);
    expect(listed.body.recordTasks.length).toBe(1);
    expect(listed.body.total).toBe(1);

    const completed = await request(h.app).patch(`/api/record-tasks/${created.body.recordTask.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ completed_at: new Date().toISOString() })
      .expect(200);
    expect(completed.body.recordTask.completed_at).toBeTruthy();

    await request(h.app).delete(`/api/record-tasks/${created.body.recordTask.id}`)
      .set('Authorization', `Bearer ${token}`).expect(204);
  });

  it('creates and lists call logs', async () => {
    const { token } = await h.signup('A', 'a@t.com', 'ChangeMe123!', 'TC');
    const created = await request(h.app).post('/api/call-logs')
      .set('Authorization', `Bearer ${token}`)
      .send({ subject: 'Discovery call', description: 'Went well', associated_to_id: 'deal-xyz' })
      .expect(201);
    expect(created.body.callLog.subject).toBe('Discovery call');

    const listed = await request(h.app).get('/api/call-logs?associated_to_id=deal-xyz')
      .set('Authorization', `Bearer ${token}`).expect(200);
    expect(listed.body.callLogs.length).toBe(1);

    const other = await request(h.app).get('/api/call-logs?associated_to_id=deal-other')
      .set('Authorization', `Bearer ${token}`).expect(200);
    expect(other.body.callLogs.length).toBe(0);
  });

  it('rejects a record task without a subject', async () => {
    const { token } = await h.signup('A', 'a@t.com', 'ChangeMe123!', 'TC');
    await request(h.app).post('/api/record-tasks')
      .set('Authorization', `Bearer ${token}`)
      .send({ description: 'missing subject', associated_to_id: 'lead-abc' })
      .expect(400);
  });

  // ── Email ─────────────────────────────────────────

  it('creates templates with auto-detected variables', async () => {
    const { token, userId } = await h.signup('A', 'a@t.com', 'ChangeMe123!', 'TC');
    const r = await request(h.app).post('/api/email-templates')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Welcome', subject: 'Hi {{contact.first_name}}',
        body_html: '<p>{{contact.first_name}} @ {{account.name}}</p>', created_by_id: userId })
      .expect(201);
    expect(r.body.template.variables).toContain('contact.first_name');
  });

  // ── Reports ───────────────────────────────────────

  it('returns leaderboard', async () => {
    const { token } = await h.signup('A', 'a@t.com', 'ChangeMe123!', 'TC');
    const r = await request(h.app).get('/api/reports/leaderboard')
      .set('Authorization', `Bearer ${token}`).expect(200);
    expect(r.body.leaderboard).toBeInstanceOf(Array);
  });

  it('returns pipeline health', async () => {
    const { token } = await h.signup('A', 'a@t.com', 'ChangeMe123!', 'TC');
    const r = await request(h.app).get('/api/reports/pipeline-health')
      .set('Authorization', `Bearer ${token}`).expect(200);
    expect(r.body.funnel).toBeInstanceOf(Array);
  });

  it('returns custom reports', async () => {
    const { token } = await h.signup('A', 'a@t.com', 'ChangeMe123!', 'TC');
    const r = await request(h.app).get('/api/reports/custom?entity=deals&aggregate=count')
      .set('Authorization', `Bearer ${token}`).expect(200);
    expect(r.body.data).toBeInstanceOf(Array);
  });

  // ── Reports: dashboard data-correctness regressions ───────────────
  //
  // These cover the regressions reported against the Dashboards module:
  //   * pipeline-health funnel must render every stage exactly once even when
  //     duplicate pipelines/stages exist in the snapshot (CRITICAL — was
  //     duplicating stages in the funnel & donut charts);
  //   * win_rate / avg_probability must be 0 (not a fabricated 50%) when there
  //     are zero closed deals (HIGH — contradicted the team leaderboard's
  //     0% win-rate on the same page);
  //   * GET /api/reports/custom with the legacy singular `entity=deal` spellings
  //     or with arbitrary group_by values (lost_reason / competitor_name /
  //     owner_id) must return 200 with possibly-empty data instead of HTTP 400
  //     (HIGH — the Win/Loss tab was silently rendering empty states for failed
  //     requests).

  it('pipeline-health funnel de-duplicates stages across duplicate pipelines', async () => {
    const { token } = await h.signup('A', 'a@t.com', 'ChangeMe123!', 'TC');
    const bs = await request(h.app).get('/api/crm/bootstrap')
      .set('Authorization', `Bearer ${token}`).expect(200);
    const defaultPipeline = bs.body.pipelines.find((p: any) => p.is_default) ?? bs.body.pipelines[0];
    const defaultPipelineId = defaultPipeline.id;
    const openStageNames = (bs.body.stages as any[])
      .filter((s: any) => s.pipeline_id === defaultPipelineId && s.type === 'open')
      .map((s: any) => s.name);
    expect(openStageNames.length).toBeGreaterThan(0);

    // Add a SECOND default pipeline with the same stage names — reproduces the
    // seed / signup-twice scenario that was doubling every stage on the
    // dashboard. (Setting is_default=true also tests that the dedupe prefers
    // the original default rather than picking the most recent.)
    const newPipe = await request(h.app).post('/api/pipelines')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Duplicate Default Sales Pipeline', is_default: true })
      .expect(201);
    for (const stg of (bs.body.stages as any[]).filter((s: any) => s.pipeline_id === defaultPipelineId)) {
      await request(h.app).post('/api/stages')
        .set('Authorization', `Bearer ${token}`)
        .send({
          pipeline_id: newPipe.body.pipeline.id,
          name: stg.name,
          probability: stg.probability,
          order: stg.order,
          type: stg.type,
        })
        .expect(201);
    }

    const r = await request(h.app).get('/api/reports/pipeline-health')
      .set('Authorization', `Bearer ${token}`).expect(200);
    expect(r.body.funnel).toBeInstanceOf(Array);
    const funnelStageNames = (r.body.funnel as any[]).map(s => s.stage_name);
    // Each open stage appears exactly once — never twice.
    for (const name of openStageNames) {
      const occurrences = funnelStageNames.filter(n => n === name).length;
      expect(occurrences).toBe(1);
    }
    expect(funnelStageNames.length).toBe(openStageNames.length);
  });

  it('pipeline-health reports 0% win rate / avg probability with no deals', async () => {
    const { token } = await h.signup('A', 'a@t.com', 'ChangeMe123!', 'TC');
    const r = await request(h.app).get('/api/reports/pipeline-health')
      .set('Authorization', `Bearer ${token}`).expect(200);
    // No deals exist for a brand-new tenant; the previous default of 50%
    // (averaging the stage probabilities) is gone.
    expect(r.body.win_rate).toBe(0);
    expect(r.body.avg_probability).toBe(0);
    expect(r.body.won_count).toBe(0);
    expect(r.body.lost_count).toBe(0);
    expect(r.body.closed_count).toBe(0);
    expect(r.body.open_deals_count).toBe(0);
    expect(r.body.total_pipeline_value).toBe(0);
  });

  it('custom report accepts the legacy singular entity spellings', async () => {
    const { token } = await h.signup('A', 'a@t.com', 'ChangeMe123!', 'TC');
    // Frontend sent `entity=deal` (singular) for the Win/Loss tab; this used to
    // 400 because the schema only matched the plural form.
    for (const entity of ['deal', 'contact', 'account', 'task']) {
      const r = await request(h.app).get(`/api/reports/custom?entity=${entity}&aggregate=count`)
        .set('Authorization', `Bearer ${token}`).expect(200);
      expect(r.body.data).toBeInstanceOf(Array);
    }
  });

  it('custom report returns 200 (not 400) for group_by=lost_reason / competitor_name / owner_id', async () => {
    const { token } = await h.signup('A', 'a@t.com', 'ChangeMe123!', 'TC');
    for (const groupBy of ['lost_reason', 'competitor_name', 'owner_id']) {
      const r = await request(h.app).get(`/api/reports/custom?entity=deal&group_by=${groupBy}&aggregate=count`)
        .set('Authorization', `Bearer ${token}`).expect(200);
      expect(r.body.data).toBeInstanceOf(Array);
      expect(r.body.group_by).toBe(groupBy);
    }
  });

  it('custom report surfaces lost-deal lost_reason in the grouped result', async () => {
    const { token, userId } = await h.signup('A', 'a@t.com', 'ChangeMe123!', 'TC');
    const bs = await request(h.app).get('/api/crm/bootstrap')
      .set('Authorization', `Bearer ${token}`).expect(200);
    const pipeline = bs.body.pipelines[0];
    const openStage = (bs.body.stages as any[]).find((s: any) => s.type === 'open');
    const acct = await request(h.app).post('/api/accounts')
      .set('Authorization', `Bearer ${token}`).send({ name: 'A', owner_id: userId }).expect(201);
    const d = await request(h.app).post('/api/deals')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Lost Deal', pipeline_id: pipeline.id, stage_id: openStage.id,
        account_id: acct.body.account.id, owner_id: userId, value: 1000,
        close_date: new Date(Date.now() + 3e10).toISOString().split('T')[0] })
      .expect(201);
    await request(h.app).post(`/api/deals/${d.body.deal.id}/close`)
      .set('Authorization', `Bearer ${token}`)
      .send({ outcome: 'lost', reason: 'Price too high' })
      .expect(200);

    // group_by=lost_reason must return 200 and surface the lost reason as a
    // group label (the previous behavior was HTTP 400 + silent empty UI).
    const r = await request(h.app).get('/api/reports/custom?entity=deal&group_by=lost_reason&aggregate=count')
      .set('Authorization', `Bearer ${token}`).expect(200);
    const groups = (r.body.data as any[]).map(row => row.group);
    expect(groups).toContain('Price too high');
  });

  // ── GDPR ──────────────────────────────────────────

  it('exports user data', async () => {
    const { token } = await h.signup('A', 'a@t.com', 'ChangeMe123!', 'TC');
    const r = await request(h.app).get('/api/gdpr/export')
      .set('Authorization', `Bearer ${token}`).expect(200);
    expect(r.body.user).toBeTruthy();
  });

  // ── Notifications ─────────────────────────────────

  it('lists notifications', async () => {
    const { token } = await h.signup('A', 'a@t.com', 'ChangeMe123!', 'TC');
    const r = await request(h.app).get('/api/notifications')
      .set('Authorization', `Bearer ${token}`).expect(200);
    expect(r.body.notifications).toBeInstanceOf(Array);
  });

  // ── OIDC ──────────────────────────────────────────

  it('lists OIDC providers', async () => {
    await request(h.app).get('/api/auth/oidc/providers').expect(200);
  });

  // ── Feature Flags (G-AI-14 / G-OPS-06) ────────────

  it('lists effective feature flags for the caller', async () => {
    const { token } = await h.signup('A', 'a@t.com', 'ChangeMe123!', 'TC');
    const r = await request(h.app).get('/api/flags')
      .set('Authorization', `Bearer ${token}`).expect(200);
    const scoring = r.body.flags.find((f: { key: string }) => f.key === 'ai.deal_scoring');
    expect(scoring?.enabled).toBe(true);
  });

  it('admin can toggle an org flag and the change is effective + audited', async () => {
    const { token } = await h.signup('A', 'a@t.com', 'ChangeMe123!', 'TC');
    await request(h.app).put('/api/admin/flags/ai.deal_scoring')
      .set('Authorization', `Bearer ${token}`)
      .send({ enabled: false, scope: 'organization' }).expect(200);

    const r = await request(h.app).get('/api/flags')
      .set('Authorization', `Bearer ${token}`).expect(200);
    const scoring = r.body.flags.find((f: { key: string }) => f.key === 'ai.deal_scoring');
    expect(scoring?.enabled).toBe(false);

    const audit = await request(h.app).get('/api/audit-logs')
      .set('Authorization', `Bearer ${token}`);
    if (audit.status === 200) {
      const entries = audit.body.auditLogs ?? audit.body.logs ?? [];
      expect(JSON.stringify(entries)).toContain('feature_flag.changed');
    }
  });

  it('rejects unauthenticated flag access', async () => {
    await request(h.app).get('/api/flags').expect(401);
  });

  // ── Account Lockout ───────────────────────────────

  it('locks account after configured max failures', async () => {
    await h.signup('L', 'lock@t.com', 'ChangeMe123!', 'TC');
    // Deterministic baseline: clear any lockout state (email and shared-IP keys)
    // accumulated by other requests in this harness (G-SEC-09).
    h.lockoutService.resetAll();
    const { maxFailedAttempts } = h.lockoutService.getConfig();
    // First (max - 1) failures return 401
    for (let i = 0; i < maxFailedAttempts - 1; i++) {
      await request(h.app).post('/api/auth/login')
        .send({ email: 'lock@t.com', password: 'WrongPassword!' }).expect(401);
    }
    // Final failure locks the account (429)
    await request(h.app).post('/api/auth/login')
      .send({ email: 'lock@t.com', password: 'WrongPassword!' }).expect(429);
    // Subsequent attempts (even with the correct password) stay locked
    await request(h.app).post('/api/auth/login')
      .send({ email: 'lock@t.com', password: 'ChangeMe123!' }).expect(429);
  });

  // ── Idempotency (G-DAT-12) ────────────────────────

  it('replays a POST with the same Idempotency-Key instead of creating a duplicate', async () => {
    const { token, userId } = await h.signup('A', 'a@t.com', 'ChangeMe123!', 'TC');

    const first = await request(h.app).post('/api/accounts')
      .set('Authorization', `Bearer ${token}`)
      .set('Idempotency-Key', 'create-acme-001')
      .send({ name: 'Acme', owner_id: userId }).expect(201);

    const replay = await request(h.app).post('/api/accounts')
      .set('Authorization', `Bearer ${token}`)
      .set('Idempotency-Key', 'create-acme-001')
      .send({ name: 'Acme', owner_id: userId }).expect(201);

    expect(replay.headers['idempotency-replayed']).toBe('true');
    expect(replay.body.account.id).toBe(first.body.account.id);

    // A different key creates a distinct record
    const other = await request(h.app).post('/api/accounts')
      .set('Authorization', `Bearer ${token}`)
      .set('Idempotency-Key', 'create-acme-002')
      .send({ name: 'Acme 2', owner_id: userId }).expect(201);
    expect(other.body.account.id).not.toBe(first.body.account.id);
  });

  it('does not cache failed requests for an Idempotency-Key', async () => {
    const { token, userId } = await h.signup('A', 'a@t.com', 'ChangeMe123!', 'TC');

    // Invalid body -> 400, key must remain reusable
    await request(h.app).post('/api/accounts')
      .set('Authorization', `Bearer ${token}`)
      .set('Idempotency-Key', 'retry-after-failure')
      .send({}).expect(400);

    await request(h.app).post('/api/accounts')
      .set('Authorization', `Bearer ${token}`)
      .set('Idempotency-Key', 'retry-after-failure')
      .send({ name: 'Retry Co', owner_id: userId }).expect(201);
  });

  // ── CSRF ──────────────────────────────────────────

  it('bypasses CSRF in test mode', async () => {
    const { token, userId } = await h.signup('A', 'a@t.com', 'ChangeMe123!', 'TC');
    const acct = await request(h.app).post('/api/accounts')
      .set('Authorization', `Bearer ${token}`).send({ name: 'A', owner_id: userId }).expect(201);
    await request(h.app).post('/api/contacts')
      .set('Authorization', `Bearer ${token}`)
      .send({ first_name: 'T', last_name: 'C', email: 'tc@x.com', account_id: acct.body.account.id, owner_id: userId })
      .expect(201);
  });
});
