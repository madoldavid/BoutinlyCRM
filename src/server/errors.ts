import type { ErrorRequestHandler, NextFunction, Request, Response } from 'express';
import { ZodError } from 'zod';
import type { AppLogger } from './logger.js';

export class ApiError extends Error {
  constructor(
    public statusCode: number,
    message: string,
    public code = 'api_error',
  ) {
    super(message);
  }
}

export function asyncHandler<TReq extends Request = Request>(
  handler: (req: TReq, res: Response, next: NextFunction) => Promise<unknown>,
) {
  return (req: TReq, res: Response, next: NextFunction) => {
    handler(req, res, next).catch(next);
  };
}

export const notFoundHandler = (_req: Request, _res: Response, next: NextFunction) => {
  next(new ApiError(404, 'Route not found.', 'not_found'));
};

export function createErrorHandler(logger: AppLogger): ErrorRequestHandler {
  return (err, _req, res, _next) => {
    if (err instanceof ZodError) {
      // Map Zod v4 error codes to user-friendly messages
      const issues = (err.issues ?? []) as unknown as Array<Record<string, unknown>>;
      const fieldMessages = issues.map((issue) => {
        const field = (issue.path as string[]).join('.') || '(root)';
        const code = issue.code as string;
        switch (code) {
          case 'too_small': {
            const min = issue.minimum ?? (issue as Record<string, unknown>).min;
            if ((issue as Record<string, unknown>).origin === 'string') {
              return min === 1 ? `"${field}" is required` : `"${field}" must have at least ${min} characters`;
            }
            return `"${field}" ${issue.message}`;
          }
          case 'invalid_format': {
            const fmt = (issue as Record<string, unknown>).format;
            if (fmt === 'url') return `"${field}" must be a valid URL`;
            if (fmt === 'email') return `"${field}" must be a valid email address`;
            return `"${field}" has an invalid format`;
          }
          case 'invalid_union':
            return `"${field}" contains an invalid value`;
          case 'invalid_type':
            return `"${field}" has an invalid type (${(issue as Record<string, unknown>).expected} expected)`;
          default:
            return `"${field}" ${issue.message}`;
        }
      });
      const detail = fieldMessages.length > 0 ? fieldMessages.join('; ') : 'Unknown validation issue.';
      res.status(400).json({
        error: {
          code: 'validation_error',
          message: detail,
          issues: err.issues,
        },
      });
      return;
    }

    if (err instanceof ApiError) {
      res.status(err.statusCode).json({
        error: {
          code: err.code,
          message: err.message,
        },
      });
      return;
    }

    // Log unexpected errors via structured logger for observability
    logger.error({ err }, 'Unhandled server error');

    res.status(500).json({
      error: {
        code: 'internal_error',
        message: process.env.NODE_ENV === 'production'
          ? 'Unexpected server error.'
          : err instanceof Error ? err.message : 'Unexpected server error.',
      },
    });
  };
}
