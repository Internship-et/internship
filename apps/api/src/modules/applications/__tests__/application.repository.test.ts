// ─────────────────────────────────────────────────────────────
// Application Repository — Unit Tests
// Tests all application.repository.ts queries against the test database.
// ─────────────────────────────────────────────────────────────

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import {
  truncateAllTables,
  disconnectPrisma,
} from '../../../test/setup.js';
import { createTestCompany } from '../../../test/factories/company.factory.js';
import { createTestInternship } from '../../../test/factories/internship.factory.js';
import { createTestApplication } from '../../../test/factories/application.factory.js';
import {
  findAll,
  findById,
  updateStatus,
  createStatusHistory,
  withdraw,
} from '../application.repository.js';
import type { ApplicationStatus } from '../../../generated/prisma/enums.js';

describe('ApplicationRepository', () => {
  beforeAll(async () => {
    // Migrations applied by global-setup.ts
  });

  afterAll(async () => {
    await disconnectPrisma();
  });

  beforeEach(async () => {
    await truncateAllTables();
  });

  // ─── findById ─────────────────────────────────────────────

  describe('findById', () => {
    it('should return the application with student, internship, and statusHistory', async () => {
      const application = await createTestApplication();

      const result = await findById(application.id);

      expect(result).not.toBeNull();
      expect(result!.id).toBe(application.id);
      expect(result!.student).toBeDefined();
      expect(result!.student.user.firstName).toBeDefined();
      expect(result!.internship).toBeDefined();
      expect(result!.internship.title).toBeDefined();
      expect(result!.statusHistory).toBeDefined();
      expect(Array.isArray(result!.statusHistory)).toBe(true);
    });

    it('should return null when application does not exist', async () => {
      const result = await findById('f47ac10b-58cc-4372-a567-0e02b2c3d479');
      expect(result).toBeNull();
    });
  });

  // ─── findAll (cursor pagination) ──────────────────────────

  describe('findAll', () => {
    it('should return limit+1 rows to detect hasMore', async () => {
      // Create 4 applications
      for (let i = 0; i < 4; i++) {
        await createTestApplication();
      }

      const results = await findAll({ limit: 3 });

      expect(results.length).toBe(4); // limit + 1 hasMore indicator
    });

    it('should filter by studentId', async () => {
      const application = await createTestApplication();

      const results = await findAll({
        limit: 10,
        studentId: application.studentId,
      });

      expect(results.length).toBe(1);
      expect(results[0].studentId).toBe(application.studentId);
    });

    it('should filter by companyId', async () => {
      const company = await createTestCompany();
      const internship = await createTestInternship({ companyId: company.id });
      await createTestApplication({ internshipId: internship.id });

      // Create another application for a different company
      await createTestApplication();

      const results = await findAll({
        limit: 10,
        companyId: company.id,
      });

      expect(results.length).toBe(1);
    });

    it('should filter by status', async () => {
      await createTestApplication({ status: 'PENDING' });
      await createTestApplication({ status: 'REVIEWED' });

      const results = await findAll({
        limit: 10,
        status: 'REVIEWED',
      });

      expect(results.length).toBe(1);
      expect(results[0].status).toBe('REVIEWED');
    });

    it('should filter by internshipId', async () => {
      const targetInternship = await createTestInternship();
      await createTestApplication({ internshipId: targetInternship.id });

      // Create another for a different internship
      await createTestApplication();

      const results = await findAll({
        limit: 10,
        internshipId: targetInternship.id,
      });

      expect(results.length).toBe(1);
      expect(results[0].internshipId).toBe(targetInternship.id);
    });

    it('should return empty array when no matches', async () => {
      const results = await findAll({
        limit: 10,
        status: 'ACCEPTED' as ApplicationStatus,
      });
      expect(results).toEqual([]);
    });
  });

  // ─── updateStatus ─────────────────────────────────────────

  describe('updateStatus', () => {
    it('should update the application status and return full relations', async () => {
      const application = await createTestApplication({ status: 'PENDING' });

      const result = await updateStatus(application.id, 'REVIEWED');

      expect(result.status).toBe('REVIEWED');
      expect(result.student).toBeDefined();
      expect(result.internship).toBeDefined();
      expect(result.statusHistory).toBeDefined();
    });
  });

  // ─── createStatusHistory ─────────────────────────────────

  describe('createStatusHistory', () => {
    it('should create an immutable status history entry', async () => {
      const application = await createTestApplication();
      const { createTestUser } = await import('../../../test/factories/user.factory.js');
      const admin = await createTestUser({ role: 'ADMIN' });

      const historyEntry = await createStatusHistory({
        applicationId: application.id,
        fromStatus: 'PENDING',
        toStatus: 'REVIEWED',
        changedById: admin.id,
        note: 'Reviewed by admin',
      });

      expect(historyEntry.fromStatus).toBe('PENDING');
      expect(historyEntry.toStatus).toBe('REVIEWED');
      expect(historyEntry.changedById).toBe(admin.id);
      expect(historyEntry.note).toBe('Reviewed by admin');
    });
  });

  // ─── withdraw ─────────────────────────────────────────────

  describe('withdraw', () => {
    it('should set status to WITHDRAWN and return full relations', async () => {
      const application = await createTestApplication({ status: 'PENDING' });

      const result = await withdraw(application.id);

      expect(result.status).toBe('WITHDRAWN');
      expect(result.student).toBeDefined();
      expect(result.internship).toBeDefined();
      expect(result.statusHistory).toBeDefined();
    });
  });
});
