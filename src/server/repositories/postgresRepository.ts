import { createHash, randomBytes, randomUUID } from 'node:crypto';
import type {
  Account,
  Activity,
  ApiKey,
  ApprovalRequest,
  AuditLog,
  CalendarTokenRecord,
  Contact,
  CustomFieldDefinition,
  Deal,
  EmailCampaign,
  EmailTemplate,
  FieldPermission,
  FileRecord,
  Lead,
  Notification,
  Organization,
  OrgSecurityPolicy,
  Pipeline,
  Quota,
  RecordTask,
  CallLog,
  Stage,
  Task,
  User,
  UserRole,
  Webhook,
  WebhookDelivery,
} from '../../types.js';
import { query } from '../db/connection.js';
import type { DbRow } from '../db/types.js';
import { hashPassword, verifyPassword } from '../security/password.js';
import type {
  CrmRepository,
  CrmSnapshot,
  CreateAccountInput,
  CreateActivityInput,
  CreateAuditLogInput,
  CreateContactInput,
  CreateCustomFieldInput,
  CreateDealInput,
  CreateEmailCampaignInput,
  CreateEmailTemplateInput,
  CreateFileInput,
  CreateLeadInput,
  CreateRecordTaskInput,
  CreateCallLogInput,
  CreateTaskInput,
  CreateUserInput,
  ConvertLeadInput,
  LeadConversionResult,
  PaginationParams,
  UpdateAccountInput,
  UpdateContactInput,
  UpdateDealInput,
  UpdateLeadInput,
  UpdateRecordTaskInput,
  UpdateTaskInput,
} from './crmRepository.js';

export class PostgresCrmRepository implements CrmRepository {
  // ─── Bootstrap (no-op: passwords handled by seed) ────

  async bootstrapDemoPasswords(_password: string, _pepper: string) {
    // PostgreSQL passwords are set via seed script — nothing to do here
  }

  // ─── Organization ────────────────────────────────────

  async createOrganization(name: string, slug: string): Promise<Organization> {
    const result = await query(
      `INSERT INTO organizations (id, name, slug, plan, ses_domain, fiscal_year_start)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [randomUUID(), name, slug, 'enterprise', `${slug}.boutinly.com`, 1],
    );
    return this.rowToOrganization(result.rows[0]);
  }

  async getOrganizationById(orgId: string): Promise<Organization | null> {
    const result = await query('SELECT * FROM organizations WHERE id = $1', [orgId]);
    return result.rows.length > 0 ? this.rowToOrganization(result.rows[0]) : null;
  }

  async countUsers(): Promise<number> {
    const result = await query('SELECT count(*) as cnt FROM users');
    return Number(result.rows[0]?.cnt || 0);
  }

  // ─── Auth ────────────────────────────────────────────

  async verifyLogin(email: string, password: string) {
    const pepper = process.env.PASSWORD_PEPPER || 'development-password-pepper';
    const result = await query(
      `SELECT id, organization_id, email, name, avatar_url, role, mfa_enabled, is_active, timezone, team_id
       FROM users WHERE lower(email) = lower($1) AND is_active = true`,
      [email],
    );

    if (result.rows.length === 0) return null;

    const row = result.rows[0];
    const hashResult = await query(
      'SELECT password_hash FROM users WHERE id = $1',
      [row.id],
    );

    const hash = hashResult.rows[0]?.password_hash;
    if (!hash) return null;

    const ok = await verifyPassword(password, hash, pepper);
    if (!ok) return null;

    return this.rowToUser(row);
  }

  async getUserById(userId: string) {
    const result = await query(
      `SELECT id, organization_id, email, name, avatar_url, role, mfa_enabled, is_active, timezone, team_id
       FROM users WHERE id = $1`,
      [userId],
    );
    return result.rows.length > 0 ? this.rowToUser(result.rows[0]) : null;
  }

  async getUserByEmail(email: string) {
    const result = await query(
      `SELECT id, organization_id, email, name, avatar_url, role, mfa_enabled, is_active, timezone, team_id
       FROM users WHERE lower(email) = lower($1)`,
      [email],
    );
    return result.rows.length > 0 ? this.rowToUser(result.rows[0]) : null;
  }

  async storePasswordResetToken(userId: string): Promise<string> {
    const rawToken = randomBytes(32).toString('hex');
    const hashed = createHash('sha256').update(rawToken).digest('hex');
    await query(
      `INSERT INTO password_reset_tokens (user_id, token_hash, expires_at)
       VALUES ($1, $2, NOW() + INTERVAL '1 hour')`,
      [userId, hashed],
    );
    return rawToken;
  }

  async consumePasswordResetToken(token: string): Promise<string | null> {
    const hashed = createHash('sha256').update(token).digest('hex');
    const result = await query(
      `DELETE FROM password_reset_tokens
       WHERE token_hash = $1 AND expires_at > NOW()
       RETURNING user_id`,
      [hashed],
    );
    return result.rows.length > 0 ? result.rows[0].user_id : null;
  }

  async updateUserPassword(userId: string, passwordHash: string): Promise<void> {
    await query(
      `UPDATE users SET password_hash = $2 WHERE id = $1`,
      [userId, passwordHash],
    );
  }

  async getTotpSecret(userId: string): Promise<string | null> {
    const result = await query(
      `SELECT totp_secret FROM users WHERE id = $1`,
      [userId],
    );
    return result.rows[0]?.totp_secret || null;
  }

  async setTotpSecret(userId: string, secret: string): Promise<void> {
    await query(
      `UPDATE users SET totp_secret = $2 WHERE id = $1`,
      [userId, secret],
    );
  }

  async enableMfa(userId: string): Promise<void> {
    await query(
      `UPDATE users SET mfa_enabled = true WHERE id = $1`,
      [userId],
    );
  }

  async disableMfa(userId: string): Promise<void> {
    await query(
      `UPDATE users SET mfa_enabled = false, totp_secret = NULL WHERE id = $1`,
      [userId],
    );
  }

  // ─── Users ──────────────────────────────────────────

  async listUsers(): Promise<User[]> {
    const result = await query(
      `SELECT id, organization_id, email, name, avatar_url, role, mfa_enabled, is_active, timezone, team_id
       FROM users ORDER BY name`,
    );
    return result.rows.map((row: DbRow) => this.rowToUser(row));
  }

  async addUser(input: CreateUserInput): Promise<User> {
    const pepper = process.env.PASSWORD_PEPPER || 'development-password-pepper';
    const demoPassword = process.env.DEMO_PASSWORD || 'ChangeMe123!';
    const passwordHash = await hashPassword(demoPassword, pepper);

    const result = await query(
      `INSERT INTO users (id, organization_id, email, name, password_hash, role, is_active, timezone)
       VALUES ($1, current_setting('app.organization_id'), $2, $3, $4, $5, true, 'UTC')
       RETURNING id, email, name, avatar_url, role, mfa_enabled, is_active, timezone, team_id`,
      [randomUUID(), input.email, input.name, passwordHash, input.role],
    );
    return this.rowToUser(result.rows[0]);
  }

  async addUserWithPassword(input: { name: string; email: string; passwordHash: string; role: UserRole; organization_id?: string }): Promise<User> {
    const result = await query(
      `INSERT INTO users (id, organization_id, email, name, password_hash, role, is_active, timezone)
       VALUES ($1, $2, $3, $4, $5, $6, true, 'UTC')
       RETURNING id, organization_id, email, name, avatar_url, role, mfa_enabled, is_active, timezone, team_id`,
      [randomUUID(), input.organization_id || null, input.email, input.name, input.passwordHash, input.role],
    );
    return this.rowToUser(result.rows[0]);
  }

  async updateUserRole(userId: string, role: UserRole): Promise<User | null> {
    const result = await query(
      `UPDATE users SET role = $2 WHERE id = $1
       RETURNING id, email, name, avatar_url, role, mfa_enabled, is_active, timezone, team_id`,
      [userId, role],
    );
    return result.rows.length > 0 ? this.rowToUser(result.rows[0]) : null;
  }

  async toggleUserStatus(userId: string): Promise<User | null> {
    const result = await query(
      `UPDATE users SET is_active = NOT is_active WHERE id = $1
       RETURNING id, email, name, avatar_url, role, mfa_enabled, is_active, timezone, team_id`,
      [userId],
    );
    return result.rows.length > 0 ? this.rowToUser(result.rows[0]) : null;
  }

  // ─── Contacts ───────────────────────────────────────

  async listContacts(params?: PaginationParams): Promise<Contact[]> {
    let sql = `SELECT * FROM contacts`;
    const conditions: string[] = [];
    const values: unknown[] = [];
    let paramIdx = 1;

    if (params?.search) {
      conditions.push(`(first_name ILIKE $${paramIdx} OR last_name ILIKE $${paramIdx} OR email ILIKE $${paramIdx})`);
      values.push(`%${params.search}%`);
      paramIdx++;
    }

    if (conditions.length > 0) {
      sql += ` WHERE ` + conditions.join(' AND ');
    }

    sql += ` ORDER BY created_at DESC`;

    if (params?.page && params?.limit) {
      sql += ` LIMIT $${paramIdx} OFFSET $${paramIdx + 1}`;
      values.push(params.limit, (params.page - 1) * params.limit);
    }

    const result = await query(sql, values);
    return result.rows.map((row: DbRow) => this.rowToContact(row));
  }

  async getContactById(id: string): Promise<Contact | null> {
    const result = await query('SELECT * FROM contacts WHERE id = $1', [id]);
    return result.rows.length > 0 ? this.rowToContact(result.rows[0]) : null;
  }

  async addContact(input: CreateContactInput): Promise<Contact> {
    const result = await query(
      `INSERT INTO contacts (id, organization_id, account_id, owner_id, first_name, last_name, email, phone, title, linkedin_url, tags, custom_fields, unsubscribed)
       VALUES ($1, current_setting('app.organization_id'), $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
       RETURNING *`,
      [randomUUID(), input.account_id, input.owner_id, input.first_name, input.last_name, input.email,
       input.phone || '', input.title || '', input.linkedin_url || '', input.tags || [], JSON.stringify(input.custom_fields || {}), input.unsubscribed || false],
    );
    return this.rowToContact(result.rows[0]);
  }

  async updateContact(id: string, input: UpdateContactInput): Promise<Contact | null> {
    const fields: string[] = [];
    const values: unknown[] = [id];
    let idx = 2;

    const stringFields = ['first_name', 'last_name', 'email', 'phone', 'title', 'linkedin_url'] as const;
    for (const field of stringFields) {
      if (input[field] !== undefined) {
        fields.push(`${field} = $${idx++}`);
        values.push(input[field]);
      }
    }

    if (input.tags !== undefined) {
      fields.push(`tags = $${idx++}`);
      values.push(input.tags);
    }
    if (input.custom_fields !== undefined) {
      fields.push(`custom_fields = $${idx++}`);
      values.push(JSON.stringify(input.custom_fields));
    }
    if (input.owner_id !== undefined) {
      fields.push(`owner_id = $${idx++}`);
      values.push(input.owner_id);
    }
    if (input.account_id !== undefined) {
      fields.push(`account_id = $${idx++}`);
      values.push(input.account_id);
    }

    if (fields.length === 0) return this.getContactById(id);

    fields.push(`updated_at = NOW()`);
    const result = await query(
      `UPDATE contacts SET ${fields.join(', ')} WHERE id = $1 RETURNING *`,
      values,
    );
    return result.rows.length > 0 ? this.rowToContact(result.rows[0]) : null;
  }

  async deleteContact(id: string): Promise<boolean> {
    const result = await query('DELETE FROM contacts WHERE id = $1', [id]);
    return (result.rowCount || 0) > 0;
  }

  async mergeContacts(sourceId: string, targetId: string, finalValues: UpdateContactInput): Promise<Contact | null> {
    const client = (await import('../db/connection.js')).getClient;
    const conn = await client();

    try {
      await conn.query('BEGIN');

      // Reassign activities
      await conn.query('UPDATE activities SET contact_id = $1 WHERE contact_id = $2', [targetId, sourceId]);
      // Reassign tasks
      await conn.query('UPDATE tasks SET contact_id = $1 WHERE contact_id = $2', [targetId, sourceId]);

      // Update target
      const fields: string[] = [];
      const values: unknown[] = [targetId];
      let idx = 2;
      for (const [key, val] of Object.entries(finalValues)) {
        if (val !== undefined) {
          fields.push(`${key} = $${idx++}`);
          values.push(key === 'custom_fields' ? JSON.stringify(val) : val);
        }
      }
      fields.push(`updated_at = NOW()`);

      if (fields.length > 0) {
        await conn.query(`UPDATE contacts SET ${fields.join(', ')} WHERE id = $1`, values);
      }

      // Delete source
      await conn.query('DELETE FROM contacts WHERE id = $1', [sourceId]);

      await conn.query('COMMIT');

      const result = await conn.query('SELECT * FROM contacts WHERE id = $1', [targetId]);
      return result.rows.length > 0 ? this.rowToContact(result.rows[0]) : null;
    } catch (err) {
      await conn.query('ROLLBACK');
      throw err;
    } finally {
      conn.release();
    }
  }

  // ─── Accounts ───────────────────────────────────────

  async listAccounts(params?: PaginationParams): Promise<Account[]> {
    let sql = `SELECT * FROM accounts`;
    const conditions: string[] = [];
    const values: unknown[] = [];
    let paramIdx = 1;

    if (params?.search) {
      conditions.push(`(name ILIKE $${paramIdx} OR domain ILIKE $${paramIdx})`);
      values.push(`%${params.search}%`);
      paramIdx++;
    }

    if (conditions.length > 0) sql += ` WHERE ` + conditions.join(' AND ');
    sql += ` ORDER BY created_at DESC`;

    if (params?.page && params?.limit) {
      sql += ` LIMIT $${paramIdx} OFFSET $${paramIdx + 1}`;
      values.push(params.limit, (params.page - 1) * params.limit);
    }

    const result = await query(sql, values);
    return result.rows.map((row: DbRow) => this.rowToAccount(row));
  }

  async getAccountById(id: string): Promise<Account | null> {
    const result = await query('SELECT * FROM accounts WHERE id = $1', [id]);
    return result.rows.length > 0 ? this.rowToAccount(result.rows[0]) : null;
  }

  async addAccount(input: CreateAccountInput): Promise<Account> {
    const result = await query(
      `INSERT INTO accounts (id, organization_id, owner_id, name, domain, industry, size, website, arr, tags, custom_fields)
       VALUES ($1, current_setting('app.organization_id'), $2, $3, $4, $5, $6, $7, $8, $9, $10)
       RETURNING *`,
      [randomUUID(), input.owner_id, input.name, input.domain || '', input.industry || '',
       input.size || '1-10', input.website || '', input.arr || 0, input.tags || [], JSON.stringify(input.custom_fields || {})],
    );
    return this.rowToAccount(result.rows[0]);
  }

  async updateAccount(id: string, input: UpdateAccountInput): Promise<Account | null> {
    const fields: string[] = [];
    const values: unknown[] = [id];
    let idx = 2;

    const stringFields: (keyof UpdateAccountInput)[] = ['name', 'domain', 'industry', 'size', 'website', 'owner_id'];
    for (const field of stringFields) {
      if (input[field] !== undefined) {
        fields.push(`${field} = $${idx++}`);
        values.push(input[field]);
      }
    }
    if (input.arr !== undefined) { fields.push(`arr = $${idx++}`); values.push(input.arr); }
    if (input.tags !== undefined) { fields.push(`tags = $${idx++}`); values.push(input.tags); }
    if (input.custom_fields !== undefined) { fields.push(`custom_fields = $${idx++}`); values.push(JSON.stringify(input.custom_fields)); }

    if (fields.length === 0) return this.getAccountById(id);
    fields.push(`updated_at = NOW()`);

    const result = await query(
      `UPDATE accounts SET ${fields.join(', ')} WHERE id = $1 RETURNING *`,
      values,
    );
    return result.rows.length > 0 ? this.rowToAccount(result.rows[0]) : null;
  }

  async deleteAccount(id: string): Promise<boolean> {
    const result = await query('DELETE FROM accounts WHERE id = $1', [id]);
    return (result.rowCount || 0) > 0;
  }

  // ─── Deals ──────────────────────────────────────────

  async listDeals(params?: { pipeline_id?: string; stage_id?: string; owner_id?: string } & PaginationParams): Promise<Deal[]> {
    let sql = `SELECT * FROM deals`;
    const conditions: string[] = [];
    const values: unknown[] = [];
    let paramIdx = 1;

    if (params?.pipeline_id) { conditions.push(`pipeline_id = $${paramIdx++}`); values.push(params.pipeline_id); }
    if (params?.stage_id) { conditions.push(`stage_id = $${paramIdx++}`); values.push(params.stage_id); }
    if (params?.owner_id) { conditions.push(`owner_id = $${paramIdx++}`); values.push(params.owner_id); }
    if (params?.search) { conditions.push(`name ILIKE $${paramIdx++}`); values.push(`%${params.search}%`); }

    if (conditions.length > 0) sql += ` WHERE ` + conditions.join(' AND ');
    sql += ` ORDER BY created_at DESC`;

    if (params?.page && params?.limit) {
      sql += ` LIMIT $${paramIdx} OFFSET $${paramIdx + 1}`;
      values.push(params.limit, (params.page - 1) * params.limit);
    }

    const result = await query(sql, values);
    return result.rows.map((row: DbRow) => this.rowToDeal(row));
  }

  async getDealById(id: string): Promise<Deal | null> {
    const result = await query('SELECT * FROM deals WHERE id = $1', [id]);
    return result.rows.length > 0 ? this.rowToDeal(result.rows[0]) : null;
  }

  async addDeal(input: CreateDealInput): Promise<Deal> {
    const result = await query(
      `INSERT INTO deals (id, organization_id, pipeline_id, stage_id, account_id, owner_id, name, value, currency, probability, close_date, custom_fields, line_items)
       VALUES ($1, current_setting('app.organization_id'), $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
       RETURNING *`,
      [randomUUID(), input.pipeline_id, input.stage_id, input.account_id, input.owner_id,
       input.name, input.value || 0, input.currency || 'USD', input.probability || null, input.close_date,
       JSON.stringify(input.custom_fields || {}), JSON.stringify(input.line_items || [])],
    );
    return this.rowToDeal(result.rows[0]);
  }

  async updateDeal(id: string, input: UpdateDealInput): Promise<Deal | null> {
    const fields: string[] = [];
    const values: unknown[] = [id];
    let idx = 2;

    const simpleFields: (keyof UpdateDealInput)[] = ['name', 'value', 'currency', 'probability', 'close_date', 'pipeline_id', 'stage_id', 'account_id', 'owner_id', 'lost_reason'];
    for (const field of simpleFields) {
      if (input[field] !== undefined) {
        fields.push(`${field} = $${idx++}`);
        values.push(input[field]);
      }
    }
    if (input.custom_fields !== undefined) { fields.push(`custom_fields = $${idx++}`); values.push(JSON.stringify(input.custom_fields)); }
    if (input.line_items !== undefined) { fields.push(`line_items = $${idx++}`); values.push(JSON.stringify(input.line_items)); }

    if (fields.length === 0) return this.getDealById(id);
    fields.push(`updated_at = NOW()`);

    const result = await query(
      `UPDATE deals SET ${fields.join(', ')} WHERE id = $1 RETURNING *`,
      values,
    );
    return result.rows.length > 0 ? this.rowToDeal(result.rows[0]) : null;
  }

  async deleteDeal(id: string): Promise<boolean> {
    const result = await query('DELETE FROM deals WHERE id = $1', [id]);
    return (result.rowCount || 0) > 0;
  }

  async moveDealStage(id: string, targetStageId: string): Promise<Deal | null> {
    const stageResult = await query('SELECT * FROM stages WHERE id = $1', [targetStageId]);
    if (stageResult.rows.length === 0) return null;

    const stage = stageResult.rows[0];
    const now = new Date().toISOString();

    const updates: Record<string, unknown> = {
      stage_id: targetStageId,
      stage_entered_at: now,
    };

    if (stage.type === 'won') {
      updates.won_at = now;
      updates.probability = 100;
    } else if (stage.type === 'lost') {
      updates.lost_at = now;
      updates.probability = 0;
    } else {
      updates.probability = stage.probability;
    }

    return this.updateDeal(id, updates as UpdateDealInput);
  }

  async closeDeal(id: string, outcome: 'won' | 'lost', reason?: string): Promise<Deal | null> {
    const deal = await this.getDealById(id);
    if (!deal) return null;

    // Find the won/lost stage for the deal's pipeline
    const stageResult = await query(
      `SELECT id FROM stages WHERE pipeline_id = $1 AND type = $2`,
      [deal.pipeline_id, outcome],
    );
    if (stageResult.rows.length === 0) return null;

    const updates: UpdateDealInput = {};
    if (outcome === 'lost' && reason) {
      updates.lost_reason = reason;
    }

    const moved = await this.moveDealStage(id, stageResult.rows[0].id);
    if (!moved) return null;

    return this.getDealById(id);
  }

  // ─── Leads ──────────────────────────────────────────

  async listLeads(params?: { status?: string; owner_id?: string } & PaginationParams): Promise<Lead[]> {
    let sql = `SELECT * FROM leads`;
    const conditions: string[] = [];
    const values: unknown[] = [];
    let paramIdx = 1;

    if (params?.status) { conditions.push(`status = $${paramIdx++}`); values.push(params.status); }
    if (params?.owner_id) { conditions.push(`owner_id = $${paramIdx++}`); values.push(params.owner_id); }
    if (params?.search) { conditions.push(`(first_name ILIKE $${paramIdx++} OR last_name ILIKE $${paramIdx++} OR company_name ILIKE $${paramIdx++} OR email ILIKE $${paramIdx++})`); values.push(`%${params.search}%`, `%${params.search}%`, `%${params.search}%`, `%${params.search}%`); }

    if (conditions.length > 0) sql += ` WHERE ` + conditions.join(' AND ');
    sql += ` ORDER BY created_at DESC`;

    if (params?.page && params?.limit) {
      sql += ` LIMIT $${paramIdx} OFFSET $${paramIdx + 1}`;
      values.push(params.limit, (params.page - 1) * params.limit);
    }

    const result = await query(sql, values);
    return result.rows.map((row: DbRow) => this.rowToLead(row));
  }

  async getLeadById(id: string): Promise<Lead | null> {
    const result = await query('SELECT * FROM leads WHERE id = $1', [id]);
    return result.rows.length > 0 ? this.rowToLead(result.rows[0]) : null;
  }

  async addLead(input: CreateLeadInput): Promise<Lead> {
    const result = await query(
      `INSERT INTO leads (id, organization_id, owner_id, first_name, last_name, company_name, email, phone, source, status)
       VALUES ($1, current_setting('app.organization_id'), $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING *`,
      [randomUUID(), input.owner_id, input.first_name, input.last_name, input.company_name, input.email,
       input.phone || '', input.source || null, input.status || 'new'],
    );
    return this.rowToLead(result.rows[0]);
  }

  async updateLead(id: string, input: UpdateLeadInput): Promise<Lead | null> {
    const fields: string[] = [];
    const values: unknown[] = [id];
    let idx = 2;

    const stringFields = ['first_name', 'last_name', 'company_name', 'email', 'phone', 'source', 'status', 'owner_id'] as const;
    for (const field of stringFields) {
      if (input[field] !== undefined) {
        fields.push(`${field} = $${idx++}`);
        values.push(input[field]);
      }
    }

    if (fields.length === 0) return this.getLeadById(id);
    fields.push(`updated_at = NOW()`);

    const result = await query(
      `UPDATE leads SET ${fields.join(', ')} WHERE id = $1 RETURNING *`,
      values,
    );
    return result.rows.length > 0 ? this.rowToLead(result.rows[0]) : null;
  }

  async deleteLead(id: string): Promise<boolean> {
    const result = await query('DELETE FROM leads WHERE id = $1', [id]);
    return (result.rowCount || 0) > 0;
  }

  async convertLead(id: string, input: ConvertLeadInput, converterUserId: string): Promise<LeadConversionResult | null> {
    const client = (await import('../db/connection.js')).getClient;
    const conn = await client();

    try {
      await conn.query('BEGIN');

      const leadResult = await conn.query('SELECT * FROM leads WHERE id = $1', [id]);
      if (leadResult.rows.length === 0) { await conn.query('ROLLBACK'); return null; }
      const leadRow = leadResult.rows[0];
      if (leadRow.is_converted || leadRow.status === 'converted' || leadRow.status !== 'qualified') { await conn.query('ROLLBACK'); return null; }

      let accountId = input.account_id;
      if (!accountId) {
        const accountName = input.account?.name || leadRow.company_name;
        if (!accountName) { await conn.query('ROLLBACK'); return null; }
        const orgId = leadRow.organization_id;
        const accountResult = await conn.query(
          `SELECT id FROM accounts WHERE organization_id = $1 AND name ILIKE $2 LIMIT 1`,
          [orgId, accountName],
        );
        if (accountResult.rows.length > 0) {
          accountId = accountResult.rows[0].id;
        } else {
          const created = await conn.query(
            `INSERT INTO accounts (id, organization_id, owner_id, name, domain, industry, size, website, arr, tags, custom_fields)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
             RETURNING *`,
            [randomUUID(), orgId, input.account?.owner_id || leadRow.owner_id, accountName,
             input.account?.domain || '', input.account?.industry || '', input.account?.size || '1-10',
             input.account?.website || '', input.account?.arr || 0, input.account?.tags || [], JSON.stringify(input.account?.custom_fields || {})],
          );
          accountId = created.rows[0].id;
        }
      }

      const firstName = input.contact?.first_name || leadRow.first_name || 'Lead';
      const lastName = input.contact?.last_name || leadRow.last_name || '';
      const contactResult = await conn.query(
        `INSERT INTO contacts (id, organization_id, account_id, owner_id, first_name, last_name, email, phone, title, linkedin_url, tags, custom_fields, unsubscribed)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
         RETURNING *`,
        [randomUUID(), leadRow.organization_id, accountId, leadRow.owner_id,
         firstName || 'Unknown', lastName || '', input.contact?.email || leadRow.email,
         input.contact?.phone || leadRow.phone || '', input.contact?.title || '', '',
         input.contact?.tags || [], '{}', false],
      );
      const contactId = contactResult.rows[0].id;

      // Step 3 (optional): create "[Company] - Default Opportunity" on the account
      let opportunityId: string | null = null;
      if (input.create_opportunity) {
        const pipelineResult = await conn.query(
          `SELECT id FROM pipelines WHERE organization_id = $1 AND is_default = true ORDER BY created_at LIMIT 1`,
          [leadRow.organization_id],
        );
        if (pipelineResult.rows.length > 0) {
          const pipelineId = pipelineResult.rows[0].id;
          const stageResult = await conn.query(
            `SELECT id, probability FROM stages WHERE pipeline_id = $1 AND type = 'open' ORDER BY stage_order ASC LIMIT 1`,
            [pipelineId],
          );
          if (stageResult.rows.length > 0) {
            const accountNameResult = await conn.query(`SELECT name FROM accounts WHERE id = $1`, [accountId]);
            const accountName = accountNameResult.rows[0]?.name || leadRow.company_name;
            const closeDate = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
            const dealResult = await conn.query(
              `INSERT INTO deals (id, organization_id, pipeline_id, stage_id, account_id, owner_id, name, value, currency, probability, close_date, custom_fields, line_items)
               VALUES ($1, $2, $3, $4, $5, $6, $7, 0, 'USD', $8, $9, '{}', '[]')
               RETURNING id`,
              [randomUUID(), leadRow.organization_id, pipelineId, stageResult.rows[0].id, accountId, leadRow.owner_id,
               `${accountName} - Default Opportunity`, stageResult.rows[0].probability ?? null, closeDate],
            );
            opportunityId = dealResult.rows[0].id;
          }
        }
      }

      // Step 4: archive the lead — flag it, never delete it
      const now = new Date().toISOString();
      await conn.query(
        `UPDATE leads SET status = 'converted', is_converted = true, converted_account_id = $2, converted_contact_id = $3, converted_at = $4, updated_at = $5 WHERE id = $1`,
        [id, accountId, contactId, now, now],
      );

      await conn.query(
        `INSERT INTO activities (id, organization_id, user_id, contact_id, lead_id, type, title, body, metadata)
         VALUES ($1, $2, $3, $4, $5, 'lead_converted', $6, $7, $8)`,
        [randomUUID(), leadRow.organization_id, converterUserId, contactId, id,
         `Lead converted to contact and account`, '', JSON.stringify({ account_id: accountId, contact_id: contactId })],
      );

      await conn.query('COMMIT');

      const updatedLead = await this.getLeadById(id);
      const account = await this.getAccountById(accountId);
      const contact = await this.getContactById(contactId);
      const opportunity = opportunityId ? await this.getDealById(opportunityId) : undefined;
      if (!updatedLead) return null;
      return {
        lead: updatedLead,
        account: account || undefined,
        contact: contact || undefined,
        opportunity: opportunity || undefined,
      };
    } catch (err) {
      await conn.query('ROLLBACK');
      throw err;
    } finally {
      conn.release();
    }
  }

  // ─── Tasks ──────────────────────────────────────────

  async listTasks(params?: { assigned_to_id?: string; status?: 'open' | 'completed' | 'all' } & PaginationParams): Promise<Task[]> {
    let sql = `SELECT * FROM tasks`;
    const conditions: string[] = [];
    const values: unknown[] = [];
    let paramIdx = 1;

    if (params?.assigned_to_id) { conditions.push(`assigned_to_id = $${paramIdx++}`); values.push(params.assigned_to_id); }
    if (params?.status === 'open') conditions.push('completed_at IS NULL');
    else if (params?.status === 'completed') conditions.push('completed_at IS NOT NULL');
    if (params?.search) { conditions.push(`title ILIKE $${paramIdx++}`); values.push(`%${params.search}%`); }

    if (conditions.length > 0) sql += ` WHERE ` + conditions.join(' AND ');
    sql += ` ORDER BY priority DESC, due_at ASC`;

    if (params?.page && params?.limit) {
      sql += ` LIMIT $${paramIdx} OFFSET $${paramIdx + 1}`;
      values.push(params.limit, (params.page - 1) * params.limit);
    }

    const result = await query(sql, values);
    return result.rows.map((row: DbRow) => this.rowToTask(row));
  }

  async getTaskById(id: string): Promise<Task | null> {
    const result = await query('SELECT * FROM tasks WHERE id = $1', [id]);
    return result.rows.length > 0 ? this.rowToTask(result.rows[0]) : null;
  }

  async addTask(input: CreateTaskInput): Promise<Task> {
    const result = await query(
      `INSERT INTO tasks (id, organization_id, assigned_to_id, created_by_id, contact_id, deal_id, lead_id, title, type, priority, due_at, recurrence_rule)
       VALUES ($1, current_setting('app.organization_id'), $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
       RETURNING *`,
      [randomUUID(), input.assigned_to_id, input.created_by_id, input.contact_id || null,
       input.deal_id || null, input.lead_id || null, input.title, input.type, input.priority || 'medium',
       input.due_at, input.recurrence_rule || null],
    );
    return this.rowToTask(result.rows[0]);
  }

  async updateTask(id: string, input: UpdateTaskInput): Promise<Task | null> {
    const fields: string[] = [];
    const values: unknown[] = [id];
    let idx = 2;

    const stringFields: (keyof UpdateTaskInput)[] = ['title', 'type', 'priority', 'due_at', 'assigned_to_id', 'contact_id', 'deal_id', 'lead_id', 'recurrence_rule'];
    for (const field of stringFields) {
      if (input[field] !== undefined) {
        fields.push(`${field} = $${idx++}`);
        values.push(input[field]);
      }
    }
    if (input.completed_at !== undefined) { fields.push(`completed_at = $${idx++}`); values.push(input.completed_at); }
    if (fields.length === 0) return this.getTaskById(id);
    fields.push(`updated_at = NOW()`);

    const result = await query(
      `UPDATE tasks SET ${fields.join(', ')} WHERE id = $1 RETURNING *`,
      values,
    );
    return result.rows.length > 0 ? this.rowToTask(result.rows[0]) : null;
  }

  async completeTask(id: string): Promise<Task | null> {
    const result = await query(
      `UPDATE tasks SET completed_at = NOW(), updated_at = NOW() WHERE id = $1 RETURNING *`,
      [id],
    );
    return result.rows.length > 0 ? this.rowToTask(result.rows[0]) : null;
  }

  async deleteTask(id: string): Promise<boolean> {
    const result = await query('DELETE FROM tasks WHERE id = $1', [id]);
    return (result.rowCount || 0) > 0;
  }

  // ─── Activities ─────────────────────────────────────

  async listActivities(params?: { contact_id?: string; deal_id?: string; lead_id?: string; user_id?: string } & PaginationParams): Promise<Activity[]> {
    let sql = `SELECT * FROM activities`;
    const conditions: string[] = [];
    const values: unknown[] = [];
    let paramIdx = 1;

    if (params?.contact_id) { conditions.push(`contact_id = $${paramIdx++}`); values.push(params.contact_id); }
    if (params?.deal_id) { conditions.push(`deal_id = $${paramIdx++}`); values.push(params.deal_id); }
    if (params?.lead_id) { conditions.push(`lead_id = $${paramIdx++}`); values.push(params.lead_id); }
    if (params?.user_id) { conditions.push(`user_id = $${paramIdx++}`); values.push(params.user_id); }

    if (conditions.length > 0) sql += ` WHERE ` + conditions.join(' AND ');
    sql += ` ORDER BY created_at DESC`;

    if (params?.page && params?.limit) {
      sql += ` LIMIT $${paramIdx} OFFSET $${paramIdx + 1}`;
      values.push(params.limit, (params.page - 1) * params.limit);
    }

    const result = await query(sql, values);
    return result.rows.map((row: DbRow) => this.rowToActivity(row));
  }

  async addActivity(input: CreateActivityInput): Promise<Activity> {
    const result = await query(
      `INSERT INTO activities (id, organization_id, user_id, contact_id, deal_id, lead_id, task_id, type, title, body, outcome, duration_seconds, metadata)
       VALUES ($1, current_setting('app.organization_id'), $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
       RETURNING *`,
      [randomUUID(), input.user_id, input.contact_id || null, input.deal_id || null,
       input.lead_id || null, input.task_id || null, input.type, input.title, input.body || '',
       input.outcome || null, input.duration_seconds || null, JSON.stringify(input.metadata || {})],
    );
    return this.rowToActivity(result.rows[0]);
  }

  // ─── Record Tasks (timeline sub-system) ─────────────

  async listRecordTasks(params?: { associated_to_id?: string } & PaginationParams): Promise<RecordTask[]> {
    let sql = `SELECT * FROM record_tasks`;
    const conditions: string[] = [];
    const values: unknown[] = [];
    let paramIdx = 1;

    if (params?.associated_to_id) { conditions.push(`associated_to_id = $${paramIdx++}`); values.push(params.associated_to_id); }
    if (params?.search) { conditions.push(`subject ILIKE $${paramIdx++}`); values.push(`%${params.search}%`); }

    if (conditions.length > 0) sql += ` WHERE ` + conditions.join(' AND ');
    sql += ` ORDER BY created_at DESC`;

    if (params?.page && params?.limit) {
      sql += ` LIMIT $${paramIdx} OFFSET $${paramIdx + 1}`;
      values.push(params.limit, (params.page - 1) * params.limit);
    }

    const result = await query(sql, values);
    return result.rows.map((row: DbRow) => this.rowToRecordTask(row));
  }

  async getRecordTaskById(id: string): Promise<RecordTask | null> {
    const result = await query('SELECT * FROM record_tasks WHERE id = $1', [id]);
    return result.rows.length > 0 ? this.rowToRecordTask(result.rows[0]) : null;
  }

  async addRecordTask(input: CreateRecordTaskInput): Promise<RecordTask> {
    const result = await query(
      `INSERT INTO record_tasks (id, organization_id, user_id, subject, description, due_date, associated_to_id)
       VALUES ($1, current_setting('app.organization_id'), $2, $3, $4, $5, $6)
       RETURNING *`,
      [randomUUID(), input.user_id, input.subject, input.description || '', input.due_date || null, input.associated_to_id],
    );
    return this.rowToRecordTask(result.rows[0]);
  }

  async updateRecordTask(id: string, input: UpdateRecordTaskInput): Promise<RecordTask | null> {
    const fields: string[] = [];
    const values: unknown[] = [id];
    let idx = 2;

    if (input.subject !== undefined) { fields.push(`subject = $${idx++}`); values.push(input.subject); }
    if (input.description !== undefined) { fields.push(`description = $${idx++}`); values.push(input.description); }
    if (input.due_date !== undefined) { fields.push(`due_date = $${idx++}`); values.push(input.due_date); }
    if (input.completed_at !== undefined) { fields.push(`completed_at = $${idx++}`); values.push(input.completed_at); }
    if (fields.length === 0) return this.getRecordTaskById(id);
    fields.push(`updated_at = NOW()`);

    const result = await query(
      `UPDATE record_tasks SET ${fields.join(', ')} WHERE id = $1 RETURNING *`,
      values,
    );
    return result.rows.length > 0 ? this.rowToRecordTask(result.rows[0]) : null;
  }

  async deleteRecordTask(id: string): Promise<boolean> {
    const result = await query('DELETE FROM record_tasks WHERE id = $1', [id]);
    return (result.rowCount || 0) > 0;
  }

  // ─── Call Logs (timeline sub-system) ────────────────

  async listCallLogs(params?: { associated_to_id?: string } & PaginationParams): Promise<CallLog[]> {
    let sql = `SELECT * FROM call_logs`;
    const conditions: string[] = [];
    const values: unknown[] = [];
    let paramIdx = 1;

    if (params?.associated_to_id) { conditions.push(`associated_to_id = $${paramIdx++}`); values.push(params.associated_to_id); }
    if (params?.search) { conditions.push(`(subject ILIKE $${paramIdx++} OR description ILIKE $${paramIdx++})`); const q = `%${params.search}%`; values.push(q, q); }

    if (conditions.length > 0) sql += ` WHERE ` + conditions.join(' AND ');
    sql += ` ORDER BY created_at DESC`;

    if (params?.page && params?.limit) {
      sql += ` LIMIT $${paramIdx} OFFSET $${paramIdx + 1}`;
      values.push(params.limit, (params.page - 1) * params.limit);
    }

    const result = await query(sql, values);
    return result.rows.map((row: DbRow) => this.rowToCallLog(row));
  }

  async getCallLogById(id: string): Promise<CallLog | null> {
    const result = await query('SELECT * FROM call_logs WHERE id = $1', [id]);
    return result.rows.length > 0 ? this.rowToCallLog(result.rows[0]) : null;
  }

  async addCallLog(input: CreateCallLogInput): Promise<CallLog> {
    const result = await query(
      `INSERT INTO call_logs (id, organization_id, user_id, subject, description, due_date, associated_to_id)
       VALUES ($1, current_setting('app.organization_id'), $2, $3, $4, $5, $6)
       RETURNING *`,
      [randomUUID(), input.user_id, input.subject, input.description || '', input.due_date || null, input.associated_to_id],
    );
    return this.rowToCallLog(result.rows[0]);
  }

  // ─── Notifications ──────────────────────────────────

  async listNotifications(userId: string): Promise<Notification[]> {
    const result = await query(
      `SELECT * FROM notifications WHERE user_id = $1 ORDER BY created_at DESC`,
      [userId],
    );
    return result.rows.map((row: DbRow) => this.rowToNotification(row));
  }

  async markNotificationRead(id: string): Promise<Notification | null> {
    const result = await query(
      `UPDATE notifications SET read_at = NOW() WHERE id = $1 RETURNING *`,
      [id],
    );
    return result.rows.length > 0 ? this.rowToNotification(result.rows[0]) : null;
  }

  async getNotificationById(id: string): Promise<Notification | null> {
    const result = await query(`SELECT * FROM notifications WHERE id = $1`, [id]);
    return result.rows.length > 0 ? this.rowToNotification(result.rows[0]) : null;
  }

  async markAllNotificationsRead(userId: string): Promise<void> {
    await query(
      `UPDATE notifications SET read_at = NOW() WHERE user_id = $1 AND read_at IS NULL`,
      [userId],
    );
  }

  // ─── Email Templates ────────────────────────────────

  async listEmailTemplates(): Promise<EmailTemplate[]> {
    const result = await query(`SELECT * FROM email_templates ORDER BY created_at DESC`);
    return result.rows.map((row: DbRow) => this.rowToEmailTemplate(row));
  }

  async getEmailTemplateById(id: string): Promise<EmailTemplate | null> {
    const result = await query(`SELECT * FROM email_templates WHERE id = $1`, [id]);
    return result.rows.length > 0 ? this.rowToEmailTemplate(result.rows[0]) : null;
  }

  async addEmailTemplate(input: CreateEmailTemplateInput): Promise<EmailTemplate> {
    const result = await query(
      `INSERT INTO email_templates (id, organization_id, created_by_id, name, subject, body_html, variables, is_shared, category)
       VALUES ($1, current_setting('app.organization_id'), $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [randomUUID(), input.created_by_id, input.name, input.subject, input.body_html,
       input.variables || [], input.is_shared || false, input.category || null],
    );
    return this.rowToEmailTemplate(result.rows[0]);
  }

  // ─── Email Campaigns ────────────────────────────────

  async listEmailCampaigns(): Promise<EmailCampaign[]> {
    const result = await query(`SELECT * FROM email_campaigns ORDER BY created_at DESC`);
    return result.rows.map((row: DbRow) => this.rowToEmailCampaign(row));
  }

  async createEmailCampaign(input: CreateEmailCampaignInput): Promise<EmailCampaign> {
    const result = await query(
      `INSERT INTO email_campaigns (id, organization_id, template_id, created_by_id, name, status, scheduled_at, sent_at, total_recipients, delivered_count, opened_count, clicked_count, bounced_count, unsubscribed_count)
       VALUES ($1, current_setting('app.organization_id'), $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
       RETURNING *`,
      [input.id || randomUUID(), input.template_id, input.created_by_id, input.name, input.status || 'draft',
       input.scheduled_at || null, input.sent_at || null, input.total_recipients || 0,
       input.delivered_count || 0, input.opened_count || 0, input.clicked_count || 0,
       input.bounced_count || 0, input.unsubscribed_count || 0],
    );
    return this.rowToEmailCampaign(result.rows[0]);
  }

  // ─── Custom Fields ──────────────────────────────────

  async listCustomFieldDefinitions(): Promise<CustomFieldDefinition[]> {
    const result = await query(`SELECT * FROM custom_field_definitions ORDER BY display_order`);
    return result.rows.map((row: DbRow) => this.rowToCustomField(row));
  }

  async addCustomFieldDefinition(input: CreateCustomFieldInput): Promise<CustomFieldDefinition> {
    const result = await query(
      `INSERT INTO custom_field_definitions (id, organization_id, entity_type, key, label, field_type, options, is_required, is_visible, display_order)
       VALUES ($1, current_setting('app.organization_id'), $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING *`,
      [randomUUID(), input.entity_type, input.key, input.label, input.field_type,
       input.options ? JSON.stringify(input.options) : null, input.is_required || false,
       input.is_visible !== false, input.order || 0],
    );
    return this.rowToCustomField(result.rows[0]);
  }

  async deleteCustomFieldDefinition(id: string): Promise<boolean> {
    const result = await query('DELETE FROM custom_field_definitions WHERE id = $1', [id]);
    return (result.rowCount || 0) > 0;
  }

  // ─── Pipelines & Stages ─────────────────────────────

  async listPipelines(): Promise<Pipeline[]> {
    const result = await query(`SELECT * FROM pipelines ORDER BY created_at`);
    return result.rows.map((row: DbRow) => ({
      id: row.id,
      name: row.name,
      is_default: row.is_default,
      is_archived: row.is_archived,
    }));
  }

  async listStages(): Promise<Stage[]> {
    const result = await query(`SELECT * FROM stages ORDER BY stage_order`);
    return result.rows.map((row: DbRow) => ({
      id: row.id,
      pipeline_id: row.pipeline_id,
      name: row.name,
      probability: row.probability,
      order: row.stage_order,
      type: row.type,
    }));
  }

  async addPipeline(input: { name: string; is_default: boolean }): Promise<Pipeline> {
    const result = await query(
      `INSERT INTO pipelines (id, organization_id, name, is_default, is_archived)
       VALUES ($1, current_setting('app.organization_id'), $2, $3, false)
       RETURNING id, name, is_default, is_archived`,
      [randomUUID(), input.name, input.is_default],
    );
    return {
      id: result.rows[0].id,
      name: result.rows[0].name,
      is_default: result.rows[0].is_default,
      is_archived: result.rows[0].is_archived,
    };
  }

  async addStage(input: { pipeline_id: string; name: string; probability: number; order: number; type: 'open' | 'won' | 'lost' }): Promise<Stage> {
    const result = await query(
      `INSERT INTO stages (id, organization_id, pipeline_id, name, probability, stage_order, type)
       VALUES ($1, current_setting('app.organization_id'), $2, $3, $4, $5, $6)
       RETURNING id, pipeline_id, name, probability, stage_order, type`,
      [randomUUID(), input.pipeline_id, input.name, input.probability, input.order, input.type],
    );
    return {
      id: result.rows[0].id,
      pipeline_id: result.rows[0].pipeline_id,
      name: result.rows[0].name,
      probability: result.rows[0].probability,
      order: result.rows[0].stage_order,
      type: result.rows[0].type,
    };
  }

  async updatePipeline(id: string, input: { name?: string; is_default?: boolean; is_archived?: boolean }): Promise<Pipeline | null> {
    if (input.is_default) {
      await query(`UPDATE pipelines SET is_default = false WHERE id != $1`, [id]);
    }
    const fields: string[] = [];
    const values: unknown[] = [id];
    let idx = 2;
    if (input.name !== undefined) { fields.push(`name = $${idx++}`); values.push(input.name); }
    if (input.is_default !== undefined) { fields.push(`is_default = $${idx++}`); values.push(input.is_default); }
    if (input.is_archived !== undefined) { fields.push(`is_archived = $${idx++}`); values.push(input.is_archived); }
    if (fields.length === 0) {
      const r = await query('SELECT * FROM pipelines WHERE id = $1', [id]);
      return r.rows.length > 0 ? { id: r.rows[0].id, name: r.rows[0].name, is_default: r.rows[0].is_default, is_archived: r.rows[0].is_archived } : null;
    }
    const result = await query(
      `UPDATE pipelines SET ${fields.join(', ')} WHERE id = $1 RETURNING id, name, is_default, is_archived`,
      values,
    );
    if (result.rows.length === 0) return null;
    return { id: result.rows[0].id, name: result.rows[0].name, is_default: result.rows[0].is_default, is_archived: result.rows[0].is_archived };
  }

  async deletePipeline(id: string): Promise<boolean> {
    await query('DELETE FROM stages WHERE pipeline_id = $1', [id]);
    const result = await query('DELETE FROM pipelines WHERE id = $1', [id]);
    return (result.rowCount || 0) > 0;
  }

  async updateStage(id: string, input: { name?: string; probability?: number; order?: number; type?: 'open' | 'won' | 'lost' }): Promise<Stage | null> {
    const fields: string[] = [];
    const values: unknown[] = [id];
    let idx = 2;
    if (input.name !== undefined) { fields.push(`name = $${idx++}`); values.push(input.name); }
    if (input.probability !== undefined) { fields.push(`probability = $${idx++}`); values.push(input.probability); }
    if (input.order !== undefined) { fields.push(`stage_order = $${idx++}`); values.push(input.order); }
    if (input.type !== undefined) { fields.push(`type = $${idx++}`); values.push(input.type); }
    if (fields.length === 0) {
      const r = await query('SELECT * FROM stages WHERE id = $1', [id]);
      return r.rows.length > 0 ? { id: r.rows[0].id, pipeline_id: r.rows[0].pipeline_id, name: r.rows[0].name, probability: r.rows[0].probability, order: r.rows[0].stage_order, type: r.rows[0].type } : null;
    }
    const result = await query(
      `UPDATE stages SET ${fields.join(', ')} WHERE id = $1 RETURNING id, pipeline_id, name, probability, stage_order, type`,
      values,
    );
    if (result.rows.length === 0) return null;
    return { id: result.rows[0].id, pipeline_id: result.rows[0].pipeline_id, name: result.rows[0].name, probability: result.rows[0].probability, order: result.rows[0].stage_order, type: result.rows[0].type };
  }

  async deleteStage(id: string): Promise<boolean> {
    const result = await query('DELETE FROM stages WHERE id = $1', [id]);
    return (result.rowCount || 0) > 0;
  }

  // ─── Files ──────────────────────────────────────────

  async addFile(input: CreateFileInput): Promise<FileRecord> {
    const result = await query(
      `INSERT INTO files (id, organization_id, user_id, entity_type, entity_id, filename, original_name, mime_type, size_bytes, storage_provider, storage_path)
       VALUES ($1, current_setting('app.organization_id'), $2, $3, $4, $5, $6, $7, $8, $9, $10)
       RETURNING *`,
      [randomUUID(), input.user_id, input.entity_type, input.entity_id,
       input.filename, input.original_name, input.mime_type, input.size_bytes,
       input.storage_provider, input.storage_path],
    );
    return this.rowToFile(result.rows[0]);
  }

  async getFileById(id: string): Promise<FileRecord | null> {
    const result = await query('SELECT * FROM files WHERE id = $1', [id]);
    return result.rows.length > 0 ? this.rowToFile(result.rows[0]) : null;
  }

  async listFiles(params?: { entity_type?: string; entity_id?: string; page?: number; limit?: number }): Promise<FileRecord[]> {
    let sql = `SELECT * FROM files`;
    const conditions: string[] = [];
    const values: unknown[] = [];
    let paramIdx = 1;

    if (params?.entity_type) { conditions.push(`entity_type = $${paramIdx++}`); values.push(params.entity_type); }
    if (params?.entity_id) { conditions.push(`entity_id = $${paramIdx++}`); values.push(params.entity_id); }

    if (conditions.length > 0) sql += ` WHERE ` + conditions.join(' AND ');
    sql += ` ORDER BY created_at DESC`;

    if (params?.page && params?.limit) {
      sql += ` LIMIT $${paramIdx} OFFSET $${paramIdx + 1}`;
      values.push(params.limit, (params.page - 1) * params.limit);
    }

    const result = await query(sql, values);
    return result.rows.map((row: DbRow) => this.rowToFile(row));
  }

  async deleteFile(id: string): Promise<boolean> {
    const result = await query('DELETE FROM files WHERE id = $1', [id]);
    return (result.rowCount || 0) > 0;
  }

  // ─── Audit Logs ─────────────────────────────────────

  async listAuditLogs(params?: PaginationParams): Promise<AuditLog[]> {
    let sql = `SELECT * FROM audit_logs`;
    const conditions: string[] = [];
    const values: unknown[] = [];
    let paramIdx = 1;

    if (params?.search) {
      conditions.push(`(action ILIKE $${paramIdx} OR user_name ILIKE $${paramIdx} OR entity_type ILIKE $${paramIdx})`);
      values.push(`%${params.search}%`);
      paramIdx++;
    }

    if (conditions.length > 0) sql += ` WHERE ` + conditions.join(' AND ');
    sql += ` ORDER BY created_at DESC`;

    if (params?.page && params?.limit) {
      sql += ` LIMIT $${paramIdx} OFFSET $${paramIdx + 1}`;
      values.push(params.limit, (params.page - 1) * params.limit);
    }

    const result = await query(sql, values);
    return result.rows.map((row: DbRow) => this.rowToAuditLog(row));
  }

  async addAuditLog(input: CreateAuditLogInput): Promise<AuditLog> {
    const result = await query(
      `INSERT INTO audit_logs (id, organization_id, user_id, user_name, action, entity_type, entity_id, diff, ip_address, user_agent)
       VALUES ($1, current_setting('app.organization_id'), $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING *`,
      [randomUUID(), input.user_id, input.user_name, input.action, input.entity_type,
       input.entity_id || null, input.diff ? JSON.stringify(input.diff) : null,
       input.ip_address || '', input.user_agent || ''],
    );
    return this.rowToAuditLog(result.rows[0]);
  }

  // ─── Bulk ops ───────────────────────────────────────

  async bulkUpdateContacts(ids: string[], patch: UpdateContactInput): Promise<Contact[]> {
    const updated: Contact[] = [];
    for (const id of ids) {
      const c = await this.updateContact(id, patch);
      if (c) updated.push(c);
    }
    return updated;
  }

  async bulkUpdateDeals(ids: string[], patch: UpdateDealInput): Promise<Deal[]> {
    const updated: Deal[] = [];
    for (const id of ids) {
      const d = await this.updateDeal(id, patch);
      if (d) updated.push(d);
    }
    return updated;
  }

  // ─── API keys ───────────────────────────────────────

  async listApiKeys(): Promise<ApiKey[]> {
    const result = await query(
      `SELECT id, organization_id, name, key_prefix, scopes, created_by_id, last_used_at, expires_at, revoked_at, created_at
       FROM api_keys WHERE revoked_at IS NULL ORDER BY created_at DESC`,
    );
    return result.rows.map((row: DbRow) => this.rowToApiKey(row));
  }

  async createApiKey(input: { name: string; scopes: string[]; created_by_id: string; expires_at?: string | null }): Promise<ApiKey> {
    const raw = `bnt_${randomBytes(24).toString('base64url')}`;
    const prefix = raw.slice(0, 12);
    const hash = createHash('sha256').update(raw).digest('hex');
    const scopes = input.scopes.length ? input.scopes : ['read', 'write'];
    const result = await query(
      `INSERT INTO api_keys (id, organization_id, name, key_prefix, key_hash, scopes, created_by_id, expires_at)
       VALUES ($1, current_setting('app.organization_id'), $2, $3, $4, $5, $6, $7)
       RETURNING id, organization_id, name, key_prefix, scopes, created_by_id, last_used_at, expires_at, revoked_at, created_at`,
      [randomUUID(), input.name, prefix, hash, scopes, input.created_by_id, input.expires_at ?? null],
    );
    return { ...this.rowToApiKey(result.rows[0]), raw_key: raw };
  }

  async revokeApiKey(id: string): Promise<ApiKey | null> {
    const result = await query(
      `UPDATE api_keys SET revoked_at = NOW() WHERE id = $1 AND revoked_at IS NULL
       RETURNING id, organization_id, name, key_prefix, scopes, created_by_id, last_used_at, expires_at, revoked_at, created_at`,
      [id],
    );
    return result.rows.length > 0 ? this.rowToApiKey(result.rows[0]) : null;
  }

  async verifyApiKey(rawKey: string): Promise<{ organization_id: string; scopes: string[]; key_id: string } | null> {
    const hash = createHash('sha256').update(rawKey).digest('hex');
    const result = await query(
      `SELECT id, organization_id, scopes FROM api_keys
       WHERE key_hash = $1 AND revoked_at IS NULL AND (expires_at IS NULL OR expires_at > NOW())`,
      [hash],
    );
    if (result.rows.length === 0) return null;
    const row = result.rows[0];
    await query('UPDATE api_keys SET last_used_at = NOW() WHERE id = $1', [row.id]);
    return { organization_id: row.organization_id, scopes: row.scopes || [], key_id: row.id };
  }

  // ─── Webhooks ───────────────────────────────────────

  async listWebhooks(): Promise<Webhook[]> {
    const result = await query('SELECT * FROM webhooks ORDER BY created_at DESC');
    return result.rows.map((row: DbRow) => this.rowToWebhook(row));
  }

  async createWebhook(input: { name: string; url: string; events: string[]; created_by_id: string }): Promise<Webhook> {
    const secret = `whsec_${randomBytes(16).toString('hex')}`;
    const result = await query(
      `INSERT INTO webhooks (id, organization_id, name, url, secret, events, status, created_by_id)
       VALUES ($1, current_setting('app.organization_id'), $2, $3, $4, $5, 'active', $6)
       RETURNING *`,
      [randomUUID(), input.name, input.url, secret, input.events, input.created_by_id],
    );
    return this.rowToWebhook(result.rows[0]);
  }

  async updateWebhook(id: string, input: Partial<Pick<Webhook, 'name' | 'url' | 'events' | 'status'>>): Promise<Webhook | null> {
    const fields: string[] = [];
    const values: unknown[] = [id];
    let idx = 2;
    if (input.name !== undefined) { fields.push(`name = $${idx++}`); values.push(input.name); }
    if (input.url !== undefined) { fields.push(`url = $${idx++}`); values.push(input.url); }
    if (input.events !== undefined) { fields.push(`events = $${idx++}`); values.push(input.events); }
    if (input.status !== undefined) { fields.push(`status = $${idx++}`); values.push(input.status); }

    if (fields.length === 0) {
      const r = await query('SELECT * FROM webhooks WHERE id = $1', [id]);
      return r.rows.length > 0 ? this.rowToWebhook(r.rows[0]) : null;
    }
    fields.push(`updated_at = NOW()`);
    const result = await query(
      `UPDATE webhooks SET ${fields.join(', ')} WHERE id = $1 RETURNING *`,
      values,
    );
    return result.rows.length > 0 ? this.rowToWebhook(result.rows[0]) : null;
  }

  async deleteWebhook(id: string): Promise<boolean> {
    const result = await query('DELETE FROM webhooks WHERE id = $1', [id]);
    return (result.rowCount || 0) > 0;
  }

  async listWebhookDeliveries(webhookId: string, limit = 50): Promise<WebhookDelivery[]> {
    const result = await query(
      'SELECT * FROM webhook_deliveries WHERE webhook_id = $1 ORDER BY created_at DESC LIMIT $2',
      [webhookId, limit],
    );
    return result.rows.map((row: DbRow) => this.rowToWebhookDelivery(row));
  }

  async dispatchWebhookEvent(event: string, payload: Record<string, unknown>): Promise<void> {
    const targets = await query(
      `SELECT * FROM webhooks WHERE status = 'active' AND $1 = ANY(events)`,
      [event],
    );
    for (const row of targets.rows) {
      const wh = this.rowToWebhook(row);
      // No outbound HTTP worker yet — record as queued so deliveries are visible in the admin UI.
      await query(
        `INSERT INTO webhook_deliveries (id, organization_id, webhook_id, event, payload, response_status, response_body, success, attempt)
         VALUES ($1, $2, $3, $4, $5, 200, 'queued', true, 1)`,
        [randomUUID(), wh.organization_id, wh.id, event, JSON.stringify(payload)],
      );
      await query('UPDATE webhooks SET last_triggered_at = NOW() WHERE id = $1', [wh.id]);
    }
  }

  // ─── Quotas ─────────────────────────────────────────

  async listQuotas(): Promise<Quota[]> {
    const result = await query('SELECT * FROM quotas ORDER BY fiscal_year DESC, fiscal_period DESC');
    return result.rows.map((row: DbRow) => this.rowToQuota(row));
  }

  async upsertQuota(input: Omit<Quota, 'id' | 'created_at' | 'updated_at'> & { id?: string }): Promise<Quota> {
    if (input.id) {
      const result = await query(
        `UPDATE quotas SET user_id = $2, team_id = $3, period = $4, amount = $5, currency = $6,
                fiscal_year = $7, fiscal_period = $8, updated_at = NOW()
         WHERE id = $1 RETURNING *`,
        [input.id, input.user_id ?? null, input.team_id ?? null, input.period, input.amount,
         input.currency || 'USD', input.fiscal_year, input.fiscal_period],
      );
      if (result.rows.length > 0) return this.rowToQuota(result.rows[0]);
    }
    const result = await query(
      `INSERT INTO quotas (id, organization_id, user_id, team_id, period, amount, currency, fiscal_year, fiscal_period)
       VALUES ($1, current_setting('app.organization_id'), $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [input.id || randomUUID(), input.user_id ?? null, input.team_id ?? null, input.period,
       input.amount, input.currency || 'USD', input.fiscal_year, input.fiscal_period],
    );
    return this.rowToQuota(result.rows[0]);
  }

  async deleteQuota(id: string): Promise<boolean> {
    const result = await query('DELETE FROM quotas WHERE id = $1', [id]);
    return (result.rowCount || 0) > 0;
  }

  // ─── Approvals ──────────────────────────────────────

  async listApprovals(params?: { status?: string }): Promise<ApprovalRequest[]> {
    let sql = 'SELECT * FROM approval_requests';
    const values: unknown[] = [];
    if (params?.status) {
      sql += ' WHERE status = $1';
      values.push(params.status);
    }
    sql += ' ORDER BY created_at DESC';
    const result = await query(sql, values);
    return result.rows.map((row: DbRow) => this.rowToApproval(row));
  }

  async createApproval(input: Omit<ApprovalRequest, 'id' | 'created_at' | 'status' | 'decided_at' | 'decision_note'>): Promise<ApprovalRequest> {
    const result = await query(
      `INSERT INTO approval_requests (id, organization_id, entity_type, entity_id, requested_by_id, approver_id, status, title, reason, payload)
       VALUES ($1, current_setting('app.organization_id'), $2, $3, $4, $5, 'pending', $6, $7, $8)
       RETURNING *`,
      [randomUUID(), input.entity_type, input.entity_id, input.requested_by_id, input.approver_id ?? null,
       input.title, input.reason ?? null, JSON.stringify(input.payload || {})],
    );
    return this.rowToApproval(result.rows[0]);
  }

  async decideApproval(id: string, decision: 'approved' | 'rejected', approverId: string, note?: string): Promise<ApprovalRequest | null> {
    const result = await query(
      `UPDATE approval_requests SET status = $2, approver_id = $3, decision_note = $4, decided_at = NOW()
       WHERE id = $1 AND status = 'pending' RETURNING *`,
      [id, decision, approverId, note ?? null],
    );
    if (result.rows.length === 0) return null;
    const approval = this.rowToApproval(result.rows[0]);

    // Apply payload side-effects for deal approvals
    if (decision === 'approved' && approval.entity_type === 'deal' && approval.payload) {
      const patch = approval.payload as UpdateDealInput;
      if (Object.keys(patch).length) await this.updateDeal(approval.entity_id, patch);
    }
    if (decision === 'approved' && approval.entity_type === 'stage_change' && approval.payload?.stage_id) {
      await this.moveDealStage(approval.entity_id, String(approval.payload.stage_id));
    }
    return approval;
  }

  // ─── Security policy ────────────────────────────────

  async getSecurityPolicy(): Promise<OrgSecurityPolicy | null> {
    const result = await query(
      `SELECT * FROM org_security_policies WHERE organization_id = current_setting('app.organization_id', true)`,
    );
    return result.rows.length > 0 ? this.rowToSecurityPolicy(result.rows[0]) : null;
  }

  async upsertSecurityPolicy(input: Partial<Omit<OrgSecurityPolicy, 'organization_id' | 'updated_at'>>): Promise<OrgSecurityPolicy> {
    const existing = await this.getSecurityPolicy();
    const next = {
      ip_allowlist: input.ip_allowlist ?? existing?.ip_allowlist ?? [],
      session_idle_minutes: input.session_idle_minutes ?? existing?.session_idle_minutes ?? 480,
      max_sessions_per_user: input.max_sessions_per_user ?? existing?.max_sessions_per_user ?? 10,
      enforce_mfa: input.enforce_mfa ?? existing?.enforce_mfa ?? false,
      enforce_sso: input.enforce_sso ?? existing?.enforce_sso ?? false,
      password_min_length: input.password_min_length ?? existing?.password_min_length ?? 8,
    };
    const result = await query(
      `INSERT INTO org_security_policies (organization_id, ip_allowlist, session_idle_minutes, max_sessions_per_user, enforce_mfa, enforce_sso, password_min_length, updated_at)
       VALUES (current_setting('app.organization_id'), $1, $2, $3, $4, $5, $6, NOW())
       ON CONFLICT (organization_id) DO UPDATE SET
         ip_allowlist = $1, session_idle_minutes = $2, max_sessions_per_user = $3,
         enforce_mfa = $4, enforce_sso = $5, password_min_length = $6, updated_at = NOW()
       RETURNING *`,
      [next.ip_allowlist, next.session_idle_minutes, next.max_sessions_per_user, next.enforce_mfa, next.enforce_sso, next.password_min_length],
    );
    return this.rowToSecurityPolicy(result.rows[0]);
  }

  // ─── Field permissions ──────────────────────────────

  async listFieldPermissions(): Promise<FieldPermission[]> {
    const result = await query('SELECT * FROM field_permissions ORDER BY entity_type, field_key, role');
    return result.rows.map((row: DbRow) => this.rowToFieldPermission(row));
  }

  async upsertFieldPermission(input: Omit<FieldPermission, 'id'> & { id?: string }): Promise<FieldPermission> {
    const result = await query(
      `INSERT INTO field_permissions (id, organization_id, entity_type, field_key, role, can_read, can_write)
       VALUES ($1, current_setting('app.organization_id'), $2, $3, $4, $5, $6)
       ON CONFLICT (organization_id, entity_type, field_key, role) DO UPDATE SET
         can_read = $5, can_write = $6
       RETURNING *`,
      [input.id || randomUUID(), input.entity_type, input.field_key, input.role, input.can_read, input.can_write],
    );
    return this.rowToFieldPermission(result.rows[0]);
  }

  async deleteFieldPermission(id: string): Promise<boolean> {
    const result = await query('DELETE FROM field_permissions WHERE id = $1', [id]);
    return (result.rowCount || 0) > 0;
  }

  // ─── Snapshot ───────────────────────────────────────

  async snapshot(): Promise<CrmSnapshot> {
    const [
      users, accounts, contacts, leads, pipelines, stages, deals, tasks, activities, notifications,
      customFields, emailTemplates, emailCampaigns, auditLogs,
      apiKeys, webhooks, quotas, approvals, securityPolicy, fieldPermissions,
    ] = await Promise.all([
      this.listUsers(),
      this.listAccounts(),
      this.listContacts(),
      this.listLeads(),
      this.listPipelines(),
      this.listStages(),
      this.listDeals(),
      this.listTasks(),
      this.listActivities(),
      query('SELECT * FROM notifications ORDER BY created_at DESC').then(r => r.rows.map((row: DbRow) => this.rowToNotification(row))),
      this.listCustomFieldDefinitions(),
      this.listEmailTemplates(),
      this.listEmailCampaigns(),
      this.listAuditLogs(),
      this.listApiKeys(),
      this.listWebhooks(),
      this.listQuotas(),
      this.listApprovals(),
      this.getSecurityPolicy(),
      this.listFieldPermissions(),
    ]);

    return {
      users, accounts, contacts, leads, pipelines, stages, deals, tasks, activities, notifications,
      customFields, emailTemplates, emailCampaigns, auditLogs,
      apiKeys, webhooks, quotas, approvals, securityPolicy, fieldPermissions,
    };
  }

  // ─── Email Tracking ────────────────────────────────

  async incrementCampaignOpens(campaignId: string): Promise<void> {
    await query(
      'UPDATE email_campaigns SET opened_count = opened_count + 1 WHERE id = $1',
      [campaignId],
    );
  }

  async incrementCampaignClicks(campaignId: string): Promise<void> {
    await query(
      'UPDATE email_campaigns SET clicked_count = clicked_count + 1 WHERE id = $1',
      [campaignId],
    );
  }

  // ─── Calendar Tokens ───────────────────────────────

  async upsertCalendarToken(token: CalendarTokenRecord): Promise<void> {
    await query(
      `INSERT INTO calendar_tokens (id, user_id, provider, email, access_token, refresh_token, expires_at, scope)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       ON CONFLICT (user_id, provider, email) DO UPDATE SET
         access_token = $5, refresh_token = $6, expires_at = $7, scope = $8, updated_at = NOW()`,
      [token.id, token.user_id, token.provider, token.email,
       token.access_token, token.refresh_token, token.expires_at, token.scope],
    );
  }

  async getCalendarTokens(userId: string): Promise<CalendarTokenRecord[]> {
    const result = await query(
      'SELECT * FROM calendar_tokens WHERE user_id = $1 ORDER BY created_at',
      [userId],
    );
    return result.rows.map((row: DbRow) => ({
      id: row.id,
      user_id: row.user_id,
      provider: row.provider,
      email: row.email,
      access_token: row.access_token,
      refresh_token: row.refresh_token,
      expires_at: row.expires_at instanceof Date ? row.expires_at.toISOString() : String(row.expires_at),
      scope: row.scope,
      created_at: row.created_at instanceof Date ? row.created_at.toISOString() : String(row.created_at),
      updated_at: row.updated_at instanceof Date ? row.updated_at.toISOString() : String(row.updated_at),
    }));
  }

  async deleteCalendarToken(userId: string, provider: string): Promise<void> {
    await query('DELETE FROM calendar_tokens WHERE user_id = $1 AND provider = $2', [userId, provider]);
  }

  // ─── GDPR ───────────────────────────────────────────

  async exportUserData(userId: string): Promise<Record<string, unknown>> {
    const [contacts, accounts, leads, deals, tasks, activities, notifications] = await Promise.all([
      query('SELECT * FROM contacts WHERE owner_id = $1', [userId]).then(r => r.rows.map((row: DbRow) => this.rowToContact(row))),
      query('SELECT * FROM accounts WHERE owner_id = $1', [userId]).then(r => r.rows.map((row: DbRow) => this.rowToAccount(row))),
      query('SELECT * FROM leads WHERE owner_id = $1', [userId]).then(r => r.rows.map((row: DbRow) => this.rowToLead(row))),
      query('SELECT * FROM deals WHERE owner_id = $1', [userId]).then(r => r.rows.map((row: DbRow) => this.rowToDeal(row))),
      query('SELECT * FROM tasks WHERE assigned_to_id = $1 OR created_by_id = $1', [userId]).then(r => r.rows.map((row: DbRow) => this.rowToTask(row))),
      query('SELECT * FROM activities WHERE user_id = $1', [userId]).then(r => r.rows.map((row: DbRow) => this.rowToActivity(row))),
      query('SELECT * FROM notifications WHERE user_id = $1', [userId]).then(r => r.rows.map((row: DbRow) => this.rowToNotification(row))),
    ]);

    return { contacts, accounts, leads, deals, tasks, activities, notifications };
  }

  async deleteUserData(userId: string): Promise<void> {
    // Anonymize activities (keep for audit trail)
    await query(
      `UPDATE activities SET user_id = $2, metadata = COALESCE(metadata, '{}'::jsonb) || '{"anonymized": true}'::jsonb WHERE user_id = $1`,
      [userId, '00000000-0000-0000-0000-000000000000'],
    );

    // Delete notifications (purely personal data)
    await query('DELETE FROM notifications WHERE user_id = $1', [userId]);

    // Delete reset tokens (purely personal data)
    await query('DELETE FROM password_reset_tokens WHERE user_id = $1', [userId]);

    // Soft-delete + anonymize user (preserves FK references to tasks, deals, etc.)
    await query(
      `UPDATE users SET is_active = false, email = $2, name = $3, avatar_url = NULL, password_hash = NULL, totp_secret = NULL, mfa_enabled = false WHERE id = $1`,
      [userId, `deleted-${randomUUID()}@anonymous`, 'Deleted User'],
    );
  }

  // ─── Row Mappers ────────────────────────────────────

  private rowToOrganization(row: DbRow): Organization {
    return {
      id: row.id,
      name: row.name,
      slug: row.slug,
      plan: row.plan,
      ses_domain: row.ses_domain,
      fiscal_year_start: row.fiscal_year_start,
    };
  }

  private rowToUser(row: DbRow): User {
    return {
      id: row.id,
      organization_id: row.organization_id,
      email: row.email,
      name: row.name,
      avatar_url: row.avatar_url || undefined,
      role: row.role,
      mfa_enabled: row.mfa_enabled,
      is_active: row.is_active,
      timezone: row.timezone,
      team_id: row.team_id || undefined,
    };
  }

  private rowToContact(row: DbRow): Contact {
    return {
      id: row.id,
      organization_id: row.organization_id,
      first_name: row.first_name,
      last_name: row.last_name,
      email: row.email,
      phone: row.phone || '',
      title: row.title || '',
      linkedin_url: row.linkedin_url || undefined,
      account_id: row.account_id,
      owner_id: row.owner_id,
      tags: row.tags || [],
      custom_fields: row.custom_fields || {},
      unsubscribed: row.unsubscribed || false,
      created_at: row.created_at instanceof Date ? row.created_at.toISOString() : String(row.created_at),
      updated_at: row.updated_at instanceof Date ? row.updated_at.toISOString() : row.updated_at ? String(row.updated_at) : undefined,
    };
  }

  private rowToAccount(row: DbRow): Account {
    return {
      id: row.id,
      organization_id: row.organization_id,
      name: row.name,
      domain: row.domain || '',
      industry: row.industry || '',
      size: row.size || '1-10',
      website: row.website || '',
      arr: Number(row.arr) || 0,
      owner_id: row.owner_id,
      tags: row.tags || [],
      custom_fields: row.custom_fields || {},
      created_at: row.created_at instanceof Date ? row.created_at.toISOString() : String(row.created_at),
      updated_at: row.updated_at instanceof Date ? row.updated_at.toISOString() : row.updated_at ? String(row.updated_at) : undefined,
    };
  }

  private rowToDeal(row: DbRow): Deal {
    return {
      id: row.id,
      organization_id: row.organization_id,
      name: row.name,
      pipeline_id: row.pipeline_id,
      stage_id: row.stage_id,
      account_id: row.account_id,
      owner_id: row.owner_id,
      value: Number(row.value) || 0,
      currency: row.currency || 'USD',
      probability: row.probability ?? undefined,
      close_date: row.close_date instanceof Date ? row.close_date.toISOString().split('T')[0] : String(row.close_date).split('T')[0],
      stage_entered_at: row.stage_entered_at instanceof Date ? row.stage_entered_at.toISOString() : String(row.stage_entered_at),
      won_at: row.won_at ? (row.won_at instanceof Date ? row.won_at.toISOString() : String(row.won_at)) : undefined,
      lost_at: row.lost_at ? (row.lost_at instanceof Date ? row.lost_at.toISOString() : String(row.lost_at)) : undefined,
      lost_reason: row.lost_reason || undefined,
      custom_fields: row.custom_fields || {},
      line_items: row.line_items || [],
      created_at: row.created_at instanceof Date ? row.created_at.toISOString() : String(row.created_at),
    };
  }

  private rowToLead(row: DbRow): Lead {
    return {
      id: row.id,
      organization_id: row.organization_id,
      first_name: row.first_name,
      last_name: row.last_name,
      company_name: row.company_name,
      email: row.email,
      phone: row.phone || '',
      source: row.source || undefined,
      status: row.status,
      owner_id: row.owner_id,
      is_converted: row.is_converted === true,
      converted_account_id: row.converted_account_id || undefined,
      converted_contact_id: row.converted_contact_id || undefined,
      converted_at: row.converted_at ? (row.converted_at instanceof Date ? row.converted_at.toISOString() : String(row.converted_at)) : undefined,
      created_at: row.created_at instanceof Date ? row.created_at.toISOString() : String(row.created_at),
      updated_at: row.updated_at ? (row.updated_at instanceof Date ? row.updated_at.toISOString() : String(row.updated_at)) : undefined,
    };
  }

  private rowToTask(row: DbRow): Task {
    return {
      id: row.id,
      organization_id: row.organization_id,
      title: row.title,
      type: row.type,
      priority: row.priority,
      due_at: row.due_at instanceof Date ? row.due_at.toISOString() : String(row.due_at),
      completed_at: row.completed_at ? (row.completed_at instanceof Date ? row.completed_at.toISOString() : String(row.completed_at)) : undefined,
      assigned_to_id: row.assigned_to_id,
      created_by_id: row.created_by_id,
      contact_id: row.contact_id || undefined,
      deal_id: row.deal_id || undefined,
      lead_id: row.lead_id || undefined,
      recurrence_rule: row.recurrence_rule || undefined,
    };
  }

  private rowToRecordTask(row: DbRow): RecordTask {
    return {
      id: row.id,
      organization_id: row.organization_id,
      user_id: row.user_id,
      subject: row.subject,
      description: row.description || '',
      due_date: row.due_date ? (row.due_date instanceof Date ? row.due_date.toISOString() : String(row.due_date)) : undefined,
      associated_to_id: row.associated_to_id,
      completed_at: row.completed_at ? (row.completed_at instanceof Date ? row.completed_at.toISOString() : String(row.completed_at)) : undefined,
      created_at: row.created_at instanceof Date ? row.created_at.toISOString() : String(row.created_at),
      updated_at: row.updated_at ? (row.updated_at instanceof Date ? row.updated_at.toISOString() : String(row.updated_at)) : undefined,
    };
  }

  private rowToCallLog(row: DbRow): CallLog {
    return {
      id: row.id,
      organization_id: row.organization_id,
      user_id: row.user_id,
      subject: row.subject,
      description: row.description || '',
      due_date: row.due_date ? (row.due_date instanceof Date ? row.due_date.toISOString() : String(row.due_date)) : undefined,
      associated_to_id: row.associated_to_id,
      created_at: row.created_at instanceof Date ? row.created_at.toISOString() : String(row.created_at),
    };
  }

  private rowToActivity(row: DbRow): Activity {
    return {
      id: row.id,
      organization_id: row.organization_id,
      type: row.type,
      title: row.title,
      body: row.body || '',
      outcome: row.outcome || undefined,
      duration_seconds: row.duration_seconds || undefined,
      user_id: row.user_id,
      contact_id: row.contact_id || undefined,
      deal_id: row.deal_id || undefined,
      lead_id: row.lead_id || undefined,
      task_id: row.task_id || undefined,
      metadata: row.metadata || undefined,
      created_at: row.created_at instanceof Date ? row.created_at.toISOString() : String(row.created_at),
    };
  }

  private rowToNotification(row: DbRow): Notification {
    return {
      id: row.id,
      organization_id: row.organization_id,
      user_id: row.user_id,
      type: row.type,
      title: row.title,
      body: row.body,
      entity_type: row.entity_type,
      entity_id: row.entity_id,
      read_at: row.read_at ? (row.read_at instanceof Date ? row.read_at.toISOString() : String(row.read_at)) : undefined,
      created_at: row.created_at instanceof Date ? row.created_at.toISOString() : String(row.created_at),
    };
  }

  private rowToEmailTemplate(row: DbRow): EmailTemplate {
    return {
      id: row.id,
      organization_id: row.organization_id,
      name: row.name,
      subject: row.subject,
      body_html: row.body_html,
      variables: row.variables || [],
      is_shared: row.is_shared || false,
      created_by_id: row.created_by_id,
      category: row.category || undefined,
    };
  }

  private rowToEmailCampaign(row: DbRow): EmailCampaign {
    return {
      id: row.id,
      organization_id: row.organization_id,
      name: row.name,
      template_id: row.template_id,
      status: row.status,
      scheduled_at: row.scheduled_at ? (row.scheduled_at instanceof Date ? row.scheduled_at.toISOString() : String(row.scheduled_at)) : undefined,
      sent_at: row.sent_at ? (row.sent_at instanceof Date ? row.sent_at.toISOString() : String(row.sent_at)) : undefined,
      total_recipients: row.total_recipients || 0,
      delivered_count: row.delivered_count || 0,
      opened_count: row.opened_count || 0,
      clicked_count: row.clicked_count || 0,
      bounced_count: row.bounced_count || 0,
      unsubscribed_count: row.unsubscribed_count || 0,
      created_by_id: row.created_by_id,
    };
  }

  private rowToAuditLog(row: DbRow): AuditLog {
    return {
      id: row.id,
      organization_id: row.organization_id,
      user_id: row.user_id || undefined,
      user_name: row.user_name,
      action: row.action,
      entity_type: row.entity_type,
      entity_id: row.entity_id || undefined,
      diff: row.diff || undefined,
      ip_address: row.ip_address || '',
      user_agent: row.user_agent || '',
      created_at: row.created_at instanceof Date ? row.created_at.toISOString() : String(row.created_at),
    };
  }

  private rowToCustomField(row: DbRow): CustomFieldDefinition {
    return {
      id: row.id,
      organization_id: row.organization_id,
      entity_type: row.entity_type,
      key: row.key,
      label: row.label,
      field_type: row.field_type,
      options: row.options || undefined,
      is_required: row.is_required || false,
      is_visible: row.is_visible !== false,
      order: row.display_order || 0,
    };
  }

  private rowToFile(row: DbRow): FileRecord {
    return {
      id: row.id,
      organization_id: row.organization_id,
      user_id: row.user_id,
      entity_type: row.entity_type,
      entity_id: row.entity_id,
      filename: row.filename,
      original_name: row.original_name,
      mime_type: row.mime_type,
      size_bytes: Number(row.size_bytes),
      storage_provider: row.storage_provider,
      storage_path: row.storage_path,
      created_at: row.created_at instanceof Date ? row.created_at.toISOString() : String(row.created_at),
    };
  }

  private rowToApiKey(row: DbRow): ApiKey {
    return {
      id: row.id,
      organization_id: row.organization_id || undefined,
      name: row.name,
      key_prefix: row.key_prefix,
      scopes: row.scopes || [],
      created_by_id: row.created_by_id || undefined,
      last_used_at: row.last_used_at ? (row.last_used_at instanceof Date ? row.last_used_at.toISOString() : String(row.last_used_at)) : undefined,
      expires_at: row.expires_at ? (row.expires_at instanceof Date ? row.expires_at.toISOString() : String(row.expires_at)) : null,
      revoked_at: row.revoked_at ? (row.revoked_at instanceof Date ? row.revoked_at.toISOString() : String(row.revoked_at)) : null,
      created_at: row.created_at instanceof Date ? row.created_at.toISOString() : String(row.created_at),
    };
  }

  private rowToWebhook(row: DbRow): Webhook {
    return {
      id: row.id,
      organization_id: row.organization_id || undefined,
      name: row.name,
      url: row.url,
      secret: row.secret,
      events: row.events || [],
      status: row.status,
      created_by_id: row.created_by_id || undefined,
      last_triggered_at: row.last_triggered_at ? (row.last_triggered_at instanceof Date ? row.last_triggered_at.toISOString() : String(row.last_triggered_at)) : undefined,
      failure_count: row.failure_count || 0,
      created_at: row.created_at instanceof Date ? row.created_at.toISOString() : String(row.created_at),
      updated_at: row.updated_at instanceof Date ? row.updated_at.toISOString() : String(row.updated_at),
    };
  }

  private rowToWebhookDelivery(row: DbRow): WebhookDelivery {
    return {
      id: row.id,
      organization_id: row.organization_id || undefined,
      webhook_id: row.webhook_id,
      event: row.event,
      payload: row.payload || {},
      response_status: row.response_status ?? undefined,
      response_body: row.response_body ?? undefined,
      success: row.success || false,
      attempt: row.attempt || 1,
      created_at: row.created_at instanceof Date ? row.created_at.toISOString() : String(row.created_at),
    };
  }

  private rowToQuota(row: DbRow): Quota {
    return {
      id: row.id,
      organization_id: row.organization_id || undefined,
      user_id: row.user_id || null,
      team_id: row.team_id || null,
      period: row.period,
      amount: Number(row.amount) || 0,
      currency: row.currency || 'USD',
      fiscal_year: row.fiscal_year,
      fiscal_period: row.fiscal_period,
      created_at: row.created_at instanceof Date ? row.created_at.toISOString() : String(row.created_at),
      updated_at: row.updated_at instanceof Date ? row.updated_at.toISOString() : String(row.updated_at),
    };
  }

  private rowToApproval(row: DbRow): ApprovalRequest {
    return {
      id: row.id,
      organization_id: row.organization_id || undefined,
      entity_type: row.entity_type,
      entity_id: row.entity_id,
      requested_by_id: row.requested_by_id,
      approver_id: row.approver_id || null,
      status: row.status,
      title: row.title,
      reason: row.reason || undefined,
      payload: row.payload || {},
      decision_note: row.decision_note || undefined,
      decided_at: row.decided_at ? (row.decided_at instanceof Date ? row.decided_at.toISOString() : String(row.decided_at)) : undefined,
      created_at: row.created_at instanceof Date ? row.created_at.toISOString() : String(row.created_at),
    };
  }

  private rowToSecurityPolicy(row: DbRow): OrgSecurityPolicy {
    return {
      organization_id: row.organization_id,
      ip_allowlist: row.ip_allowlist || [],
      session_idle_minutes: row.session_idle_minutes,
      max_sessions_per_user: row.max_sessions_per_user,
      enforce_mfa: row.enforce_mfa || false,
      enforce_sso: row.enforce_sso || false,
      password_min_length: row.password_min_length,
      updated_at: row.updated_at instanceof Date ? row.updated_at.toISOString() : String(row.updated_at),
    };
  }

  private rowToFieldPermission(row: DbRow): FieldPermission {
    return {
      id: row.id,
      organization_id: row.organization_id || undefined,
      entity_type: row.entity_type,
      field_key: row.field_key,
      role: row.role,
      can_read: row.can_read,
      can_write: row.can_write,
    };
  }
}
