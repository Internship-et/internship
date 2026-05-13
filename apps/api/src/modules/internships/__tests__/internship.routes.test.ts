// ─────────────────────────────────────────────────────────────
// Internship Routes — Integration Tests
// Uses supertest with mocked service layer, mocked auth middleware,
// and mocked rate limiter.
// Tests cover:
//  - Public listing (GET /internships) with validation
//  - Public detail (GET /internships/:internshipId)
//  - Internship creation (POST /internships) with auth+role checks
//  - Internship update (PATCH /internships/:internshipId) with ownership
//  - Internship close (DELETE /internships/:internshipId)
//  - Application submission (POST /internships/:internshipId/apply) with rate limit
// ─────────────────────────────────────────────────────────────

import { describe, it, expect, vi, beforeEach } from 'vitest';
import express, { type Request, type Response, type NextFunction } from 'express';
import supertest from 'supertest';
import { UnauthorizedError, ForbiddenError, NotFoundError, ConflictError, UnprocessableError } from '../../../shared/errors/app-error.js';

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

// ─── Mock rate limiter (pass-through for tests) ─────────────

vi.mock('../../../shared/middleware/rate-limit.middleware.js', () => ({
  rateLimiter: () => (_req: Request, _res: Response, next: NextFunction) => {
    next();
  },
}));

// Mock the service layer
vi.mock('../internship.service.js', () => ({}));

import * as internshipService from '../internship.service.js';
import internshipRoutes from '../internship.routes.js';
import { errorHandler } from '../../../shared/middleware/error.middleware.js';

// ─── Test app factory ──────────────────────────────────────

function createTestApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/v1', internshipRoutes);
  app.use(errorHandler);
  return app;
}

// ─── Test UUIDs ────────────────────────────────────────────

const VALID_INTERNSHIP_UUID = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';
const VALID_USER_UUID = 'b2c3d4e5-f6a7-8901-bcde-f12345678901';
const ADMIN_UUID = 'c3d4e5f6-a7b8-9012-cdef-123456789012';
const OTHER_USER_UUID = 'd4e5f6a7-b8c9-0123-defa-234567890123';
const STUDENT_UUID = 'e5f6a7b8-c9d0-1234-efab-345678901234';
const NONEXISTENT_UUID = 'f47ac10b-58cc-4372-a567-0e02b2c3d479';

// ─── Fixtures ──────────────────────────────────────────────

/**
 * Mock internship as returned by service (public-safe shape).
 * No internal fields: companyId, deletedAt, or _count.
 */
const mockInternship = {
  id: VALID_INTERNSHIP_UUID,
  title: 'Software Engineering Intern',
  description: 'Join our team',
  responsibilities: ['Code', 'Test'],
  requirements: ['JavaScript'],
  preferredSkills: ['React'],
  type: 'REMOTE',
  city: 'Addis Ababa',
  address: null,
  durationMonths: 3,
  weeklyHours: 40,
  startDate: new Date('2025-06-01').toISOString(),
  deadline: new Date('2099-12-31').toISOString(),
  stipend: { amount: 5000, currency: 'ETB', period: 'MONTHLY' },
  benefits: ['Lunch'],
  tags: ['JavaScript', 'React'],
  minGrade: 9,
  maxGrade: 12,
  status: 'ACTIVE',
  createdAt: new Date('2025-03-01').toISOString(),
  updatedAt: new Date('2025-03-01').toISOString(),
  applicantCount: 3,
  company: {
    id: 'company-uuid-1',
    name: 'Tech Corp',
    logoUrl: null,
    city: 'Addis Ababa',
    industry: 'TECHNOLOGY',
  },
};

const mockDraftInternship = {
  ...mockInternship,
  status: 'DRAFT',
};

const mockApplication = {
  id: 'app-uuid-1',
  internshipId: VALID_INTERNSHIP_UUID,
  studentId: 'student-uuid-1',
  status: 'PENDING',
  appliedAt: new Date('2025-04-01').toISOString(),
};

// ─── Mock service implementations ──────────────────────────

const mockList = vi.fn();
const mockGetById = vi.fn();
const mockCreate = vi.fn();
const mockUpdate = vi.fn();
const mockClose = vi.fn();
const mockApply = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();

  vi.mocked(internshipService).list = mockList;
  vi.mocked(internshipService).getById = mockGetById;
  vi.mocked(internshipService).create = mockCreate;
  vi.mocked(internshipService).update = mockUpdate;
  vi.mocked(internshipService).close = mockClose;
  vi.mocked(internshipService).apply = mockApply;
});

// ─── Tests ─────────────────────────────────────────────────

describe('InternshipRoutes', () => {
  describe('GET /internships', () => {
    it('returns 200 with data (public)', async () => {
      mockList.mockResolvedValue({
        data: [mockInternship],
        meta: { cursor: VALID_INTERNSHIP_UUID, hasMore: false },
      });

      const app = createTestApp();
      const res = await supertest(app).get('/api/v1/internships');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveLength(1);
      expect(res.body.meta).toHaveProperty('cursor');
      expect(res.body.meta).toHaveProperty('hasMore');
    });

    it('returns 200 with cursor pagination query params', async () => {
      mockList.mockResolvedValue({
        data: [mockInternship],
        meta: { cursor: null, hasMore: false },
      });

      const app = createTestApp();
      const res = await supertest(app)
        .get('/api/v1/internships')
        .query({ cursor: VALID_INTERNSHIP_UUID, pageSize: '10' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('does not expose companyId, deletedAt, or _count in response', async () => {
      mockList.mockResolvedValue({
        data: [mockInternship],
        meta: { cursor: null, hasMore: false },
      });

      const app = createTestApp();
      const res = await supertest(app).get('/api/v1/internships');

      const entry = res.body.data[0];
      expect(entry).not.toHaveProperty('_count');
      expect(entry).not.toHaveProperty('companyId');
      expect(entry).not.toHaveProperty('deletedAt');
      expect(entry).not.toHaveProperty('company.userId');
      expect(entry).toHaveProperty('applicantCount', 3);
    });

    it('accepts sort=city (200)', async () => {
      mockList.mockResolvedValue({
        data: [mockInternship],
        meta: { cursor: null, hasMore: false },
      });

      const app = createTestApp();
      const res = await supertest(app)
        .get('/api/v1/internships')
        .query({ sort: 'city', order: 'asc' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('returns 400 when sort is an invalid field', async () => {
      const app = createTestApp();
      const res = await supertest(app)
        .get('/api/v1/internships')
        .query({ sort: 'invalidField' });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('returns 400 when cursor is not a valid UUID', async () => {
      const app = createTestApp();
      const res = await supertest(app)
        .get('/api/v1/internships')
        .query({ cursor: 'not-a-uuid' });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('returns 400 when minGrade > maxGrade (cross-field validation)', async () => {
      const app = createTestApp();
      const res = await supertest(app)
        .get('/api/v1/internships')
        .query({ minGrade: '12', maxGrade: '9' });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('returns 200 empty array for no results', async () => {
      mockList.mockResolvedValue({
        data: [],
        meta: { cursor: null, hasMore: false },
      });

      const app = createTestApp();
      const res = await supertest(app).get('/api/v1/internships');

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(0);
    });

    it('returns 400 when pageSize is out of range (>100)', async () => {
      const app = createTestApp();
      const res = await supertest(app)
        .get('/api/v1/internships')
        .query({ pageSize: '200' });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });
  });

  describe('GET /internships/:internshipId', () => {
    it('returns 200 with internship details (public)', async () => {
      mockGetById.mockResolvedValue({ ...mockInternship, applicationCount: 3 });

      const app = createTestApp();
      const res = await supertest(app).get(`/api/v1/internships/${VALID_INTERNSHIP_UUID}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveProperty('applicationCount');
      expect(res.body.data).not.toHaveProperty('companyId');
      expect(res.body.data).not.toHaveProperty('deletedAt');
      expect(res.body.data.company).not.toHaveProperty('userId');
    });

    it('returns 404 when internship not found', async () => {
      mockGetById.mockRejectedValue(new NotFoundError('Internship not found'));

      const app = createTestApp();
      const res = await supertest(app).get(`/api/v1/internships/${NONEXISTENT_UUID}`);

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
    });

    it('returns 400 when internshipId is not a valid UUID', async () => {
      const app = createTestApp();
      const res = await supertest(app).get('/api/v1/internships/not-a-uuid');

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });
  });

  describe('POST /internships', () => {
    const validBody = {
      title: 'New Internship',
      description: 'A great opportunity',
      requirements: ['JavaScript'],
      type: 'REMOTE',
      city: 'Addis Ababa',
      durationMonths: 3,
    };

    it('returns 201 for COMPANY role', async () => {
      mockCreate.mockResolvedValue(mockDraftInternship);

      const app = createTestApp();
      const res = await supertest(app)
        .post('/api/v1/internships')
        .set('x-user-id', VALID_USER_UUID)
        .set('x-user-role', 'COMPANY')
        .send(validBody);

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
    });

    it('returns 201 for ADMIN role', async () => {
      mockCreate.mockResolvedValue(mockDraftInternship);

      const app = createTestApp();
      const res = await supertest(app)
        .post('/api/v1/internships')
        .set('x-user-id', ADMIN_UUID)
        .set('x-user-role', 'ADMIN')
        .send(validBody);

      expect(res.status).toBe(201);
    });

    it('returns 401 without auth token', async () => {
      const app = createTestApp();
      const res = await supertest(app)
        .post('/api/v1/internships')
        .send(validBody);

      expect(res.status).toBe(401);
    });

    it('returns 403 for STUDENT role', async () => {
      const app = createTestApp();
      const res = await supertest(app)
        .post('/api/v1/internships')
        .set('x-user-id', STUDENT_UUID)
        .set('x-user-role', 'STUDENT')
        .send(validBody);

      expect(res.status).toBe(403);
    });

    it('returns 400 with invalid body (missing required fields)', async () => {
      const app = createTestApp();
      const res = await supertest(app)
        .post('/api/v1/internships')
        .set('x-user-id', VALID_USER_UUID)
        .set('x-user-role', 'COMPANY')
        .send({ title: 'Incomplete' }); // Missing type, city, durationMonths

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('returns 400 when minGrade > maxGrade (cross-field validation)', async () => {
      const app = createTestApp();
      const res = await supertest(app)
        .post('/api/v1/internships')
        .set('x-user-id', VALID_USER_UUID)
        .set('x-user-role', 'COMPANY')
        .send({
          ...validBody,
          minGrade: 12,
          maxGrade: 9,
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('returns 404 when user has no company profile', async () => {
      mockCreate.mockRejectedValue(new NotFoundError('Company profile not found. Create a company profile first.'));

      const app = createTestApp();
      const res = await supertest(app)
        .post('/api/v1/internships')
        .set('x-user-id', VALID_USER_UUID)
        .set('x-user-role', 'COMPANY')
        .send(validBody);

      expect(res.status).toBe(404);
    });
  });

  describe('PATCH /internships/:internshipId', () => {
    const updateBody = { description: 'Updated description' };

    it('returns 200 for OWNER', async () => {
      mockUpdate.mockResolvedValue({ ...mockInternship, description: 'Updated description' });

      const app = createTestApp();
      const res = await supertest(app)
        .patch(`/api/v1/internships/${VALID_INTERNSHIP_UUID}`)
        .set('x-user-id', VALID_USER_UUID)
        .set('x-user-role', 'COMPANY')
        .send(updateBody);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.description).toBe('Updated description');
    });

    it('returns 200 for ADMIN', async () => {
      mockUpdate.mockResolvedValue({ ...mockInternship, description: 'Updated description' });

      const app = createTestApp();
      const res = await supertest(app)
        .patch(`/api/v1/internships/${VALID_INTERNSHIP_UUID}`)
        .set('x-user-id', ADMIN_UUID)
        .set('x-user-role', 'ADMIN')
        .send(updateBody);

      expect(res.status).toBe(200);
    });

    it('returns 200 when publishing DRAFT → ACTIVE via status field', async () => {
      mockUpdate.mockResolvedValue({ ...mockInternship, status: 'ACTIVE' });

      const app = createTestApp();
      const res = await supertest(app)
        .patch(`/api/v1/internships/${VALID_INTERNSHIP_UUID}`)
        .set('x-user-id', VALID_USER_UUID)
        .set('x-user-role', 'COMPANY')
        .send({ status: 'ACTIVE' });

      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe('ACTIVE');
    });

    it('returns 403 for non-owner COMPANY', async () => {
      mockUpdate.mockRejectedValue(new ForbiddenError('You do not have permission to update this internship'));

      const app = createTestApp();
      const res = await supertest(app)
        .patch(`/api/v1/internships/${VALID_INTERNSHIP_UUID}`)
        .set('x-user-id', OTHER_USER_UUID)
        .set('x-user-role', 'COMPANY')
        .send(updateBody);

      expect(res.status).toBe(403);
    });

    it('returns 401 without auth token', async () => {
      const app = createTestApp();
      const res = await supertest(app)
        .patch(`/api/v1/internships/${VALID_INTERNSHIP_UUID}`)
        .send(updateBody);

      expect(res.status).toBe(401);
    });

    it('returns 404 when internship not found', async () => {
      mockUpdate.mockRejectedValue(new NotFoundError('Internship not found'));

      const app = createTestApp();
      const res = await supertest(app)
        .patch(`/api/v1/internships/${NONEXISTENT_UUID}`)
        .set('x-user-id', ADMIN_UUID)
        .set('x-user-role', 'ADMIN')
        .send(updateBody);

      expect(res.status).toBe(404);
    });

    it('returns 400 when internshipId is not a valid UUID', async () => {
      const app = createTestApp();
      const res = await supertest(app)
        .patch('/api/v1/internships/not-a-uuid')
        .set('x-user-id', ADMIN_UUID)
        .set('x-user-role', 'ADMIN')
        .send(updateBody);

      expect(res.status).toBe(400);
    });

    it('returns 422 for invalid status transition (e.g., ACTIVE → DRAFT)', async () => {
      // status='DRAFT' passes Zod validation (valid enum value) but
      // ACTIVE→DRAFT is not a valid state machine transition.
      mockUpdate.mockRejectedValue(new UnprocessableError('Cannot transition internship from ACTIVE to DRAFT'));

      const app = createTestApp();
      const res = await supertest(app)
        .patch(`/api/v1/internships/${VALID_INTERNSHIP_UUID}`)
        .set('x-user-id', VALID_USER_UUID)
        .set('x-user-role', 'COMPANY')
        .send({ status: 'DRAFT' });

      expect(res.status).toBe(422);
      expect(res.body.error.code).toBe('UNPROCESSABLE_ENTITY');
    });

    it('returns 400 when status is CLOSED (schema rejects CLOSED — only allowed via DELETE)', async () => {
      // CLOSED is not a valid enum value in the update schema; PATCH with CLOSED returns 400.
      const app = createTestApp();
      const res = await supertest(app)
        .patch(`/api/v1/internships/${VALID_INTERNSHIP_UUID}`)
        .set('x-user-id', VALID_USER_UUID)
        .set('x-user-role', 'COMPANY')
        .send({ status: 'CLOSED' });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('returns 400 when minGrade > maxGrade in update', async () => {
      const app = createTestApp();
      const res = await supertest(app)
        .patch(`/api/v1/internships/${VALID_INTERNSHIP_UUID}`)
        .set('x-user-id', VALID_USER_UUID)
        .set('x-user-role', 'COMPANY')
        .send({ minGrade: 12, maxGrade: 9 });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });
  });

  describe('DELETE /internships/:internshipId', () => {
    it('returns 204 for OWNER (successful close)', async () => {
      mockClose.mockResolvedValue(undefined);

      const app = createTestApp();
      const res = await supertest(app)
        .delete(`/api/v1/internships/${VALID_INTERNSHIP_UUID}`)
        .set('x-user-id', VALID_USER_UUID)
        .set('x-user-role', 'COMPANY');

      expect(res.status).toBe(204);
      expect(res.body).toEqual({}); // No body for 204
    });

    it('returns 204 for ADMIN', async () => {
      mockClose.mockResolvedValue(undefined);

      const app = createTestApp();
      const res = await supertest(app)
        .delete(`/api/v1/internships/${VALID_INTERNSHIP_UUID}`)
        .set('x-user-id', ADMIN_UUID)
        .set('x-user-role', 'ADMIN');

      expect(res.status).toBe(204);
    });

    it('returns 403 for non-owner COMPANY', async () => {
      mockClose.mockRejectedValue(new ForbiddenError('You do not have permission to close this internship'));

      const app = createTestApp();
      const res = await supertest(app)
        .delete(`/api/v1/internships/${VALID_INTERNSHIP_UUID}`)
        .set('x-user-id', OTHER_USER_UUID)
        .set('x-user-role', 'COMPANY');

      expect(res.status).toBe(403);
    });

    it('returns 401 without auth token', async () => {
      const app = createTestApp();
      const res = await supertest(app)
        .delete(`/api/v1/internships/${VALID_INTERNSHIP_UUID}`);

      expect(res.status).toBe(401);
    });

    it('returns 404 when internship not found', async () => {
      mockClose.mockRejectedValue(new NotFoundError('Internship not found'));

      const app = createTestApp();
      const res = await supertest(app)
        .delete(`/api/v1/internships/${NONEXISTENT_UUID}`)
        .set('x-user-id', ADMIN_UUID)
        .set('x-user-role', 'ADMIN');

      expect(res.status).toBe(404);
    });

    it('returns 400 when internshipId is not a valid UUID', async () => {
      const app = createTestApp();
      const res = await supertest(app)
        .delete('/api/v1/internships/not-a-uuid')
        .set('x-user-id', ADMIN_UUID)
        .set('x-user-role', 'ADMIN');

      expect(res.status).toBe(400);
    });

    it('returns 422 when internship is DRAFT (not ACTIVE)', async () => {
      mockClose.mockRejectedValue(new UnprocessableError('Cannot close internship in DRAFT status. Only ACTIVE internships can be closed.'));

      const app = createTestApp();
      const res = await supertest(app)
        .delete(`/api/v1/internships/${VALID_INTERNSHIP_UUID}`)
        .set('x-user-id', VALID_USER_UUID)
        .set('x-user-role', 'COMPANY');

      expect(res.status).toBe(422);
    });

    it('returns 422 when there are accepted applications', async () => {
      mockClose.mockRejectedValue(new UnprocessableError('Cannot close internship with accepted applications. Resolve all accepted applications first.'));

      const app = createTestApp();
      const res = await supertest(app)
        .delete(`/api/v1/internships/${VALID_INTERNSHIP_UUID}`)
        .set('x-user-id', VALID_USER_UUID)
        .set('x-user-role', 'COMPANY');

      expect(res.status).toBe(422);
    });
  });

  describe('POST /internships/:internshipId/apply', () => {
    const applyBody = {
      coverLetter: 'I am passionate about this role',
    };

    it('returns 201 for STUDENT role', async () => {
      mockApply.mockResolvedValue(mockApplication);

      const app = createTestApp();
      const res = await supertest(app)
        .post(`/api/v1/internships/${VALID_INTERNSHIP_UUID}/apply`)
        .set('x-user-id', STUDENT_UUID)
        .set('x-user-role', 'STUDENT')
        .send(applyBody);

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveProperty('id');
      expect(res.body.data.status).toBe('PENDING');
    });

    it('returns 401 without auth token', async () => {
      const app = createTestApp();
      const res = await supertest(app)
        .post(`/api/v1/internships/${VALID_INTERNSHIP_UUID}/apply`)
        .send(applyBody);

      expect(res.status).toBe(401);
    });

    it('returns 403 for COMPANY role', async () => {
      const app = createTestApp();
      const res = await supertest(app)
        .post(`/api/v1/internships/${VALID_INTERNSHIP_UUID}/apply`)
        .set('x-user-id', VALID_USER_UUID)
        .set('x-user-role', 'COMPANY')
        .send(applyBody);

      expect(res.status).toBe(403);
    });

    it('returns 404 when internship not found', async () => {
      mockApply.mockRejectedValue(new NotFoundError('Internship not found or no longer accepting applications'));

      const app = createTestApp();
      const res = await supertest(app)
        .post(`/api/v1/internships/${VALID_INTERNSHIP_UUID}/apply`)
        .set('x-user-id', STUDENT_UUID)
        .set('x-user-role', 'STUDENT')
        .send(applyBody);

      expect(res.status).toBe(404);
    });

    it('returns 422 when student grade is below minGrade', async () => {
      mockApply.mockRejectedValue(new UnprocessableError('This internship requires a minimum grade of 11. Your current grade is 10.'));

      const app = createTestApp();
      const res = await supertest(app)
        .post(`/api/v1/internships/${VALID_INTERNSHIP_UUID}/apply`)
        .set('x-user-id', STUDENT_UUID)
        .set('x-user-role', 'STUDENT')
        .send(applyBody);

      expect(res.status).toBe(422);
    });

    it('returns 422 when deadline has passed', async () => {
      mockApply.mockRejectedValue(new UnprocessableError('The application deadline for this internship has passed'));

      const app = createTestApp();
      const res = await supertest(app)
        .post(`/api/v1/internships/${VALID_INTERNSHIP_UUID}/apply`)
        .set('x-user-id', STUDENT_UUID)
        .set('x-user-role', 'STUDENT')
        .send(applyBody);

      expect(res.status).toBe(422);
    });

    it('returns 422 when student has no resume', async () => {
      mockApply.mockRejectedValue(new UnprocessableError('A resume is required to apply. Please upload your resume before applying.'));

      const app = createTestApp();
      const res = await supertest(app)
        .post(`/api/v1/internships/${VALID_INTERNSHIP_UUID}/apply`)
        .set('x-user-id', STUDENT_UUID)
        .set('x-user-role', 'STUDENT')
        .send(applyBody);

      expect(res.status).toBe(422);
      expect(res.body.error.code).toBe('UNPROCESSABLE_ENTITY');
    });

    it('returns 409 when already applied', async () => {
      mockApply.mockRejectedValue(new ConflictError('You have already applied to this internship'));

      const app = createTestApp();
      const res = await supertest(app)
        .post(`/api/v1/internships/${VALID_INTERNSHIP_UUID}/apply`)
        .set('x-user-id', STUDENT_UUID)
        .set('x-user-role', 'STUDENT')
        .send(applyBody);

      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe('CONFLICT');
    });

    it('returns 400 when internshipId is not a valid UUID', async () => {
      const app = createTestApp();
      const res = await supertest(app)
        .post('/api/v1/internships/not-a-uuid/apply')
        .set('x-user-id', STUDENT_UUID)
        .set('x-user-role', 'STUDENT')
        .send(applyBody);

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('returns 400 when coverLetter exceeds max length', async () => {
      const app = createTestApp();
      const res = await supertest(app)
        .post(`/api/v1/internships/${VALID_INTERNSHIP_UUID}/apply`)
        .set('x-user-id', STUDENT_UUID)
        .set('x-user-role', 'STUDENT')
        .send({ coverLetter: 'a'.repeat(2001) });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });
  });
});
