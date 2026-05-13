// ─────────────────────────────────────────────────────────────
// Internship Service — Unit Tests
// Mocks the repository layer. Tests cover:
//  - Public listing with cursor pagination (list)
//  - Public internship detail (getById)
//  - Internship creation (create)
//  - Internship update with ownership + state transitions (update)
//  - Internship close with accepted-app check (close)
//  - Application submission with business rules (apply)
// ─────────────────────────────────────────────────────────────

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NotFoundError, ForbiddenError, ConflictError, UnprocessableError } from '../../../shared/errors/app-error.js';

// Set far-future reference date to avoid deadline-passed errors
const FAR_FUTURE = new Date('2099-12-31T23:59:59Z');
const FAR_PAST = new Date('2020-01-01T00:00:00Z');

// Mock repositories before importing the service
vi.mock('../internship.repository.js', () => ({}));
vi.mock('../../students/student.repository.js', () => ({}));
vi.mock('../../companies/company.repository.js', () => ({}));

import * as internshipService from '../internship.service.js';
import * as internshipRepository from '../internship.repository.js';
import * as studentRepository from '../../students/student.repository.js';
import * as companyRepository from '../../companies/company.repository.js';

// ─── Fixtures ──────────────────────────────────────────────

const mockCompany = {
  id: 'company-uuid-1',
  userId: 'user-uuid-1',
  name: 'Tech Corp',
  industry: 'TECHNOLOGY',
  description: 'Leading tech company',
  logoUrl: null,
  website: 'https://techcorp.et',
  city: 'Addis Ababa',
  address: 'Bole Road',
  size: 'MEDIUM' as const,
  foundedYear: 2020,
  isVerified: false,
  createdAt: new Date('2025-01-01'),
  updatedAt: new Date('2025-01-15'),
  deletedAt: null,
};

const mockStudentProfile = {
  id: 'student-uuid-1',
  userId: 'user-uuid-2',
  schoolId: null,
  grade: 10,
  dateOfBirth: new Date('2006-05-15'),
  bio: 'Aspiring software engineer',
  skills: ['JavaScript', 'Python'],
  interests: ['Coding', 'Robotics'],
  languages: ['English', 'Amharic'],
  resumeUrl: 'https://example.com/resume.pdf',
  profileImageUrl: null,
  isSchoolVerified: false,
  createdAt: new Date('2025-01-01'),
  updatedAt: new Date('2025-01-15'),
  user: {
    id: 'user-uuid-2',
    email: 'student@example.com',
    firstName: 'Abebe',
    lastName: 'Kebede',
    role: 'STUDENT',
    phone: '+251911111111',
  },
  school: null,
};

const mockInternshipRaw = {
  id: 'internship-uuid-1',
  companyId: 'company-uuid-1',
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
  startDate: new Date('2025-06-01'),
  deadline: FAR_FUTURE,
  stipend: { amount: 5000, currency: 'ETB', period: 'MONTHLY' },
  benefits: ['Lunch'],
  tags: ['JavaScript', 'React'],
  minGrade: 9,
  maxGrade: 12,
  status: 'ACTIVE',
  createdAt: new Date('2025-03-01'),
  updatedAt: new Date('2025-03-01'),
  deletedAt: null,
  company: {
    id: 'company-uuid-1',
    name: 'Tech Corp',
    logoUrl: null,
    city: 'Addis Ababa',
    industry: 'TECHNOLOGY',
    userId: 'user-uuid-1',
    description: 'Leading tech company',
    website: 'https://techcorp.et',
    size: 'MEDIUM' as const,
    foundedYear: 2020,
    isVerified: false,
  },
  _count: { applications: 3 },
};

const mockInternshipDraft = {
  ...mockInternshipRaw,
  status: 'DRAFT',
};

const mockInternshipClosed = {
  ...mockInternshipRaw,
  status: 'CLOSED',
  deletedAt: new Date('2025-04-01'),
}

const mockInternshipNoDeadline = {
  ...mockInternshipRaw,
  deadline: null,
}

const mockInternshipPastDeadline = {
  ...mockInternshipRaw,
  deadline: FAR_PAST,
}

const mockInternshipHighGrade = {
  ...mockInternshipRaw,
  minGrade: 11,
  maxGrade: 12,
}

const mockInternshipLowGrade = {
  ...mockInternshipRaw,
  minGrade: 9,
  maxGrade: 9,
}

const mockInternshipNoGrade = {
  ...mockInternshipRaw,
  minGrade: null,
  maxGrade: null,
};

const mockApplication = {
  id: 'app-uuid-1',
  internshipId: 'internship-uuid-1',
  studentId: 'student-uuid-1',
  status: 'PENDING',
  appliedAt: new Date('2025-04-01'),
};

// ─── Mock implementations ──────────────────────────────────

const mockFindAll = vi.fn();
const mockFindById = vi.fn();
const mockFindByIdUnscoped = vi.fn();
const mockCreate = vi.fn();
const mockUpdate = vi.fn();
const mockSoftDelete = vi.fn();
const mockCount = vi.fn();
const mockFindApplicationByInternshipAndStudent = vi.fn();
const mockCreateApplication = vi.fn();
const mockCountAcceptedApplications = vi.fn();

const mockStudentFindByUserId = vi.fn();
const mockCompanyFindByUserId = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();

  // Internship repository mocks
  vi.mocked(internshipRepository).findAll = mockFindAll;
  vi.mocked(internshipRepository).findById = mockFindById;
  vi.mocked(internshipRepository).findByIdUnscoped = mockFindByIdUnscoped;
  vi.mocked(internshipRepository).create = mockCreate;
  vi.mocked(internshipRepository).update = mockUpdate;
  vi.mocked(internshipRepository).softDelete = mockSoftDelete;
  vi.mocked(internshipRepository).count = mockCount;
  vi.mocked(internshipRepository).findApplicationByInternshipAndStudent = mockFindApplicationByInternshipAndStudent;
  vi.mocked(internshipRepository).createApplication = mockCreateApplication;
  vi.mocked(internshipRepository).countAcceptedApplications = mockCountAcceptedApplications;

  // Student repository mocks
  vi.mocked(studentRepository).findByUserId = mockStudentFindByUserId;

  // Company repository mocks
  vi.mocked(companyRepository).findByUserId = mockCompanyFindByUserId;
});

// ─── Tests ─────────────────────────────────────────────────

describe('InternshipService', () => {
  describe('list', () => {
    it('returns paginated results with cursor meta', async () => {
      const filters = {
        cursor: null,
        limit: 20,
        search: undefined as string | undefined,
        companyId: undefined as string | undefined,
        city: undefined as string | undefined,
        type: undefined as string | undefined,
        minDuration: undefined as number | undefined,
        maxDuration: undefined as number | undefined,
        minGrade: undefined as number | undefined,
        maxGrade: undefined as number | undefined,
        tags: undefined as string[] | undefined,
        sort: 'createdAt' as const,
        order: 'desc' as const,
      };

      mockFindAll.mockResolvedValue([mockInternshipRaw]);

      const result = await internshipService.list(filters);

      expect(result.data).toHaveLength(1);
      expect(result.data[0]).not.toHaveProperty('_count');
      expect(result.data[0]).not.toHaveProperty('companyId');
      expect(result.data[0]).not.toHaveProperty('deletedAt');
      expect(result.data[0]).not.toHaveProperty('company.userId');
      expect(result.data[0]).toHaveProperty('applicantCount', 3);
      expect(result.meta).toHaveProperty('cursor');
      expect(result.meta).toHaveProperty('hasMore');
      expect(mockFindAll).toHaveBeenCalledTimes(1);
    });

    it('returns empty array when no internships exist', async () => {
      const filters = {
        cursor: null,
        limit: 20,
        search: undefined as string | undefined,
        companyId: undefined as string | undefined,
        city: undefined as string | undefined,
        type: undefined as string | undefined,
        minDuration: undefined as number | undefined,
        maxDuration: undefined as number | undefined,
        minGrade: undefined as number | undefined,
        maxGrade: undefined as number | undefined,
        tags: undefined as string[] | undefined,
        sort: 'createdAt' as const,
        order: 'desc' as const,
      };

      mockFindAll.mockResolvedValue([]);

      const result = await internshipService.list(filters);

      expect(result.data).toHaveLength(0);
    });
  });

  describe('getById', () => {
    it('returns public-safe profile when internship is ACTIVE', async () => {
      mockFindById.mockResolvedValue(mockInternshipRaw);

      const result = await internshipService.getById('internship-uuid-1');

      expect(result).not.toHaveProperty('_count');
      expect(result).not.toHaveProperty('companyId');
      expect(result).not.toHaveProperty('deletedAt');
      expect(result.company).not.toHaveProperty('userId');
      expect(result).toHaveProperty('applicationCount', 3);
      expect(result.title).toBe('Software Engineering Intern');
      expect(mockFindById).toHaveBeenCalledWith('internship-uuid-1');
    });

    it('throws NotFoundError when internship is not found or not ACTIVE', async () => {
      mockFindById.mockResolvedValue(null);

      await expect(
        internshipService.getById('nonexistent-uuid'),
      ).rejects.toThrow(NotFoundError);
    });
  });

  describe('create', () => {
    const createData = {
      title: 'New Internship',
      description: 'A great opportunity',
      requirements: ['JavaScript'],
      type: 'REMOTE' as const,
      city: 'Addis Ababa',
      durationMonths: 3,
    };

    it('creates internship for COMPANY user with their company profile', async () => {
      mockCompanyFindByUserId.mockResolvedValue(mockCompany);
      mockCreate.mockResolvedValue({ ...mockInternshipRaw, status: 'DRAFT' });

      const result = await internshipService.create(createData, 'user-uuid-1', 'COMPANY');

      expect(result).toBeDefined();
      expect(mockCreate).toHaveBeenCalledWith({ ...createData, companyId: 'company-uuid-1' });
      expect(mockCompanyFindByUserId).toHaveBeenCalledWith('user-uuid-1');
    });

    it('creates internship for ADMIN user', async () => {
      mockCompanyFindByUserId.mockResolvedValue(mockCompany);
      mockCreate.mockResolvedValue({ ...mockInternshipRaw, status: 'DRAFT' });

      const result = await internshipService.create(createData, 'admin-uuid', 'ADMIN');

      expect(result).toBeDefined();
      expect(mockCreate).toHaveBeenCalled();
    });

    it('throws ForbiddenError for STUDENT role', async () => {
      await expect(
        internshipService.create(createData, 'student-uuid', 'STUDENT'),
      ).rejects.toThrow(ForbiddenError);
    });

    it('throws NotFoundError when user has no company profile', async () => {
      mockCompanyFindByUserId.mockResolvedValue(null);

      await expect(
        internshipService.create(createData, 'user-uuid-1', 'COMPANY'),
      ).rejects.toThrow(NotFoundError);
    });
  });

  describe('update', () => {
    const updateData = { description: 'Updated description' };

    it('updates own internship (owner)', async () => {
      mockFindByIdUnscoped.mockResolvedValue(mockInternshipRaw);
      mockUpdate.mockResolvedValue({ ...mockInternshipRaw, ...updateData });

      const result = await internshipService.update(
        'internship-uuid-1',
        updateData,
        'user-uuid-1', // owner of the company
        'COMPANY',
      );

      expect(result.description).toBe('Updated description');
      expect(mockUpdate).toHaveBeenCalledWith('internship-uuid-1', updateData);
    });

    it('updates any internship (ADMIN)', async () => {
      mockFindByIdUnscoped.mockResolvedValue(mockInternshipRaw);
      mockUpdate.mockResolvedValue({ ...mockInternshipRaw, ...updateData });

      const result = await internshipService.update(
        'internship-uuid-1',
        updateData,
        'admin-uuid',
        'ADMIN',
      );

      expect(result.description).toBe('Updated description');
    });

    it('throws NotFoundError when internship does not exist', async () => {
      mockFindByIdUnscoped.mockResolvedValue(null);

      await expect(
        internshipService.update('nonexistent-uuid', updateData, 'user-uuid-1', 'COMPANY'),
      ).rejects.toThrow(NotFoundError);
    });

    it('throws ForbiddenError for non-owner, non-ADMIN', async () => {
      mockFindByIdUnscoped.mockResolvedValue(mockInternshipRaw);

      await expect(
        internshipService.update('internship-uuid-1', updateData, 'other-user-uuid', 'COMPANY'),
      ).rejects.toThrow(ForbiddenError);
    });

    it('successfully publishes DRAFT → ACTIVE', async () => {
      mockFindByIdUnscoped.mockResolvedValue(mockInternshipDraft);
      mockUpdate.mockResolvedValue({ ...mockInternshipDraft, status: 'ACTIVE' });

      const result = await internshipService.update(
        'internship-uuid-1',
        { status: 'ACTIVE' },
        'user-uuid-1',
        'COMPANY',
      );

      expect(result.status).toBe('ACTIVE');
      expect(mockUpdate).toHaveBeenCalledWith('internship-uuid-1', { status: 'ACTIVE' });
    });

    it('throws UnprocessableError for invalid transition (DRAFT → CLOSED)', async () => {
      mockFindByIdUnscoped.mockResolvedValue(mockInternshipDraft);

      // Tests service defensive layer — intentionally passes invalid status to bypass type guard
      await expect(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        internshipService.update('internship-uuid-1', { status: 'CLOSED' as any }, 'user-uuid-1', 'COMPANY'),
      ).rejects.toThrow(UnprocessableError);
    });

    it('throws UnprocessableError for invalid transition (CLOSED → ACTIVE) — CLOSED check runs first', async () => {
      mockFindByIdUnscoped.mockResolvedValue(mockInternshipClosed);

      // CLOSED is now caught by the immutability check before transition validation
      await expect(
        internshipService.update('internship-uuid-1', { status: 'ACTIVE' }, 'user-uuid-1', 'COMPANY'),
      ).rejects.toThrow(UnprocessableError);
    });

    it('allows ACTIVE → ACTIVE (same status, no transition error)', async () => {
      mockFindByIdUnscoped.mockResolvedValue(mockInternshipRaw);
      mockUpdate.mockResolvedValue({ ...mockInternshipRaw, description: 'Extended' });

      const result = await internshipService.update(
        'internship-uuid-1',
        { status: 'ACTIVE', description: 'Extended' },
        'user-uuid-1',
        'COMPANY',
      );

      expect(result.description).toBe('Extended');
    });

    it('throws UnprocessableError when editing a CLOSED internship (immutable)', async () => {
      mockFindByIdUnscoped.mockResolvedValue(mockInternshipClosed);

      await expect(
        internshipService.update(
          'internship-uuid-1',
          { description: 'trying to edit' },
          'user-uuid-1',
          'COMPANY',
        ),
      ).rejects.toThrow(UnprocessableError);
      expect(mockUpdate).not.toHaveBeenCalled();
    });
  });

  describe('close', () => {
    it('closes an ACTIVE internship (owner)', async () => {
      mockFindByIdUnscoped.mockResolvedValue(mockInternshipRaw);
      mockCountAcceptedApplications.mockResolvedValue(0);
      mockSoftDelete.mockResolvedValue(mockInternshipClosed);

      await internshipService.close('internship-uuid-1', 'user-uuid-1', 'COMPANY');

      expect(mockSoftDelete).toHaveBeenCalledWith('internship-uuid-1');
      expect(mockCountAcceptedApplications).toHaveBeenCalledWith('internship-uuid-1');
    });

    it('closes an ACTIVE internship (ADMIN)', async () => {
      mockFindByIdUnscoped.mockResolvedValue(mockInternshipRaw);
      mockCountAcceptedApplications.mockResolvedValue(0);
      mockSoftDelete.mockResolvedValue(mockInternshipClosed);

      await internshipService.close('internship-uuid-1', 'admin-uuid', 'ADMIN');

      expect(mockSoftDelete).toHaveBeenCalledWith('internship-uuid-1');
    });

    it('throws NotFoundError when internship does not exist', async () => {
      mockFindByIdUnscoped.mockResolvedValue(null);

      await expect(
        internshipService.close('nonexistent-uuid', 'user-uuid-1', 'COMPANY'),
      ).rejects.toThrow(NotFoundError);
    });

    it('throws ForbiddenError for non-owner, non-ADMIN', async () => {
      mockFindByIdUnscoped.mockResolvedValue(mockInternshipRaw);

      await expect(
        internshipService.close('internship-uuid-1', 'other-user-uuid', 'COMPANY'),
      ).rejects.toThrow(ForbiddenError);
    });

    it('throws UnprocessableError when internship is DRAFT', async () => {
      mockFindByIdUnscoped.mockResolvedValue(mockInternshipDraft);

      await expect(
        internshipService.close('internship-uuid-1', 'user-uuid-1', 'COMPANY'),
      ).rejects.toThrow(UnprocessableError);
    });

    it('throws UnprocessableError when internship is already CLOSED', async () => {
      mockFindByIdUnscoped.mockResolvedValue(mockInternshipClosed);

      await expect(
        internshipService.close('internship-uuid-1', 'user-uuid-1', 'COMPANY'),
      ).rejects.toThrow(UnprocessableError);
    });

    it('throws UnprocessableError when there are accepted applications', async () => {
      mockFindByIdUnscoped.mockResolvedValue(mockInternshipRaw);
      mockCountAcceptedApplications.mockResolvedValue(2);

      await expect(
        internshipService.close('internship-uuid-1', 'user-uuid-1', 'COMPANY'),
      ).rejects.toThrow(UnprocessableError);
      expect(mockSoftDelete).not.toHaveBeenCalled();
    });
  });

  describe('apply', () => {
    const applyData = {
      coverLetter: 'I am passionate about this role',
      additionalInfo: null,
    };

    it('successfully applies to an ACTIVE internship', async () => {
      mockFindById.mockResolvedValue(mockInternshipRaw);
      mockStudentFindByUserId.mockResolvedValue(mockStudentProfile);
      mockFindApplicationByInternshipAndStudent.mockResolvedValue(null);
      mockCreateApplication.mockResolvedValue(mockApplication);

      const result = await internshipService.apply(
        'internship-uuid-1',
        'user-uuid-2',
        applyData,
      );

      expect(result).toEqual(mockApplication);
      expect(mockCreateApplication).toHaveBeenCalledWith({
        internshipId: 'internship-uuid-1',
        studentId: 'student-uuid-1',
        coverLetter: 'I am passionate about this role',
        additionalInfo: null,
      });
    });

    it('throws NotFoundError when internship not found', async () => {
      mockFindById.mockResolvedValue(null);

      await expect(
        internshipService.apply('nonexistent-uuid', 'user-uuid-2', applyData),
      ).rejects.toThrow(NotFoundError);
    });

    it('throws NotFoundError when student profile not found', async () => {
      mockFindById.mockResolvedValue(mockInternshipRaw);
      mockStudentFindByUserId.mockResolvedValue(null);

      await expect(
        internshipService.apply('internship-uuid-1', 'user-uuid-2', applyData),
      ).rejects.toThrow(NotFoundError);
    });

    it('throws UnprocessableError when student grade is below minGrade', async () => {
      mockFindById.mockResolvedValue(mockInternshipHighGrade);
      mockStudentFindByUserId.mockResolvedValue(mockStudentProfile); // grade: 10

      await expect(
        internshipService.apply('internship-uuid-1', 'user-uuid-2', applyData),
      ).rejects.toThrow(UnprocessableError);
    });

    it('throws UnprocessableError when student grade is above maxGrade', async () => {
      mockFindById.mockResolvedValue(mockInternshipLowGrade);
      mockStudentFindByUserId.mockResolvedValue(mockStudentProfile); // grade: 10

      await expect(
        internshipService.apply('internship-uuid-1', 'user-uuid-2', applyData),
      ).rejects.toThrow(UnprocessableError);
    });

    it('allows application when student has no grade set (grade: null)', async () => {
      const studentWithNoGrade = { ...mockStudentProfile, grade: null };
      mockFindById.mockResolvedValue(mockInternshipHighGrade); // minGrade: 11
      mockStudentFindByUserId.mockResolvedValue(studentWithNoGrade);
      mockFindApplicationByInternshipAndStudent.mockResolvedValue(null);
      mockCreateApplication.mockResolvedValue(mockApplication);

      const result = await internshipService.apply(
        'internship-uuid-1',
        'user-uuid-2',
        applyData,
      );

      expect(result).toBeDefined();
    });

    it('allows application when internship has no grade requirement', async () => {
      mockFindById.mockResolvedValue(mockInternshipNoGrade);
      mockStudentFindByUserId.mockResolvedValue(mockStudentProfile);
      mockFindApplicationByInternshipAndStudent.mockResolvedValue(null);
      mockCreateApplication.mockResolvedValue(mockApplication);

      const result = await internshipService.apply(
        'internship-uuid-1',
        'user-uuid-2',
        applyData,
      );

      expect(result).toBeDefined();
    });

    it('throws UnprocessableError when deadline has passed', async () => {
      mockFindById.mockResolvedValue(mockInternshipPastDeadline);
      mockStudentFindByUserId.mockResolvedValue(mockStudentProfile);
      mockFindApplicationByInternshipAndStudent.mockResolvedValue(null);

      await expect(
        internshipService.apply('internship-uuid-1', 'user-uuid-2', applyData),
      ).rejects.toThrow(UnprocessableError);
    });

    it('allows application when deadline is null (no deadline set)', async () => {
      mockFindById.mockResolvedValue(mockInternshipNoDeadline);
      mockStudentFindByUserId.mockResolvedValue(mockStudentProfile);
      mockFindApplicationByInternshipAndStudent.mockResolvedValue(null);
      mockCreateApplication.mockResolvedValue(mockApplication);

      const result = await internshipService.apply(
        'internship-uuid-1',
        'user-uuid-2',
        applyData,
      );

      expect(result).toBeDefined();
    });

    it('throws UnprocessableError when student has no resume', async () => {
      const studentWithNoResume = { ...mockStudentProfile, resumeUrl: null };
      mockFindById.mockResolvedValue(mockInternshipRaw);
      mockStudentFindByUserId.mockResolvedValue(studentWithNoResume);

      await expect(
        internshipService.apply('internship-uuid-1', 'user-uuid-2', applyData),
      ).rejects.toThrow(UnprocessableError);
      expect(mockCreateApplication).not.toHaveBeenCalled();
    });

    it('throws ConflictError when already applied (pre-check)', async () => {
      mockFindById.mockResolvedValue(mockInternshipRaw);
      mockStudentFindByUserId.mockResolvedValue(mockStudentProfile);
      mockFindApplicationByInternshipAndStudent.mockResolvedValue({ id: 'existing-app' });

      await expect(
        internshipService.apply('internship-uuid-1', 'user-uuid-2', applyData),
      ).rejects.toThrow(ConflictError);
      expect(mockCreateApplication).not.toHaveBeenCalled();
    });
  });
});
