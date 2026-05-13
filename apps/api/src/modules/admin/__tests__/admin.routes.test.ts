// ─────────────────────────────────────────────────────────────
// Admin Routes — Integration Tests
// Uses supertest with mocked service layer and mocked auth middleware.
// Tests cover:
//  - All five endpoints success for ADMIN
//  - 401 without auth
//  - 403 for non-ADMIN
//  - Query/body/param validation failures
//  - CSV response headers
//  - Invalid report type/format/date range
//  - Self-suspension propagated as 403
// ─────────────────────────────────────────────────────────────

import { describe, it, expect, vi, beforeEach } from 'vitest';
import express, { type Request, type Response, type NextFunction } from 'express';
import supertest from 'supertest';
import { UnauthorizedError, ForbiddenError, NotFoundError } from '../../../shared/errors/app-error.js';

// ─── Mock auth middleware (BEFORE importing routes) ─────────

vi.mock('../../../shared/middleware/auth.middleware.js', () => ({
  authenticate: (req: Request, _res: Response, next: NextFunction) => {
    const userId = req.headers['x-user-id'] as string | undefined;
    const role = req.headers['x-user-role'] as string | undefined;

    if (userId) {
      req.user = {
        id: userId,
        role: role ?? 'ADMIN',
        email: `${userId}@example.com`,
      };
      next();
    } else {
      next(new UnauthorizedError('Authentication required'));
    }
  },
  authorize: (...allowedRoles: string[]) => {
    return (req: Request, _res: Response, next: NextFunction) => {
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
  },
}));

// Mock the rate limiter (pass-through)
vi.mock('../../../shared/middleware/rate-limit.middleware.js', () => ({
  rateLimiter: () => {
    return (_req: Request, _res: Response, next: NextFunction) => {
      next();
    };
  },
}));

// Mock the service layer
vi.mock('../admin.service.js', () => ({}));

import * as adminService from '../admin.service.js';
import adminRoutes from '../admin.routes.js';
import { errorHandler } from '../../../shared/middleware/error.middleware.js';

// ─── Test app factory ──────────────────────────────────────

function createTestApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/v1', adminRoutes);
  app.use(errorHandler);
  return app;
}

// ─── Test UUIDs ────────────────────────────────────────────

const ADMIN_UUID = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';
const OTHER_USER_UUID = 'b2c3d4e5-f6a7-8901-bcde-f12345678901';
const NONEXISTENT_UUID = 'f47ac10b-58cc-4372-a567-0e02b2c3d479';

// ─── Mock service implementations ──────────────────────────

const mockGetDashboard = vi.fn();
const mockListUsers = vi.fn();
const mockUpdateUserStatus = vi.fn();
const mockListAuditLogs = vi.fn();
const mockGenerateReport = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();

  vi.mocked(adminService).getDashboard = mockGetDashboard;
  vi.mocked(adminService).listUsers = mockListUsers;
  vi.mocked(adminService).updateUserStatus = mockUpdateUserStatus;
  vi.mocked(adminService).listAuditLogs = mockListAuditLogs;
  vi.mocked(adminService).generateReport = mockGenerateReport;
});

// ─── Tests ─────────────────────────────────────────────────

describe('AdminRoutes', () => {
  // ─── GET /admin/dashboard ────────────────────────────────

  describe('GET /admin/dashboard', () => {
    it('returns 200 with dashboard data for ADMIN', async () => {
      mockGetDashboard.mockResolvedValue({
        overview: {
          totalUsers: 100,
          totalStudents: 50,
          totalCompanies: 30,
          totalSchools: 15,
          totalInternships: 80,
          totalApplications: 200,
          activeUsersToday: 25,
          activeUsersThisWeek: 60,
        },
        recentActivity: {
          newUsersToday: 5,
          newInternshipsToday: 3,
          newApplicationsToday: 10,
        },
        platformMetrics: {
          applicationsPerInternship: 2.5,
          fillRate: 0.65,
          averageTimeToHire: 14.5,
        },
        userGrowth: [
          { date: '2025-05-01', count: 5 },
          { date: '2025-05-02', count: 3 },
        ],
      });

      const app = createTestApp();
      const res = await supertest(app)
        .get('/api/v1/admin/dashboard')
        .set('x-user-id', ADMIN_UUID)
        .set('x-user-role', 'ADMIN');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.overview.totalUsers).toBe(100);
      expect(res.body.data.overview.activeUsersToday).toBe(25);
      expect(res.body.data.recentActivity.newUsersToday).toBe(5);
      expect(res.body.data.platformMetrics.applicationsPerInternship).toBe(2.5);
      expect(res.body.data.platformMetrics.fillRate).toBe(0.65);
      expect(res.body.data.userGrowth).toHaveLength(2);
    });

    it('returns 401 without auth token', async () => {
      const app = createTestApp();
      const res = await supertest(app).get('/api/v1/admin/dashboard');

      expect(res.status).toBe(401);
    });

    it('returns 403 for non-ADMIN role', async () => {
      const app = createTestApp();
      const res = await supertest(app)
        .get('/api/v1/admin/dashboard')
        .set('x-user-id', OTHER_USER_UUID)
        .set('x-user-role', 'STUDENT');

      expect(res.status).toBe(403);
    });

    it('returns 400 when from is after to', async () => {
      const app = createTestApp();
      const res = await supertest(app)
        .get('/api/v1/admin/dashboard')
        .set('x-user-id', ADMIN_UUID)
        .set('x-user-role', 'ADMIN')
        .query({ from: '2025-05-10', to: '2025-05-01' });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });
  });

  // ─── GET /admin/users ─────────────────────────────────────

  describe('GET /admin/users', () => {
    it('returns 200 with users list for ADMIN', async () => {
      mockListUsers.mockResolvedValue({
        data: [
          {
            id: OTHER_USER_UUID,
            email: 'student@example.com',
            firstName: 'John',
            lastName: 'Doe',
            role: 'STUDENT',
            status: 'ACTIVE',
            isVerified: true,
            createdAt: new Date('2025-04-01').toISOString(),
            updatedAt: new Date('2025-04-01').toISOString(),
            lastLoginAt: new Date('2025-05-01').toISOString(),
          },
        ],
        meta: { page: 1, pageSize: 20, total: 1, hasMore: false },
      });

      const app = createTestApp();
      const res = await supertest(app)
        .get('/api/v1/admin/users')
        .set('x-user-id', ADMIN_UUID)
        .set('x-user-role', 'ADMIN');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveLength(1);
      expect(res.body.meta.total).toBe(1);
    });

    it('returns 401 without auth', async () => {
      const app = createTestApp();
      const res = await supertest(app).get('/api/v1/admin/users');

      expect(res.status).toBe(401);
    });

    it('returns 403 for non-ADMIN', async () => {
      const app = createTestApp();
      const res = await supertest(app)
        .get('/api/v1/admin/users')
        .set('x-user-id', OTHER_USER_UUID)
        .set('x-user-role', 'COMPANY');

      expect(res.status).toBe(403);
    });

    it('returns 400 when role is invalid', async () => {
      const app = createTestApp();
      const res = await supertest(app)
        .get('/api/v1/admin/users')
        .set('x-user-id', ADMIN_UUID)
        .set('x-user-role', 'ADMIN')
        .query({ role: 'INVALID' });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('returns 400 when status is invalid', async () => {
      const app = createTestApp();
      const res = await supertest(app)
        .get('/api/v1/admin/users')
        .set('x-user-id', ADMIN_UUID)
        .set('x-user-role', 'ADMIN')
        .query({ status: 'BANNED' });

      expect(res.status).toBe(400);
    });

    it('accepts isVerified=true query param', async () => {
      mockListUsers.mockResolvedValue({
        data: [],
        meta: { page: 1, pageSize: 20, total: 0, hasMore: false },
      });

      const app = createTestApp();
      const res = await supertest(app)
        .get('/api/v1/admin/users')
        .set('x-user-id', ADMIN_UUID)
        .set('x-user-role', 'ADMIN')
        .query({ isVerified: 'true' });

      expect(res.status).toBe(200);
    });

    it('returns 400 when isVerified is neither true nor false', async () => {
      const app = createTestApp();
      const res = await supertest(app)
        .get('/api/v1/admin/users')
        .set('x-user-id', ADMIN_UUID)
        .set('x-user-role', 'ADMIN')
        .query({ isVerified: 'invalid' });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('accepts sort and order params', async () => {
      mockListUsers.mockResolvedValue({
        data: [],
        meta: { page: 1, pageSize: 20, total: 0, hasMore: false },
      });

      const app = createTestApp();
      const res = await supertest(app)
        .get('/api/v1/admin/users')
        .set('x-user-id', ADMIN_UUID)
        .set('x-user-role', 'ADMIN')
        .query({ sort: 'email', order: 'asc' });

      expect(res.status).toBe(200);
    });

    it('returns 400 when sort field is invalid', async () => {
      const app = createTestApp();
      const res = await supertest(app)
        .get('/api/v1/admin/users')
        .set('x-user-id', ADMIN_UUID)
        .set('x-user-role', 'ADMIN')
        .query({ sort: 'password' });

      expect(res.status).toBe(400);
    });

    it('returns 200 with search param', async () => {
      mockListUsers.mockResolvedValue({
        data: [],
        meta: { page: 1, pageSize: 20, total: 0, hasMore: false },
      });

      const app = createTestApp();
      const res = await supertest(app)
        .get('/api/v1/admin/users')
        .set('x-user-id', ADMIN_UUID)
        .set('x-user-role', 'ADMIN')
        .query({ search: 'john' });

      expect(res.status).toBe(200);
    });
  });

  // ─── PATCH /admin/users/:userId/status ───────────────────

  describe('PATCH /admin/users/:userId/status', () => {
    const validBody = {
      status: 'SUSPENDED',
      reason: 'Violation of terms',
      notifyUser: true,
    };

    it('returns 200 when suspending a user', async () => {
      mockUpdateUserStatus.mockResolvedValue({
        userId: OTHER_USER_UUID,
        status: 'SUSPENDED',
        updatedAt: new Date('2025-05-10').toISOString(),
      });

      const app = createTestApp();
      const res = await supertest(app)
        .patch(`/api/v1/admin/users/${OTHER_USER_UUID}/status`)
        .set('x-user-id', ADMIN_UUID)
        .set('x-user-role', 'ADMIN')
        .send(validBody);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.status).toBe('SUSPENDED');
    });

    it('returns 200 when activating a user', async () => {
      mockUpdateUserStatus.mockResolvedValue({
        userId: OTHER_USER_UUID,
        status: 'ACTIVE',
        updatedAt: new Date('2025-05-10').toISOString(),
      });

      const app = createTestApp();
      const res = await supertest(app)
        .patch(`/api/v1/admin/users/${OTHER_USER_UUID}/status`)
        .set('x-user-id', ADMIN_UUID)
        .set('x-user-role', 'ADMIN')
        .send({ status: 'ACTIVE', reason: 'Appeal approved', notifyUser: false });

      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe('ACTIVE');
    });

    it('returns 401 without auth', async () => {
      const app = createTestApp();
      const res = await supertest(app)
        .patch(`/api/v1/admin/users/${OTHER_USER_UUID}/status`)
        .send(validBody);

      expect(res.status).toBe(401);
    });

    it('returns 403 for non-ADMIN', async () => {
      const app = createTestApp();
      const res = await supertest(app)
        .patch(`/api/v1/admin/users/${OTHER_USER_UUID}/status`)
        .set('x-user-id', OTHER_USER_UUID)
        .set('x-user-role', 'STUDENT')
        .send(validBody);

      expect(res.status).toBe(403);
    });

    it('returns 403 when admin tries to self-suspend', async () => {
      mockUpdateUserStatus.mockRejectedValue(new ForbiddenError('Admin cannot change their own status'));

      const app = createTestApp();
      const res = await supertest(app)
        .patch(`/api/v1/admin/users/${ADMIN_UUID}/status`)
        .set('x-user-id', ADMIN_UUID)
        .set('x-user-role', 'ADMIN')
        .send(validBody);

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('FORBIDDEN');
    });

    it('returns 400 when status is invalid', async () => {
      const app = createTestApp();
      const res = await supertest(app)
        .patch(`/api/v1/admin/users/${OTHER_USER_UUID}/status`)
        .set('x-user-id', ADMIN_UUID)
        .set('x-user-role', 'ADMIN')
        .send({ status: 'BANNED', reason: 'Bad status' });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('returns 400 when reason is missing', async () => {
      const app = createTestApp();
      const res = await supertest(app)
        .patch(`/api/v1/admin/users/${OTHER_USER_UUID}/status`)
        .set('x-user-id', ADMIN_UUID)
        .set('x-user-role', 'ADMIN')
        .send({ status: 'SUSPENDED' }); // Missing reason

      expect(res.status).toBe(400);
    });

    it('returns 400 when reason is empty', async () => {
      const app = createTestApp();
      const res = await supertest(app)
        .patch(`/api/v1/admin/users/${OTHER_USER_UUID}/status`)
        .set('x-user-id', ADMIN_UUID)
        .set('x-user-role', 'ADMIN')
        .send({ status: 'SUSPENDED', reason: '' });

      expect(res.status).toBe(400);
    });

    it('returns 400 when userId is not a valid UUID', async () => {
      const app = createTestApp();
      const res = await supertest(app)
        .patch('/api/v1/admin/users/not-a-uuid/status')
        .set('x-user-id', ADMIN_UUID)
        .set('x-user-role', 'ADMIN')
        .send(validBody);

      expect(res.status).toBe(400);
    });

    it('returns 404 when user not found', async () => {
      mockUpdateUserStatus.mockRejectedValue(new NotFoundError('User not found'));

      const app = createTestApp();
      const res = await supertest(app)
        .patch(`/api/v1/admin/users/${NONEXISTENT_UUID}/status`)
        .set('x-user-id', ADMIN_UUID)
        .set('x-user-role', 'ADMIN')
        .send(validBody);

      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe('NOT_FOUND');
    });

    it('defaults notifyUser to true when not provided', async () => {
      mockUpdateUserStatus.mockResolvedValue({
        userId: OTHER_USER_UUID,
        status: 'SUSPENDED',
        updatedAt: new Date('2025-05-10').toISOString(),
      });

      const app = createTestApp();
      const res = await supertest(app)
        .patch(`/api/v1/admin/users/${OTHER_USER_UUID}/status`)
        .set('x-user-id', ADMIN_UUID)
        .set('x-user-role', 'ADMIN')
        .send({ status: 'SUSPENDED', reason: 'Test' }); // No notifyUser

      expect(res.status).toBe(200);
      expect(mockUpdateUserStatus).toHaveBeenCalledWith(
        OTHER_USER_UUID,
        'SUSPENDED',
        'Test',
        true, // Default true
        ADMIN_UUID,
        expect.any(String),
        undefined, // No user-agent header set by supertest
      );
    });
  });

  // ─── GET /admin/audit-logs ───────────────────────────────

  describe('GET /admin/audit-logs', () => {
    it('returns 200 with audit logs for ADMIN', async () => {
      mockListAuditLogs.mockResolvedValue({
        data: [
          {
            id: 'log-uuid-1',
            userId: ADMIN_UUID,
            action: 'USER_STATUS_CHANGE',
            entity: 'USER',
            entityId: OTHER_USER_UUID,
            oldValue: { status: 'ACTIVE' },
            newValue: { status: 'SUSPENDED', reason: 'Violation' },
            createdAt: new Date('2025-05-10').toISOString(),
          },
        ],
        meta: { page: 1, pageSize: 50, total: 1, hasMore: false },
      });

      const app = createTestApp();
      const res = await supertest(app)
        .get('/api/v1/admin/audit-logs')
        .set('x-user-id', ADMIN_UUID)
        .set('x-user-role', 'ADMIN');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveLength(1);
      expect(res.body.meta.total).toBe(1);
    });

    it('returns 401 without auth', async () => {
      const app = createTestApp();
      const res = await supertest(app).get('/api/v1/admin/audit-logs');

      expect(res.status).toBe(401);
    });

    it('returns 403 for non-ADMIN', async () => {
      const app = createTestApp();
      const res = await supertest(app)
        .get('/api/v1/admin/audit-logs')
        .set('x-user-id', OTHER_USER_UUID)
        .set('x-user-role', 'STUDENT');

      expect(res.status).toBe(403);
    });

    it('filters by userId', async () => {
      mockListAuditLogs.mockResolvedValue({
        data: [],
        meta: { page: 1, pageSize: 50, total: 0, hasMore: false },
      });

      const app = createTestApp();
      const res = await supertest(app)
        .get('/api/v1/admin/audit-logs')
        .set('x-user-id', ADMIN_UUID)
        .set('x-user-role', 'ADMIN')
        .query({ userId: ADMIN_UUID });

      expect(res.status).toBe(200);
    });

    it('returns 400 when userId is not a valid UUID', async () => {
      const app = createTestApp();
      const res = await supertest(app)
        .get('/api/v1/admin/audit-logs')
        .set('x-user-id', ADMIN_UUID)
        .set('x-user-role', 'ADMIN')
        .query({ userId: 'not-a-uuid' });

      expect(res.status).toBe(400);
    });

    it('filters by action', async () => {
      mockListAuditLogs.mockResolvedValue({
        data: [],
        meta: { page: 1, pageSize: 50, total: 0, hasMore: false },
      });

      const app = createTestApp();
      const res = await supertest(app)
        .get('/api/v1/admin/audit-logs')
        .set('x-user-id', ADMIN_UUID)
        .set('x-user-role', 'ADMIN')
        .query({ action: 'USER_STATUS_CHANGE' });

      expect(res.status).toBe(200);
    });

    it('filters by entity', async () => {
      mockListAuditLogs.mockResolvedValue({
        data: [],
        meta: { page: 1, pageSize: 50, total: 0, hasMore: false },
      });

      const app = createTestApp();
      const res = await supertest(app)
        .get('/api/v1/admin/audit-logs')
        .set('x-user-id', ADMIN_UUID)
        .set('x-user-role', 'ADMIN')
        .query({ entity: 'USER' });

      expect(res.status).toBe(200);
    });

    it('returns 400 when entity is not a valid enum value', async () => {
      const app = createTestApp();
      const res = await supertest(app)
        .get('/api/v1/admin/audit-logs')
        .set('x-user-id', ADMIN_UUID)
        .set('x-user-role', 'ADMIN')
        .query({ entity: 'INVALID' });

      expect(res.status).toBe(400);
    });

    it('filters by date range', async () => {
      mockListAuditLogs.mockResolvedValue({
        data: [],
        meta: { page: 1, pageSize: 50, total: 0, hasMore: false },
      });

      const app = createTestApp();
      const res = await supertest(app)
        .get('/api/v1/admin/audit-logs')
        .set('x-user-id', ADMIN_UUID)
        .set('x-user-role', 'ADMIN')
        .query({
          from: '2025-05-01T00:00:00Z',
          to: '2025-05-15T00:00:00Z',
        });

      expect(res.status).toBe(200);
    });

    it('returns 400 when from date is after to date', async () => {
      const app = createTestApp();
      const res = await supertest(app)
        .get('/api/v1/admin/audit-logs')
        .set('x-user-id', ADMIN_UUID)
        .set('x-user-role', 'ADMIN')
        .query({
          from: '2025-05-15T00:00:00Z',
          to: '2025-05-01T00:00:00Z',
        });

      expect(res.status).toBe(400);
    });
  });

  // ─── GET /admin/reports ──────────────────────────────────

  describe('GET /admin/reports', () => {
    it('returns 200 with JSON report', async () => {
      mockGenerateReport.mockResolvedValue({
        reportType: 'users',
        generatedAt: '2025-05-10T12:00:00.000Z',
        parameters: { from: null, to: null },
        data: [{ id: '1', name: 'User 1' }],
      });

      const app = createTestApp();
      const res = await supertest(app)
        .get('/api/v1/admin/reports')
        .set('x-user-id', ADMIN_UUID)
        .set('x-user-role', 'ADMIN')
        .query({ type: 'users' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.reportType).toBe('users');
      expect(res.body.data.parameters).toEqual({ from: null, to: null });
      expect(res.body.data.data).toHaveLength(1);
    });

    it('returns 200 with CSV report and correct headers', async () => {
      mockGenerateReport.mockResolvedValue({
        csv: 'id,name\n1,User 1\n2,User 2\n',
        filename: 'users-report-2025-05-10.csv',
      });

      const app = createTestApp();
      const res = await supertest(app)
        .get('/api/v1/admin/reports')
        .set('x-user-id', ADMIN_UUID)
        .set('x-user-role', 'ADMIN')
        .query({ type: 'users', format: 'csv' });

      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toContain('text/csv');
      expect(res.headers['content-disposition']).toContain('attachment');
      expect(res.headers['content-disposition']).toContain('users-report-');
      expect(res.text).toBe('id,name\n1,User 1\n2,User 2\n');
    });

    it('returns 401 without auth', async () => {
      const app = createTestApp();
      const res = await supertest(app)
        .get('/api/v1/admin/reports')
        .query({ type: 'users' });

      expect(res.status).toBe(401);
    });

    it('returns 403 for non-ADMIN', async () => {
      const app = createTestApp();
      const res = await supertest(app)
        .get('/api/v1/admin/reports')
        .set('x-user-id', OTHER_USER_UUID)
        .set('x-user-role', 'COMPANY')
        .query({ type: 'users' });

      expect(res.status).toBe(403);
    });

    it('returns 400 when report type is invalid', async () => {
      const app = createTestApp();
      const res = await supertest(app)
        .get('/api/v1/admin/reports')
        .set('x-user-id', ADMIN_UUID)
        .set('x-user-role', 'ADMIN')
        .query({ type: 'invalid' });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('returns 400 when format is invalid', async () => {
      const app = createTestApp();
      const res = await supertest(app)
        .get('/api/v1/admin/reports')
        .set('x-user-id', ADMIN_UUID)
        .set('x-user-role', 'ADMIN')
        .query({ type: 'users', format: 'xml' });

      expect(res.status).toBe(400);
    });

    it('returns 400 when from is after to', async () => {
      const app = createTestApp();
      const res = await supertest(app)
        .get('/api/v1/admin/reports')
        .set('x-user-id', ADMIN_UUID)
        .set('x-user-role', 'ADMIN')
        .query({ type: 'users', from: '2025-05-10', to: '2025-05-01' });

      expect(res.status).toBe(400);
    });

    it('defaults to json format when format is not specified', async () => {
      mockGenerateReport.mockResolvedValue({
        reportType: 'internships',
        generatedAt: '2025-05-10T12:00:00.000Z',
        parameters: { from: null, to: null },
        data: [],
      });

      const app = createTestApp();
      const res = await supertest(app)
        .get('/api/v1/admin/reports')
        .set('x-user-id', ADMIN_UUID)
        .set('x-user-role', 'ADMIN')
        .query({ type: 'internships' });

      expect(res.status).toBe(200);
    });

    it('accepts all five report types', async () => {
      const types = ['users', 'internships', 'applications', 'companies', 'schools'];
      mockGenerateReport.mockResolvedValue({
        reportType: 'users',
        generatedAt: '2025-05-10T12:00:00.000Z',
        parameters: { from: null, to: null },
        data: [],
      });

      for (const type of types) {
        const app = createTestApp();
        const res = await supertest(app)
          .get('/api/v1/admin/reports')
          .set('x-user-id', ADMIN_UUID)
          .set('x-user-role', 'ADMIN')
          .query({ type });

        expect(res.status).toBe(200);
      }
    });
  });
});
