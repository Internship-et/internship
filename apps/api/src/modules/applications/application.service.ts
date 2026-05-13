// ─────────────────────────────────────────────────────────────
// Application Service
// Business logic for all Application module operations.
// Must not import Prisma directly — all DB access goes through repository.
// Must not import HTTP-related modules (req, res, next).
// ─────────────────────────────────────────────────────────────

import {
  NotFoundError,
  ForbiddenError,
  UnprocessableError,
} from '../../shared/errors/app-error.js';
import { buildCursorPaginationMeta } from '../../shared/utils/pagination.js';
import * as applicationRepository from './application.repository.js';
import * as studentRepository from '../students/student.repository.js';
import * as companyRepository from '../companies/company.repository.js';
import type {
  UpdateApplicationStatusInput,
  WithdrawApplicationInput,
  ListApplicationQuery,
} from './application.schema.js';
import type { ApplicationStatus } from '../../generated/prisma/enums.js';

// ─── State Machine ─────────────────────────────────────────

/**
 * Valid status transitions for the Application state machine (company side).
 * See STATE_MACHINES.md for full details.
 *
 * PENDING → REVIEWED/SHORTLISTED/REJECTED  (company review)
 * REVIEWED → SHORTLISTED/REJECTED           (further review)
 * SHORTLISTED → ACCEPTED/REJECTED           (final decision)
 * ACCEPTED/REJECTED/WITHDRAWN → []          (terminal — no further transitions)
 *
 * WITHDRAWN is handled separately by withdraw() — only from PENDING/REVIEWED.
 * ACCEPTED→REJECTED (student decline) is deferred.
 */
const VALID_TRANSITIONS: Record<string, string[]> = {
  PENDING: ['REVIEWED', 'SHORTLISTED', 'REJECTED'],
  REVIEWED: ['SHORTLISTED', 'REJECTED'],
  SHORTLISTED: ['ACCEPTED', 'REJECTED'],
  ACCEPTED: [],
  REJECTED: [],
  WITHDRAWN: [],
};

/**
 * Validates an application status transition.
 *
 * @param from - Current ApplicationStatus.
 * @param to - Desired new ApplicationStatus.
 *
 * @throws {UnprocessableError} If the transition is not allowed.
 */
function validateTransition(from: string, to: string): void {
  const allowed = VALID_TRANSITIONS[from];
  if (!allowed || !allowed.includes(to)) {
    throw new UnprocessableError(
      `Cannot transition application from ${from} to ${to}`,
    );
  }
}

// ─── Response Shaping Types ────────────────────────────────

/** Public-facing application list entry (no internal fields leaked).
 * List-safe: no companyNote, statusHistory, student.resumeUrl,
 * student.user.email, or student.user.phone for ANY role.
 * Detail-only fields are available only on GET /applications/:applicationId. */
interface ApplicationListEntry {
  id: string;
  status: string;
  coverLetter: string | null;
  additionalInfo: string | null;
  appliedAt: Date;
  updatedAt: Date;
  student?: {
    id: string;
    grade: number | null;
    user: {
      id: string;
      firstName: string;
      lastName: string;
    };
  } | null;
  internship?: {
    id: string;
    title: string;
    status: string;
  } | null;
}

/** Public-facing application detail entry (with data visibility rules). */
interface ApplicationDetailEntry {
  id: string;
  status: string;
  coverLetter: string | null;
  additionalInfo: string | null;
  appliedAt: Date;
  updatedAt: Date;
  student: {
    id: string;
    grade: number | null;
    resumeUrl: string | null;
    user: {
      id: string;
      firstName: string;
      lastName: string;
      email?: string;
      phone?: string;
    };
  };
  internship: {
    id: string;
    title: string;
    status: string;
    company: {
      id: string;
      name: string;
    };
  };
  statusHistory: Array<{
    id: string;
    fromStatus: string;
    toStatus: string;
    changedById: string;
    note: string | null;
    createdAt: Date;
  }>;
  companyNote?: string | null;
}

// ─── Service Functions ─────────────────────────────────────

/**
 * Role-scoped paginated listing of applications.
 *
 * Scoping rules:
 * - STUDENT → sees own applications (filter by studentId)
 * - COMPANY → sees applications to own internships (lookup company → filter by companyId)
 * - ADMIN → sees all applications (no scope filter)
 *
 * Strips `companyNote` from student-visible results.
 * Student contact info (email, phone) is visible to COMPANY and ADMIN only.
 *
 * @param userId - The authenticated user's UUID.
 * @param userRole - The authenticated user's role.
 * @param filters - Pagination, filter, and sort parameters.
 * @returns Paginated list of applications with cursor pagination meta.
 *
 * @throws {ForbiddenError} If a COMPANY user has no company profile.
 * @throws {NotFoundError} If a COMPANY user has no company profile.
 */
export async function list(
  userId: string,
  userRole: string,
  filters: ListApplicationQuery,
) {
  // Build repository filters based on role
  const repoFilters: applicationRepository.ApplicationListFilters = {
    limit: filters.limit,
    status: filters.status,
    internshipId: filters.internshipId,
    cursor: filters.cursor ?? undefined,
    sort: filters.sort,
    order: filters.order,
  };

  if (userRole === 'STUDENT') {
    // Find the student profile to get studentId
    const student = await studentRepository.findByUserId(userId);
    if (!student) {
      // Student has no profile — return empty results
      return { data: [], meta: { cursor: null, hasMore: false } };
    }
    repoFilters.studentId = student.id;
  } else if (userRole === 'COMPANY') {
    // Find the company profile to get companyId
    const companyProfile = await companyRepository.findByUserId(userId);
    if (!companyProfile) {
      throw new NotFoundError('Company profile not found');
    }
    repoFilters.companyId = companyProfile.id;
  }
  // ADMIN: no scope filter — sees all

  const raw = await applicationRepository.findAll(repoFilters);

  // repository returns limit+1 rows; buildCursorPaginationMeta splits data from meta
  const { data: applications, meta } = buildCursorPaginationMeta(
    raw,
    filters.limit,
  );

  // Shape response: strip internal fields — list-safe for ALL roles
  // No companyNote, statusHistory, student.resumeUrl, student.user.email/phone
  const data: ApplicationListEntry[] = applications.map((app) => ({
    id: app.id,
    status: app.status,
    coverLetter: app.coverLetter,
    additionalInfo: app.additionalInfo,
    appliedAt: app.appliedAt,
    updatedAt: app.updatedAt,
    student: app.student
      ? {
          id: app.student.id,
          grade: app.student.grade,
          user: {
            id: app.student.user.id,
            firstName: app.student.user.firstName,
            lastName: app.student.user.lastName,
          },
    }
      : null,
    internship: app.internship
      ? {
          id: app.internship.id,
          title: app.internship.title,
          status: app.internship.status,
        }
      : null,
  }));

  return { data, meta };
}

/**
 * Retrieves a single application by UUID with full details and status history.
 *
 * Ownership rules:
 * - STUDENT → must own the application (application.studentId === student.id)
 * - COMPANY → must own the internship (internship.company.userId === userId)
 * - ADMIN → can see any application
 *
 * Data visibility:
 * - STUDENT cannot see `companyNote`
 * - COMPANY can see student email/phone/resumeUrl
 *
 * @param applicationId - The Application UUID.
 * @param userId - The authenticated user's UUID.
 * @param userRole - The authenticated user's role.
 * @returns The application with full details and status history.
 *
 * @throws {NotFoundError} If the application does not exist.
 * @throws {ForbiddenError} If the user is not authorized to view this application.
 */
export async function getById(
  applicationId: string,
  userId: string,
  userRole: string,
) {
  const application = await applicationRepository.findById(applicationId);

  if (!application) {
    throw new NotFoundError('Application not found');
  }

  // Ownership check
  if (userRole === 'STUDENT') {
    const student = await studentRepository.findByUserId(userId);
    if (!student || application.studentId !== student.id) {
      throw new ForbiddenError('You do not have permission to view this application');
    }
  } else if (userRole === 'COMPANY') {
    if (application.internship.company.userId !== userId) {
      throw new ForbiddenError('You do not have permission to view this application');
    }
  }
  // ADMIN: no ownership check

  // Shape response with data visibility
  const result: ApplicationDetailEntry = {
    id: application.id,
    status: application.status,
    coverLetter: application.coverLetter,
    additionalInfo: application.additionalInfo,
    appliedAt: application.appliedAt,
    updatedAt: application.updatedAt,
    student: {
      id: application.student.id,
      grade: application.student.grade,
      resumeUrl: application.student.resumeUrl,
      user: {
        id: application.student.user.id,
        firstName: application.student.user.firstName,
        lastName: application.student.user.lastName,
        email: application.student.user.email,
        phone: application.student.user.phone ?? undefined,
      },
    },
    internship: {
      id: application.internship.id,
      title: application.internship.title,
      status: application.internship.status,
      company: {
        id: application.internship.company.id,
        name: application.internship.company.name,
      },
    },
    statusHistory: application.statusHistory.map((h) => ({
      id: h.id,
      fromStatus: h.fromStatus,
      toStatus: h.toStatus,
      changedById: h.changedById,
      note: h.note,
      createdAt: h.createdAt,
    })),
  };

  // Data visibility: companyNote hidden from STUDENT; fill from DB for COMPANY/ADMIN
  result.companyNote = userRole !== 'STUDENT' ? application.companyNote : null;

  // Student contact info (email, phone) visible only to COMPANY and ADMIN
  if (userRole === 'STUDENT') {
    delete result.student.user.email;
    delete result.student.user.phone;
  }

  return result;
}

/**
 * Updates the status of an application (COMPANY or ADMIN only).
 *
 * Enforces the application state machine.
 * Creates an ApplicationStatusHistory entry on every status change.
 * Does NOT create AuditLog entries (deferred to shared audit facility).
 * Does NOT persist `message` field (accepted but not stored — see KNOWN_GAPS_REGISTER.md).
 *
 * @param applicationId - The Application UUID.
 * @param data - Status update input (status, note, message).
 * @param userId - The authenticated user's UUID.
 * @param userRole - The authenticated user's role.
 * @returns The updated application.
 *
 * @throws {NotFoundError} If the application does not exist.
 * @throws {ForbiddenError} If the user is not authorized (must be COMPANY owner or ADMIN).
 * @throws {UnprocessableError} If the status transition is invalid.
 */
export async function updateStatus(
  applicationId: string,
  data: UpdateApplicationStatusInput,
  userId: string,
  userRole: string,
) {
  // Find the application with relations for ownership check and current status
  const application = await applicationRepository.findById(applicationId);

  if (!application) {
    throw new NotFoundError('Application not found');
  }

  // Authorization: COMPANY must own the internship; ADMIN can update any
  if (userRole === 'COMPANY') {
    if (application.internship.company.userId !== userId) {
      throw new ForbiddenError('You do not have permission to update this application');
    }
  } else if (userRole !== 'ADMIN') {
    // STUDENT, SCHOOL cannot update status via this endpoint
    throw new ForbiddenError('You do not have permission to update application status');
  }
  // ADMIN: authorization passed

  // Validate state machine transition
  validateTransition(application.status, data.status);

  // Update the status in the database
  const updated = await applicationRepository.updateStatus(
    applicationId,
    data.status as ApplicationStatus,
  );

  // Create immutable status history entry
  // Note: `data.message` is accepted but NOT persisted (deferred — see KNOWN_GAPS_REGISTER.md)
  await applicationRepository.createStatusHistory({
    applicationId,
    fromStatus: application.status as ApplicationStatus,
    toStatus: data.status as ApplicationStatus,
    changedById: userId,
    note: data.note ?? null,
  });

  // Shape response with data visibility
  const result: ApplicationDetailEntry = {
    id: updated.id,
    status: updated.status,
    coverLetter: updated.coverLetter,
    additionalInfo: updated.additionalInfo,
    appliedAt: updated.appliedAt,
    updatedAt: updated.updatedAt,
    companyNote: updated.companyNote,
    student: {
      id: updated.student.id,
      grade: updated.student.grade,
      resumeUrl: updated.student.resumeUrl,
      user: {
        id: updated.student.user.id,
        firstName: updated.student.user.firstName,
        lastName: updated.student.user.lastName,
        email: updated.student.user.email,
        phone: updated.student.user.phone ?? undefined,
      },
    },
    internship: {
      id: updated.internship.id,
      title: updated.internship.title,
      status: updated.internship.status,
      company: {
        id: updated.internship.company.id,
        name: updated.internship.company.name,
      },
    },
    statusHistory: updated.statusHistory.map((h) => ({
      id: h.id,
      fromStatus: h.fromStatus,
      toStatus: h.toStatus,
      changedById: h.changedById,
      note: h.note,
      createdAt: h.createdAt,
    })),
  };

  // companyNote already present in the result (set inline above)

  return result;
}

/**
 * Withdraws an application (STUDENT self-service).
 *
 * Rules:
 * - Only STUDENT role can withdraw own applications
 * - Only PENDING or REVIEWED applications can be withdrawn
 * - COMPANY, SCHOOL, ADMIN, and non-owner students are rejected with 403
 * - Creates an ApplicationStatusHistory entry on withdrawal
 *
 * @param applicationId - The Application UUID.
 * @param data - Withdrawal input (reason).
 * @param userId - The authenticated user's UUID.
 * @returns The withdrawn application.
 *
 * @throws {NotFoundError} If the application does not exist.
 * @throws {ForbiddenError} If the user is not a STUDENT or does not own the application.
 * @throws {UnprocessableError} If the application is not in PENDING or REVIEWED status.
 */
export async function withdraw(
  applicationId: string,
  data: WithdrawApplicationInput,
  userId: string,
) {
  // Find the application
  const application = await applicationRepository.findById(applicationId);

  if (!application) {
    throw new NotFoundError('Application not found');
  }

  // Only STUDENT role can withdraw
  // We check via student profile lookup — user must be the applicant student
  const student = await studentRepository.findByUserId(userId);
  if (!student) {
    throw new ForbiddenError('Only students can withdraw applications');
  }

  // Must own the application
  if (application.studentId !== student.id) {
    throw new ForbiddenError('You can only withdraw your own applications');
  }

  // Only PENDING or REVIEWED can be withdrawn
  if (application.status !== 'PENDING' && application.status !== 'REVIEWED') {
    throw new UnprocessableError(
      `Cannot withdraw application in ${application.status} status. Only PENDING or REVIEWED applications can be withdrawn.`,
    );
  }

  // Perform the withdrawal
  const withdrawn = await applicationRepository.withdraw(applicationId);

  // Create immutable status history entry
  await applicationRepository.createStatusHistory({
    applicationId,
    fromStatus: application.status as ApplicationStatus,
    toStatus: 'WITHDRAWN' as ApplicationStatus,
    changedById: userId,
    note: data.reason ?? null, // Store withdrawal reason as note
  });

  // Shape response
  const result: ApplicationDetailEntry = {
    id: withdrawn.id,
    status: withdrawn.status,
    coverLetter: withdrawn.coverLetter,
    additionalInfo: withdrawn.additionalInfo,
    appliedAt: withdrawn.appliedAt,
    updatedAt: withdrawn.updatedAt,
    student: {
      id: withdrawn.student.id,
      grade: withdrawn.student.grade,
      resumeUrl: withdrawn.student.resumeUrl,
      user: {
        id: withdrawn.student.user.id,
        firstName: withdrawn.student.user.firstName,
        lastName: withdrawn.student.user.lastName,
        email: withdrawn.student.user.email,
        phone: withdrawn.student.user.phone ?? undefined,
      },
    },
    internship: {
      id: withdrawn.internship.id,
      title: withdrawn.internship.title,
      status: withdrawn.internship.status,
      company: {
        id: withdrawn.internship.company.id,
        name: withdrawn.internship.company.name,
      },
    },
    statusHistory: withdrawn.statusHistory.map((h) => ({
      id: h.id,
      fromStatus: h.fromStatus,
      toStatus: h.toStatus,
      changedById: h.changedById,
      note: h.note,
      createdAt: h.createdAt,
    })),
  };

  return result;
}
