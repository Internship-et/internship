// ─────────────────────────────────────────────────────────────
// Auth Repository — Unit Tests
// Tests all auth.repository.ts queries against the test database.
// ─────────────────────────────────────────────────────────────

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import {
  truncateAllTables,
  disconnectPrisma,
} from '../../../test/setup.js';
import { createTestUser } from '../../../test/factories/user.factory.js';
import * as authRepository from '../auth.repository.js';

describe('AuthRepository', () => {
  beforeAll(async () => {
    // global-setup.ts already ran migrations; nothing extra needed.
  });

  afterAll(async () => {
    await disconnectPrisma();
  });

  beforeEach(async () => {
    await truncateAllTables();
  });

  // ─── findByEmail ──────────────────────────────────────────

  describe('findByEmail', () => {
    it('should return the full user record when email exists', async () => {
      const user = await createTestUser({
        email: 'findbyemail-test@example.com',
      });

      const result = await authRepository.findByEmail('findbyemail-test@example.com');

      expect(result).not.toBeNull();
      expect(result!.id).toBe(user.id);
      expect(result!.email).toBe('findbyemail-test@example.com');
      // passwordHash should be included
      expect(result!.passwordHash).toBeDefined();
      expect(typeof result!.passwordHash).toBe('string');
    });

    it('should return null when email does not exist', async () => {
      const result = await authRepository.findByEmail('nonexistent@example.com');
      expect(result).toBeNull();
    });

    it('should return null when user is soft-deleted', async () => {
      await createTestUser({
        email: 'deleted-user@example.com',
      });
      // Soft-delete the user directly
      const { getPrisma } = await import('../../../test/setup.js');
      const prisma = getPrisma();
      await prisma.user.update({
        where: { email: 'deleted-user@example.com' },
        data: { deletedAt: new Date() },
      });

      const result = await authRepository.findByEmail('deleted-user@example.com');
      expect(result).toBeNull();
    });
  });

  // ─── findById ─────────────────────────────────────────────

  describe('findById', () => {
    it('should return the user without passwordHash when found', async () => {
      const user = await createTestUser();

      const result = await authRepository.findById(user.id);

      expect(result).not.toBeNull();
      expect(result!.id).toBe(user.id);
      expect(result!.email).toBeDefined();
      // passwordHash must NOT be included
      expect((result as Record<string, unknown>).passwordHash).toBeUndefined();
    });

    it('should return null when user does not exist', async () => {
      const result = await authRepository.findById('f47ac10b-58cc-4372-a567-0e02b2c3d479');
      expect(result).toBeNull();
    });
  });

  // ─── create ───────────────────────────────────────────────

  describe('create', () => {
    it('should create a new user with PENDING status and isVerified false', async () => {
      const result = await authRepository.create({
        email: 'new-user@example.com',
        passwordHash: '$2b$10$testhash',
        firstName: 'New',
        lastName: 'User',
        role: 'STUDENT',
      });

      expect(result).not.toBeNull();
      expect(result.email).toBe('new-user@example.com');
      expect(result.firstName).toBe('New');
      expect(result.lastName).toBe('User');
      expect(result.role).toBe('STUDENT');
      expect(result.status).toBe('PENDING');
      expect(result.isVerified).toBe(false);
    });

    it('should create a user with optional phone', async () => {
      const result = await authRepository.create({
        email: 'user-with-phone@example.com',
        passwordHash: '$2b$10$testhash',
        firstName: 'Phone',
        lastName: 'User',
        role: 'COMPANY',
        phone: '+251911111111',
      });

      expect(result.phone).toBe('+251911111111');
    });
  });

  // ─── updatePassword ───────────────────────────────────────

  describe('updatePassword', () => {
    it('should update the password hash', async () => {
      const user = await createTestUser();

      await authRepository.updatePassword(user.id, '$2b$10$newhash');

      // Verify by reading raw from DB
      const { getPrisma } = await import('../../../test/setup.js');
      const prisma = getPrisma();
      const updated = await prisma.user.findUnique({
        where: { id: user.id },
        select: { passwordHash: true },
      });
      expect(updated!.passwordHash).toBe('$2b$10$newhash');
    });
  });

  // ─── updateLastLogin ─────────────────────────────────────

  describe('updateLastLogin', () => {
    it('should set lastLoginAt to a Date', async () => {
      const user = await createTestUser();

      await authRepository.updateLastLogin(user.id);

      const { getPrisma } = await import('../../../test/setup.js');
      const prisma = getPrisma();
      const updated = await prisma.user.findUnique({
        where: { id: user.id },
        select: { lastLoginAt: true },
      });
      expect(updated!.lastLoginAt).toBeInstanceOf(Date);
    });
  });

  // ─── updateProfile ────────────────────────────────────────

  describe('updateProfile', () => {
    it('should update firstName, lastName, and phone', async () => {
      const user = await createTestUser({
        firstName: 'Original',
        lastName: 'Name',
        phone: null,
      });

      const result = await authRepository.updateProfile(user.id, {
        firstName: 'Updated',
        lastName: 'Profile',
        phone: '+251922222222',
      });

      expect(result.firstName).toBe('Updated');
      expect(result.lastName).toBe('Profile');
      expect(result.phone).toBe('+251922222222');
    });

    it('should handle partial updates', async () => {
      const user = await createTestUser({
        firstName: 'Original',
      });

      const result = await authRepository.updateProfile(user.id, {
        firstName: 'OnlyFirstName',
      });

      expect(result.firstName).toBe('OnlyFirstName');
      expect(result.lastName).toBeDefined(); // unchanged
    });

    it('should return the updated user without passwordHash', async () => {
      const user = await createTestUser();

      const result = await authRepository.updateProfile(user.id, {
        firstName: 'NoHash',
      });

      expect(result.id).toBe(user.id);
      expect((result as Record<string, unknown>).passwordHash).toBeUndefined();
    });
  });
});
