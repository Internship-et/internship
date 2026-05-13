// ─────────────────────────────────────────────────────────────
// Auth Service — Unit Tests
// Mocks repository, bcrypt, Redis, and token utilities.
// Tests cover all auth operations with various edge cases.
// ─────────────────────────────────────────────────────────────

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  AppError,
  ConflictError,
  NotFoundError,
  UnauthorizedError,
} from '../../../shared/errors/app-error.js';

// ─── Mocks (must be before imports) ─────────────────────────

// Mock bcrypt
vi.mock('bcrypt', () => ({
  default: {
    hash: vi.fn(),
    compare: vi.fn(),
  },
  hash: vi.fn(),
  compare: vi.fn(),
}));

// Mock Redis (use vi.hoisted to avoid hoisting issues)
const mockRedis = vi.hoisted(() => ({
  get: vi.fn(),
  setex: vi.fn(),
  del: vi.fn(),
  incr: vi.fn(),
  expire: vi.fn(),
  zadd: vi.fn(),
  zrange: vi.fn(),
  zrem: vi.fn(),
  zremrangebyrank: vi.fn(),
  pipeline: vi.fn(() => ({
    del: vi.fn().mockReturnThis(),
    zrem: vi.fn().mockReturnThis(),
    zremrangebyrank: vi.fn().mockReturnThis(),
    exec: vi.fn().mockResolvedValue([]),
  })),
}));

vi.mock('../../../shared/lib/redis.js', () => ({
  default: mockRedis,
  redis: mockRedis,
}));

// Mock token utilities
vi.mock('../../../shared/utils/token.js', () => ({
  generateTokenPair: vi.fn(),
  verifyToken: vi.fn(),
  hashToken: vi.fn(),
}));

// Mock logger
vi.mock('../../../shared/lib/logger.js', () => ({
  default: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
  createRequestLogger: vi.fn(),
}));

// Mock repository
vi.mock('../auth.repository.js', () => ({}));

// ─── Imports ────────────────────────────────────────────────

import bcrypt from 'bcrypt';
import * as authService from '../auth.service.js';
import * as authRepository from '../auth.repository.js';
import * as tokenUtils from '../../../shared/utils/token.js';

// ─── Fixtures ──────────────────────────────────────────────

const mockUser = {
  id: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
  email: 'test@example.com',
  passwordHash: '$2b$10$hashedpassword',
  firstName: 'Test',
  lastName: 'User',
  role: 'STUDENT',
  phone: '+251911111111',
  status: 'ACTIVE',
  isVerified: true,
  createdAt: new Date('2025-01-01'),
  updatedAt: new Date('2025-01-15'),
  lastLoginAt: null,
};

const mockUserWithoutPassword = {
  id: mockUser.id,
  email: mockUser.email,
  firstName: mockUser.firstName,
  lastName: mockUser.lastName,
  role: mockUser.role,
  phone: mockUser.phone,
  status: mockUser.status,
  isVerified: mockUser.isVerified,
  createdAt: mockUser.createdAt,
  updatedAt: mockUser.updatedAt,
  lastLoginAt: mockUser.lastLoginAt,
};

const mockTokenPair = {
  accessToken: 'access-token-value',
  refreshToken: 'refresh-token-value',
  expiresIn: 900,
};

const mockCreateUserData = {
  id: mockUser.id,
  email: mockUser.email,
  firstName: mockUser.firstName,
  lastName: mockUser.lastName,
  role: mockUser.role as 'STUDENT',
  phone: mockUser.phone,
  status: 'PENDING' as const,
  isVerified: false,
  createdAt: mockUser.createdAt,
};

// ─── Mock implementations ──────────────────────────────────

const mockFindByEmail = vi.fn();
const mockFindById = vi.fn();
const mockCreate = vi.fn();
const mockUpdatePassword = vi.fn();
const mockUpdateLastLogin = vi.fn();
const mockUpdateProfile = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();

  vi.mocked(authRepository).findByEmail = mockFindByEmail;
  vi.mocked(authRepository).findById = mockFindById;
  vi.mocked(authRepository).create = mockCreate;
  vi.mocked(authRepository).updatePassword = mockUpdatePassword;
  vi.mocked(authRepository).updateLastLogin = mockUpdateLastLogin;
  vi.mocked(authRepository).updateProfile = mockUpdateProfile;

  // Default token mock
  vi.mocked(tokenUtils.generateTokenPair).mockReturnValue(mockTokenPair);
  vi.mocked(tokenUtils.hashToken).mockImplementation((token) => `hashed:${token}`);

  // Reset Redis mock return values to safe defaults
  mockRedis.get.mockResolvedValue(null);
  mockRedis.zrange.mockResolvedValue([]);
  mockRedis.pipeline.mockReturnValue({
    del: vi.fn().mockReturnThis(),
    zrem: vi.fn().mockReturnThis(),
    zremrangebyrank: vi.fn().mockReturnThis(),
    exec: vi.fn().mockResolvedValue([]),
  });
});

// ─── Tests ─────────────────────────────────────────────────

describe('AuthService', () => {
  // ─── register ─────────────────────────────────────────────

  describe('register', () => {
    const registerInput = {
      email: 'new@example.com',
      password: 'Password123!',
      firstName: 'New',
      lastName: 'User',
      role: 'STUDENT' as const,
      phone: '+251911111111',
      agreeToTerms: true as const,
    };

    it('creates user and returns token pair on success', async () => {
      mockFindByEmail.mockResolvedValue(null);
      vi.mocked(bcrypt.hash).mockResolvedValue('hashed-password' as never);
      mockCreate.mockResolvedValue(mockCreateUserData);

      const result = await authService.register(registerInput);

      expect(result.user).toEqual(mockCreateUserData);
      expect(result.token).toEqual(mockTokenPair);
      expect(mockFindByEmail).toHaveBeenCalledWith('new@example.com');
      expect(bcrypt.hash).toHaveBeenCalledWith('Password123!', 10);
      expect(mockCreate).toHaveBeenCalledWith({
        email: 'new@example.com',
        passwordHash: 'hashed-password',
        firstName: 'New',
        lastName: 'User',
        role: 'STUDENT',
        phone: '+251911111111',
      });
      // Session created in Redis
      expect(mockRedis.setex).toHaveBeenCalledWith(
        expect.stringContaining('session:'),
        604800,
        expect.any(String),
      );
    });

    it('throws ConflictError when email already exists', async () => {
      mockFindByEmail.mockResolvedValue(mockUser);

      await expect(authService.register(registerInput)).rejects.toThrow(ConflictError);
      expect(mockCreate).not.toHaveBeenCalled();
    });

    it('hashes password with bcrypt cost factor 10', async () => {
      mockFindByEmail.mockResolvedValue(null);
      vi.mocked(bcrypt.hash).mockResolvedValue('hashed-password' as never);
      mockCreate.mockResolvedValue(mockCreateUserData);

      await authService.register(registerInput);

      expect(bcrypt.hash).toHaveBeenCalledWith(expect.any(String), 10);
    });

    it('creates Redis session with 7-day TTL', async () => {
      mockFindByEmail.mockResolvedValue(null);
      vi.mocked(bcrypt.hash).mockResolvedValue('hashed-password' as never);
      mockCreate.mockResolvedValue(mockCreateUserData);

      await authService.register(registerInput);

      expect(mockRedis.setex).toHaveBeenCalledWith(
        expect.stringContaining('session:'),
        604800, // 7 * 24 * 60 * 60
        expect.any(String),
      );
    });
  });

  // ─── login ────────────────────────────────────────────────

  describe('login', () => {
    const loginInput = {
      email: 'test@example.com',
      password: 'Password123!',
    };

    it('returns user and token pair on success', async () => {
      mockFindByEmail.mockResolvedValue(mockUser);
      vi.mocked(bcrypt.compare).mockResolvedValue(true as never);

      const result = await authService.login(loginInput);

      expect(result.user).toBeDefined();
      expect(result.token).toEqual(mockTokenPair);
      // passwordHash should not be in response
      expect(result.user).not.toHaveProperty('passwordHash');
    });

    it('throws UnauthorizedError for invalid credentials', async () => {
      mockFindByEmail.mockResolvedValue(null);
      vi.mocked(bcrypt.compare).mockResolvedValue(false as never);

      await expect(authService.login(loginInput)).rejects.toThrow(UnauthorizedError);
    });

    it('throws UnauthorizedError for wrong password', async () => {
      mockFindByEmail.mockResolvedValue(mockUser);
      vi.mocked(bcrypt.compare).mockResolvedValue(false as never);

      await expect(authService.login(loginInput)).rejects.toThrow(UnauthorizedError);
    });

    it('throws 403 ACCOUNT_SUSPENDED for suspended user', async () => {
      mockFindByEmail.mockResolvedValue({ ...mockUser, status: 'SUSPENDED' });
      vi.mocked(bcrypt.compare).mockResolvedValue(true as never);

      await expect(authService.login(loginInput)).rejects.toThrow(AppError);
      await expect(authService.login(loginInput)).rejects.toMatchObject({
        statusCode: 403,
        code: 'ACCOUNT_SUSPENDED',
      });
    });

    it('throws 403 ACCOUNT_NOT_VERIFIED for pending user', async () => {
      mockFindByEmail.mockResolvedValue({ ...mockUser, status: 'PENDING' });
      vi.mocked(bcrypt.compare).mockResolvedValue(true as never);

      await expect(authService.login(loginInput)).rejects.toMatchObject({
        statusCode: 403,
        code: 'ACCOUNT_NOT_VERIFIED',
      });
    });

    it('increments failed login counter on invalid credentials', async () => {
      mockFindByEmail.mockResolvedValue(null);
      vi.mocked(bcrypt.compare).mockResolvedValue(false as never);

      await expect(authService.login(loginInput)).rejects.toThrow(UnauthorizedError);

      expect(mockRedis.incr).toHaveBeenCalledWith('failed-login:test@example.com');
      expect(mockRedis.expire).toHaveBeenCalledWith('failed-login:test@example.com', 900);
    });

    it('clears failed login counter on success', async () => {
      mockFindByEmail.mockResolvedValue(mockUser);
      vi.mocked(bcrypt.compare).mockResolvedValue(true as never);

      await authService.login(loginInput);

      expect(mockRedis.del).toHaveBeenCalledWith('failed-login:test@example.com');
    });

    it('locks account after MAX_FAILED_ATTEMPTS', async () => {
      mockRedis.get.mockResolvedValue('5');

      await expect(authService.login(loginInput)).rejects.toThrow(
        'Account temporarily locked',
      );
      expect(mockFindByEmail).not.toHaveBeenCalled();
    });

    it('updates lastLoginAt on successful login', async () => {
      mockFindByEmail.mockResolvedValue(mockUser);
      vi.mocked(bcrypt.compare).mockResolvedValue(true as never);

      await authService.login(loginInput);

      expect(mockUpdateLastLogin).toHaveBeenCalledWith(mockUser.id);
    });

    it('normalizes email to lowercase', async () => {
      mockFindByEmail.mockResolvedValue(mockUser);
      vi.mocked(bcrypt.compare).mockResolvedValue(true as never);

      await authService.login({ email: 'TEST@EXAMPLE.COM', password: 'Password123!' });

      expect(mockFindByEmail).toHaveBeenCalledWith('test@example.com');
    });
  });

  // ─── refresh ──────────────────────────────────────────────

  describe('refresh', () => {
    it('returns new token pair when refresh token is valid', async () => {
      vi.mocked(tokenUtils.verifyToken).mockReturnValue({
        userId: mockUser.id,
        role: mockUser.role,
        email: mockUser.email,
        iat: Date.now() / 1000,
        exp: Date.now() / 1000 + 604800,
      });
      mockRedis.get.mockResolvedValue(JSON.stringify({
        userId: mockUser.id,
        role: mockUser.role,
        createdAt: new Date().toISOString(),
      }));

      const result = await authService.refresh('valid-refresh-token');

      expect(result).toEqual(mockTokenPair);
      // Old session removed via pipeline
      const pipelineMock = mockRedis.pipeline();
      expect(pipelineMock.del).toHaveBeenCalledWith(expect.stringContaining('session:'));
      // New session created
      expect(mockRedis.setex).toHaveBeenCalledWith(
        expect.stringContaining('session:'),
        604800,
        expect.any(String),
      );
    });

    it('throws UnauthorizedError when refresh token JWT is invalid', async () => {
      vi.mocked(tokenUtils.verifyToken).mockImplementation(() => {
        throw new UnauthorizedError('Invalid token');
      });

      await expect(authService.refresh('invalid-token')).rejects.toThrow(UnauthorizedError);
    });

    it('throws UnauthorizedError when session not in Redis', async () => {
      vi.mocked(tokenUtils.verifyToken).mockReturnValue({
        userId: mockUser.id,
        role: mockUser.role,
        email: mockUser.email,
        iat: Date.now() / 1000,
        exp: Date.now() / 1000 + 604800,
      });
      mockRedis.get.mockResolvedValue(null);

      await expect(authService.refresh('missing-session-token')).rejects.toThrow(UnauthorizedError);
    });
  });

  // ─── logout ───────────────────────────────────────────────

  describe('logout', () => {
    it('invalidates specific session when refreshToken provided', async () => {
      vi.mocked(tokenUtils.hashToken).mockReturnValue('hashed:refresh-token');

      const result = await authService.logout(mockUser.id, 'refresh-token');

      expect(result.message).toBe('Logged out successfully');
      // Session deletion uses pipeline
      const pipelineMock = mockRedis.pipeline();
      expect(pipelineMock.del).toHaveBeenCalledWith('session:hashed:refresh-token');
      expect(pipelineMock.zrem).toHaveBeenCalledWith(
        `user-sessions:${mockUser.id}`,
        'hashed:refresh-token',
      );
    });

    it('invalidates all sessions when no refreshToken', async () => {
      mockRedis.zrange.mockResolvedValue(['hash1', 'hash2']);

      const result = await authService.logout(mockUser.id);

      expect(result.message).toBe('Logged out successfully');
      expect(mockRedis.zrange).toHaveBeenCalledWith(`user-sessions:${mockUser.id}`, 0, -1);
      // Should delete all session hashes and the user-sessions key
      const pipelineMock = mockRedis.pipeline();
      expect(pipelineMock.del).toHaveBeenCalled();
      expect(pipelineMock.del).toHaveBeenCalledWith('user-sessions:' + mockUser.id);
    });

    it('handles logout with no sessions in Redis', async () => {
      mockRedis.zrange.mockResolvedValue([]);

      const result = await authService.logout(mockUser.id);

      expect(result.message).toBe('Logged out successfully');
      // Should still try to delete the key
      expect(mockRedis.del).toHaveBeenCalledWith(`user-sessions:${mockUser.id}`);
    });
  });

  // ─── forgotPassword ───────────────────────────────────────

  describe('forgotPassword', () => {
    it('returns generic success message (prevents email enumeration)', async () => {
      const result = await authService.forgotPassword('test@example.com');

      expect(result.message).toBe('If the email exists, a reset link has been sent');
    });

    it('generates reset token and stores in Redis when user exists', async () => {
      mockFindByEmail.mockResolvedValue(mockUser);

      await authService.forgotPassword('test@example.com');

      expect(mockFindByEmail).toHaveBeenCalledWith('test@example.com');
      expect(mockRedis.setex).toHaveBeenCalledWith(
        expect.stringContaining('password-reset:'),
        900, // 15 minutes
        expect.any(String),
      );
    });

    it('does not store token when user does not exist (same message)', async () => {
      mockFindByEmail.mockResolvedValue(null);

      const result = await authService.forgotPassword('unknown@example.com');

      expect(result.message).toBe('If the email exists, a reset link has been sent');
      expect(mockRedis.setex).not.toHaveBeenCalled();
    });

    it('normalizes email to lowercase', async () => {
      mockFindByEmail.mockResolvedValue(mockUser);

      await authService.forgotPassword('TEST@EXAMPLE.COM');

      expect(mockFindByEmail).toHaveBeenCalledWith('test@example.com');
    });
  });

  // ─── resetPassword ────────────────────────────────────────

  describe('resetPassword', () => {
    it('resets password and invalidates sessions on success', async () => {
      mockRedis.get.mockResolvedValue(JSON.stringify({ userId: mockUser.id }));
      vi.mocked(bcrypt.hash).mockResolvedValue('new-hashed-password' as never);
      mockRedis.zrange.mockResolvedValue([]);

      const result = await authService.resetPassword('valid-token', 'NewPassword123!');

      expect(result.message).toBe('Password reset successfully');
      expect(mockUpdatePassword).toHaveBeenCalledWith(mockUser.id, 'new-hashed-password');
      // Reset token deleted
      expect(mockRedis.del).toHaveBeenCalledWith(expect.stringContaining('password-reset:'));
    });

    it('throws UnauthorizedError when token is invalid or expired', async () => {
      mockRedis.get.mockResolvedValue(null);

      await expect(
        authService.resetPassword('invalid-token', 'NewPassword123!'),
      ).rejects.toThrow(UnauthorizedError);
    });

    it('deletes the reset token (single-use)', async () => {
      mockRedis.get.mockResolvedValue(JSON.stringify({ userId: mockUser.id }));
      vi.mocked(bcrypt.hash).mockResolvedValue('new-hash' as never);
      mockRedis.zrange.mockResolvedValue([]);

      await authService.resetPassword('valid-token', 'NewPassword123!');

      expect(mockRedis.del).toHaveBeenCalledWith(expect.stringContaining('password-reset:'));
    });
  });

  // ─── getMe ────────────────────────────────────────────────

  describe('getMe', () => {
    it('returns user profile when found', async () => {
      mockFindById.mockResolvedValue(mockUserWithoutPassword);

      const result = await authService.getMe(mockUser.id);

      expect(result).toEqual(mockUserWithoutPassword);
      expect(mockFindById).toHaveBeenCalledWith(mockUser.id);
    });

    it('throws NotFoundError when user not found', async () => {
      mockFindById.mockResolvedValue(null);

      await expect(authService.getMe('nonexistent-uuid')).rejects.toThrow(NotFoundError);
    });
  });

  // ─── updateProfile ────────────────────────────────────────

  describe('updateProfile', () => {
    const profileUpdate = {
      firstName: 'Updated',
      lastName: 'Name',
      phone: '+251922222222',
    };

    it('updates and returns user profile', async () => {
      mockFindById.mockResolvedValue(mockUserWithoutPassword);
      const updatedUser = { ...mockUserWithoutPassword, firstName: 'Updated' };
      mockUpdateProfile.mockResolvedValue(updatedUser);

      const result = await authService.updateProfile(mockUser.id, profileUpdate);

      expect(result.firstName).toBe('Updated');
      expect(mockUpdateProfile).toHaveBeenCalledWith(mockUser.id, profileUpdate);
    });

    it('throws NotFoundError when user to update does not exist', async () => {
      mockFindById.mockResolvedValue(null);

      await expect(
        authService.updateProfile('nonexistent-uuid', profileUpdate),
      ).rejects.toThrow(NotFoundError);

      expect(mockUpdateProfile).not.toHaveBeenCalled();
    });

    it('works with partial updates', async () => {
      mockFindById.mockResolvedValue(mockUserWithoutPassword);
      mockUpdateProfile.mockResolvedValue(mockUserWithoutPassword);

      await authService.updateProfile(mockUser.id, { firstName: 'OnlyFirst' });

      expect(mockUpdateProfile).toHaveBeenCalledWith(mockUser.id, { firstName: 'OnlyFirst' });
    });

    it('works with empty update', async () => {
      mockFindById.mockResolvedValue(mockUserWithoutPassword);
      mockUpdateProfile.mockResolvedValue(mockUserWithoutPassword);

      await authService.updateProfile(mockUser.id, {});
      expect(mockUpdateProfile).toHaveBeenCalledWith(mockUser.id, {});
    });
  });
});
