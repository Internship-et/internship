// ─────────────────────────────────────────────────────────────
// Global Error Handler & 404 Middleware
// Catches all errors, formats them consistently, and returns
// the standard error response envelope.
// ─────────────────────────────────────────────────────────────

import { type Request, type Response, type NextFunction } from 'express';
import { AppError, NotFoundError } from '../errors/app-error.js';
import logger from '../lib/logger.js';

/**
 * 404 handler — catches all unmatched routes.
 * Must be registered after all routes.
 */
export function notFoundHandler(
  req: Request,
  _res: Response,
  next: NextFunction,
): void {
  next(new NotFoundError(`Route not found: ${req.method} ${req.originalUrl}`));
}

/**
 * Global error handler — must have 4 parameters for Express to recognize it
 * as an error-handling middleware.
 */
export function errorHandler(
  err: Error,
  req: Request,
  res: Response,
  _next: NextFunction,
): void {
  const requestId = req.id || 'unknown';

  if (err instanceof AppError) {
    // Log at warn level for client errors (4xx), error for server errors (5xx)
    if (err.statusCode >= 500) {
      logger.error({ err, requestId }, err.message);
    } else {
      logger.warn({ err, requestId }, err.message);
    }

    res.status(err.statusCode).json({
      success: false,
      error: {
        ...err.toJSON(),
        requestId,
      },
    });
    return;
  }

  // Unknown / unexpected errors
  logger.error({ err, requestId }, 'Unhandled error');

  res.status(500).json({
    success: false,
    error: {
      code: 'INTERNAL_ERROR',
      message: 'An unexpected error occurred',
      requestId,
    },
  });
}
