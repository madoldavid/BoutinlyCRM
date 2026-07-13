import { AsyncLocalStorage } from 'node:async_hooks';
import pg from 'pg';

export interface DbConfig {
  databaseUrl?: string;
  databaseSsl: boolean;
  databaseSslRejectUnauthorized?: boolean;
}

let pool: pg.Pool | null = null;

export function getPool(config: DbConfig): pg.Pool {
  if (!pool) {
    if (!config.databaseUrl) {
      throw new Error('DATABASE_URL is required for PostgreSQL connection.');
    }

    const sslConfig = config.databaseSsl
      ? { rejectUnauthorized: config.databaseSslRejectUnauthorized !== false }
      : false;

    pool = new pg.Pool({
      connectionString: config.databaseUrl,
      ssl: sslConfig,
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 5000,
    });

    pool.on('error', (err) => {
      console.error('Unexpected PostgreSQL pool error:', err.message);
    });
  }
  return pool;
}

// ─── Tenant context via AsyncLocalStorage ─────────────

const tenantContext = new AsyncLocalStorage<string>();

/** Returns the current organization ID for the active request, if any */
export function getCurrentOrgId(): string | undefined {
  return tenantContext.getStore();
}

/** Run a callback with the given organization ID scoped to all async operations */
export function runWithTenant<T>(orgId: string, fn: () => T): T {
  return tenantContext.run(orgId, fn);
}

// ─── Query helpers ────────────────────────────────────

/**
 * Execute a parameterized query. When called within a tenant context,
 * wraps the query in a transaction that sets app.organization_id so
 * PostgreSQL RLS policies activate correctly.
 */
export async function query(text: string, params?: unknown[]): Promise<pg.QueryResult<any>> {
  const orgId = tenantContext.getStore();

  if (!orgId) {
    // No tenant context — use pool directly (health checks, migrations, etc.)
    return getPool(globalDbConfig).query(text, params);
  }

  // Tenant context active — use a dedicated client so we can SET LOCAL
  const client = await getPool(globalDbConfig).connect();
  try {
    await client.query('BEGIN');
    await client.query('SELECT set_config($1, $2, true)', ['app.organization_id', orgId]);
    const result = await client.query(text, params);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}

/**
 * Get a dedicated client from the pool. Caller must release it.
 * When used within a tenant context, the org is already set via the
 * tenant-aware query() wrapper. For explicit transaction control,
 * use this and call setOrganizationContext manually.
 */
export async function getClient(): Promise<pg.PoolClient> {
  const client = await getPool(globalDbConfig).connect();
  const orgId = tenantContext.getStore();
  if (orgId) {
    await client.query('BEGIN');
    await client.query('SELECT set_config($1, $2, true)', ['app.organization_id', orgId]);
  }
  return client;
}

let globalDbConfig: DbConfig = { databaseSsl: false };

export function setDbConfig(config: DbConfig) {
  globalDbConfig = config;
}

// Set organization context for RLS on a specific client
export async function setOrganizationContext(client: pg.PoolClient | pg.Pool, organizationId: string) {
  await client.query('SELECT set_config($1, $2, true)', ['app.organization_id', organizationId]);
}

export async function closePool() {
  if (pool) {
    await pool.end();
    pool = null;
  }
}
