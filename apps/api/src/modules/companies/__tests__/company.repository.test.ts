// ─────────────────────────────────────────────────────────────
// Company Repository — Unit Tests
// Tests all company.repository.ts queries against the test database.
// ─────────────────────────────────────────────────────────────

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import {
  truncateAllTables,
  disconnectPrisma,
  getPrisma,
} from '../../../test/setup.js';
import { createTestUser } from '../../../test/factories/user.factory.js';
import { createTestCompany } from '../../../test/factories/company.factory.js';
import { createTestInternship } from '../../../test/factories/internship.factory.js';
import * as companyRepository from '../company.repository.js';

describe('CompanyRepository', () => {
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
    it('should return the company with user relation and internships', async () => {
      const company = await createTestCompany();

      const result = await companyRepository.findById(company.id);

      expect(result).not.toBeNull();
      expect(result!.id).toBe(company.id);
      expect(result!.name).toBe(company.name);
      expect(result!.user).toBeDefined();
      expect(result!.user.email).toBeDefined();
      expect(Array.isArray(result!.internships)).toBe(true);
    });

    it('should return null when company does not exist', async () => {
      const result = await companyRepository.findById('f47ac10b-58cc-4372-a567-0e02b2c3d479');
      expect(result).toBeNull();
    });

    it('should exclude soft-deleted companies', async () => {
      const company = await createTestCompany();
      // Soft-delete
      await getPrisma().company.update({
        where: { id: company.id },
        data: { deletedAt: new Date() },
      });

      const result = await companyRepository.findById(company.id);
      expect(result).toBeNull();
    });
  });

  // ─── findByUserId ─────────────────────────────────────────

  describe('findByUserId', () => {
    it('should return the company by user ID', async () => {
      const user = await createTestUser({ role: 'COMPANY' });
      const company = await createTestCompany({ userId: user.id });

      const result = await companyRepository.findByUserId(user.id);

      expect(result).not.toBeNull();
      expect(result!.id).toBe(company.id);
    });

    it('should return null when no company for that user', async () => {
      const user = await createTestUser({ role: 'COMPANY' });
      const result = await companyRepository.findByUserId(user.id);
      expect(result).toBeNull();
    });
  });

  // ─── findByName ───────────────────────────────────────────

  describe('findByName', () => {
    it('should find a company by exact name', async () => {
      const company = await createTestCompany({ name: 'UniqueName Inc' });

      const result = await companyRepository.findByName('UniqueName Inc');

      expect(result).not.toBeNull();
      expect(result!.id).toBe(company.id);
    });

    it('should return null when name not found', async () => {
      const result = await companyRepository.findByName('NonExistentCompany');
      expect(result).toBeNull();
    });
  });

  // ─── findByTinNumber ──────────────────────────────────────

  describe('findByTinNumber', () => {
    it('should find a company by TIN number', async () => {
      const company = await createTestCompany({ tinNumber: 'TIN-UNIQUE-001' });

      const result = await companyRepository.findByTinNumber('TIN-UNIQUE-001');

      expect(result).not.toBeNull();
      expect(result!.id).toBe(company.id);
    });

    it('should return null when TIN not found', async () => {
      const result = await companyRepository.findByTinNumber('TIN-NONEXISTENT');
      expect(result).toBeNull();
    });
  });

  // ─── findAll ──────────────────────────────────────────────

  describe('findAll', () => {
    it('should paginate correctly', async () => {
      for (let i = 0; i < 5; i++) {
        await createTestCompany();
      }

      const page1 = await companyRepository.findAll({ page: 1, pageSize: 3 });
      expect(page1.length).toBe(3);

      const page2 = await companyRepository.findAll({ page: 2, pageSize: 3 });
      expect(page2.length).toBe(2);
    });

    it('should search by name (case-insensitive)', async () => {
      await createTestCompany({ name: 'SearchTarget Corp' });
      await createTestCompany({ name: 'Other Corp' });

      const results = await companyRepository.findAll({
        page: 1,
        pageSize: 10,
        search: 'searchtarget',
      });
      expect(results.length).toBe(1);
      expect(results[0].name).toBe('SearchTarget Corp');
    });

    it('should filter by industry', async () => {
      await createTestCompany({ industry: 'Healthcare', name: 'Health Inc' });
      await createTestCompany({ industry: 'Technology', name: 'Tech Inc' });

      const results = await companyRepository.findAll({
        page: 1,
        pageSize: 10,
        industry: 'Healthcare',
      });
      expect(results.length).toBe(1);
      expect(results[0].industry).toBe('Healthcare');
    });

    it('should filter by city', async () => {
      await createTestCompany({ city: 'Addis Ababa', name: 'AA Corp' });
      await createTestCompany({ city: 'Bahir Dar', name: 'BD Corp' });

      const results = await companyRepository.findAll({
        page: 1,
        pageSize: 10,
        city: 'Bahir Dar',
      });
      expect(results.length).toBe(1);
      expect(results[0].city).toBe('Bahir Dar');
    });

    it('should sort by name ascending', async () => {
      await createTestCompany({ name: 'Beta Corp' });
      await createTestCompany({ name: 'Alpha Corp' });

      const results = await companyRepository.findAll({
        page: 1,
        pageSize: 10,
        sort: 'name',
        order: 'asc',
      });
      expect(results[0].name).toBe('Alpha Corp');
    });

    it('should return empty array when no matches', async () => {
      const results = await companyRepository.findAll({
        page: 1,
        pageSize: 10,
        search: 'NoMatchPossible123',
      });
      expect(results).toEqual([]);
    });
  });

  // ─── count ────────────────────────────────────────────────

  describe('count', () => {
    it('should return correct total count', async () => {
      await createTestCompany();
      await createTestCompany();

      const total = await companyRepository.count({ page: 1, pageSize: 10 });
      expect(total).toBe(2);
    });
  });

  // ─── create ───────────────────────────────────────────────

  describe('create', () => {
    it('should create a company with all fields', async () => {
      const user = await createTestUser({ role: 'COMPANY' });

      const result = await companyRepository.create({
        userId: user.id,
        name: 'New Test Company',
        industry: 'Education',
        city: 'Addis Ababa',
        description: 'An education company',
        size: 'MEDIUM',
      });

      expect(result.name).toBe('New Test Company');
      expect(result.industry).toBe('Education');
      expect(result.city).toBe('Addis Ababa');
      expect(result.size).toBe('MEDIUM');
    });
  });

  // ─── update ───────────────────────────────────────────────

  describe('update', () => {
    it('should update company fields', async () => {
      const company = await createTestCompany();

      const result = await companyRepository.update(company.id, {
        name: 'Updated Name',
        industry: 'Healthcare',
      });

      expect(result.name).toBe('Updated Name');
      expect(result.industry).toBe('Healthcare');
    });
  });

  // ─── findInternshipsByCompanyId ───────────────────────────

  describe('findInternshipsByCompanyId', () => {
    it('should return ACTIVE internships only', async () => {
      const company = await createTestCompany();
      await createTestInternship({ companyId: company.id, status: 'ACTIVE', title: 'Active Intern' });
      await createTestInternship({ companyId: company.id, status: 'DRAFT', title: 'Draft Intern' });

      const results = await companyRepository.findInternshipsByCompanyId(company.id, {
        page: 1,
        pageSize: 10,
      });

      expect(results.length).toBe(1);
      expect(results[0].title).toBe('Active Intern');
    });

    it('should return empty array when no ACTIVE internships', async () => {
      const company = await createTestCompany();
      // Only DRAFT internships
      await createTestInternship({ companyId: company.id, status: 'DRAFT' });

      const results = await companyRepository.findInternshipsByCompanyId(company.id, {
        page: 1,
        pageSize: 10,
      });

      expect(results.length).toBe(0);
    });
  });

  // ─── countInternshipsByCompanyId ──────────────────────────

  describe('countInternshipsByCompanyId', () => {
    it('should count ACTIVE internships', async () => {
      const company = await createTestCompany();
      await createTestInternship({ companyId: company.id, status: 'ACTIVE' });
      await createTestInternship({ companyId: company.id, status: 'DRAFT' });

      const count = await companyRepository.countInternshipsByCompanyId(company.id, {
        page: 1,
        pageSize: 10,
      });

      expect(count).toBe(1);
    });
  });

  // ─── findApplicationsByCompanyId ─────────────────────────

  describe('findApplicationsByCompanyId', () => {
    it('should return applications scoped to company', async () => {
      const company = await createTestCompany();
      const internship = await createTestInternship({ companyId: company.id });
      const { createTestApplication } = await import('../../../test/factories/application.factory.js');
      await createTestApplication({ internshipId: internship.id });

      const results = await companyRepository.findApplicationsByCompanyId(company.id, {
        page: 1,
        pageSize: 10,
      });

      expect(results.length).toBe(1);
      expect(results[0].internship.companyId).toBe(company.id);
    });
  });

  // ─── countApplicationsByCompanyId ─────────────────────────

  describe('countApplicationsByCompanyId', () => {
    it('should count applications scoped to company', async () => {
      const company = await createTestCompany();
      const internship = await createTestInternship({ companyId: company.id });
      const { createTestApplication } = await import('../../../test/factories/application.factory.js');
      await createTestApplication({ internshipId: internship.id });

      const count = await companyRepository.countApplicationsByCompanyId(company.id, {
        page: 1,
        pageSize: 10,
      });

      expect(count).toBe(1);
    });
  });
});
