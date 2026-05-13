// ─────────────────────────────────────────────────────────────
// Company Service
// Business logic for all Company module operations.
// Must not import Prisma directly — all DB access goes through repository.
// ─────────────────────────────────────────────────────────────

import { NotFoundError, ForbiddenError, ConflictError } from '../../shared/errors/app-error.js';
import {
  buildOffsetPaginationMeta,
  getOffsetPaginationInput,
} from '../../shared/utils/pagination.js';
import * as companyRepository from './company.repository.js';
import type {
  CompanyListFilters,
  InternshipListFilters,
  ApplicationListFilters,
} from './company.repository.js';
import type { CreateCompanyInput, UpdateCompanyInput } from './company.schema.js';

// ─── Helpers ────────────────────────────────────────────────

/**
 * Type used for mapping company list results — adds `activeInternshipCount`
 * derived from `_count.internships` and strips sensitive fields:
 * `tinNumber`, `userId`, `user`, and `socialLinks` (detail-only field).
 */
interface PublicCompanyListEntry {
  id: string;
  name: string;
  industry: string;
  description: string | null;
  logoUrl: string | null;
  website: string | null;
  city: string;
  address: string | null;
  size: CompanySize | null;
  foundedYear: number | null;
  isVerified: boolean;
  createdAt: Date;
  updatedAt: Date;
  activeInternshipCount: number;
}

import type { CompanySize } from '../../generated/prisma/enums.js';

// ─── Public Service Functions ───────────────────────────────

/**
 * Public paginated listing of all companies.
 *
 * Supports search (name, description), filter by industry/city/
 * hasActiveInternships, sort, and offset-based pagination.
 * Strips sensitive fields (tinNumber, userId) from every result.
 * Adds `activeInternshipCount` derived from `_count`.
 *
 * @param filters - Search, filter, sort, and pagination parameters.
 * @returns Paginated list of companies with pagination meta.
 */
export async function list(filters: CompanyListFilters) {
  const paginationInput = getOffsetPaginationInput({
    page: filters.page,
    pageSize: filters.pageSize,
  });

  const [companies, total] = await Promise.all([
    companyRepository.findAll({
      ...filters,
      ...paginationInput,
    }),
    companyRepository.count(filters),
  ]);

  // Map results: strip sensitive fields (tinNumber, userId, user, socialLinks), add activeInternshipCount
  const data: PublicCompanyListEntry[] = companies.map((company) => {
    const activeInternshipCount = company._count?.internships ?? 0;
    return {
      id: company.id,
      name: company.name,
      industry: company.industry,
      description: company.description,
      logoUrl: company.logoUrl,
      website: company.website,
      city: company.city,
      address: company.address,
      size: company.size,
      foundedYear: company.foundedYear,
      isVerified: company.isVerified,
      createdAt: company.createdAt,
      updatedAt: company.updatedAt,
      activeInternshipCount,
    };
  });

  const meta = buildOffsetPaginationMeta(
    { page: filters.page, pageSize: filters.pageSize },
    total,
  );

  return { data, meta };
}

/**
 * Retrieves a single company profile by Company UUID (public).
 *
 * @param id - The Company UUID.
 * @returns The company profile with user info, activeInternshipCount,
 *          and totalInternshipsCompleted. Sensitive fields stripped.
 *
 * @throws {NotFoundError} If the company profile does not exist.
 */
export async function getById(id: string) {
  const company = await companyRepository.findById(id);

  if (!company) {
    throw new NotFoundError('Company profile not found');
  }

  // Count internships
  const activeInternshipCount = company.internships.filter(
    (i) => i.status === 'ACTIVE' && !i.deletedAt,
  ).length;

  const totalInternshipsCompleted = company.internships.filter(
    (i) => i.status === 'CLOSED' && !i.deletedAt,
  ).length;

  // Return public-safe profile (strip tinNumber, userId, and user relation)
  const { tinNumber: _tin, userId: _uid, internships: _ints, user: _user, ...safe } = company;

  return {
    ...safe,
    activeInternshipCount,
    totalInternshipsCompleted,
  };
}

/**
 * Creates a new company profile for the authenticated user.
 *
 * Business rules:
 * - One company per user account
 * - Company name must be unique
 * - TIN number (if provided) must be unique
 *
 * @param data - Company profile input data.
 * @param userId - The authenticated user's UUID.
 * @returns The newly created company profile.
 *
 * @throws {ConflictError} If the user already has a company profile.
 * @throws {ConflictError} If the company name already exists.
 * @throws {ConflictError} If the TIN number already exists.
 */
export async function create(data: CreateCompanyInput, userId: string) {
  // Check one-company-per-user
  const existingProfile = await companyRepository.findByUserId(userId);
  if (existingProfile) {
    throw new ConflictError('User already has a company profile');
  }

  // Check name uniqueness
  const existingName = await companyRepository.findByName(data.name);
  if (existingName) {
    throw new ConflictError('Company name already in use');
  }

  // Check TIN uniqueness (if provided)
  if (data.tinNumber) {
    const existingTin = await companyRepository.findByTinNumber(data.tinNumber);
    if (existingTin) {
      throw new ConflictError('TIN number already in use');
    }
  }

  const company = await companyRepository.create({ ...data, userId });
  return company;
}

/**
 * Updates an existing Company profile by Company UUID.
 *
 * Ownership: requester must own the company OR be ADMIN.
 * Name/TIN uniqueness checked on change (current company ID is
 * not treated as a conflict).
 *
 * @param id - The Company UUID.
 * @param data - Company fields to update.
 * @param requestingUserId - The authenticated user's UUID.
 * @param requestingUserRole - The authenticated user's role.
 * @returns The updated company profile.
 *
 * @throws {NotFoundError} If the company profile does not exist.
 * @throws {ForbiddenError} If the requester is neither the owner nor ADMIN.
 * @throws {ConflictError} If the new name is already in use.
 * @throws {ConflictError} If the new TIN number is already in use.
 */
export async function update(
  id: string,
  data: UpdateCompanyInput,
  requestingUserId: string,
  requestingUserRole: string,
) {
  // Verify the company exists
  const existing = await companyRepository.findById(id);
  if (!existing) {
    throw new NotFoundError('Company profile not found');
  }

  // Authorization: owner or ADMIN only
  const isOwner = existing.userId === requestingUserId;
  const isAdmin = requestingUserRole === 'ADMIN';

  if (!isOwner && !isAdmin) {
    throw new ForbiddenError('You do not have permission to update this profile');
  }

  // Check name uniqueness on change (skip if name unchanged or not provided)
  if (data.name !== undefined && data.name !== existing.name) {
    const nameMatch = await companyRepository.findByName(data.name);
    if (nameMatch && nameMatch.id !== id) {
      throw new ConflictError('Company name already in use');
    }
  }

  // Check TIN uniqueness on change (skip if tinNumber unchanged or not provided)
  if (data.tinNumber !== undefined && data.tinNumber !== existing.tinNumber) {
    const tinMatch = await companyRepository.findByTinNumber(data.tinNumber);
    if (tinMatch && tinMatch.id !== id) {
      throw new ConflictError('TIN number already in use');
    }
  }

  const updatedProfile = await companyRepository.update(id, data);
  return updatedProfile;
}

/**
 * Lists ACTIVE internships for a company (public).
 *
 * No applicationCount exposed. Only ACTIVE status internships returned.
 *
 * @param companyId - The Company UUID.
 * @param filters - Pagination parameters.
 * @returns Paginated list of ACTIVE internships with pagination meta.
 *
 * @throws {NotFoundError} If the company does not exist.
 */
export async function getInternships(companyId: string, filters: InternshipListFilters) {
  // Verify the company exists
  const company = await companyRepository.findById(companyId);
  if (!company) {
    throw new NotFoundError('Company profile not found');
  }

  const [internships, total] = await Promise.all([
    companyRepository.findInternshipsByCompanyId(companyId, {
      page: filters.page,
      pageSize: filters.pageSize,
    }),
    companyRepository.countInternshipsByCompanyId(companyId, {
      page: filters.page,
      pageSize: filters.pageSize,
    }),
  ]);

  const meta = buildOffsetPaginationMeta(
    { page: filters.page, pageSize: filters.pageSize },
    total,
  );

  return { data: internships, meta };
}

/**
 * Lists applications to a company's internships (scoped — OWNER/ADMIN only).
 *
 * @param companyId - The Company UUID.
 * @param filters - Filter, sort, and pagination parameters.
 * @param requestingUserId - The authenticated user's UUID.
 * @param requestingUserRole - The authenticated user's role.
 * @returns Paginated list of applications with student and internship details.
 *
 * @throws {NotFoundError} If the company does not exist.
 * @throws {ForbiddenError} If the requester is not the owner nor ADMIN.
 */
export async function getApplications(
  companyId: string,
  filters: ApplicationListFilters,
  requestingUserId: string,
  requestingUserRole: string,
) {
  // Verify the company exists
  const company = await companyRepository.findById(companyId);
  if (!company) {
    throw new NotFoundError('Company profile not found');
  }

  // Authorization: owner or ADMIN only
  const isOwner = company.userId === requestingUserId;
  const isAdmin = requestingUserRole === 'ADMIN';

  if (!isOwner && !isAdmin) {
    throw new ForbiddenError('You do not have permission to view these applications');
  }

  const [applications, total] = await Promise.all([
    companyRepository.findApplicationsByCompanyId(companyId, {
      internshipId: filters.internshipId,
      status: filters.status,
      page: filters.page,
      pageSize: filters.pageSize,
      sort: filters.sort,
      order: filters.order,
    }),
    companyRepository.countApplicationsByCompanyId(companyId, {
      internshipId: filters.internshipId,
      status: filters.status,
      page: filters.page,
      pageSize: filters.pageSize,
    }),
  ]);

  const meta = buildOffsetPaginationMeta(
    { page: filters.page, pageSize: filters.pageSize },
    total,
  );

  return { data: applications, meta };
}
