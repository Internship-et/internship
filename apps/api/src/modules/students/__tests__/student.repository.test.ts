// ─────────────────────────────────────────────────────────────
// Student Repository — Unit Tests
// Tests all student.repository.ts queries against the test database.
// ─────────────────────────────────────────────────────────────

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import {
  truncateAllTables,
  disconnectPrisma,
} from '../../../test/setup.js';
import { createTestUser } from '../../../test/factories/user.factory.js';
import { createTestStudent } from '../../../test/factories/student.factory.js';
import { createTestSchool } from '../../../test/factories/school.factory.js';
import * as studentRepository from '../student.repository.js';

describe('StudentRepository', () => {
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
    it('should return the student with user and school relations', async () => {
      const school = await createTestSchool();
      const student = await createTestStudent({ schoolId: school.id });

      const result = await studentRepository.findById(student.id);

      expect(result).not.toBeNull();
      expect(result!.id).toBe(student.id);
      expect(result!.user).toBeDefined();
      expect(result!.user.email).toBeDefined();
      expect(result!.school).toBeDefined();
      expect(result!.school!.id).toBe(school.id);
    });

    it('should return null when student does not exist', async () => {
      const result = await studentRepository.findById('f47ac10b-58cc-4372-a567-0e02b2c3d479');
      expect(result).toBeNull();
    });
  });

  // ─── findByUserId ─────────────────────────────────────────

  describe('findByUserId', () => {
    it('should return the student by user ID', async () => {
      const user = await createTestUser({ role: 'STUDENT' });
      const student = await createTestStudent({ userId: user.id });

      const result = await studentRepository.findByUserId(user.id);

      expect(result).not.toBeNull();
      expect(result!.id).toBe(student.id);
      expect(result!.userId).toBe(user.id);
    });

    it('should return null when no student exists for that user ID', async () => {
      const user = await createTestUser({ role: 'STUDENT' });
      // No student profile created
      const result = await studentRepository.findByUserId(user.id);
      expect(result).toBeNull();
    });
  });

  // ─── findAll ──────────────────────────────────────────────

  describe('findAll', () => {
    it('should paginate correctly', async () => {
      // Create 5 students
      for (let i = 0; i < 5; i++) {
        await createTestStudent();
      }

      const page1 = await studentRepository.findAll({
        page: 1,
        pageSize: 3,
      });
      expect(page1.length).toBe(3);

      const page2 = await studentRepository.findAll({
        page: 2,
        pageSize: 3,
      });
      expect(page2.length).toBe(2);
    });

    it('should search by firstName (case-insensitive)', async () => {
      await createTestStudent({ grade: 10, resumeUrl: 'http://example.com/resume1' });
      await createTestStudent({ grade: 11, resumeUrl: 'http://example.com/resume2' });

      // The students were created by factory with firstName 'Student'
      const results = await studentRepository.findAll({
        page: 1,
        pageSize: 10,
        search: 'student',
      });
      expect(results.length).toBeGreaterThanOrEqual(2);
    });

    it('should filter by grade', async () => {
      // Create students with different grades
      const user1 = await createTestUser({ role: 'STUDENT' });
      await createTestStudent({ userId: user1.id, grade: 10, resumeUrl: 'http://example.com/r1' });
      const user2 = await createTestUser({ role: 'STUDENT' });
      await createTestStudent({ userId: user2.id, grade: 11, resumeUrl: 'http://example.com/r2' });

      const results = await studentRepository.findAll({
        page: 1,
        pageSize: 10,
        grade: 10,
      });

      expect(results.length).toBe(1);
      expect(results[0].grade).toBe(10);
    });

    it('should sort by firstName ascending', async () => {
      const userA = await createTestUser({ role: 'STUDENT', firstName: 'Alpha' });
      await createTestStudent({ userId: userA.id });
      const userB = await createTestUser({ role: 'STUDENT', firstName: 'Beta' });
      await createTestStudent({ userId: userB.id });

      const results = await studentRepository.findAll({
        page: 1,
        pageSize: 10,
        sort: 'firstName',
        order: 'asc',
      });

      expect(results.length).toBeGreaterThanOrEqual(2);
      expect(results[0].user.firstName).toBe('Alpha');
    });

    it('should return empty array when no matches', async () => {
      const results = await studentRepository.findAll({
        page: 1,
        pageSize: 10,
        search: 'NoMatchPossible12345',
      });
      expect(results).toEqual([]);
    });
  });

  // ─── count ────────────────────────────────────────────────

  describe('count', () => {
    it('should match the paginated results count', async () => {
      await createTestStudent();
      await createTestStudent();
      await createTestStudent();

      const total = await studentRepository.count({
        page: 1,
        pageSize: 10,
      });
      expect(total).toBe(3);
    });

    it('should return 0 when no matching students', async () => {
      const total = await studentRepository.count({
        page: 1,
        pageSize: 10,
        grade: 99,
      });
      expect(total).toBe(0);
    });
  });

  // ─── create ───────────────────────────────────────────────

  describe('create', () => {
    it('should create a student with all fields', async () => {
      const user = await createTestUser({ role: 'STUDENT' });

      const result = await studentRepository.create({
        userId: user.id,
        grade: 11,
        bio: 'Test bio',
        skills: ['JavaScript', 'Python'],
        interests: ['Coding', 'Sports'],
        languages: ['English', 'Amharic'],
      });

      expect(result.userId).toBe(user.id);
      expect(result.grade).toBe(11);
      expect(result.bio).toBe('Test bio');
      expect(result.skills).toEqual(['JavaScript', 'Python']);
      expect(result.interests).toEqual(['Coding', 'Sports']);
      expect(result.languages).toEqual(['English', 'Amharic']);
    });
  });

  // ─── update ───────────────────────────────────────────────

  describe('update', () => {
    it('should update student-specific fields', async () => {
      const student = await createTestStudent();

      const result = await studentRepository.update(student.id, {
        grade: 12,
        bio: 'Updated bio',
        skills: ['TypeScript'],
      });

      expect(result.grade).toBe(12);
      expect(result.bio).toBe('Updated bio');
      expect(result.skills).toEqual(['TypeScript']);
    });
  });

  // ─── findApplicationsByStudentId ──────────────────────────

  describe('findApplicationsByStudentId', () => {
    it('should return applications for a student', async () => {
      const student = await createTestStudent({ resumeUrl: 'http://example.com/resume' });
      const { createTestInternship } = await import('../../../test/factories/internship.factory.js');
      const internship = await createTestInternship();
      const { createTestApplication } = await import('../../../test/factories/application.factory.js');
      await createTestApplication({ studentId: student.id, internshipId: internship.id });

      const results = await studentRepository.findApplicationsByStudentId(student.id, {
        page: 1,
        pageSize: 10,
      });

      expect(results.length).toBe(1);
      expect(results[0].studentId).toBe(student.id);
    });

    it('should return empty array when no applications', async () => {
      const student = await createTestStudent();

      const results = await studentRepository.findApplicationsByStudentId(student.id, {
        page: 1,
        pageSize: 10,
      });

      expect(results).toEqual([]);
    });
  });

  // ─── countApplicationsByStudentId ─────────────────────────

  describe('countApplicationsByStudentId', () => {
    it('should return correct count', async () => {
      const student = await createTestStudent({ resumeUrl: 'http://example.com/resume' });
      const { createTestInternship } = await import('../../../test/factories/internship.factory.js');
      const internship = await createTestInternship();
      const { createTestApplication } = await import('../../../test/factories/application.factory.js');
      await createTestApplication({ studentId: student.id, internshipId: internship.id });

      const count = await studentRepository.countApplicationsByStudentId(student.id, {
        page: 1,
        pageSize: 10,
      });

      expect(count).toBe(1);
    });
  });

  // ─── upsertUserAndStudent ─────────────────────────────────

  describe('upsertUserAndStudent', () => {
    it('should create a user and student in a transaction', async () => {
      const user = await createTestUser({ role: 'STUDENT' });

      const result = await studentRepository.upsertUserAndStudent(
        user.id,
        { firstName: 'UpdatedFirst' },
        { grade: 10, bio: 'New student', skills: ['Math'] },
      );

      expect(result.userId).toBe(user.id);
      expect(result.grade).toBe(10);
      expect(result.bio).toBe('New student');
      expect(result.user.firstName).toBe('UpdatedFirst');
    });

    it('should update an existing student (upsert update path)', async () => {
      const user = await createTestUser({ role: 'STUDENT' });
      // First create
      await studentRepository.upsertUserAndStudent(
        user.id,
        {},
        { grade: 9, bio: 'Initial' },
      );

      // Then upsert again (update path)
      const result = await studentRepository.upsertUserAndStudent(
        user.id,
        {},
        { grade: 10, bio: 'Updated' },
      );

      expect(result.grade).toBe(10);
      expect(result.bio).toBe('Updated');
    });
  });
});
