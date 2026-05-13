// ─────────────────────────────────────────────────────────────
// Company — Zod Validation Schemas
// Defines request validation for all company endpoints.
// ─────────────────────────────────────────────────────────────

import { z } from 'zod';

// ─── Social Links ────────────────────────────────────────────

const socialLinksSchema = z
  .object({
    linkedin: z
      .string()
      .url('LinkedIn URL must be a valid URL')
      .max(2048)
      .optional(),
    twitter: z
      .string()
      .url('Twitter URL must be a valid URL')
      .max(2048)
      .optional(),
  })
  .optional();

// ─── Create Company ──────────────────────────────────────────

/**
 * Schema for `POST /companies`.
 * Registers a new company profile.
 */
export const createCompanySchema = z.object({
  name: z
    .string()
    .min(1, 'Company name is required')
    .max(200, 'Company name must not exceed 200 characters')
    .trim(),
  industry: z
    .string()
    .min(1, 'Industry is required')
    .max(100, 'Industry must not exceed 100 characters')
    .trim(),
  description: z
    .string()
    .min(1, 'Description is required')
    .max(2000, 'Description must not exceed 2000 characters')
    .trim(),
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
  size: z
    .enum(['STARTUP', 'SMALL', 'MEDIUM', 'LARGE'], {
      message: 'Size must be STARTUP, SMALL, MEDIUM, or LARGE',
    })
    .optional(),
  foundedYear: z
    .number()
    .int('Founded year must be a whole number')
    .min(1900, 'Founded year must be after 1900')
    .max(new Date().getFullYear(), 'Founded year cannot be in the future')
    .optional(),
  website: z
    .string()
    .url('Website must be a valid URL')
    .max(2048, 'Website URL must not exceed 2048 characters')
    .optional(),
  logoUrl: z
    .string()
    .url('Logo URL must be a valid URL')
    .max(2048, 'Logo URL must not exceed 2048 characters')
    .optional(),
  socialLinks: socialLinksSchema,
  tinNumber: z
    .string()
    .max(50, 'TIN number must not exceed 50 characters')
    .trim()
    .optional(),
});

export type CreateCompanyInput = z.infer<typeof createCompanySchema>;

// ─── Update Company ──────────────────────────────────────────

/** Schema for `PATCH /companies/:companyId` — all fields optional. */
export const updateCompanySchema = createCompanySchema.partial();

export type UpdateCompanyInput = z.infer<typeof updateCompanySchema>;

// ─── List Companies Query ────────────────────────────────────

/**
 * Schema for `GET /companies` query parameters (public).
 * Uses strict enums so invalid sort/hasActiveInternships values
 * produce a 400 validation error instead of being silently ignored.
 */
export const listCompanyQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().max(200, 'Search query too long').trim().optional(),
  industry: z.string().max(100).trim().optional(),
  city: z.string().max(100).trim().optional(),
  hasActiveInternships: z
    .enum(['true', 'false'])
    .transform((val) => val === 'true')
    .optional(),
  sort: z
    .enum(['name', 'industry', 'city', 'createdAt', 'updatedAt'])
    .default('createdAt'),
  order: z.enum(['asc', 'desc']).default('desc'),
});

export type ListCompanyQuery = z.infer<typeof listCompanyQuerySchema>;

// ─── Company UUID Param Schema ───────────────────────────────

/**
 * Schema for `:companyId` route param — must be a valid UUID.
 */
export const companyIdParamSchema = z.object({
  companyId: z.string().uuid('companyId must be a valid UUID'),
});

export type CompanyIdParam = z.infer<typeof companyIdParamSchema>;

// ─── Company Internships Query Schema ────────────────────────

/**
 * Schema for `GET /companies/:companyId/internships` query parameters (public).
 * No status filter — always returns only ACTIVE internships.
 */
export const companyInternshipsQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

export type CompanyInternshipsQuery = z.infer<typeof companyInternshipsQuerySchema>;

// ─── Company Applications Query Schema ───────────────────────

/**
 * Schema for `GET /companies/:companyId/applications` query parameters.
 * All filter values use strict enums to reject invalid input at validation layer.
 */
export const companyApplicationsQuerySchema = z.object({
  internshipId: z
    .string()
    .uuid('Internship ID must be a valid UUID')
    .optional(),
  status: z
    .enum(['PENDING', 'REVIEWED', 'SHORTLISTED', 'ACCEPTED', 'REJECTED', 'WITHDRAWN'])
    .optional(),
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  sort: z.enum(['appliedAt', 'updatedAt', 'status']).default('appliedAt'),
  order: z.enum(['asc', 'desc']).default('desc'),
});

export type CompanyApplicationsQuery = z.infer<typeof companyApplicationsQuerySchema>;

// ─── Shared Enum Constants ───────────────────────────────────

/** Valid InternshipStatus values (mirrors Prisma enum). */
export const INTERNSHIP_STATUSES = ['DRAFT', 'ACTIVE', 'CLOSED'] as const;

/** Valid ApplicationStatus values (mirrors Prisma enum). */
export const APPLICATION_STATUSES = [
  'PENDING',
  'REVIEWED',
  'SHORTLISTED',
  'ACCEPTED',
  'REJECTED',
  'WITHDRAWN',
] as const;

/** Valid sort fields for company public listing. */
export const COMPANY_SORT_FIELDS = [
  'name',
  'industry',
  'city',
  'createdAt',
  'updatedAt',
] as const;

/** Valid sort fields for company applications listing. */
export const COMPANY_APPLICATION_SORT_FIELDS = [
  'appliedAt',
  'updatedAt',
  'status',
] as const;
