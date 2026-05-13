// ─────────────────────────────────────────────────────────────
// School — Zod Validation Schemas
// Defines request validation for all school endpoints.
// ─────────────────────────────────────────────────────────────

import { z } from 'zod';

// ─── Helpers ─────────────────────────────────────────────────

const ethiopianPhoneRegex = /^\+251\d{9}$/;

// ─── Constants ───────────────────────────────────────────────

/** Valid SchoolType values (mirrors Prisma enum). */
export const SCHOOL_TYPES = ['PUBLIC', 'PRIVATE', 'GOVERNMENT'] as const;

/** Valid sort fields for school public listing. */
export const SCHOOL_SORT_FIELDS = ['name', 'city', 'type', 'createdAt', 'updatedAt'] as const;

// ─── Create School ───────────────────────────────────────────

/**
 * Schema for `POST /schools`.
 * Registers a new school profile.
 */
export const createSchoolSchema = z.object({
  name: z
    .string()
    .min(1, 'School name is required')
    .max(200, 'School name must not exceed 200 characters')
    .trim(),
  type: z.enum(SCHOOL_TYPES, {
    message: 'Type must be PUBLIC, PRIVATE, or GOVERNMENT',
  }),
  city: z
    .string()
    .min(1, 'City is required')
    .max(100, 'City must not exceed 100 characters')
    .trim(),
  address: z
    .string()
    .max(300, 'Address must not exceed 300 characters')
    .trim()
    .optional(),
  phone: z
    .string()
    .regex(ethiopianPhoneRegex, 'Phone must be a valid Ethiopian number (+251...)')
    .optional(),
  email: z
    .string()
    .email('Invalid email format')
    .max(255, 'Email must not exceed 255 characters')
    .transform((v) => v.toLowerCase())
    .optional(),
  website: z
    .string()
    .url('Website must be a valid URL')
    .max(2048, 'Website URL must not exceed 2048 characters')
    .optional(),
  principal: z
    .string()
    .max(200, 'Principal name must not exceed 200 characters')
    .trim()
    .optional(),
  gradesOffered: z
    .array(
      z
        .number()
        .int('Grade must be a whole number')
        .min(9, 'Grade must be at least 9')
        .max(12, 'Grade must be at most 12'),
    )
    .optional(),
  logoUrl: z
    .string()
    .url('Logo URL must be a valid URL')
    .max(2048, 'Logo URL must not exceed 2048 characters')
    .optional(),
  licenseNumber: z
    .string()
    .max(100, 'License number must not exceed 100 characters')
    .trim()
    .optional(),
});

export type CreateSchoolInput = z.infer<typeof createSchoolSchema>;

// ─── Update School ───────────────────────────────────────────

/** Schema for `PATCH /schools/:schoolId` — all fields optional. */
export const updateSchoolSchema = createSchoolSchema.partial();

export type UpdateSchoolInput = z.infer<typeof updateSchoolSchema>;

// ─── List Schools Query ──────────────────────────────────────

/**
 * Schema for `GET /schools` query parameters (public).
 * Uses strict enums so invalid sort/type values produce a 400 validation error.
 */
export const listSchoolQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().max(200, 'Search query too long').trim().optional(),
  city: z.string().max(100).trim().optional(),
  type: z.enum(SCHOOL_TYPES).optional(),
  sort: z.enum(SCHOOL_SORT_FIELDS).default('name'),
  order: z.enum(['asc', 'desc']).default('asc'),
});

export type ListSchoolQuery = z.infer<typeof listSchoolQuerySchema>;

// ─── School UUID Param Schema ────────────────────────────────

/**
 * Schema for `:schoolId` route param — must be a valid UUID.
 */
export const schoolIdParamSchema = z.object({
  schoolId: z.string().uuid('schoolId must be a valid UUID'),
});

export type SchoolIdParam = z.infer<typeof schoolIdParamSchema>;

// ─── Verify Student ──────────────────────────────────────────

/**
 * Schema for `POST /schools/:schoolId/verify-student`.
 * Schools verify student enrollment.
 */
export const verifyStudentSchema = z
  .object({
    studentId: z.string().uuid('Student ID must be a valid UUID'),
    isEnrolled: z.boolean(),
    grade: z
      .number()
      .int('Grade must be a whole number')
      .min(9, 'Grade must be at least 9')
      .max(12, 'Grade must be at most 12')
      .optional(),
    graduationYear: z
      .number()
      .int('Graduation year must be a whole number')
      .min(new Date().getFullYear(), 'Graduation year cannot be in the past')
      .max(new Date().getFullYear() + 10, 'Graduation year too far in the future')
      .optional(),
    notes: z
      .string()
      .max(500, 'Notes must not exceed 500 characters')
      .trim()
      .optional(),
  })
  .superRefine((data, ctx) => {
    // Grade is required when isEnrolled is true
    if (data.isEnrolled && data.grade === undefined) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Grade is required when marking a student as enrolled',
        path: ['grade'],
      });
    }
  });

export type VerifyStudentInput = z.infer<typeof verifyStudentSchema>;
