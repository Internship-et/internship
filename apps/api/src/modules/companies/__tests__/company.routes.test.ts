// ─────────────────────────────────────────────────────────────
// Company Routes — Integration Tests
// Uses supertest with mocked service layer and mocked auth middleware.
// Tests cover:
//  - Public listing (GET /companies) with validation
//  - Public profile (GET /companies/:companyId)
//  - Company creation (POST /companies) with auth+role checks
//  - Company update (PATCH /companies/:companyId) with ownership
//  - Public internship listing (GET /companies/:companyId/internships)
//  - Scoped application listing (GET /companies/:companyId/applications)
// ─────────────────────────────────────────────────────────────

import { describe, it, expect, vi, beforeEach } from 'vitest';
import express, { type Request, type Response, type NextFunction } from 'express';
import supertest from 'supertest';
import { UnauthorizedError, ForbiddenError, NotFoundError, ConflictError } from '../../../shared/errors/app-error.js';

// ─── Mock auth middleware (BEFORE importing routes) ─────────

vi.mock('../../../shared/middleware/auth.middleware.js', () => ({
  authenticate: (req: Request, _res: Response, next: NextFunction) => {
    const userId = req.headers['x-user-id'] as string | undefined;
    const role = req.headers['x-user-role'] as string | undefined;

    if (userId) {
      req.user = {
        id: userId,
        role: role ?? 'COMPANY',
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
vi.mock('../company.service.js', () => ({}));

import * as companyService from '../company.service.js';
import companyRoutes from '../company.routes.js';
import { errorHandler } from '../../../shared/middleware/error.middleware.js';

// ─── Test app factory ──────────────────────────────────────

function createTestApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/v1', companyRoutes);
  app.use(errorHandler);
  return app;
}

// ─── Test UUIDs ────────────────────────────────────────────

const VALID_COMPANY_UUID = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';
const VALID_USER_UUID = 'b2c3d4e5-f6a7-8901-bcde-f12345678901';
const ADMIN_UUID = 'c3d4e5f6-a7b8-9012-cdef-123456789012';
const OTHER_USER_UUID = 'd4e5f6a7-b8c9-0123-defa-234567890123';
const NONEXISTENT_UUID = 'f47ac10b-58cc-4372-a567-0e02b2c3d479';
const VALID_INTERNSHIP_UUID = 'e5f6a7b8-c9d0-1234-efab-345678901234';

// ─── Fixtures ──────────────────────────────────────────────

const mockProfile = {
  id: VALID_COMPANY_UUID,
  userId: VALID_USER_UUID,
  name: 'Tech Corp',
  industry: 'TECHNOLOGY',
  description: 'Leading tech company',
  logoUrl: null,
  website: 'https://techcorp.et',
  city: 'Addis Ababa',
  address: 'Bole Road',
  size: 'MEDIUM',
  foundedYear: 2020,
  socialLinks: { linkedin: 'https://linkedin.com/company/techcorp' },
  tinNumber: 'TIN-001',
  isVerified: false,
  createdAt: new Date('2025-01-01').toISOString(),
  updatedAt: new Date('2025-01-15').toISOString(),
  deletedAt: null,
  user: {
    id: VALID_USER_UUID,
    email: 'company@example.com',
    firstName: 'Elias',
    lastName: 'Chala',
    role: 'COMPANY',
    phone: '+251911111111',
  },
};

const mockInternship = {
  id: VALID_INTERNSHIP_UUID,
  title: 'Software Engineering Intern',
  description: 'Join our team',
  type: 'REMOTE',
  city: 'Addis Ababa',
  durationMonths: 3,
  weeklyHours: 40,
  startDate: new Date('2025-06-01').toISOString(),
  deadline: new Date('2025-05-01').toISOString(),
  stipend: null,
  tags: ['JavaScript', 'React'],
  status: 'ACTIVE',
  createdAt: new Date('2025-03-01').toISOString(),
  updatedAt: new Date('2025-03-01').toISOString(),
};

const mockApplication = {
  id: 'app-uuid-1',
  internshipId: VALID_INTERNSHIP_UUID,
  studentId: 'student-uuid-1',
  status: 'PENDING',
  coverLetter: 'I am passionate...',
  additionalInfo: null,
  appliedAt: new Date('2025-04-01').toISOString(),
  updatedAt: new Date('2025-04-01').toISOString(),
  student: {
    id: 'student-uuid-1',
    grade: 10,
    resumeUrl: null,
    user: {
      id: 'user-uuid-2',
      firstName: 'Abebe',
      lastName: 'Kebede',
      email: 'student@example.com',
    },
  },
  internship: {
    id: VALID_INTERNSHIP_UUID,
    title: 'Software Engineering Intern',
    status: 'ACTIVE',
  },
};

// ─── Mock service implementations ──────────────────────────

const mockList = vi.fn();
const mockGetById = vi.fn();
const mockCreate = vi.fn();
const mockUpdate = vi.fn();
const mockGetInternships = vi.fn();
const mockGetApplications = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();

  vi.mocked(companyService).list = mockList;
  vi.mocked(companyService).getById = mockGetById;
  vi.mocked(companyService).create = mockCreate;
  vi.mocked(companyService).update = mockUpdate;
  vi.mocked(companyService).getInternships = mockGetInternships;
  vi.mocked(companyService).getApplications = mockGetApplications;
});

// ─── Tests ─────────────────────────────────────────────────

describe('CompanyRoutes', () => {
  describe('GET /companies', () => {
    it('returns 200 with data (public)', async () => {
      mockList.mockResolvedValue({
        data: [{ ...mockProfile, activeInternshipCount: 2 }],
        meta: { page: 1, pageSize: 20, total: 1, hasMore: false },
      });

      const app = createTestApp();
      const res = await supertest(app).get('/api/v1/companies');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveLength(1);
      expect(res.body.meta.total).toBe(1);
    });

    it('does not expose user, tinNumber, userId, or socialLinks in list response', async () => {
      // Mimic actual service response — strips user, tinNumber, userId, and socialLinks
      const publicListEntry = {
        id: mockProfile.id,
        name: mockProfile.name,
        industry: mockProfile.industry,
        description: mockProfile.description,
        logoUrl: mockProfile.logoUrl,
        website: mockProfile.website,
        city: mockProfile.city,
        address: mockProfile.address,
        size: mockProfile.size,
        foundedYear: mockProfile.foundedYear,
        isVerified: mockProfile.isVerified,
        createdAt: mockProfile.createdAt,
        updatedAt: mockProfile.updatedAt,
        activeInternshipCount: 2,
      };
      mockList.mockResolvedValue({
        data: [publicListEntry],
        meta: { page: 1, pageSize: 20, total: 1, hasMore: false },
      });

      const app = createTestApp();
      const res = await supertest(app).get('/api/v1/companies');

      expect(res.status).toBe(200);
      const entry = res.body.data[0];
      expect(entry).not.toHaveProperty('user');
      expect(entry).not.toHaveProperty('userId');
      expect(entry).not.toHaveProperty('tinNumber');
      expect(entry).not.toHaveProperty('socialLinks');
    });

    it('accepts sort=updatedAt (200)', async () => {
      mockList.mockResolvedValue({
        data: [{ ...mockProfile, activeInternshipCount: 2 }],
        meta: { page: 1, pageSize: 20, total: 1, hasMore: false },
      });

      const app = createTestApp();
      const res = await supertest(app)
        .get('/api/v1/companies')
        .query({ sort: 'updatedAt', order: 'asc' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('returns 400 when sort is an invalid field', async () => {
      const app = createTestApp();
      const res = await supertest(app)
        .get('/api/v1/companies')
        .query({ sort: 'invalidField' });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('returns 400 when hasActiveInternships is not true/false', async () => {
      const app = createTestApp();
      const res = await supertest(app)
        .get('/api/v1/companies')
        .query({ hasActiveInternships: 'yes' });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });
  });

  describe('GET /companies/:companyId', () => {
    it('returns 200 with profile (public)', async () => {
      mockGetById.mockResolvedValue({ ...mockProfile, activeInternshipCount: 2, totalInternshipsCompleted: 1 });

      const app = createTestApp();
      const res = await supertest(app).get(`/api/v1/companies/${VALID_COMPANY_UUID}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveProperty('activeInternshipCount');
    });

    it('does not expose user, tinNumber, or userId in detail response', async () => {
      // Mimic actual service response — strips user, tinNumber, userId
      // socialLinks IS allowed in detail responses per COMPANY_ROUTES
      const { user: _u, userId: _uid, tinNumber: _tin, ...publicDetail } = mockProfile;
      mockGetById.mockResolvedValue({ ...publicDetail, activeInternshipCount: 2, totalInternshipsCompleted: 1 });

      const app = createTestApp();
      const res = await supertest(app).get(`/api/v1/companies/${VALID_COMPANY_UUID}`);

      expect(res.status).toBe(200);
      const detail = res.body.data;
      expect(detail).not.toHaveProperty('user');
      expect(detail).not.toHaveProperty('userId');
      expect(detail).not.toHaveProperty('tinNumber');
      // Detail responses MAY include socialLinks per COMPANY_ROUTES
    });

    it('returns 404 when company not found', async () => {
      mockGetById.mockRejectedValue(new NotFoundError('Company profile not found'));

      const app = createTestApp();
      const res = await supertest(app).get(`/api/v1/companies/${NONEXISTENT_UUID}`);

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
    });

    it('returns 400 when companyId is not a valid UUID', async () => {
      const app = createTestApp();
      const res = await supertest(app).get('/api/v1/companies/not-a-uuid');

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });
  });

  describe('POST /companies', () => {
    const validBody = {
      name: 'New Tech Corp',
      industry: 'TECHNOLOGY',
      description: 'A new tech company',
      city: 'Addis Ababa',
    };

    it('returns 201 for COMPANY role', async () => {
      mockCreate.mockResolvedValue(mockProfile);

      const app = createTestApp();
      const res = await supertest(app)
        .post('/api/v1/companies')
        .set('x-user-id', VALID_USER_UUID)
        .set('x-user-role', 'COMPANY')
        .send(validBody);

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
    });

    it('returns 201 for ADMIN role', async () => {
      mockCreate.mockResolvedValue(mockProfile);

      const app = createTestApp();
      const res = await supertest(app)
        .post('/api/v1/companies')
        .set('x-user-id', ADMIN_UUID)
        .set('x-user-role', 'ADMIN')
        .send(validBody);

      expect(res.status).toBe(201);
    });

    it('returns 401 without auth token', async () => {
      const app = createTestApp();
      const res = await supertest(app)
        .post('/api/v1/companies')
        .send(validBody);

      expect(res.status).toBe(401);
    });

    it('returns 403 for STUDENT role', async () => {
      const app = createTestApp();
      const res = await supertest(app)
        .post('/api/v1/companies')
        .set('x-user-id', OTHER_USER_UUID)
        .set('x-user-role', 'STUDENT')
        .send(validBody);

      expect(res.status).toBe(403);
    });

    it('returns 409 when user already has a company', async () => {
      mockCreate.mockRejectedValue(new ConflictError('User already has a company profile'));

      const app = createTestApp();
      const res = await supertest(app)
        .post('/api/v1/companies')
        .set('x-user-id', VALID_USER_UUID)
        .set('x-user-role', 'COMPANY')
        .send(validBody);

      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe('CONFLICT');
    });

    it('returns 409 when company name already exists', async () => {
      mockCreate.mockRejectedValue(new ConflictError('Company name already in use'));

      const app = createTestApp();
      const res = await supertest(app)
        .post('/api/v1/companies')
        .set('x-user-id', VALID_USER_UUID)
        .set('x-user-role', 'COMPANY')
        .send(validBody);

      expect(res.status).toBe(409);
    });

    it('returns 400 with invalid body (missing required fields)', async () => {
      const app = createTestApp();
      const res = await supertest(app)
        .post('/api/v1/companies')
        .set('x-user-id', VALID_USER_UUID)
        .set('x-user-role', 'COMPANY')
        .send({ name: 'Incomplete' }); // Missing industry, description, city

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });
  });

  describe('PATCH /companies/:companyId', () => {
    const updateBody = { description: 'Updated description' };

    it('returns 200 for OWNER', async () => {
      mockUpdate.mockResolvedValue({ ...mockProfile, description: 'Updated description' });

      const app = createTestApp();
      const res = await supertest(app)
        .patch(`/api/v1/companies/${VALID_COMPANY_UUID}`)
        .set('x-user-id', VALID_USER_UUID)
        .set('x-user-role', 'COMPANY')
        .send(updateBody);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.description).toBe('Updated description');
    });

    it('returns 200 for ADMIN', async () => {
      mockUpdate.mockResolvedValue({ ...mockProfile, description: 'Updated description' });

      const app = createTestApp();
      const res = await supertest(app)
        .patch(`/api/v1/companies/${VALID_COMPANY_UUID}`)
        .set('x-user-id', ADMIN_UUID)
        .set('x-user-role', 'ADMIN')
        .send(updateBody);

      expect(res.status).toBe(200);
    });

    it('returns 403 for non-owner COMPANY', async () => {
      mockUpdate.mockRejectedValue(new ForbiddenError('You do not have permission to update this profile'));

      const app = createTestApp();
      const res = await supertest(app)
        .patch(`/api/v1/companies/${VALID_COMPANY_UUID}`)
        .set('x-user-id', OTHER_USER_UUID)
        .set('x-user-role', 'COMPANY')
        .send(updateBody);

      expect(res.status).toBe(403);
    });

    it('returns 403 for STUDENT role', async () => {
      mockUpdate.mockRejectedValue(new ForbiddenError('You do not have permission to update this profile'));

      const app = createTestApp();
      const res = await supertest(app)
        .patch(`/api/v1/companies/${VALID_COMPANY_UUID}`)
        .set('x-user-id', OTHER_USER_UUID)
        .set('x-user-role', 'STUDENT')
        .send(updateBody);

      expect(res.status).toBe(403);
    });

    it('returns 401 without auth token', async () => {
      const app = createTestApp();
      const res = await supertest(app)
        .patch(`/api/v1/companies/${VALID_COMPANY_UUID}`)
        .send(updateBody);

      expect(res.status).toBe(401);
    });

    it('returns 404 when company not found', async () => {
      mockUpdate.mockRejectedValue(new NotFoundError('Company profile not found'));

      const app = createTestApp();
      const res = await supertest(app)
        .patch(`/api/v1/companies/${NONEXISTENT_UUID}`)
        .set('x-user-id', ADMIN_UUID)
        .set('x-user-role', 'ADMIN')
        .send(updateBody);

      expect(res.status).toBe(404);
    });

    it('returns 400 when companyId is not a valid UUID', async () => {
      const app = createTestApp();
      const res = await supertest(app)
        .patch('/api/v1/companies/not-a-uuid')
        .set('x-user-id', ADMIN_UUID)
        .set('x-user-role', 'ADMIN')
        .send(updateBody);

      expect(res.status).toBe(400);
    });
  });

  describe('GET /companies/:companyId/internships', () => {
    it('returns 200 with ACTIVE internships (public)', async () => {
      mockGetInternships.mockResolvedValue({
        data: [mockInternship],
        meta: { page: 1, pageSize: 20, total: 1, hasMore: false },
      });

      const app = createTestApp();
      const res = await supertest(app)
        .get(`/api/v1/companies/${VALID_COMPANY_UUID}/internships`);

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(1);
      expect(res.body.meta.total).toBe(1);
    });

    it('returns 200 with empty list (no internships)', async () => {
      mockGetInternships.mockResolvedValue({
        data: [],
        meta: { page: 1, pageSize: 20, total: 0, hasMore: false },
      });

      const app = createTestApp();
      const res = await supertest(app)
        .get(`/api/v1/companies/${VALID_COMPANY_UUID}/internships`);

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(0);
    });

    it('returns 400 when companyId is not a valid UUID', async () => {
      const app = createTestApp();
      const res = await supertest(app)
        .get('/api/v1/companies/not-a-uuid/internships');

      expect(res.status).toBe(400);
    });
  });

  describe('GET /companies/:companyId/applications', () => {
    it('returns 200 for OWNER', async () => {
      mockGetApplications.mockResolvedValue({
        data: [mockApplication],
        meta: { page: 1, pageSize: 20, total: 1, hasMore: false },
      });

      const app = createTestApp();
      const res = await supertest(app)
        .get(`/api/v1/companies/${VALID_COMPANY_UUID}/applications`)
        .set('x-user-id', VALID_USER_UUID)
        .set('x-user-role', 'COMPANY');

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(1);
    });

    it('returns 200 for ADMIN', async () => {
      mockGetApplications.mockResolvedValue({
        data: [mockApplication],
        meta: { page: 1, pageSize: 20, total: 1, hasMore: false },
      });

      const app = createTestApp();
      const res = await supertest(app)
        .get(`/api/v1/companies/${VALID_COMPANY_UUID}/applications`)
        .set('x-user-id', ADMIN_UUID)
        .set('x-user-role', 'ADMIN');

      expect(res.status).toBe(200);
    });

    it('accepts sort=updatedAt (200)', async () => {
      mockGetApplications.mockResolvedValue({
        data: [mockApplication],
        meta: { page: 1, pageSize: 20, total: 1, hasMore: false },
      });

      const app = createTestApp();
      const res = await supertest(app)
        .get(`/api/v1/companies/${VALID_COMPANY_UUID}/applications`)
        .query({ sort: 'updatedAt', order: 'desc' })
        .set('x-user-id', ADMIN_UUID)
        .set('x-user-role', 'ADMIN');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('returns 403 for non-owner COMPANY', async () => {
      mockGetApplications.mockRejectedValue(
        new ForbiddenError('You do not have permission to view these applications'),
      );

      const app = createTestApp();
      const res = await supertest(app)
        .get(`/api/v1/companies/${VALID_COMPANY_UUID}/applications`)
        .set('x-user-id', OTHER_USER_UUID)
        .set('x-user-role', 'COMPANY');

      expect(res.status).toBe(403);
    });

    it('returns 401 without auth token', async () => {
      const app = createTestApp();
      const res = await supertest(app)
        .get(`/api/v1/companies/${VALID_COMPANY_UUID}/applications`);

      expect(res.status).toBe(401);
    });

    it('returns 400 when companyId is not a valid UUID', async () => {
      const app = createTestApp();
      const res = await supertest(app)
        .get('/api/v1/companies/not-a-uuid/applications')
        .set('x-user-id', ADMIN_UUID)
        .set('x-user-role', 'ADMIN');

      expect(res.status).toBe(400);
    });

    it('returns 400 when status is an invalid value', async () => {
      const app = createTestApp();
      const res = await supertest(app)
        .get(`/api/v1/companies/${VALID_COMPANY_UUID}/applications`)
        .query({ status: 'INVALID_STATUS' })
        .set('x-user-id', ADMIN_UUID)
        .set('x-user-role', 'ADMIN');

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('returns 400 when sort is an invalid field', async () => {
      const app = createTestApp();
      const res = await supertest(app)
        .get(`/api/v1/companies/${VALID_COMPANY_UUID}/applications`)
        .query({ sort: 'invalidField' })
        .set('x-user-id', ADMIN_UUID)
        .set('x-user-role', 'ADMIN');

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('returns 400 when internshipId is not a valid UUID', async () => {
      const app = createTestApp();
      const res = await supertest(app)
        .get(`/api/v1/companies/${VALID_COMPANY_UUID}/applications`)
        .query({ internshipId: 'not-a-uuid' })
        .set('x-user-id', ADMIN_UUID)
        .set('x-user-role', 'ADMIN');

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });
  });
});
