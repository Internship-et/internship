// ─────────────────────────────────────────────────────────────
// Student Factory
// Creates Student records (and their parent User) in the test database.
// Each call generates a unique email to avoid unique constraint violations.
// ─────────────────────────────────────────────────────────────

import { getPrisma } from '../setup.js';
import { createTestUser } from './user.factory.js';

let _counter = 0;

/**
 * Input for creating a test student.
 */
export interface CreateTestStudentInput {
  userId?: string;
  schoolId?: string | null;
  grade?: number | null;
  dateOfBirth?: Date | string | null;
  bio?: string | null;
  skills?: string[];
  interests?: string[];
  languages?: string[];
  resumeUrl?: string | null;
  profileImageUrl?: string | null;
  isSchoolVerified?: boolean;
}

/**
 * Creates a Student record in the test database.
 * Also creates a parent User record with role STUDENT if no userId provided.
 *
 * @param overrides - Optional fields to customize the student.
 * @returns The created student with user and school relations.
 */
export async function createTestStudent(overrides: CreateTestStudentInput = {}) {
  _counter++;
  const suffix = _counter;

  // Create or use provided User
  let userId = overrides.userId;
  if (!userId) {
    const user = await createTestUser({
      role: 'STUDENT',
      firstName: 'Student',
      lastName: `Student${suffix}`,
    });
    userId = user.id;
  }

  return getPrisma().student.create({
    data: {
      userId,
      schoolId: overrides.schoolId ?? null,
      grade: overrides.grade ?? null,
      dateOfBirth: overrides.dateOfBirth ?? null,
      bio: overrides.bio ?? null,
      skills: overrides.skills ?? [],
      interests: overrides.interests ?? [],
      languages: overrides.languages ?? [],
      resumeUrl: overrides.resumeUrl ?? null,
      profileImageUrl: overrides.profileImageUrl ?? null,
      isSchoolVerified: overrides.isSchoolVerified ?? false,
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
      school: {
        select: {
          id: true,
          name: true,
        },
      },
    },
  });
}
