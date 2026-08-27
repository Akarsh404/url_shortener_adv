import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { AppError, ErrorCode } from '../utils/errors';
import { logger } from '../config/logger';

interface ErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
  timestamp: string;
  path: string;
  requestId?: string;
}

function formatErrorResponse(
  req: Request,
  code: string,
  message: string,
  details?: unknown,
): ErrorResponse {
  return {
    success: false,
    error: {
      code,
      message,
      ...(details ? { details } : {}),
    },
    timestamp: new Date().toISOString(),
    path: req.originalUrl,
    requestId: String(req.id),
  };
}

export function errorMiddleware(
  err: Error,
  req: Request,
  res: Response,
  _next: NextFunction,
): void {
  // Zod validation errors
  if (err instanceof ZodError) {
    const details = err.issues.map((e) => ({
      field: e.path.join('.'),
      message: e.message,
    }));

    res.status(400).json(
      formatErrorResponse(req, ErrorCode.VALIDATION_ERROR, 'Validation failed', details),
    );
    return;
  }

  // Application errors
  if (err instanceof AppError) {
    if (!err.isOperational) {
      logger.error({ err, requestId: req.id }, 'Non-operational error occurred');
    }

    res.status(err.statusCode).json(
      formatErrorResponse(req, err.code, err.message, err.details),
    );
    return;
  }

  // Unexpected errors — do not expose internal details
  logger.error({ err, requestId: req.id }, 'Unexpected error occurred');

  res.status(500).json(
    formatErrorResponse(req, ErrorCode.INTERNAL_ERROR, 'An unexpected error occurred'),
  );
}

/**
 * Handle 404 for unmatched routes.
 */
export function notFoundMiddleware(req: Request, _res: Response, next: NextFunction): void {
  const err = new AppError(
    `Route ${req.method} ${req.originalUrl} not found`,
    404,
    ErrorCode.NOT_FOUND,
  );
  next(err);
}
