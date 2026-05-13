// ─────────────────────────────────────────────────────────────
// School Repository
// Database access layer for all School-related queries.
// Must not contain business logic or validation.
// ─────────────────────────────────────────────────────────────

import { prisma } from '../../shared/lib/prisma.js';
import type { Prisma } from '../../generated/prisma/client.js';
import type { SchoolType } from '../../generated/prisma/enums.js';

// ─── Types ──────────────────────────────────────────────────

/** School-specific fields for creation (without userId). */
export interface CreateSchoolData {
  name: string;
  type: SchoolType;
  city: string;
  address?: string | null;
  phone?: string | null;
  email?: string | null;
  website?: string | null;
  principal?: string | null;
  gradesOffered?: number[] | null;
  logoUrl?: string | null;
  licenseNumber?: string | null;
}

/** School-specific fields for update (all optional). */
export type UpdateSchoolData = Partial<CreateSchoolData>;

/** Filters for public school listing. */
export interface SchoolListFilters {
  page: number;
  pageSize: number;
  search?: string;
  city?: string;
  type?: SchoolType;
  sort?: string;
  order?: 'asc' | 'desc';
}

/** Audit log creation data for verification events. */
export interface CreateAuditLogData {
  userId: string;
  action: string;
  entity: string;
  entityId: string;
  oldValue?: Record<string, unknown> | null;
  newValue?: Record<string, unknown> | null;
}

/** Public-facing school shape (no userId or licenseNumber). */
const schoolPublicSelect = {
  id: true,
  name: true,
  type: true,
  city: true,
  address: true,
  phone: true,
  email: true,
  website: true,
  principal: true,
  gradesOffered: true,
  logoUrl: true,
  isVerified: true,
  createdAt: true,
  updatedAt: true,
} as const;

// ─── School Queries ─────────────────────────────────────────

/**
 * Lists schools with offset pagination, search, filter, and sort (public).
 *
 * @param filters - Pagination, search, and filter parameters.
 * @returns Paginated list of schools.
 */
export async function findAll(filters: SchoolListFilters) {
  const { page, pageSize, search, city, type, sort, order } = filters;
  const skip = (page - 1) * pageSize;

  // Build the where clause
  const where: Prisma.SchoolWhereInput = {
    deletedAt: null, // Exclude soft-deleted
  };

  if (search) {
    where.OR = [
      { name: { contains: search, mode: 'insensitive' } },
      { city: { contains: search, mode: 'insensitive' } },
    ];
  }

  if (city) {
    where.city = { equals: city, mode: 'insensitive' };
  }

  if (type) {
    where.type = type;
  }

  // Build orderBy — safe because schema enforces strict enum
  const orderBy: Prisma.SchoolOrderByWithRelationInput = {};
  const sortField = sort ?? 'name';
  const sortOrder = order ?? 'asc';

  if (['name', 'city', 'type', 'createdAt', 'updatedAt'].includes(sortField)) {
    if (sortField === 'type') {
      orderBy.type = sortOrder;
    } else if (sortField === 'createdAt') {
      orderBy.createdAt = sortOrder;
    } else if (sortField === 'updatedAt') {
      orderBy.updatedAt = sortOrder;
    } else if (sortField === 'city') {
      orderBy.city = sortOrder;
    } else {
      orderBy.name = sortOrder;
    }
  } else {
    orderBy.name = sortOrder;
  }

  return prisma.school.findMany({
    where,
    skip,
    take: pageSize,
    orderBy,
    select: {
      ...schoolPublicSelect,
      userId: false, // Ensure userId not returned
      licenseNumber: false, // Ensure licenseNumber not returned
      _count: {
        select: {
          students: true,
        },
      },
    },
  });
}

/**
 * Counts schools matching the given filters (public).
 *
 * @param filters - Search and filter parameters.
 * @returns The total count of matching (non-deleted) schools.
 */
export async function count(filters: SchoolListFilters) {
  const { search, city, type } = filters;

  const where: Prisma.SchoolWhereInput = {
    deletedAt: null,
  };

  if (search) {
    where.OR = [
      { name: { contains: search, mode: 'insensitive' } },
      { city: { contains: search, mode: 'insensitive' } },
    ];
  }

  if (city) {
    where.city = { equals: city, mode: 'insensitive' };
  }

  if (type) {
    where.type = type;
  }

  return prisma.school.count({ where });
}

/**
 * Counts verified students for a list of school IDs.
 * Returns a map of schoolId -> verifiedStudentCount.
 *
 * @param schoolIds - Array of school UUIDs.
 * @returns Map of school ID to verified student count.
 */
export async function countVerifiedStudentsBySchoolIds(schoolIds: string[]) {
  if (schoolIds.length === 0) {
    return new Map<string, number>();
  }

  const groups = await prisma.student.groupBy({
    by: ['schoolId'],
    where: {
      schoolId: { in: schoolIds },
      isSchoolVerified: true,
    },
    _count: {
      schoolId: true,
    },
  });

  const map = new Map<string, number>();
  for (const group of groups) {
    if (group.schoolId) {
      map.set(group.schoolId, group._count.schoolId);
    }
  }
  return map;
}

/**
 * Finds a single school by ID (public — excludes soft-deleted).
 *
 * @param id - The School UUID.
 * @returns The school with user relation and student counts, or null.
 */
export async function findById(id: string) {
  return prisma.school.findFirst({
    where: { id, deletedAt: null },
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

/**
 * Finds a school by User ID (for ownership checks).
 *
 * @param userId - The User UUID.
 * @returns The school with user relation, or null.
 */
export async function findByUserId(userId: string) {
  return prisma.school.findFirst({
    where: { userId, deletedAt: null },
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

/**
 * Finds a school by exact name (uniqueness check).
 *
 * @param name - The school name.
 * @returns The school (including soft-deleted if exists), or null.
 */
export async function findByName(name: string) {
  return prisma.school.findFirst({
    where: { name },
  });
}

/**
 * Creates a new School profile.
 *
 * @param data - Object containing userId and school-specific fields.
 * @returns The newly created school with user relation.
 */
export async function create(data: { userId: string } & CreateSchoolData) {
  return prisma.school.create({
    data: {
      userId: data.userId,
      name: data.name,
      type: data.type,
      city: data.city,
      address: data.address ?? null,
      phone: data.phone ?? null,
      email: data.email ?? null,
      website: data.website ?? null,
      principal: data.principal ?? null,
      gradesOffered: data.gradesOffered ?? [],
      logoUrl: data.logoUrl ?? null,
      licenseNumber: data.licenseNumber ?? null,
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

/**
 * Updates School-specific fields on an existing profile.
 *
 * @param id - The School UUID.
 * @param data - School-specific fields to update (all optional).
 * @returns The updated school with user relation.
 */
export async function update(id: string, data: UpdateSchoolData) {
  return prisma.school.update({
    where: { id },
    data: {
      ...(data.name !== undefined && { name: data.name }),
      ...(data.type !== undefined && { type: data.type }),
      ...(data.city !== undefined && { city: data.city }),
      ...(data.address !== undefined && { address: data.address ?? null }),
      ...(data.phone !== undefined && { phone: data.phone ?? null }),
      ...(data.email !== undefined && { email: data.email ?? null }),
      ...(data.website !== undefined && { website: data.website ?? null }),
      ...(data.principal !== undefined && { principal: data.principal ?? null }),
      ...(data.gradesOffered !== undefined && { gradesOffered: data.gradesOffered ?? undefined }),
      ...(data.logoUrl !== undefined && { logoUrl: data.logoUrl ?? null }),
      ...(data.licenseNumber !== undefined && { licenseNumber: data.licenseNumber ?? null }),
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

// ─── Student Verification Queries ──────────────────────────

/**
 * Finds a student by ID (for verification checks).
 *
 * @param studentId - The Student UUID.
 * @returns The student, or null.
 */
export async function findStudentForVerification(studentId: string) {
  return prisma.student.findUnique({
    where: { id: studentId },
    select: {
      id: true,
      schoolId: true,
      grade: true,
      isSchoolVerified: true,
    },
  });
}

/**
 * Updates a student's verification status.
 *
 * @param studentId - The Student UUID.
 * @param data - Fields to update on the student.
 * @returns The updated student.
 */
export async function updateStudentVerification(
  studentId: string,
  data: { isSchoolVerified: boolean; grade?: number | null },
) {
  return prisma.student.update({
    where: { id: studentId },
    data: {
      isSchoolVerified: data.isSchoolVerified,
      ...(data.grade !== undefined && { grade: data.grade }),
    },
    select: {
      id: true,
      schoolId: true,
      grade: true,
      isSchoolVerified: true,
      updatedAt: true,
    },
  });
}

// ─── Audit Log ─────────────────────────────────────────────

/**
 * Creates an audit log entry for verification/revocation events.
 *
 * @param data - Audit log data.
 * @returns The created audit log entry.
 */
export async function createAuditLog(data: CreateAuditLogData) {
  return prisma.auditLog.create({
    data: {
      userId: data.userId,
      action: data.action,
      entity: data.entity,
      entityId: data.entityId,
      oldValue: data.oldValue as Prisma.InputJsonValue | undefined,
      newValue: data.newValue as Prisma.InputJsonValue | undefined,
    },
  });
}
