// ─────────────────────────────────────────────────────────────
// School Repository — Unit Tests
// Tests all school.repository.ts queries against the test database.
// ─────────────────────────────────────────────────────────────

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import {
  truncateAllTables,
  disconnectPrisma,
  getPrisma,
} from '../../../test/setup.js';
import { createTestUser } from '../../../test/factories/user.factory.js';
import { createTestSchool } from '../../../test/factories/school.factory.js';
import { createTestStudent } from '../../../test/factories/student.factory.js';
import * as schoolRepository from '../school.repository.js';

describe('SchoolRepository', () => {
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
    it('should return the school with user relation and student count', async () => {
      const school = await createTestSchool();

      const result = await schoolRepository.findById(school.id);

      expect(result).not.toBeNull();
      expect(result!.id).toBe(school.id);
      expect(result!.name).toBe(school.name);
      expect(result!.user).toBeDefined();
      expect(result!.user.email).toBeDefined();
      expect(result!._count).toBeDefined();
      expect(typeof result!._count.students).toBe('number');
    });

    it('should exclude soft-deleted schools', async () => {
      const school = await createTestSchool();
      await getPrisma().school.update({
        where: { id: school.id },
        data: { deletedAt: new Date() },
      });

      const result = await schoolRepository.findById(school.id);
      expect(result).toBeNull();
    });

    it('should return null when school does not exist', async () => {
      const result = await schoolRepository.findById('f47ac10b-58cc-4372-a567-0e02b2c3d479');
      expect(result).toBeNull();
    });
  });

  // ─── findByUserId ─────────────────────────────────────────

  describe('findByUserId', () => {
    it('should return the school by user ID', async () => {
      const user = await createTestUser({ role: 'SCHOOL' });
      const school = await createTestSchool({ userId: user.id });

      const result = await schoolRepository.findByUserId(user.id);

      expect(result).not.toBeNull();
      expect(result!.id).toBe(school.id);
    });

    it('should return null when no school for that user', async () => {
      const user = await createTestUser({ role: 'SCHOOL' });
      const result = await schoolRepository.findByUserId(user.id);
      expect(result).toBeNull();
    });
  });

  // ─── findByName ───────────────────────────────────────────

  describe('findByName', () => {
    it('should find a school by exact name', async () => {
      const school = await createTestSchool({ name: 'Unique School Name' });

      const result = await schoolRepository.findByName('Unique School Name');

      expect(result).not.toBeNull();
      expect(result!.id).toBe(school.id);
    });

    it('should return null when name not found', async () => {
      const result = await schoolRepository.findByName('NonExistentSchool');
      expect(result).toBeNull();
    });
  });

  // ─── findAll ──────────────────────────────────────────────

  describe('findAll', () => {
    it('should paginate correctly', async () => {
      for (let i = 0; i < 5; i++) {
        await createTestSchool();
      }

      const page1 = await schoolRepository.findAll({ page: 1, pageSize: 3 });
      expect(page1.length).toBe(3);

      const page2 = await schoolRepository.findAll({ page: 2, pageSize: 3 });
      expect(page2.length).toBe(2);
    });

    it('should search by name (case-insensitive)', async () => {
      await createTestSchool({ name: 'SearchTarget Academy' });
      await createTestSchool({ name: 'Other Academy' });

      const results = await schoolRepository.findAll({
        page: 1,
        pageSize: 10,
        search: 'searchtarget',
      });
      expect(results.length).toBe(1);
      expect(results[0].name).toBe('SearchTarget Academy');
    });

    it('should filter by city', async () => {
      await createTestSchool({ city: 'Addis Ababa', name: 'AA School' });
      await createTestSchool({ city: 'Bahir Dar', name: 'BD School' });

      const results = await schoolRepository.findAll({
        page: 1,
        pageSize: 10,
        city: 'Bahir Dar',
      });
      expect(results.length).toBe(1);
      expect(results[0].city).toBe('Bahir Dar');
    });

    it('should filter by type', async () => {
      await createTestSchool({ type: 'PUBLIC', name: 'Public School' });
      await createTestSchool({ type: 'PRIVATE', name: 'Private School' });

      const results = await schoolRepository.findAll({
        page: 1,
        pageSize: 10,
        type: 'PRIVATE',
      });
      expect(results.length).toBe(1);
      expect(results[0].type).toBe('PRIVATE');
    });

    it('should sort by name ascending (default)', async () => {
      await createTestSchool({ name: 'Zeta School' });
      await createTestSchool({ name: 'Alpha School' });

      const results = await schoolRepository.findAll({
        page: 1,
        pageSize: 10,
        sort: 'name',
        order: 'asc',
      });
      expect(results[0].name).toBe('Alpha School');
    });

    it('should return empty array when no matches', async () => {
      const results = await schoolRepository.findAll({
        page: 1,
        pageSize: 10,
        search: 'NoMatchPossible123',
      });
      expect(results).toEqual([]);
    });
  });

  // ─── count ────────────────────────────────────────────────

  describe('count', () => {
    it('should return correct total', async () => {
      await createTestSchool();
      await createTestSchool();

      const total = await schoolRepository.count({ page: 1, pageSize: 10 });
      expect(total).toBe(2);
    });
  });

  // ─── create ───────────────────────────────────────────────

  describe('create', () => {
    it('should create a school with all fields', async () => {
      const user = await createTestUser({ role: 'SCHOOL' });

      const result = await schoolRepository.create({
        userId: user.id,
        name: 'New Test School',
        type: 'PUBLIC',
        city: 'Addis Ababa',
        gradesOffered: [9, 10, 11, 12],
      });

      expect(result.name).toBe('New Test School');
      expect(result.type).toBe('PUBLIC');
      expect(result.city).toBe('Addis Ababa');
      expect(result.gradesOffered).toEqual([9, 10, 11, 12]);
    });
  });

  // ─── update ───────────────────────────────────────────────

  describe('update', () => {
    it('should update school fields', async () => {
      const school = await createTestSchool();

      const result = await schoolRepository.update(school.id, {
        name: 'Updated School Name',
        type: 'PRIVATE',
      });

      expect(result.name).toBe('Updated School Name');
      expect(result.type).toBe('PRIVATE');
    });
  });

  // ─── findStudentForVerification ───────────────────────────

  describe('findStudentForVerification', () => {
    it('should find a student by ID for verification', async () => {
      const student = await createTestStudent();

      const result = await schoolRepository.findStudentForVerification(student.id);

      expect(result).not.toBeNull();
      expect(result!.id).toBe(student.id);
      expect(result!.isSchoolVerified).toBe(false);
    });

    it('should return null for non-existent student', async () => {
      const result = await schoolRepository.findStudentForVerification(
        'f47ac10b-58cc-4372-a567-0e02b2c3d479',
      );
      expect(result).toBeNull();
    });
  });

  // ─── updateStudentVerification ────────────────────────────

  describe('updateStudentVerification', () => {
    it('should verify a student', async () => {
      const student = await createTestStudent();

      const result = await schoolRepository.updateStudentVerification(student.id, {
        isSchoolVerified: true,
      });

      expect(result.isSchoolVerified).toBe(true);
    });

    it('should revoke verification', async () => {
      const student = await createTestStudent({ isSchoolVerified: true });

      const result = await schoolRepository.updateStudentVerification(student.id, {
        isSchoolVerified: false,
      });

      expect(result.isSchoolVerified).toBe(false);
    });
  });

  // ─── createAuditLog ───────────────────────────────────────

  describe('createAuditLog', () => {
    it('should create an audit log entry', async () => {
      const user = await createTestUser({ role: 'SCHOOL' });

      const result = await schoolRepository.createAuditLog({
        userId: user.id,
        action: 'VERIFY_STUDENT',
        entity: 'STUDENT',
        entityId: 'test-student-id',
        oldValue: { isSchoolVerified: false },
        newValue: { isSchoolVerified: true },
      });

      expect(result.userId).toBe(user.id);
      expect(result.action).toBe('VERIFY_STUDENT');
      expect(result.entity).toBe('STUDENT');
    });
  });

  // ─── countVerifiedStudentsBySchoolIds ─────────────────────

  describe('countVerifiedStudentsBySchoolIds', () => {
    it('should count verified students for given school IDs', async () => {
      const school1 = await createTestSchool();
      const school2 = await createTestSchool();

      // Create verified students for school1
      await createTestStudent({ schoolId: school1.id, isSchoolVerified: true });
      await createTestStudent({ schoolId: school1.id, isSchoolVerified: true });
      // Non-verified for school1
      await createTestStudent({ schoolId: school1.id, isSchoolVerified: false });
      // Verified for school2
      await createTestStudent({ schoolId: school2.id, isSchoolVerified: true });

      const map = await schoolRepository.countVerifiedStudentsBySchoolIds([school1.id, school2.id]);

      expect(map.get(school1.id)).toBe(2);
      expect(map.get(school2.id)).toBe(1);
    });

    it('should return empty map for empty input', async () => {
      const map = await schoolRepository.countVerifiedStudentsBySchoolIds([]);
      expect(map.size).toBe(0);
    });
  });
});
