// ─────────────────────────────────────────────────────────────
// Student Service
// Business logic for all Student module operations.
// Must not import Prisma directly — all DB access goes through repository.
// ─────────────────────────────────────────────────────────────

import { NotFoundError, ForbiddenError } from '../../shared/errors/app-error.js';
import {
  buildOffsetPaginationMeta,
  getOffsetPaginationInput,
} from '../../shared/utils/pagination.js';
import * as studentRepository from './student.repository.js';
import type {
  StudentListFilters,
  ApplicationListFilters,
} from './student.repository.js';
import type { UpdateStudentInput, UpdateStudentProfileInput } from './student.schema.js';

// ─── Public Service Functions ───────────────────────────────

/**
 * Admin-only paginated listing of all students.
 *
 * Supports search (firstName, lastName, skills), filter by school/grade,
 * sort, and offset-based pagination.
 *
 * @param filters - Search, filter, sort, and pagination parameters.
 * @returns Paginated list of students with pagination meta.
 */
export async function list(filters: StudentListFilters) {
  const paginationInput = getOffsetPaginationInput({
    page: filters.page,
    pageSize: filters.pageSize,
  });

  const [students, total] = await Promise.all([
    studentRepository.findAll({
      ...filters,
      ...paginationInput,
    }),
    studentRepository.count(filters),
  ]);

  const meta = buildOffsetPaginationMeta(
    { page: filters.page, pageSize: filters.pageSize },
    total,
  );

  return { data: students, meta };
}

/**
 * Retrieves a single student profile by Student UUID.
 *
 * Authorization rules:
 * - SELF (student.userId === requestingUserId) or ADMIN: full access
 * - Others: ForbiddenError
 *
 * @param id - The Student profile UUID.
 * @param requestingUserId - The authenticated user's UUID.
 * @param requestingUserRole - The authenticated user's role.
 * @returns The student profile with user and school relations.
 *
 * @throws {NotFoundError} If the student profile does not exist.
 * @throws {ForbiddenError} If the requester is neither SELF nor ADMIN.
 */
export async function getById(
  id: string,
  requestingUserId: string,
  requestingUserRole: string,
) {
  const student = await studentRepository.findById(id);

  if (!student) {
    throw new NotFoundError('Student profile not found');
  }

  // Authorization: SELF or ADMIN only
  const isSelf = student.userId === requestingUserId;
  const isAdmin = requestingUserRole === 'ADMIN';

  if (!isSelf && !isAdmin) {
    throw new ForbiddenError('You do not have permission to view this profile');
  }

  return student;
}

/**
 * Retrieves the authenticated user's own student profile.
 *
 * @param userId - The authenticated user's UUID.
 * @returns The student profile with all fields.
 *
 * @throws {NotFoundError} If no student profile exists for this user.
 */
export async function getMyProfile(userId: string) {
  const student = await studentRepository.findByUserId(userId);

  if (!student) {
    throw new NotFoundError('Student profile not found. Create one via PATCH /students/me');
  }

  return student;
}

/**
 * Creates or updates the authenticated user's own student profile (upsert).
 *
 * Role gate: Only users with `role === 'STUDENT'` may create/update their own
 * Student profile. COMPANY, SCHOOL, and ADMIN roles are rejected.
 *
 * Accepts both User fields (firstName, lastName, phone) and Student fields
 * (bio, grade, dateOfBirth, skills, interests, languages, profileImageUrl,
 * resumeUrl, schoolId).
 *
 * Returns `{ profile, created }` so the route handler can set the HTTP status:
 * - 201 when `created === true` (new profile created)
 * - 200 when `created === false` (existing profile updated)
 *
 * @param userId - The authenticated user's UUID.
 * @param userRole - The authenticated user's role.
 * @param data - User and Student fields to update (all optional).
 * @returns Object with the profile and a boolean flag indicating creation.
 *
 * @throws {ForbiddenError} If the user's role is not STUDENT.
 */
export async function upsertMyProfile(
  userId: string,
  userRole: string,
  data: UpdateStudentInput,
) {
  // Role gate: only STUDENT role may create/update their profile
  if (userRole !== 'STUDENT') {
    throw new ForbiddenError('Only students can create or update their profile');
  }

  // Check if a profile already exists
  const existingProfile = await studentRepository.findByUserId(userId);
  const created = !existingProfile;

  // Separate User fields from Student fields
  const userData: Record<string, string | undefined> = {};
  const studentData: Record<string, unknown> = {};

  if (data.firstName !== undefined) { userData.firstName = data.firstName; }
  if (data.lastName !== undefined) { userData.lastName = data.lastName; }
  if (data.phone !== undefined) { userData.phone = data.phone; }

  if (data.bio !== undefined) { studentData.bio = data.bio; }
  if (data.grade !== undefined) { studentData.grade = data.grade; }
  if (data.dateOfBirth !== undefined) { studentData.dateOfBirth = data.dateOfBirth; }
  if (data.skills !== undefined) { studentData.skills = data.skills; }
  if (data.interests !== undefined) { studentData.interests = data.interests; }
  if (data.languages !== undefined) { studentData.languages = data.languages; }
  if (data.profileImageUrl !== undefined) { studentData.profileImageUrl = data.profileImageUrl; }
  if (data.resumeUrl !== undefined) { studentData.resumeUrl = data.resumeUrl; }
  if (data.schoolId !== undefined) { studentData.schoolId = data.schoolId; }

  // Perform the transactional upsert
  const profile = await studentRepository.upsertUserAndStudent(
    userId,
    userData,
    studentData,
  );

  return { profile, created };
}

/**
 * Updates an existing Student profile by Student UUID.
 *
 * Only updates Student-specific fields (bio, grade, dateOfBirth, skills,
 * interests, languages, profileImageUrl, resumeUrl, schoolId).
 * User fields (firstName, lastName, phone) should be updated via
 * `PATCH /students/me` instead.
 *
 * @param studentId - The Student profile UUID.
 * @param data - Student-only fields to update.
 * @param requestingUserId - The authenticated user's UUID.
 * @param requestingUserRole - The authenticated user's role.
 * @returns The updated student profile.
 *
 * @throws {NotFoundError} If the student profile does not exist.
 * @throws {ForbiddenError} If the requester is neither the owner nor ADMIN.
 */
export async function updateByStudentId(
  studentId: string,
  data: UpdateStudentProfileInput,
  requestingUserId: string,
  requestingUserRole: string,
) {
  // Verify the student exists
  const existing = await studentRepository.findById(studentId);
  if (!existing) {
    throw new NotFoundError('Student profile not found');
  }

  // Authorization: owner or ADMIN only
  const isOwner = existing.userId === requestingUserId;
  const isAdmin = requestingUserRole === 'ADMIN';

  if (!isOwner && !isAdmin) {
    throw new ForbiddenError('You do not have permission to update this profile');
  }

  // Update only Student-specific fields
  const updatedProfile = await studentRepository.update(studentId, data);
  return updatedProfile;
}

/**
 * Lists applications belonging to a student (read-only).
 *
 * Authorization: SELF (student.userId matches requester) or ADMIN.
 *
 * @param studentId - The Student profile UUID.
 * @param filters - Pagination and status filter parameters.
 * @param requestingUserId - The authenticated user's UUID.
 * @param requestingUserRole - The authenticated user's role.
 * @returns Paginated list of applications with internship and company details.
 *
 * @throws {NotFoundError} If the student profile does not exist.
 * @throws {ForbiddenError} If the requester is not authorized.
 */
export async function getApplications(
  studentId: string,
  filters: ApplicationListFilters,
  requestingUserId: string,
  requestingUserRole: string,
) {
  // Verify the student exists
  const student = await studentRepository.findById(studentId);
  if (!student) {
    throw new NotFoundError('Student profile not found');
  }

  // Authorization: SELF or ADMIN
  const isSelf = student.userId === requestingUserId;
  const isAdmin = requestingUserRole === 'ADMIN';

  if (!isSelf && !isAdmin) {
    throw new ForbiddenError('You do not have permission to view these applications');
  }

  const paginationInput = getOffsetPaginationInput({
    page: filters.page,
    pageSize: filters.pageSize,
  });

  const [applications, total] = await Promise.all([
    studentRepository.findApplicationsByStudentId(studentId, {
      ...filters,
      ...paginationInput,
    }),
    studentRepository.countApplicationsByStudentId(studentId, filters),
  ]);

  const meta = buildOffsetPaginationMeta(
    { page: filters.page, pageSize: filters.pageSize },
    total,
  );

  return { data: applications, meta };
}
