import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(8080),
  APP_URL: z.string().url().default('http://localhost:3000'),
  API_URL: z.string().url().default('http://localhost:8080'),
  JWT_SECRET: z.string().min(32).default('development-only-secret-change-before-prod'),
  PASSWORD_PEPPER: z.string().min(16).default('development-password-pepper'),
  DATABASE_URL: z.string().optional(),
  DATABASE_SSL: z.coerce.boolean().default(true),
  DATABASE_SSL_REJECT_UNAUTHORIZED: z.coerce.boolean().default(true),
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
