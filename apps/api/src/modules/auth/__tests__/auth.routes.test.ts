// ─────────────────────────────────────────────────────────────
// Auth Routes — Integration Tests
// Uses supertest with mocked service layer and mocked auth middleware.
// Tests cover all 8 auth endpoints.
// ─────────────────────────────────────────────────────────────

import { describe, it, expect, vi, beforeEach } from 'vitest';
import express, { type Request, type Response, type NextFunction } from 'express';
import supertest from 'supertest';
import {
  UnauthorizedError,
  ConflictError,
  NotFoundError,
  AppError,
} from '../../../shared/errors/app-error.js';

// ─── Mock auth middleware (BEFORE importing routes) ─────────

vi.mock('../../../shared/middleware/auth.middleware.js', () => ({
  authenticate: (req: Request, _res: Response, next: NextFunction) => {
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
  },
  authorize: (...allowedRoles: string[]) => {
    return async (req: Request, _res: Response, next: NextFunction) => {
      if (!req.user) {
        next();
        return;
      }
      if (allowedRoles.includes(req.user.role)) {
        next();
      } else {
        const { ForbiddenError } = await import('../../../shared/errors/app-error.js');
        next(new ForbiddenError('Insufficient permissions'));
      }
    };
  },
}));

// Mock rate limiter (pass-through)
vi.mock('../../../shared/middleware/rate-limit.middleware.js', () => ({
  rateLimiter: () => {
    return (_req: Request, _res: Response, next: NextFunction) => {
      next();
    };
  },
}));

// Mock logger
vi.mock('../../../shared/lib/logger.js', () => ({
  default: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
  createRequestLogger: vi.fn(),
}));

// Mock the service layer
vi.mock('../auth.service.js', () => ({}));

import * as authService from '../auth.service.js';
import authRoutes from '../auth.routes.js';
import { errorHandler } from '../../../shared/middleware/error.middleware.js';

// ─── Test app factory ──────────────────────────────────────

function createTestApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/v1', authRoutes);
  app.use(errorHandler);
  return app;
}

// ─── Test UUIDs ────────────────────────────────────────────

const VALID_USER_UUID = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';
const NONEXISTENT_UUID = 'f47ac10b-58cc-4372-a567-0e02b2c3d479';

// ─── Mock service implementations ──────────────────────────

const mockRegister = vi.fn();
const mockLogin = vi.fn();
const mockRefresh = vi.fn();
const mockLogout = vi.fn();
const mockForgotPassword = vi.fn();
const mockResetPassword = vi.fn();
const mockGetMe = vi.fn();
const mockUpdateProfile = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();

  vi.mocked(authService).register = mockRegister;
  vi.mocked(authService).login = mockLogin;
  vi.mocked(authService).refresh = mockRefresh;
  vi.mocked(authService).logout = mockLogout;
  vi.mocked(authService).forgotPassword = mockForgotPassword;
  vi.mocked(authService).resetPassword = mockResetPassword;
  vi.mocked(authService).getMe = mockGetMe;
  vi.mocked(authService).updateProfile = mockUpdateProfile;
});

// ─── Tests ─────────────────────────────────────────────────

describe('AuthRoutes', () => {
  // ─── POST /auth/register ─────────────────────────────────

  describe('POST /auth/register', () => {
    const validBody = {
      email: 'new@example.com',
      password: 'Password123!',
      firstName: 'New',
      lastName: 'User',
      role: 'STUDENT',
      phone: '+251911111111',
      agreeToTerms: true,
    };

    it('returns 201 with user and token pair on success', async () => {
      mockRegister.mockResolvedValue({
        user: {
          id: 'new-user-uuid',
          email: 'new@example.com',
          firstName: 'New',
          lastName: 'User',
          role: 'STUDENT',
          phone: '+251911111111',
          status: 'PENDING',
          isVerified: false,
          createdAt: expect.any(String),
        },
        token: {
          accessToken: 'access-token',
          refreshToken: 'refresh-token',
          expiresIn: 900,
        },
      });

      const app = createTestApp();
      const res = await supertest(app)
        .post('/api/v1/auth/register')
        .send(validBody);

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.user).toBeDefined();
      expect(res.body.data.token).toBeDefined();
      expect(res.body.data.token.accessToken).toBe('access-token');
    });

    it('returns 409 when email already exists', async () => {
      mockRegister.mockRejectedValue(new ConflictError('Email already registered'));

      const app = createTestApp();
      const res = await supertest(app)
        .post('/api/v1/auth/register')
        .send(validBody);

      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe('CONFLICT');
    });

    it('returns 400 when email is invalid', async () => {
      const app = createTestApp();
      const res = await supertest(app)
        .post('/api/v1/auth/register')
        .send({ ...validBody, email: 'not-an-email' });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('returns 400 when password is too short', async () => {
      const app = createTestApp();
      const res = await supertest(app)
        .post('/api/v1/auth/register')
        .send({ ...validBody, password: '123' });

      expect(res.status).toBe(400);
    });

    it('returns 400 when agreeToTerms is not true', async () => {
      const app = createTestApp();
      const res = await supertest(app)
        .post('/api/v1/auth/register')
        .send({ ...validBody, agreeToTerms: false });

      expect(res.status).toBe(400);
    });

    it('returns 400 when role is invalid', async () => {
      const app = createTestApp();
      const res = await supertest(app)
        .post('/api/v1/auth/register')
        .send({ ...validBody, role: 'INVALID_ROLE' });

      expect(res.status).toBe(400);
    });

    it('returns 400 when required fields are missing', async () => {
      const app = createTestApp();
      const res = await supertest(app)
        .post('/api/v1/auth/register')
        .send({});

      expect(res.status).toBe(400);
    });

    it('returns 400 when phone is invalid format', async () => {
      const app = createTestApp();
      const res = await supertest(app)
        .post('/api/v1/auth/register')
        .send({ ...validBody, phone: 'invalid-phone' });

      expect(res.status).toBe(400);
    });

    it('accepts registration without optional phone', async () => {
      mockRegister.mockResolvedValue({
        user: { id: 'uuid', email: 'new@example.com' },
        token: { accessToken: 'token', refreshToken: 'rtoken', expiresIn: 900 },
      });

      const { phone: _phone, ...bodyWithoutPhone } = validBody;
      const app = createTestApp();
      const res = await supertest(app)
        .post('/api/v1/auth/register')
        .send(bodyWithoutPhone);

      expect(res.status).toBe(201);
    });
  });

  // ─── POST /auth/login ────────────────────────────────────

  describe('POST /auth/login', () => {
    it('returns 200 with user and token on success', async () => {
      mockLogin.mockResolvedValue({
        user: {
          id: VALID_USER_UUID,
          email: 'test@example.com',
          firstName: 'Test',
          lastName: 'User',
          role: 'STUDENT',
        },
        token: {
          accessToken: 'access-token',
          refreshToken: 'refresh-token',
          expiresIn: 900,
        },
      });

      const app = createTestApp();
      const res = await supertest(app)
        .post('/api/v1/auth/login')
        .send({ email: 'test@example.com', password: 'Password123!' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.token).toBeDefined();
    });

    it('returns 401 for invalid credentials', async () => {
      mockLogin.mockRejectedValue(new UnauthorizedError('Invalid email or password'));

      const app = createTestApp();
      const res = await supertest(app)
        .post('/api/v1/auth/login')
        .send({ email: 'test@example.com', password: 'wrong' });

      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe('UNAUTHORIZED');
    });

    it('returns 400 when email is missing', async () => {
      const app = createTestApp();
      const res = await supertest(app)
        .post('/api/v1/auth/login')
        .send({ password: 'Password123!' });

      expect(res.status).toBe(400);
    });

    it('returns 400 when password is missing', async () => {
      const app = createTestApp();
      const res = await supertest(app)
        .post('/api/v1/auth/login')
        .send({ email: 'test@example.com' });

      expect(res.status).toBe(400);
    });

    it('returns 403 for suspended account', async () => {
      mockLogin.mockRejectedValue(
        new AppError('Account suspended', 403, 'ACCOUNT_SUSPENDED'),
      );

      const app = createTestApp();
      const res = await supertest(app)
        .post('/api/v1/auth/login')
        .send({ email: 'suspended@example.com', password: 'Password123!' });

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('ACCOUNT_SUSPENDED');
    });

    it('returns 403 for unverified account', async () => {
      mockLogin.mockRejectedValue(
        new AppError('Account not verified', 403, 'ACCOUNT_NOT_VERIFIED'),
      );

      const app = createTestApp();
      const res = await supertest(app)
        .post('/api/v1/auth/login')
        .send({ email: 'pending@example.com', password: 'Password123!' });

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('ACCOUNT_NOT_VERIFIED');
    });
  });

  // ─── POST /auth/refresh ──────────────────────────────────

  describe('POST /auth/refresh', () => {
    it('returns 200 with new token pair', async () => {
      mockRefresh.mockResolvedValue({
        accessToken: 'new-access-token',
        refreshToken: 'new-refresh-token',
        expiresIn: 900,
      });

      const app = createTestApp();
      const res = await supertest(app)
        .post('/api/v1/auth/refresh')
        .send({ refreshToken: 'valid-refresh-token' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.accessToken).toBe('new-access-token');
    });

    it('returns 401 when refresh token is invalid', async () => {
      mockRefresh.mockRejectedValue(new UnauthorizedError('Invalid refresh token'));

      const app = createTestApp();
      const res = await supertest(app)
        .post('/api/v1/auth/refresh')
        .send({ refreshToken: 'invalid-token' });

      expect(res.status).toBe(401);
    });

    it('returns 400 when refreshToken is missing', async () => {
      const app = createTestApp();
      const res = await supertest(app)
        .post('/api/v1/auth/refresh')
        .send({});

      expect(res.status).toBe(400);
    });

    it('returns 400 when refreshToken is empty string', async () => {
      const app = createTestApp();
      const res = await supertest(app)
        .post('/api/v1/auth/refresh')
        .send({ refreshToken: '' });

      expect(res.status).toBe(400);
    });
  });

  // ─── POST /auth/logout ───────────────────────────────────

  describe('POST /auth/logout', () => {
    it('returns 200 when logged out successfully', async () => {
      mockLogout.mockResolvedValue({ message: 'Logged out successfully' });

      const app = createTestApp();
      const res = await supertest(app)
        .post('/api/v1/auth/logout')
        .set('x-user-id', VALID_USER_UUID)
        .set('x-user-role', 'STUDENT')
        .send({ refreshToken: 'some-token' });

      expect(res.status).toBe(200);
      expect(res.body.data.message).toBe('Logged out successfully');
    });

    it('returns 401 without auth token', async () => {
      const app = createTestApp();
      const res = await supertest(app)
        .post('/api/v1/auth/logout')
        .send({ refreshToken: 'some-token' });

      expect(res.status).toBe(401);
    });

    it('accepts logout without refreshToken body', async () => {
      mockLogout.mockResolvedValue({ message: 'Logged out successfully' });

      const app = createTestApp();
      const res = await supertest(app)
        .post('/api/v1/auth/logout')
        .set('x-user-id', VALID_USER_UUID)
        .set('x-user-role', 'STUDENT')
        .send({});

      expect(res.status).toBe(200);
      expect(mockLogout).toHaveBeenCalledWith(VALID_USER_UUID, undefined);
    });
  });

  // ─── POST /auth/forgot-password ──────────────────────────

  describe('POST /auth/forgot-password', () => {
    it('returns 200 with generic message', async () => {
      mockForgotPassword.mockResolvedValue({
        message: 'If the email exists, a reset link has been sent',
      });

      const app = createTestApp();
      const res = await supertest(app)
        .post('/api/v1/auth/forgot-password')
        .send({ email: 'test@example.com' });

      expect(res.status).toBe(200);
      expect(res.body.data.message).toBe('If the email exists, a reset link has been sent');
    });

    it('returns 400 when email is invalid', async () => {
      const app = createTestApp();
      const res = await supertest(app)
        .post('/api/v1/auth/forgot-password')
        .send({ email: 'not-an-email' });

      expect(res.status).toBe(400);
    });

    it('returns 400 when email is missing', async () => {
      const app = createTestApp();
      const res = await supertest(app)
        .post('/api/v1/auth/forgot-password')
        .send({});

      expect(res.status).toBe(400);
    });

    it('always returns 200 regardless of whether email exists', async () => {
      mockForgotPassword.mockResolvedValue({
        message: 'If the email exists, a reset link has been sent',
      });

      const app = createTestApp();
      const res = await supertest(app)
        .post('/api/v1/auth/forgot-password')
        .send({ email: 'nonexistent@example.com' });

      expect(res.status).toBe(200);
    });
  });

  // ─── POST /auth/reset-password ───────────────────────────

  describe('POST /auth/reset-password', () => {
    it('returns 200 when password reset succeeds', async () => {
      mockResetPassword.mockResolvedValue({ message: 'Password reset successfully' });

      const app = createTestApp();
      const res = await supertest(app)
        .post('/api/v1/auth/reset-password')
        .send({ token: 'valid-token', newPassword: 'NewPassword123!' });

      expect(res.status).toBe(200);
      expect(res.body.data.message).toBe('Password reset successfully');
    });

    it('returns 401 when token is invalid', async () => {
      mockResetPassword.mockRejectedValue(new UnauthorizedError('Invalid or expired reset token'));

      const app = createTestApp();
      const res = await supertest(app)
        .post('/api/v1/auth/reset-password')
        .send({ token: 'bad-token', newPassword: 'NewPassword123!' });

      expect(res.status).toBe(401);
    });

    it('returns 400 when token is missing', async () => {
      const app = createTestApp();
      const res = await supertest(app)
        .post('/api/v1/auth/reset-password')
        .send({ newPassword: 'NewPassword123!' });

      expect(res.status).toBe(400);
    });

    it('returns 400 when new password is too short', async () => {
      const app = createTestApp();
      const res = await supertest(app)
        .post('/api/v1/auth/reset-password')
        .send({ token: 'token', newPassword: '123' });

      expect(res.status).toBe(400);
    });

    it('returns 400 when new password exceeds 128 chars', async () => {
      const app = createTestApp();
      const res = await supertest(app)
        .post('/api/v1/auth/reset-password')
        .send({ token: 'token', newPassword: 'x'.repeat(129) });

      expect(res.status).toBe(400);
    });
  });

  // ─── GET /auth/me ────────────────────────────────────────

  describe('GET /auth/me', () => {
    it('returns 200 with user profile', async () => {
      mockGetMe.mockResolvedValue({
        id: VALID_USER_UUID,
        email: 'test@example.com',
        firstName: 'Test',
        lastName: 'User',
        role: 'STUDENT',
        phone: '+251911111111',
        status: 'ACTIVE',
        isVerified: true,
        createdAt: '2025-01-01T00:00:00.000Z',
        updatedAt: '2025-01-15T00:00:00.000Z',
        lastLoginAt: '2025-02-01T00:00:00.000Z',
      });

      const app = createTestApp();
      const res = await supertest(app)
        .get('/api/v1/auth/me')
        .set('x-user-id', VALID_USER_UUID)
        .set('x-user-role', 'STUDENT');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.email).toBe('test@example.com');
    });

    it('returns 401 without auth token', async () => {
      const app = createTestApp();
      const res = await supertest(app).get('/api/v1/auth/me');

      expect(res.status).toBe(401);
    });

    it('returns 404 when user profile not found', async () => {
      mockGetMe.mockRejectedValue(new NotFoundError('User not found'));

      const app = createTestApp();
      const res = await supertest(app)
        .get('/api/v1/auth/me')
        .set('x-user-id', NONEXISTENT_UUID)
        .set('x-user-role', 'STUDENT');

      expect(res.status).toBe(404);
    });
  });

  // ─── PATCH /auth/me ──────────────────────────────────────

  describe('PATCH /auth/me', () => {
    it('returns 200 when profile is updated', async () => {
      mockUpdateProfile.mockResolvedValue({
        id: VALID_USER_UUID,
        email: 'test@example.com',
        firstName: 'Updated',
        lastName: 'Name',
        role: 'STUDENT',
        phone: '+251922222222',
        status: 'ACTIVE',
        isVerified: true,
        createdAt: '2025-01-01T00:00:00.000Z',
        updatedAt: '2025-01-15T00:00:00.000Z',
      });

      const app = createTestApp();
      const res = await supertest(app)
        .patch('/api/v1/auth/me')
        .set('x-user-id', VALID_USER_UUID)
        .set('x-user-role', 'STUDENT')
        .send({
          firstName: 'Updated',
          lastName: 'Name',
          phone: '+251922222222',
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.firstName).toBe('Updated');
    });

    it('returns 401 without auth token', async () => {
      const app = createTestApp();
      const res = await supertest(app)
        .patch('/api/v1/auth/me')
        .send({ firstName: 'Updated' });

      expect(res.status).toBe(401);
    });

    it('returns 400 with invalid phone number', async () => {
      const app = createTestApp();
      const res = await supertest(app)
        .patch('/api/v1/auth/me')
        .set('x-user-id', VALID_USER_UUID)
        .set('x-user-role', 'STUDENT')
        .send({ phone: 'not-a-phone' });

      expect(res.status).toBe(400);
    });

    it('returns 400 with empty first name', async () => {
      const app = createTestApp();
      const res = await supertest(app)
        .patch('/api/v1/auth/me')
        .set('x-user-id', VALID_USER_UUID)
        .set('x-user-role', 'STUDENT')
        .send({ firstName: '' });

      expect(res.status).toBe(400);
    });

    it('returns 400 with first name exceeding 100 chars', async () => {
      const app = createTestApp();
      const res = await supertest(app)
        .patch('/api/v1/auth/me')
        .set('x-user-id', VALID_USER_UUID)
        .set('x-user-role', 'STUDENT')
        .send({ firstName: 'x'.repeat(101) });

      expect(res.status).toBe(400);
    });

    it('returns 200 when updating only a subset of fields', async () => {
      mockUpdateProfile.mockResolvedValue({
        id: VALID_USER_UUID,
        email: 'test@example.com',
        firstName: 'OnlyFirst',
        lastName: 'User',
        role: 'STUDENT',
        phone: '+251911111111',
        status: 'ACTIVE',
        isVerified: true,
      });

      const app = createTestApp();
      const res = await supertest(app)
        .patch('/api/v1/auth/me')
        .set('x-user-id', VALID_USER_UUID)
        .set('x-user-role', 'STUDENT')
        .send({ firstName: 'OnlyFirst' });

      expect(res.status).toBe(200);
      expect(mockUpdateProfile).toHaveBeenCalledWith(VALID_USER_UUID, { firstName: 'OnlyFirst' });
    });

    it('returns 200 when sending empty body', async () => {
      mockUpdateProfile.mockResolvedValue({
        id: VALID_USER_UUID,
        email: 'test@example.com',
        firstName: 'Test',
        lastName: 'User',
        role: 'STUDENT',
        phone: '+251911111111',
        status: 'ACTIVE',
        isVerified: true,
      });

      const app = createTestApp();
      const res = await supertest(app)
        .patch('/api/v1/auth/me')
        .set('x-user-id', VALID_USER_UUID)
        .set('x-user-role', 'STUDENT')
        .send({});

      expect(res.status).toBe(200);
    });

    it('returns 404 when user not found', async () => {
      mockUpdateProfile.mockRejectedValue(new NotFoundError('User not found'));

      const app = createTestApp();
      const res = await supertest(app)
        .patch('/api/v1/auth/me')
        .set('x-user-id', NONEXISTENT_UUID)
        .set('x-user-role', 'STUDENT')
        .send({ firstName: 'Test' });

      expect(res.status).toBe(404);
    });
  });
});
