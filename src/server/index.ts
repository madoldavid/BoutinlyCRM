import { loadConfig } from './config.js';
import { createApp } from './app.js';
import { createLogger } from './logger.js';
import { EmailService } from './email/service.js';
import { createFileService } from './storage/service.js';
import { AccountLockoutService } from './security/lockout.js';
import { KeyManager } from './security/jwks.js';
import { InMemoryTokenBlocklist } from './security/tokenBlocklist.js';
import { setAuthDeps } from './security/rbac.js';
import { InMemoryCrmRepository, type CrmRepository } from './repositories/crmRepository.js';
import { PostgresCrmRepository } from './repositories/postgresRepository.js';
import { setDbConfig, closePool } from './db/connection.js';
import { MigrationRunner } from './db/migrate.js';

const config = loadConfig();
const logger = createLogger(config.NODE_ENV);

let repository: CrmRepository;

if (config.DATABASE_URL) {
  setDbConfig({ databaseUrl: config.DATABASE_URL, databaseSsl: config.DATABASE_SSL, databaseSslRejectUnauthorized: config.DATABASE_SSL_REJECT_UNAUTHORIZED });

  const migrationRunner = new MigrationRunner();
  await migrationRunner.run();

  repository = new PostgresCrmRepository();
  logger.info('Using PostgreSQL repository');
} else {
  repository = new InMemoryCrmRepository(config.PASSWORD_PEPPER);
  logger.info('No DATABASE_URL set, using in-memory repository');
}

const emailService = new EmailService({
  provider: config.EMAIL_PROVIDER,
  from: config.EMAIL_FROM,
  fromName: config.EMAIL_FROM_NAME,
  appUrl: config.APP_URL,
  smtp: config.SMTP_HOST ? {
    host: config.SMTP_HOST,
    port: config.SMTP_PORT || 587,
    secure: config.SMTP_SECURE,
    user: config.SMTP_USER || '',
    pass: config.SMTP_PASS || '',
  } : undefined,
  ses: config.SES_ACCESS_KEY_ID ? {
    region: config.SES_REGION,
    accessKeyId: config.SES_ACCESS_KEY_ID,
    secretAccessKey: config.SES_SECRET_ACCESS_KEY || '',
  } : undefined,
}, logger);

await emailService.initialize();

const fileService = createFileService({
  provider: process.env.STORAGE_PROVIDER === 's3' ? 's3' : 'local',
  localPath: process.env.STORAGE_LOCAL_PATH,
  s3Region: process.env.S3_REGION,
  s3Bucket: process.env.S3_BUCKET,
  s3AccessKeyId: process.env.S3_ACCESS_KEY_ID,
  s3SecretAccessKey: process.env.S3_SECRET_ACCESS_KEY,
}, logger);

const lockoutService = new AccountLockoutService(logger);
const keyManager = new KeyManager(config.JWT_SECRET);
const tokenBlocklist = new InMemoryTokenBlocklist();

// Wire auth dependencies globally so authenticate() can check key versions and blocklist
setAuthDeps(keyManager, tokenBlocklist);

const app = createApp({ config, logger, repository, emailService, fileService, lockoutService, keyManager, tokenBlocklist });

const server = app.listen(config.PORT, () => {
  logger.info({ port: config.PORT }, 'Boutinly CRM API listening');
});

// Graceful shutdown
function shutdown(signal: string) {
  logger.info({ signal }, 'Shutting down...');
  server.close(async () => {
    try {
      await closePool();
    } catch (err) {
      logger.error({ err }, 'Error closing database pool');
    }
    process.exit(0);
  });
  // Force exit after 10s
  setTimeout(() => process.exit(1), 10_000).unref();
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
