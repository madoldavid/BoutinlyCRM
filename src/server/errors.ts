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
      res.status(400).json({
        error: {
          code: 'validation_error',
          message: 'Request validation failed.',
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
