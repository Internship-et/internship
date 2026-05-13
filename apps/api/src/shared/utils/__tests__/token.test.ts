// ─────────────────────────────────────────────────────────────
// Token Utilities — Unit Tests
// Tests JWT generation, verification, and SHA-256 hashing.
// Mocks jsonwebtoken to avoid testing JWT library internals.
// ─────────────────────────────────────────────────────────────

import { describe, it, expect, vi } from 'vitest';
import jwt from 'jsonwebtoken';

// Mock the config so JWT_SECRET is deterministic
vi.mock('../../../config/index.js', () => ({
  config: {
    jwtSecret: 'test-secret-for-testing-32chars-minimum!!',
    jwtAccessExpiresIn: '15m',
    jwtRefreshExpiresIn: '7d',
  },
  default: {
    jwtSecret: 'test-secret-for-testing-32chars-minimum!!',
    jwtAccessExpiresIn: '15m',
    jwtRefreshExpiresIn: '7d',
  },
}));

import {
  generateAccessToken,
  generateRefreshToken,
  generateTokenPair,
  verifyToken,
  hashToken,
} from '../token.js';

describe('Token Utilities', () => {
  const mockUser = {
    id: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
    role: 'STUDENT',
    email: 'test@example.com',
  };

  describe('generateAccessToken', () => {
    it('generates a valid JWT access token string', () => {
      const token = generateAccessToken(mockUser);
      expect(token).toBeDefined();
      expect(typeof token).toBe('string');
      expect(token.split('.')).toHaveLength(3); // JWT has 3 parts
    });

    it('can be decoded to reveal payload', () => {
      const token = generateAccessToken(mockUser);
      const decoded = jwt.decode(token) as jwt.JwtPayload;
      expect(decoded.userId).toBe(mockUser.id);
      expect(decoded.role).toBe(mockUser.role);
      expect(decoded.email).toBe(mockUser.email);
    });

    it('has an expiration time', () => {
      const token = generateAccessToken(mockUser);
      const decoded = jwt.decode(token) as jwt.JwtPayload;
      expect(decoded.exp).toBeDefined();
      expect(decoded.iat).toBeDefined();
    });
  });

  describe('generateRefreshToken', () => {
    it('generates a valid JWT refresh token string', () => {
      const token = generateRefreshToken(mockUser);
      expect(token).toBeDefined();
      expect(typeof token).toBe('string');
      expect(token.split('.')).toHaveLength(3);
    });

    it('can be decoded to reveal payload', () => {
      const token = generateRefreshToken(mockUser);
      const decoded = jwt.decode(token) as jwt.JwtPayload;
      expect(decoded.userId).toBe(mockUser.id);
      expect(decoded.role).toBe(mockUser.role);
    });
  });

  describe('generateTokenPair', () => {
    it('returns both access and refresh tokens', () => {
      const pair = generateTokenPair(mockUser);
      expect(pair.accessToken).toBeDefined();
      expect(pair.refreshToken).toBeDefined();
      expect(pair.expiresIn).toBe(900);
    });

    it('both tokens contain the same payload', () => {
      const pair = generateTokenPair(mockUser);
      const accessDecoded = jwt.decode(pair.accessToken) as jwt.JwtPayload;
      const refreshDecoded = jwt.decode(pair.refreshToken) as jwt.JwtPayload;
      expect(accessDecoded.userId).toBe(refreshDecoded.userId);
      expect(accessDecoded.role).toBe(refreshDecoded.role);
      expect(accessDecoded.email).toBe(refreshDecoded.email);
    });

    it('tokens are different strings', () => {
      const pair = generateTokenPair(mockUser);
      expect(pair.accessToken).not.toBe(pair.refreshToken);
    });
  });

  describe('verifyToken', () => {
    it('returns decoded payload for a valid token', () => {
      const token = generateAccessToken(mockUser);
      const decoded = verifyToken(token);
      expect(decoded.userId).toBe(mockUser.id);
      expect(decoded.role).toBe(mockUser.role);
      expect(decoded.email).toBe(mockUser.email);
    });

    it('throws UnauthorizedError for an invalid token', () => {
      expect(() => verifyToken('invalid-token-string')).toThrow('Invalid token');
    });

    it('throws UnauthorizedError for a malformed token', () => {
      expect(() => verifyToken('not.a.token')).toThrow('Invalid token');
    });

    it('throws UnauthorizedError for an expired token', () => {
      // Create a token that's already expired
      const expiredToken = jwt.sign(
        { userId: mockUser.id, role: mockUser.role, email: mockUser.email },
        'test-secret-for-testing-32chars-minimum!!',
        { expiresIn: '0s' },
      );

      expect(() => verifyToken(expiredToken)).toThrow('Token expired');
    });

    it('throws UnauthorizedError for wrong secret', () => {
      const token = jwt.sign(
        { userId: mockUser.id, role: mockUser.role, email: mockUser.email },
        'wrong-secret-key',
        { expiresIn: '15m' },
      );

      expect(() => verifyToken(token)).toThrow('Invalid token');
    });
  });

  describe('hashToken', () => {
    it('returns a 64-character hex string (SHA-256)', () => {
      const hash = hashToken('some-token-value');
      expect(hash).toHaveLength(64);
      expect(/^[a-f0-9]+$/.test(hash)).toBe(true);
    });

    it('produces deterministic hashes for the same input', () => {
      const hash1 = hashToken('my-token');
      const hash2 = hashToken('my-token');
      expect(hash1).toBe(hash2);
    });

    it('produces different hashes for different inputs', () => {
      const hash1 = hashToken('token-a');
      const hash2 = hashToken('token-b');
      expect(hash1).not.toBe(hash2);
    });

    it('handles empty string', () => {
      const hash = hashToken('');
      expect(hash).toHaveLength(64);
    });
  });
});
