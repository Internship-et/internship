// ─────────────────────────────────────────────────────────────
// School Factory
// Creates School records (and their parent User) in the test database.
// Each call generates a unique name to avoid unique constraint violations.
// ─────────────────────────────────────────────────────────────

import { getPrisma } from '../setup.js';
import { createTestUser } from './user.factory.js';
import type { SchoolType } from '../../generated/prisma/enums.js';

let _counter = 0;

/**
 * Input for creating a test school.
 */
export interface CreateTestSchoolInput {
  userId?: string;
  name?: string;
  type?: SchoolType;
  city?: string;
  address?: string | null;
  phone?: string | null;
  email?: string | null;
  website?: string | null;
  principal?: string | null;
  gradesOffered?: number[] | null;
  logoUrl?: string | null;
  licenseNumber?: string | null;
  isVerified?: boolean;
}

/**
 * Creates a School record in the test database.
 * Also creates a parent User record with role SCHOOL if no userId provided.
 *
 * @param overrides - Optional fields to customize the school.
 * @returns The created school with user relation and student count.
 */
export async function createTestSchool(overrides: CreateTestSchoolInput = {}) {
  _counter++;
  const suffix = _counter;
  const timestamp = Date.now();

  // Create or use provided User
  let userId = overrides.userId;
  if (!userId) {
    const user = await createTestUser({
      role: 'SCHOOL',
      firstName: 'School',
      lastName: `Admin${suffix}`,
    });
    userId = user.id;
  }

  return getPrisma().school.create({
    data: {
      userId,
      name: overrides.name ?? `Test School ${timestamp}-${suffix}`,
      type: overrides.type ?? 'PUBLIC',
      city: overrides.city ?? 'Addis Ababa',
      address: overrides.address ?? null,
      phone: overrides.phone ?? null,
      email: overrides.email ?? null,
      website: overrides.website ?? null,
      principal: overrides.principal ?? null,
      gradesOffered: overrides.gradesOffered ?? [],
      logoUrl: overrides.logoUrl ?? null,
      licenseNumber: overrides.licenseNumber ?? `LIC-${timestamp}-${suffix}`,
      isVerified: overrides.isVerified ?? false,
    },
    include: {
      user: {
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          role: true,
          phone: true,
        },
      },
      _count: {
        select: {
          students: true,
        },
      },
    },
  });
}
