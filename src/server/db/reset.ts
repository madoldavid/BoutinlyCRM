import { getClient, type DbConfig } from './connection.js';
import { seedDatabase } from './seed.js';

export interface ResetOptions {
  passwordPepper: string;
  demoPassword: string;
}

export async function resetDatabase(
  dbConfig: DbConfig,
  options: ResetOptions,
): Promise<void> {
  const client = await getClient();

  try {
    console.log('Dropping all data...');

    await client.query('BEGIN');

    // Truncate all tables in dependency order
    await client.query('DELETE FROM audit_logs');
    await client.query('DELETE FROM notifications');
    await client.query('DELETE FROM email_campaigns');
    await client.query('DELETE FROM email_templates');
    await client.query('DELETE FROM activities');
    await client.query('DELETE FROM tasks');
    await client.query('DELETE FROM custom_field_definitions');
    await client.query('DELETE FROM deals');
    await client.query('DELETE FROM contacts');
    await client.query('DELETE FROM accounts');
    await client.query('DELETE FROM stages');
    await client.query('DELETE FROM pipelines');
    await client.query('DELETE FROM users');
    await client.query('DELETE FROM teams');
    await client.query('DELETE FROM organizations');
    await client.query('DELETE FROM _migrations');

    await client.query('COMMIT');
    console.log('All data cleared.');

    // Re-seed
    await seedDatabase(dbConfig, options);
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

// CLI entry point — run with: npm run db:reset
const runningDirectly = process.argv[1] && import.meta.url.endsWith(process.argv[1].replace(/^\.?\//, ''));
if (runningDirectly) {
  const { setDbConfig } = await import('./connection.js');

  const dbConfig: DbConfig = {
    databaseUrl: process.env.DATABASE_URL,
    databaseSsl: process.env.DATABASE_SSL === 'true',
  };

  if (!dbConfig.databaseUrl) {
    console.error('DATABASE_URL is required for db:reset.');
    process.exit(1);
  }

  setDbConfig(dbConfig);

  resetDatabase(dbConfig, {
    passwordPepper: process.env.PASSWORD_PEPPER || 'development-password-pepper',
    demoPassword: process.env.DEMO_PASSWORD || 'ChangeMe123!',
  }).then(() => {
    console.log('Database reset complete.');
    process.exit(0);
  }).catch((err) => {
    console.error('Reset failed:', err);
    process.exit(1);
  });
}
