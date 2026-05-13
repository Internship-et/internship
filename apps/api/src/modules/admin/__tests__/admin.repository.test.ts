// ─────────────────────────────────────────────────────────────
// Admin Repository — Unit Tests
// Tests all admin.repository.ts queries against the test database.
// ─────────────────────────────────────────────────────────────

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import {
  truncateAllTables,
  disconnectPrisma,
} from '../../../test/setup.js';
import { createTestUser } from '../../../test/factories/user.factory.js';
import { createTestCompany } from '../../../test/factories/company.factory.js';
import { createTestStudent } from '../../../test/factories/student.factory.js';
import { createTestSchool } from '../../../test/factories/school.factory.js';
import { createTestInternship } from '../../../test/factories/internship.factory.js';
import { createTestApplication } from '../../../test/factories/application.factory.js';
import { createTestAuditLog } from '../../../test/factories/audit-log.factory.js';
import * as adminRepository from '../admin.repository.js';

describe('AdminRepository', () => {
  beforeAll(async () => {
    // Migrations applied by global-setup.ts
  });

  afterAll(async () => {
    await disconnectPrisma();
  });

  beforeEach(async () => {
    await truncateAllTables();
  });

  // ─── getDashboardOverview ─────────────────────────────────

  describe('getDashboardOverview', () => {
    it('should return all 6 entity counts', async () => {
      await createTestUser({ role: 'STUDENT' });
      await createTestCompany();
      await createTestSchool();
      await createTestInternship();
      // Create enough for a valid application
      const student = await createTestStudent({ resumeUrl: 'http://example.com/resume' });
      const internship = await createTestInternship();
      await createTestApplication({ studentId: student.id, internshipId: internship.id });

      const overview = await adminRepository.getDashboardOverview();

      expect(overview.totalUsers).toBeGreaterThanOrEqual(3); // users from factories
      expect(overview.totalStudents).toBeGreaterThanOrEqual(1);
      expect(overview.totalCompanies).toBeGreaterThanOrEqual(1);
      expect(overview.totalSchools).toBeGreaterThanOrEqual(1);
      expect(overview.totalInternships).toBeGreaterThanOrEqual(1);
      expect(overview.totalApplications).toBeGreaterThanOrEqual(1);
    });
  });

  // ─── getPlatformMetrics ───────────────────────────────────

  describe('getPlatformMetrics', () => {
    it('should return metrics with correct shape', async () => {
      const metrics = await adminRepository.getPlatformMetrics();

      expect(metrics).toHaveProperty('activeUsersToday');
      expect(metrics).toHaveProperty('activeUsersThisWeek');
      expect(metrics).toHaveProperty('newUsersToday');
      expect(metrics).toHaveProperty('newInternshipsToday');
      expect(metrics).toHaveProperty('newApplicationsToday');
      expect(metrics).toHaveProperty('fillRate');
      expect(metrics).toHaveProperty('averageTimeToHire');

      expect(typeof metrics.activeUsersToday).toBe('number');
      expect(typeof metrics.fillRate).toBe('number');
    });
  });

  // ─── getUserGrowth ────────────────────────────────────────

  describe('getUserGrowth', () => {
    it('should return growth data grouped by day', async () => {
      await createTestUser();
      await createTestUser();

      const growth = await adminRepository.getUserGrowth();

      expect(growth.length).toBeGreaterThanOrEqual(1);
      expect(growth[0]).toHaveProperty('date');
      expect(growth[0]).toHaveProperty('count');
    });

    it('should return empty array for a date range with no users', async () => {
      const growth = await adminRepository.getUserGrowth(
        '2020-01-01',
        '2020-01-02',
      );
      expect(growth).toEqual([]);
    });
  });

  // ─── findUsers ─────────────────────────────────────────────

  describe('findUsers', () => {
    it('should paginate correctly', async () => {
      for (let i = 0; i < 5; i++) {
        await createTestUser();
      }

      const users = await adminRepository.findUsers({
        page: 1,
        pageSize: 3,
        sort: 'createdAt',
        order: 'asc',
      });

      expect(users.length).toBe(3);

      const page2 = await adminRepository.findUsers({
        page: 2,
        pageSize: 3,
        sort: 'createdAt',
        order: 'asc',
      });
      expect(page2.length).toBe(2);
    });

    it('should search by email (case-insensitive)', async () => {
      await createTestUser({ email: 'searchable-email@example.com' });
      await createTestUser({ email: 'other@example.com' });

      const users = await adminRepository.findUsers({
        page: 1,
        pageSize: 10,
        search: 'SEARCHABLE',
        sort: 'createdAt',
        order: 'desc',
      });

      expect(users.length).toBe(1);
      expect(users[0].email).toBe('searchable-email@example.com');
    });

    it('should filter by role', async () => {
      await createTestUser({ role: 'STUDENT' });
      const admin = await createTestUser({ role: 'ADMIN' });

      const users = await adminRepository.findUsers({
        page: 1,
        pageSize: 10,
        role: 'ADMIN',
        sort: 'createdAt',
        order: 'desc',
      });

      expect(users.length).toBe(1);
      expect(users[0].id).toBe(admin.id);
    });

    it('should filter by status', async () => {
      await createTestUser({ status: 'ACTIVE' });
      const suspendedUser = await createTestUser({ status: 'SUSPENDED' });

      const users = await adminRepository.findUsers({
        page: 1,
        pageSize: 10,
        status: 'SUSPENDED',
        sort: 'createdAt',
        order: 'desc',
      });

      expect(users.length).toBe(1);
      expect(users[0].id).toBe(suspendedUser.id);
    });

    it('should sort by firstName ascending', async () => {
      await createTestUser({ firstName: 'Zara' });
      await createTestUser({ firstName: 'Abebe' });

      const users = await adminRepository.findUsers({
        page: 1,
        pageSize: 10,
        sort: 'firstName',
        order: 'asc',
      });

      expect(users[0].firstName).toBe('Abebe');
    });

    it('should return empty array when no matches', async () => {
      const users = await adminRepository.findUsers({
        page: 1,
        pageSize: 10,
        search: 'NoMatchPossible123',
        sort: 'createdAt',
        order: 'desc',
      });

      expect(users).toEqual([]);
    });
  });

  // ─── countUsers ───────────────────────────────────────────

  describe('countUsers', () => {
    it('should match filtered results', async () => {
      await createTestUser({ role: 'STUDENT' });
      await createTestUser({ role: 'COMPANY' });
      await createTestUser({ role: 'ADMIN' });

      const studentCount = await adminRepository.countUsers({
        page: 1,
        pageSize: 10,
        role: 'STUDENT',
        sort: 'createdAt',
        order: 'desc',
      });

      expect(studentCount).toBe(1);

      const totalCount = await adminRepository.countUsers({
        page: 1,
        pageSize: 10,
        sort: 'createdAt',
        order: 'desc',
      });

      expect(totalCount).toBe(3);
    });
  });

  // ─── findUserById ─────────────────────────────────────────

  describe('findUserById', () => {
    it('should return user without passwordHash', async () => {
      const user = await createTestUser();

      const result = await adminRepository.findUserById(user.id);

      expect(result).not.toBeNull();
      expect(result!.id).toBe(user.id);
      expect((result as Record<string, unknown>).passwordHash).toBeUndefined();
    });

    it('should return null for non-existent user', async () => {
      const result = await adminRepository.findUserById('f47ac10b-58cc-4372-a567-0e02b2c3d479');
      expect(result).toBeNull();
    });
  });

  // ─── updateUserStatus ─────────────────────────────────────

  describe('updateUserStatus', () => {
    it('should set user status to ACTIVE', async () => {
      const user = await createTestUser({ status: 'PENDING' });

      const result = await adminRepository.updateUserStatus(user.id, 'ACTIVE');

      expect(result.status).toBe('ACTIVE');
    });

    it('should set user status to SUSPENDED', async () => {
      const user = await createTestUser({ status: 'ACTIVE' });

      const result = await adminRepository.updateUserStatus(user.id, 'SUSPENDED');

      expect(result.status).toBe('SUSPENDED');
    });
  });

  // ─── findAuditLogs ────────────────────────────────────────

  describe('findAuditLogs', () => {
    it('should paginate correctly', async () => {
      for (let i = 0; i < 4; i++) {
        await createTestAuditLog();
      }

      const logs = await adminRepository.findAuditLogs({
        page: 1,
        pageSize: 3,
      });

      expect(logs.length).toBe(3);

      const page2 = await adminRepository.findAuditLogs({
        page: 2,
        pageSize: 3,
      });
      expect(page2.length).toBe(1);
    });

    it('should filter by userId', async () => {
      const user = await createTestUser({ role: 'ADMIN' });
      await createTestAuditLog({ userId: user.id });
      await createTestAuditLog(); // another user

      const logs = await adminRepository.findAuditLogs({
        page: 1,
        pageSize: 10,
        userId: user.id,
      });

      expect(logs.length).toBe(1);
      expect(logs[0].userId).toBe(user.id);
    });

    it('should filter by action', async () => {
      await createTestAuditLog({ action: 'STATUS_CHANGE' });
      await createTestAuditLog({ action: 'CREATE' });

      const logs = await adminRepository.findAuditLogs({
        page: 1,
        pageSize: 10,
        action: 'CREATE',
      });

      expect(logs.length).toBe(1);
      expect(logs[0].action).toBe('CREATE');
    });

    it('should filter by entity', async () => {
      await createTestAuditLog({ entity: 'USER' });
      await createTestAuditLog({ entity: 'COMPANY' });

      const logs = await adminRepository.findAuditLogs({
        page: 1,
        pageSize: 10,
        entity: 'COMPANY',
      });

      expect(logs.length).toBe(1);
      expect(logs[0].entity).toBe('COMPANY');
    });
  });

  // ─── countAuditLogs ───────────────────────────────────────

  describe('countAuditLogs', () => {
    it('should match filtered audit log count', async () => {
      await createTestAuditLog({ action: 'STATUS_CHANGE' });
      await createTestAuditLog({ action: 'CREATE' });

      const count = await adminRepository.countAuditLogs({
        page: 1,
        pageSize: 10,
        action: 'CREATE',
      });

      expect(count).toBe(1);
    });
  });

  // ─── createAuditLog ───────────────────────────────────────

  describe('createAuditLog', () => {
    it('should create an audit log with ipAddress and userAgent', async () => {
      const user = await createTestUser({ role: 'ADMIN' });

      const result = await adminRepository.createAuditLog({
        userId: user.id,
        action: 'USER_STATUS_CHANGE',
        entity: 'USER',
        entityId: user.id,
        oldValue: { status: 'PENDING' },
        newValue: { status: 'ACTIVE' },
        ipAddress: '192.168.1.1',
        userAgent: 'TestAgent/1.0',
      });

      expect(result.userId).toBe(user.id);
      expect(result.action).toBe('USER_STATUS_CHANGE');
      expect(result.ipAddress).toBe('192.168.1.1');
      expect(result.userAgent).toBe('TestAgent/1.0');
    });
  });

  // ─── Report Queries ───────────────────────────────────────

  describe('getReportData', () => {
    it('should return users report', async () => {
      await createTestUser();
      await createTestUser();

      const data = await adminRepository.getReportData('users');
      expect(data.length).toBeGreaterThanOrEqual(2);
    });

    it('should return internships report', async () => {
      await createTestInternship();
      await createTestInternship();

      const data = await adminRepository.getReportData('internships');
      expect(data.length).toBeGreaterThanOrEqual(2);
    });

    it('should return applications report', async () => {
      const student = await createTestStudent({ resumeUrl: 'http://example.com/resume' });
      const internship = await createTestInternship();
      await createTestApplication({ studentId: student.id, internshipId: internship.id });

      const data = await adminRepository.getReportData('applications');
      expect(data.length).toBeGreaterThanOrEqual(1);
    });

    it('should return companies report', async () => {
      await createTestCompany();
      await createTestCompany();

      const data = await adminRepository.getReportData('companies');
      expect(data.length).toBeGreaterThanOrEqual(2);
    });

    it('should return schools report', async () => {
      await createTestSchool();
      await createTestSchool();

      const data = await adminRepository.getReportData('schools');
      expect(data.length).toBeGreaterThanOrEqual(2);
    });

    it('should return empty array for unknown type', async () => {
      const data = await adminRepository.getReportData('unknown' as 'users');
      expect(data).toEqual([]);
    });

    it('should filter by date range', async () => {
      // Create a user with a past date (before 2020)
      const { getPrisma } = await import('../../../test/setup.js');
      const prisma = getPrisma();
      await prisma.user.create({
        data: {
          email: 'old-user@example.com',
          passwordHash: '$2b$10$testhash',
          firstName: 'Old',
          lastName: 'User',
          role: 'STUDENT',
          status: 'ACTIVE',
          isVerified: true,
          createdAt: new Date('2019-06-15'),
        },
      });

      const recentData = await adminRepository.getReportData(
        'users',
        '2020-01-01',
        '2025-12-31',
      );

      // Should only include users created after 2020
      for (const item of recentData) {
        const reportItem = item as { registeredAt: string };
        const registeredAt = new Date(reportItem.registeredAt);
        expect(registeredAt.getTime()).toBeGreaterThanOrEqual(
          new Date('2020-01-01').getTime(),
        );
      }
    });
  });
});
