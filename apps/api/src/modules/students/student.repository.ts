// ─────────────────────────────────────────────────────────────
// Student Repository
// Database access layer for all Student-related queries.
// Must not contain business logic or validation.
// ─────────────────────────────────────────────────────────────

import { prisma } from '../../shared/lib/prisma.js';
import type { UpdateProfileData } from '../auth/auth.repository.js';
import type { Prisma } from '../../generated/prisma/client.js';
import type { ApplicationStatus, UserStatus } from '../../generated/prisma/enums.js';

// ─── Types ──────────────────────────────────────────────────

/** Student-specific fields for creation (without userId). */
export interface CreateStudentData {
  grade?: number | null;
  dateOfBirth?: Date | string | null;
  bio?: string | null;
  skills?: string[];
  interests?: string[];
  languages?: string[];
  resumeUrl?: string | null;
  profileImageUrl?: string | null;
  schoolId?: string | null;
}

/** Student-specific fields for update (all optional). */
export type UpdateStudentData = Partial<CreateStudentData>;

/** Filters for admin student listing. */
export interface StudentListFilters {
  page: number;
  pageSize: number;
  search?: string;
  schoolId?: string;
  grade?: number;
  status?: string;
  sort?: string;
  order?: 'asc' | 'desc';
}

/** Filters for application listing. */
export interface ApplicationListFilters {
  status?: string;
  page: number;
  pageSize: number;
}

/** Result of a transactional upsert (User + Student). */
export interface UpsertUserAndStudentResult {
  id: string;
  userId: string;
  schoolId: string | null;
  grade: number | null;
  dateOfBirth: Date | null;
  bio: string | null;
  skills: string[];
  interests: string[];
  languages: string[];
  resumeUrl: string | null;
  profileImageUrl: string | null;
  isSchoolVerified: boolean;
  createdAt: Date;
  updatedAt: Date;
  user: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    role: string;
    phone: string | null;
  };
  school: {
    id: string;
    name: string;
  } | null;
}

// ─── Queries ────────────────────────────────────────────────

/**
 * Lists students with pagination, search, filter, and sort.
 *
 * @param filters - Pagination, search, and filter parameters.
 * @returns Paginated list of students with user and school relations.
 */
export async function findAll(filters: StudentListFilters) {
  const { page, pageSize, search, schoolId, grade, status, sort, order } = filters;
  const skip = (page - 1) * pageSize;

  // Build the where clause
  const where: Prisma.StudentWhereInput = {};

  if (search) {
    where.OR = [
      { user: { firstName: { contains: search, mode: 'insensitive' } } },
      { user: { lastName: { contains: search, mode: 'insensitive' } } },
      { skills: { hasSome: [search] } },
    ];
  }

  if (schoolId) {
    where.schoolId = schoolId;
  }

  if (grade !== undefined) {
    where.grade = grade;
  }

  if (status) {
    where.user = { status: status as UserStatus };
  }

  // Build orderBy — explicit handling for each allowed sort field
  const orderBy: Prisma.StudentOrderByWithRelationInput[] = [];
  switch (sort) {
    case 'firstName':
    case 'lastName':
    case 'email':
      orderBy.push({ user: { [sort]: order ?? 'desc' } });
      break;
    case 'createdAt':
      orderBy.push({ createdAt: order ?? 'desc' });
      break;
    case 'updatedAt':
      orderBy.push({ updatedAt: order ?? 'desc' });
      break;
    case 'grade':
      orderBy.push({ grade: order ?? 'desc' });
      break;
    default:
      orderBy.push({ createdAt: 'desc' });
      break;
  }

  return prisma.student.findMany({
    where,
    skip,
    take: pageSize,
    orderBy,
    include: {
      user: {
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          role: true,
          phone: true,
          status: true,
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

/**
 * Finds a student by their Student profile UUID.
 *
 * @param id - The Student profile UUID.
 * @returns The student with user and school relations, or null.
 */
export async function findById(id: string) {
  return prisma.student.findUnique({
    where: { id },
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

/**
 * Finds a student by their User ID.
 *
 * @param userId - The User UUID.
 * @returns The student with user and school relations, or null.
 */
export async function findByUserId(userId: string) {
  return prisma.student.findUnique({
    where: { userId },
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

/**
 * Creates a new Student profile record.
 *
 * @param data - Object containing userId and student-specific fields.
 * @returns The newly created student with user and school relations.
 */
export async function create(data: { userId: string } & CreateStudentData) {
  return prisma.student.create({
    data: {
      userId: data.userId,
      bio: data.bio ?? null,
      grade: data.grade ?? null,
      dateOfBirth: data.dateOfBirth ?? null,
      skills: data.skills ?? [],
      interests: data.interests ?? [],
      languages: data.languages ?? [],
      profileImageUrl: data.profileImageUrl ?? null,
      resumeUrl: data.resumeUrl ?? null,
      schoolId: data.schoolId ?? null,
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

/**
 * Updates Student-only fields on an existing profile.
 *
 * @param id - The Student profile UUID.
 * @param data - Student-specific fields to update (all optional).
 * @returns The updated student with user and school relations.
 */
export async function update(id: string, data: UpdateStudentData) {
  return prisma.student.update({
    where: { id },
    data: {
      ...(data.bio !== undefined && { bio: data.bio }),
      ...(data.grade !== undefined && { grade: data.grade }),
      ...(data.dateOfBirth !== undefined && { dateOfBirth: data.dateOfBirth }),
      ...(data.skills !== undefined && { skills: data.skills }),
      ...(data.interests !== undefined && { interests: data.interests }),
      ...(data.languages !== undefined && { languages: data.languages }),
      ...(data.profileImageUrl !== undefined && { profileImageUrl: data.profileImageUrl }),
      ...(data.resumeUrl !== undefined && { resumeUrl: data.resumeUrl }),
      ...(data.schoolId !== undefined && { schoolId: data.schoolId }),
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

/**
 * Counts students matching the given filters.
 *
 * @param filters - Search and filter parameters (same shape as `findAll` without pagination).
 * @returns The total count of matching students.
 */
export async function count(filters: StudentListFilters) {
  const { search, schoolId, grade, status } = filters;

  const where: Prisma.StudentWhereInput = {};

  if (search) {
    where.OR = [
      { user: { firstName: { contains: search, mode: 'insensitive' } } },
      { user: { lastName: { contains: search, mode: 'insensitive' } } },
      { skills: { hasSome: [search] } },
    ];
  }

  if (schoolId) {
    where.schoolId = schoolId;
  }

  if (grade !== undefined) {
    where.grade = grade;
  }

  if (status) {
    where.user = { status: status as UserStatus };
  }

  return prisma.student.count({ where });
}

/**
 * Finds applications belonging to a student, with pagination.
 *
 * @param studentId - The Student profile UUID.
 * @param filters - Pagination and status filter.
 * @returns Paginated list of applications with internship and company details.
 */
export async function findApplicationsByStudentId(
  studentId: string,
  filters: ApplicationListFilters,
) {
  const { page, pageSize } = filters;
  const skip = (page - 1) * pageSize;

  const where: Prisma.ApplicationWhereInput = {
    studentId,
  };

  if (filters.status) {
    where.status = filters.status as ApplicationStatus;
  }

  return prisma.application.findMany({
    where,
    skip,
    take: pageSize,
    orderBy: { appliedAt: 'desc' },
    include: {
      internship: {
        include: {
          company: {
            select: {
              id: true,
              name: true,
              logoUrl: true,
              city: true,
            },
          },
        },
      },
    },
  });
}

/**
 * Counts applications matching the given filters for a student.
 *
 * @param studentId - The Student profile UUID.
 * @param filters - Status filter (same shape as `findApplicationsByStudentId`).
 * @returns The total count of matching applications.
 */
export async function countApplicationsByStudentId(
  studentId: string,
  filters: ApplicationListFilters,
) {
  const where: Prisma.ApplicationWhereInput = {
    studentId,
  };

  if (filters.status) {
    where.status = filters.status as ApplicationStatus;
  }

  return prisma.application.count({ where });
}

/**
 * Transactionally updates User fields and upserts the Student profile.
 *
 * Wraps both operations in a single `prisma.$transaction()` for atomicity.
 * If the User update succeeds but the Student upsert fails, the entire
 * transaction rolls back. If no User fields are provided, only the
 * Student upsert is performed.
 *
 * @param userId - The User UUID.
 * @param userData - User fields to update (firstName, lastName, phone).
 * @param studentData - Student-specific fields for create/update.
 * @returns The upserted student profile with User and School relations.
 */
export async function upsertUserAndStudent(
  userId: string,
  userData: UpdateProfileData,
  studentData: CreateStudentData,
): Promise<UpsertUserAndStudentResult> {
  return prisma.$transaction(async (tx) => {
    // Update User fields if any were provided
    if (Object.keys(userData).length > 0) {
      await tx.user.update({
        where: { id: userId },
        data: {
          ...(userData.firstName !== undefined && { firstName: userData.firstName }),
          ...(userData.lastName !== undefined && { lastName: userData.lastName }),
          ...(userData.phone !== undefined && { phone: userData.phone }),
        },
      });
    }

    // Upsert the Student profile
    const student = await tx.student.upsert({
      where: { userId },
      create: {
        userId,
        bio: studentData.bio ?? null,
        grade: studentData.grade ?? null,
        dateOfBirth: studentData.dateOfBirth ?? null,
        skills: studentData.skills ?? [],
        interests: studentData.interests ?? [],
        languages: studentData.languages ?? [],
        profileImageUrl: studentData.profileImageUrl ?? null,
        resumeUrl: studentData.resumeUrl ?? null,
        schoolId: studentData.schoolId ?? null,
      },
      update: {
        ...(studentData.bio !== undefined && { bio: studentData.bio }),
        ...(studentData.grade !== undefined && { grade: studentData.grade }),
        ...(studentData.dateOfBirth !== undefined && { dateOfBirth: studentData.dateOfBirth }),
        ...(studentData.skills !== undefined && { skills: studentData.skills }),
        ...(studentData.interests !== undefined && { interests: studentData.interests }),
        ...(studentData.languages !== undefined && { languages: studentData.languages }),
        ...(studentData.profileImageUrl !== undefined && { profileImageUrl: studentData.profileImageUrl }),
        ...(studentData.resumeUrl !== undefined && { resumeUrl: studentData.resumeUrl }),
        ...(studentData.schoolId !== undefined && { schoolId: studentData.schoolId }),
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

    return student as unknown as UpsertUserAndStudentResult;
  });
}
