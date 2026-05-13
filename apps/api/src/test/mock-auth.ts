// ─────────────────────────────────────────────────────────────
// Mock Auth Helpers for Route Tests
// Provides the standard authenticate/authorize mock functions
// used by all route integration test files.
// ─────────────────────────────────────────────────────────────

import { type Request, type Response, type NextFunction } from 'express';
import { UnauthorizedError, ForbiddenError } from '../shared/errors/app-error.js';

/**
 * Mock authenticate middleware for route tests.
 * Reads user identity from x-user-id and x-user-role headers.
 */
export function mockAuthenticate(
  req: Request,
  _res: Response,
  next: NextFunction,
): void {
  const userId = req.headers['x-user-id'] as string | undefined;
  const role = req.headers['x-user-role'] as string | undefined;

  if (userId) {
    req.user = {
      id: userId,
      role: role ?? 'STUDENT',
      email: `${userId}@example.com`,
    };
    next();
  } else {
    next(new UnauthorizedError('Authentication required'));
  }
}

/**
 * Mock authorize middleware factory for route tests.
 */
export function mockAuthorize(...allowedRoles: string[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      next();
      return;
    }
    if (allowedRoles.includes(req.user.role)) {
      next();
    } else {
      next(new ForbiddenError('Insufficient permissions'));
    }
  };
}
