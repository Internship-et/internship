// ─────────────────────────────────────────────────────────────
// Internship Factory
// Creates Internship records in the test database.
// Requires an existing Company (either passed in or auto-created).
// Each call generates a unique title.
// ─────────────────────────────────────────────────────────────

import { getPrisma } from '../setup.js';
import { createTestCompany } from './company.factory.js';
import type { InternshipStatus, InternshipType } from '../../generated/prisma/enums.js';

let _counter = 0;

/**
 * Input for creating a test internship.
 */
export interface CreateTestInternshipInput {
  companyId?: string;
  title?: string;
  description?: string;
  responsibilities?: string[];
  requirements?: string[];
  preferredSkills?: string[];
  type?: InternshipType;
  city?: string;
  address?: string | null;
  durationMonths?: number;
  weeklyHours?: number | null;
  startDate?: Date | string | null;
  deadline?: Date | string | null;
  benefits?: string[];
  tags?: string[];
  minGrade?: number | null;
  maxGrade?: number | null;
  status?: InternshipStatus;
}

/**
 * Creates an Internship record in the test database.
 * Also creates a parent Company + User if no companyId provided.
 *
 * @param overrides - Optional fields to customize the internship.
 * @returns The created internship with company relation and application count.
 */
export async function createTestInternship(
  overrides: CreateTestInternshipInput = {},
) {
  _counter++;
  const suffix = _counter;

  // Create or use provided Company
  let companyId = overrides.companyId;
  if (!companyId) {
    const company = await createTestCompany();
    companyId = company.id;
  }

  return getPrisma().internship.create({
    data: {
      companyId,
      title: overrides.title ?? `Test Internship ${suffix}`,
      description: overrides.description ?? 'A great internship opportunity for students.',
      responsibilities: overrides.responsibilities ?? [],
      requirements: overrides.requirements ?? ['Must be a student'],
      preferredSkills: overrides.preferredSkills ?? [],
      type: overrides.type ?? 'ON_SITE',
      city: overrides.city ?? 'Addis Ababa',
      address: overrides.address ?? null,
      durationMonths: overrides.durationMonths ?? 3,
      weeklyHours: overrides.weeklyHours ?? null,
      startDate: overrides.startDate ? new Date(overrides.startDate) : null,
      deadline: overrides.deadline ? new Date(overrides.deadline) : null,
      benefits: overrides.benefits ?? [],
      tags: overrides.tags ?? [],
      minGrade: overrides.minGrade ?? null,
      maxGrade: overrides.maxGrade ?? null,
      status: overrides.status ?? 'ACTIVE',
    },
    include: {
      company: {
        select: {
          id: true,
          name: true,
          logoUrl: true,
          city: true,
          industry: true,
          userId: true,
        },
      },
      _count: {
        select: {
          applications: true,
        },
      },
    },
  });
}
