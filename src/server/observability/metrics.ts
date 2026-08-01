/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Prometheus-compatible metrics registry.
 * Exposes counters and histograms for HTTP requests, auth events,
 * database queries, and application-level errors.
 * GET /metrics returns Prometheus text format.
 */

import type { Request, Response } from 'express';

// ─── Metric types ───────────────────────────────────

interface Metric {
  name: string;
  help: string;
  type: 'counter' | 'histogram' | 'gauge';
  labelNames: string[];
  values: Map<string, number>; // key = label1=val1,label2=val2
}

interface HistogramMetric extends Metric {
  type: 'histogram';
  buckets: number[];
  sumValues: Map<string, number>;
  countValues: Map<string, number>;
  bucketValues: Map<string, Map<number, number>>; // labels → bucket → count
}

function formatLabels(labels: Record<string, string>): string {
  const pairs = Object.entries(labels)
    .filter(([, v]) => v !== undefined && v !== null)
    .map(([k, v]) => `${k}="${String(v).replace(/"/g, '\\"')}"`);
  return pairs.length > 0 ? `{${pairs.join(',')}}` : '';
}

class MetricsRegistry {
  private metrics = new Map<string, Metric | HistogramMetric>();
  private startTime = Date.now();

  registerCounter(name: string, help: string, labelNames: string[] = []): void {
    this.metrics.set(name, { name, help, type: 'counter', labelNames, values: new Map() });
  }

  registerGauge(name: string, help: string, labelNames: string[] = []): void {
    this.metrics.set(name, { name, help, type: 'gauge', labelNames, values: new Map() });
  }

  registerHistogram(name: string, help: string, labelNames: string[] = [], buckets: number[] = [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10]): void {
    this.metrics.set(name, {
      name, help, type: 'histogram', labelNames, buckets,
      sumValues: new Map(), countValues: new Map(),
      bucketValues: new Map(),
      values: new Map(),
    });
  }

  /** Increment a counter */
  inc(name: string, labels: Record<string, string> = {}, by = 1): void {
    const m = this.metrics.get(name);
    if (!m || m.type !== 'counter' && m.type !== 'gauge') return;
    const key = formatLabels(labels);
    m.values.set(key, (m.values.get(key) || 0) + by);
  }

  /** Set a gauge to a specific value */
  set(name: string, value: number, labels: Record<string, string> = {}): void {
    const m = this.metrics.get(name);
    if (!m || m.type !== 'gauge') return;
    m.values.set(formatLabels(labels), value);
  }

  /** Observe a histogram value */
  observe(name: string, value: number, labels: Record<string, string> = {}): void {
    const m = this.metrics.get(name);
    if (!m || m.type !== 'histogram') return;
    const hm = m as HistogramMetric;
    const key = formatLabels(labels);

    // Sum and count
    hm.sumValues.set(key, (hm.sumValues.get(key) || 0) + value);
    hm.countValues.set(key, (hm.countValues.get(key) || 0) + 1);

    // Buckets
    if (!hm.bucketValues.has(key)) hm.bucketValues.set(key, new Map());
    const bm = hm.bucketValues.get(key)!;
    for (const bucket of hm.buckets) {
      if (value <= bucket) {
        bm.set(bucket, (bm.get(bucket) || 0) + 1);
      }
    }
    // +Inf bucket
    bm.set(Infinity, (bm.get(Infinity) || 0) + 1);
  }

  getMetrics(): string {
    const lines: string[] = [];

    // Process uptime
    const uptime = Math.floor((Date.now() - this.startTime) / 1000);
    lines.push('# HELP process_uptime_seconds Process uptime in seconds');
    lines.push('# TYPE process_uptime_seconds gauge');
    lines.push(`process_uptime_seconds ${uptime}`);

    // Memory
    const mem = process.memoryUsage();
    lines.push('# HELP process_heap_bytes Process heap memory in bytes');
    lines.push('# TYPE process_heap_bytes gauge');
    lines.push(`process_heap_bytes ${mem.heapUsed}`);

    for (const m of this.metrics.values()) {
      lines.push(`# HELP ${m.name} ${m.help}`);
      lines.push(`# TYPE ${m.name} ${m.type}`);

      if (m.type === 'histogram') {
        const hm = m as HistogramMetric;
        for (const [key, count] of hm.countValues) {
          const labelStr = key || '';
          lines.push(`${m.name}_count${labelStr} ${count}`);
          lines.push(`${m.name}_sum${labelStr} ${hm.sumValues.get(key) || 0}`);
          const bm = hm.bucketValues.get(key);
          if (bm) {
            for (const bucket of [...hm.buckets, Infinity]) {
              const bucketLabel = bucket === Infinity ? '+Inf' : String(bucket);
              const fullLabels = key
                ? key.slice(0, -1) + `,le="${bucketLabel}"}`
                : `{le="${bucketLabel}"}`;
              lines.push(`${m.name}_bucket${fullLabels} ${bm.get(bucket) || 0}`);
            }
          }
        }
        if (hm.countValues.size === 0) {
          lines.push(`${m.name}_count 0`);
          lines.push(`${m.name}_sum 0`);
        }
      } else {
        for (const [key, value] of m.values) {
          const labelStr = key || '';
          lines.push(`${m.name}${labelStr} ${value}`);
        }
        if (m.values.size === 0) {
          lines.push(`${m.name} 0`);
        }
      }
    }

    return lines.join('\n') + '\n';
  }
}

// ─── Singleton registry with pre-configured metrics ───

export const metrics = new MetricsRegistry();

// HTTP metrics
metrics.registerCounter('http_requests_total', 'Total HTTP requests', ['method', 'path', 'status']);
metrics.registerHistogram('http_request_duration_seconds', 'HTTP request duration', ['method', 'path']);
metrics.registerCounter('http_errors_total', 'Total HTTP errors', ['method', 'path', 'status']);

// Auth metrics
metrics.registerCounter('auth_logins_total', 'Total login attempts', ['result']); // success, failure, locked
metrics.registerCounter('auth_signups_total', 'Total signup attempts', ['result']);
metrics.registerCounter('auth_mfa_challenges_total', 'Total MFA challenges', ['result']);
metrics.registerCounter('auth_token_refreshes_total', 'Total token refreshes', ['result']);

// Database metrics
metrics.registerCounter('db_queries_total', 'Total database queries', ['operation']); // select, insert, update, delete
metrics.registerHistogram('db_query_duration_seconds', 'Database query duration', ['operation']);
metrics.registerGauge('db_pool_connections', 'Database pool active connections');
metrics.registerGauge('db_pool_idle', 'Database pool idle connections');

// Business metrics
metrics.registerCounter('crm_contacts_created_total', 'Contacts created');
metrics.registerCounter('crm_deals_created_total', 'Deals created');
metrics.registerCounter('crm_deals_won_total', 'Deals won');
metrics.registerCounter('crm_deals_lost_total', 'Deals lost');
metrics.registerCounter('crm_tasks_completed_total', 'Tasks completed');
metrics.registerCounter('crm_emails_sent_total', 'Emails sent', ['type']); // single, campaign

// Rate limiter
metrics.registerCounter('ratelimit_hits_total', 'Rate limit enforcements', ['limiter']);

/**
 * Express middleware that records HTTP metrics for every request.
 */
export function metricsMiddleware() {
  return (req: Request, res: Response, next: () => void) => {
    const start = Date.now();
    const path = normalizePath(req.path);

    // Record on response finish
    const originalEnd = res.end;
    res.end = function (...args: any[]) {
      const duration = (Date.now() - start) / 1000;
      const status = String(res.statusCode);

      metrics.inc('http_requests_total', { method: req.method, path, status });
      metrics.observe('http_request_duration_seconds', duration, { method: req.method, path });

      if (res.statusCode >= 400) {
        metrics.inc('http_errors_total', { method: req.method, path, status });
      }

      return originalEnd.apply(this, args);
    } as any;

    next();
  };
}

/**
 * GET /metrics handler — returns Prometheus text format.
 */
export function metricsEndpoint(_req: Request, res: Response): void {
  res.setHeader('Content-Type', 'text/plain; version=0.0.4');
  res.send(metrics.getMetrics());
}

/** Normalize URL paths to reduce metric cardinality */
function normalizePath(path: string): string {
  // Replace UUIDs and IDs with :param
  return path
    .replace(/\/[a-f0-9-]{36}/g, '/:uuid')
    .replace(/\/[a-f0-9]{24,}/g, '/:id')
    .replace(/\/usr-[a-z0-9-]+/g, '/:userId')
    .replace(/\/con-[a-z0-9-]+/g, '/:contactId')
    .replace(/\/acc-[a-z0-9-]+/g, '/:accountId')
    .replace(/\/deal-[a-z0-9-]+/g, '/:dealId')
    .replace(/\/task-[a-z0-9-]+/g, '/:taskId')
    .replace(/\/pipe-[a-z0-9-]+/g, '/:pipelineId')
    .replace(/\/stg-[a-z0-9-]+/g, '/:stageId')
    .replace(/\/cfd-[a-z0-9-]+/g, '/:fieldId')
    .replace(/\/log-[a-z0-9-]+/g, '/:logId')
    .replace(/\/tmp-[a-z0-9-]+/g, '/:templateId')
    .replace(/\/camp-[a-z0-9-]+/g, '/:campaignId')
    .replace(/\/file-[a-z0-9-]+/g, '/:fileId');
}
