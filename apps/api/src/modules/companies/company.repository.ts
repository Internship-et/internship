// ─────────────────────────────────────────────────────────────
// Company Repository
// Database access layer for all Company-related queries.
// Must not contain business logic or validation.
// ─────────────────────────────────────────────────────────────

import { prisma } from '../../shared/lib/prisma.js';
import type { Prisma } from '../../generated/prisma/client.js';
import type {
  CompanySize,
  InternshipStatus,
  ApplicationStatus,
} from '../../generated/prisma/enums.js';

// ─── Types ──────────────────────────────────────────────────

/** Company-specific fields for creation (without userId). */
export interface CreateCompanyData {
  name: string;
  industry: string;
  description?: string | null;
  city: string;
  address?: string | null;
  size?: CompanySize | null;
  foundedYear?: number | null;
  website?: string | null;
  logoUrl?: string | null;
  socialLinks?: Prisma.InputJsonValue | null;
  tinNumber?: string | null;
}

/** Company-specific fields for update (all optional). */
export type UpdateCompanyData = Partial<CreateCompanyData>;

/** Filters for public company listing. */
export interface CompanyListFilters {
  page: number;
  pageSize: number;
  search?: string;
  industry?: string;
  city?: string;
  hasActiveInternships?: boolean;
  sort?: string;
  order?: 'asc' | 'desc';
}

/** Filters for company internship listing. */
export interface InternshipListFilters {
  page: number;
  pageSize: number;
}

/** Filters for company application listing. */
export interface ApplicationListFilters {
  internshipId?: string;
  status?: string;
  page: number;
  pageSize: number;
  sort?: string;
  order?: 'asc' | 'desc';
}

/** Public-facing company shape (no tinNumber or userId). */
const companyPublicSelect = {
  id: true,
  name: true,
  industry: true,
  description: true,
  logoUrl: true,
  website: true,
  city: true,
  address: true,
  size: true,
  foundedYear: true,
  socialLinks: true,
  isVerified: true,
  createdAt: true,
  updatedAt: true,
} as const;

/** Included user relation fields (public-safe). */
const userSelect = {
  select: {
    id: true,
    email: true,
    firstName: true,
    lastName: true,
    phone: true,
  },
} as const;

// ─── Company Queries ────────────────────────────────────────

/**
 * Lists companies with pagination, search, filter, and sort (public).
 *
 * @param filters - Pagination, search, and filter parameters.
 * @returns Paginated list of companies with active internship count.
 */
export async function findAll(filters: CompanyListFilters) {
  const { page, pageSize, search, industry, city, hasActiveInternships, sort, order } = filters;
  const skip = (page - 1) * pageSize;

  // Build the where clause
  const where: Prisma.CompanyWhereInput = {
    deletedAt: null, // Exclude soft-deleted
  };

  if (search) {
    where.OR = [
      { name: { contains: search, mode: 'insensitive' } },
      { description: { contains: search, mode: 'insensitive' } },
    ];
  }

  if (industry) {
    where.industry = { equals: industry, mode: 'insensitive' };
  }

  if (city) {
    where.city = { equals: city, mode: 'insensitive' };
  }

  if (hasActiveInternships === true) {
    where.internships = {
      some: {
        status: 'ACTIVE' as InternshipStatus,
        deletedAt: null,
      },
    };
  }

  if (hasActiveInternships === false) {
    where.internships = {
      none: {
        status: 'ACTIVE' as InternshipStatus,
        deletedAt: null,
      },
    };
  }

  // Build orderBy — safe because schema enforces strict enum
  const orderBy: Prisma.CompanyOrderByWithRelationInput = {};
  const sortField = sort ?? 'createdAt';
  const sortOrder = order ?? 'desc';

  if (['name', 'industry', 'city', 'updatedAt'].includes(sortField)) {
    orderBy[sortField as 'name' | 'industry' | 'city' | 'updatedAt'] = sortOrder;
  } else {
    orderBy.createdAt = sortOrder;
  }

  return prisma.company.findMany({
    where,
    skip,
    take: pageSize,
    orderBy,
    select: {
      ...companyPublicSelect,
      user: userSelect,
      _count: {
        select: {
          internships: {
            where: { status: 'ACTIVE' as InternshipStatus, deletedAt: null },
          },
        },
      },
    },
  });
}

/**
 * Finds a single company by ID (public — excludes soft-deleted).
 *
 * @param id - The Company UUID.
 * @returns The company with user relation and internships, or null.
 */
export async function findById(id: string) {
  return prisma.company.findFirst({
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
      internships: {
        select: {
          id: true,
          status: true,
          deletedAt: true,
        },
      },
    },
  });
}

/**
 * Finds a company by User ID (for ownership checks).
 *
 * @param userId - The User UUID.
 * @returns The company with user relation, or null.
 */
export async function findByUserId(userId: string) {
  return prisma.company.findFirst({
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
 * Finds a company by exact name (uniqueness check).
 *
 * @param name - The company name.
 * @returns The company (including soft-deleted if exists), or null.
 */
export async function findByName(name: string) {
  return prisma.company.findFirst({
    where: { name },
  });
}

/**
 * Finds a company by TIN number (uniqueness check).
 *
 * @param tinNumber - The TIN number.
 * @returns The company (including soft-deleted if exists), or null.
 */
export async function findByTinNumber(tinNumber: string) {
  return prisma.company.findFirst({
    where: { tinNumber },
  });
}

/**
 * Creates a new Company profile.
 *
 * @param data - Object containing userId and company-specific fields.
 * @returns The newly created company with user relation.
 */
export async function create(data: { userId: string } & CreateCompanyData) {
  return prisma.company.create({
    data: {
      userId: data.userId,
      name: data.name,
      industry: data.industry,
      description: data.description ?? null,
      city: data.city,
      address: data.address ?? null,
      size: data.size ?? null,
      foundedYear: data.foundedYear ?? null,
      website: data.website ?? null,
      logoUrl: data.logoUrl ?? null,
      socialLinks: (data.socialLinks as Prisma.InputJsonValue) ?? undefined,
      tinNumber: data.tinNumber ?? null,
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

/**
 * Updates Company-specific fields on an existing profile.
 *
 * @param id - The Company UUID.
 * @param data - Company-specific fields to update (all optional).
 * @returns The updated company with user relation.
 */
export async function update(id: string, data: UpdateCompanyData) {
  return prisma.company.update({
    where: { id },
    data: {
      ...(data.name !== undefined && { name: data.name }),
      ...(data.industry !== undefined && { industry: data.industry }),
      ...(data.description !== undefined && { description: data.description }),
      ...(data.city !== undefined && { city: data.city }),
      ...(data.address !== undefined && { address: data.address }),
      ...(data.size !== undefined && { size: data.size }),
      ...(data.foundedYear !== undefined && { foundedYear: data.foundedYear }),
      ...(data.website !== undefined && { website: data.website }),
      ...(data.logoUrl !== undefined && { logoUrl: data.logoUrl }),
      ...(data.socialLinks !== undefined && { socialLinks: data.socialLinks as Prisma.InputJsonValue }),
      ...(data.tinNumber !== undefined && { tinNumber: data.tinNumber }),
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

/**
 * Counts companies matching the given filters.
 *
 * @param filters - Search and filter parameters.
 * @returns The total count of matching (non-deleted) companies.
 */
export async function count(filters: CompanyListFilters) {
  const { search, industry, city, hasActiveInternships } = filters;

  const where: Prisma.CompanyWhereInput = {
    deletedAt: null,
  };

  if (search) {
    where.OR = [
      { name: { contains: search, mode: 'insensitive' } },
      { description: { contains: search, mode: 'insensitive' } },
    ];
  }

  if (industry) {
    where.industry = { equals: industry, mode: 'insensitive' };
  }

  if (city) {
    where.city = { equals: city, mode: 'insensitive' };
  }

  if (hasActiveInternships === true) {
    where.internships = {
      some: { status: 'ACTIVE' as InternshipStatus, deletedAt: null },
    };
  }

  if (hasActiveInternships === false) {
    where.internships = {
      none: { status: 'ACTIVE' as InternshipStatus, deletedAt: null },
    };
  }

  return prisma.company.count({ where });
}

// ─── Internship Queries ─────────────────────────────────────

/**
 * Finds internships belonging to a company (public — ACTIVE only).
 *
 * @param companyId - The Company UUID.
 * @param filters - Pagination parameters.
 * @returns Paginated list of ACTIVE internships with no application count.
 */
export async function findInternshipsByCompanyId(
  companyId: string,
  filters: InternshipListFilters,
) {
  const { page, pageSize } = filters;
  const skip = (page - 1) * pageSize;

  const where: Prisma.InternshipWhereInput = {
    companyId,
    status: 'ACTIVE' as InternshipStatus,
    deletedAt: null,
  };

  return prisma.internship.findMany({
    where,
    skip,
    take: pageSize,
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      title: true,
      description: true,
      type: true,
      city: true,
      durationMonths: true,
      weeklyHours: true,
      startDate: true,
      deadline: true,
      stipend: true,
      tags: true,
      status: true,
      createdAt: true,
      updatedAt: true,
    },
  });
}

/**
 * Counts ACTIVE internships for a company.
 *
 * @param companyId - The Company UUID.
 * @param filters - Pagination parameters (unused, for consistent interface).
 * @returns The total count of ACTIVE internships.
 */
export async function countInternshipsByCompanyId(
  companyId: string,
  _filters: InternshipListFilters,
) {
  return prisma.internship.count({
    where: {
      companyId,
      status: 'ACTIVE' as InternshipStatus,
      deletedAt: null,
    },
  });
}

// ─── Application Queries ────────────────────────────────────

/**
 * Finds applications to a company's internships (scoped — OWNER/ADMIN only).
 *
 * @param companyId - The Company UUID.
 * @param filters - Filter and pagination parameters.
 * @returns Paginated list of applications with student and internship details.
 */
export async function findApplicationsByCompanyId(
  companyId: string,
  filters: ApplicationListFilters,
) {
  const { internshipId, status, page, pageSize, sort, order } = filters;
  const skip = (page - 1) * pageSize;

  const where: Prisma.ApplicationWhereInput = {
    internship: {
      companyId,
      deletedAt: null,
    },
  };

  if (internshipId) {
    where.internshipId = internshipId;
  }

  if (status) {
    where.status = status as ApplicationStatus;
  }

  // Build orderBy
  const orderBy: Prisma.ApplicationOrderByWithRelationInput = {};
  const sortField = sort ?? 'appliedAt';
  const sortOrder = order ?? 'desc';

  if (sortField === 'status') {
    orderBy.status = sortOrder;
  } else if (sortField === 'updatedAt') {
    orderBy.updatedAt = sortOrder;
  } else {
    orderBy.appliedAt = sortOrder;
  }

  return prisma.application.findMany({
    where,
    skip,
    take: pageSize,
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
              firstName: true,
              lastName: true,
              email: true,
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
    },
  });
}

/**
 * Counts applications matching the given filters for a company.
 *
 * @param companyId - The Company UUID.
 * @param filters - Filter parameters.
 * @returns The total count of matching applications.
 */
export async function countApplicationsByCompanyId(
  companyId: string,
  filters: ApplicationListFilters,
) {
  const { internshipId, status } = filters;

  const where: Prisma.ApplicationWhereInput = {
    internship: {
      companyId,
      deletedAt: null,
    },
  };

  if (internshipId) {
    where.internshipId = internshipId;
  }

  if (status) {
    where.status = status as ApplicationStatus;
  }

  return prisma.application.count({ where });
}
