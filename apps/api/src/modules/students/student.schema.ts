// ─────────────────────────────────────────────────────────────
// Student — Zod Validation Schemas
// Defines request validation for all student endpoints.
// ─────────────────────────────────────────────────────────────

import { z } from 'zod';

// ─── Helpers ─────────────────────────────────────────────────

const ethiopianPhoneRegex = /^\+251\d{9}$/;

// ─── Create Student ──────────────────────────────────────────

/**
 * Schema for `PATCH /students/:studentId` (profile update).
 * Also used for creating the student profile extension.
 */
export const createStudentSchema = z.object({
  firstName: z
    .string()
    .min(1, 'First name is required')
    .max(100, 'First name must not exceed 100 characters')
    .trim()
    .optional(),
  lastName: z
    .string()
    .min(1, 'Last name is required')
    .max(100, 'Last name must not exceed 100 characters')
    .trim()
    .optional(),
  bio: z
    .string()
    .max(500, 'Bio must not exceed 500 characters')
    .trim()
    .optional(),
  grade: z
    .number()
    .int('Grade must be a whole number')
    .min(9, 'Grade must be at least 9')
    .max(12, 'Grade must be at most 12')
    .optional(),
  dateOfBirth: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Date of birth must be a valid date (YYYY-MM-DD)')
    .optional(),
  skills: z
    .array(z.string().max(50, 'Each skill must not exceed 50 characters').trim())
    .max(10, 'You can have at most 10 skills')
    .optional(),
  interests: z
    .array(z.string().max(50, 'Each interest must not exceed 50 characters').trim())
    .max(10, 'You can have at most 10 interests')
    .optional(),
  languages: z
    .array(z.string().max(50, 'Each language must not exceed 50 characters').trim())
    .optional(),
  phone: z
    .string()
    .regex(ethiopianPhoneRegex, 'Phone must be a valid Ethiopian number (+251...)')
    .optional(),
  profileImageUrl: z
    .string()
    .url('Profile image must be a valid URL')
    .max(2048, 'Profile image URL must not exceed 2048 characters')
    .optional(),
  resumeUrl: z
    .string()
    .url('Resume must be a valid URL')
    .max(2048, 'Resume URL must not exceed 2048 characters')
    .optional(),
  schoolId: z
    .string()
    .uuid('School ID must be a valid UUID')
    .optional(),
});

export type CreateStudentInput = z.infer<typeof createStudentSchema>;

// ─── Update Student ──────────────────────────────────────────

/** Schema for `PATCH /students/:studentId` — all fields optional. */
export const updateStudentSchema = createStudentSchema.partial();

export type UpdateStudentInput = z.infer<typeof updateStudentSchema>;

// ─── List Students Query ─────────────────────────────────────

/** Schema for `GET /students` query parameters (admin). */
export const listStudentQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().max(200, 'Search query too long').trim().optional(),
  schoolId: z.string().uuid('School ID must be a valid UUID').optional(),
  grade: z.coerce.number().int().min(9).max(12).optional(),
  status: z.enum(['PENDING', 'ACTIVE', 'SUSPENDED']).optional(),
  sort: z.enum(['createdAt', 'updatedAt', 'grade', 'firstName', 'lastName', 'email']).default('createdAt'),
  order: z.enum(['asc', 'desc']).default('desc'),
});

export type ListStudentQuery = z.infer<typeof listStudentQuerySchema>;

// ─── Student-Only Update Schema (strict) ───────────────────

/**
 * Schema for `PATCH /students/:studentId` — Student-only fields.
 * Uses `.strict()` so any unknown fields (e.g., User fields like
 * `firstName`, `lastName`, `phone`) cause Zod to reject the request
 * with a 400 error. They are NOT silently ignored.
 */
export const updateStudentProfileSchema = z
  .object({
    bio: z
      .string()
      .max(500, 'Bio must not exceed 500 characters')
      .trim()
      .optional(),
    grade: z
      .number()
      .int('Grade must be a whole number')
      .min(9, 'Grade must be at least 9')
      .max(12, 'Grade must be at most 12')
      .optional(),
    dateOfBirth: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, 'Date of birth must be a valid date (YYYY-MM-DD)')
      .optional(),
    skills: z
      .array(z.string().max(50, 'Each skill must not exceed 50 characters').trim())
      .max(10, 'You can have at most 10 skills')
      .optional(),
    interests: z
      .array(z.string().max(50, 'Each interest must not exceed 50 characters').trim())
      .max(10, 'You can have at most 10 interests')
      .optional(),
    languages: z
      .array(z.string().max(50, 'Each language must not exceed 50 characters').trim())
      .optional(),
    profileImageUrl: z
      .string()
      .url('Profile image must be a valid URL')
      .max(2048, 'Profile image URL must not exceed 2048 characters')
      .optional(),
    resumeUrl: z
      .string()
      .url('Resume must be a valid URL')
      .max(2048, 'Resume URL must not exceed 2048 characters')
      .optional(),
    schoolId: z.string().uuid('School ID must be a valid UUID').optional(),
  })
  .strict();

export type UpdateStudentProfileInput = z.infer<typeof updateStudentProfileSchema>;

// ─── Student UUID Param Schema ─────────────────────────────

/** Schema for `:studentId` route param — must be a valid UUID. */
export const studentIdParamSchema = z.object({
  studentId: z.string().uuid('studentId must be a valid UUID'),
});

export type StudentIdParam = z.infer<typeof studentIdParamSchema>;

// ─── Student Applications Query Schema ─────────────────────

/** Schema for `GET /students/:studentId/applications` query params. */
export const studentApplicationsQuerySchema = z.object({
  status: z.enum(['PENDING', 'REVIEWED', 'SHORTLISTED', 'ACCEPTED', 'REJECTED', 'WITHDRAWN']).optional(),
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

export type StudentApplicationsQuery = z.infer<typeof studentApplicationsQuerySchema>;

/** Valid ApplicationStatus values (mirrors Prisma enum). */
export const APPLICATION_STATUSES = [
  'PENDING',
  'REVIEWED',
  'SHORTLISTED',
  'ACCEPTED',
  'REJECTED',
  'WITHDRAWN',
] as const;

/** Valid UserStatus values (mirrors Prisma enum). */
export const USER_STATUSES = ['PENDING', 'ACTIVE', 'SUSPENDED'] as const;

/** Valid sort fields for admin student listing. */
export const STUDENT_SORT_FIELDS = [
  'createdAt',
  'updatedAt',
  'grade',
  'firstName',
  'lastName',
  'email',
] as const;
