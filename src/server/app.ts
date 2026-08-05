import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import { pinoHttp } from 'pino-http';
import { randomUUID } from 'node:crypto';
import type { AppConfig } from './config.js';
import type { EmailService } from './email/service.js';
import { ApiError, asyncHandler, createErrorHandler, notFoundHandler } from './errors.js';
import type { AppLogger } from './logger.js';
import { metricsMiddleware, metricsEndpoint } from './observability/metrics.js';
import { traceMiddleware } from './observability/tracing.js';
import type { FileService } from './storage/service.js';
import type { CrmRepository } from './repositories/crmRepository.js';
import { scopeSnapshot } from './repositories/scope.js';
import { authenticate } from './security/rbac.js';
import type { AuthenticatedRequest } from './security/rbac.js';
import { authLimiter, bootstrapLimiter, globalLimiter } from './security/rateLimiter.js';
import { csrfProtection, parseCookies } from './security/csrf.js';
import { idempotencyMiddleware } from './middleware/idempotency.js';
import type { KeyManager } from './security/jwks.js';
import type { AccountLockoutService } from './security/lockout.js';
import type { TokenBlocklist } from './security/tokenBlocklist.js';
import { setTrackingRepository } from './email/tracking.js';
import { registerAccountsRoutes } from './routes/accounts.routes.js';
import { registerActivitiesRoutes } from './routes/activities.routes.js';
import { registerAdminRoutes } from './routes/admin.routes.js';
import { registerAuthRoutes } from './routes/auth.routes.js';
import { registerCalendarRoutes } from './routes/calendar.routes.js';
import { registerContactsRoutes } from './routes/contacts.routes.js';
import { registerDealsRoutes } from './routes/deals.routes.js';
import { registerEmailRoutes } from './routes/email.routes.js';
import { registerFilesRoutes } from './routes/files.routes.js';
import { registerGdprRoutes } from './routes/gdpr.routes.js';
import { registerNotificationsRoutes } from './routes/notifications.routes.js';
import { registerOidcRoutes } from './routes/oidc.routes.js';
import { registerReportsRoutes } from './routes/reports.routes.js';
import { registerTasksRoutes } from './routes/tasks.routes.js';
import { registerFlagsRoutes } from './routes/flags.routes.js';
import { registerInsightsRoutes } from './routes/insights.routes.js';
import { registerPipelinesRoutes } from './routes/pipelines.routes.js';
import { FeatureFlagService } from './services/featureFlags.js';

interface CreateAppOptions {
  config: AppConfig;
  logger: AppLogger;
  repository: CrmRepository;
  emailService: EmailService;
  fileService: FileService;
  lockoutService: AccountLockoutService;
  keyManager: KeyManager;
  tokenBlocklist: TokenBlocklist;
  /** Optional injection (tests); defaults to an env-seeded instance. */
  featureFlags?: FeatureFlagService;
}

export function createApp({ config, logger, repository, emailService, fileService, lockoutService, keyManager, tokenBlocklist, featureFlags }: CreateAppOptions) {
  const flags = featureFlags ?? new FeatureFlagService(config.FEATURE_FLAGS);
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

  // Cookie parser (minimal — no dependency needed)
  app.use((req, _res, next) => {
    (req as any).cookies = parseCookies(req);
    next();
  });

  // CSRF protection (double-submit cookie pattern)
  app.use(csrfProtection());

  // Global rate limiter
  app.use(globalLimiter.middleware);
  app.use(pinoHttp({ logger }));

  // Request ID tracing
  app.use(traceMiddleware(logger));
  app.use(metricsMiddleware());

  app.use((req, _res, next) => {
    (req as any).requestId = req.header('x-request-id') || randomUUID();
    next();
  });

  const startTime = Date.now();

  // JWKS endpoint — public key discovery for token verification
  app.get('/.well-known/jwks.json', (_req, res) => {
    res.json(keyManager.getJwks());
  });

  // Prometheus metrics endpoint
  app.get('/metrics', (_req, res) => metricsEndpoint(_req, res));

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

  // Bootstrap - returns full scoped CRM snapshot for initial app load
  app.get('/api/crm/bootstrap', bootstrapLimiter.middleware, authenticate(config), asyncHandler<AuthenticatedRequest>(async (req, res) => {
    const snapshot = await repository.snapshot();
    res.json(scopeSnapshot(snapshot, req.principal));
  }));

  // Apply auth rate limiter to all auth routes
  app.use('/api/auth', authLimiter.middleware);

  // Idempotency-Key replay protection for POSTs that opt in (G-DAT-12)
  app.use(idempotencyMiddleware({ ttlMs: config.IDEMPOTENCY_TTL_MS }));

  // Wire repository into email tracking for write-through persistence
  setTrackingRepository(repository);

  // Register all route modules
  registerAuthRoutes(app, config, repository, emailService, lockoutService, keyManager, tokenBlocklist);
  registerOidcRoutes(app, config, repository, logger, keyManager);
  registerContactsRoutes(app, config, repository);
  registerAccountsRoutes(app, config, repository);
  registerDealsRoutes(app, config, repository);
  registerTasksRoutes(app, config, repository);
  registerActivitiesRoutes(app, config, repository);
  registerNotificationsRoutes(app, config, repository);
  registerReportsRoutes(app, config, repository);
  registerEmailRoutes(app, config, repository, emailService);
  registerFilesRoutes(app, config, repository, fileService);
  registerGdprRoutes(app, config, repository);
  registerAdminRoutes(app, config, repository);
  registerCalendarRoutes(app, config, repository, logger);
  registerFlagsRoutes(app, config, repository, flags);
  registerPipelinesRoutes(app, config, repository);
  registerInsightsRoutes(app, config, repository, flags);

  app.use(notFoundHandler);
  app.use(createErrorHandler(logger));

  return app;
}
