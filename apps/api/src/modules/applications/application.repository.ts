// ─────────────────────────────────────────────────────────────
// Application Repository
// Database access layer for all Application-related queries.
// Must not contain business logic or validation.
// ─────────────────────────────────────────────────────────────

import { prisma } from '../../shared/lib/prisma.js';
import type { Prisma } from '../../generated/prisma/client.js';
import type { ApplicationStatus } from '../../generated/prisma/enums.js';

// ─── Types ──────────────────────────────────────────────────

/** Filters for application listing with cursor-based pagination. */
export interface ApplicationListFilters {
  studentId?: string;
  companyId?: string;
  status?: string;
  internshipId?: string;
  cursor?: string | null;
  limit: number;
  sort?: string;
  order?: 'asc' | 'desc';
}

/** Data for creating an ApplicationStatusHistory entry. */
export interface CreateStatusHistoryData {
  applicationId: string;
  fromStatus: ApplicationStatus;
  toStatus: ApplicationStatus;
  changedById: string;
  note?: string | null;
}

// ─── Internal helpers ─────────────────────────────────────

/** Build Prisma orderBy from sort/order filters (safe switch for Application). */
function buildListOrderBy(
  sort: string,
  order: 'asc' | 'desc',
): Prisma.ApplicationOrderByWithRelationInput[] {
  const sortOrder = order ?? 'desc';
  const primaryOrder: Prisma.ApplicationOrderByWithRelationInput = {};

  switch (sort) {
    case 'updatedAt':
      primaryOrder.updatedAt = sortOrder;
      break;
    case 'status':
      primaryOrder.status = sortOrder;
      break;
    case 'appliedAt':
    default:
      primaryOrder.appliedAt = sortOrder;
      break;
  }

  // Tie-breaker: always secondary sort by id
  return [primaryOrder, { id: sortOrder }];
}

// ─── Application Queries ─────────────────────────────────────

/**
 * Finds a single application by ID with full relations.
 * Used for detail view, ownership checks, and status updates.
 *
 * @param id - The Application UUID.
 * @returns The application with student (user), internship (company), and statusHistory, or null.
 */
export async function findById(id: string) {
  return prisma.application.findUnique({
    where: { id },
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

/**
 * Lists applications with cursor-based pagination, scoping, and filters.
 * Returns `limit + 1` rows so the caller can determine hasMore.
 *
 * Scoping (mutually exclusive — service layer chooses which):
 * - `studentId` set → filter by application.studentId (STUDENT path)
 * - `companyId` set → filter by application.internship.companyId (COMPANY path)
 * - Neither → no student/company filter (ADMIN path)
 *
 * @param filters - Scope, filter, sort, and pagination parameters.
 * @returns List of applications with student, internship, and company relations.
 */
export async function findAll(filters: ApplicationListFilters) {
  const { studentId, companyId, status, internshipId, cursor, limit, sort, order } = filters;
  const orderBy = buildListOrderBy(sort ?? 'appliedAt', order ?? 'desc');

  // Build where clause
  const where: Prisma.ApplicationWhereInput = {};

  if (studentId) {
    where.studentId = studentId;
  }

  if (companyId) {
    where.internship = { companyId };
  }

  if (status) {
    where.status = status as ApplicationStatus;
  }

  if (internshipId) {
    where.internshipId = internshipId;
  }

  // Build cursor pagination
  const paginationInput: { take: number; skip?: number; cursor?: { id: string } } = {
    take: limit + 1, // Fetch one extra to detect hasMore
  };

  if (cursor) {
    paginationInput.skip = 1; // Skip the cursor itself
    paginationInput.cursor = { id: cursor };
  }

  return prisma.application.findMany({
    where,
    ...paginationInput,
    orderBy,
    include: {
      student: {
        select: {
          id: true,
          grade: true,
          resumeUrl: true,
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
        select: {
          id: true,
          title: true,
          status: true,
          companyId: true,
        },
      },
      statusHistory: {
        orderBy: { createdAt: 'asc' },
      },
    },
  });
}

/**
 * Updates the status of an application.
 *
 * @param id - The Application UUID.
 * @param status - The new ApplicationStatus value.
 * @returns The updated application.
 */
export async function updateStatus(id: string, status: ApplicationStatus) {
  return prisma.application.update({
    where: { id },
    data: { status },
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

/**
 * Creates an immutable ApplicationStatusHistory record.
 *
 * @param data - Status transition data (fromStatus, toStatus, changedById, note).
 * @returns The newly created status history entry.
 */
export async function createStatusHistory(data: CreateStatusHistoryData) {
  return prisma.applicationStatusHistory.create({
    data: {
      applicationId: data.applicationId,
      fromStatus: data.fromStatus,
      toStatus: data.toStatus,
      changedById: data.changedById,
      note: data.note ?? null,
    },
  });
}

/**
 * Withdraws an application — sets status to WITHDRAWN.
 *
 * @param id - The Application UUID.
 * @returns The updated application.
 */
export async function withdraw(id: string) {
  return prisma.application.update({
    where: { id },
    data: { status: 'WITHDRAWN' as ApplicationStatus },
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
