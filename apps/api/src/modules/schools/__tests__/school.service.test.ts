// ─────────────────────────────────────────────────────────────
// School Service — Unit Tests
// Mocks the repository layer. Tests cover:
//  - Public listing (list)
//  - Public profile retrieval (getById)
//  - School creation with uniqueness checks (create)
//  - School update with ownership + uniqueness (update)
//  - Student verification (verifyStudent)
// ─────────────────────────────────────────────────────────────

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NotFoundError, ForbiddenError, ConflictError, UnprocessableError } from '../../../shared/errors/app-error.js';
import type { SchoolType } from '../../../generated/prisma/enums.js';

// Mock the repository before importing the service
vi.mock('../school.repository.js', () => ({}));

import * as schoolService from '../school.service.js';
import * as schoolRepository from '../school.repository.js';

// ─── Fixtures ──────────────────────────────────────────────

const mockSchoolProfile = {
  id: 'school-uuid-1',
  userId: 'user-uuid-1',
  name: 'Bole High School',
  type: 'PUBLIC' as const,
  city: 'Addis Ababa',
  address: 'Bole Sub-city, Kebele 14',
  phone: '+251111234567',
  email: 'info@bolehigh.edu.et',
  website: 'https://bolehigh.edu.et',
  principal: 'Tadesse Alemu',
  gradesOffered: [9, 10, 11, 12],
  logoUrl: null,
  licenseNumber: 'LIC-001',
  isVerified: false,
  createdAt: new Date('2025-01-15'),
  updatedAt: new Date('2025-01-15'),
  deletedAt: null,
  user: {
    id: 'user-uuid-1',
    email: 'school@example.com',
    firstName: 'Tadesse',
    lastName: 'Alemu',
    role: 'SCHOOL',
    phone: '+251111234567',
  },
  _count: { students: 5 },
};

const mockPublicSchoolList = {
  id: 'school-uuid-1',
  name: 'Bole High School',
  type: 'PUBLIC',
  city: 'Addis Ababa',
  address: 'Bole Sub-city, Kebele 14',
  phone: '+251111234567',
  email: 'info@bolehigh.edu.et',
  website: 'https://bolehigh.edu.et',
  principal: 'Tadesse Alemu',
  gradesOffered: [9, 10, 11, 12],
  logoUrl: null,
  isVerified: false,
  createdAt: new Date('2025-01-15'),
  updatedAt: new Date('2025-01-15'),
  _count: { students: 5 },
};

const mockStudent = {
  id: 'student-uuid-1',
  schoolId: 'school-uuid-1',
  grade: 10,
  isSchoolVerified: false,
};

const mockUpdatedStudent = {
  id: 'student-uuid-1',
  schoolId: 'school-uuid-1',
  grade: 10,
  isSchoolVerified: true,
  updatedAt: new Date('2025-02-01'),
};

// ─── Mock implementations ──────────────────────────────────

const mockFindAll = vi.fn();
const mockCount = vi.fn();
const mockCountVerifiedStudentsBySchoolIds = vi.fn();
const mockFindById = vi.fn();
const mockFindByUserId = vi.fn();
const mockFindByName = vi.fn();
const mockCreate = vi.fn();
const mockUpdate = vi.fn();
const mockFindStudentForVerification = vi.fn();
const mockUpdateStudentVerification = vi.fn();
const mockCreateAuditLog = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();

  vi.mocked(schoolRepository).findAll = mockFindAll;
  vi.mocked(schoolRepository).count = mockCount;
  vi.mocked(schoolRepository).countVerifiedStudentsBySchoolIds = mockCountVerifiedStudentsBySchoolIds;
  vi.mocked(schoolRepository).findById = mockFindById;
  vi.mocked(schoolRepository).findByUserId = mockFindByUserId;
  vi.mocked(schoolRepository).findByName = mockFindByName;
  vi.mocked(schoolRepository).create = mockCreate;
  vi.mocked(schoolRepository).update = mockUpdate;
  vi.mocked(schoolRepository).findStudentForVerification = mockFindStudentForVerification;
  vi.mocked(schoolRepository).updateStudentVerification = mockUpdateStudentVerification;
  vi.mocked(schoolRepository).createAuditLog = mockCreateAuditLog;
});

// ─── Tests ─────────────────────────────────────────────────

describe('SchoolService', () => {
  describe('list', () => {
    it('returns paginated results with filters', async () => {
      const filters = {
        page: 1,
        pageSize: 20,
        search: 'Bole',
        city: undefined as string | undefined,
        type: undefined as SchoolType | undefined,
        sort: 'name',
        order: 'asc' as const,
      };

      mockFindAll.mockResolvedValue([mockPublicSchoolList]);
      mockCount.mockResolvedValue(1);
      mockCountVerifiedStudentsBySchoolIds.mockResolvedValue(new Map([['school-uuid-1', 3]]));

      const result = await schoolService.list(filters);

      expect(result.data).toHaveLength(1);
      expect(result.data[0]).not.toHaveProperty('userId');
      expect(result.data[0]).not.toHaveProperty('licenseNumber');
      expect(result.data[0]).toHaveProperty('studentCount', 5);
      expect(result.data[0]).toHaveProperty('verifiedStudentCount', 3);
      expect(result.meta.total).toBe(1);
      expect(result.meta.page).toBe(1);
      expect(mockFindAll).toHaveBeenCalledTimes(1);
      expect(mockCount).toHaveBeenCalledTimes(1);
      expect(mockCountVerifiedStudentsBySchoolIds).toHaveBeenCalledWith(['school-uuid-1']);
    });

    it('returns empty array when no schools exist', async () => {
      const filters = {
        page: 1,
        pageSize: 20,
        search: undefined as string | undefined,
        city: undefined as string | undefined,
        type: undefined as SchoolType | undefined,
        sort: 'name',
        order: 'asc' as const,
      };

      mockFindAll.mockResolvedValue([]);
      mockCount.mockResolvedValue(0);
      mockCountVerifiedStudentsBySchoolIds.mockResolvedValue(new Map());

      const result = await schoolService.list(filters);

      expect(result.data).toHaveLength(0);
      expect(result.meta.total).toBe(0);
    });

    it('returns 0 verifiedStudentCount when no students are verified', async () => {
      const filters = {
        page: 1,
        pageSize: 20,
        search: undefined as string | undefined,
        city: undefined as string | undefined,
        type: undefined as SchoolType | undefined,
        sort: 'name',
        order: 'asc' as const,
      };

      mockFindAll.mockResolvedValue([mockPublicSchoolList]);
      mockCount.mockResolvedValue(1);
      mockCountVerifiedStudentsBySchoolIds.mockResolvedValue(new Map());

      const result = await schoolService.list(filters);

      expect(result.data[0].verifiedStudentCount).toBe(0);
    });

    it('filters by city', async () => {
      const filters = {
        page: 1,
        pageSize: 20,
        search: undefined as string | undefined,
        city: 'Addis Ababa',
        type: undefined as SchoolType | undefined,
        sort: 'name',
        order: 'asc' as const,
      };

      mockFindAll.mockResolvedValue([mockPublicSchoolList]);
      mockCount.mockResolvedValue(1);
      mockCountVerifiedStudentsBySchoolIds.mockResolvedValue(new Map([['school-uuid-1', 3]]));

      const result = await schoolService.list(filters);

      expect(result.data).toHaveLength(1);
      expect(mockFindAll).toHaveBeenCalledWith(expect.objectContaining({ city: 'Addis Ababa' }));
    });

    it('filters by type', async () => {
      const filters = {
        page: 1,
        pageSize: 20,
        search: undefined as string | undefined,
        city: undefined as string | undefined,
        type: 'PUBLIC' as SchoolType,
        sort: 'name',
        order: 'asc' as const,
      };

      mockFindAll.mockResolvedValue([mockPublicSchoolList]);
      mockCount.mockResolvedValue(1);
      mockCountVerifiedStudentsBySchoolIds.mockResolvedValue(new Map([['school-uuid-1', 3]]));

      const result = await schoolService.list(filters);

      expect(result.data).toHaveLength(1);
      expect(mockFindAll).toHaveBeenCalledWith(expect.objectContaining({ type: 'PUBLIC' }));
    });

    it('returns empty list for non-matching search', async () => {
      const filters = {
        page: 1,
        pageSize: 20,
        search: 'NonexistentSchool',
        city: undefined as string | undefined,
        type: undefined as SchoolType | undefined,
        sort: 'name',
        order: 'asc' as const,
      };

      mockFindAll.mockResolvedValue([]);
      mockCount.mockResolvedValue(0);
      mockCountVerifiedStudentsBySchoolIds.mockResolvedValue(new Map());

      const result = await schoolService.list(filters);

      expect(result.data).toHaveLength(0);
      expect(result.meta.total).toBe(0);
    });

    it('returns empty list for non-matching city filter', async () => {
      const filters = {
        page: 1,
        pageSize: 20,
        search: undefined as string | undefined,
        city: 'NonExistentCity',
        type: undefined as SchoolType | undefined,
        sort: 'name',
        order: 'asc' as const,
      };

      mockFindAll.mockResolvedValue([]);
      mockCount.mockResolvedValue(0);
      mockCountVerifiedStudentsBySchoolIds.mockResolvedValue(new Map());

      const result = await schoolService.list(filters);

      expect(result.data).toHaveLength(0);
    });
  });

  describe('getById', () => {
    it('returns full public profile when found', async () => {
      mockFindById.mockResolvedValue(mockSchoolProfile);
      mockCountVerifiedStudentsBySchoolIds.mockResolvedValue(new Map([['school-uuid-1', 3]]));

      const result = await schoolService.getById('school-uuid-1');

      expect(result).not.toHaveProperty('userId');
      expect(result).not.toHaveProperty('licenseNumber');
      expect(result).not.toHaveProperty('user');
      expect(result).not.toHaveProperty('_count');
      expect(result).toHaveProperty('studentCount', 5);
      expect(result).toHaveProperty('verifiedStudentCount', 3);
      expect(mockFindById).toHaveBeenCalledWith('school-uuid-1');
    });

    it('throws NotFoundError when school does not exist', async () => {
      mockFindById.mockResolvedValue(null);

      await expect(
        schoolService.getById('nonexistent-uuid'),
      ).rejects.toThrow(NotFoundError);
    });
  });

  describe('create', () => {
    const createData = {
      name: 'New School',
      type: 'PUBLIC' as const,
      city: 'Addis Ababa',
    };

    it('creates school profile for SCHOOL user', async () => {
      mockFindByUserId.mockResolvedValue(null);
      mockFindByName.mockResolvedValue(null);
      mockCreate.mockResolvedValue(mockSchoolProfile);

      const result = await schoolService.create(createData, 'user-uuid-1');

      expect(result).not.toHaveProperty('userId');
      expect(result).not.toHaveProperty('licenseNumber');
      expect(result).toHaveProperty('studentCount');
      expect(mockCreate).toHaveBeenCalledWith({ ...createData, userId: 'user-uuid-1' });
    });

    it('throws ConflictError when user already has a school profile', async () => {
      mockFindByUserId.mockResolvedValue(mockSchoolProfile);

      await expect(
        schoolService.create(createData, 'user-uuid-1'),
      ).rejects.toThrow(ConflictError);
    });

    it('throws ConflictError when school name already exists', async () => {
      mockFindByUserId.mockResolvedValue(null);
      mockFindByName.mockResolvedValue(mockSchoolProfile);

      await expect(
        schoolService.create(createData, 'user-uuid-1'),
      ).rejects.toThrow(ConflictError);
    });

    it('creates school with optional fields', async () => {
      const fullData = {
        name: 'Full School',
        type: 'PRIVATE' as const,
        city: 'Adama',
        address: 'Main Street',
        phone: '+251911111111',
        email: 'info@school.edu.et',
        website: 'https://school.edu.et',
        principal: 'John Doe',
        gradesOffered: [9, 10, 11, 12],
        logoUrl: 'https://storage.example.com/logo.png',
        licenseNumber: 'LIC-002',
      };

      mockFindByUserId.mockResolvedValue(null);
      mockFindByName.mockResolvedValue(null);
      mockCreate.mockResolvedValue({ ...mockSchoolProfile, ...fullData });

      const result = await schoolService.create(fullData, 'user-uuid-2');

      expect(result).not.toHaveProperty('userId');
      expect(result).not.toHaveProperty('licenseNumber');
      expect(mockCreate).toHaveBeenCalledWith({ ...fullData, userId: 'user-uuid-2' });
    });
  });

  describe('update', () => {
    const updateData = { city: 'Adama' };

    it('updates own school (owner)', async () => {
      mockFindById.mockResolvedValue(mockSchoolProfile);
      mockUpdate.mockResolvedValue({ ...mockSchoolProfile, ...updateData });
      mockCountVerifiedStudentsBySchoolIds.mockResolvedValue(new Map([['school-uuid-1', 3]]));

      const result = await schoolService.update(
        'school-uuid-1',
        updateData,
        'user-uuid-1', // owner
        'SCHOOL',
      );

      expect(result).toHaveProperty('city', 'Adama');
      expect(result).not.toHaveProperty('userId');
      expect(result).not.toHaveProperty('licenseNumber');
      expect(mockUpdate).toHaveBeenCalledWith('school-uuid-1', updateData);
    });

    it('updates any school (ADMIN)', async () => {
      mockFindById.mockResolvedValue(mockSchoolProfile);
      mockUpdate.mockResolvedValue({ ...mockSchoolProfile, ...updateData });
      mockCountVerifiedStudentsBySchoolIds.mockResolvedValue(new Map([['school-uuid-1', 3]]));

      const result = await schoolService.update(
        'school-uuid-1',
        updateData,
        'admin-uuid',
        'ADMIN',
      );

      expect(result).toHaveProperty('city', 'Adama');
    });

    it('throws NotFoundError when school does not exist', async () => {
      mockFindById.mockResolvedValue(null);

      await expect(
        schoolService.update('nonexistent-uuid', updateData, 'user-uuid-1', 'SCHOOL'),
      ).rejects.toThrow(NotFoundError);
    });

    it('throws ForbiddenError for non-owner, non-ADMIN', async () => {
      mockFindById.mockResolvedValue(mockSchoolProfile);

      await expect(
        schoolService.update('school-uuid-1', updateData, 'other-user-uuid', 'SCHOOL'),
      ).rejects.toThrow(ForbiddenError);
    });

    it('throws ForbiddenError for STUDENT role', async () => {
      mockFindById.mockResolvedValue(mockSchoolProfile);

      await expect(
        schoolService.update('school-uuid-1', updateData, 'student-uuid', 'STUDENT'),
      ).rejects.toThrow(ForbiddenError);
    });

    it('throws ConflictError when changing to an existing name', async () => {
      mockFindById.mockResolvedValue(mockSchoolProfile);
      mockFindByName.mockResolvedValue({ id: 'other-school-uuid', name: 'Name Taken' });

      await expect(
        schoolService.update(
          'school-uuid-1',
          { name: 'Name Taken' },
          'user-uuid-1',
          'SCHOOL',
        ),
      ).rejects.toThrow(ConflictError);
    });

    it('allows update when findByName returns the same school (no conflict)', async () => {
      mockFindById.mockResolvedValue(mockSchoolProfile);
      mockFindByName.mockResolvedValue({ id: 'school-uuid-1', name: 'Bole High School' });
      mockUpdate.mockResolvedValue({ ...mockSchoolProfile, name: 'Bole High School' });
      mockCountVerifiedStudentsBySchoolIds.mockResolvedValue(new Map([['school-uuid-1', 3]]));

      const result = await schoolService.update(
        'school-uuid-1',
        { name: 'Bole High School' },
        'user-uuid-1',
        'SCHOOL',
      );

      expect(result).toBeDefined();
      expect(mockUpdate).toHaveBeenCalled();
    });

    it('allows update when findByName returns null (name is free)', async () => {
      mockFindById.mockResolvedValue(mockSchoolProfile);
      mockFindByName.mockResolvedValue(null);
      mockUpdate.mockResolvedValue({ ...mockSchoolProfile, name: 'New Name' });
      mockCountVerifiedStudentsBySchoolIds.mockResolvedValue(new Map([['school-uuid-1', 3]]));

      const result = await schoolService.update(
        'school-uuid-1',
        { name: 'New Name' },
        'user-uuid-1',
        'SCHOOL',
      );

      expect(result).toBeDefined();
    });

    it('does not check name uniqueness if name is not provided', async () => {
      mockFindById.mockResolvedValue(mockSchoolProfile);
      mockUpdate.mockResolvedValue(mockSchoolProfile);
      mockCountVerifiedStudentsBySchoolIds.mockResolvedValue(new Map([['school-uuid-1', 3]]));

      await schoolService.update(
        'school-uuid-1',
        { city: 'Adama' },
        'user-uuid-1',
        'SCHOOL',
      );

      expect(mockFindByName).not.toHaveBeenCalled();
    });

    it('does not check uniqueness if the same name is provided (no change)', async () => {
      mockFindById.mockResolvedValue(mockSchoolProfile);
      mockUpdate.mockResolvedValue(mockSchoolProfile);
      mockCountVerifiedStudentsBySchoolIds.mockResolvedValue(new Map([['school-uuid-1', 3]]));

      await schoolService.update(
        'school-uuid-1',
        { name: 'Bole High School' }, // Same as existing name
        'user-uuid-1',
        'SCHOOL',
      );

      expect(mockFindByName).not.toHaveBeenCalled();
    });
  });

  describe('verifyStudent', () => {
    const verifyData = {
      studentId: 'student-uuid-1',
      isEnrolled: true,
      grade: 10,
    };

    it('verifies a student enrolled at the school', async () => {
      mockFindById.mockResolvedValue(mockSchoolProfile);
      mockFindStudentForVerification.mockResolvedValue(mockStudent);
      mockUpdateStudentVerification.mockResolvedValue(mockUpdatedStudent);
      mockCreateAuditLog.mockResolvedValue({});

      const result = await schoolService.verifyStudent(
        'school-uuid-1',
        verifyData,
        'user-uuid-1', // owner
        'SCHOOL',
      );

      expect(result.studentId).toBe('student-uuid-1');
      expect(result.schoolId).toBe('school-uuid-1');
      expect(result.isVerified).toBe(true);
      expect(result.grade).toBe(10);
      expect(result.verifiedBy).toBe('user-uuid-1');
      expect(mockCreateAuditLog).toHaveBeenCalledWith({
        userId: 'user-uuid-1',
        action: 'SCHOOL_VERIFICATION',
        entity: 'STUDENT',
        entityId: 'student-uuid-1',
        oldValue: {
          studentId: 'student-uuid-1',
          schoolId: 'school-uuid-1',
          isSchoolVerified: false,
          grade: 10,
          graduationYear: null,
          notes: null,
        },
        newValue: {
          studentId: 'student-uuid-1',
          schoolId: 'school-uuid-1',
          isSchoolVerified: true,
          grade: 10,
          graduationYear: null,
          notes: null,
        },
      });
    });

    it('revokes student verification (isEnrolled=false)', async () => {
      const mockVerifiedStudent = { ...mockStudent, isSchoolVerified: true };
      const mockAfterRevoke = {
        ...mockUpdatedStudent,
        isSchoolVerified: false,
        updatedAt: new Date('2025-02-02'),
      };

      mockFindById.mockResolvedValue(mockSchoolProfile);
      mockFindStudentForVerification.mockResolvedValue(mockVerifiedStudent);
      mockUpdateStudentVerification.mockResolvedValue(mockAfterRevoke);
      mockCreateAuditLog.mockResolvedValue({});

      const result = await schoolService.verifyStudent(
        'school-uuid-1',
        { studentId: 'student-uuid-1', isEnrolled: false },
        'user-uuid-1',
        'SCHOOL',
      );

      expect(result.isVerified).toBe(false);
      expect(mockCreateAuditLog).toHaveBeenCalledWith({
        userId: 'user-uuid-1',
        action: 'SCHOOL_VERIFICATION_REVOKED',
        entity: 'STUDENT',
        entityId: 'student-uuid-1',
        oldValue: {
          studentId: 'student-uuid-1',
          schoolId: 'school-uuid-1',
          isSchoolVerified: true,
          grade: 10,
          graduationYear: null,
          notes: null,
        },
        newValue: {
          studentId: 'student-uuid-1',
          schoolId: 'school-uuid-1',
          isSchoolVerified: false,
          grade: 10,
          graduationYear: null,
          notes: null,
        },
      });
    });

    it('throws NotFoundError when school not found', async () => {
      mockFindById.mockResolvedValue(null);

      await expect(
        schoolService.verifyStudent('nonexistent-uuid', verifyData, 'user-uuid-1', 'SCHOOL'),
      ).rejects.toThrow(NotFoundError);
    });

    it('throws ForbiddenError for non-owner, non-ADMIN', async () => {
      mockFindById.mockResolvedValue(mockSchoolProfile);

      await expect(
        schoolService.verifyStudent('school-uuid-1', verifyData, 'other-user-uuid', 'SCHOOL'),
      ).rejects.toThrow(ForbiddenError);
    });

    it('throws NotFoundError when student not found', async () => {
      mockFindById.mockResolvedValue(mockSchoolProfile);
      mockFindStudentForVerification.mockResolvedValue(null);

      await expect(
        schoolService.verifyStudent('school-uuid-1', verifyData, 'user-uuid-1', 'SCHOOL'),
      ).rejects.toThrow(NotFoundError);
    });

    it('includes graduationYear and notes in audit log when provided', async () => {
      mockFindById.mockResolvedValue(mockSchoolProfile);
      mockFindStudentForVerification.mockResolvedValue(mockStudent);
      // Smart mock: applies grade from update data so audit log reflects the provided value
      mockUpdateStudentVerification.mockImplementation((_studentId, data) =>
        Promise.resolve({
          ...mockUpdatedStudent,
          ...(data.grade !== undefined && { grade: data.grade }),
          isSchoolVerified: data.isSchoolVerified,
        }),
      );
      mockCreateAuditLog.mockResolvedValue({});

      const result = await schoolService.verifyStudent(
        'school-uuid-1',
        {
          studentId: 'student-uuid-1',
          isEnrolled: true,
          grade: 11,
          graduationYear: 2028,
          notes: 'Verified based on transcript submission',
        },
        'user-uuid-1',
        'SCHOOL',
      );

      expect(result.isVerified).toBe(true);
      expect(mockCreateAuditLog).toHaveBeenCalledWith(
        expect.objectContaining({
          newValue: expect.objectContaining({
            studentId: 'student-uuid-1',
            schoolId: 'school-uuid-1',
            isSchoolVerified: true,
            grade: 11,
            graduationYear: 2028,
            notes: 'Verified based on transcript submission',
          }),
        }),
      );
    });

    it('includes notes in revocation audit log when provided', async () => {
      const mockVerifiedStudent = { ...mockStudent, isSchoolVerified: true };
      const mockAfterRevoke = {
        ...mockUpdatedStudent,
        isSchoolVerified: false,
        updatedAt: new Date('2025-02-02'),
      };

      mockFindById.mockResolvedValue(mockSchoolProfile);
      mockFindStudentForVerification.mockResolvedValue(mockVerifiedStudent);
      mockUpdateStudentVerification.mockResolvedValue(mockAfterRevoke);
      mockCreateAuditLog.mockResolvedValue({});

      await schoolService.verifyStudent(
        'school-uuid-1',
        {
          studentId: 'student-uuid-1',
          isEnrolled: false,
          notes: 'Student transferred to another school',
        },
        'user-uuid-1',
        'SCHOOL',
      );

      expect(mockCreateAuditLog).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'SCHOOL_VERIFICATION_REVOKED',
          newValue: expect.objectContaining({
            studentId: 'student-uuid-1',
            schoolId: 'school-uuid-1',
            isSchoolVerified: false,
            notes: 'Student transferred to another school',
          }),
        }),
      );
    });

    it('throws UnprocessableError when student not linked to this school', async () => {
      const studentOtherSchool = { ...mockStudent, schoolId: 'other-school-uuid' };
      mockFindById.mockResolvedValue(mockSchoolProfile);
      mockFindStudentForVerification.mockResolvedValue(studentOtherSchool);

      await expect(
        schoolService.verifyStudent('school-uuid-1', verifyData, 'user-uuid-1', 'SCHOOL'),
      ).rejects.toThrow(UnprocessableError);
    });
  });
});
