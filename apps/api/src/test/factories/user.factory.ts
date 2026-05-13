// ─────────────────────────────────────────────────────────────
// User Factory
// Creates User records in the test database for repository tests.
// Each call generates a unique email to avoid unique constraint violations.
// ─────────────────────────────────────────────────────────────

import { getPrisma } from '../setup.js';
import type { UserRole } from '../../generated/prisma/enums.js';

let _counter = 0;

/** Default bcrypt hash for "password123" (cost factor 10). */
const DEFAULT_PASSWORD_HASH =
  '$2b$10$dGzXJ7p7p7p7p7p7p7p7p7p7p7p7p7p7p7p7p7p7p7p7p7p7p7p7';

/**
 * Input for creating a test user.
 */
export interface CreateTestUserInput {
  email?: string;
  passwordHash?: string;
  firstName?: string;
  lastName?: string;
  role?: UserRole;
  phone?: string | null;
  status?: 'PENDING' | 'ACTIVE' | 'SUSPENDED';
  isVerified?: boolean;
}

/**
 * Creates a User record in the test database.
 *
 * @param overrides - Optional fields to customize the user.
 * @returns The created user record without passwordHash.
 */
export async function createTestUser(overrides: CreateTestUserInput = {}) {
  _counter++;
  const suffix = _counter;
  const timestamp = Date.now();

  return getPrisma().user.create({
    data: {
      email: overrides.email ?? `test-user-${timestamp}-${suffix}@example.com`,
      passwordHash: overrides.passwordHash ?? DEFAULT_PASSWORD_HASH,
      firstName: overrides.firstName ?? 'Test',
      lastName: overrides.lastName ?? `User${suffix}`,
      role: overrides.role ?? 'STUDENT',
      phone: overrides.phone ?? null,
      status: overrides.status ?? 'ACTIVE',
      isVerified: overrides.isVerified ?? true,
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
