// ─────────────────────────────────────────────────────────────
// Internship Service
// Business logic for all Internship module operations.
// Must not import Prisma directly — all DB access goes through repository.
// ─────────────────────────────────────────────────────────────

import {
  NotFoundError,
  ForbiddenError,
  ConflictError,
  UnprocessableError,
} from '../../shared/errors/app-error.js';
import { buildCursorPaginationMeta } from '../../shared/utils/pagination.js';
import * as internshipRepository from './internship.repository.js';
import * as studentRepository from '../students/student.repository.js';
import * as companyRepository from '../companies/company.repository.js';
import type {
  InternshipListFilters,
  UpdateInternshipData,
} from './internship.repository.js';
import type { CreateInternshipInput, UpdateInternshipInput } from './internship.schema.js';

// ─── State Machine ─────────────────────────────────────────

/**
 * Valid status transitions for the Internship state machine.
 * See STATE_MACHINES.md for full details.
 */
const INTERNSHIP_TRANSITIONS: Record<string, string[]> = {
  DRAFT: ['ACTIVE'],
  ACTIVE: ['ACTIVE', 'CLOSED'],
  CLOSED: [], // CLOSED is terminal (reopen deferred)
};

/**
 * Validates an internship status transition.
 *
 * @param from - Current status.
 * @param to - Desired new status.
 *
 * @throws {UnprocessableError} If the transition is not allowed.
 */
function validateTransition(from: string, to: string): void {
  const allowed = INTERNSHIP_TRANSITIONS[from];
  if (!allowed || !allowed.includes(to)) {
    throw new UnprocessableError(
      `Cannot transition internship from ${from} to ${to}`,
    );
  }
}

// ─── Public Response Shaping Types ─────────────────────────

/**
 * Public-facing internship list entry.
 * Strips internal fields: _count, companyId, deletedAt, company.userId.
 */
interface PublicInternshipListEntry {
  id: string;
  title: string;
  description: string;
  responsibilities: string[];
  requirements: string[];
  preferredSkills: string[];
  type: string;
  city: string;
  address: string | null;
  durationMonths: number;
  weeklyHours: number | null;
  startDate: Date | null;
  deadline: Date | null;
  stipend: unknown;
  benefits: string[];
  tags: string[];
  minGrade: number | null;
  maxGrade: number | null;
  status: string;
  createdAt: Date;
  updatedAt: Date;
  company: {
    id: string;
    name: string;
    logoUrl: string | null;
    city: string;
    industry: string;
  };
  applicantCount: number;
}

// ─── Public Service Functions ───────────────────────────────

/**
 * Public paginated listing of ACTIVE internships.
 *
 * Supports search (title, description, city), filter by companyId/city/type/
 * duration/grade/tags, sort, and cursor-based pagination.
 * Strips `_count`, `companyId`, `deletedAt`, and `company.userId` from results.
 *
 * @param filters - Search, filter, sort, and pagination parameters.
 * @returns Paginated list of internships with cursor pagination meta.
 */
export async function list(filters: InternshipListFilters) {
  const raw = await internshipRepository.findAll(filters);

  // repository returns limit+1 rows; buildCursorPaginationMeta splits data from meta
  const { data: internships, meta } = buildCursorPaginationMeta(
    raw,
    filters.limit,
  );

  // Map results: strip internal fields, add applicantCount
  const data: PublicInternshipListEntry[] = internships.map((internship) => {
    const { _count, companyId: _companyId, deletedAt: _deletedAt, company, ...rest } = internship;
    const { userId: _companyUserId, ...companySafe } = company;
    return {
      ...rest,
      company: companySafe,
      applicantCount: _count?.applications ?? 0,
    };
  });

  return { data, meta };
}

/**
 * Retrieves a single ACTIVE internship by UUID (public).
 *
 * Strips `_count`, `companyId`, `deletedAt`, and `company.userId`.
 *
 * @param id - The Internship UUID.
 * @returns The internship with public-safe company info.
 *
 * @throws {NotFoundError} If the internship is not found, not ACTIVE, or soft-deleted.
 */
export async function getById(id: string) {
  const internship = await internshipRepository.findById(id);

  if (!internship) {
    throw new NotFoundError('Internship not found');
  }

  // Strip internal fields
  const { _count, companyId: _companyId, deletedAt: _deletedAt, company, ...rest } = internship;
  const { userId: _companyUserId, ...companySafe } = company;

  return {
    ...rest,
    company: companySafe,
    applicationCount: _count?.applications ?? 0,
  };
}

/**
 * Creates a new internship in DRAFT status.
 *
 * Looks up the user's company profile for the companyId.
 * Only COMPANY and ADMIN roles can create internships.
 *
 * @param data - Internship input data.
 * @param userId - The authenticated user's UUID.
 * @param userRole - The authenticated user's role.
 * @returns The newly created internship.
 *
 * @throws {NotFoundError} If the user does not have a company profile.
 * @throws {ForbiddenError} If the user's role is not COMPANY or ADMIN.
 */
export async function create(data: CreateInternshipInput, userId: string, userRole: string) {
  // Role gate: only COMPANY and ADMIN
  if (userRole !== 'COMPANY' && userRole !== 'ADMIN') {
    throw new ForbiddenError('Only companies can create internships');
  }

  // Look up the user's company profile
  const company = await companyRepository.findByUserId(userId);
  if (!company) {
    throw new NotFoundError('Company profile not found. Create a company profile first.');
  }

  const internship = await internshipRepository.create({
    ...data,
    companyId: company.id,
  });

  return internship;
}

/**
 * Updates an existing internship.
 *
 * Ownership: requester must own the company that owns the internship, OR be ADMIN.
 * Status transition validated for DRAFT→ACTIVE (publish) and ACTIVE→ACTIVE (extend).
 * Cross-field validation (minGrade ≤ maxGrade) is handled by Zod schema.
 *
 * @param id - The Internship UUID.
 * @param data - Internship fields to update.
 * @param userId - The authenticated user's UUID.
 * @param userRole - The authenticated user's role.
 * @returns The updated internship.
 *
 * @throws {NotFoundError} If the internship does not exist.
 * @throws {ForbiddenError} If the requester is neither the owner nor ADMIN.
 * @throws {UnprocessableError} If the status transition is invalid.
 */
export async function update(
  id: string,
  data: UpdateInternshipInput,
  userId: string,
  userRole: string,
) {
  // Find the internship (any status — for ownership check)
  const existing = await internshipRepository.findByIdUnscoped(id);
  if (!existing) {
    throw new NotFoundError('Internship not found');
  }

  // CLOSED internships are immutable — no fields can be updated
  if (existing.status === 'CLOSED') {
    throw new UnprocessableError(
      'Cannot edit a closed internship. Closed internships are immutable.',
    );
  }

  // Authorization: the requester must own the company that owns the internship, or be ADMIN
  const isOwner = existing.company.userId === userId;
  const isAdmin = userRole === 'ADMIN';
  if (!isOwner && !isAdmin) {
    throw new ForbiddenError('You do not have permission to update this internship');
  }

  // Validate status transition if status is being changed
  if (data.status !== undefined && data.status !== existing.status) {
    validateTransition(existing.status, data.status);
  }

  // Build update data — convert stipend if provided
  const updateData: UpdateInternshipData = { ...data };

  const internship = await internshipRepository.update(id, updateData);
  return internship;
}

/**
 * Soft-closes an internship (status = CLOSED, deletedAt = now).
 *
 * Business rules:
 * - Only ACTIVE internships can be closed
 * - Cannot close if there are ACCEPTED applications
 *
 * @param id - The Internship UUID.
 * @param userId - The authenticated user's UUID.
 * @param userRole - The authenticated user's role.
 * @returns void (204 No Content).
 *
 * @throws {NotFoundError} If the internship does not exist.
 * @throws {ForbiddenError} If the requester is neither the owner nor ADMIN.
 * @throws {UnprocessableError} If the internship is not ACTIVE.
 * @throws {UnprocessableError} If there are ACCEPTED applications.
 */
export async function close(id: string, userId: string, userRole: string) {
  // Find the internship (any status — for ownership check and state validation)
  const existing = await internshipRepository.findByIdUnscoped(id);
  if (!existing) {
    throw new NotFoundError('Internship not found');
  }

  // Authorization: the requester must own the company that owns the internship, or be ADMIN
  const isOwner = existing.company.userId === userId;
  const isAdmin = userRole === 'ADMIN';
  if (!isOwner && !isAdmin) {
    throw new ForbiddenError('You do not have permission to close this internship');
  }

  // State machine: only ACTIVE can be closed
  if (existing.status !== 'ACTIVE') {
    throw new UnprocessableError(
      `Cannot close internship in ${existing.status} status. Only ACTIVE internships can be closed.`,
    );
  }

  // Check for accepted applications
  const acceptedCount = await internshipRepository.countAcceptedApplications(id);
  if (acceptedCount > 0) {
    throw new UnprocessableError(
      'Cannot close internship with accepted applications. Resolve all accepted applications first.',
    );
  }

  await internshipRepository.softDelete(id);
}

/**
 * Submits an application to an internship.
 *
 * Business rules (all validated in this function):
 * 1. Internship exists and is ACTIVE
 * 2. Student profile exists
 * 3. Student grade meets minGrade requirement (if set)
 * 4. Student grade meets maxGrade requirement (if set)
 * 5. Student hasn't already applied (pre-check + DB constraint)
 * 6. Application deadline hasn't passed
 * 7. Application created with PENDING status (no status management)
 *
 * @param internshipId - The Internship UUID.
 * @param userId - The authenticated user's UUID.
 * @param data - Application input (coverLetter, additionalInfo).
 * @returns The newly created application.
 *
 * @throws {NotFoundError} If internship or student profile not found.
 * @throws {ForbiddenError} If the user is not a STUDENT.
 * @throws {UnprocessableError} If grade requirements not met, deadline passed.
 * @throws {ConflictError} If already applied.
 */
export async function apply(
  internshipId: string,
  userId: string,
  data: { coverLetter?: string | null; additionalInfo?: string | null },
) {
  // 1. Find the internship (must be ACTIVE)
  const internship = await internshipRepository.findById(internshipId);
  if (!internship) {
    throw new NotFoundError('Internship not found or no longer accepting applications');
  }

  // 2. Find the student profile
  const student = await studentRepository.findByUserId(userId);
  if (!student) {
    throw new NotFoundError('Student profile not found');
  }

  // 3. Check resume requirement
  if (!student.resumeUrl) {
    throw new UnprocessableError(
      'A resume is required to apply. Please upload your resume before applying.',
    );
  }

  // 4. Check minGrade requirement
  if (internship.minGrade !== null && student.grade !== null && student.grade < internship.minGrade) {
    throw new UnprocessableError(
      `This internship requires a minimum grade of ${internship.minGrade}. Your current grade is ${student.grade}.`,
    );
  }

  // 5. Check maxGrade requirement
  if (internship.maxGrade !== null && student.grade !== null && student.grade > internship.maxGrade) {
    throw new UnprocessableError(
      `This internship accepts a maximum grade of ${internship.maxGrade}. Your current grade is ${student.grade}.`,
    );
  }

  // 6. Check deadline
  if (internship.deadline !== null && new Date() > new Date(internship.deadline)) {
    throw new UnprocessableError('The application deadline for this internship has passed');
  }

  // 7. Pre-check duplicate application
  const existingApplication = await internshipRepository.findApplicationByInternshipAndStudent(
    internshipId,
    student.id,
  );
  if (existingApplication) {
    throw new ConflictError('You have already applied to this internship');
  }

  // 8. Create the application (repository also handles P2002 as a safety net)
  const application = await internshipRepository.createApplication({
    internshipId,
    studentId: student.id,
    coverLetter: data.coverLetter ?? null,
    additionalInfo: data.additionalInfo ?? null,
  });

  return application;
}
