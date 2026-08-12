import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { query, getClient, setDbConfig } from './connection.js';
import type { DbRow } from './types.js';

export class MigrationRunner {
  private migrationsDir: string;

  constructor(migrationsDir?: string) {
    this.migrationsDir = migrationsDir || path.resolve(process.cwd(), 'migrations');
  }

  async ensureMigrationsTable(): Promise<void> {
    await query(`
      create table if not exists _migrations (
        id serial primary key,
        name text not null unique,
        applied_at timestamptz not null default now()
      );
    `);
  }

  async getAppliedMigrations(): Promise<Set<string>> {
    const result = await query('SELECT name FROM _migrations ORDER BY id');
    return new Set(result.rows.map((row: DbRow) => row.name as string));
  }

  async getPendingMigrations(): Promise<string[]> {
    if (!fs.existsSync(this.migrationsDir)) {
      return [];
    }

    const files = fs.readdirSync(this.migrationsDir)
      .filter(f => f.endsWith('.sql') && !f.endsWith('.down.sql'))
      .sort();

    const applied = await this.getAppliedMigrations();
    return files.filter(f => !applied.has(f));
  }

  async applyMigration(filename: string): Promise<void> {
    const filePath = path.join(this.migrationsDir, filename);
    const sql = fs.readFileSync(filePath, 'utf-8');

    const client = await getClient();
    try {
      await client.query('BEGIN');
      await client.query(sql);
      await client.query('INSERT INTO _migrations (name) VALUES ($1)', [filename]);
      await client.query('COMMIT');
      console.log(`  ✓ Applied migration: ${filename}`);
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async run(): Promise<number> {
    await this.ensureMigrationsTable();
    const pending = await this.getPendingMigrations();

    if (pending.length === 0) {
      console.log('No pending migrations.');
      return 0;
    }

    console.log(`Found ${pending.length} pending migration(s):`);
    let applied = 0;

    for (const migration of pending) {
      await this.applyMigration(migration);
      applied++;
    }

    console.log(`Applied ${applied} migration(s) successfully.`);
    return applied;
  }

  /** Rollback the most recent migration. Accepts an optional step count (default 1). */
  async rollback(steps = 1): Promise<number> {
    await this.ensureMigrationsTable();
    const result = await query('SELECT name FROM _migrations ORDER BY id DESC LIMIT $1', [steps]);
    const toRollback = result.rows.map((row: DbRow) => row.name as string);

    if (toRollback.length === 0) {
      console.log('No migrations to rollback.');
      return 0;
    }

    // Look for corresponding down migration files
    let rolled = 0;
    for (const migrationName of toRollback) {
      const downFile = migrationName.replace('.sql', '.down.sql');
      const downPath = path.join(this.migrationsDir, downFile);

      if (fs.existsSync(downPath)) {
        await this.applyDownMigration(downFile);
      }

      // Remove from tracking table regardless
      await query('DELETE FROM _migrations WHERE name = $1', [migrationName]);
      console.log(`  ↺ Rolled back: ${migrationName}`);
      rolled++;
    }

    console.log(`Rolled back ${rolled} migration(s).`);
    return rolled;
  }

  private async applyDownMigration(filename: string): Promise<void> {
    const filePath = path.join(this.migrationsDir, filename);
    const sql = fs.readFileSync(filePath, 'utf-8');

    const client = await getClient();
    try {
      await client.query('BEGIN');
      await client.query(sql);
      await client.query('COMMIT');
      console.log(`  ✓ Applied down migration: ${filename}`);
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }
}

// CLI entry point — run with: npm run db:migrate
const runningDirectly = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (runningDirectly) {
  import('dotenv/config').then(() => {
    const dbConfig = {
      databaseUrl: process.env.DATABASE_URL,
      databaseSsl: process.env.DATABASE_SSL === 'true',
    };

    if (!dbConfig.databaseUrl) {
      console.error('DATABASE_URL is required for db:migrate.');
      process.exit(1);
    }

    setDbConfig(dbConfig);

    const runner = new MigrationRunner();
    runner.run()
      .then((count) => {
        console.log(`Migration complete. ${count} migration(s) applied.`);
        process.exit(0);
      })
      .catch((err) => {
        console.error('Migration failed:', err);
        process.exit(1);
      });
  });
}
