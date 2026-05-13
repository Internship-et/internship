// ─────────────────────────────────────────────────────────────
// Student Service — Unit Tests
// Mocks the repository layer. Tests cover:
//  - Admin listing (list)
//  - Profile retrieval (getById, getMyProfile)
//  - Self-upsert with created/updated status (upsertMyProfile)
//  - Update by Student UUID (updateByStudentId)
//  - Application listing (getApplications)
// ─────────────────────────────────────────────────────────────

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NotFoundError, ForbiddenError } from '../../../shared/errors/app-error.js';

// Mock the repository before importing the service
vi.mock('../student.repository.js', () => ({}));

import * as studentService from '../student.service.js';
import * as studentRepository from '../student.repository.js';

// ─── Fixtures ──────────────────────────────────────────────

const mockStudentProfile = {
  id: 'student-uuid-1',
  userId: 'user-uuid-1',
  schoolId: null,
  grade: 10,
  dateOfBirth: new Date('2006-05-15'),
  bio: 'Aspiring software engineer',
  skills: ['JavaScript', 'Python'],
  interests: ['Coding', 'Robotics'],
  languages: ['English', 'Amharic'],
  resumeUrl: null,
  profileImageUrl: null,
  isSchoolVerified: false,
  createdAt: new Date('2025-01-01'),
  updatedAt: new Date('2025-01-15'),
  user: {
    id: 'user-uuid-1',
    email: 'student@example.com',
    firstName: 'Abebe',
    lastName: 'Kebede',
    role: 'STUDENT',
    phone: '+251911111111',
  },
  school: null,
};

const mockFullProfile = {
  ...mockStudentProfile,
  user: {
    ...mockStudentProfile.user,
    status: 'ACTIVE',
  },
};

const mockApplication = {
  id: 'app-uuid-1',
  internshipId: 'internship-uuid-1',
  studentId: 'student-uuid-1',
  status: 'PENDING',
  coverLetter: 'I am passionate about...',
  additionalInfo: null,
  appliedAt: new Date('2025-02-01'),
  updatedAt: new Date('2025-02-01'),
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

// ─── Mock implementations ──────────────────────────────────

const mockFindAll = vi.fn();
const mockFindById = vi.fn();
const mockFindByUserId = vi.fn();
const mockCreate = vi.fn();
const mockUpdate = vi.fn();
const mockCount = vi.fn();
const mockFindApplicationsByStudentId = vi.fn();
const mockCountApplicationsByStudentId = vi.fn();
const mockUpsertUserAndStudent = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();

  // Apply mocks each time
  vi.mocked(studentRepository).findAll = mockFindAll;
  vi.mocked(studentRepository).findById = mockFindById;
  vi.mocked(studentRepository).findByUserId = mockFindByUserId;
  vi.mocked(studentRepository).create = mockCreate;
  vi.mocked(studentRepository).update = mockUpdate;
  vi.mocked(studentRepository).count = mockCount;
  vi.mocked(studentRepository).findApplicationsByStudentId = mockFindApplicationsByStudentId;
  vi.mocked(studentRepository).countApplicationsByStudentId = mockCountApplicationsByStudentId;
  vi.mocked(studentRepository).upsertUserAndStudent = mockUpsertUserAndStudent;
});

// ─── Tests ─────────────────────────────────────────────────

describe('StudentService', () => {
  describe('list', () => {
    it('returns paginated results with filters', async () => {
      const filters = {
        page: 1,
        pageSize: 20,
        search: 'Abebe',
        schoolId: undefined as string | undefined,
        grade: undefined as number | undefined,
        status: undefined as string | undefined,
        sort: 'createdAt',
        order: 'desc' as const,
      };

      mockFindAll.mockResolvedValue([mockFullProfile]);
      mockCount.mockResolvedValue(1);

      const result = await studentService.list(filters);

      expect(result.data).toHaveLength(1);
      expect(result.meta.total).toBe(1);
      expect(result.meta.page).toBe(1);
      expect(mockFindAll).toHaveBeenCalledTimes(1);
      expect(mockCount).toHaveBeenCalledTimes(1);
    });

    it('applies default pagination when no filters provided', async () => {
      const filters = {
        page: 1,
        pageSize: 20,
        search: undefined as string | undefined,
        schoolId: undefined as string | undefined,
        grade: undefined as number | undefined,
        status: undefined as string | undefined,
        sort: 'createdAt',
        order: 'desc' as const,
      };

      mockFindAll.mockResolvedValue([]);
      mockCount.mockResolvedValue(0);

      const result = await studentService.list(filters);

      expect(result.data).toHaveLength(0);
      expect(result.meta.total).toBe(0);
      expect(mockFindAll).toHaveBeenCalled();
    });
  });

  describe('getById', () => {
    it('returns full profile for SELF', async () => {
      mockFindById.mockResolvedValue(mockStudentProfile);

      const result = await studentService.getById(
        'student-uuid-1',
        'user-uuid-1', // SELF
        'STUDENT',
      );

      expect(result).toEqual(mockStudentProfile);
      expect(mockFindById).toHaveBeenCalledWith('student-uuid-1');
    });

    it('returns full profile for ADMIN', async () => {
      mockFindById.mockResolvedValue(mockStudentProfile);

      const result = await studentService.getById(
        'student-uuid-1',
        'admin-uuid',
        'ADMIN',
      );

      expect(result).toEqual(mockStudentProfile);
    });

    it('throws ForbiddenError for non-SELF, non-ADMIN', async () => {
      mockFindById.mockResolvedValue(mockStudentProfile);

      await expect(
        studentService.getById('student-uuid-1', 'other-user-uuid', 'COMPANY'),
      ).rejects.toThrow(ForbiddenError);
    });

    it('throws NotFoundError when student does not exist', async () => {
      mockFindById.mockResolvedValue(null);

      await expect(
        studentService.getById('nonexistent-uuid', 'user-uuid-1', 'STUDENT'),
      ).rejects.toThrow(NotFoundError);
    });
  });

  describe('getMyProfile', () => {
    it('returns own profile when found', async () => {
      mockFindByUserId.mockResolvedValue(mockStudentProfile);

      const result = await studentService.getMyProfile('user-uuid-1');

      expect(result).toEqual(mockStudentProfile);
      expect(mockFindByUserId).toHaveBeenCalledWith('user-uuid-1');
    });

    it('throws NotFoundError when no profile exists', async () => {
      mockFindByUserId.mockResolvedValue(null);

      await expect(
        studentService.getMyProfile('user-uuid-1'),
      ).rejects.toThrow(NotFoundError);
    });
  });

  describe('upsertMyProfile', () => {
    it('creates new Student profile + updates User fields on first-time call', async () => {
      mockFindByUserId.mockResolvedValue(null); // No existing profile
      mockUpsertUserAndStudent.mockResolvedValue(mockStudentProfile);

      const data = {
        firstName: 'Abebe',
        lastName: 'Kebede',
        bio: 'Aspiring software engineer',
        grade: 10,
      };

      const result = await studentService.upsertMyProfile('user-uuid-1', 'STUDENT', data);

      expect(result.created).toBe(true);
      expect(result.profile).toEqual(mockStudentProfile);
      expect(mockUpsertUserAndStudent).toHaveBeenCalledWith(
        'user-uuid-1',
        { firstName: 'Abebe', lastName: 'Kebede' },
        { bio: 'Aspiring software engineer', grade: 10 },
      );
    });

    it('updates existing Student profile + User fields on subsequent calls', async () => {
      mockFindByUserId.mockResolvedValue(mockStudentProfile); // Existing profile
      mockUpsertUserAndStudent.mockResolvedValue(mockStudentProfile);

      const data = {
        bio: 'Updated bio',
        phone: '+251922222222',
      };

      const result = await studentService.upsertMyProfile('user-uuid-1', 'STUDENT', data);

      expect(result.created).toBe(false);
      expect(result.profile).toEqual(mockStudentProfile);
      expect(mockUpsertUserAndStudent).toHaveBeenCalledWith(
        'user-uuid-1',
        { phone: '+251922222222' },
        { bio: 'Updated bio' },
      );
    });

    it('does not call User update if no User-level fields changed', async () => {
      mockFindByUserId.mockResolvedValue(mockStudentProfile);
      mockUpsertUserAndStudent.mockResolvedValue(mockStudentProfile);

      const data = {
        bio: 'Just updating my bio',
      };

      const result = await studentService.upsertMyProfile('user-uuid-1', 'STUDENT', data);

      expect(result.created).toBe(false);
      expect(mockUpsertUserAndStudent).toHaveBeenCalledWith(
        'user-uuid-1',
        {}, // No User fields
        { bio: 'Just updating my bio' },
      );
    });

    it('throws ForbiddenError when user role is not STUDENT', async () => {
      await expect(
        studentService.upsertMyProfile('user-uuid-2', 'COMPANY', { bio: 'test' }),
      ).rejects.toThrow(ForbiddenError);

      await expect(
        studentService.upsertMyProfile('user-uuid-3', 'ADMIN', { bio: 'test' }),
      ).rejects.toThrow(ForbiddenError);

      await expect(
        studentService.upsertMyProfile('user-uuid-4', 'SCHOOL', { bio: 'test' }),
      ).rejects.toThrow(ForbiddenError);
    });

    it('empty body creates minimal profile on first call (created: true)', async () => {
      mockFindByUserId.mockResolvedValue(null);
      mockUpsertUserAndStudent.mockResolvedValue(mockStudentProfile);

      const result = await studentService.upsertMyProfile('user-uuid-1', 'STUDENT', {});

      expect(result.created).toBe(true);
      expect(mockUpsertUserAndStudent).toHaveBeenCalledWith(
        'user-uuid-1',
        {},
        {},
      );
    });

    it('empty body returns existing profile unchanged (created: false)', async () => {
      mockFindByUserId.mockResolvedValue(mockStudentProfile);
      mockUpsertUserAndStudent.mockResolvedValue(mockStudentProfile);

      const result = await studentService.upsertMyProfile('user-uuid-1', 'STUDENT', {});

      expect(result.created).toBe(false);
      expect(result.profile).toEqual(mockStudentProfile);
    });
  });

  describe('updateByStudentId', () => {
    it('updates Student fields on existing profile', async () => {
      mockFindById.mockResolvedValue(mockStudentProfile);
      mockUpdate.mockResolvedValue({
        ...mockStudentProfile,
        bio: 'Updated bio for testing',
      });

      const data = { bio: 'Updated bio for testing' };

      const result = await studentService.updateByStudentId(
        'student-uuid-1',
        data,
        'user-uuid-1',
        'STUDENT',
      );

      expect(result.bio).toBe('Updated bio for testing');
      expect(mockUpdate).toHaveBeenCalledWith('student-uuid-1', data);
    });

    it('throws NotFoundError when student does not exist', async () => {
      mockFindById.mockResolvedValue(null);

      await expect(
        studentService.updateByStudentId(
          'nonexistent-uuid',
          { bio: 'test' },
          'user-uuid-1',
          'STUDENT',
        ),
      ).rejects.toThrow(NotFoundError);
    });

    it('throws ForbiddenError for non-owner, non-ADMIN', async () => {
      mockFindById.mockResolvedValue(mockStudentProfile);

      await expect(
        studentService.updateByStudentId(
          'student-uuid-1',
          { bio: 'test' },
          'other-user-uuid',
          'COMPANY',
        ),
      ).rejects.toThrow(ForbiddenError);
    });
  });

  describe('getApplications', () => {
    it('returns paginated applications for SELF', async () => {
      mockFindById.mockResolvedValue(mockStudentProfile);
      mockFindApplicationsByStudentId.mockResolvedValue([mockApplication]);
      mockCountApplicationsByStudentId.mockResolvedValue(1);

      const result = await studentService.getApplications(
        'student-uuid-1',
        { page: 1, pageSize: 20 },
        'user-uuid-1',
        'STUDENT',
      );

      expect(result.data).toHaveLength(1);
      expect(result.meta.total).toBe(1);
      expect(mockFindApplicationsByStudentId).toHaveBeenCalled();
      expect(mockCountApplicationsByStudentId).toHaveBeenCalled();
    });

    it('returns paginated applications for ADMIN', async () => {
      mockFindById.mockResolvedValue(mockStudentProfile);
      mockFindApplicationsByStudentId.mockResolvedValue([mockApplication]);
      mockCountApplicationsByStudentId.mockResolvedValue(1);

      const result = await studentService.getApplications(
        'student-uuid-1',
        { page: 1, pageSize: 20 },
        'admin-uuid',
        'ADMIN',
      );

      expect(result.data).toHaveLength(1);
    });

    it('throws ForbiddenError for unauthorized user', async () => {
      mockFindById.mockResolvedValue(mockStudentProfile);

      await expect(
        studentService.getApplications(
          'student-uuid-1',
          { page: 1, pageSize: 20 },
          'other-user-uuid',
          'COMPANY',
        ),
      ).rejects.toThrow(ForbiddenError);
    });

    it('throws NotFoundError when student not found', async () => {
      mockFindById.mockResolvedValue(null);

      await expect(
        studentService.getApplications(
          'nonexistent-uuid',
          { page: 1, pageSize: 20 },
          'user-uuid-1',
          'STUDENT',
        ),
      ).rejects.toThrow(NotFoundError);
    });
  });
});
