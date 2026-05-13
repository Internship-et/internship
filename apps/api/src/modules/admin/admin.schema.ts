// ─────────────────────────────────────────────────────────────
// Admin — Zod Validation Schemas
// Defines request validation for all admin endpoints.
// ─────────────────────────────────────────────────────────────

import { z } from 'zod';

// ─── Constants ───────────────────────────────────────────────

/** Valid sort fields for admin user listing. */
export const ADMIN_USER_SORT_FIELDS = ['email', 'firstName', 'lastName', 'role', 'status', 'createdAt', 'updatedAt', 'lastLoginAt'] as const;

// ─── Update User Status ──────────────────────────────────────

/**
 * Schema for `PATCH /admin/users/:userId/status`.
 * Admin activates or suspends a user account.
 */
export const updateUserStatusSchema = z.object({
  status: z.enum(['ACTIVE', 'SUSPENDED'], {
    message: 'Status must be ACTIVE or SUSPENDED',
  }),
  reason: z
    .string()
    .min(1, 'Reason is required')
    .max(500, 'Reason must not exceed 500 characters')
    .trim(),
  notifyUser: z.boolean().default(true),
});

export type UpdateUserStatusInput = z.infer<typeof updateUserStatusSchema>;

// ─── User ID Param ───────────────────────────────────────────

/**
 * Schema for `:userId` route param — must be a valid UUID.
 */
export const userIdParamSchema = z.object({
  userId: z.string().uuid('userId must be a valid UUID'),
});

export type UserIdParam = z.infer<typeof userIdParamSchema>;

// ─── List Users Query ───────────────────────────────────────-

/**
 * Schema for `GET /admin/users` query parameters.
 * Supports search, role/status/isVerified filters, sort, and pagination.
 */
export const listUsersQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().max(200, 'Search query too long').trim().optional(),
  role: z.enum(['STUDENT', 'COMPANY', 'SCHOOL', 'ADMIN']).optional(),
  status: z.enum(['PENDING', 'ACTIVE', 'SUSPENDED']).optional(),
  isVerified: z
    .enum(['true', 'false'], {
      message: 'isVerified must be true or false',
    })
    .optional()
    .transform((val) => (val === undefined ? undefined : val === 'true')),
  sort: z.enum(ADMIN_USER_SORT_FIELDS).default('createdAt'),
  order: z.enum(['asc', 'desc']).default('desc'),
});

export type ListUsersQuery = z.infer<typeof listUsersQuerySchema>;

// ─── Dashboard Query ─────────────────────────────────────────

/**
 * Schema for `GET /admin/dashboard` query parameters.
 * Optional date range filter for platform metrics.
 */
export const dashboardQuerySchema = z
  .object({
    from: z
      .string()
      .refine(
        (val) => !Number.isNaN(Date.parse(val)),
        { message: 'From must be a valid ISO date or datetime' },
      )
      .optional()
      .default(() => {
        const d = new Date();
        d.setDate(d.getDate() - 30);
        return d.toISOString();
      }),
    to: z
      .string()
      .refine(
        (val) => !Number.isNaN(Date.parse(val)),
        { message: 'To must be a valid ISO date or datetime' },
      )
      .optional()
      .default(() => new Date().toISOString()),
  })
  .superRefine((data, ctx) => {
    if (data.from && data.to) {
      const fromDate = new Date(data.from);
      const toDate = new Date(data.to);
      if (fromDate > toDate) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'From date must not be after to date',
          path: ['from'],
        });
      }
    }
  });

export type DashboardQuery = z.infer<typeof dashboardQuerySchema>;

// ─── Report Query ────────────────────────────────────────────

/**
 * Schema for `GET /admin/reports` query parameters.
 * Supports report type, format (json/csv), and optional date range.
 */
export const reportQuerySchema = z
  .object({
    type: z.enum(['users', 'internships', 'applications', 'companies', 'schools'], {
      message: 'Report type must be one of: users, internships, applications, companies, schools',
    }),
    format: z.enum(['json', 'csv']).default('json'),
    from: z
      .string()
      .refine(
        (val) => !Number.isNaN(Date.parse(val)),
        { message: 'From must be a valid ISO date or datetime' },
      )
      .optional(),
    to: z
      .string()
      .refine(
        (val) => !Number.isNaN(Date.parse(val)),
        { message: 'To must be a valid ISO date or datetime' },
      )
      .optional(),
  })
  .superRefine((data, ctx) => {
    if (data.from && data.to) {
      const fromDate = new Date(data.from);
      const toDate = new Date(data.to);
      if (fromDate > toDate) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'From date must not be after to date',
          path: ['from'],
        });
      }
    }
  });

export type ReportQuery = z.infer<typeof reportQuerySchema>;

// ─── List Audit Logs Query ───────────────────────────────────

/**
 * Schema for `GET /admin/audit-logs` query parameters.
 * Supports pagination, user/action/entity filters, and date range.
 */
export const listAuditLogQuerySchema = z
  .object({
    page: z.coerce.number().int().positive().default(1),
    pageSize: z.coerce.number().int().min(1).max(100).default(50),
    userId: z.string().uuid('User ID must be a valid UUID').optional(),
    action: z.string().max(100, 'Action must not exceed 100 characters').trim().optional(),
    entity: z
      .enum(['USER', 'STUDENT', 'COMPANY', 'INTERNSHIP', 'APPLICATION'])
      .optional(),
    from: z
      .string()
      .datetime({ message: 'From date must be a valid ISO datetime' })
      .optional(),
    to: z
      .string()
      .datetime({ message: 'To date must be a valid ISO datetime' })
      .optional(),
  })
  .superRefine((data, ctx) => {
    if (data.from && data.to) {
      const fromDate = new Date(data.from);
      const toDate = new Date(data.to);
      if (fromDate > toDate) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'From date must not be after to date',
          path: ['from'],
        });
      }
    }
  });

export type ListAuditLogQuery = z.infer<typeof listAuditLogQuerySchema>;
