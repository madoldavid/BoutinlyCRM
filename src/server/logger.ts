import pino from 'pino';

export function createLogger(environment = 'development') {
  return pino({
    level: environment === 'test' ? 'silent' : process.env.LOG_LEVEL || 'info',
    redact: {
      paths: [
        'req.headers.authorization',
        'password',
        '*.password',
        '*.token',
        '*.secret',
        '*.secretAccessKey',
        'SES_SECRET_ACCESS_KEY',
        'SMTP_PASS',
        'JWT_SECRET',
        'PASSWORD_PEPPER',
      ],
      censor: '[redacted]',
    },
  });
}

export type AppLogger = ReturnType<typeof createLogger>;
