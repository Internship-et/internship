// ─────────────────────────────────────────────────────────────
// Internship — Zod Validation Schemas
// Defines request validation for all internship endpoints.
// ─────────────────────────────────────────────────────────────

import { z } from 'zod';

// ─── Stipend Sub-schema ──────────────────────────────────────

const stipendSchema = z
  .object({
    amount: z
      .number()
      .int('Stipend amount must be a whole number')
      .min(0, 'Stipend amount must be non-negative'),
    currency: z.string().max(10, 'Currency code too long').default('ETB'),
    period: z.enum(['MONTHLY', 'ONCE', 'WEEKLY'], {
      message: 'Period must be MONTHLY, ONCE, or WEEKLY',
    }),
  })
  .optional();

// ─── Internship Base Shape ───────────────────────────────────

/**
 * Base shape shared by both create and update schemas.
 * Excludes the .superRefine for cross-field validation;
 * each schema adds its own refinement.
 */
const internshipBaseShape = {
  title: z
    .string()
    .min(1, 'Title is required')
    .max(200, 'Title must not exceed 200 characters')
    .trim(),
  description: z
    .string()
    .min(1, 'Description is required')
    .max(5000, 'Description must not exceed 5000 characters')
    .trim(),
  responsibilities: z
    .array(
      z.string().max(500, 'Each responsibility must not exceed 500 characters').trim(),
    )
    .max(10, 'You can have at most 10 responsibilities')
    .optional(),
  requirements: z
    .array(
      z.string().max(500, 'Each requirement must not exceed 500 characters').trim(),
    )
    .min(1, 'At least one requirement is required')
    .max(10, 'You can have at most 10 requirements'),
  preferredSkills: z
    .array(
      z.string().max(100, 'Each skill must not exceed 100 characters').trim(),
    )
    .optional(),
  type: z.enum(['ON_SITE', 'REMOTE', 'HYBRID'], {
    message: 'Type must be ON_SITE, REMOTE, or HYBRID',
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
  durationMonths: z
    .number()
    .int('Duration must be a whole number')
    .min(1, 'Duration must be at least 1 month')
    .max(12, 'Duration must not exceed 12 months'),
  weeklyHours: z
    .number()
    .int('Weekly hours must be a whole number')
    .min(5, 'Weekly hours must be at least 5')
    .max(40, 'Weekly hours must not exceed 40')
    .optional(),
  startDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Start date must be a valid date (YYYY-MM-DD)')
    .optional(),
  deadline: z
    .string()
    .datetime({ message: 'Deadline must be a valid ISO datetime' })
    .optional(),
  stipend: stipendSchema,
  benefits: z
    .array(
      z.string().max(200, 'Each benefit must not exceed 200 characters').trim(),
    )
    .max(10, 'You can have at most 10 benefits')
    .optional(),
  tags: z
    .array(z.string().max(50, 'Each tag must not exceed 50 characters').trim())
    .optional(),
  minGrade: z
    .number()
    .int('Minimum grade must be a whole number')
    .min(9, 'Minimum grade must be at least 9')
    .max(12, 'Maximum grade must be at most 12')
    .optional(),
  maxGrade: z
    .number()
    .int('Maximum grade must be a whole number')
    .min(9, 'Minimum grade must be at least 9')
    .max(12, 'Maximum grade must be at most 12')
    .optional(),
};

const crossFieldRefinement = (
  data: { minGrade?: number | null; maxGrade?: number | null; minDuration?: number | null; maxDuration?: number | null },
  ctx: z.RefinementCtx,
): void => {
  if (
    data.minGrade !== undefined &&
    data.minGrade !== null &&
    data.maxGrade !== undefined &&
    data.maxGrade !== null &&
    data.minGrade > data.maxGrade
  ) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Minimum grade must not exceed maximum grade',
      path: ['minGrade'],
    });
  }
  if (
    data.minDuration !== undefined &&
    data.minDuration !== null &&
    data.maxDuration !== undefined &&
    data.maxDuration !== null &&
    data.minDuration > data.maxDuration
  ) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Minimum duration must not exceed maximum duration',
      path: ['minDuration'],
    });
  }
};

// ─── Create Internship ───────────────────────────────────────

/**
 * Schema for `POST /internships`.
 * Creates a new internship listing.
 * Cross-field validation: minGrade ≤ maxGrade.
 */
export const createInternshipSchema = z
  .object(internshipBaseShape)
  .superRefine((data, ctx) => crossFieldRefinement(data, ctx));

export type CreateInternshipInput = z.infer<typeof createInternshipSchema>;

// ─── Update Internship ───────────────────────────────────────

/**
 * Schema for `PATCH /internships/:internshipId`.
 * All fields optional plus an explicit `status` field for publishing (DRAFT → ACTIVE).
 */
export const updateInternshipSchema = z
  .object({
    title: z.string().min(1).max(200).trim().optional(),
    description: z.string().min(1).max(5000).trim().optional(),
    responsibilities: z.array(z.string().max(500).trim()).max(10).optional(),
    requirements: z.array(z.string().max(500).trim()).min(1).max(10).optional(),
    preferredSkills: z.array(z.string().max(100).trim()).optional(),
    type: z.enum(['ON_SITE', 'REMOTE', 'HYBRID']).optional(),
    city: z.string().min(1).max(100).trim().optional(),
    address: z.string().max(300).trim().optional(),
    durationMonths: z.number().int().min(1).max(12).optional(),
    weeklyHours: z.number().int().min(5).max(40).optional(),
    startDate: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, 'Start date must be a valid date (YYYY-MM-DD)')
      .optional(),
    deadline: z
      .string()
      .datetime({ message: 'Deadline must be a valid ISO datetime' })
      .optional(),
    stipend: stipendSchema,
    benefits: z.array(z.string().max(200).trim()).max(10).optional(),
    tags: z.array(z.string().max(50).trim()).optional(),
    minGrade: z.number().int().min(9).max(12).optional(),
    maxGrade: z.number().int().min(9).max(12).optional(),
    status: z.enum(['DRAFT', 'ACTIVE']).optional(),
  })
  .superRefine((data, ctx) => crossFieldRefinement(data, ctx));

export type UpdateInternshipInput = z.infer<typeof updateInternshipSchema>;

// ─── List Internships Query ──────────────────────────────────

/**
 * Valid sort fields for internship public listing.
 * Aligned with approved fields from CHECKPOINT_11 spec.
 * `createdAt` is the default tie-breaker via repository buildListOrderBy.
 */
export const INTERNSHIP_SORT_FIELDS = [
  'title',
  'city',
  'type',
  'durationMonths',
  'createdAt',
  'updatedAt',
  'deadline',
  'startDate',
] as const;

/**
 * Schema for `GET /internships` query parameters (public).
 * Cursor-based pagination only. Uses z.enum for strict sort validation.
 * Exposes `pageSize` externally; internally maps to `limit` for the service/repository layer.
 */
export const listInternshipQuerySchema = z
  .object({
    cursor: z.string().uuid('Cursor must be a valid UUID').optional(),
    pageSize: z.coerce.number().int().min(1).max(100).default(20),
    search: z.string().max(200, 'Search query too long').trim().optional(),
    companyId: z.string().uuid('Company ID must be a valid UUID').optional(),
    city: z.string().max(100).trim().optional(),
    type: z.enum(['ON_SITE', 'REMOTE', 'HYBRID']).optional(),
    minDuration: z.coerce.number().int().min(1).max(12).optional(),
    maxDuration: z.coerce.number().int().min(1).max(12).optional(),
    minGrade: z.coerce.number().int().min(9).max(12).optional(),
    maxGrade: z.coerce.number().int().min(9).max(12).optional(),
    tags: z
      .union([z.string(), z.array(z.string())])
      .optional()
      .transform((val) => {
        if (typeof val === 'string') { return val.split(',').map((t) => t.trim()); }
        return val;
      }),
    sort: z.enum(INTERNSHIP_SORT_FIELDS).default('createdAt'),
    order: z.enum(['asc', 'desc']).default('desc'),
  })
  .superRefine(crossFieldRefinement)
  .transform((val) => {
    // Map pageSize → limit for the service/repository layer
    const { pageSize, ...rest } = val;
    return { ...rest, limit: pageSize };
  });

export type ListInternshipQuery = z.infer<typeof listInternshipQuerySchema>;

// ─── Internship UUID Param Schema ────────────────────────────

/**
 * Schema for `:internshipId` route param — must be a valid UUID.
 */
export const internshipIdParamSchema = z.object({
  internshipId: z.string().uuid('internshipId must be a valid UUID'),
});

export type InternshipIdParam = z.infer<typeof internshipIdParamSchema>;

// ─── Apply for Internship ────────────────────────────────────

/** Schema for `POST /internships/:internshipId/apply`. */
export const applyInternshipSchema = z.object({
  coverLetter: z
    .string()
    .max(2000, 'Cover letter must not exceed 2000 characters')
    .trim()
    .optional(),
  additionalInfo: z
    .string()
    .max(1000, 'Additional info must not exceed 1000 characters')
    .trim()
    .optional(),
});

export type ApplyInternshipInput = z.infer<typeof applyInternshipSchema>;
