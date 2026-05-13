// ─────────────────────────────────────────────────────────────
// Application Routes — Integration Tests
// Uses supertest with mocked service layer and mocked auth middleware.
// Tests cover:
//  - Role-scoped listing (GET /applications)
//  - Detail view (GET /applications/:applicationId)
//  - Status update (PATCH /applications/:applicationId/status)
//  - Withdrawal (POST /applications/:applicationId/withdraw)
// ─────────────────────────────────────────────────────────────

import { describe, it, expect, vi, beforeEach } from 'vitest';
import express, { type Request, type Response, type NextFunction } from 'express';
import supertest from 'supertest';
import { UnauthorizedError, ForbiddenError, NotFoundError, UnprocessableError } from '../../../shared/errors/app-error.js';

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

// ─── Mock logger to prevent config/env loading ─────────────

vi.mock('../../../shared/lib/logger.js', () => ({
  default: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

// Mock the service layer
vi.mock('../application.service.js', () => ({}));

import * as applicationService from '../application.service.js';
import applicationRoutes from '../application.routes.js';
import { errorHandler } from '../../../shared/middleware/error.middleware.js';

// ─── Test app factory ──────────────────────────────────────

function createTestApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/v1', applicationRoutes);
  app.use(errorHandler);
  return app;
}

// ─── Test UUIDs ────────────────────────────────────────────

const VALID_APP_UUID = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';
const STUDENT_UUID = 'b2c3d4e5-f6a7-8901-bcde-f12345678901';
const COMPANY_UUID = 'c3d4e5f6-a7b8-9012-cdef-123456789012';
const ADMIN_UUID = 'd4e5f6a7-b8c9-0123-defa-234567890123';
const OTHER_USER_UUID = 'e5f6a7b8-c9d0-1234-efab-345678901234';
const NONEXISTENT_UUID = 'f47ac10b-58cc-4372-a567-0e02b2c3d479';

// ─── Fixtures ──────────────────────────────────────────────

/** List-safe application entry (no companyNote, statusHistory, resumeUrl, email, phone). */
const mockApplicationListEntry = {
  id: VALID_APP_UUID,
  status: 'PENDING',
  coverLetter: 'I am passionate',
  additionalInfo: null,
  appliedAt: new Date('2025-04-01').toISOString(),
  updatedAt: new Date('2025-04-01').toISOString(),
  student: {
    id: 'student-uuid-1',
    grade: 10,
    user: {
      id: STUDENT_UUID,
      firstName: 'Abebe',
      lastName: 'Kebede',
    },
  },
  internship: {
    id: 'internship-uuid-1',
    title: 'Software Engineering Intern',
    status: 'ACTIVE',
    company: {
      id: 'company-uuid-1',
      name: 'Tech Corp',
    },
  },
};

/** Detail application entry (includes statusHistory, resumeUrl, email, phone, companyNote). */
const mockApplication = {
  ...mockApplicationListEntry,
  companyNote: null,
  student: {
    ...mockApplicationListEntry.student,
    resumeUrl: 'https://example.com/resume.pdf',
  },
  statusHistory: [],
};

const mockApplicationWithContactInfo = {
  ...mockApplication,
  companyNote: 'Strong candidate',
  student: {
    ...mockApplication.student,
    resumeUrl: 'https://example.com/resume.pdf',
    user: {
      ...mockApplication.student.user,
      email: 'student@example.com',
      phone: '+251911111111',
    },
  },
};

const mockApplicationUpdated = {
  ...mockApplication,
  status: 'REVIEWED',
  statusHistory: [
    {
      id: 'history-uuid-1',
      fromStatus: 'PENDING',
      toStatus: 'REVIEWED',
      changedById: COMPANY_UUID,
      note: 'Reviewing qualifications',
      createdAt: new Date().toISOString(),
    },
  ],
};

const mockApplicationWithdrawn = {
  ...mockApplication,
  status: 'WITHDRAWN',
  statusHistory: [
    {
      id: 'history-uuid-1',
      fromStatus: 'PENDING',
      toStatus: 'WITHDRAWN',
      changedById: STUDENT_UUID,
      note: 'Found another opportunity',
      createdAt: new Date().toISOString(),
    },
  ],
};

// ─── Mock service implementations ──────────────────────────

const mockList = vi.fn();
const mockGetById = vi.fn();
const mockUpdateStatus = vi.fn();
const mockWithdraw = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();

  vi.mocked(applicationService).list = mockList;
  vi.mocked(applicationService).getById = mockGetById;
  vi.mocked(applicationService).updateStatus = mockUpdateStatus;
  vi.mocked(applicationService).withdraw = mockWithdraw;
});

// ─── Tests ─────────────────────────────────────────────────

describe('ApplicationRoutes', () => {
  describe('GET /applications', () => {
    it('returns 200 with data for student (authenticated)', async () => {
      mockList.mockResolvedValue({
        data: [mockApplicationListEntry],
        meta: { cursor: VALID_APP_UUID, hasMore: false },
      });

      const app = createTestApp();
      const res = await supertest(app)
        .get('/api/v1/applications')
        .set('x-user-id', STUDENT_UUID)
        .set('x-user-role', 'STUDENT');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveLength(1);
      expect(res.body.meta).toHaveProperty('cursor');
      expect(res.body.meta).toHaveProperty('hasMore');
      // List-safe: no sensitive fields
      expect(res.body.data[0]).not.toHaveProperty('companyNote');
      expect(res.body.data[0]).not.toHaveProperty('statusHistory');
      expect(res.body.data[0].student).not.toHaveProperty('resumeUrl');
      expect(res.body.data[0].student.user).not.toHaveProperty('email');
      expect(res.body.data[0].student.user).not.toHaveProperty('phone');
    });

    it('returns 200 for company role', async () => {
      mockList.mockResolvedValue({
        data: [mockApplicationListEntry],
        meta: { cursor: null, hasMore: false },
      });

      const app = createTestApp();
      const res = await supertest(app)
        .get('/api/v1/applications')
        .set('x-user-id', COMPANY_UUID)
        .set('x-user-role', 'COMPANY');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      // List-safe: no sensitive fields for any role
      expect(res.body.data[0]).not.toHaveProperty('companyNote');
      expect(res.body.data[0]).not.toHaveProperty('statusHistory');
      expect(res.body.data[0].student).not.toHaveProperty('resumeUrl');
      expect(res.body.data[0].student.user).not.toHaveProperty('email');
      expect(res.body.data[0].student.user).not.toHaveProperty('phone');
    });

    it('returns 200 for admin role', async () => {
      mockList.mockResolvedValue({
        data: [mockApplicationListEntry],
        meta: { cursor: null, hasMore: false },
      });

      const app = createTestApp();
      const res = await supertest(app)
        .get('/api/v1/applications')
        .set('x-user-id', ADMIN_UUID)
        .set('x-user-role', 'ADMIN');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      // List-safe: no sensitive fields for any role
      expect(res.body.data[0]).not.toHaveProperty('companyNote');
      expect(res.body.data[0]).not.toHaveProperty('statusHistory');
      expect(res.body.data[0].student).not.toHaveProperty('resumeUrl');
      expect(res.body.data[0].student.user).not.toHaveProperty('email');
      expect(res.body.data[0].student.user).not.toHaveProperty('phone');
    });

    it('returns 401 without auth token', async () => {
      const app = createTestApp();
      const res = await supertest(app).get('/api/v1/applications');

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });

    it('returns 200 with status filter', async () => {
      mockList.mockResolvedValue({
        data: [mockApplicationListEntry],
        meta: { cursor: null, hasMore: false },
      });

      const app = createTestApp();
      const res = await supertest(app)
        .get('/api/v1/applications')
        .query({ status: 'PENDING' })
        .set('x-user-id', STUDENT_UUID)
        .set('x-user-role', 'STUDENT');

      expect(res.status).toBe(200);
      expect(mockList).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(String),
        expect.objectContaining({ status: 'PENDING' }),
      );
    });

    it('returns 200 with cursor pagination', async () => {
      mockList.mockResolvedValue({
        data: [mockApplicationListEntry],
        meta: { cursor: null, hasMore: false },
      });

      const app = createTestApp();
      const res = await supertest(app)
        .get('/api/v1/applications')
        .query({ cursor: VALID_APP_UUID, pageSize: '10' })
        .set('x-user-id', STUDENT_UUID)
        .set('x-user-role', 'STUDENT');

      expect(res.status).toBe(200);
    });

    it('returns 400 when sort is an invalid field', async () => {
      const app = createTestApp();
      const res = await supertest(app)
        .get('/api/v1/applications')
        .query({ sort: 'invalidField' })
        .set('x-user-id', STUDENT_UUID)
        .set('x-user-role', 'STUDENT');

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('returns 400 when status is an invalid enum value', async () => {
      const app = createTestApp();
      const res = await supertest(app)
        .get('/api/v1/applications')
        .query({ status: 'INVALID_STATUS' })
        .set('x-user-id', STUDENT_UUID)
        .set('x-user-role', 'STUDENT');

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('returns 400 when cursor is not a valid UUID', async () => {
      const app = createTestApp();
      const res = await supertest(app)
        .get('/api/v1/applications')
        .query({ cursor: 'not-a-uuid' })
        .set('x-user-id', STUDENT_UUID)
        .set('x-user-role', 'STUDENT');

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });
  });

  describe('GET /applications/:applicationId', () => {
    it('returns 200 with application detail (student owner)', async () => {
      mockGetById.mockResolvedValue(mockApplication);

      const app = createTestApp();
      const res = await supertest(app)
        .get(`/api/v1/applications/${VALID_APP_UUID}`)
        .set('x-user-id', STUDENT_UUID)
        .set('x-user-role', 'STUDENT');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveProperty('id', VALID_APP_UUID);
      expect(res.body.data).toHaveProperty('statusHistory');
      // Student detail: companyNote is null, email/phone NOT exposed
      expect(res.body.data).toHaveProperty('companyNote');
      expect(res.body.data.student.user).not.toHaveProperty('email');
      expect(res.body.data.student.user).not.toHaveProperty('phone');
      // But student identity is visible
      expect(res.body.data.student.user).toHaveProperty('firstName', 'Abebe');
      expect(res.body.data.student.user).toHaveProperty('lastName', 'Kebede');
    });

    it('returns 200 with full contact info for company', async () => {
      mockGetById.mockResolvedValue(mockApplicationWithContactInfo);

      const app = createTestApp();
      const res = await supertest(app)
        .get(`/api/v1/applications/${VALID_APP_UUID}`)
        .set('x-user-id', COMPANY_UUID)
        .set('x-user-role', 'COMPANY');

      expect(res.status).toBe(200);
      expect(res.body.data.student.user).toHaveProperty('email');
      expect(res.body.data).toHaveProperty('companyNote');
    });

    it('returns 200 for admin', async () => {
      mockGetById.mockResolvedValue(mockApplicationWithContactInfo);

      const app = createTestApp();
      const res = await supertest(app)
        .get(`/api/v1/applications/${VALID_APP_UUID}`)
        .set('x-user-id', ADMIN_UUID)
        .set('x-user-role', 'ADMIN');

      expect(res.status).toBe(200);
    });

    it('returns 404 when application not found', async () => {
      mockGetById.mockRejectedValue(new NotFoundError('Application not found'));

      const app = createTestApp();
      const res = await supertest(app)
        .get(`/api/v1/applications/${NONEXISTENT_UUID}`)
        .set('x-user-id', ADMIN_UUID)
        .set('x-user-role', 'ADMIN');

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('NOT_FOUND');
    });

    it('returns 403 when other student tries to view', async () => {
      mockGetById.mockRejectedValue(new ForbiddenError('You do not have permission to view this application'));

      const app = createTestApp();
      const res = await supertest(app)
        .get(`/api/v1/applications/${VALID_APP_UUID}`)
        .set('x-user-id', OTHER_USER_UUID)
        .set('x-user-role', 'STUDENT');

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
    });

    it('returns 403 when other company tries to view', async () => {
      mockGetById.mockRejectedValue(new ForbiddenError('You do not have permission to view this application'));

      const app = createTestApp();
      const res = await supertest(app)
        .get(`/api/v1/applications/${VALID_APP_UUID}`)
        .set('x-user-id', OTHER_USER_UUID)
        .set('x-user-role', 'COMPANY');

      expect(res.status).toBe(403);
    });

    it('returns 400 when applicationId is not a valid UUID', async () => {
      const app = createTestApp();
      const res = await supertest(app)
        .get('/api/v1/applications/not-a-uuid')
        .set('x-user-id', STUDENT_UUID)
        .set('x-user-role', 'STUDENT');

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('returns 401 without auth token', async () => {
      const app = createTestApp();
      const res = await supertest(app).get(`/api/v1/applications/${VALID_APP_UUID}`);

      expect(res.status).toBe(401);
    });
  });

  describe('PATCH /applications/:applicationId/status', () => {
    const validBody = { status: 'REVIEWED', note: 'Reviewing qualifications' };

    it('returns 200 for company owner', async () => {
      mockUpdateStatus.mockResolvedValue(mockApplicationUpdated);

      const app = createTestApp();
      const res = await supertest(app)
        .patch(`/api/v1/applications/${VALID_APP_UUID}/status`)
        .set('x-user-id', COMPANY_UUID)
        .set('x-user-role', 'COMPANY')
        .send(validBody);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.status).toBe('REVIEWED');
    });

    it('returns 200 for admin', async () => {
      mockUpdateStatus.mockResolvedValue(mockApplicationUpdated);

      const app = createTestApp();
      const res = await supertest(app)
        .patch(`/api/v1/applications/${VALID_APP_UUID}/status`)
        .set('x-user-id', ADMIN_UUID)
        .set('x-user-role', 'ADMIN')
        .send(validBody);

      expect(res.status).toBe(200);
    });

    it('returns 200 with note and message (message accepted but not persisted)', async () => {
      mockUpdateStatus.mockResolvedValue(mockApplicationUpdated);

      const app = createTestApp();
      const res = await supertest(app)
        .patch(`/api/v1/applications/${VALID_APP_UUID}/status`)
        .set('x-user-id', COMPANY_UUID)
        .set('x-user-role', 'COMPANY')
        .send({ status: 'REVIEWED', note: 'Great candidate', message: 'You are moving forward!' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('returns 403 for student role', async () => {
      const app = createTestApp();
      const res = await supertest(app)
        .patch(`/api/v1/applications/${VALID_APP_UUID}/status`)
        .set('x-user-id', STUDENT_UUID)
        .set('x-user-role', 'STUDENT')
        .send(validBody);

      expect(res.status).toBe(403);
    });

    it('returns 403 for non-owner company', async () => {
      mockUpdateStatus.mockRejectedValue(new ForbiddenError('You do not have permission to update this application'));

      const app = createTestApp();
      const res = await supertest(app)
        .patch(`/api/v1/applications/${VALID_APP_UUID}/status`)
        .set('x-user-id', OTHER_USER_UUID)
        .set('x-user-role', 'COMPANY')
        .send(validBody);

      expect(res.status).toBe(403);
    });

    it('returns 422 for invalid transition', async () => {
      mockUpdateStatus.mockRejectedValue(new UnprocessableError('Cannot transition application from PENDING to ACCEPTED'));

      const app = createTestApp();
      const res = await supertest(app)
        .patch(`/api/v1/applications/${VALID_APP_UUID}/status`)
        .set('x-user-id', COMPANY_UUID)
        .set('x-user-role', 'COMPANY')
        .send({ status: 'ACCEPTED' }); // PENDING → ACCEPTED is invalid

      expect(res.status).toBe(422);
      expect(res.body.error.code).toBe('UNPROCESSABLE_ENTITY');
    });

    it('returns 404 when application not found', async () => {
      mockUpdateStatus.mockRejectedValue(new NotFoundError('Application not found'));

      const app = createTestApp();
      const res = await supertest(app)
        .patch(`/api/v1/applications/${NONEXISTENT_UUID}/status`)
        .set('x-user-id', COMPANY_UUID)
        .set('x-user-role', 'COMPANY')
        .send(validBody);

      expect(res.status).toBe(404);
    });

    it('returns 400 when applicationId is not a valid UUID', async () => {
      const app = createTestApp();
      const res = await supertest(app)
        .patch('/api/v1/applications/not-a-uuid/status')
        .set('x-user-id', COMPANY_UUID)
        .set('x-user-role', 'COMPANY')
        .send(validBody);

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('returns 400 when status is an invalid value', async () => {
      const app = createTestApp();
      const res = await supertest(app)
        .patch(`/api/v1/applications/${VALID_APP_UUID}/status`)
        .set('x-user-id', COMPANY_UUID)
        .set('x-user-role', 'COMPANY')
        .send({ status: 'INVALID' });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('returns 401 without auth token', async () => {
      const app = createTestApp();
      const res = await supertest(app)
        .patch(`/api/v1/applications/${VALID_APP_UUID}/status`)
        .send(validBody);

      expect(res.status).toBe(401);
    });
  });

  describe('POST /applications/:applicationId/withdraw', () => {
    it('returns 200 for student owner', async () => {
      mockWithdraw.mockResolvedValue(mockApplicationWithdrawn);

      const app = createTestApp();
      const res = await supertest(app)
        .post(`/api/v1/applications/${VALID_APP_UUID}/withdraw`)
        .set('x-user-id', STUDENT_UUID)
        .set('x-user-role', 'STUDENT')
        .send({ reason: 'Found another opportunity' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.status).toBe('WITHDRAWN');
    });

    it('returns 200 with no reason (optional)', async () => {
      mockWithdraw.mockResolvedValue(mockApplicationWithdrawn);

      const app = createTestApp();
      const res = await supertest(app)
        .post(`/api/v1/applications/${VALID_APP_UUID}/withdraw`)
        .set('x-user-id', STUDENT_UUID)
        .set('x-user-role', 'STUDENT')
        .send({});

      expect(res.status).toBe(200);
    });

    it('returns 403 for company role', async () => {
      mockWithdraw.mockRejectedValue(new ForbiddenError('Only students can withdraw applications'));

      const app = createTestApp();
      const res = await supertest(app)
        .post(`/api/v1/applications/${VALID_APP_UUID}/withdraw`)
        .set('x-user-id', COMPANY_UUID)
        .set('x-user-role', 'COMPANY')
        .send({});

      expect(res.status).toBe(403);
    });

    it('returns 403 for admin role', async () => {
      mockWithdraw.mockRejectedValue(new ForbiddenError('Only students can withdraw applications'));

      const app = createTestApp();
      const res = await supertest(app)
        .post(`/api/v1/applications/${VALID_APP_UUID}/withdraw`)
        .set('x-user-id', ADMIN_UUID)
        .set('x-user-role', 'ADMIN')
        .send({});

      expect(res.status).toBe(403);
    });

    it('returns 403 for non-owner student', async () => {
      mockWithdraw.mockRejectedValue(new ForbiddenError('You can only withdraw your own applications'));

      const app = createTestApp();
      const res = await supertest(app)
        .post(`/api/v1/applications/${VALID_APP_UUID}/withdraw`)
        .set('x-user-id', OTHER_USER_UUID)
        .set('x-user-role', 'STUDENT')
        .send({});

      expect(res.status).toBe(403);
    });

    it('returns 422 when application is in SHORTLISTED status (invalid state)', async () => {
      mockWithdraw.mockRejectedValue(new UnprocessableError('Cannot withdraw application in SHORTLISTED status. Only PENDING or REVIEWED applications can be withdrawn.'));

      const app = createTestApp();
      const res = await supertest(app)
        .post(`/api/v1/applications/${VALID_APP_UUID}/withdraw`)
        .set('x-user-id', STUDENT_UUID)
        .set('x-user-role', 'STUDENT')
        .send({});

      expect(res.status).toBe(422);
      expect(res.body.error.code).toBe('UNPROCESSABLE_ENTITY');
    });

    it('returns 404 when application not found', async () => {
      mockWithdraw.mockRejectedValue(new NotFoundError('Application not found'));

      const app = createTestApp();
      const res = await supertest(app)
        .post(`/api/v1/applications/${NONEXISTENT_UUID}/withdraw`)
        .set('x-user-id', STUDENT_UUID)
        .set('x-user-role', 'STUDENT')
        .send({});

      expect(res.status).toBe(404);
    });

    it('returns 400 when applicationId is not a valid UUID', async () => {
      const app = createTestApp();
      const res = await supertest(app)
        .post('/api/v1/applications/not-a-uuid/withdraw')
        .set('x-user-id', STUDENT_UUID)
        .set('x-user-role', 'STUDENT')
        .send({});

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('returns 401 without auth token', async () => {
      const app = createTestApp();
      const res = await supertest(app)
        .post(`/api/v1/applications/${VALID_APP_UUID}/withdraw`)
        .send({});

      expect(res.status).toBe(401);
    });
  });
});
