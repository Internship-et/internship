// ─────────────────────────────────────────────────────────────
// Auth Repository
// Database access layer for User queries used by the auth module.
// Must not contain business logic or validation.
// ─────────────────────────────────────────────────────────────

import { prisma } from '../../shared/lib/prisma.js';
import type { UserRole } from '../../generated/prisma/enums.js';

// ─── Types ──────────────────────────────────────────────────

/** Input data for creating a new user. */
export interface CreateUserData {
  email: string;
  passwordHash: string;
  firstName: string;
  lastName: string;
  role: UserRole;
  phone?: string;
}

/** Fields that can be updated on the base User profile. */
export interface UpdateProfileData {
  firstName?: string;
  lastName?: string;
  phone?: string;
}

// ─── Queries ────────────────────────────────────────────────

/**
 * Finds a non-deleted user by their email address.
 *
 * @param email - The user's email (should already be lowercased).
 * @returns The full user record including `passwordHash`, or `null` if not found.
 */
export async function findByEmail(email: string) {
  return prisma.user.findFirst({
    where: {
      email,
      deletedAt: null,
    },
  });
}

/**
 * Finds a non-deleted user by their UUID.
 *
 * @param id - The user's UUID.
 * @returns The user record without `passwordHash`, or `null` if not found.
 */
export async function findById(id: string) {
  return prisma.user.findFirst({
    where: {
      id,
      deletedAt: null,
    },
    select: {
      id: true,
      email: true,
      firstName: true,
      lastName: true,
      role: true,
      phone: true,
      status: true,
      isVerified: true,
      createdAt: true,
      updatedAt: true,
      lastLoginAt: true,
    },
  });
}

/**
 * Creates a new user record with the given data.
 *
 * @param data - User creation input (email, passwordHash, firstName, lastName, role, optional phone).
 * @returns The newly created user record without `passwordHash`.
 */
export async function create(data: CreateUserData) {
  return prisma.user.create({
    data: {
      email: data.email,
      passwordHash: data.passwordHash,
      firstName: data.firstName,
      lastName: data.lastName,
      role: data.role,
      phone: data.phone ?? null,
      status: 'PENDING',
      isVerified: false,
    },
    select: {
      id: true,
      email: true,
      firstName: true,
      lastName: true,
      role: true,
      phone: true,
      status: true,
      isVerified: true,
      createdAt: true,
    },
  });
}

/**
 * Updates the password hash for a user.
 *
 * @param id - The user's UUID.
 * @param passwordHash - The new bcrypt hash.
 */
export async function updatePassword(id: string, passwordHash: string): Promise<void> {
  await prisma.user.update({
    where: { id },
    data: { passwordHash },
  });
}

/**
 * Sets the `lastLoginAt` timestamp to the current time.
 *
 * @param id - The user's UUID.
 */
export async function updateLastLogin(id: string): Promise<void> {
  await prisma.user.update({
    where: { id },
    data: { lastLoginAt: new Date() },
  });
}

/**
 * Updates base User profile fields (firstName, lastName, phone).
 *
 * @param id - The user's UUID.
 * @param data - Fields to update (all optional).
 * @returns The updated user record without `passwordHash`.
 */
export async function updateProfile(id: string, data: UpdateProfileData) {
  return prisma.user.update({
    where: { id },
    data: {
      ...(data.firstName !== undefined && { firstName: data.firstName }),
      ...(data.lastName !== undefined && { lastName: data.lastName }),
      ...(data.phone !== undefined && { phone: data.phone }),
    },
    select: {
      id: true,
      email: true,
      firstName: true,
      lastName: true,
      role: true,
      phone: true,
      status: true,
      isVerified: true,
      createdAt: true,
      updatedAt: true,
    },
  });
}
