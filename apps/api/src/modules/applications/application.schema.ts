// ─────────────────────────────────────────────────────────────
// Application — Zod Validation Schemas
// Defines request validation for all application endpoints.
// ─────────────────────────────────────────────────────────────

import { z } from 'zod';

// ─── Update Application Status ───────────────────────────────

/**
 * Schema for `PATCH /applications/:applicationId/status`.
 * Companies update the status of an application.
 */
export const updateApplicationStatusSchema = z.object({
  status: z.enum(['REVIEWED', 'SHORTLISTED', 'ACCEPTED', 'REJECTED'], {
    message: 'Status must be REVIEWED, SHORTLISTED, ACCEPTED, or REJECTED',
  }),
  note: z
    .string()
    .max(500, 'Note must not exceed 500 characters')
    .trim()
    .optional(),
  message: z
    .string()
    .max(1000, 'Message must not exceed 1000 characters')
    .trim()
    .optional(),
});

export type UpdateApplicationStatusInput = z.infer<
  typeof updateApplicationStatusSchema
>;

// ─── Withdraw Application ────────────────────────────────────

/**
 * Schema for `POST /applications/:applicationId/withdraw`.
 * Students withdraw their own application.
 */
export const withdrawApplicationSchema = z.object({
  reason: z
    .string()
    .max(500, 'Reason must not exceed 500 characters')
    .trim()
    .optional(),
});

export type WithdrawApplicationInput = z.infer<typeof withdrawApplicationSchema>;

// ─── Application UUID Param Schema ────────────────────────────

/**
 * Schema for `:applicationId` route param — must be a valid UUID.
 */
export const applicationIdParamSchema = z.object({
  applicationId: z.string().uuid('applicationId must be a valid UUID'),
});

export type ApplicationIdParam = z.infer<typeof applicationIdParamSchema>;

// ─── Application Sort Fields ─────────────────────────────────

/**
 * Valid sort fields for application listing.
 * Aligned with APPROVED_FIELDS from CHECKPOINT_12 spec.
 */
export const APPLICATION_SORT_FIELDS = [
  'appliedAt',
  'updatedAt',
  'status',
] as const;

// ─── List Applications Query ─────────────────────────────────

/** Schema for `GET /applications` query parameters (role-scoped). */
export const listApplicationQuerySchema = z
  .object({
    cursor: z.string().uuid('Cursor must be a valid UUID').optional(),
    pageSize: z.coerce.number().int().min(1).max(100).default(20),
    status: z
      .enum([
        'PENDING',
        'REVIEWED',
        'SHORTLISTED',
        'ACCEPTED',
        'REJECTED',
        'WITHDRAWN',
      ])
      .optional(),
    internshipId: z.string().uuid('Internship ID must be a valid UUID').optional(),
    sort: z.enum(APPLICATION_SORT_FIELDS).default('appliedAt'),
    order: z.enum(['asc', 'desc']).default('desc'),
  })
  .transform((val) => {
    // Map pageSize → limit for the service/repository layer
    const { pageSize, ...rest } = val;
    return { ...rest, limit: pageSize };
  });

export type ListApplicationQuery = z.infer<typeof listApplicationQuerySchema>;
