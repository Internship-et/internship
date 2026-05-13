// ─────────────────────────────────────────────────────────────
// Company Service — Unit Tests
// Mocks the repository layer. Tests cover:
//  - Public listing (list)
//  - Public profile retrieval (getById)
//  - Company creation with uniqueness checks (create)
//  - Company update with ownership + uniqueness (update)
//  - Public internship listing (getInternships)
//  - Scoped application listing (getApplications)
// ─────────────────────────────────────────────────────────────

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NotFoundError, ForbiddenError, ConflictError } from '../../../shared/errors/app-error.js';

// Mock the repository before importing the service
vi.mock('../company.repository.js', () => ({}));

import * as companyService from '../company.service.js';
import * as companyRepository from '../company.repository.js';

// ─── Fixtures ──────────────────────────────────────────────

const mockCompanyProfile = {
  id: 'company-uuid-1',
  userId: 'user-uuid-1',
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
  createdAt: new Date('2025-01-01'),
  updatedAt: new Date('2025-01-15'),
  deletedAt: null,
  user: {
    id: 'user-uuid-1',
    email: 'company@example.com',
    firstName: 'Elias',
    lastName: 'Chala',
    role: 'COMPANY',
    phone: '+251911111111',
  },
  internships: [
    { id: 'int-1', status: 'ACTIVE', deletedAt: null },
    { id: 'int-2', status: 'ACTIVE', deletedAt: null },
    { id: 'int-3', status: 'CLOSED', deletedAt: null },
  ],
};

const mockCompanyWithCount = {
  ...mockCompanyProfile,
  _count: { internships: 2 },
};

const mockInternship = {
  id: 'internship-uuid-1',
  title: 'Software Engineering Intern',
  description: 'Join our team',
  type: 'REMOTE',
  city: 'Addis Ababa',
  durationMonths: 3,
  weeklyHours: 40,
  startDate: new Date('2025-06-01'),
  deadline: new Date('2025-05-01'),
  stipend: null,
  tags: ['JavaScript', 'React'],
  status: 'ACTIVE',
  createdAt: new Date('2025-03-01'),
  updatedAt: new Date('2025-03-01'),
};

const mockApplication = {
  id: 'app-uuid-1',
  internshipId: 'internship-uuid-1',
  studentId: 'student-uuid-1',
  status: 'PENDING',
  coverLetter: 'I am passionate...',
  additionalInfo: null,
  appliedAt: new Date('2025-04-01'),
  updatedAt: new Date('2025-04-01'),
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
    id: 'internship-uuid-1',
    title: 'Software Engineering Intern',
    status: 'ACTIVE',
  },
};

// ─── Mock implementations ──────────────────────────────────

const mockFindAll = vi.fn();
const mockFindById = vi.fn();
const mockFindByUserId = vi.fn();
const mockFindByName = vi.fn();
const mockFindByTinNumber = vi.fn();
const mockCreate = vi.fn();
const mockUpdate = vi.fn();
const mockCount = vi.fn();
const mockFindInternshipsByCompanyId = vi.fn();
const mockCountInternshipsByCompanyId = vi.fn();
const mockFindApplicationsByCompanyId = vi.fn();
const mockCountApplicationsByCompanyId = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();

  vi.mocked(companyRepository).findAll = mockFindAll;
  vi.mocked(companyRepository).findById = mockFindById;
  vi.mocked(companyRepository).findByUserId = mockFindByUserId;
  vi.mocked(companyRepository).findByName = mockFindByName;
  vi.mocked(companyRepository).findByTinNumber = mockFindByTinNumber;
  vi.mocked(companyRepository).create = mockCreate;
  vi.mocked(companyRepository).update = mockUpdate;
  vi.mocked(companyRepository).count = mockCount;
  vi.mocked(companyRepository).findInternshipsByCompanyId = mockFindInternshipsByCompanyId;
  vi.mocked(companyRepository).countInternshipsByCompanyId = mockCountInternshipsByCompanyId;
  vi.mocked(companyRepository).findApplicationsByCompanyId = mockFindApplicationsByCompanyId;
  vi.mocked(companyRepository).countApplicationsByCompanyId = mockCountApplicationsByCompanyId;
});

// ─── Tests ─────────────────────────────────────────────────

describe('CompanyService', () => {
  describe('list', () => {
    it('returns paginated results with filters', async () => {
      const filters = {
        page: 1,
        pageSize: 20,
        search: 'Tech',
        industry: undefined as string | undefined,
        city: undefined as string | undefined,
        hasActiveInternships: undefined as boolean | undefined,
        sort: 'createdAt',
        order: 'desc' as const,
      };

      mockFindAll.mockResolvedValue([mockCompanyWithCount]);
      mockCount.mockResolvedValue(1);

      const result = await companyService.list(filters);

      expect(result.data).toHaveLength(1);
      expect(result.data[0]).not.toHaveProperty('tinNumber');
      expect(result.data[0]).not.toHaveProperty('userId');
      expect(result.data[0]).not.toHaveProperty('user');
      expect(result.data[0]).not.toHaveProperty('socialLinks');
      expect(result.data[0]).toHaveProperty('activeInternshipCount', 2);
      expect(result.meta.total).toBe(1);
      expect(result.meta.page).toBe(1);
      expect(mockFindAll).toHaveBeenCalledTimes(1);
      expect(mockCount).toHaveBeenCalledTimes(1);
    });

    it('returns empty array when no companies exist', async () => {
      const filters = {
        page: 1,
        pageSize: 20,
        search: undefined as string | undefined,
        industry: undefined as string | undefined,
        city: undefined as string | undefined,
        hasActiveInternships: undefined as boolean | undefined,
        sort: 'createdAt',
        order: 'desc' as const,
      };

      mockFindAll.mockResolvedValue([]);
      mockCount.mockResolvedValue(0);

      const result = await companyService.list(filters);

      expect(result.data).toHaveLength(0);
      expect(result.meta.total).toBe(0);
    });
  });

  describe('getById', () => {
    it('returns full public profile when found', async () => {
      mockFindById.mockResolvedValue(mockCompanyProfile);

      const result = await companyService.getById('company-uuid-1');

      expect(result).not.toHaveProperty('tinNumber');
      expect(result).not.toHaveProperty('userId');
      expect(result).not.toHaveProperty('user');
      expect(result).toHaveProperty('activeInternshipCount', 2);
      expect(result).toHaveProperty('totalInternshipsCompleted', 1);
      expect(mockFindById).toHaveBeenCalledWith('company-uuid-1');
    });

    it('throws NotFoundError when company does not exist', async () => {
      mockFindById.mockResolvedValue(null);

      await expect(
        companyService.getById('nonexistent-uuid'),
      ).rejects.toThrow(NotFoundError);
    });
  });

  describe('create', () => {
    const createData = {
      name: 'New Tech Corp',
      industry: 'TECHNOLOGY',
      description: 'A new tech company',
      city: 'Addis Ababa',
      tinNumber: 'TIN-999',
    };

    it('creates company profile for COMPANY user', async () => {
      mockFindByUserId.mockResolvedValue(null);
      mockFindByName.mockResolvedValue(null);
      mockFindByTinNumber.mockResolvedValue(null);
      mockCreate.mockResolvedValue(mockCompanyProfile);

      const result = await companyService.create(createData, 'user-uuid-1');

      expect(result).toEqual(mockCompanyProfile);
      expect(mockCreate).toHaveBeenCalledWith({ ...createData, userId: 'user-uuid-1' });
    });

    it('throws ConflictError when user already has a company profile', async () => {
      mockFindByUserId.mockResolvedValue(mockCompanyProfile);

      await expect(
        companyService.create(createData, 'user-uuid-1'),
      ).rejects.toThrow(ConflictError);
    });

    it('throws ConflictError when company name already exists', async () => {
      mockFindByUserId.mockResolvedValue(null);
      mockFindByName.mockResolvedValue(mockCompanyProfile);

      await expect(
        companyService.create(createData, 'user-uuid-1'),
      ).rejects.toThrow(ConflictError);
    });

    it('throws ConflictError when TIN number already exists', async () => {
      mockFindByUserId.mockResolvedValue(null);
      mockFindByName.mockResolvedValue(null);
      mockFindByTinNumber.mockResolvedValue(mockCompanyProfile);

      await expect(
        companyService.create(createData, 'user-uuid-1'),
      ).rejects.toThrow(ConflictError);
    });

    it('does not check TIN uniqueness if tinNumber not provided', async () => {
      mockFindByUserId.mockResolvedValue(null);
      mockFindByName.mockResolvedValue(null);
      mockCreate.mockResolvedValue(mockCompanyProfile);

      const dataWithoutTin = {
        name: 'New Tech Corp',
        industry: 'TECHNOLOGY',
        description: 'A new tech company',
        city: 'Addis Ababa',
      };

      await companyService.create(dataWithoutTin, 'user-uuid-1');

      expect(mockFindByTinNumber).not.toHaveBeenCalled();
      expect(mockCreate).toHaveBeenCalledWith({ ...dataWithoutTin, userId: 'user-uuid-1' });
    });
  });

  describe('update', () => {
    const updateData = { description: 'Updated description' };

    it('updates own company (owner)', async () => {
      mockFindById.mockResolvedValue(mockCompanyProfile);
      mockUpdate.mockResolvedValue({ ...mockCompanyProfile, ...updateData });

      const result = await companyService.update(
        'company-uuid-1',
        updateData,
        'user-uuid-1', // owner
        'COMPANY',
      );

      expect(result.description).toBe('Updated description');
      expect(mockUpdate).toHaveBeenCalledWith('company-uuid-1', updateData);
    });

    it('updates any company (ADMIN)', async () => {
      mockFindById.mockResolvedValue(mockCompanyProfile);
      mockUpdate.mockResolvedValue({ ...mockCompanyProfile, ...updateData });

      const result = await companyService.update(
        'company-uuid-1',
        updateData,
        'admin-uuid',
        'ADMIN',
      );

      expect(result.description).toBe('Updated description');
    });

    it('throws NotFoundError when company does not exist', async () => {
      mockFindById.mockResolvedValue(null);

      await expect(
        companyService.update('nonexistent-uuid', updateData, 'user-uuid-1', 'COMPANY'),
      ).rejects.toThrow(NotFoundError);
    });

    it('throws ForbiddenError for non-owner, non-ADMIN', async () => {
      mockFindById.mockResolvedValue(mockCompanyProfile);

      await expect(
        companyService.update('company-uuid-1', updateData, 'other-user-uuid', 'COMPANY'),
      ).rejects.toThrow(ForbiddenError);
    });

    it('throws ConflictError when changing to an existing name', async () => {
      mockFindById.mockResolvedValue(mockCompanyProfile);
      mockFindByName.mockResolvedValue({ id: 'other-company-uuid', name: 'Name Taken' });

      await expect(
        companyService.update(
          'company-uuid-1',
          { name: 'Name Taken' },
          'user-uuid-1',
          'COMPANY',
        ),
      ).rejects.toThrow(ConflictError);
    });

    it('allows update when findByName returns the same company (no conflict)', async () => {
      mockFindById.mockResolvedValue(mockCompanyProfile);
      mockFindByName.mockResolvedValue({ id: 'company-uuid-1', name: 'Name Unchanged' });
      mockUpdate.mockResolvedValue({ ...mockCompanyProfile, name: 'Name Unchanged' });

      const result = await companyService.update(
        'company-uuid-1',
        { name: 'Name Unchanged' },
        'user-uuid-1',
        'COMPANY',
      );

      expect(result).toBeDefined();
      expect(mockUpdate).toHaveBeenCalled();
    });

    it('throws ConflictError when changing to an existing TIN', async () => {
      mockFindById.mockResolvedValue(mockCompanyProfile);
      mockFindByName.mockResolvedValue(null);
      mockFindByTinNumber.mockResolvedValue({ id: 'other-company-uuid', tinNumber: 'TIN-999' });

      await expect(
        companyService.update(
          'company-uuid-1',
          { tinNumber: 'TIN-999' },
          'user-uuid-1',
          'COMPANY',
        ),
      ).rejects.toThrow(ConflictError);
    });

    it('allows update when findByName returns null (name is free)', async () => {
      mockFindById.mockResolvedValue(mockCompanyProfile);
      mockFindByName.mockResolvedValue(null);
      mockFindByTinNumber.mockResolvedValue(null);
      mockUpdate.mockResolvedValue({ ...mockCompanyProfile, name: 'New Name' });

      const result = await companyService.update(
        'company-uuid-1',
        { name: 'New Name', tinNumber: 'TIN-NEW' },
        'user-uuid-1',
        'COMPANY',
      );

      expect(result).toBeDefined();
    });

    it('does not check name uniqueness if name is not provided', async () => {
      mockFindById.mockResolvedValue(mockCompanyProfile);
      mockUpdate.mockResolvedValue(mockCompanyProfile);

      await companyService.update(
        'company-uuid-1',
        { description: 'Just updating description' },
        'user-uuid-1',
        'COMPANY',
      );

      expect(mockFindByName).not.toHaveBeenCalled();
      expect(mockFindByTinNumber).not.toHaveBeenCalled();
    });

    it('does not check uniqueness if the same name is provided (no change)', async () => {
      mockFindById.mockResolvedValue(mockCompanyProfile);
      mockUpdate.mockResolvedValue(mockCompanyProfile);

      await companyService.update(
        'company-uuid-1',
        { name: 'Tech Corp' }, // Same as existing name
        'user-uuid-1',
        'COMPANY',
      );

      expect(mockFindByName).not.toHaveBeenCalled();
    });
  });

  describe('getInternships', () => {
    it('returns only ACTIVE internships for a company', async () => {
      mockFindById.mockResolvedValue(mockCompanyProfile);
      mockFindInternshipsByCompanyId.mockResolvedValue([mockInternship]);
      mockCountInternshipsByCompanyId.mockResolvedValue(1);

      const result = await companyService.getInternships('company-uuid-1', { page: 1, pageSize: 20 });

      expect(result.data).toHaveLength(1);
      expect(result.meta.total).toBe(1);
      expect(result.data[0]).not.toHaveProperty('applicationCount');
      expect(mockFindInternshipsByCompanyId).toHaveBeenCalled();
      expect(mockCountInternshipsByCompanyId).toHaveBeenCalled();
    });

    it('returns empty array when company has no internships', async () => {
      mockFindById.mockResolvedValue(mockCompanyProfile);
      mockFindInternshipsByCompanyId.mockResolvedValue([]);
      mockCountInternshipsByCompanyId.mockResolvedValue(0);

      const result = await companyService.getInternships('company-uuid-1', { page: 1, pageSize: 20 });

      expect(result.data).toHaveLength(0);
      expect(result.meta.total).toBe(0);
    });

    it('throws NotFoundError when company not found', async () => {
      mockFindById.mockResolvedValue(null);

      await expect(
        companyService.getInternships('nonexistent-uuid', { page: 1, pageSize: 20 }),
      ).rejects.toThrow(NotFoundError);
    });
  });

  describe('getApplications', () => {
    it('returns paginated applications for company owner', async () => {
      mockFindById.mockResolvedValue(mockCompanyProfile);
      mockFindApplicationsByCompanyId.mockResolvedValue([mockApplication]);
      mockCountApplicationsByCompanyId.mockResolvedValue(1);

      const result = await companyService.getApplications(
        'company-uuid-1',
        { page: 1, pageSize: 20 },
        'user-uuid-1', // owner
        'COMPANY',
      );

      expect(result.data).toHaveLength(1);
      expect(result.meta.total).toBe(1);
      expect(mockFindApplicationsByCompanyId).toHaveBeenCalled();
      expect(mockCountApplicationsByCompanyId).toHaveBeenCalled();
    });

    it('returns paginated applications for ADMIN', async () => {
      mockFindById.mockResolvedValue(mockCompanyProfile);
      mockFindApplicationsByCompanyId.mockResolvedValue([mockApplication]);
      mockCountApplicationsByCompanyId.mockResolvedValue(1);

      const result = await companyService.getApplications(
        'company-uuid-1',
        { page: 1, pageSize: 20 },
        'admin-uuid',
        'ADMIN',
      );

      expect(result.data).toHaveLength(1);
    });

    it('throws ForbiddenError for non-owner, non-ADMIN', async () => {
      mockFindById.mockResolvedValue(mockCompanyProfile);

      await expect(
        companyService.getApplications(
          'company-uuid-1',
          { page: 1, pageSize: 20 },
          'other-user-uuid',
          'COMPANY',
        ),
      ).rejects.toThrow(ForbiddenError);
    });

    it('throws NotFoundError when company not found', async () => {
      mockFindById.mockResolvedValue(null);

      await expect(
        companyService.getApplications(
          'nonexistent-uuid',
          { page: 1, pageSize: 20 },
          'user-uuid-1',
          'COMPANY',
        ),
      ).rejects.toThrow(NotFoundError);
    });
  });
});
