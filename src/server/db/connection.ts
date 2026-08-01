import { AsyncLocalStorage } from 'node:async_hooks';
import pg from 'pg';

// ─── Trace context ──────────────────────────────────

interface TraceContext {
  traceId: string;
  spanId: string;
}

const traceContext = new AsyncLocalStorage<TraceContext>();

export function getTraceContext(): TraceContext | undefined {
  return traceContext.getStore();
}

export function runWithTrace<T>(trace: TraceContext, fn: () => T): T {
  return traceContext.run(trace, fn);
}

export function generateTraceId(): string {
  return Math.random().toString(36).substring(2, 14) + Math.random().toString(36).substring(2, 14);
}

export interface DbConfig {
  databaseUrl?: string;
  databaseSsl: boolean;
  databaseSslRejectUnauthorized?: boolean;
}

// ─── Pool management with config change detection ───

let pool: pg.Pool | null = null;
let lastDbConfigHash = '';

function configHash(config: DbConfig): string {
  return `${config.databaseUrl}|${config.databaseSsl}|${config.databaseSslRejectUnauthorized}`;
}

export function getPool(config: DbConfig): pg.Pool {
  const hash = configHash(config);

  // Recreate pool if config changed (supports runtime reload)
  if (pool && hash !== lastDbConfigHash) {
    const oldPool = pool;
    pool = null;
    oldPool.end().catch(() => {});
  }

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
      // Pool-level errors are logged but not fatal — new connections retry
      process.stderr.write(JSON.stringify({
        level: 'error',
        msg: 'Unexpected PostgreSQL pool error',
        error: err.message,
        time: new Date().toISOString(),
      }) + '\n');
    });

    lastDbConfigHash = hash;
  }
  return pool;
}

// ─── Tenant context via AsyncLocalStorage ─────────────

const tenantContext = new AsyncLocalStorage<string>();

export function getCurrentOrgId(): string | undefined {
  return tenantContext.getStore();
}

export function runWithTenant<T>(orgId: string, fn: () => T): T {
  return tenantContext.run(orgId, fn);
}

// ─── Query helpers ────────────────────────────────────

function classifyOperation(text: string): string {
  const t = text.trim().substring(0, 6).toUpperCase();
  if (t.startsWith('SELECT')) return 'select';
  if (t.startsWith('INSERT')) return 'insert';
  if (t.startsWith('UPDATE')) return 'update';
  if (t.startsWith('DELETE')) return 'delete';
  return 'other';
}

function isReadQuery(text: string): boolean {
  return /^\s*SELECT\b/i.test(text.trim());
}

function emitTraceLog(trace: TraceContext, operation: string, text: string): void {
  process.stdout.write(
    JSON.stringify({
      level: 'debug',
      trace_id: trace.traceId,
      span_id: trace.spanId,
      db_operation: operation,
      db_statement: text.substring(0, 500),
      time: new Date().toISOString(),
    }) + '\n',
  );
}

async function recordDbMetrics(operation: string, durationMs: number): Promise<void> {
  try {
    const { metrics } = await import('../observability/metrics.js');
    metrics.inc('db_queries_total', { operation });
    metrics.observe('db_query_duration_seconds', durationMs / 1000, { operation });
  } catch { /* metrics optional */ }
}

/**
 * Execute a parameterized query within the tenant context.
 *
 * For READ queries (SELECT): uses a lightweight pool connection with
 * SET LOCAL for org isolation — 1 round-trip overhead instead of 4.
 *
 * For WRITE queries (INSERT/UPDATE/DELETE): wraps in a BEGIN/COMMIT
 * transaction with SET LOCAL for full ACID + RLS enforcement.
 */
export async function query(text: string, params?: unknown[]): Promise<pg.QueryResult<any>> {
  const orgId = tenantContext.getStore();
  const trace = traceContext.getStore();
  const start = Date.now();
  const operation = classifyOperation(text);

  if (trace) {
    emitTraceLog(trace, operation, text);
  }

  try {
    // No tenant context — use pool directly (health checks, migrations, etc.)
    if (!orgId) {
      const result = await getPool(globalDbConfig).query(text, params);
      recordDbMetrics(operation, Date.now() - start);
      return result;
    }

    // Tenant context active
    if (isReadQuery(text)) {
      // Optimized read path: borrow a client, SET LOCAL org + trace, run query, release
      const client = await getPool(globalDbConfig).connect();
      try {
        await client.query('SELECT set_config($1, $2, true)', ['app.organization_id', orgId]);
        if (trace) {
          await client.query('SELECT set_config($1, $2, true)', ['app.trace_id', trace.traceId]);
        }
        const result = await client.query(text, params);
        recordDbMetrics(operation, Date.now() - start);
        return result;
      } finally {
        client.release();
      }
    }

    // Write query path: full transaction
    const client = await getPool(globalDbConfig).connect();
    try {
      await client.query('BEGIN');
      await client.query('SELECT set_config($1, $2, true)', ['app.organization_id', orgId]);
      if (trace) {
        await client.query('SELECT set_config($1, $2, true)', ['app.trace_id', trace.traceId]);
      }
      const result = await client.query(text, params);
      await client.query('COMMIT');
      recordDbMetrics(operation, Date.now() - start);
      return result;
    } catch (err) {
      await client.query('ROLLBACK').catch(() => {});
      throw err;
    } finally {
      client.release();
    }
  } catch (err) {
    recordDbMetrics(operation, Date.now() - start);
    throw err;
  }
}

/**
 * Get a dedicated client from the pool. Caller must release it.
 * When used within a tenant context, sets app.organization_id via SET LOCAL.
 */
export async function getClient(): Promise<pg.PoolClient> {
  const client = await getPool(globalDbConfig).connect();
  const orgId = tenantContext.getStore();
  if (orgId) {
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
