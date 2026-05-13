// ─────────────────────────────────────────────────────────────
// Application Service — Unit Tests
// Mocks the repository layer. Tests cover:
//  - Role-scoped listing with cursor pagination (list)
//  - Detail view with ownership + data visibility (getById)
//  - Status update with state machine enforcement (updateStatus)
//  - Student withdrawal with role + ownership checks (withdraw)
// ─────────────────────────────────────────────────────────────

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NotFoundError, ForbiddenError, UnprocessableError } from '../../../shared/errors/app-error.js';

// Mock repositories before importing the service
vi.mock('../application.repository.js', () => ({}));
vi.mock('../../students/student.repository.js', () => ({}));
vi.mock('../../companies/company.repository.js', () => ({}));

import * as applicationService from '../application.service.js';
import * as applicationRepository from '../application.repository.js';
import * as studentRepository from '../../students/student.repository.js';
import * as companyRepository from '../../companies/company.repository.js';

// ─── Fixtures ──────────────────────────────────────────────

const mockStudentUser = {
  id: 'user-student-1',
  email: 'student@example.com',
  firstName: 'Abebe',
  lastName: 'Kebede',
  phone: '+251911111111',
};

const mockCompanyUser = {
  id: 'user-company-1',
  email: 'company@example.com',
  firstName: 'Company',
  lastName: 'Owner',
  phone: '+251922222222',
};

const _mockAdminUser = {
  id: 'user-admin-1',
  email: 'admin@example.com',
  firstName: 'Admin',
  lastName: 'User',
  phone: '+251933333333',
};

const mockStudentProfile = {
  id: 'student-uuid-1',
  userId: 'user-student-1',
  schoolId: null,
  grade: 10,
  dateOfBirth: new Date('2006-05-15'),
  bio: 'Aspiring software engineer',
  skills: ['JavaScript'],
  interests: ['Coding'],
  languages: ['English'],
  resumeUrl: 'https://example.com/resume.pdf',
  profileImageUrl: null,
  isSchoolVerified: false,
  createdAt: new Date('2025-01-01'),
  updatedAt: new Date('2025-01-15'),
  user: mockStudentUser,
  school: null,
};

const mockStudentProfile2 = {
  ...mockStudentProfile,
  id: 'student-uuid-2',
  userId: 'user-student-2',
};

const mockCompanyProfile = {
  id: 'company-uuid-1',
  userId: 'user-company-1',
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
  user: mockCompanyUser,
};

const mockApplicationPending = {
  id: 'app-uuid-1',
  internshipId: 'internship-uuid-1',
  studentId: 'student-uuid-1',
  status: 'PENDING',
  coverLetter: 'I am passionate',
  additionalInfo: null,
  companyNote: null,
  appliedAt: new Date('2025-04-01'),
  updatedAt: new Date('2025-04-01'),
  student: {
    id: 'student-uuid-1',
    grade: 10,
    resumeUrl: 'https://example.com/resume.pdf',
    user: mockStudentUser,
  },
  internship: {
    id: 'internship-uuid-1',
    title: 'Software Engineering Intern',
    status: 'ACTIVE',
    companyId: 'company-uuid-1',
    company: {
      id: 'company-uuid-1',
      name: 'Tech Corp',
      userId: 'user-company-1',
    },
  },
  statusHistory: [],
};

const mockApplicationWithCompanyNote = {
  ...mockApplicationPending,
  companyNote: 'Strong candidate, consider for shortlist',
};

const mockApplicationReviewed = {
  ...mockApplicationPending,
  status: 'REVIEWED',
};

const mockApplicationShortlisted = {
  ...mockApplicationPending,
  status: 'SHORTLISTED',
};

const mockApplicationAccepted = {
  ...mockApplicationPending,
  status: 'ACCEPTED',
};

const mockApplicationRejected = {
  ...mockApplicationPending,
  status: 'REJECTED',
};

const mockApplicationWithdrawn = {
  ...mockApplicationPending,
  status: 'WITHDRAWN',
};

const mockStatusHistoryEntry = {
  id: 'history-uuid-1',
  applicationId: 'app-uuid-1',
  fromStatus: 'PENDING',
  toStatus: 'REVIEWED',
  changedById: 'user-company-1',
  note: 'Reviewing qualifications',
  createdAt: new Date('2025-04-02'),
};

// ─── Mock implementations ──────────────────────────────────

const mockFindById = vi.fn();
const mockFindAll = vi.fn();
const mockUpdateStatus = vi.fn();
const mockCreateStatusHistory = vi.fn();
const mockWithdraw = vi.fn();

const mockStudentFindByUserId = vi.fn();
const mockCompanyFindByUserId = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();

  // Application repository mocks
  vi.mocked(applicationRepository).findById = mockFindById;
  vi.mocked(applicationRepository).findAll = mockFindAll;
  vi.mocked(applicationRepository).updateStatus = mockUpdateStatus;
  vi.mocked(applicationRepository).createStatusHistory = mockCreateStatusHistory;
  vi.mocked(applicationRepository).withdraw = mockWithdraw;

  // Student repository mocks
  vi.mocked(studentRepository).findByUserId = mockStudentFindByUserId;

  // Company repository mocks
  vi.mocked(companyRepository).findByUserId = mockCompanyFindByUserId;
});

// ─── Tests ─────────────────────────────────────────────────

describe('ApplicationService', () => {
  describe('list', () => {
    const defaultFilters = {
      cursor: undefined as string | undefined,
      limit: 20,
      status: undefined as 'PENDING' | 'REVIEWED' | 'SHORTLISTED' | 'ACCEPTED' | 'REJECTED' | 'WITHDRAWN' | undefined,
      internshipId: undefined as string | undefined,
      sort: 'appliedAt' as const,
      order: 'desc' as const,
    };

    it('returns own applications for STUDENT role', async () => {
      mockStudentFindByUserId.mockResolvedValue(mockStudentProfile);
      mockFindAll.mockResolvedValue([mockApplicationPending]);

      const result = await applicationService.list(
        'user-student-1',
        'STUDENT',
        defaultFilters,
      );

      expect(result.data).toHaveLength(1);
      expect(result.meta).toHaveProperty('cursor');
      expect(result.meta).toHaveProperty('hasMore');
      expect(mockFindAll).toHaveBeenCalledWith(
        expect.objectContaining({ studentId: 'student-uuid-1' }),
      );
      // List-safe: no sensitive fields leaked
      expect(result.data[0]).not.toHaveProperty('companyNote');
      expect(result.data[0]).not.toHaveProperty('statusHistory');
      expect(result.data[0].student).not.toHaveProperty('resumeUrl');
      expect(result.data[0].student!.user).not.toHaveProperty('email');
      expect(result.data[0].student!.user).not.toHaveProperty('phone');
    });

    it('returns applications for COMPANY role', async () => {
      mockCompanyFindByUserId.mockResolvedValue(mockCompanyProfile);
      mockFindAll.mockResolvedValue([mockApplicationPending]);

      const result = await applicationService.list(
        'user-company-1',
        'COMPANY',
        defaultFilters,
      );

      expect(result.data).toHaveLength(1);
      expect(mockFindAll).toHaveBeenCalledWith(
        expect.objectContaining({ companyId: 'company-uuid-1' }),
      );
      // List-safe: no sensitive fields leaked, even for COMPANY
      expect(result.data[0]).not.toHaveProperty('companyNote');
      expect(result.data[0]).not.toHaveProperty('statusHistory');
      expect(result.data[0].student).not.toHaveProperty('resumeUrl');
      expect(result.data[0].student!.user).not.toHaveProperty('email');
      expect(result.data[0].student!.user).not.toHaveProperty('phone');
    });

    it('returns all applications for ADMIN role', async () => {
      mockFindAll.mockResolvedValue([mockApplicationPending]);

      const result = await applicationService.list(
        'user-admin-1',
        'ADMIN',
        defaultFilters,
      );

      expect(result.data).toHaveLength(1);
      expect(mockFindAll).toHaveBeenCalledWith(
        expect.not.objectContaining({ studentId: expect.any(String) }),
        // No companyId or studentId filter for admin
      );
      // List-safe: no sensitive fields leaked, even for ADMIN
      expect(result.data[0]).not.toHaveProperty('companyNote');
      expect(result.data[0]).not.toHaveProperty('statusHistory');
      expect(result.data[0].student).not.toHaveProperty('resumeUrl');
      expect(result.data[0].student!.user).not.toHaveProperty('email');
      expect(result.data[0].student!.user).not.toHaveProperty('phone');
    });

    it('returns empty array when student has no profile', async () => {
      mockStudentFindByUserId.mockResolvedValue(null);

      const result = await applicationService.list(
        'user-student-1',
        'STUDENT',
        defaultFilters,
      );

      expect(result.data).toHaveLength(0);
      expect(mockFindAll).not.toHaveBeenCalled();
    });

    it('applies status filter when provided', async () => {
      mockStudentFindByUserId.mockResolvedValue(mockStudentProfile);
      mockFindAll.mockResolvedValue([mockApplicationPending]);

      await applicationService.list('user-student-1', 'STUDENT', {
        ...defaultFilters,
        status: 'PENDING',
      });

      expect(mockFindAll).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'PENDING' }),
      );
    });

    it('applies cursor pagination', async () => {
      mockCompanyFindByUserId.mockResolvedValue(mockCompanyProfile);
      mockFindAll.mockResolvedValue([mockApplicationPending]);

      const result = await applicationService.list('user-company-1', 'COMPANY', {
        ...defaultFilters,
        cursor: 'app-uuid-0',
      });

      expect(mockFindAll).toHaveBeenCalledWith(
        expect.objectContaining({ cursor: 'app-uuid-0' }),
      );
      expect(result.meta).toBeDefined();
    });

    it('strips companyNote, statusHistory, student contact info from student-visible results', async () => {
      mockStudentFindByUserId.mockResolvedValue(mockStudentProfile);
      mockFindAll.mockResolvedValue([mockApplicationWithCompanyNote]);

      const result = await applicationService.list(
        'user-student-1',
        'STUDENT',
        defaultFilters,
      );

      expect(result.data[0]).not.toHaveProperty('companyNote');
      expect(result.data[0]).not.toHaveProperty('statusHistory');
      expect(result.data[0].student).not.toHaveProperty('resumeUrl');
      expect(result.data[0].student!.user).not.toHaveProperty('email');
      expect(result.data[0].student!.user).not.toHaveProperty('phone');
      // Student identity preserved (minimal)
      expect(result.data[0].student!.user).toHaveProperty('id');
      expect(result.data[0].student!.user).toHaveProperty('firstName');
      expect(result.data[0].student!.user).toHaveProperty('lastName');
      expect(result.data[0].student).not.toHaveProperty('email');
    });

    it('throws NotFoundError when COMPANY has no profile', async () => {
      mockCompanyFindByUserId.mockResolvedValue(null);

      await expect(
        applicationService.list('user-company-1', 'COMPANY', defaultFilters),
      ).rejects.toThrow(NotFoundError);
    });
  });

  describe('getById', () => {
    it('returns application detail for student owner', async () => {
      mockFindById.mockResolvedValue(mockApplicationPending);
      mockStudentFindByUserId.mockResolvedValue(mockStudentProfile);

      const result = await applicationService.getById(
        'app-uuid-1',
        'user-student-1',
        'STUDENT',
      );

      expect(result.id).toBe('app-uuid-1');
      expect(result.status).toBe('PENDING');
      // Student should see companyNote as null (field present but empty)
      expect(result.companyNote).toBeNull();
      expect(result.statusHistory).toBeDefined();
      // Student contact info NOT visible to STUDENT (per CP12 data visibility table)
      expect(result.student.user).not.toHaveProperty('email');
      expect(result.student.user).not.toHaveProperty('phone');
      // But student DOES see their own name and id
      expect(result.student.user).toHaveProperty('firstName', 'Abebe');
      expect(result.student.user).toHaveProperty('lastName', 'Kebede');
    });

    it('returns application detail for company owner', async () => {
      mockFindById.mockResolvedValue(mockApplicationPending);
      mockStudentFindByUserId.mockResolvedValue(mockStudentProfile);

      const result = await applicationService.getById(
        'app-uuid-1',
        'user-company-1',
        'COMPANY',
      );

      expect(result.id).toBe('app-uuid-1');
      expect(result).toHaveProperty('companyNote');
      expect(result.student.user).toHaveProperty('email');
      expect(result.student.user).toHaveProperty('phone');
    });

    it('returns application detail for ADMIN', async () => {
      mockFindById.mockResolvedValue(mockApplicationPending);

      const result = await applicationService.getById(
        'app-uuid-1',
        'user-admin-1',
        'ADMIN',
      );

      expect(result.id).toBe('app-uuid-1');
      expect(result).toHaveProperty('companyNote');
      expect(result.student.user).toHaveProperty('email');
      expect(result.student.user).toHaveProperty('phone');
    });

    it('throws NotFoundError when application does not exist', async () => {
      mockFindById.mockResolvedValue(null);

      await expect(
        applicationService.getById('nonexistent-uuid', 'user-admin-1', 'ADMIN'),
      ).rejects.toThrow(NotFoundError);
    });

    it('throws ForbiddenError when student tries to view another student\'s application', async () => {
      mockFindById.mockResolvedValue(mockApplicationPending);
      mockStudentFindByUserId.mockResolvedValue(mockStudentProfile2); // Different student

      await expect(
        applicationService.getById('app-uuid-1', 'user-student-2', 'STUDENT'),
      ).rejects.toThrow(ForbiddenError);
    });

    it('throws ForbiddenError when company tries to view non-own application', async () => {
      mockFindById.mockResolvedValue({
        ...mockApplicationPending,
        internship: {
          ...mockApplicationPending.internship,
          company: { id: 'other-company', name: 'Other Corp', userId: 'other-user' },
        },
      });

      await expect(
        applicationService.getById('app-uuid-1', 'user-company-1', 'COMPANY'),
      ).rejects.toThrow(ForbiddenError);
    });

    it('includes statusHistory in detail', async () => {
      mockFindById.mockResolvedValue({
        ...mockApplicationPending,
        statusHistory: [mockStatusHistoryEntry],
      });
      mockStudentFindByUserId.mockResolvedValue(mockStudentProfile);

      const result = await applicationService.getById(
        'app-uuid-1',
        'user-student-1',
        'STUDENT',
      );

      expect(result.statusHistory).toHaveLength(1);
      expect(result.statusHistory[0].fromStatus).toBe('PENDING');
      expect(result.statusHistory[0].toStatus).toBe('REVIEWED');
    });
  });

  describe('updateStatus', () => {
    const updateData = { status: 'REVIEWED' as const, note: 'Reviewing qualifications' };

    it('updates status with valid transition (PENDING → REVIEWED) for COMPANY', async () => {
      mockFindById.mockResolvedValue(mockApplicationPending);
      mockUpdateStatus.mockResolvedValue({ ...mockApplicationPending, status: 'REVIEWED' });
      mockCreateStatusHistory.mockResolvedValue(mockStatusHistoryEntry);

      const result = await applicationService.updateStatus(
        'app-uuid-1',
        updateData,
        'user-company-1',
        'COMPANY',
      );

      expect(result.status).toBe('REVIEWED');
      expect(mockUpdateStatus).toHaveBeenCalledWith('app-uuid-1', 'REVIEWED');
      expect(mockCreateStatusHistory).toHaveBeenCalledWith({
        applicationId: 'app-uuid-1',
        fromStatus: 'PENDING',
        toStatus: 'REVIEWED',
        changedById: 'user-company-1',
        note: 'Reviewing qualifications',
      });
    });

    it('updates status for ADMIN', async () => {
      mockFindById.mockResolvedValue(mockApplicationPending);
      mockUpdateStatus.mockResolvedValue({ ...mockApplicationPending, status: 'REVIEWED' });
      mockCreateStatusHistory.mockResolvedValue(mockStatusHistoryEntry);

      const result = await applicationService.updateStatus(
        'app-uuid-1',
        { status: 'REVIEWED' },
        'user-admin-1',
        'ADMIN',
      );

      expect(result.status).toBe('REVIEWED');
    });

    it('rejects STUDENT role', async () => {
      mockFindById.mockResolvedValue(mockApplicationPending);
      mockStudentFindByUserId.mockResolvedValue(mockStudentProfile);

      await expect(
        applicationService.updateStatus(
          'app-uuid-1',
          { status: 'REVIEWED' },
          'user-student-1',
          'STUDENT',
        ),
      ).rejects.toThrow(ForbiddenError);
    });

    it('rejects non-owner COMPANY', async () => {
      mockFindById.mockResolvedValue(mockApplicationPending);

      await expect(
        applicationService.updateStatus(
          'app-uuid-1',
          { status: 'REVIEWED' },
          'other-company-user',
          'COMPANY',
        ),
      ).rejects.toThrow(ForbiddenError);
    });

    it('throws NotFoundError when application not found', async () => {
      mockFindById.mockResolvedValue(null);

      await expect(
        applicationService.updateStatus(
          'nonexistent-uuid',
          { status: 'REVIEWED' },
          'user-company-1',
          'COMPANY',
        ),
      ).rejects.toThrow(NotFoundError);
    });

    // Valid transitions
    const validTransitions = [
      { from: 'PENDING', to: 'REVIEWED' },
      { from: 'PENDING', to: 'SHORTLISTED' },
      { from: 'PENDING', to: 'REJECTED' },
      { from: 'REVIEWED', to: 'SHORTLISTED' },
      { from: 'REVIEWED', to: 'REJECTED' },
      { from: 'SHORTLISTED', to: 'ACCEPTED' },
      { from: 'SHORTLISTED', to: 'REJECTED' },
    ];

    validTransitions.forEach(({ from, to }) => {
      it(`allows transition ${from} → ${to}`, async () => {
        const mockApp = { ...mockApplicationPending, status: from };
        mockFindById.mockResolvedValue(mockApp);
        mockUpdateStatus.mockResolvedValue({ ...mockApp, status: to });
        mockCreateStatusHistory.mockResolvedValue({ ...mockStatusHistoryEntry, fromStatus: from, toStatus: to });

        const result = await applicationService.updateStatus(
          'app-uuid-1',
          { status: to as 'REVIEWED' | 'SHORTLISTED' | 'ACCEPTED' | 'REJECTED' },
          'user-company-1',
          'COMPANY',
        );

        expect(result.status).toBe(to);
      });
    });

    // Invalid transitions
    const invalidTransitions = [
      { from: 'PENDING', to: 'ACCEPTED' },
      { from: 'REVIEWED', to: 'ACCEPTED' },
      { from: 'ACCEPTED', to: 'REVIEWED' },
      { from: 'ACCEPTED', to: 'SHORTLISTED' },
      { from: 'ACCEPTED', to: 'REJECTED' },
      { from: 'REJECTED', to: 'PENDING' },
      { from: 'REJECTED', to: 'REVIEWED' },
      { from: 'WITHDRAWN', to: 'PENDING' },
      { from: 'WITHDRAWN', to: 'REVIEWED' },
    ];

    invalidTransitions.forEach(({ from, to }) => {
      it(`rejects transition ${from} → ${to}`, async () => {
        const mockApp = { ...mockApplicationPending, status: from };
        mockFindById.mockResolvedValue(mockApp);

        await expect(
          applicationService.updateStatus(
            'app-uuid-1',
            { status: to as 'REVIEWED' | 'SHORTLISTED' | 'ACCEPTED' | 'REJECTED' },
            'user-company-1',
            'COMPANY',
          ),
        ).rejects.toThrow(UnprocessableError);
      });
    });

    it('creates statusHistory entry with note', async () => {
      mockFindById.mockResolvedValue(mockApplicationPending);
      mockUpdateStatus.mockResolvedValue({ ...mockApplicationPending, status: 'REVIEWED' });
      mockCreateStatusHistory.mockResolvedValue(mockStatusHistoryEntry);

      await applicationService.updateStatus(
        'app-uuid-1',
        { status: 'REVIEWED', note: 'Checking references' },
        'user-company-1',
        'COMPANY',
      );

      expect(mockCreateStatusHistory).toHaveBeenCalledWith(
        expect.objectContaining({ note: 'Checking references' }),
      );
    });

    it('accepts message field but does not persist it', async () => {
      mockFindById.mockResolvedValue(mockApplicationPending);
      mockUpdateStatus.mockResolvedValue({ ...mockApplicationPending, status: 'REVIEWED' });
      mockCreateStatusHistory.mockResolvedValue(mockStatusHistoryEntry);

      const result = await applicationService.updateStatus(
        'app-uuid-1',
        { status: 'REVIEWED', message: 'Congratulations! You are moving forward.' },
        'user-company-1',
        'COMPANY',
      );

      // The message is accepted and ignored — no DB column for it
      expect(result.status).toBe('REVIEWED');
      expect(mockCreateStatusHistory).not.toHaveBeenCalledWith(
        expect.objectContaining({ message: expect.any(String) }),
      );
    });
  });

  describe('withdraw', () => {
    it('withdraws PENDING application (STUDENT owner)', async () => {
      mockFindById.mockResolvedValue(mockApplicationPending);
      mockStudentFindByUserId.mockResolvedValue(mockStudentProfile);
      mockWithdraw.mockResolvedValue(mockApplicationWithdrawn);
      mockCreateStatusHistory.mockResolvedValue({
        ...mockStatusHistoryEntry,
        fromStatus: 'PENDING',
        toStatus: 'WITHDRAWN',
        note: 'Found another opportunity',
      });

      const result = await applicationService.withdraw(
        'app-uuid-1',
        { reason: 'Found another opportunity' },
        'user-student-1',
      );

      expect(result.status).toBe('WITHDRAWN');
      expect(mockWithdraw).toHaveBeenCalledWith('app-uuid-1');
      expect(mockCreateStatusHistory).toHaveBeenCalledWith({
        applicationId: 'app-uuid-1',
        fromStatus: 'PENDING',
        toStatus: 'WITHDRAWN',
        changedById: 'user-student-1',
        note: 'Found another opportunity',
      });
    });

    it('withdraws REVIEWED application (STUDENT owner)', async () => {
      mockFindById.mockResolvedValue(mockApplicationReviewed);
      mockStudentFindByUserId.mockResolvedValue(mockStudentProfile);
      mockWithdraw.mockResolvedValue(mockApplicationWithdrawn);
      mockCreateStatusHistory.mockResolvedValue({
        ...mockStatusHistoryEntry,
        fromStatus: 'REVIEWED',
        toStatus: 'WITHDRAWN',
      });

      const result = await applicationService.withdraw(
        'app-uuid-1',
        {},
        'user-student-1',
      );

      expect(result.status).toBe('WITHDRAWN');
    });

    it('rejects withdrawal from SHORTLISTED status', async () => {
      mockFindById.mockResolvedValue(mockApplicationShortlisted);
      mockStudentFindByUserId.mockResolvedValue(mockStudentProfile);

      await expect(
        applicationService.withdraw('app-uuid-1', {}, 'user-student-1'),
      ).rejects.toThrow(UnprocessableError);
    });

    it('rejects withdrawal from ACCEPTED status', async () => {
      mockFindById.mockResolvedValue(mockApplicationAccepted);
      mockStudentFindByUserId.mockResolvedValue(mockStudentProfile);

      await expect(
        applicationService.withdraw('app-uuid-1', {}, 'user-student-1'),
      ).rejects.toThrow(UnprocessableError);
    });

    it('rejects withdrawal from REJECTED status', async () => {
      mockFindById.mockResolvedValue(mockApplicationRejected);
      mockStudentFindByUserId.mockResolvedValue(mockStudentProfile);

      await expect(
        applicationService.withdraw('app-uuid-1', {}, 'user-student-1'),
      ).rejects.toThrow(UnprocessableError);
    });

    it('rejects withdrawal from WITHDRAWN status (already withdrawn)', async () => {
      mockFindById.mockResolvedValue(mockApplicationWithdrawn);
      mockStudentFindByUserId.mockResolvedValue(mockStudentProfile);

      await expect(
        applicationService.withdraw('app-uuid-1', {}, 'user-student-1'),
      ).rejects.toThrow(UnprocessableError);
    });

    it('rejects COMPANY role', async () => {
      mockFindById.mockResolvedValue(mockApplicationPending);
      mockStudentFindByUserId.mockResolvedValue(null); // Company user has no student profile

      await expect(
        applicationService.withdraw('app-uuid-1', {}, 'user-company-1'),
      ).rejects.toThrow(ForbiddenError);
    });

    it('rejects ADMIN role', async () => {
      mockFindById.mockResolvedValue(mockApplicationPending);
      mockStudentFindByUserId.mockResolvedValue(null); // Admin user has no student profile

      await expect(
        applicationService.withdraw('app-uuid-1', {}, 'user-admin-1'),
      ).rejects.toThrow(ForbiddenError);
    });

    it('rejects non-owner student', async () => {
      mockFindById.mockResolvedValue(mockApplicationPending);
      mockStudentFindByUserId.mockResolvedValue(mockStudentProfile2); // Different student

      await expect(
        applicationService.withdraw('app-uuid-1', {}, 'user-student-2'),
      ).rejects.toThrow(ForbiddenError);
    });

    it('throws NotFoundError when application not found', async () => {
      mockFindById.mockResolvedValue(null);

      await expect(
        applicationService.withdraw('nonexistent-uuid', {}, 'user-student-1'),
      ).rejects.toThrow(NotFoundError);
    });

    it('creates statusHistory entry on withdrawal', async () => {
      mockFindById.mockResolvedValue(mockApplicationPending);
      mockStudentFindByUserId.mockResolvedValue(mockStudentProfile);
      mockWithdraw.mockResolvedValue(mockApplicationWithdrawn);
      mockCreateStatusHistory.mockResolvedValue({
        ...mockStatusHistoryEntry,
        fromStatus: 'PENDING',
        toStatus: 'WITHDRAWN',
      });

      await applicationService.withdraw('app-uuid-1', {}, 'user-student-1');

      expect(mockCreateStatusHistory).toHaveBeenCalledWith({
        applicationId: 'app-uuid-1',
        fromStatus: 'PENDING',
        toStatus: 'WITHDRAWN',
        changedById: 'user-student-1',
        note: null,
      });
    });

    it('returns student contact info for the withdrawing student', async () => {
      mockFindById.mockResolvedValue(mockApplicationPending);
      mockStudentFindByUserId.mockResolvedValue(mockStudentProfile);
      mockWithdraw.mockResolvedValue(mockApplicationWithdrawn);
      mockCreateStatusHistory.mockResolvedValue({
        ...mockStatusHistoryEntry,
        fromStatus: 'PENDING',
        toStatus: 'WITHDRAWN',
      });

      const result = await applicationService.withdraw(
        'app-uuid-1',
        {},
        'user-student-1',
      );

      expect(result.student.user).toHaveProperty('email', 'student@example.com');
    });
  });
});
