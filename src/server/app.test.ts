import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { UserRole } from '../types.js';
import { createApp } from './app.js';
import { loadConfig } from './config.js';
import { EmailService } from './email/service.js';
import { createLogger } from './logger.js';
import { InMemoryCrmRepository } from './repositories/crmRepository.js';

async function createTestHarness() {
  process.env.NODE_ENV = 'test';
  process.env.JWT_SECRET = 'test-secret-that-is-long-enough-for-hmac';
  process.env.PASSWORD_PEPPER = 'test-password-pepper';
  process.env.DEMO_PASSWORD = 'ChangeMe123!';

  const config = loadConfig();
  const repository = new InMemoryCrmRepository();
  // Sync the repo's pepper with the config (required for password verification)
  await repository.bootstrapDemoPasswords(config.DEMO_PASSWORD, config.PASSWORD_PEPPER);

  const emailService = new EmailService({ provider: 'console', from: 'test@boutinly.com' }, createLogger('test'));
  await emailService.initialize();

  const app = createApp({
    config,
    logger: createLogger('test'),
    repository,
    emailService,
  });

  async function signup(name: string, email: string, password: string, company: string) {
    const response = await request(app)
      .post('/api/auth/signup')
      .send({ name, email, password, company_name: company })
      .expect(201);

    return response.body.token as string;
  }

  async function login(email: string, password: string) {
    const response = await request(app)
      .post('/api/auth/login')
      .send({ email, password })
      .expect(200);

    return response.body.token as string;
  }

  return { app, repository, signup, login };
}

describe('Boutinly CRM API', () => {
  let harness: Awaited<ReturnType<typeof createTestHarness>>;

  beforeEach(async () => {
    harness = await createTestHarness();
  });

  it('returns health status', async () => {
    const response = await request(harness.app).get('/api/health').expect(200);
    expect(response.body.status).toBe('ok');
    expect(response.body.service).toBe('boutinly-crm-api');
  });

  it('signs up a new organization and logs in', async () => {
    // First signup should succeed
    const signupResponse = await request(harness.app)
      .post('/api/auth/signup')
      .send({
        name: 'Test Admin',
        email: 'admin@testcorp.com',
        password: 'ChangeMe123!',
        company_name: 'Test Corp',
      })
      .expect(201);

    expect(signupResponse.body.token).toEqual(expect.any(String));
    expect(signupResponse.body.refresh_token).toEqual(expect.any(String));
    expect(signupResponse.body.user.role).toBe(UserRole.SUPER_ADMIN);
    expect(signupResponse.body.user.email).toBe('admin@testcorp.com');

    // Second signup should be blocked (users already exist)
    await request(harness.app)
      .post('/api/auth/signup')
      .send({
        name: 'Another Admin',
        email: 'another@testcorp.com',
        password: 'ChangeMe123!',
        company_name: 'Another Corp',
      })
      .expect(403);

    // Login should work with the created user
    const loginResponse = await request(harness.app)
      .post('/api/auth/login')
      .send({ email: 'admin@testcorp.com', password: 'ChangeMe123!' })
      .expect(200);

    expect(loginResponse.body.token).toEqual(expect.any(String));
    expect(loginResponse.body.user.email).toBe('admin@testcorp.com');
  });

  it('returns scoped CRM data after signup', async () => {
    // Signup creates org + default pipeline + stages
    const token = await harness.signup('David', 'david@testcorp.com', 'ChangeMe123!', 'Test Corp');

    const response = await request(harness.app)
      .get('/api/crm/bootstrap')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    // Should have 1 user, 1 pipeline, and 7 stages
    expect(response.body.users).toHaveLength(1);
    expect(response.body.users[0].email).toBe('david@testcorp.com');
    expect(response.body.pipelines).toHaveLength(1);
    expect(response.body.stages).toHaveLength(7);
    expect(response.body.pipelines[0].is_default).toBe(true);
  });

  it('blocks viewer writes', async () => {
    // Signup as super admin to create the org and invite a viewer
    const adminToken = await harness.signup('Admin', 'admin@testcorp.com', 'ChangeMe123!', 'Test Corp');

    // Invite a viewer user
    const inviteResponse = await request(harness.app)
      .post('/api/users/invite')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'Viewer User', email: 'viewer@testcorp.com', role: UserRole.VIEWER })
      .expect(201);

    // Login as the viewer
    const viewerToken = await harness.login('viewer@testcorp.com', 'ChangeMe123!');

    // Viewer should get 403 on write
    await request(harness.app)
      .post('/api/contacts')
      .set('Authorization', `Bearer ${viewerToken}`)
      .send({
        first_name: 'Read',
        last_name: 'Only',
        email: 'readonly@example.com',
        account_id: 'acc-none',
        owner_id: 'usr-none',
      })
      .expect(403);
  });

  it('allows an admin to list users', async () => {
    const token = await harness.signup('Admin', 'admin@testcorp.com', 'ChangeMe123!', 'Test Corp');

    const response = await request(harness.app)
      .get('/api/users')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(response.body.users.length).toBe(1);
    expect(response.body.users[0].email).toBe('admin@testcorp.com');
  });
});
