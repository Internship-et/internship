// ─────────────────────────────────────────────────────────────
// Internship Repository
// Database access layer for all Internship-related queries.
// Must not contain business logic or validation.
// ─────────────────────────────────────────────────────────────

import { prisma } from '../../shared/lib/prisma.js';
import { ConflictError } from '../../shared/errors/app-error.js';
import { Prisma } from '../../generated/prisma/client.js';
import type {
  InternshipStatus as _InternshipStatus,
  InternshipType as _InternshipType,
  ApplicationStatus as _ApplicationStatus,
} from '../../generated/prisma/enums.js';

// Local aliases for convenience
type InternshipStatus = _InternshipStatus;
type InternshipType = _InternshipType;
type ApplicationStatus = _ApplicationStatus;

// ─── Types ──────────────────────────────────────────────────

/** Internship-specific fields for creation (without companyId). */
export interface CreateInternshipData {
  title: string;
  description: string;
  responsibilities?: string[];
  requirements: string[];
  preferredSkills?: string[];
  type: InternshipType;
  city: string;
  address?: string | null;
  durationMonths: number;
  weeklyHours?: number | null;
  startDate?: string | null;
  deadline?: string | null;
  stipend?: Prisma.InputJsonValue | null;
  benefits?: string[];
  tags?: string[];
  minGrade?: number | null;
  maxGrade?: number | null;
}

/** Internship-specific fields for update (all optional). */
export type UpdateInternshipData = Partial<CreateInternshipData> & {
  status?: InternshipStatus;
};

/** Filters for public internship listing. */
export interface InternshipListFilters {
  cursor?: string | null;
  limit: number;
  search?: string;
  companyId?: string;
  city?: string;
  type?: string;
  minDuration?: number;
  maxDuration?: number;
  minGrade?: number;
  maxGrade?: number;
  tags?: string[];
  sort?: string;
  order?: 'asc' | 'desc';
}

/** Application creation data. */
export interface CreateApplicationData {
  internshipId: string;
  studentId: string;
  coverLetter?: string | null;
  additionalInfo?: string | null;
}

// ─── Internal helpers ─────────────────────────────────────

/** Build the `where` clause for public internship listing (ACTIVE + non-deleted). */
function buildListWhere(
  filters: InternshipListFilters,
): Prisma.InternshipWhereInput {
  const where: Prisma.InternshipWhereInput = {
    status: 'ACTIVE' as InternshipStatus,
    deletedAt: null,
  };

  if (filters.search) {
    where.OR = [
      { title: { contains: filters.search, mode: 'insensitive' } },
      { description: { contains: filters.search, mode: 'insensitive' } },
      { city: { contains: filters.search, mode: 'insensitive' } },
      { company: { name: { contains: filters.search, mode: 'insensitive' } } },
    ];
  }

  if (filters.companyId) {
    where.companyId = filters.companyId;
  }

  if (filters.city) {
    where.city = { equals: filters.city, mode: 'insensitive' };
  }

  if (filters.type) {
    where.type = filters.type as InternshipType;
  }

  if (filters.minDuration !== undefined || filters.maxDuration !== undefined) {
    where.durationMonths = {};
    if (filters.minDuration !== undefined) {
      where.durationMonths.gte = filters.minDuration;
    }
    if (filters.maxDuration !== undefined) {
      where.durationMonths.lte = filters.maxDuration;
    }
  }

  if (filters.minGrade !== undefined || filters.maxGrade !== undefined) {
    where.AND = [];
    const gradeConditions: Prisma.InternshipWhereInput[] = [];

    // Internships with a specified minGrade or maxGrade
    if (filters.minGrade !== undefined) {
      gradeConditions.push({ maxGrade: { gte: filters.minGrade } });
    }
    if (filters.maxGrade !== undefined) {
      gradeConditions.push({ minGrade: { lte: filters.maxGrade } });
    }

    // Also include internships with no grade requirement
    where.AND.push({
      OR: [
        ...gradeConditions,
        { minGrade: null, maxGrade: null },
      ],
    });
  }

  if (filters.tags && filters.tags.length > 0) {
    where.tags = { hasSome: filters.tags };
  }

  return where;
}

/** Build Prisma orderBy from sort/order filters (safe switch). */
function buildListOrderBy(
  sort: string,
  order: 'asc' | 'desc',
): Prisma.InternshipOrderByWithRelationInput[] {
  const sortOrder = order ?? 'desc';
  const primaryOrder: Prisma.InternshipOrderByWithRelationInput = {};

  switch (sort) {
    case 'title':
      primaryOrder.title = sortOrder;
      break;
    case 'city':
      primaryOrder.city = sortOrder;
      break;
    case 'type':
      primaryOrder.type = sortOrder;
      break;
    case 'durationMonths':
      primaryOrder.durationMonths = sortOrder;
      break;
    case 'updatedAt':
      primaryOrder.updatedAt = sortOrder;
      break;
    case 'deadline':
      primaryOrder.deadline = sortOrder;
      break;
    case 'startDate':
      primaryOrder.startDate = sortOrder;
      break;
    case 'createdAt':
    default:
      primaryOrder.createdAt = sortOrder;
      break;
  }

  // Tie-breaker: always secondary sort by id
  return [primaryOrder, { id: sortOrder }];
}

// ─── Internship Queries ─────────────────────────────────────

/**
 * Lists ACTIVE internships with cursor-based pagination, search, and filters (public).
 * Returns `limit + 1` rows so the caller can determine hasMore.
 *
 * @param filters - Search, filter, sort, and pagination parameters.
 * @returns List of internships with company and application count.
 */
export async function findAll(filters: InternshipListFilters) {
  const { limit, cursor } = filters;
  const where = buildListWhere(filters);
  const orderBy = buildListOrderBy(filters.sort ?? 'createdAt', filters.order ?? 'desc');

  const paginationInput: { take: number; skip?: number; cursor?: { id: string } } = {
    take: limit + 1, // Fetch one extra to detect hasMore
  };

  if (cursor) {
    paginationInput.skip = 1; // Skip the cursor itself
    paginationInput.cursor = { id: cursor };
  }

  return prisma.internship.findMany({
    where,
    ...paginationInput,
    orderBy,
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

/**
 * Finds a single ACTIVE, non-deleted internship by ID (public).
 *
 * @param id - The Internship UUID.
 * @returns The internship with company and application count, or null.
 */
export async function findById(id: string) {
  return prisma.internship.findFirst({
    where: { id, status: 'ACTIVE' as InternshipStatus, deletedAt: null },
    include: {
      company: {
        select: {
          id: true,
          name: true,
          logoUrl: true,
          city: true,
          industry: true,
          description: true,
          website: true,
          size: true,
          foundedYear: true,
          isVerified: true,
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

/**
 * Finds an internship by ID with NO status or deletedAt filter (for ownership checks).
 *
 * @param id - The Internship UUID.
 * @returns The internship with company and application count, or null.
 */
export async function findByIdUnscoped(id: string) {
  return prisma.internship.findUnique({
    where: { id },
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

/**
 * Creates a new internship (defaults to DRAFT status).
 *
 * @param data - Internship fields plus companyId.
 * @returns The newly created internship with company relation.
 */
export async function create(data: CreateInternshipData & { companyId: string }) {
  return prisma.internship.create({
    data: {
      companyId: data.companyId,
      title: data.title,
      description: data.description,
      responsibilities: data.responsibilities ?? [],
      requirements: data.requirements,
      preferredSkills: data.preferredSkills ?? [],
      type: data.type,
      city: data.city,
      address: data.address ?? null,
      durationMonths: data.durationMonths,
      weeklyHours: data.weeklyHours ?? null,
      startDate: data.startDate ? new Date(data.startDate) : null,
      deadline: data.deadline ? new Date(data.deadline) : null,
      stipend: (data.stipend as Prisma.InputJsonValue) ?? undefined,
      benefits: data.benefits ?? [],
      tags: data.tags ?? [],
      minGrade: data.minGrade ?? null,
      maxGrade: data.maxGrade ?? null,
      status: 'DRAFT', // Always DRAFT on creation
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
    },
  });
}

/**
 * Updates an existing internship.
 *
 * @param id - The Internship UUID.
 * @param data - Internship fields to update (all optional, may include status).
 * @returns The updated internship with company relation.
 */
export async function update(id: string, data: UpdateInternshipData) {
  const updateData: Prisma.InternshipUpdateInput = {};

  if (data.title !== undefined) { updateData.title = data.title; }
  if (data.description !== undefined) { updateData.description = data.description; }
  if (data.responsibilities !== undefined) { updateData.responsibilities = data.responsibilities; }
  if (data.requirements !== undefined) { updateData.requirements = data.requirements; }
  if (data.preferredSkills !== undefined) { updateData.preferredSkills = data.preferredSkills; }
  if (data.type !== undefined) { updateData.type = data.type; }
  if (data.city !== undefined) { updateData.city = data.city; }
  if (data.address !== undefined) { updateData.address = data.address; }
  if (data.durationMonths !== undefined) { updateData.durationMonths = data.durationMonths; }
  if (data.weeklyHours !== undefined) { updateData.weeklyHours = data.weeklyHours; }
  if (data.startDate !== undefined) { updateData.startDate = data.startDate ? new Date(data.startDate) : null; }
  if (data.deadline !== undefined) { updateData.deadline = data.deadline ? new Date(data.deadline) : null; }
  if (data.stipend !== undefined) { updateData.stipend = data.stipend as Prisma.InputJsonValue; }
  if (data.benefits !== undefined) { updateData.benefits = data.benefits; }
  if (data.tags !== undefined) { updateData.tags = data.tags; }
  if (data.minGrade !== undefined) { updateData.minGrade = data.minGrade; }
  if (data.maxGrade !== undefined) { updateData.maxGrade = data.maxGrade; }
  if (data.status !== undefined) { updateData.status = data.status; }

  return prisma.internship.update({
    where: { id },
    data: updateData,
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

/**
 * Soft-deletes an internship — sets status to CLOSED and deletedAt timestamp.
 *
 * @param id - The Internship UUID.
 * @returns The updated internship with company relation.
 */
export async function softDelete(id: string) {
  return prisma.internship.update({
    where: { id },
    data: {
      status: 'CLOSED' as InternshipStatus,
      deletedAt: new Date(),
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
    },
  });
}

/**
 * Counts internships matching the given filters (ACTIVE, non-deleted).
 *
 * @param filters - Search and filter parameters.
 * @returns The total count of matching internships.
 */
export async function count(filters: InternshipListFilters) {
  const where = buildListWhere(filters);
  return prisma.internship.count({ where });
}

// ─── Application Queries ────────────────────────────────────

/**
 * Finds an existing application by internship and student (duplicate check).
 *
 * @param internshipId - The Internship UUID.
 * @param studentId - The Student profile UUID.
 * @returns The application if found, or null.
 */
export async function findApplicationByInternshipAndStudent(
  internshipId: string,
  studentId: string,
) {
  return prisma.application.findUnique({
    where: {
      internshipId_studentId: {
        internshipId,
        studentId,
      },
    },
    select: { id: true },
  });
}

/**
 * Creates a new application with PENDING status.
 * Handles unique constraint violations (P2002) by throwing ConflictError.
 *
 * @param data - Application data (internshipId, studentId, coverLetter, additionalInfo).
 * @returns The newly created application with selected fields.
 *
 * @throws {ConflictError} If the student already applied (P2002).
 */
export async function createApplication(data: CreateApplicationData) {
  try {
    return await prisma.application.create({
      data: {
        internshipId: data.internshipId,
        studentId: data.studentId,
        status: 'PENDING' as ApplicationStatus,
        coverLetter: data.coverLetter ?? null,
        additionalInfo: data.additionalInfo ?? null,
      },
      select: {
        id: true,
        internshipId: true,
        studentId: true,
        status: true,
        appliedAt: true,
      },
    });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    ) {
      throw new ConflictError('You have already applied to this internship');
    }
    throw error;
  }
}

/**
 * Counts applications with ACCEPTED status for a given internship.
 *
 * @param internshipId - The Internship UUID.
 * @returns The number of accepted applications.
 */
export async function countAcceptedApplications(internshipId: string): Promise<number> {
  return prisma.application.count({
    where: {
      internshipId,
      status: 'ACCEPTED' as ApplicationStatus,
    },
  });
}
