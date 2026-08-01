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
  process.env.DEMO_PASSWORD = 'ChangeMe123!';

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

  return { app, repository, signup, login };
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

  it('signs up, blocks second signup, and logs in', async () => {
    const sr = await request(h.app).post('/api/auth/signup')
      .send({ name: 'Admin', email: 'a@t.com', password: 'ChangeMe123!', company_name: 'TC' })
      .expect(201);
    expect(sr.body.token).toBeTruthy();

    await request(h.app).post('/api/auth/signup')
      .send({ name: 'B', email: 'b@t.com', password: 'ChangeMe123!', company_name: 'TC2' })
      .expect(403);

    const lr = await request(h.app).post('/api/auth/login')
      .send({ email: 'a@t.com', password: 'ChangeMe123!' }).expect(200);
    expect(lr.body.token).toBeTruthy();
  });

  it('returns scoped bootstrap after signup', async () => {
    const { token } = await h.signup('D', 'd@t.com', 'ChangeMe123!', 'TC');
    const r = await request(h.app).get('/api/crm/bootstrap')
      .set('Authorization', `Bearer ${token}`).expect(200);
    expect(r.body.users).toHaveLength(1);
    expect(r.body.pipelines).toHaveLength(2); // 1 seed + 1 from signup
    expect(r.body.stages).toHaveLength(14); // 7 seed + 7 from signup
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
    await request(h.app).post('/api/users/invite')
      .set('Authorization', `Bearer ${at.token}`)
      .send({ name: 'V', email: 'v@t.com', role: UserRole.VIEWER }).expect(201);
    const vt = await h.login('v@t.com', 'ChangeMe123!');
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
    const u = await request(h.app).put(`/api/contacts/${c.body.contact.id}`)
      .set('Authorization', `Bearer ${token}`).send({ title: 'CTO' }).expect(200);
    expect(u.body.contact.title).toBe('CTO');
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
    const l = await request(h.app).get('/api/accounts')
      .set('Authorization', `Bearer ${token}`).expect(200);
    expect(l.body.accounts.length).toBeGreaterThanOrEqual(1);
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

  // ── Account Lockout ───────────────────────────────

  it('locks account after 5 failures', async () => {
    await h.signup('L', 'lock@t.com', 'ChangeMe123!', 'TC');
    // First 4 failures return 401
    for (let i = 0; i < 4; i++) {
      await request(h.app).post('/api/auth/login')
        .send({ email: 'lock@t.com', password: 'WrongPassword!' }).expect(401);
    }
    // 5th failure locks the account (429)
    await request(h.app).post('/api/auth/login')
      .send({ email: 'lock@t.com', password: 'WrongPassword!' }).expect(429);
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
