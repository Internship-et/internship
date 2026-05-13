// ─────────────────────────────────────────────────────────────
// Internship Repository — Unit Tests
// Tests all internship.repository.ts queries against the test database.
// ─────────────────────────────────────────────────────────────

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import {
  truncateAllTables,
  disconnectPrisma,
} from '../../../test/setup.js';
import { createTestCompany } from '../../../test/factories/company.factory.js';
import { createTestInternship } from '../../../test/factories/internship.factory.js';
import { createTestStudent } from '../../../test/factories/student.factory.js';
import * as internshipRepository from '../internship.repository.js';

describe('InternshipRepository', () => {
  beforeAll(async () => {
    // Migrations applied by global-setup.ts
  });

  afterAll(async () => {
    await disconnectPrisma();
  });

  beforeEach(async () => {
    await truncateAllTables();
  });

  // ─── findById (scoped to ACTIVE) ──────────────────────────

  describe('findById', () => {
    it('should return an ACTIVE internship with company and application count', async () => {
      const internship = await createTestInternship({ status: 'ACTIVE' });

      const result = await internshipRepository.findById(internship.id);

      expect(result).not.toBeNull();
      expect(result!.id).toBe(internship.id);
      expect(result!.company).toBeDefined();
      expect(result!.company.name).toBeDefined();
      expect(result!._count).toBeDefined();
      expect(typeof result!._count.applications).toBe('number');
    });

    it('should return null when internship status is not ACTIVE', async () => {
      const draftInternship = await createTestInternship({ status: 'DRAFT' });
      const result = await internshipRepository.findById(draftInternship.id);
      expect(result).toBeNull();
    });

    it('should return null when internship does not exist', async () => {
      const result = await internshipRepository.findById('f47ac10b-58cc-4372-a567-0e02b2c3d479');
      expect(result).toBeNull();
    });
  });

  // ─── findByIdUnscoped ─────────────────────────────────────

  describe('findByIdUnscoped', () => {
    it('should return an internship regardless of status', async () => {
      await createTestInternship({ status: 'ACTIVE' });
      const draftInternship = await createTestInternship({ status: 'DRAFT' });

      const result = await internshipRepository.findByIdUnscoped(draftInternship.id);

      expect(result).not.toBeNull();
      expect(result!.status).toBe('DRAFT');
    });

    it('should return null when id does not exist', async () => {
      const result = await internshipRepository.findByIdUnscoped('f47ac10b-58cc-4372-a567-0e02b2c3d479');
      expect(result).toBeNull();
    });
  });

  // ─── findAll (cursor pagination) ──────────────────────────

  describe('findAll', () => {
    it('should return limit+1 rows to detect hasMore', async () => {
      for (let i = 0; i < 5; i++) {
        await createTestInternship();
      }

      const results = await internshipRepository.findAll({
        limit: 3,
      });

      expect(results.length).toBe(4); // limit + 1 hasMore indicator
    });

    it('should return hasMore=false on last page', async () => {
      for (let i = 0; i < 2; i++) {
        await createTestInternship();
      }

      const results = await internshipRepository.findAll({
        limit: 5,
      });

      expect(results.length).toBeLessThanOrEqual(3);
    });

    it('should search by title (case-insensitive)', async () => {
      await createTestInternship({ title: 'Software Engineering Intern' });
      await createTestInternship({ title: 'Data Science Intern' });

      const results = await internshipRepository.findAll({
        limit: 10,
        search: 'software',
      });

      expect(results.length).toBe(1);
      expect(results[0].title).toContain('Software');
    });

    it('should filter by city', async () => {
      await createTestInternship({ city: 'Addis Ababa', title: 'AA Intern' });
      await createTestInternship({ city: 'Bahir Dar', title: 'BD Intern' });

      const results = await internshipRepository.findAll({
        limit: 10,
        city: 'Bahir Dar',
      });

      expect(results.length).toBe(1);
      expect(results[0].city).toBe('Bahir Dar');
    });

    it('should filter by type', async () => {
      await createTestInternship({ type: 'ON_SITE', title: 'Onsite Intern' });
      await createTestInternship({ type: 'REMOTE', title: 'Remote Intern' });

      const results = await internshipRepository.findAll({
        limit: 10,
        type: 'REMOTE',
      });

      expect(results.length).toBe(1);
      expect(results[0].type).toBe('REMOTE');
    });

    it('should filter by duration range', async () => {
      await createTestInternship({ durationMonths: 3, title: 'Short Intern' });
      await createTestInternship({ durationMonths: 6, title: 'Long Intern' });

      const results = await internshipRepository.findAll({
        limit: 10,
        minDuration: 5,
        maxDuration: 12,
      });

      expect(results.length).toBe(1);
      expect(results[0].durationMonths).toBe(6);
    });

    it('should filter by tags', async () => {
      await createTestInternship({ tags: ['javascript', 'react'], title: 'Frontend Intern' });
      await createTestInternship({ tags: ['python', 'django'], title: 'Backend Intern' });

      const results = await internshipRepository.findAll({
        limit: 10,
        tags: ['javascript'],
      });

      expect(results.length).toBe(1);
    });

    it('should sort by createdAt descending (default)', async () => {
      await createTestInternship({ title: 'First Intern' });
      await createTestInternship({ title: 'Second Intern' });

      const results = await internshipRepository.findAll({
        limit: 10,
        sort: 'createdAt',
        order: 'desc',
      });

      expect(results.length).toBeGreaterThanOrEqual(2);
      // Most recently created should be first
      expect(new Date(results[0].createdAt).getTime()).toBeGreaterThanOrEqual(
        new Date(results[1].createdAt).getTime(),
      );
    });

    it('should return empty array when no matches', async () => {
      const results = await internshipRepository.findAll({
        limit: 10,
        city: 'NonExistentCity',
      });

      expect(results.length).toBe(0);
    });
  });

  // ─── count ────────────────────────────────────────────────

  describe('count', () => {
    it('should return the count of ACTIVE internships matching filters', async () => {
      await createTestInternship({ status: 'ACTIVE', city: 'Addis Ababa' });
      await createTestInternship({ status: 'ACTIVE', city: 'Addis Ababa' });
      await createTestInternship({ status: 'DRAFT', city: 'Addis Ababa' });

      const total = await internshipRepository.count({
        limit: 10,
        city: 'Addis Ababa',
      });

      expect(total).toBe(2); // Only ACTIVE
    });
  });

  // ─── create ───────────────────────────────────────────────

  describe('create', () => {
    it('should create an internship with DRAFT status by default', async () => {
      const company = await createTestCompany();

      const result = await internshipRepository.create({
        companyId: company.id,
        title: 'New Internship',
        description: 'A test internship',
        requirements: ['Must be a student'],
        type: 'ON_SITE',
        city: 'Addis Ababa',
        durationMonths: 3,
      });

      expect(result.status).toBe('DRAFT');
      expect(result.title).toBe('New Internship');
      expect(result.companyId).toBe(company.id);
    });
  });

  // ─── update ───────────────────────────────────────────────

  describe('update', () => {
    it('should update internship fields including status', async () => {
      const internship = await createTestInternship({ status: 'DRAFT' });

      const result = await internshipRepository.update(internship.id, {
        title: 'Updated Title',
        status: 'ACTIVE',
      });

      expect(result.title).toBe('Updated Title');
      expect(result.status).toBe('ACTIVE');
    });
  });

  // ─── softDelete ───────────────────────────────────────────

  describe('softDelete', () => {
    it('should set status to CLOSED and deletedAt', async () => {
      const internship = await createTestInternship({ status: 'ACTIVE' });

      const result = await internshipRepository.softDelete(internship.id);

      expect(result.status).toBe('CLOSED');
      expect(result.deletedAt).toBeInstanceOf(Date);
    });
  });

  // ─── createApplication ────────────────────────────────────

  describe('createApplication', () => {
    it('should create a PENDING application', async () => {
      const internship = await createTestInternship();
      const student = await createTestStudent({ resumeUrl: 'http://example.com/resume' });

      const result = await internshipRepository.createApplication({
        internshipId: internship.id,
        studentId: student.id,
      });

      expect(result.status).toBe('PENDING');
      expect(result.internshipId).toBe(internship.id);
      expect(result.studentId).toBe(student.id);
    });

    it('should throw ConflictError on duplicate application', async () => {
      const internship = await createTestInternship();
      const student = await createTestStudent({ resumeUrl: 'http://example.com/resume' });

      await internshipRepository.createApplication({
        internshipId: internship.id,
        studentId: student.id,
      });

      await expect(
        internshipRepository.createApplication({
          internshipId: internship.id,
          studentId: student.id,
        }),
      ).rejects.toThrow('already applied');
    });
  });

  // ─── findApplicationByInternshipAndStudent ─────────────────

  describe('findApplicationByInternshipAndStudent', () => {
    it('should find an existing application', async () => {
      const internship = await createTestInternship();
      const student = await createTestStudent({ resumeUrl: 'http://example.com/resume' });
      const app = await internshipRepository.createApplication({
        internshipId: internship.id,
        studentId: student.id,
      });

      const found = await internshipRepository.findApplicationByInternshipAndStudent(
        internship.id,
        student.id,
      );

      expect(found).not.toBeNull();
      expect(found!.id).toBe(app.id);
    });

    it('should return null when no application exists', async () => {
      const internship = await createTestInternship();
      const NOT_A_STUDENT = 'f47ac10b-58cc-4372-a567-0e02b2c3d479';

      const found = await internshipRepository.findApplicationByInternshipAndStudent(
        internship.id,
        NOT_A_STUDENT,
      );

      expect(found).toBeNull();
    });
  });

  // ─── countAcceptedApplications ────────────────────────────

  describe('countAcceptedApplications', () => {
    it('should count ACCEPTED applications for an internship', async () => {
      const internship = await createTestInternship();
      const student = await createTestStudent({ resumeUrl: 'http://example.com/resume' });

      // Create an application and update it to ACCEPTED
      const app = await internshipRepository.createApplication({
        internshipId: internship.id,
        studentId: student.id,
      });
      const { getPrisma } = await import('../../../test/setup.js');
      await getPrisma().application.update({
        where: { id: app.id },
        data: { status: 'ACCEPTED' },
      });

      const count = await internshipRepository.countAcceptedApplications(internship.id);
      expect(count).toBe(1);
    });

    it('should return 0 when no ACCEPTED applications', async () => {
      const internship = await createTestInternship();

      const count = await internshipRepository.countAcceptedApplications(internship.id);
      expect(count).toBe(0);
    });
  });
});
