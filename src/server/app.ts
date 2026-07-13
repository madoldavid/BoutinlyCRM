import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import { pinoHttp } from 'pino-http';
import { randomUUID } from 'node:crypto';
import type { AppConfig } from './config.js';
import { runWithTenant } from './db/connection.js';
import type { EmailService } from './email/service.js';
import { ApiError, asyncHandler, errorHandler, notFoundHandler } from './errors.js';
import type { AppLogger } from './logger.js';
import type { CrmRepository } from './repositories/crmRepository.js';
import { scopeSnapshot } from './repositories/scope.js';
import { authenticate } from './security/rbac.js';
import type { AuthenticatedRequest } from './security/rbac.js';
import { authLimiter, bootstrapLimiter, globalLimiter } from './security/rateLimiter.js';
import { registerAccountsRoutes } from './routes/accounts.routes.js';
import { registerActivitiesRoutes } from './routes/activities.routes.js';
import { registerAdminRoutes } from './routes/admin.routes.js';
import { registerAuthRoutes } from './routes/auth.routes.js';
import { registerContactsRoutes } from './routes/contacts.routes.js';
import { registerDealsRoutes } from './routes/deals.routes.js';
import { registerEmailRoutes } from './routes/email.routes.js';
import { registerGdprRoutes } from './routes/gdpr.routes.js';
import { registerNotificationsRoutes } from './routes/notifications.routes.js';
import { registerTasksRoutes } from './routes/tasks.routes.js';

interface CreateAppOptions {
  config: AppConfig;
  logger: AppLogger;
  repository: CrmRepository;
  emailService: EmailService;
}

export function createApp({ config, logger, repository, emailService }: CreateAppOptions) {
  const app = express();

  app.disable('x-powered-by');
  app.use(helmet({
    contentSecurityPolicy: config.NODE_ENV === 'production' ? {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", 'data:', 'https:'],
        connectSrc: ["'self'"],
        fontSrc: ["'self'"],
        objectSrc: ["'none'"],
        frameAncestors: ["'none'"],
        formAction: ["'self'"],
      },
    } : false,
    strictTransportSecurity: {
      maxAge: 31536000,
      includeSubDomains: true,
      preload: true,
    },
    referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
  }));

  // Permissions-Policy header (not directly supported by helmet v8)
  app.use((_req, res, next) => {
    res.setHeader(
      'Permissions-Policy',
      'camera=(), microphone=(), geolocation=(), usb=(), payment=(self)',
    );
    next();
  });
  app.use(express.json({ limit: '1mb' }));

  // Verify JSON content-type on mutating requests (CSRF mitigation)
  app.use((req, _res, next) => {
    const mutationMethods = ['POST', 'PUT', 'PATCH', 'DELETE'];
    if (mutationMethods.includes(req.method) && req.headers['content-type']) {
      const ct = req.headers['content-type'];
      if (!ct.includes('application/json') && !ct.includes('multipart/form-data')) {
        throw new ApiError(415, 'Unsupported Content-Type. Use application/json.', 'invalid_content_type');
      }
    }
    next();
  });

  app.use(cors({
    origin(origin, callback) {
      if (!origin || config.allowedOrigins.includes(origin)) {
        callback(null, true);
        return;
      }
      callback(new ApiError(403, 'Origin is not allowed by CORS policy.', 'cors_forbidden'));
    },
    credentials: true,
  }));

  // Global rate limiter
  app.use(globalLimiter);
  app.use(pinoHttp({ logger }));

  // Request ID tracing
  app.use((req, _res, next) => {
    (req as any).requestId = req.header('x-request-id') || randomUUID();
    next();
  });

  const startTime = Date.now();

  // Liveness probe — lightweight, no DB dependency
  app.get('/api/health', (_req, res) => {
    res.json({
      status: 'ok',
      service: 'boutinly-crm-api',
      environment: config.NODE_ENV,
      time: new Date().toISOString(),
      uptime_seconds: Math.floor((Date.now() - startTime) / 1000),
    });
  });

  // Readiness probe — verifies DB connectivity
  app.get('/api/health/ready', async (_req, res) => {
    const health: Record<string, unknown> = {
      status: 'ok',
      service: 'boutinly-crm-api',
      environment: config.NODE_ENV,
      time: new Date().toISOString(),
      uptime_seconds: Math.floor((Date.now() - startTime) / 1000),
      db: 'not_configured',
    };

    if (config.DATABASE_URL) {
      try {
        const { getPool } = await import('./db/connection.js');
        const pool = getPool({ databaseUrl: config.DATABASE_URL, databaseSsl: config.DATABASE_SSL });
        await pool.query('SELECT 1');
        health.db = 'connected';
      } catch {
        health.db = 'disconnected';
        health.status = 'degraded';
      }
    }

    const mem = process.memoryUsage();
    health.memory_mb = Math.round(mem.heapUsed / 1024 / 1024);

    const statusCode = health.status === 'degraded' ? 503 : 200;
    res.status(statusCode).json(health);
  });

  // Tenant isolation — extract org from JWT and wrap downstream in runWithTenant
  // so every query() call sets app.organization_id for PostgreSQL RLS.
  // JWT verification is not done here — authenticate() handles that.
  app.use((req, _res, next) => {
    const raw = req.header('authorization');
    if (raw?.startsWith('Bearer ')) {
      try {
        const parts = raw.slice(7).split('.');
        if (parts.length === 3) {
          const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString());
          const orgId = payload.organizationId;
          if (orgId) {
            runWithTenant(orgId, () => next());
            return;
          }
        }
      } catch { /* fall through to unauthenticated path */ }
    }
    next();
  });

  // Bootstrap - returns full scoped CRM snapshot for initial app load
  app.get('/api/crm/bootstrap', bootstrapLimiter, authenticate(config), asyncHandler<AuthenticatedRequest>(async (req, res) => {
    const snapshot = await repository.snapshot();
    res.json(scopeSnapshot(snapshot, req.principal));
  }));

  // Apply auth rate limiter to all auth routes
  app.use('/api/auth', authLimiter);

  // Register all route modules
  registerAuthRoutes(app, config, repository, emailService);
  registerContactsRoutes(app, config, repository);
  registerAccountsRoutes(app, config, repository);
  registerDealsRoutes(app, config, repository);
  registerTasksRoutes(app, config, repository);
  registerActivitiesRoutes(app, config, repository);
  registerNotificationsRoutes(app, config, repository);
  registerEmailRoutes(app, config, repository, emailService);
  registerGdprRoutes(app, config, repository);
  registerAdminRoutes(app, config, repository);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
