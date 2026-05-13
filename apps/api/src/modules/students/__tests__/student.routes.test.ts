// ─────────────────────────────────────────────────────────────
// Student Routes — Integration Tests
// Uses supertest with mocked service layer and mocked auth middleware.
// Tests cover:
//  - Admin listing (GET /students)
//  - Self profile (GET /students/me)
//  - Self upsert (PATCH /students/me) with 201/200 status
//  - Profile by UUID (GET /students/:studentId)
//  - Update by UUID (PATCH /students/:studentId) with strict schema
//  - Application listing (GET /students/:studentId/applications)
// ─────────────────────────────────────────────────────────────

import { describe, it, expect, vi, beforeEach } from 'vitest';
import express, { type Request, type Response, type NextFunction } from 'express';
import supertest from 'supertest';
import { UnauthorizedError, ForbiddenError, NotFoundError } from '../../../shared/errors/app-error.js';

// ─── Mock auth middleware (BEFORE importing routes) ─────────
// The routes import { authenticate, authorize } from auth.middleware.
// We mock the entire module so the routes use our test doubles.

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

// Mock the service layer
vi.mock('../student.service.js', () => ({}));

import * as studentService from '../student.service.js';
import studentRoutes from '../student.routes.js';
import { errorHandler } from '../../../shared/middleware/error.middleware.js';

// ─── Test app factory ──────────────────────────────────────

/**
 * Creates a minimal Express app with student routes mounted.
 * Uses mocked authenticate/authorize from auth.middleware.js.
 */
function createTestApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/v1', studentRoutes);
  app.use(errorHandler);
  return app;
}

// ─── Test UUIDs ────────────────────────────────────────────

const VALID_STUDENT_UUID = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';
const VALID_USER_UUID = 'b2c3d4e5-f6a7-8901-bcde-f12345678901';
const ADMIN_UUID = 'c3d4e5f6-a7b8-9012-cdef-123456789012';
const OTHER_USER_UUID = 'd4e5f6a7-b8c9-0123-defa-234567890123';
const NONEXISTENT_UUID = 'f47ac10b-58cc-4372-a567-0e02b2c3d479';

// ─── Fixtures ──────────────────────────────────────────────

const mockProfile = {
  id: VALID_STUDENT_UUID,
  userId: VALID_USER_UUID,
  schoolId: null,
  grade: 10,
  dateOfBirth: new Date('2006-05-15').toISOString(),
  bio: 'Aspiring software engineer',
  skills: ['JavaScript', 'Python'],
  interests: ['Coding', 'Robotics'],
  languages: ['English', 'Amharic'],
  resumeUrl: null,
  profileImageUrl: null,
  isSchoolVerified: false,
  createdAt: new Date('2025-01-01').toISOString(),
  updatedAt: new Date('2025-01-15').toISOString(),
  user: {
    id: VALID_USER_UUID,
    email: 'student@example.com',
    firstName: 'Abebe',
    lastName: 'Kebede',
    role: 'STUDENT',
    phone: '+251911111111',
  },
  school: null,
};

const mockApplication = {
  id: 'app-uuid-1',
  internshipId: 'internship-uuid-1',
  studentId: VALID_STUDENT_UUID,
  status: 'PENDING',
  coverLetter: 'I am passionate about...',
  additionalInfo: null,
  appliedAt: new Date('2025-02-01').toISOString(),
  updatedAt: new Date('2025-02-01').toISOString(),
  internship: {
    id: 'internship-uuid-1',
    title: 'Software Engineering Intern',
    description: 'Join our team...',
    type: 'REMOTE',
    city: 'Addis Ababa',
    status: 'ACTIVE',
    company: {
      id: 'company-uuid-1',
      name: 'Tech Corp',
      logoUrl: null,
      city: 'Addis Ababa',
    },
  },
};

// ─── Mock service implementations ──────────────────────────

const mockList = vi.fn();
const mockGetById = vi.fn();
const mockGetMyProfile = vi.fn();
const mockUpsertMyProfile = vi.fn();
const mockUpdateByStudentId = vi.fn();
const mockGetApplications = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();

  vi.mocked(studentService).list = mockList;
  vi.mocked(studentService).getById = mockGetById;
  vi.mocked(studentService).getMyProfile = mockGetMyProfile;
  vi.mocked(studentService).upsertMyProfile = mockUpsertMyProfile;
  vi.mocked(studentService).updateByStudentId = mockUpdateByStudentId;
  vi.mocked(studentService).getApplications = mockGetApplications;
});

// ─── Tests ─────────────────────────────────────────────────

describe('StudentRoutes', () => {
  describe('GET /students', () => {
    it('returns 200 with data for ADMIN', async () => {
      mockList.mockResolvedValue({
        data: [mockProfile],
        meta: { page: 1, pageSize: 20, total: 1, hasMore: false },
      });

      const app = createTestApp();
      const res = await supertest(app)
        .get('/api/v1/students')
        .set('x-user-id', ADMIN_UUID)
        .set('x-user-role', 'ADMIN');


      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveLength(1);
      expect(res.body.meta.total).toBe(1);
    });

    it('returns 403 for STUDENT role', async () => {
      const app = createTestApp();
      const res = await supertest(app)
        .get('/api/v1/students')
        .set('x-user-id', VALID_USER_UUID)
        .set('x-user-role', 'STUDENT');

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
    });

    it('returns 401 without auth token', async () => {
      const app = createTestApp();
      const res = await supertest(app)
        .get('/api/v1/students');

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });

    it('returns 400 when sort is an invalid field', async () => {
      const app = createTestApp();
      const res = await supertest(app)
        .get('/api/v1/students')
        .query({ sort: 'invalidField' })
        .set('x-user-id', ADMIN_UUID)
        .set('x-user-role', 'ADMIN');

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });
  });

  describe('GET /students/me', () => {
    it('returns 200 with own profile for STUDENT', async () => {
      mockGetMyProfile.mockResolvedValue(mockProfile);

      const app = createTestApp();
      const res = await supertest(app)
        .get('/api/v1/students/me')
        .set('x-user-id', VALID_USER_UUID)
        .set('x-user-role', 'STUDENT');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toEqual(mockProfile);
    });

    it('returns 401 without auth token', async () => {
      const app = createTestApp();
      const res = await supertest(app)
        .get('/api/v1/students/me');

      expect(res.status).toBe(401);
    });
  });

  describe('PATCH /students/me', () => {
    it('returns 201 when creating profile on first-time setup (STUDENT)', async () => {
      mockUpsertMyProfile.mockResolvedValue({
        profile: mockProfile,
        created: true,
      });

      const app = createTestApp();
      const res = await supertest(app)
        .patch('/api/v1/students/me')
        .set('x-user-id', VALID_USER_UUID)
        .set('x-user-role', 'STUDENT')
        .send({ firstName: 'Abebe', bio: 'Hello' });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toEqual(mockProfile);
      expect(mockUpsertMyProfile).toHaveBeenCalledWith(
        VALID_USER_UUID,
        'STUDENT',
        { firstName: 'Abebe', bio: 'Hello' },
      );
    });

    it('returns 200 when updating existing profile (STUDENT)', async () => {
      mockUpsertMyProfile.mockResolvedValue({
        profile: mockProfile,
        created: false,
      });

      const app = createTestApp();
      const res = await supertest(app)
        .patch('/api/v1/students/me')
        .set('x-user-id', VALID_USER_UUID)
        .set('x-user-role', 'STUDENT')
        .send({ bio: 'Updated bio' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('returns 400 with invalid data', async () => {
      const app = createTestApp();
      const res = await supertest(app)
        .patch('/api/v1/students/me')
        .set('x-user-id', VALID_USER_UUID)
        .set('x-user-role', 'STUDENT')
        .send({ grade: 'not-a-number' }); // Invalid grade type

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it('returns 401 without auth token', async () => {
      const app = createTestApp();
      const res = await supertest(app)
        .patch('/api/v1/students/me')
        .send({ bio: 'test' });

      expect(res.status).toBe(401);
    });
  });

  describe('GET /students/:studentId', () => {
    it('returns 200 for SELF with full fields', async () => {
      mockGetById.mockResolvedValue(mockProfile);

      const app = createTestApp();
      const res = await supertest(app)
        .get(`/api/v1/students/${VALID_STUDENT_UUID}`)
        .set('x-user-id', VALID_USER_UUID)
        .set('x-user-role', 'STUDENT');

      expect(res.status).toBe(200);
      expect(res.body.data).toEqual(mockProfile);
    });

    it('returns 200 for ADMIN', async () => {
      mockGetById.mockResolvedValue(mockProfile);

      const app = createTestApp();
      const res = await supertest(app)
        .get(`/api/v1/students/${VALID_STUDENT_UUID}`)
        .set('x-user-id', ADMIN_UUID)
        .set('x-user-role', 'ADMIN');

      expect(res.status).toBe(200);
    });

    it('returns 403 for non-SELF, non-ADMIN', async () => {
      mockGetById.mockRejectedValue(
        new ForbiddenError('You do not have permission to view this profile'),
      );

      const app = createTestApp();
      const res = await supertest(app)
        .get(`/api/v1/students/${VALID_STUDENT_UUID}`)
        .set('x-user-id', OTHER_USER_UUID)
        .set('x-user-role', 'COMPANY');

      expect(res.status).toBe(403);
    });

    it('returns 401 without auth token', async () => {
      const app = createTestApp();
      const res = await supertest(app)
        .get(`/api/v1/students/${VALID_STUDENT_UUID}`);

      expect(res.status).toBe(401);
    });

    it('returns 404 when student not found', async () => {
      mockGetById.mockRejectedValue(
        new NotFoundError('Student profile not found'),
      );

      const app = createTestApp();
      const res = await supertest(app)
        .get(`/api/v1/students/${NONEXISTENT_UUID}`)
        .set('x-user-id', ADMIN_UUID)
        .set('x-user-role', 'ADMIN');

      expect(res.status).toBe(404);
    });

    it('returns 400 when studentId is not a valid UUID', async () => {
      const app = createTestApp();
      const res = await supertest(app)
        .get('/api/v1/students/not-a-uuid')
        .set('x-user-id', ADMIN_UUID)
        .set('x-user-role', 'ADMIN');

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });
  });

  describe('PATCH /students/:studentId', () => {
    it('returns 200 for SELF update', async () => {
      const updatedProfile = { ...mockProfile, bio: 'Updated bio' };
      mockUpdateByStudentId.mockResolvedValue(updatedProfile);

      const app = createTestApp();
      const res = await supertest(app)
        .patch(`/api/v1/students/${VALID_STUDENT_UUID}`)
        .set('x-user-id', VALID_USER_UUID)
        .set('x-user-role', 'STUDENT')
        .send({ bio: 'Updated bio' });

      expect(res.status).toBe(200);
      expect(res.body.data.bio).toBe('Updated bio');
    });

    it('returns 200 for ADMIN update', async () => {
      const updatedProfile = { ...mockProfile, grade: 11 };
      mockUpdateByStudentId.mockResolvedValue(updatedProfile);

      const app = createTestApp();
      const res = await supertest(app)
        .patch(`/api/v1/students/${VALID_STUDENT_UUID}`)
        .set('x-user-id', ADMIN_UUID)
        .set('x-user-role', 'ADMIN')
        .send({ grade: 11 });

      expect(res.status).toBe(200);
      expect(res.body.data.grade).toBe(11);
    });

    it('returns 403 for non-owner, non-ADMIN', async () => {
      mockUpdateByStudentId.mockRejectedValue(
        new ForbiddenError('You do not have permission to update this profile'),
      );

      const app = createTestApp();
      const res = await supertest(app)
        .patch(`/api/v1/students/${VALID_STUDENT_UUID}`)
        .set('x-user-id', OTHER_USER_UUID)
        .set('x-user-role', 'COMPANY')
        .send({ bio: 'test' });

      expect(res.status).toBe(403);
    });

    it('returns 401 without auth token', async () => {
      const app = createTestApp();
      const res = await supertest(app)
        .patch(`/api/v1/students/${VALID_STUDENT_UUID}`)
        .send({ bio: 'test' });

      expect(res.status).toBe(401);
    });

    it('returns 400 with invalid data (e.g., grade out of range)', async () => {
      const app = createTestApp();
      const res = await supertest(app)
        .patch(`/api/v1/students/${VALID_STUDENT_UUID}`)
        .set('x-user-id', VALID_USER_UUID)
        .set('x-user-role', 'STUDENT')
        .send({ grade: 99 }); // Out of range (9-12)

      expect(res.status).toBe(400);
    });

    it('returns 400 when studentId is not a valid UUID', async () => {
      const app = createTestApp();
      const res = await supertest(app)
        .patch('/api/v1/students/not-a-uuid')
        .set('x-user-id', ADMIN_UUID)
        .set('x-user-role', 'ADMIN')
        .send({ bio: 'test' });

      expect(res.status).toBe(400);
    });

    it('returns 404 when student profile does not exist', async () => {
      mockUpdateByStudentId.mockRejectedValue(
        new NotFoundError('Student profile not found'),
      );

      const app = createTestApp();
      const res = await supertest(app)
        .patch(`/api/v1/students/${NONEXISTENT_UUID}`)
        .set('x-user-id', VALID_USER_UUID)
        .set('x-user-role', 'STUDENT')
        .send({ bio: 'test' });

      expect(res.status).toBe(404);
    });

    // ─── Strict schema rejection tests ───────────────────────

    it('returns 400 when body contains firstName (unknown field rejected by .strict())', async () => {
      const app = createTestApp();
      const res = await supertest(app)
        .patch(`/api/v1/students/${VALID_STUDENT_UUID}`)
        .set('x-user-id', VALID_USER_UUID)
        .set('x-user-role', 'STUDENT')
        .send({ firstName: 'NewName' });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('returns 400 when body contains lastName (unknown field rejected by .strict())', async () => {
      const app = createTestApp();
      const res = await supertest(app)
        .patch(`/api/v1/students/${VALID_STUDENT_UUID}`)
        .set('x-user-id', VALID_USER_UUID)
        .set('x-user-role', 'STUDENT')
        .send({ lastName: 'NewLastName' });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('returns 400 when body contains phone (unknown field rejected by .strict())', async () => {
      const app = createTestApp();
      const res = await supertest(app)
        .patch(`/api/v1/students/${VALID_STUDENT_UUID}`)
        .set('x-user-id', VALID_USER_UUID)
        .set('x-user-role', 'STUDENT')
        .send({ phone: '+251922222222' });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });
  });

  describe('GET /students/:studentId/applications', () => {
    it('returns 200 for SELF', async () => {
      mockGetApplications.mockResolvedValue({
        data: [mockApplication],
        meta: { page: 1, pageSize: 20, total: 1, hasMore: false },
      });

      const app = createTestApp();
      const res = await supertest(app)
        .get(`/api/v1/students/${VALID_STUDENT_UUID}/applications`)
        .set('x-user-id', VALID_USER_UUID)
        .set('x-user-role', 'STUDENT');

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(1);
    });

    it('returns 403 for non-owner', async () => {
      mockGetApplications.mockRejectedValue(
        new ForbiddenError('You do not have permission to view these applications'),
      );

      const app = createTestApp();
      const res = await supertest(app)
        .get(`/api/v1/students/${VALID_STUDENT_UUID}/applications`)
        .set('x-user-id', OTHER_USER_UUID)
        .set('x-user-role', 'COMPANY');

      expect(res.status).toBe(403);
    });

    it('returns 401 without auth token', async () => {
      const app = createTestApp();
      const res = await supertest(app)
        .get(`/api/v1/students/${VALID_STUDENT_UUID}/applications`);

      expect(res.status).toBe(401);
    });

    it('returns 400 when studentId is not a valid UUID', async () => {
      const app = createTestApp();
      const res = await supertest(app)
        .get('/api/v1/students/not-a-uuid/applications')
        .set('x-user-id', ADMIN_UUID)
        .set('x-user-role', 'ADMIN');

      expect(res.status).toBe(400);
    });

    it('returns 200 with valid status filter', async () => {
      mockGetApplications.mockResolvedValue({
        data: [mockApplication],
        meta: { page: 1, pageSize: 20, total: 1, hasMore: false },
      });

      const app = createTestApp();
      const res = await supertest(app)
        .get(`/api/v1/students/${VALID_STUDENT_UUID}/applications`)
        .query({ status: 'PENDING' })
        .set('x-user-id', VALID_USER_UUID)
        .set('x-user-role', 'STUDENT');

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(1);
      expect(mockGetApplications).toHaveBeenCalledWith(
        VALID_STUDENT_UUID,
        expect.objectContaining({ status: 'PENDING' }),
        VALID_USER_UUID,
        'STUDENT',
      );
    });

    it('returns 400 when status is an invalid ApplicationStatus value', async () => {
      const app = createTestApp();
      const res = await supertest(app)
        .get(`/api/v1/students/${VALID_STUDENT_UUID}/applications`)
        .query({ status: 'INVALID_STATUS' })
        .set('x-user-id', VALID_USER_UUID)
        .set('x-user-role', 'STUDENT');

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });
  });
});
