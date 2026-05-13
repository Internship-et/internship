// ─────────────────────────────────────────────────────────────
// School Service
// Business logic for all School module operations.
// Must not import Prisma directly — all DB access goes through repository.
// ─────────────────────────────────────────────────────────────

import { NotFoundError, ForbiddenError, ConflictError, UnprocessableError } from '../../shared/errors/app-error.js';
import {
  buildOffsetPaginationMeta,
  getOffsetPaginationInput,
} from '../../shared/utils/pagination.js';
import * as schoolRepository from './school.repository.js';
import type { SchoolListFilters } from './school.repository.js';
import type { CreateSchoolInput, UpdateSchoolInput, VerifyStudentInput } from './school.schema.js';

// ─── Types ──────────────────────────────────────────────────

/** Public-facing school list entry — strips sensitive fields, adds counts. */
interface PublicSchoolListEntry {
  id: string;
  name: string;
  type: string;
  city: string;
  address: string | null;
  phone: string | null;
  email: string | null;
  website: string | null;
  principal: string | null;
  gradesOffered: number[];
  logoUrl: string | null;
  isVerified: boolean;
  createdAt: Date;
  updatedAt: Date;
  studentCount: number;
  verifiedStudentCount: number;
}

/** Public-facing school detail — full profile with counts, strips sensitive fields. */
interface PublicSchoolDetail {
  id: string;
  name: string;
  type: string;
  city: string;
  address: string | null;
  phone: string | null;
  email: string | null;
  website: string | null;
  principal: string | null;
  gradesOffered: number[];
  logoUrl: string | null;
  isVerified: boolean;
  createdAt: Date;
  updatedAt: Date;
  studentCount: number;
  verifiedStudentCount: number;
}

/** Response shape for verify-student endpoint. */
interface VerifyStudentResponse {
  studentId: string;
  schoolId: string;
  isVerified: boolean;
  grade: number | null;
  verifiedAt: Date;
  verifiedBy: string;
}

// ─── Public Service Functions ───────────────────────────────

/**
 * Public paginated listing of all schools.
 *
 * Supports search (name, city), filter by city/type, sort, and
 * offset-based pagination. Strips sensitive fields (userId,
 * licenseNumber, deletedAt) from every result. Adds `studentCount`
 * and `verifiedStudentCount`.
 *
 * @param filters - Search, filter, sort, and pagination parameters.
 * @returns Paginated list of schools with pagination meta.
 */
export async function list(filters: SchoolListFilters) {
  const paginationInput = getOffsetPaginationInput({
    page: filters.page,
    pageSize: filters.pageSize,
  });

  const [schools, total] = await Promise.all([
    schoolRepository.findAll({
      ...filters,
      ...paginationInput,
    }),
    schoolRepository.count(filters),
  ]);

  // Collect school IDs for batch verified-student count
  const schoolIds = schools.map((s) => s.id);
  const verifiedCounts = await schoolRepository.countVerifiedStudentsBySchoolIds(schoolIds);

  // Map results: add studentCount and verifiedStudentCount
  const data: PublicSchoolListEntry[] = schools.map((school) => {
    const studentCount = school._count?.students ?? 0;
    const verifiedStudentCount = verifiedCounts.get(school.id) ?? 0;

    return {
      id: school.id,
      name: school.name,
      type: school.type,
      city: school.city,
      address: school.address,
      phone: school.phone,
      email: school.email,
      website: school.website,
      principal: school.principal,
      gradesOffered: school.gradesOffered,
      logoUrl: school.logoUrl,
      isVerified: school.isVerified,
      createdAt: school.createdAt,
      updatedAt: school.updatedAt,
      studentCount,
      verifiedStudentCount,
    };
  });

  const meta = buildOffsetPaginationMeta(
    { page: filters.page, pageSize: filters.pageSize },
    total,
  );

  return { data, meta };
}

/**
 * Retrieves a single school profile by School UUID (public).
 *
 * @param id - The School UUID.
 * @returns The school profile with student counts. Sensitive fields stripped.
 *
 * @throws {NotFoundError} If the school profile does not exist.
 */
export async function getById(id: string) {
  const school = await schoolRepository.findById(id);

  if (!school) {
    throw new NotFoundError('School profile not found');
  }

  const studentCount = school._count?.students ?? 0;

  // Get verified student count
  const verifiedCounts = await schoolRepository.countVerifiedStudentsBySchoolIds([id]);
  const verifiedStudentCount = verifiedCounts.get(id) ?? 0;

  // Return public-safe profile (strip userId, licenseNumber, deletedAt, user, _count)
  return {
    id: school.id,
    name: school.name,
    type: school.type,
    city: school.city,
    address: school.address,
    phone: school.phone,
    email: school.email,
    website: school.website,
    principal: school.principal,
    gradesOffered: school.gradesOffered,
    logoUrl: school.logoUrl,
    isVerified: school.isVerified,
    createdAt: school.createdAt,
    updatedAt: school.updatedAt,
    studentCount,
    verifiedStudentCount,
  } satisfies PublicSchoolDetail;
}

/**
 * Creates a new school profile for the authenticated user.
 *
 * Business rules:
 * - One school per user account
 * - School name must be unique
 *
 * @param data - School profile input data.
 * @param userId - The authenticated user's UUID.
 * @returns The newly created school profile.
 *
 * @throws {ConflictError} If the user already has a school profile.
 * @throws {ConflictError} If the school name already exists.
 */
export async function create(data: CreateSchoolInput, userId: string) {
  // Check one-school-per-user
  const existingProfile = await schoolRepository.findByUserId(userId);
  if (existingProfile) {
    throw new ConflictError('User already has a school profile');
  }

  // Check name uniqueness
  const existingName = await schoolRepository.findByName(data.name);
  if (existingName) {
    throw new ConflictError('School name already in use');
  }

  const school = await schoolRepository.create({ ...data, userId });

  // Strip sensitive fields for response
  return {
    id: school.id,
    name: school.name,
    type: school.type,
    city: school.city,
    address: school.address,
    phone: school.phone,
    email: school.email,
    website: school.website,
    principal: school.principal,
    gradesOffered: school.gradesOffered,
    logoUrl: school.logoUrl,
    isVerified: school.isVerified,
    createdAt: school.createdAt,
    updatedAt: school.updatedAt,
    studentCount: school._count?.students ?? 0,
    verifiedStudentCount: 0,
  };
}

/**
 * Updates an existing School profile by School UUID.
 *
 * Ownership: requester must own the school OR be ADMIN.
 * Name uniqueness checked on change (current school ID is
 * not treated as a conflict).
 *
 * @param id - The School UUID.
 * @param data - School fields to update.
 * @param requestingUserId - The authenticated user's UUID.
 * @param requestingUserRole - The authenticated user's role.
 * @returns The updated school profile (sensitive fields stripped).
 *
 * @throws {NotFoundError} If the school profile does not exist.
 * @throws {ForbiddenError} If the requester is neither the owner nor ADMIN.
 * @throws {ConflictError} If the new name is already in use.
 */
export async function update(
  id: string,
  data: UpdateSchoolInput,
  requestingUserId: string,
  requestingUserRole: string,
) {
  // Verify the school exists
  const existing = await schoolRepository.findById(id);
  if (!existing) {
    throw new NotFoundError('School profile not found');
  }

  // Authorization: owner or ADMIN only
  const isOwner = existing.userId === requestingUserId;
  const isAdmin = requestingUserRole === 'ADMIN';

  if (!isOwner && !isAdmin) {
    throw new ForbiddenError('You do not have permission to update this profile');
  }

  // Check name uniqueness on change (skip if name unchanged or not provided)
  if (data.name !== undefined && data.name !== existing.name) {
    const nameMatch = await schoolRepository.findByName(data.name);
    if (nameMatch && nameMatch.id !== id) {
      throw new ConflictError('School name already in use');
    }
  }

  const updatedProfile = await schoolRepository.update(id, data);

  // Get verified student count
  const verifiedCounts = await schoolRepository.countVerifiedStudentsBySchoolIds([id]);
  const verifiedStudentCount = verifiedCounts.get(id) ?? 0;

  // Strip sensitive fields for response
  return {
    id: updatedProfile.id,
    name: updatedProfile.name,
    type: updatedProfile.type,
    city: updatedProfile.city,
    address: updatedProfile.address,
    phone: updatedProfile.phone,
    email: updatedProfile.email,
    website: updatedProfile.website,
    principal: updatedProfile.principal,
    gradesOffered: updatedProfile.gradesOffered,
    logoUrl: updatedProfile.logoUrl,
    isVerified: updatedProfile.isVerified,
    createdAt: updatedProfile.createdAt,
    updatedAt: updatedProfile.updatedAt,
    studentCount: updatedProfile._count?.students ?? 0,
    verifiedStudentCount,
  };
}

/**
 * Verifies or revokes a student's enrollment at a school.
 *
 * Business rules:
 * - School must exist and not be deleted
 * - Requester must own the school or be ADMIN
 * - Student must exist
 * - Student.schoolId must match the schoolId
 * - If isEnrolled=true: grade is required, set isSchoolVerified=true
 * - If isEnrolled=false: revoke by setting isSchoolVerified=false
 * - Creates an AuditLog entry for the verification/revocation event
 *
 * @param schoolId - The School UUID.
 * @param data - Verification input (studentId, isEnrolled, grade, graduationYear, notes).
 * @param requestingUserId - The authenticated user's UUID.
 * @param requestingUserRole - The authenticated user's role.
 * @returns Verification response with studentId, schoolId, isVerified, grade, verifiedAt, verifiedBy.
 *
 * @throws {NotFoundError} If school or student not found.
 * @throws {ForbiddenError} If requester is not the owner or ADMIN.
 * @throws {UnprocessableError} If student is not linked to this school.
 */
export async function verifyStudent(
  schoolId: string,
  data: VerifyStudentInput,
  requestingUserId: string,
  requestingUserRole: string,
) {
  // Verify school exists
  const school = await schoolRepository.findById(schoolId);
  if (!school) {
    throw new NotFoundError('School profile not found');
  }

  // Authorization: owner or ADMIN only
  const isOwner = school.userId === requestingUserId;
  const isAdmin = requestingUserRole === 'ADMIN';
  if (!isOwner && !isAdmin) {
    throw new ForbiddenError('You do not have permission to verify students');
  }

  // Find the student
  const student = await schoolRepository.findStudentForVerification(data.studentId);
  if (!student) {
    throw new NotFoundError('Student profile not found');
  }

  // Check student is linked to this school
  if (student.schoolId !== schoolId) {
    throw new UnprocessableError('Student is not enrolled at this school');
  }

  // Capture old values for audit log — includes all verification input context.
  // graduationYear and notes are not persisted on Student so oldValue uses null.
  const oldValue = {
    studentId: student.id,
    schoolId: student.schoolId,
    isSchoolVerified: student.isSchoolVerified,
    grade: student.grade,
    graduationYear: null,
    notes: null,
  };

  // Update student verification
  const newIsVerified = data.isEnrolled;
  const updateData: { isSchoolVerified: boolean; grade?: number | null } = {
    isSchoolVerified: newIsVerified,
  };

  // Only update grade if provided; when revoking, optionally update grade
  if (data.grade !== undefined) {
    updateData.grade = data.grade;
  }

  const updatedStudent = await schoolRepository.updateStudentVerification(
    data.studentId,
    updateData,
  );

  // Build new value for audit log — includes all verification input context.
  // graduationYear and notes are from the request (not persisted on Student).
  const newValue = {
    studentId: updatedStudent.id,
    schoolId: updatedStudent.schoolId,
    isSchoolVerified: updatedStudent.isSchoolVerified,
    grade: updatedStudent.grade,
    graduationYear: data.graduationYear ?? null,
    notes: data.notes ?? null,
  };

  // Create audit log entry
  await schoolRepository.createAuditLog({
    userId: requestingUserId,
    action: data.isEnrolled ? 'SCHOOL_VERIFICATION' : 'SCHOOL_VERIFICATION_REVOKED',
    entity: 'STUDENT',
    entityId: data.studentId,
    oldValue,
    newValue,
  });

  return {
    studentId: data.studentId,
    schoolId,
    isVerified: updatedStudent.isSchoolVerified,
    grade: updatedStudent.grade,
    verifiedAt: updatedStudent.updatedAt,
    verifiedBy: requestingUserId,
  } satisfies VerifyStudentResponse;
}
