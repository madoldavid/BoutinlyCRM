/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Request tracing with trace/span propagation through the entire call chain.
 * Integrates with the structured logger for query-level trace correlation.
 */

import type { AppLogger } from '../logger.js';
import { generateTraceId, runWithTrace } from '../db/connection.js';

export interface TraceInfo {
  traceId: string;
  spanId: string;
}

export function createSpan(parentTraceId: string, name: string): TraceInfo {
  return {
    traceId: parentTraceId,
    spanId: `${name}-${Math.random().toString(36).substring(2, 10)}`,
  };
}

/** Log a database query with trace context for correlation */
export function logQuery(info: { traceId: string; spanId: string; operation: string; sql: string }): void {
  // Structured log line that log aggregation tools can parse
  // Format: [trace:<traceId>][span:<spanId>] db.<operation> <sql>
  process.stdout.write(
    JSON.stringify({
      level: 'debug',
      trace_id: info.traceId,
      span_id: info.spanId,
      db_operation: info.operation,
      db_statement: info.sql.substring(0, 500),
      msg: `db.${info.operation}`,
      time: new Date().toISOString(),
    }) + '\n',
  );
}

/**
 * Express middleware that extracts or creates a trace ID from x-request-id
 * and propagates it through the AsyncLocalStorage context.
 */
export function traceMiddleware(logger: AppLogger) {
  return (req: any, _res: any, next: () => void) => {
    const traceId = (req.headers['x-trace-id'] as string)
      || (req.headers['x-request-id'] as string)
      || generateTraceId();

    const spanId = `http-${Math.random().toString(36).substring(2, 10)}`;

    // Store on request for access in route handlers
    req.traceId = traceId;
    req.spanId = spanId;

    // Set x-trace-id response header so callers can correlate
    _res.setHeader('x-trace-id', traceId);

    runWithTrace({ traceId, spanId }, () => {
      const start = Date.now();
      _res.on('finish', () => {
        logger.debug({
          trace_id: traceId,
          span_id: spanId,
          method: req.method,
          path: req.path,
          status: _res.statusCode,
          duration_ms: Date.now() - start,
        }, 'request completed');
      });
      next();
    });
  };
}
