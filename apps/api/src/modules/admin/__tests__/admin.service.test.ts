// ─────────────────────────────────────────────────────────────
// Admin Service — Unit Tests
// Mocks the repository layer. Tests cover:
//  - Dashboard with overview/recentActivity/platformMetrics/userGrowth
//  - Users list filters/search/sort/pagination
//  - Update status ACTIVE/SUSPENDED with audit log including notifyUser
//  - Self-suspension blocked
//  - User not found
//  - Audit log list including userEmail, stripped ipAddress/userAgent
//  - JSON reports with reportType + parameters
//  - CSV reports
//  - Empty reports
// ─────────────────────────────────────────────────────────────

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NotFoundError, ForbiddenError } from '../../../shared/errors/app-error.js';

// Mock the repository before importing the service
vi.mock('../admin.repository.js', () => ({}));

import * as adminService from '../admin.service.js';
import * as adminRepository from '../admin.repository.js';

// ─── Fixtures ──────────────────────────────────────────────

/** Returned by getDashboardOverview (no active user counts — those come from metrics). */
const mockOverviewData = {
  totalUsers: 100,
  totalStudents: 50,
  totalCompanies: 30,
  totalSchools: 15,
  totalInternships: 80,
  totalApplications: 200,
};

/** Returned by getPlatformMetrics (includes active/new counts and placeholders). */
const mockMetricsData = {
  activeUsersToday: 25,
  activeUsersThisWeek: 60,
  newUsersToday: 5,
  newInternshipsToday: 3,
  newApplicationsToday: 10,
  fillRate: 0.65,
  averageTimeToHire: 14.5,
};

const mockGrowth = [
  { date: '2025-05-01', count: 5 },
  { date: '2025-05-02', count: 3 },
];

const mockUsers = [
  {
    id: 'user-uuid-1',
    email: 'student@example.com',
    firstName: 'John',
    lastName: 'Doe',
    role: 'STUDENT',
    status: 'ACTIVE',
    isVerified: true,
    createdAt: new Date('2025-04-01'),
    updatedAt: new Date('2025-04-01'),
    lastLoginAt: new Date('2025-05-01'),
  },
  {
    id: 'user-uuid-2',
    email: 'company@example.com',
    firstName: 'Jane',
    lastName: 'Smith',
    role: 'COMPANY',
    status: 'SUSPENDED',
    isVerified: false,
    createdAt: new Date('2025-03-15'),
    updatedAt: new Date('2025-03-15'),
    lastLoginAt: null,
  },
];

const mockUser = mockUsers[0];

const mockUpdatedUser = {
  id: 'user-uuid-1',
  email: 'student@example.com',
  status: 'SUSPENDED',
  updatedAt: new Date('2025-05-10'),
};

/** Audit log fixture with user relation for userEmail. */
const mockAuditLogs = [
  {
    id: 'log-uuid-1',
    userId: 'admin-uuid',
    action: 'USER_STATUS_CHANGE',
    entity: 'USER',
    entityId: 'user-uuid-1',
    oldValue: { status: 'ACTIVE' },
    newValue: { status: 'SUSPENDED', reason: 'Violation of terms' },
    createdAt: new Date('2025-05-10'),
    user: { email: 'admin@example.com' },
  },
];

// ─── Mock implementations ──────────────────────────────────

const mockGetDashboardOverview = vi.fn();
const mockGetPlatformMetrics = vi.fn();
const mockGetUserGrowth = vi.fn();
const mockFindUsers = vi.fn();
const mockCountUsers = vi.fn();
const mockFindUserById = vi.fn();
const mockUpdateUserStatus = vi.fn();
const mockCreateAuditLog = vi.fn();
const mockFindAuditLogs = vi.fn();
const mockCountAuditLogs = vi.fn();
const mockGetReportData = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();

  vi.mocked(adminRepository).getDashboardOverview = mockGetDashboardOverview;
  vi.mocked(adminRepository).getPlatformMetrics = mockGetPlatformMetrics;
  vi.mocked(adminRepository).getUserGrowth = mockGetUserGrowth;
  vi.mocked(adminRepository).findUsers = mockFindUsers;
  vi.mocked(adminRepository).countUsers = mockCountUsers;
  vi.mocked(adminRepository).findUserById = mockFindUserById;
  vi.mocked(adminRepository).updateUserStatus = mockUpdateUserStatus;
  vi.mocked(adminRepository).createAuditLog = mockCreateAuditLog;
  vi.mocked(adminRepository).findAuditLogs = mockFindAuditLogs;
  vi.mocked(adminRepository).countAuditLogs = mockCountAuditLogs;
  vi.mocked(adminRepository).getReportData = mockGetReportData;
});

// ─── Tests ─────────────────────────────────────────────────

describe('AdminService', () => {
  describe('getDashboard', () => {
    it('returns dashboard with overview/recentActivity/platformMetrics/userGrowth', async () => {
      mockGetDashboardOverview.mockResolvedValue(mockOverviewData);
      mockGetPlatformMetrics.mockResolvedValue(mockMetricsData);
      mockGetUserGrowth.mockResolvedValue(mockGrowth);

      const result = await adminService.getDashboard();

      // Overview includes active-user counts from metrics
      expect(result.overview).toEqual({
        totalUsers: 100,
        totalStudents: 50,
        totalCompanies: 30,
        totalSchools: 15,
        totalInternships: 80,
        totalApplications: 200,
        activeUsersToday: 25,
        activeUsersThisWeek: 60,
      });

      // Recent activity from metrics
      expect(result.recentActivity).toEqual({
        newUsersToday: 5,
        newInternshipsToday: 3,
        newApplicationsToday: 10,
      });

      // Platform metrics — applicationsPerInternship computed (200/80=2.5)
      expect(result.platformMetrics).toEqual({
        applicationsPerInternship: 2.5,
        fillRate: 0.65,
        averageTimeToHire: 14.5,
      });

      // User growth
      expect(result.userGrowth).toEqual(mockGrowth);
      expect(mockGetDashboardOverview).toHaveBeenCalledTimes(1);
      expect(mockGetPlatformMetrics).toHaveBeenCalledTimes(1);
      expect(mockGetUserGrowth).toHaveBeenCalledTimes(1);
    });

    it('returns dashboard with date range filter', async () => {
      mockGetDashboardOverview.mockResolvedValue(mockOverviewData);
      mockGetPlatformMetrics.mockResolvedValue({
        ...mockMetricsData,
        newUsersToday: 2,
        newApplicationsToday: 5,
      });
      mockGetUserGrowth.mockResolvedValue([{ date: '2025-05-01', count: 3 }]);

      const result = await adminService.getDashboard({ from: '2025-05-01', to: '2025-05-07' });

      expect(result.overview.totalUsers).toBe(100);
      expect(result.recentActivity.newUsersToday).toBe(2);
      expect(result.platformMetrics.fillRate).toBe(0.65);
      expect(result.userGrowth).toHaveLength(1);
      expect(mockGetPlatformMetrics).toHaveBeenCalledWith('2025-05-01', '2025-05-07');
      expect(mockGetUserGrowth).toHaveBeenCalledWith('2025-05-01', '2025-05-07');
    });

    it('computes applicationsPerInternship handling divide-by-zero', async () => {
      mockGetDashboardOverview.mockResolvedValue({
        totalUsers: 0,
        totalStudents: 0,
        totalCompanies: 0,
        totalSchools: 0,
        totalInternships: 0,
        totalApplications: 0,
      });
      mockGetPlatformMetrics.mockResolvedValue(mockMetricsData);
      mockGetUserGrowth.mockResolvedValue([]);

      const result = await adminService.getDashboard();

      expect(result.platformMetrics.applicationsPerInternship).toBe(0);
    });

    it('returns zero metrics when no data exists', async () => {
      mockGetDashboardOverview.mockResolvedValue({
        totalUsers: 0,
        totalStudents: 0,
        totalCompanies: 0,
        totalSchools: 0,
        totalInternships: 0,
        totalApplications: 0,
      });
      mockGetPlatformMetrics.mockResolvedValue({
        activeUsersToday: 0,
        activeUsersThisWeek: 0,
        newUsersToday: 0,
        newInternshipsToday: 0,
        newApplicationsToday: 0,
        fillRate: 0.65,
        averageTimeToHire: 14.5,
      });
      mockGetUserGrowth.mockResolvedValue([]);

      const result = await adminService.getDashboard();

      expect(result.overview.totalUsers).toBe(0);
      expect(result.overview.activeUsersToday).toBe(0);
      expect(result.recentActivity.newUsersToday).toBe(0);
      expect(result.userGrowth).toHaveLength(0);
    });
  });

  describe('listUsers', () => {
    const defaultFilters = {
      page: 1,
      pageSize: 20,
      search: undefined as string | undefined,
      role: undefined as string | undefined,
      status: undefined as string | undefined,
      isVerified: undefined as boolean | undefined,
      sort: 'createdAt',
      order: 'desc' as const,
    };

    it('returns paginated users list', async () => {
      mockFindUsers.mockResolvedValue(mockUsers);
      mockCountUsers.mockResolvedValue(2);

      const result = await adminService.listUsers(defaultFilters);

      expect(result.data).toHaveLength(2);
      expect(result.meta.total).toBe(2);
      expect(result.meta.page).toBe(1);
      expect(result.meta.pageSize).toBe(20);
      expect(mockFindUsers).toHaveBeenCalledWith(defaultFilters);
    });

    it('filters by role', async () => {
      const filters = { ...defaultFilters, role: 'STUDENT' };
      mockFindUsers.mockResolvedValue([mockUsers[0]]);
      mockCountUsers.mockResolvedValue(1);

      const result = await adminService.listUsers(filters);

      expect(result.data).toHaveLength(1);
      expect(result.data[0].role).toBe('STUDENT');
      expect(mockFindUsers).toHaveBeenCalledWith(filters);
    });

    it('filters by status', async () => {
      const filters = { ...defaultFilters, status: 'SUSPENDED' };
      mockFindUsers.mockResolvedValue([mockUsers[1]]);
      mockCountUsers.mockResolvedValue(1);

      const result = await adminService.listUsers(filters);

      expect(result.data).toHaveLength(1);
      expect(result.data[0].status).toBe('SUSPENDED');
    });

    it('searches by email or name', async () => {
      const filters = { ...defaultFilters, search: 'john' };
      mockFindUsers.mockResolvedValue([mockUsers[0]]);
      mockCountUsers.mockResolvedValue(1);

      const result = await adminService.listUsers(filters);

      expect(result.data).toHaveLength(1);
      expect(mockFindUsers).toHaveBeenCalledWith(filters);
    });

    it('sorts by specified field', async () => {
      const filters = { ...defaultFilters, sort: 'email', order: 'asc' as const };
      mockFindUsers.mockResolvedValue([...mockUsers].reverse());
      mockCountUsers.mockResolvedValue(2);

      const result = await adminService.listUsers(filters);

      expect(result.data).toHaveLength(2);
      expect(mockFindUsers).toHaveBeenCalledWith(filters);
    });

    it('returns empty array when no users match', async () => {
      mockFindUsers.mockResolvedValue([]);
      mockCountUsers.mockResolvedValue(0);

      const result = await adminService.listUsers(defaultFilters);

      expect(result.data).toHaveLength(0);
      expect(result.meta.total).toBe(0);
      expect(result.meta.hasMore).toBe(false);
    });

    it('computes hasMore correctly', async () => {
      mockFindUsers.mockResolvedValue(mockUsers);
      mockCountUsers.mockResolvedValue(50); // 50 total with pageSize=20, page=1 → hasMore=true

      const result = await adminService.listUsers(defaultFilters);

      expect(result.data).toHaveLength(2);
      expect(result.meta.total).toBe(50);
      expect(result.meta.hasMore).toBe(true);
    });
  });

  describe('updateUserStatus', () => {
    it('updates user status to SUSPENDED and creates audit log with notifyUser', async () => {
      mockFindUserById.mockResolvedValue(mockUser);
      mockUpdateUserStatus.mockResolvedValue(mockUpdatedUser);
      mockCreateAuditLog.mockResolvedValue({});

      const result = await adminService.updateUserStatus(
        'user-uuid-1',
        'SUSPENDED',
        'Violation of terms',
        true,
        'admin-uuid',
        '127.0.0.1',
        'test-agent',
      );

      expect(result.userId).toBe('user-uuid-1');
      expect(result.status).toBe('SUSPENDED');
      expect(mockUpdateUserStatus).toHaveBeenCalledWith('user-uuid-1', 'SUSPENDED');
      expect(mockCreateAuditLog).toHaveBeenCalledWith({
        userId: 'admin-uuid',
        action: 'USER_STATUS_CHANGE',
        entity: 'USER',
        entityId: 'user-uuid-1',
        oldValue: { status: 'ACTIVE' },
        newValue: { status: 'SUSPENDED', reason: 'Violation of terms', notifyUser: true },
        ipAddress: '127.0.0.1',
        userAgent: 'test-agent',
      });
    });

    it('updates user status to ACTIVE and creates audit log', async () => {
      const suspendedUser = { ...mockUser, status: 'SUSPENDED' };
      const activatedUser = { ...mockUpdatedUser, status: 'ACTIVE' };

      mockFindUserById.mockResolvedValue(suspendedUser);
      mockUpdateUserStatus.mockResolvedValue(activatedUser);
      mockCreateAuditLog.mockResolvedValue({});

      const result = await adminService.updateUserStatus(
        'user-uuid-1',
        'ACTIVE',
        'Appeal approved',
        false,
        'admin-uuid',
      );

      expect(result.status).toBe('ACTIVE');
      expect(mockCreateAuditLog).toHaveBeenCalledWith({
        userId: 'admin-uuid',
        action: 'USER_STATUS_CHANGE',
        entity: 'USER',
        entityId: 'user-uuid-1',
        oldValue: { status: 'SUSPENDED' },
        newValue: { status: 'ACTIVE', reason: 'Appeal approved', notifyUser: false },
        ipAddress: null,
        userAgent: null,
      });
    });

    it('blocks self-suspension', async () => {
      await expect(
        adminService.updateUserStatus(
          'admin-uuid',
          'SUSPENDED',
          'Testing self',
          true,
          'admin-uuid',
        ),
      ).rejects.toThrow(ForbiddenError);

      expect(mockFindUserById).not.toHaveBeenCalled();
    });

    it('throws NotFoundError when user does not exist', async () => {
      mockFindUserById.mockResolvedValue(null);

      await expect(
        adminService.updateUserStatus(
          'nonexistent-uuid',
          'SUSPENDED',
          'Reason',
          true,
          'admin-uuid',
        ),
      ).rejects.toThrow(NotFoundError);
    });

    it('accepts notifyUser flag but does not send email (documented gap)', async () => {
      mockFindUserById.mockResolvedValue(mockUser);
      mockUpdateUserStatus.mockResolvedValue(mockUpdatedUser);
      mockCreateAuditLog.mockResolvedValue({});

      const resultWithNotify = await adminService.updateUserStatus(
        'user-uuid-1',
        'SUSPENDED',
        'Reason',
        true,
        'admin-uuid',
      );

      const resultWithoutNotify = await adminService.updateUserStatus(
        'user-uuid-1',
        'SUSPENDED',
        'Reason',
        false,
        'admin-uuid',
      );

      expect(resultWithNotify.status).toBe('SUSPENDED');
      expect(resultWithoutNotify.status).toBe('SUSPENDED');
    });
  });

  describe('listAuditLogs', () => {
    const defaultFilters = {
      page: 1,
      pageSize: 50,
      userId: undefined as string | undefined,
      action: undefined as string | undefined,
      entity: undefined as string | undefined,
      from: undefined as string | undefined,
      to: undefined as string | undefined,
    };

    it('returns paginated audit logs with userEmail', async () => {
      mockFindAuditLogs.mockResolvedValue(mockAuditLogs);
      mockCountAuditLogs.mockResolvedValue(1);

      const result = await adminService.listAuditLogs(defaultFilters);

      expect(result.data).toHaveLength(1);
      expect(result.data[0].action).toBe('USER_STATUS_CHANGE');
      expect(result.data[0].userId).toBe('admin-uuid');
      expect(result.data[0].userEmail).toBe('admin@example.com');
      expect(result.meta.total).toBe(1);
      expect(mockFindAuditLogs).toHaveBeenCalledWith(defaultFilters);
    });

    it('filters by userId', async () => {
      const filters = { ...defaultFilters, userId: 'admin-uuid' };
      mockFindAuditLogs.mockResolvedValue(mockAuditLogs);
      mockCountAuditLogs.mockResolvedValue(1);

      const result = await adminService.listAuditLogs(filters);

      expect(result.data).toHaveLength(1);
      expect(mockFindAuditLogs).toHaveBeenCalledWith(filters);
    });

    it('filters by action', async () => {
      const filters = { ...defaultFilters, action: 'USER_STATUS_CHANGE' };
      mockFindAuditLogs.mockResolvedValue(mockAuditLogs);
      mockCountAuditLogs.mockResolvedValue(1);

      const result = await adminService.listAuditLogs(filters);

      expect(result.data).toHaveLength(1);
    });

    it('filters by entity', async () => {
      const filters = { ...defaultFilters, entity: 'USER' };
      mockFindAuditLogs.mockResolvedValue(mockAuditLogs);
      mockCountAuditLogs.mockResolvedValue(1);

      const result = await adminService.listAuditLogs(filters);

      expect(result.data).toHaveLength(1);
    });

    it('filters by date range', async () => {
      const filters = { ...defaultFilters, from: '2025-05-01T00:00:00Z', to: '2025-05-15T00:00:00Z' };
      mockFindAuditLogs.mockResolvedValue(mockAuditLogs);
      mockCountAuditLogs.mockResolvedValue(1);

      const result = await adminService.listAuditLogs(filters);

      expect(result.data).toHaveLength(1);
      expect(mockFindAuditLogs).toHaveBeenCalledWith(filters);
    });

    it('includes userEmail but strips ipAddress and userAgent from response', async () => {
      const logWithSensitiveData = {
        ...mockAuditLogs[0],
        ipAddress: '127.0.0.1',
        userAgent: 'test-agent',
        user: { email: 'admin@example.com' },
      };
      mockFindAuditLogs.mockResolvedValue([logWithSensitiveData]);
      mockCountAuditLogs.mockResolvedValue(1);

      const result = await adminService.listAuditLogs(defaultFilters);

      expect(result.data[0]).toHaveProperty('userEmail');
      expect(result.data[0].userEmail).toBe('admin@example.com');
      expect(result.data[0]).not.toHaveProperty('ipAddress');
      expect(result.data[0]).not.toHaveProperty('userAgent');
    });

    it('returns empty array when no logs match', async () => {
      mockFindAuditLogs.mockResolvedValue([]);
      mockCountAuditLogs.mockResolvedValue(0);

      const result = await adminService.listAuditLogs(defaultFilters);

      expect(result.data).toHaveLength(0);
      expect(result.meta.total).toBe(0);
    });
  });

  describe('generateReport', () => {
    const mockReportData = [
      { id: '1', name: 'User 1', email: 'user1@example.com' },
      { id: '2', name: 'User 2', email: 'user2@example.com' },
    ];

    it('generates a JSON report with reportType and parameters', async () => {
      mockGetReportData.mockResolvedValue(mockReportData);

      const result = await adminService.generateReport({
        type: 'users',
        format: 'json',
      });

      expect(result).not.toHaveProperty('csv');
      if ('reportType' in result) {
        expect(result.reportType).toBe('users');
        expect(result.generatedAt).toBeDefined();
        expect(result.parameters).toEqual({ from: null, to: null });
        expect(result.data).toEqual(mockReportData);
      }
    });

    it('generates a JSON report with provided date parameters', async () => {
      mockGetReportData.mockResolvedValue(mockReportData);

      const result = await adminService.generateReport({
        type: 'users',
        format: 'json',
        from: '2025-01-01',
        to: '2025-05-01',
      });

      if ('reportType' in result) {
        expect(result.reportType).toBe('users');
        expect(result.parameters).toEqual({ from: '2025-01-01', to: '2025-05-01' });
      }
    });

    it('generates a CSV report', async () => {
      mockGetReportData.mockResolvedValue(mockReportData);

      const result = await adminService.generateReport({
        type: 'users',
        format: 'csv',
      });

      expect(result).toHaveProperty('csv');
      expect(result).toHaveProperty('filename');
      if ('csv' in result) {
        expect(result.csv).toContain('id,name,email');
        expect(result.csv).toContain('1,User 1,user1@example.com');
        expect(result.csv).toContain('2,User 2,user2@example.com');
        expect(result.filename).toContain('users-report-');
        expect(result.filename.endsWith('.csv')).toBe(true);
      }
    });

    it('generates CSV with escaped fields', async () => {
      const dataWithCommas = [
        { name: 'Smith, John', city: 'Addis Ababa' },
      ];
      mockGetReportData.mockResolvedValue(dataWithCommas);

      const result = await adminService.generateReport({
        type: 'users',
        format: 'csv',
      });

      if ('csv' in result) {
        expect(result.csv).toContain('"Smith, John"');
        expect(result.csv).toContain('Addis Ababa');
      }
    });

    it('returns empty CSV for empty report data', async () => {
      mockGetReportData.mockResolvedValue([]);

      const result = await adminService.generateReport({
        type: 'internships',
        format: 'csv',
      });

      if ('csv' in result) {
        expect(result.csv).toBe('');
      }
    });

    it('generates internships report', async () => {
      const data = [
        { id: '1', title: 'Engineer Intern', companyName: 'Tech Corp' },
      ];
      mockGetReportData.mockResolvedValue(data);

      const result = await adminService.generateReport({
        type: 'internships',
        format: 'json',
      });

      if ('reportType' in result) {
        expect(result.reportType).toBe('internships');
        expect(result.data).toEqual(data);
      }
    });

    it('generates applications report', async () => {
      const data = [
        { id: '1', internshipTitle: 'Engineer', studentName: 'John Doe', status: 'PENDING' },
      ];
      mockGetReportData.mockResolvedValue(data);

      const result = await adminService.generateReport({
        type: 'applications',
        format: 'json',
      });

      if ('reportType' in result) {
        expect(result.reportType).toBe('applications');
        expect(result.data).toEqual(data);
      }
    });

    it('generates companies report', async () => {
      const data = [
        { id: '1', name: 'Tech Corp', industry: 'Tech', city: 'Addis Ababa' },
      ];
      mockGetReportData.mockResolvedValue(data);

      const result = await adminService.generateReport({
        type: 'companies',
        format: 'json',
      });

      if ('reportType' in result) {
        expect(result.reportType).toBe('companies');
        expect(result.data).toEqual(data);
      }
    });

    it('generates schools report', async () => {
      const data = [
        { id: '1', name: 'Bole High', type: 'PUBLIC', city: 'Addis Ababa' },
      ];
      mockGetReportData.mockResolvedValue(data);

      const result = await adminService.generateReport({
        type: 'schools',
        format: 'json',
      });

      if ('reportType' in result) {
        expect(result.reportType).toBe('schools');
        expect(result.data).toEqual(data);
      }
    });

    it('passes from/to date range to repository', async () => {
      mockGetReportData.mockResolvedValue([]);

      await adminService.generateReport({
        type: 'users',
        format: 'json',
        from: '2025-01-01',
        to: '2025-05-01',
      });

      expect(mockGetReportData).toHaveBeenCalledWith('users', '2025-01-01', '2025-05-01');
    });
  });
});
