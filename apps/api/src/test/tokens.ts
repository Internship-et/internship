// ─────────────────────────────────────────────────────────────
// Test Token Utilities
// Provides helpers for generating test tokens for route tests.
// Uses jsonwebtoken to create real signed tokens for integration tests.
// ─────────────────────────────────────────────────────────────

import jwt from 'jsonwebtoken';
import { createHash, randomBytes } from 'node:crypto';
import { VALID_UUID } from './constants.js';

const TEST_JWT_SECRET = 'test-secret-for-testing-32chars-minimum!!';

/**
 * Generates a test JWT access token for the given user.
 */
export function generateTestAccessToken(overrides?: {
  userId?: string;
  role?: string;
  email?: string;
}): string {
  const payload = {
    userId: overrides?.userId ?? VALID_UUID,
    role: overrides?.role ?? 'STUDENT',
    email: overrides?.email ?? 'test@example.com',
  };
  return jwt.sign(payload, TEST_JWT_SECRET, { expiresIn: '15m' });
}

/**
 * Generates a test JWT refresh token for the given user.
 */
export function generateTestRefreshToken(overrides?: {
  userId?: string;
  role?: string;
  email?: string;
}): string {
  const payload = {
    userId: overrides?.userId ?? VALID_UUID,
    role: overrides?.role ?? 'STUDENT',
    email: overrides?.email ?? 'test@example.com',
  };
  return jwt.sign(payload, TEST_JWT_SECRET, { expiresIn: '7d' });
}

/**
 * Generates a test JWT that is expired (issued 1 hour ago, expired 5 minutes ago).
 */
export function generateExpiredToken(): string {
  const payload = {
    userId: VALID_UUID,
    role: 'STUDENT',
    email: 'test@example.com',
  };
  // Use a past expiration to simulate expired token
  return jwt.sign(payload, TEST_JWT_SECRET, { expiresIn: '0s' });
}

/**
 * Generates a random hex token for password reset testing.
 */
export function generateRandomHexToken(): string {
  return randomBytes(32).toString('hex');
}

/**
 * Hashes a token using SHA-256 (matching production hashToken utility).
 */
export function hashTestToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}
