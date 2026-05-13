// ─────────────────────────────────────────────────────────────
// Company Factory
// Creates Company records (and their parent User) in the test database.
// Each call generates unique name and tinNumber to avoid unique constraint violations.
// ─────────────────────────────────────────────────────────────

import { getPrisma } from '../setup.js';
import { createTestUser } from './user.factory.js';
import type { CompanySize } from '../../generated/prisma/enums.js';

let _counter = 0;

/**
 * Input for creating a test company.
 */
export interface CreateTestCompanyInput {
  userId?: string;
  name?: string;
  industry?: string;
  description?: string | null;
  city?: string;
  address?: string | null;
  size?: CompanySize | null;
  foundedYear?: number | null;
  website?: string | null;
  logoUrl?: string | null;
  tinNumber?: string | null;
  isVerified?: boolean;
}

/**
 * Creates a Company record in the test database.
 * Also creates a parent User record with role COMPANY if no userId provided.
 *
 * @param overrides - Optional fields to customize the company.
 * @returns The created company with user relation.
 */
export async function createTestCompany(overrides: CreateTestCompanyInput = {}) {
  _counter++;
  const suffix = _counter;
  const timestamp = Date.now();

  // Create or use provided User
  let userId = overrides.userId;
  if (!userId) {
    const user = await createTestUser({
      role: 'COMPANY',
      firstName: 'Company',
      lastName: `Admin${suffix}`,
    });
    userId = user.id;
  }

  return getPrisma().company.create({
    data: {
      userId,
      name: overrides.name ?? `Test Company ${timestamp}-${suffix}`,
      industry: overrides.industry ?? 'Technology',
      description: overrides.description ?? null,
      city: overrides.city ?? 'Addis Ababa',
      address: overrides.address ?? null,
      size: overrides.size ?? null,
      foundedYear: overrides.foundedYear ?? null,
      website: overrides.website ?? null,
      logoUrl: overrides.logoUrl ?? null,
      tinNumber: overrides.tinNumber ?? `TIN-${timestamp}-${suffix}`,
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
    },
  });
}
