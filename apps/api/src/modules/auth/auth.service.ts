// ─────────────────────────────────────────────────────────────
// Auth Service
// Business logic for all authentication operations.
// ─────────────────────────────────────────────────────────────

import bcrypt from 'bcrypt';
import crypto from 'node:crypto';
import { redis } from '../../shared/lib/redis.js';
import logger from '../../shared/lib/logger.js';
import {
  generateTokenPair,
  verifyToken,
  hashToken,
} from '../../shared/utils/token.js';
import {
  AppError,
  ConflictError,
  NotFoundError,
  UnauthorizedError,
} from '../../shared/errors/app-error.js';
import * as authRepository from './auth.repository.js';
import type { RegisterInput, LoginInput, UpdateProfileInput } from './auth.schema.js';

// ─── Constants ──────────────────────────────────────────────

const BCRYPT_SALT_ROUNDS = 10;
const SESSION_TTL_SECONDS = 7 * 24 * 60 * 60; // 7 days
const PASSWORD_RESET_TTL_SECONDS = 15 * 60; // 15 minutes
const FAILED_LOGIN_TTL_SECONDS = 15 * 60; // 15 minutes
const MAX_FAILED_ATTEMPTS = 5;

// ─── Helpers ────────────────────────────────────────────────

/**
 * Creates a new Redis session for the given refresh token and user.
 *
 * Uses a Redis String for the session data keyed by token hash,
 * and a Sorted Set (scored by timestamp) for the user-session index.
 * When the set exceeds 5 members, the oldest session is evicted.
 *
 * @param refreshToken - The raw (unhashed) refresh token.
 * @param userId - The user's UUID.
 * @param role - The user's role.
 */
async function createSession(refreshToken: string, userId: string, role: string): Promise<void> {
  const hash = hashToken(refreshToken);
  const now = Date.now();

  // Store session data by token hash
  await redis.setex(
    `session:${hash}`,
    SESSION_TTL_SECONDS,
    JSON.stringify({ userId, role, createdAt: new Date().toISOString() }),
  );

  // Add to user-sessions sorted set (score = timestamp)
  await redis.zadd(`user-sessions:${userId}`, now, hash);

  // Evict sessions beyond the 5 newest
  // ZRANGE 0 -6 returns the oldest entries when size > 5
  const oldHashes = await redis.zrange(`user-sessions:${userId}`, 0, -6);
  if (oldHashes.length > 0) {
    const pipeline = redis.pipeline();
    for (const oldHash of oldHashes) {
      pipeline.del(`session:${oldHash}`);
    }
    pipeline.zremrangebyrank(`user-sessions:${userId}`, 0, -6);
    await pipeline.exec();
  }

  // Set TTL on the sorted set
  await redis.expire(`user-sessions:${userId}`, SESSION_TTL_SECONDS);
}

/**
 * Removes all sessions for a given user from Redis.
 *
 * @param userId - The user's UUID.
 */
async function removeAllSessions(userId: string): Promise<void> {
  const sessionHashes = await redis.zrange(`user-sessions:${userId}`, 0, -1);
  if (sessionHashes.length > 0) {
    const pipeline = redis.pipeline();
    for (const sessionHash of sessionHashes) {
      pipeline.del(`session:${sessionHash}`);
    }
    pipeline.del(`user-sessions:${userId}`);
    await pipeline.exec();
  } else {
    // Ensure the key is removed even if the set is empty
    await redis.del(`user-sessions:${userId}`);
  }
}

// ─── Public Service Functions ───────────────────────────────

/**
 * Registers a new user account.
 *
 * Only the User record is created. Role-specific profiles
 * (Student, Company, School) are deferred to domain modules.
 *
 * @param input - Validated registration input.
 * @returns An object containing the new user (no passwordHash) and a token pair.
 *
 * @throws {ConflictError} If the email is already registered.
 */
export async function register(input: RegisterInput) {
  // Check email uniqueness
  const existing = await authRepository.findByEmail(input.email);
  if (existing) {
    throw new ConflictError('Email already registered');
  }

  // Hash password
  const passwordHash = await bcrypt.hash(input.password, BCRYPT_SALT_ROUNDS);

  // Create User record (only — no domain profile)
  const user = await authRepository.create({
    email: input.email,
    passwordHash,
    firstName: input.firstName,
    lastName: input.lastName,
    role: input.role,
    phone: input.phone,
  });

  // Generate tokens
  const tokenPair = generateTokenPair({ id: user.id, role: user.role, email: user.email });

  // Create Redis session
  await createSession(tokenPair.refreshToken, user.id, user.role);

  logger.info({ userId: user.id, role: user.role }, 'User registered');

  return {
    user,
    token: tokenPair,
  };
}

/**
 * Authenticates a user with email and password.
 *
 * Implements generic error messages, failed-attempt lockout (Redis-only),
 * and status-based access control.
 *
 * @param input - Validated login input.
 * @returns An object containing the user profile (no passwordHash) and a token pair.
 *
 * @throws {UnauthorizedError} On invalid credentials or account lockout.
 * @throws {AppError} With code ACCOUNT_SUSPENDED or ACCOUNT_NOT_VERIFIED for status issues.
 */
export async function login(input: LoginInput) {
  const normalizedEmail = input.email.toLowerCase().trim();

  // ─── Failed-login lockout check ────────────────────────────
  const failedKey = `failed-login:${normalizedEmail}`;
  const failedCount = await redis.get(failedKey);
  if (failedCount && parseInt(failedCount, 10) >= MAX_FAILED_ATTEMPTS) {
    throw new UnauthorizedError('Account temporarily locked. Try again later.');
  }

  // ─── Find user ─────────────────────────────────────────────
  const user = await authRepository.findByEmail(normalizedEmail);

  // ─── Verify password ───────────────────────────────────────
  let passwordValid = false;
  if (user) {
    passwordValid = await bcrypt.compare(input.password, user.passwordHash);
  }

  if (!user || !passwordValid) {
    // Increment failed-attempt counter
    await redis.incr(failedKey);
    await redis.expire(failedKey, FAILED_LOGIN_TTL_SECONDS);

    // Generic error — does not reveal whether the email exists
    throw new UnauthorizedError('Invalid email or password');
  }

  // ─── Successful login: clear failed counter ────────────────
  await redis.del(failedKey);

  // ─── Check account status ──────────────────────────────────
  if (user.status === 'SUSPENDED') {
    throw new AppError('Account suspended', 403, 'ACCOUNT_SUSPENDED');
  }
  if (user.status === 'PENDING') {
    throw new AppError('Account not verified', 403, 'ACCOUNT_NOT_VERIFIED');
  }

  // ─── Update last login ─────────────────────────────────────
  await authRepository.updateLastLogin(user.id);

  // ─── Generate tokens and create session ────────────────────
  const tokenPair = generateTokenPair({ id: user.id, role: user.role, email: user.email });
  await createSession(tokenPair.refreshToken, user.id, user.role);

  logger.info({ userId: user.id }, 'User logged in');

  // Return user without passwordHash
  const { passwordHash: _, ...safeUser } = user;
  void _;

  return {
    user: safeUser,
    token: tokenPair,
  };
}

/**
 * Refreshes an access token using a valid refresh token.
 * The old refresh token is rotated (invalidated) and a new pair is issued.
 *
 * @param refreshToken - The current refresh token (JWT).
 * @returns A new token pair.
 *
 * @throws {UnauthorizedError} If the refresh token is invalid, expired, or not found in Redis.
 */
export async function refresh(refreshToken: string) {
  // Verify the JWT
  const payload = verifyToken(refreshToken);

  // Hash the provided token and check Redis
  const tokenHash = hashToken(refreshToken);
  const sessionData = await redis.get(`session:${tokenHash}`);

  if (!sessionData) {
    throw new UnauthorizedError('Invalid refresh token');
  }

  // ─── Invalidate old session ────────────────────────────────
  const pipeline = redis.pipeline();
  pipeline.del(`session:${tokenHash}`);
  pipeline.zrem(`user-sessions:${payload.userId}`, tokenHash);
  await pipeline.exec();

  // ─── Issue new tokens ──────────────────────────────────────
  const newTokenPair = generateTokenPair({
    id: payload.userId,
    role: payload.role,
    email: payload.email,
  });

  // ─── Create new session ────────────────────────────────────
  await createSession(newTokenPair.refreshToken, payload.userId, payload.role);

  return newTokenPair;
}

/**
 * Logs out a user by invalidating their session(s).
 *
 * If a `refreshToken` is provided, only that session is invalidated.
 * If none is provided, all sessions for the user are invalidated.
 *
 * @param userId - The authenticated user's UUID.
 * @param refreshToken - Optional: specific refresh token to invalidate.
 * @returns A success message.
 */
export async function logout(userId: string, refreshToken?: string) {
  if (refreshToken) {
    const hash = hashToken(refreshToken);
    const pipeline = redis.pipeline();
    pipeline.del(`session:${hash}`);
    pipeline.zrem(`user-sessions:${userId}`, hash);
    await pipeline.exec();

    logger.info({ userId }, 'User logged out (single session)');
  } else {
    await removeAllSessions(userId);
    logger.info({ userId }, 'User logged out (all sessions)');
  }

  return { message: 'Logged out successfully' };
}

/**
 * Initiates the password reset flow.
 *
 * Generates a cryptographically random token, stores its hash in Redis,
 * and always returns a generic success message (prevents email enumeration).
 * No email provider is integrated — this is a known gap.
 *
 * @param email - The email address to send the reset link to.
 * @returns A generic success message.
 */
export async function forgotPassword(email: string) {
  const normalizedEmail = email.toLowerCase().trim();

  // Find user (or don't — security: return same message either way)
  const user = await authRepository.findByEmail(normalizedEmail);

  if (user) {
    // Generate a cryptographically secure random token
    const rawToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = hashToken(rawToken);

    // Store token hash in Redis with 15-minute TTL
    await redis.setex(
      `password-reset:${tokenHash}`,
      PASSWORD_RESET_TTL_SECONDS,
      JSON.stringify({ userId: user.id }),
    );

    logger.info({ userId: user.id }, 'Password reset token generated');
  }

  // Always return the same message — do not reveal if email exists
  return { message: 'If the email exists, a reset link has been sent' };
}

/**
 * Resets a user's password using a valid reset token.
 *
 * Verifies the token hash in Redis, hashes the new password,
 * updates the database, and invalidates all existing sessions.
 *
 * @param token - The raw password reset token.
 * @param newPassword - The new password to set.
 * @returns A success message.
 *
 * @throws {UnauthorizedError} If the token is invalid, expired, or already used.
 */
export async function resetPassword(token: string, newPassword: string) {
  const tokenHash = hashToken(token);
  const resetKey = `password-reset:${tokenHash}`;

  // Look up the token in Redis
  const storedData = await redis.get(resetKey);
  if (!storedData) {
    throw new UnauthorizedError('Invalid or expired reset token');
  }

  // Parse the stored userId
  const { userId } = JSON.parse(storedData);

  // Delete the reset token (single-use)
  await redis.del(resetKey);

  // Hash the new password
  const passwordHash = await bcrypt.hash(newPassword, BCRYPT_SALT_ROUNDS);

  // Update password in database
  await authRepository.updatePassword(userId, passwordHash);

  // Invalidate all existing sessions
  await removeAllSessions(userId);

  logger.info({ userId }, 'Password reset completed');

  return { message: 'Password reset successfully' };
}

/**
 * Retrieves the authenticated user's profile.
 *
 * @param userId - The authenticated user's UUID.
 * @returns The user profile without `passwordHash`.
 *
 * @throws {NotFoundError} If the user is not found.
 */
export async function getMe(userId: string) {
  const user = await authRepository.findById(userId);
  if (!user) {
    throw new NotFoundError('User not found');
  }
  return user;
}

/**
 * Updates the authenticated user's base profile fields.
 *
 * Only `firstName`, `lastName`, and `phone` can be updated here.
 * Role-specific profile fields are handled by domain modules.
 *
 * @param userId - The authenticated user's UUID.
 * @param data - Fields to update (all optional).
 * @returns The updated user profile without `passwordHash`.
 *
 * @throws {NotFoundError} If the user is not found.
 */
export async function updateProfile(userId: string, data: UpdateProfileInput) {
  // Verify user exists
  const existing = await authRepository.findById(userId);
  if (!existing) {
    throw new NotFoundError('User not found');
  }

  const updatedUser = await authRepository.updateProfile(userId, data);
  return updatedUser;
}
