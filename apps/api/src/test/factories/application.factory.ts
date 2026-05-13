// ─────────────────────────────────────────────────────────────
// Application Factory
// Creates Application records in the test database.
// Requires existing Student and Internship records (auto-created if not provided).
// Each call creates unique parent records to avoid unique constraint violations.
// ─────────────────────────────────────────────────────────────

import { getPrisma } from '../setup.js';
import { createTestUser } from './user.factory.js';
import { createTestStudent } from './student.factory.js';
import { createTestInternship } from './internship.factory.js';
import type { ApplicationStatus } from '../../generated/prisma/enums.js';

let _counter = 0;

/**
 * Input for creating a test application.
 */
export interface CreateTestApplicationInput {
  internshipId?: string;
  studentId?: string;
  status?: ApplicationStatus;
  coverLetter?: string | null;
  additionalInfo?: string | null;
  companyNote?: string | null;
}

/**
 * Creates an Application record in the test database.
 * Also creates parent Student and Internship records if not provided.
 *
 * @param overrides - Optional fields to customize the application.
 * @returns The created application with selected fields.
 */
export async function createTestApplication(
  overrides: CreateTestApplicationInput = {},
) {
  _counter++;
  const suffix = _counter;

  // Create or use provided Student
  let studentId = overrides.studentId;
  if (!studentId) {
    const user = await createTestUser({
      role: 'STUDENT',
      firstName: 'Applicant',
      lastName: `Student${suffix}`,
    });
    const student = await createTestStudent({ userId: user.id });
    studentId = student.id;
  }

  // Create or use provided Internship
  let internshipId = overrides.internshipId;
  if (!internshipId) {
    const internship = await createTestInternship();
    internshipId = internship.id;
  }

  return getPrisma().application.create({
    data: {
      internshipId,
      studentId,
      status: overrides.status ?? 'PENDING',
      coverLetter: overrides.coverLetter ?? null,
      additionalInfo: overrides.additionalInfo ?? null,
      companyNote: overrides.companyNote ?? null,
    },
    include: {
      student: {
        include: {
          user: {
            select: {
              id: true,
              email: true,
              firstName: true,
              lastName: true,
              phone: true,
            },
          },
        },
      },
      internship: {
        include: {
          company: {
            select: {
              id: true,
              name: true,
              userId: true,
            },
          },
        },
      },
      statusHistory: {
        orderBy: { createdAt: 'asc' },
      },
    },
  });
}
