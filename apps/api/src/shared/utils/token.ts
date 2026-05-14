// ─────────────────────────────────────────────────────────────
// Token Utilities
// JWT generation, verification, and SHA-256 token hashing.
// ─────────────────────────────────────────────────────────────

import jwt, { type JwtPayload, type SignOptions } from 'jsonwebtoken';
import { createHash } from 'node:crypto';
import { config } from '../../config/index.js';
import { UnauthorizedError } from '../errors/app-error.js';

// ─── Types ──────────────────────────────────────────────────

/** Payload stored inside every JWT issued by the platform. */
export interface TokenPayload {
  userId: string;
  role: string;
  email: string;
}

/** Shape returned when a new token pair is created. */
export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

// ─── JWT Secret ─────────────────────────────────────────────

const JWT_SECRET = config.jwtSecret;
const ACCESS_EXPIRES_IN = config.jwtAccessExpiresIn;
const REFRESH_EXPIRES_IN = config.jwtRefreshExpiresIn;
const { TokenExpiredError } = jwt;

// ─── Helpers ────────────────────────────────────────────────

/**
 * Builds the JWT payload from user data.
 * Only includes userId, role, email — no PII or sensitive data.
 */
function buildPayload(user: { id: string; role: string; email: string }): TokenPayload {
  return {
    userId: user.id,
    role: user.role,
    email: user.email,
  };
}

// ─── Public Functions ───────────────────────────────────────

/**
 * Generates a signed JWT access token valid for a short window (default 15 min).
 *
 * @param user - Object containing `id`, `role`, and `email`.
 * @returns The signed access token string.
 */
export function generateAccessToken(user: { id: string; role: string; email: string }): string {
  const payload = buildPayload(user);
  const expiresIn = ACCESS_EXPIRES_IN as string;
  return jwt.sign(payload, JWT_SECRET, { expiresIn } as SignOptions);
}

/**
 * Generates a signed JWT refresh token valid for a longer window (default 7 days).
 *
 * @param user - Object containing `id`, `role`, and `email`.
 * @returns The signed refresh token string.
 */
export function generateRefreshToken(user: { id: string; role: string; email: string }): string {
  const payload = buildPayload(user);
  const expiresIn = REFRESH_EXPIRES_IN as string;
  return jwt.sign(payload, JWT_SECRET, { expiresIn } as SignOptions);
}

/**
 * Generates both an access and a refresh token for the given user.
 *
 * @param user - Object containing `id`, `role`, and `email`.
 * @returns A `TokenPair` with `accessToken`, `refreshToken`, and `expiresIn` (seconds).
 */
export function generateTokenPair(user: { id: string; role: string; email: string }): TokenPair {
  const accessToken = generateAccessToken(user);
  const refreshToken = generateRefreshToken(user);
  return {
    accessToken,
    refreshToken,
    expiresIn: 900,
  };
}

/**
 * Verifies a JWT and returns the decoded payload.
 *
 * @param token - The JWT string to verify.
 * @returns The decoded `TokenPayload` (with `iat` and `exp`).
 *
 * @throws {UnauthorizedError} If the token is expired, malformed, or invalid.
 */
export function verifyToken(token: string): TokenPayload & JwtPayload {
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as TokenPayload & JwtPayload;
    return decoded;
  } catch (error) {
    if (error instanceof TokenExpiredError) {
      throw new UnauthorizedError('Token expired');
    }
    throw new UnauthorizedError('Invalid token');
  }
}

/**
 * Creates a SHA-256 hex digest of a token string.
 * Used for storing token hashes in Redis rather than raw tokens.
 *
 * @param token - The token string to hash.
 * @returns A 64-character hex string (SHA-256 digest).
 */
export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}
