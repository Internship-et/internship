// ─────────────────────────────────────────────────────────────
// Auth Middleware — Unit Tests
// Tests authenticate (JWT verification + user status check)
// and authorize (role-based access control) middleware.
// ─────────────────────────────────────────────────────────────

import { describe, it, expect, vi, beforeEach } from 'vitest';
import express, { type Request, type Response } from 'express';
import supertest from 'supertest';

// Mock the token utilities (use vi.hoisted to avoid hoisting issues)
const mockVerifyToken = vi.hoisted(() => vi.fn());
vi.mock('../../utils/token.js', () => ({
  verifyToken: mockVerifyToken,
}));

// Mock the auth repository (use vi.hoisted to avoid hoisting issues)
const mockFindById = vi.hoisted(() => vi.fn());
vi.mock('../../../modules/auth/auth.repository.js', () => ({
  findById: mockFindById,
}));

// Mock logger
vi.mock('../../lib/logger.js', () => ({
  default: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
  createRequestLogger: vi.fn(),
}));

import { authenticate, authorize } from '../auth.middleware.js';
import { errorHandler } from '../error.middleware.js';

describe('AuthMiddleware', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('authenticate', () => {
    function createTestApp(wireAuthenticate: boolean = true) {
      const app = express();
      if (wireAuthenticate) {
        app.use('/protected', authenticate);
      }
      app.get('/protected', (_req: Request, res: Response) => {
        res.status(200).json({ success: true, user: _req.user });
      });
      app.get('/public', (_req: Request, res: Response) => {
        res.status(200).json({ success: true });
      });
      app.use(errorHandler);
      return app;
    }

    it('returns 401 when no Authorization header is present', async () => {
      const app = createTestApp();
      const res = await supertest(app).get('/protected');

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('UNAUTHORIZED');
    });

    it('returns 401 when Authorization header is not Bearer', async () => {
      const app = createTestApp();
      const res = await supertest(app)
        .get('/protected')
        .set('Authorization', 'Basic token123');

      expect(res.status).toBe(401);
    });

    it('returns 401 when token is invalid', async () => {
      mockVerifyToken.mockImplementation(() => {
        throw new Error('Invalid token');
      });

      const app = createTestApp();
      const res = await supertest(app)
        .get('/protected')
        .set('Authorization', 'Bearer invalid-token');

      expect(res.status).toBe(401);
    });

    it('returns 401 when token is expired', async () => {
      const { UnauthorizedError } = await import('../../errors/app-error.js');
      const tokenExpiredError = new Error('Token expired');
      tokenExpiredError.name = 'TokenExpiredError';
      mockVerifyToken.mockImplementation(() => {
        throw new UnauthorizedError('Token expired');
      });

      const app = createTestApp();
      const res = await supertest(app)
        .get('/protected')
        .set('Authorization', 'Bearer expired-token');

      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe('UNAUTHORIZED');
    });

    it('returns 401 when user is not found', async () => {
      mockVerifyToken.mockReturnValue({
        userId: 'user-uuid-1',
        role: 'STUDENT',
        email: 'test@example.com',
      });
      mockFindById.mockResolvedValue(null);

      const app = createTestApp();
      const res = await supertest(app)
        .get('/protected')
        .set('Authorization', 'Bearer valid-token');

      expect(res.status).toBe(401);
    });

    it('returns 401 when user account is not ACTIVE', async () => {
      mockVerifyToken.mockReturnValue({
        userId: 'user-uuid-1',
        role: 'STUDENT',
        email: 'test@example.com',
      });
      mockFindById.mockResolvedValue({
        id: 'user-uuid-1',
        role: 'STUDENT',
        email: 'test@example.com',
        status: 'SUSPENDED',
      });

      const app = createTestApp();
      const res = await supertest(app)
        .get('/protected')
        .set('Authorization', 'Bearer valid-token');

      expect(res.status).toBe(401);
      expect(res.body.error.message).toBe('Account is not active');
    });

    it('returns 401 when user account is PENDING', async () => {
      mockVerifyToken.mockReturnValue({
        userId: 'user-uuid-1',
        role: 'STUDENT',
        email: 'test@example.com',
      });
      mockFindById.mockResolvedValue({
        id: 'user-uuid-1',
        role: 'STUDENT',
        email: 'test@example.com',
        status: 'PENDING',
      });

      const app = createTestApp();
      const res = await supertest(app)
        .get('/protected')
        .set('Authorization', 'Bearer valid-token');

      expect(res.status).toBe(401);
      expect(res.body.error.message).toBe('Account is not active');
    });

    it('populates req.user when authentication succeeds', async () => {
      mockVerifyToken.mockReturnValue({
        userId: 'user-uuid-1',
        role: 'STUDENT',
        email: 'test@example.com',
      });
      mockFindById.mockResolvedValue({
        id: 'user-uuid-1',
        role: 'STUDENT',
        email: 'test@example.com',
        status: 'ACTIVE',
      });

      const app = createTestApp();
      const res = await supertest(app)
        .get('/protected')
        .set('Authorization', 'Bearer valid-token');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.user).toEqual({
        id: 'user-uuid-1',
        role: 'STUDENT',
        email: 'test@example.com',
      });
    });

    it('allows public routes without authentication', async () => {
      const app = createTestApp();
      const res = await supertest(app).get('/public');

      expect(res.status).toBe(200);
    });

    it('returns 401 for malformed Bearer token', async () => {
      const app = createTestApp();
      const res = await supertest(app)
        .get('/protected')
        .set('Authorization', 'Bearer'); // No token after "Bearer "

      expect(res.status).toBe(401);
    });
  });

  describe('authorize', () => {
    function createAuthorizedTestApp(...allowedRoles: string[]) {
      const app = express();
      app.get('/admin', authenticate, authorize(...allowedRoles), (_req: Request, res: Response) => {
        res.status(200).json({ success: true });
      });
      app.use(errorHandler);
      return app;
    }

    beforeEach(() => {
      // Make authenticate always succeed
      mockVerifyToken.mockReturnValue({
        userId: 'admin-uuid',
        role: 'ADMIN',
        email: 'admin@example.com',
      });
      mockFindById.mockResolvedValue({
        id: 'admin-uuid',
        role: 'ADMIN',
        email: 'admin@example.com',
        status: 'ACTIVE',
      });
    });

    it('allows access for matching role', async () => {
      const app = createAuthorizedTestApp('ADMIN');
      const res = await supertest(app)
        .get('/admin')
        .set('Authorization', 'Bearer admin-token');

      expect(res.status).toBe(200);
    });

    it('allows access when user role is in allowed list', async () => {
      mockVerifyToken.mockReturnValue({
        userId: 'company-uuid',
        role: 'COMPANY',
        email: 'company@example.com',
      });
      mockFindById.mockResolvedValue({
        id: 'company-uuid',
        role: 'COMPANY',
        email: 'company@example.com',
        status: 'ACTIVE',
      });

      const app = createAuthorizedTestApp('COMPANY', 'ADMIN');
      const res = await supertest(app)
        .get('/admin')
        .set('Authorization', 'Bearer company-token');

      expect(res.status).toBe(200);
    });

    it('returns 403 for non-matching role', async () => {
      mockVerifyToken.mockReturnValue({
        userId: 'student-uuid',
        role: 'STUDENT',
        email: 'student@example.com',
      });
      mockFindById.mockResolvedValue({
        id: 'student-uuid',
        role: 'STUDENT',
        email: 'student@example.com',
        status: 'ACTIVE',
      });

      const app = createAuthorizedTestApp('ADMIN');
      const res = await supertest(app)
        .get('/admin')
        .set('Authorization', 'Bearer student-token');

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('FORBIDDEN');
    });

    it('returns 403 when req.user is not set', async () => {
      // Simulate no authenticate middleware
      const app = express();
      app.get('/admin', authorize('ADMIN'), (_req: Request, res: Response) => {
        res.status(200).json({ success: true });
      });
      app.use(errorHandler);

      const res = await supertest(app)
        .get('/admin')
        .set('Authorization', 'Bearer some-token');

      expect(res.status).toBe(403);
    });

    it('accepts multiple allowed roles', async () => {
      mockVerifyToken.mockReturnValue({
        userId: 'school-uuid',
        role: 'SCHOOL',
        email: 'school@example.com',
      });
      mockFindById.mockResolvedValue({
        id: 'school-uuid',
        role: 'SCHOOL',
        email: 'school@example.com',
        status: 'ACTIVE',
      });

      const app = createAuthorizedTestApp('SCHOOL', 'ADMIN');
      const res = await supertest(app)
        .get('/admin')
        .set('Authorization', 'Bearer school-token');

      expect(res.status).toBe(200);
    });
  });
});
