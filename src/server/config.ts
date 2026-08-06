import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

// Zod 4 compat: coerce.boolean() treats "false" string as truthy.
// Wrap with preprocess to handle string bools correctly.
const boolString = z.preprocess(
  (v) => (v === 'false' || v === '0' || v === 0 ? false : v === 'true' || v === '1' || v === 1 ? true : v),
  z.boolean(),
);

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(8080),
  APP_URL: z.string().url().default('http://localhost:3000'),
  API_URL: z.string().url().default('http://localhost:8080'),
  JWT_SECRET: z.string().min(32).default('development-only-secret-change-before-prod'),
  PASSWORD_PEPPER: z.string().min(16).default('development-password-pepper'),
  DATABASE_URL: z.string().optional(),
  DATABASE_SSL: boolString.default(true),
  DATABASE_SSL_REJECT_UNAUTHORIZED: boolString.default(true),
  ALLOWED_ORIGINS: z.string().default('http://localhost:3000,http://localhost:3001,http://localhost:3002'),
  DEMO_LOGIN_ENABLED: z.coerce.boolean().default(true),
  DEMO_PASSWORD: z.string().min(8).default('ChangeMe123!'),
  EMAIL_PROVIDER: z.enum(['smtp', 'ses', 'console']).default('console'),
  EMAIL_FROM: z.string().default('noreply@boutinly.com'),
  EMAIL_FROM_NAME: z.string().default('Boutinly CRM'),
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.coerce.number().int().positive().optional(),
  SMTP_SECURE: z.coerce.boolean().default(true),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),
  SES_REGION: z.string().default('us-east-1'),
  SES_ACCESS_KEY_ID: z.string().optional(),
  SES_SECRET_ACCESS_KEY: z.string().optional(),
  // G-SEC-09: configurable account-lockout thresholds
  LOCKOUT_MAX_FAILURES: z.coerce.number().int().min(1).max(100).default(5),
  LOCKOUT_DURATION_MS: z.coerce.number().int().positive().default(15 * 60 * 1000),
  LOCKOUT_WINDOW_MS: z.coerce.number().int().positive().default(30 * 60 * 1000),
  // G-SEC-08 (subset): configurable password & session policy (defaults preserve current behavior)
  PASSWORD_MIN_LENGTH: z.coerce.number().int().min(8).max(32).default(8),
  PASSWORD_REQUIRE_COMPLEXITY: z.coerce.boolean().default(false),
  ACCESS_TOKEN_TTL_SECONDS: z.coerce.number().int().min(60).max(24 * 60 * 60).default(15 * 60),
  REFRESH_TOKEN_TTL_SECONDS: z.coerce.number().int().min(3600).default(7 * 24 * 60 * 60),
  // G-DAT-12: idempotency-key replay window
  IDEMPOTENCY_TTL_MS: z.coerce.number().int().positive().default(24 * 60 * 60 * 1000),
  // G-AI-14 / G-OPS-06: startup flag seed, e.g. "ai.deal_scoring=off,email.campaigns=on"
  FEATURE_FLAGS: z.string().optional(),
});

export type AppConfig = ReturnType<typeof loadConfig>;

export function loadConfig() {
  const config = envSchema.parse(process.env);

  if (config.NODE_ENV === 'production') {
    if (config.DEMO_LOGIN_ENABLED) {
      throw new Error('DEMO_LOGIN_ENABLED must be false in production.');
    }
    if (!config.DATABASE_URL) {
      throw new Error('DATABASE_URL is required in production.');
    }
    if (config.JWT_SECRET === 'development-only-secret-change-before-prod') {
      throw new Error('JWT_SECRET must be replaced in production.');
    }
    if (config.PASSWORD_PEPPER === 'development-password-pepper') {
      throw new Error('PASSWORD_PEPPER must be replaced in production.');
    }
    if (config.DATABASE_SSL === false) {
      throw new Error('DATABASE_SSL must be enabled in production.');
    }
  }

  return {
    ...config,
    allowedOrigins: config.ALLOWED_ORIGINS.split(',').map(origin => origin.trim()).filter(Boolean),
  };
}
