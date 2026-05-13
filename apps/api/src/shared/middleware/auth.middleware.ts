// ─────────────────────────────────────────────────────────────
// Auth Middleware
// Provides `authenticate` (JWT verification + user status check)
// and `authorize` (role-based access control) middleware.
// ─────────────────────────────────────────────────────────────

import { type Request, type Response, type NextFunction } from 'express';
import { verifyToken } from '../utils/token.js';
import { UnauthorizedError, ForbiddenError } from '../errors/app-error.js';
import { findById } from '../../modules/auth/auth.repository.js';

/**
 * Express middleware that authenticates a request by verifying
 * the `Authorization: Bearer <token>` header.
 *
 * On success, populates `req.user` with `{ id, role, email }`.
 * On failure, throws an appropriate `UnauthorizedError`.
 *
 * @param req - Express request object.
 * @param _res - Express response object (unused).
 * @param next - Express next function.
 *
 * @throws {UnauthorizedError} If the token is missing, expired, malformed,
 *                             or the user account is not active.
 */
export async function authenticate(
  req: Request,
  _res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new UnauthorizedError('Authentication required');
    }

    const token = authHeader.split(' ')[1]!;

    // Verify the JWT
    const payload = verifyToken(token);

    // Fetch user from database to check status
    const user = await findById(payload.userId);

    if (!user || user.status !== 'ACTIVE') {
      throw new UnauthorizedError('Account is not active');
    }

    // Attach user info to request
    req.user = {
      id: user.id,
      role: user.role,
      email: user.email,
    };

    next();
  } catch (error) {
    // Re-throw known AppError subclasses; wrap unknown errors
    if (error instanceof UnauthorizedError || error instanceof ForbiddenError) {
      next(error);
      return;
    }
    next(new UnauthorizedError('Invalid token'));
  }
}

/**
 * Express middleware factory that restricts access to specific roles.
 * Must be used after `authenticate` middleware.
 *
 * @param allowedRoles - One or more role names that are permitted.
 * @returns Express middleware that throws `ForbiddenError` if the user's role is not allowed.
 *
 * @example
 * ```ts
 * router.get('/admin/users', authenticate, authorize(['ADMIN']), handler);
 * router.patch('/internships/:id', authenticate, authorize(['COMPANY', 'ADMIN']), handler);
 * ```
 */
export function authorize(...allowedRoles: string[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user || !allowedRoles.includes(req.user.role)) {
      next(new ForbiddenError('Insufficient permissions'));
      return;
    }
    next();
  };
}
