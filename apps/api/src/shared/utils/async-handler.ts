// ─────────────────────────────────────────────────────────────
// Async Handler
// Wraps async route handlers to catch errors and pass them to Express error middleware.
// ─────────────────────────────────────────────────────────────

import { type Request, type Response, type NextFunction, type RequestHandler } from 'express';

/**
 * Wraps an async route handler so that any rejected promises
 * are forwarded to the Express error-handling middleware.
 */
export const asyncHandler = (fn: RequestHandler): RequestHandler => {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

export default asyncHandler;
