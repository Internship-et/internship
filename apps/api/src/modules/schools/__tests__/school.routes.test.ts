// ─────────────────────────────────────────────────────────────
// School Routes — Integration Tests
// Uses supertest with mocked service layer and mocked auth middleware.
// Tests cover:
//  - Public listing (GET /schools) with validation
//  - Public profile (GET /schools/:schoolId)
//  - School creation (POST /schools) with auth+role checks
//  - School update (PATCH /schools/:schoolId) with ownership
//  - Student verification (POST /schools/:schoolId/verify-student)
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
        role: role ?? 'SCHOOL',
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

// Mock the service layer
vi.mock('../school.service.js', () => ({}));

import * as schoolService from '../school.service.js';
import schoolRoutes from '../school.routes.js';
import { errorHandler } from '../../../shared/middleware/error.middleware.js';

// ─── Test app factory ──────────────────────────────────────

function createTestApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/v1', schoolRoutes);
  app.use(errorHandler);
  return app;
}

// ─── Test UUIDs ────────────────────────────────────────────

const VALID_SCHOOL_UUID = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';
const VALID_USER_UUID = 'b2c3d4e5-f6a7-8901-bcde-f12345678901';
const ADMIN_UUID = 'c3d4e5f6-a7b8-4120-8def-123456789012';
const OTHER_USER_UUID = 'd4e5f6a7-b8c9-4561-9efa-234567890123';
const NONEXISTENT_UUID = 'f47ac10b-58cc-4372-a567-0e02b2c3d479';
const VALID_STUDENT_UUID = 'e5f6a7b8-c9d0-4321-abef-345678901234';

// ─── Mock service implementations ──────────────────────────

const mockList = vi.fn();
const mockGetById = vi.fn();
const mockCreate = vi.fn();
const mockUpdate = vi.fn();
const mockVerifyStudent = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();

  vi.mocked(schoolService).list = mockList;
  vi.mocked(schoolService).getById = mockGetById;
  vi.mocked(schoolService).create = mockCreate;
  vi.mocked(schoolService).update = mockUpdate;
  vi.mocked(schoolService).verifyStudent = mockVerifyStudent;
});

// ─── Tests ─────────────────────────────────────────────────

describe('SchoolRoutes', () => {
  describe('GET /schools', () => {
    it('returns 200 with data (public)', async () => {
      mockList.mockResolvedValue({
        data: [
          {
            id: VALID_SCHOOL_UUID,
            name: 'Bole High School',
            type: 'PUBLIC',
            city: 'Addis Ababa',
            address: null,
            phone: '+251111234567',
            email: null,
            website: null,
            principal: null,
            gradesOffered: [9, 10, 11, 12],
            logoUrl: null,
            isVerified: false,
            createdAt: new Date('2025-01-15').toISOString(),
            updatedAt: new Date('2025-01-15').toISOString(),
            studentCount: 5,
            verifiedStudentCount: 3,
          },
        ],
        meta: { page: 1, pageSize: 20, total: 1, hasMore: false },
      });

      const app = createTestApp();
      const res = await supertest(app).get('/api/v1/schools');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveLength(1);
      expect(res.body.meta.total).toBe(1);
    });

    it('does not expose userId, licenseNumber in list response', async () => {
      const publicListEntry = {
        id: VALID_SCHOOL_UUID,
        name: 'Bole High School',
        type: 'PUBLIC',
        city: 'Addis Ababa',
        address: null,
        phone: '+251111234567',
        email: null,
        website: null,
        principal: null,
        gradesOffered: [9, 10, 11, 12],
        logoUrl: null,
        isVerified: false,
        createdAt: new Date('2025-01-15').toISOString(),
        updatedAt: new Date('2025-01-15').toISOString(),
        studentCount: 5,
        verifiedStudentCount: 3,
      };
      mockList.mockResolvedValue({
        data: [publicListEntry],
        meta: { page: 1, pageSize: 20, total: 1, hasMore: false },
      });

      const app = createTestApp();
      const res = await supertest(app).get('/api/v1/schools');

      expect(res.status).toBe(200);
      const entry = res.body.data[0];
      expect(entry).not.toHaveProperty('userId');
      expect(entry).not.toHaveProperty('licenseNumber');
    });

    it('accepts sort=updatedAt (200)', async () => {
      mockList.mockResolvedValue({
        data: [],
        meta: { page: 1, pageSize: 20, total: 0, hasMore: false },
      });

      const app = createTestApp();
      const res = await supertest(app)
        .get('/api/v1/schools')
        .query({ sort: 'updatedAt', order: 'desc' });

      expect(res.status).toBe(200);
    });

    it('returns 400 when sort is an invalid field', async () => {
      const app = createTestApp();
      const res = await supertest(app)
        .get('/api/v1/schools')
        .query({ sort: 'invalidField' });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('returns 400 when type is an invalid value', async () => {
      const app = createTestApp();
      const res = await supertest(app)
        .get('/api/v1/schools')
        .query({ type: 'INVALID' });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('returns 200 when type is PUBLIC', async () => {
      mockList.mockResolvedValue({
        data: [],
        meta: { page: 1, pageSize: 20, total: 0, hasMore: false },
      });

      const app = createTestApp();
      const res = await supertest(app)
        .get('/api/v1/schools')
        .query({ type: 'PUBLIC' });

      expect(res.status).toBe(200);
    });
  });

  describe('GET /schools/:schoolId', () => {
    it('returns 200 with profile (public)', async () => {
      mockGetById.mockResolvedValue({
        id: VALID_SCHOOL_UUID,
        name: 'Bole High School',
        type: 'PUBLIC',
        city: 'Addis Ababa',
        address: null,
        phone: '+251111234567',
        email: null,
        website: null,
        principal: null,
        gradesOffered: [9, 10, 11, 12],
        logoUrl: null,
        isVerified: false,
        createdAt: new Date('2025-01-15').toISOString(),
        updatedAt: new Date('2025-01-15').toISOString(),
        studentCount: 5,
        verifiedStudentCount: 3,
      });

      const app = createTestApp();
      const res = await supertest(app).get(`/api/v1/schools/${VALID_SCHOOL_UUID}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveProperty('studentCount', 5);
      expect(res.body.data).toHaveProperty('verifiedStudentCount', 3);
    });

    it('does not expose userId, licenseNumber in detail response', async () => {
      mockGetById.mockResolvedValue({
        id: VALID_SCHOOL_UUID,
        name: 'Bole High School',
        type: 'PUBLIC',
        city: 'Addis Ababa',
        address: null,
        phone: '+251111234567',
        email: null,
        website: null,
        principal: null,
        gradesOffered: [9, 10, 11, 12],
        logoUrl: null,
        isVerified: false,
        createdAt: new Date('2025-01-15').toISOString(),
        updatedAt: new Date('2025-01-15').toISOString(),
        studentCount: 5,
        verifiedStudentCount: 3,
      });

      const app = createTestApp();
      const res = await supertest(app).get(`/api/v1/schools/${VALID_SCHOOL_UUID}`);

      expect(res.status).toBe(200);
      const detail = res.body.data;
      expect(detail).not.toHaveProperty('userId');
      expect(detail).not.toHaveProperty('licenseNumber');
    });

    it('returns 404 when school not found', async () => {
      mockGetById.mockRejectedValue(new NotFoundError('School profile not found'));

      const app = createTestApp();
      const res = await supertest(app).get(`/api/v1/schools/${NONEXISTENT_UUID}`);

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
    });

    it('returns 400 when schoolId is not a valid UUID', async () => {
      const app = createTestApp();
      const res = await supertest(app).get('/api/v1/schools/not-a-uuid');

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });
  });

  describe('POST /schools', () => {
    const validBody = {
      name: 'New School',
      type: 'PUBLIC',
      city: 'Addis Ababa',
    };

    it('returns 201 for SCHOOL role', async () => {
      mockCreate.mockResolvedValue({
        id: VALID_SCHOOL_UUID,
        name: 'New School',
        type: 'PUBLIC',
        city: 'Addis Ababa',
        studentCount: 0,
        verifiedStudentCount: 0,
      });

      const app = createTestApp();
      const res = await supertest(app)
        .post('/api/v1/schools')
        .set('x-user-id', VALID_USER_UUID)
        .set('x-user-role', 'SCHOOL')
        .send(validBody);

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
    });

    it('returns 201 for ADMIN role', async () => {
      mockCreate.mockResolvedValue({
        id: VALID_SCHOOL_UUID,
        name: 'New School',
        type: 'PUBLIC',
        city: 'Addis Ababa',
        studentCount: 0,
        verifiedStudentCount: 0,
      });

      const app = createTestApp();
      const res = await supertest(app)
        .post('/api/v1/schools')
        .set('x-user-id', ADMIN_UUID)
        .set('x-user-role', 'ADMIN')
        .send(validBody);

      expect(res.status).toBe(201);
    });

    it('returns 401 without auth token', async () => {
      const app = createTestApp();
      const res = await supertest(app)
        .post('/api/v1/schools')
        .send(validBody);

      expect(res.status).toBe(401);
    });

    it('returns 403 for STUDENT role', async () => {
      const app = createTestApp();
      const res = await supertest(app)
        .post('/api/v1/schools')
        .set('x-user-id', OTHER_USER_UUID)
        .set('x-user-role', 'STUDENT')
        .send(validBody);

      expect(res.status).toBe(403);
    });

    it('returns 403 for COMPANY role', async () => {
      const app = createTestApp();
      const res = await supertest(app)
        .post('/api/v1/schools')
        .set('x-user-id', OTHER_USER_UUID)
        .set('x-user-role', 'COMPANY')
        .send(validBody);

      expect(res.status).toBe(403);
    });

    it('returns 409 when user already has a school', async () => {
      mockCreate.mockRejectedValue(new ConflictError('User already has a school profile'));

      const app = createTestApp();
      const res = await supertest(app)
        .post('/api/v1/schools')
        .set('x-user-id', VALID_USER_UUID)
        .set('x-user-role', 'SCHOOL')
        .send(validBody);

      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe('CONFLICT');
    });

    it('returns 409 when school name already exists', async () => {
      mockCreate.mockRejectedValue(new ConflictError('School name already in use'));

      const app = createTestApp();
      const res = await supertest(app)
        .post('/api/v1/schools')
        .set('x-user-id', VALID_USER_UUID)
        .set('x-user-role', 'SCHOOL')
        .send(validBody);

      expect(res.status).toBe(409);
    });

    it('returns 400 with invalid body (missing required fields)', async () => {
      const app = createTestApp();
      const res = await supertest(app)
        .post('/api/v1/schools')
        .set('x-user-id', VALID_USER_UUID)
        .set('x-user-role', 'SCHOOL')
        .send({ name: 'Incomplete' }); // Missing type, city

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('returns 400 when type is invalid', async () => {
      const app = createTestApp();
      const res = await supertest(app)
        .post('/api/v1/schools')
        .set('x-user-id', VALID_USER_UUID)
        .set('x-user-role', 'SCHOOL')
        .send({ name: 'Test School', type: 'INVALID', city: 'Addis Ababa' });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });
  });

  describe('PATCH /schools/:schoolId', () => {
    const updateBody = { city: 'Adama' };

    it('returns 200 for OWNER', async () => {
      mockUpdate.mockResolvedValue({
        id: VALID_SCHOOL_UUID,
        name: 'Bole High School',
        type: 'PUBLIC',
        city: 'Adama',
        studentCount: 5,
        verifiedStudentCount: 3,
      });

      const app = createTestApp();
      const res = await supertest(app)
        .patch(`/api/v1/schools/${VALID_SCHOOL_UUID}`)
        .set('x-user-id', VALID_USER_UUID)
        .set('x-user-role', 'SCHOOL')
        .send(updateBody);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.city).toBe('Adama');
    });

    it('returns 200 for ADMIN', async () => {
      mockUpdate.mockResolvedValue({
        id: VALID_SCHOOL_UUID,
        name: 'Bole High School',
        type: 'PUBLIC',
        city: 'Adama',
        studentCount: 5,
        verifiedStudentCount: 3,
      });

      const app = createTestApp();
      const res = await supertest(app)
        .patch(`/api/v1/schools/${VALID_SCHOOL_UUID}`)
        .set('x-user-id', ADMIN_UUID)
        .set('x-user-role', 'ADMIN')
        .send(updateBody);

      expect(res.status).toBe(200);
    });

    it('returns 403 for non-owner SCHOOL', async () => {
      mockUpdate.mockRejectedValue(new ForbiddenError('You do not have permission to update this profile'));

      const app = createTestApp();
      const res = await supertest(app)
        .patch(`/api/v1/schools/${VALID_SCHOOL_UUID}`)
        .set('x-user-id', OTHER_USER_UUID)
        .set('x-user-role', 'SCHOOL')
        .send(updateBody);

      expect(res.status).toBe(403);
    });

    it('returns 403 for STUDENT role', async () => {
      mockUpdate.mockRejectedValue(new ForbiddenError('You do not have permission to update this profile'));

      const app = createTestApp();
      const res = await supertest(app)
        .patch(`/api/v1/schools/${VALID_SCHOOL_UUID}`)
        .set('x-user-id', OTHER_USER_UUID)
        .set('x-user-role', 'STUDENT')
        .send(updateBody);

      expect(res.status).toBe(403);
    });

    it('returns 401 without auth token', async () => {
      const app = createTestApp();
      const res = await supertest(app)
        .patch(`/api/v1/schools/${VALID_SCHOOL_UUID}`)
        .send(updateBody);

      expect(res.status).toBe(401);
    });

    it('returns 404 when school not found', async () => {
      mockUpdate.mockRejectedValue(new NotFoundError('School profile not found'));

      const app = createTestApp();
      const res = await supertest(app)
        .patch(`/api/v1/schools/${NONEXISTENT_UUID}`)
        .set('x-user-id', ADMIN_UUID)
        .set('x-user-role', 'ADMIN')
        .send(updateBody);

      expect(res.status).toBe(404);
    });

    it('returns 409 when name already in use', async () => {
      mockUpdate.mockRejectedValue(new ConflictError('School name already in use'));

      const app = createTestApp();
      const res = await supertest(app)
        .patch(`/api/v1/schools/${VALID_SCHOOL_UUID}`)
        .set('x-user-id', VALID_USER_UUID)
        .set('x-user-role', 'SCHOOL')
        .send({ name: 'Taken Name' });

      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe('CONFLICT');
    });

    it('returns 400 when schoolId is not a valid UUID', async () => {
      const app = createTestApp();
      const res = await supertest(app)
        .patch('/api/v1/schools/not-a-uuid')
        .set('x-user-id', ADMIN_UUID)
        .set('x-user-role', 'ADMIN')
        .send(updateBody);

      expect(res.status).toBe(400);
    });
  });

  describe('POST /schools/:schoolId/verify-student', () => {
    const verifyBody = {
      studentId: VALID_STUDENT_UUID,
      isEnrolled: true,
      grade: 10,
    };

    it('returns 200 for OWNER (SCHOOL role)', async () => {
      mockVerifyStudent.mockResolvedValue({
        studentId: VALID_STUDENT_UUID,
        schoolId: VALID_SCHOOL_UUID,
        isVerified: true,
        grade: 10,
        verifiedAt: new Date('2025-02-01').toISOString(),
        verifiedBy: VALID_USER_UUID,
      });

      const app = createTestApp();
      const res = await supertest(app)
        .post(`/api/v1/schools/${VALID_SCHOOL_UUID}/verify-student`)
        .set('x-user-id', VALID_USER_UUID)
        .set('x-user-role', 'SCHOOL')
        .send(verifyBody);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.isVerified).toBe(true);
      expect(res.body.data.studentId).toBe(VALID_STUDENT_UUID);
    });

    it('returns 200 for ADMIN role', async () => {
      mockVerifyStudent.mockResolvedValue({
        studentId: VALID_STUDENT_UUID,
        schoolId: VALID_SCHOOL_UUID,
        isVerified: true,
        grade: 10,
        verifiedAt: new Date('2025-02-01').toISOString(),
        verifiedBy: ADMIN_UUID,
      });

      const app = createTestApp();
      const res = await supertest(app)
        .post(`/api/v1/schools/${VALID_SCHOOL_UUID}/verify-student`)
        .set('x-user-id', ADMIN_UUID)
        .set('x-user-role', 'ADMIN')
        .send(verifyBody);

      expect(res.status).toBe(200);
    });

    it('returns 401 without auth token', async () => {
      const app = createTestApp();
      const res = await supertest(app)
        .post(`/api/v1/schools/${VALID_SCHOOL_UUID}/verify-student`)
        .send(verifyBody);

      expect(res.status).toBe(401);
    });

    it('passes through to service for STUDENT role (role check is in service)', async () => {
      mockVerifyStudent.mockResolvedValue({
        studentId: VALID_STUDENT_UUID,
        schoolId: VALID_SCHOOL_UUID,
        isVerified: true,
        grade: 10,
        verifiedAt: new Date('2025-02-01').toISOString(),
        verifiedBy: OTHER_USER_UUID,
      });

      const app = createTestApp();
      const res = await supertest(app)
        .post(`/api/v1/schools/${VALID_SCHOOL_UUID}/verify-student`)
        .set('x-user-id', OTHER_USER_UUID)
        .set('x-user-role', 'STUDENT')
        .send(verifyBody);

      expect(res.status).toBe(200);
      expect(mockVerifyStudent).toHaveBeenCalledWith(
        VALID_SCHOOL_UUID,
        verifyBody,
        OTHER_USER_UUID,
        'STUDENT',
      );
    });

    it('returns 404 when school not found', async () => {
      mockVerifyStudent.mockRejectedValue(new NotFoundError('School profile not found'));

      const app = createTestApp();
      const res = await supertest(app)
        .post(`/api/v1/schools/${NONEXISTENT_UUID}/verify-student`)
        .set('x-user-id', ADMIN_UUID)
        .set('x-user-role', 'ADMIN')
        .send(verifyBody);

      expect(res.status).toBe(404);
    });

    it('returns 404 when student not found', async () => {
      mockVerifyStudent.mockRejectedValue(new NotFoundError('Student profile not found'));

      const app = createTestApp();
      const res = await supertest(app)
        .post(`/api/v1/schools/${VALID_SCHOOL_UUID}/verify-student`)
        .set('x-user-id', VALID_USER_UUID)
        .set('x-user-role', 'SCHOOL')
        .send(verifyBody);

      expect(res.status).toBe(404);
    });

    it('returns 422 when student not linked to this school', async () => {
      mockVerifyStudent.mockRejectedValue(new UnprocessableError('Student is not enrolled at this school'));

      const app = createTestApp();
      const res = await supertest(app)
        .post(`/api/v1/schools/${VALID_SCHOOL_UUID}/verify-student`)
        .set('x-user-id', VALID_USER_UUID)
        .set('x-user-role', 'SCHOOL')
        .send(verifyBody);

      expect(res.status).toBe(422);
      expect(res.body.error.code).toBe('UNPROCESSABLE_ENTITY');
    });

    it('returns 400 when schoolId is not a valid UUID', async () => {
      const app = createTestApp();
      const res = await supertest(app)
        .post('/api/v1/schools/not-a-uuid/verify-student')
        .set('x-user-id', ADMIN_UUID)
        .set('x-user-role', 'ADMIN')
        .send(verifyBody);

      expect(res.status).toBe(400);
    });

    it('returns 400 when studentId is not a valid UUID', async () => {
      const app = createTestApp();
      const res = await supertest(app)
        .post(`/api/v1/schools/${VALID_SCHOOL_UUID}/verify-student`)
        .set('x-user-id', ADMIN_UUID)
        .set('x-user-role', 'ADMIN')
        .send({ studentId: 'not-a-uuid', isEnrolled: true });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('returns 400 when grade is required but missing (isEnrolled=true)', async () => {
      const app = createTestApp();
      const res = await supertest(app)
        .post(`/api/v1/schools/${VALID_SCHOOL_UUID}/verify-student`)
        .set('x-user-id', ADMIN_UUID)
        .set('x-user-role', 'ADMIN')
        .send({ studentId: VALID_STUDENT_UUID, isEnrolled: true });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('accepts isEnrolled=false without grade (revocation)', async () => {
      mockVerifyStudent.mockResolvedValue({
        studentId: VALID_STUDENT_UUID,
        schoolId: VALID_SCHOOL_UUID,
        isVerified: false,
        grade: null,
        verifiedAt: new Date('2025-02-02').toISOString(),
        verifiedBy: ADMIN_UUID,
      });

      const app = createTestApp();
      const res = await supertest(app)
        .post(`/api/v1/schools/${VALID_SCHOOL_UUID}/verify-student`)
        .set('x-user-id', ADMIN_UUID)
        .set('x-user-role', 'ADMIN')
        .send({ studentId: VALID_STUDENT_UUID, isEnrolled: false });

      expect(res.status).toBe(200);
      expect(res.body.data.isVerified).toBe(false);
    });
  });
});
