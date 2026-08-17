import {
  INITIAL_ACCOUNTS,
  INITIAL_CONTACTS,
  INITIAL_CUSTOM_FIELDS,
  INITIAL_DEALS,
  INITIAL_PIPELINES,
  INITIAL_STAGES,
  INITIAL_TASKS,
  INITIAL_TEMPLATES,
  INITIAL_USERS,
  INITIAL_RECORD_TASKS,
  INITIAL_CALL_LOGS,
} from '../../initialData.js';
import { hashPassword } from '../security/password.js';
import { getClient, setOrganizationContext, type DbConfig } from './connection.js';
import { MigrationRunner } from './migrate.js';

export interface SeedOptions {
  passwordPepper: string;
  demoPassword: string;
}

export async function seedDatabase(
  dbConfig: DbConfig,
  options: SeedOptions,
): Promise<void> {
  // Run migrations first
  const runner = new MigrationRunner();
  await runner.run();

  const client = await getClient();

  try {
    // Check if already seeded
    const existing = await client.query('SELECT count(*) as cnt FROM organizations');
    if (existing.rows[0].cnt > 0) {
      console.log('Database already seeded, skipping.');
      return;
    }

    const orgId = 'org-boutinly';
    const passwordHash = await hashPassword(options.demoPassword, options.passwordPepper);

    // Create organization
    await client.query(
      `INSERT INTO organizations (id, name, slug, plan) VALUES ($1, $2, $3, $4)`,
      [orgId, 'Boutinly', 'boutinly', 'enterprise'],
    );
    await setOrganizationContext(client, orgId);

    // Create teams
    const teamEastId = 'team-east';
    const teamReadonlyId = 'team-readonly';

    // Insert teams first (without manager_id since users don't exist yet)
    await client.query(
      `INSERT INTO teams (id, organization_id, name) VALUES ($1, $2, $3), ($4, $5, $6)`,
      [teamEastId, orgId, 'East Region', teamReadonlyId, orgId, 'Read Only'],
    );

    // Insert users
    for (const user of INITIAL_USERS) {
      const teamId = user.team_id || null;
      await client.query(
        `INSERT INTO users (id, organization_id, team_id, email, name, password_hash, role, mfa_enabled, is_active, timezone)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
        [user.id, orgId, teamId, user.email, user.name, passwordHash, user.role, user.mfa_enabled, user.is_active, user.timezone],
      );
    }

    // Update team managers
    await client.query(`UPDATE teams SET manager_id = $1 WHERE id = $2`, ['usr-alex', teamEastId]);

    // Insert accounts
    for (const account of INITIAL_ACCOUNTS) {
      await client.query(
        `INSERT INTO accounts (id, organization_id, owner_id, name, domain, industry, size, website, arr, tags, custom_fields)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
        [account.id, orgId, account.owner_id, account.name, account.domain, account.industry, account.size, account.website, account.arr, account.tags, JSON.stringify(account.custom_fields)],
      );
    }

    // Insert contacts
    for (const contact of INITIAL_CONTACTS) {
      await client.query(
        `INSERT INTO contacts (id, organization_id, account_id, owner_id, first_name, last_name, email, phone, title, linkedin_url, tags, custom_fields)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
        [contact.id, orgId, contact.account_id, contact.owner_id, contact.first_name, contact.last_name, contact.email, contact.phone, contact.title, contact.linkedin_url || '', contact.tags, JSON.stringify(contact.custom_fields)],
      );
    }

    // Insert pipelines
    for (const pipeline of INITIAL_PIPELINES) {
      await client.query(
        `INSERT INTO pipelines (id, organization_id, name, is_default, is_archived)
         VALUES ($1, $2, $3, $4, $5)`,
        [pipeline.id, orgId, pipeline.name, pipeline.is_default, pipeline.is_archived],
      );
    }

    // Insert stages
    for (const stage of INITIAL_STAGES) {
      await client.query(
        `INSERT INTO stages (id, organization_id, pipeline_id, name, probability, stage_order, type)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [stage.id, orgId, stage.pipeline_id, stage.name, stage.probability, stage.order, stage.type],
      );
    }

    // Insert deals
    for (const deal of INITIAL_DEALS) {
      await client.query(
        `INSERT INTO deals (id, organization_id, pipeline_id, stage_id, account_id, owner_id, name, value, currency, probability, close_date, custom_fields, line_items)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)`,
        [deal.id, orgId, deal.pipeline_id, deal.stage_id, deal.account_id, deal.owner_id, deal.name, deal.value, deal.currency, deal.probability || null, deal.close_date, JSON.stringify(deal.custom_fields), JSON.stringify(deal.line_items)],
      );
    }

    // Insert tasks
    for (const task of INITIAL_TASKS) {
      await client.query(
        `INSERT INTO tasks (id, organization_id, assigned_to_id, created_by_id, contact_id, deal_id, title, type, priority, due_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
        [task.id, orgId, task.assigned_to_id, task.created_by_id, task.contact_id || null, task.deal_id || null, task.title, task.type, task.priority, task.due_at],
      );
    }

    // Insert record tasks (activity timeline sub-system)
    for (const recordTask of INITIAL_RECORD_TASKS) {
      await client.query(
        `INSERT INTO record_tasks (id, organization_id, user_id, subject, description, due_date, associated_to_id, completed_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [recordTask.id, orgId, recordTask.user_id, recordTask.subject, recordTask.description, recordTask.due_date || null, recordTask.associated_to_id, recordTask.completed_at || null],
      );
    }

    // Insert call logs (activity timeline sub-system)
    for (const callLog of INITIAL_CALL_LOGS) {
      await client.query(
        `INSERT INTO call_logs (id, organization_id, user_id, subject, description, due_date, associated_to_id)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [callLog.id, orgId, callLog.user_id, callLog.subject, callLog.description, callLog.due_date || null, callLog.associated_to_id],
      );
    }

    // Insert custom fields
    for (const cfd of INITIAL_CUSTOM_FIELDS) {
      await client.query(
        `INSERT INTO custom_field_definitions (id, organization_id, entity_type, key, label, field_type, is_required, is_visible, display_order)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [cfd.id, orgId, cfd.entity_type, cfd.key, cfd.label, cfd.field_type, cfd.is_required, cfd.is_visible, cfd.order],
      );
    }

    // Insert email templates
    for (const template of INITIAL_TEMPLATES) {
      await client.query(
        `INSERT INTO email_templates (id, organization_id, created_by_id, name, subject, body_html, variables, is_shared, category)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [template.id, orgId, template.created_by_id, template.name, template.subject, template.body_html, template.variables, template.is_shared, template.category || null],
      );
    }

    await client.query('COMMIT');
    console.log('Database seeded successfully.');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}
