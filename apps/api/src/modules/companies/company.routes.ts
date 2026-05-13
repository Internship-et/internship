// ─────────────────────────────────────────────────────────────
// Company Routes
// All company-related endpoints.
// Routes must not contain business logic.
// Order: static paths (/) before parameterized paths (/:companyId).
// ─────────────────────────────────────────────────────────────

import { Router, type Request, type Response } from 'express';
import { asyncHandler } from '../../shared/utils/async-handler.js';
import { validate } from '../../shared/middleware/validation.middleware.js';
import { authenticate, authorize } from '../../shared/middleware/auth.middleware.js';
import {
  createCompanySchema,
  updateCompanySchema,
  listCompanyQuerySchema,
  companyIdParamSchema,
  companyInternshipsQuerySchema,
  companyApplicationsQuerySchema,
  type ListCompanyQuery,
  type CompanyInternshipsQuery,
  type CompanyApplicationsQuery,
} from './company.schema.js';
import * as companyService from './company.service.js';

const router = Router();

// ─── GET /companies — Public listing ─────────────────────────

/**
 * GET /companies
 * Public paginated listing of all companies with search, filter, and sort.
 * No authentication required. Sensitive fields (tinNumber, userId) stripped.
 */
router.get(
  '/companies',
  validate(listCompanyQuerySchema, 'query'),
  asyncHandler(async (req: Request, res: Response) => {
    const result = await companyService.list(req.query as unknown as ListCompanyQuery);
    res.status(200).json({
      success: true,
      data: result.data,
      meta: result.meta,
    });
  }),
);

// ─── GET /companies/:companyId — Public profile ────────────

/**
 * GET /companies/:companyId
 * Public company profile with internship counts.
 * No authentication required. Sensitive fields stripped.
 */
router.get(
  '/companies/:companyId',
  validate(companyIdParamSchema, 'params'),
  asyncHandler(async (req: Request, res: Response) => {
    const result = await companyService.getById(req.params.companyId as string);
    res.status(200).json({
      success: true,
      data: result,
    });
  }),
);

// ─── POST /companies — Create company profile ─────────────

/**
 * POST /companies
 * Creates a new company profile for the authenticated user.
 * Requires COMPANY or ADMIN role.
 * Checks: one-company-per-user, name uniqueness, TIN uniqueness.
 */
router.post(
  '/companies',
  authenticate,
  authorize('COMPANY', 'ADMIN'),
  validate(createCompanySchema),
  asyncHandler(async (req: Request, res: Response) => {
    const result = await companyService.create(req.body, req.user!.id);
    res.status(201).json({
      success: true,
      data: result,
    });
  }),
);

// ─── PATCH /companies/:companyId — Update company profile ──

/**
 * PATCH /companies/:companyId
 * Updates an existing company profile.
 * Accessible only by OWNER (company.userId matches) or ADMIN.
 * Name/TIN uniqueness checked on change.
 */
router.patch(
  '/companies/:companyId',
  authenticate,
  validate(companyIdParamSchema, 'params'),
  validate(updateCompanySchema),
  asyncHandler(async (req: Request, res: Response) => {
    const result = await companyService.update(
      req.params.companyId as string,
      req.body,
      req.user!.id,
      req.user!.role,
    );
    res.status(200).json({
      success: true,
      data: result,
    });
  }),
);

// ─── GET /companies/:companyId/internships — Public internships ─

/**
 * GET /companies/:companyId/internships
 * Lists ACTIVE internships for a company (public).
 * No authentication required. No applicationCount in response.
 */
router.get(
  '/companies/:companyId/internships',
  validate(companyIdParamSchema, 'params'),
  validate(companyInternshipsQuerySchema, 'query'),
  asyncHandler(async (req: Request, res: Response) => {
    const result = await companyService.getInternships(
      req.params.companyId as string,
      req.query as unknown as CompanyInternshipsQuery,
    );
    res.status(200).json({
      success: true,
      data: result.data,
      meta: result.meta,
    });
  }),
);

// ─── GET /companies/:companyId/applications — Scoped applications ─

/**
 * GET /companies/:companyId/applications
 * Lists applications to a company's internships.
 * Accessible only by OWNER (company owner) or ADMIN.
 */
router.get(
  '/companies/:companyId/applications',
  authenticate,
  validate(companyIdParamSchema, 'params'),
  validate(companyApplicationsQuerySchema, 'query'),
  asyncHandler(async (req: Request, res: Response) => {
    const result = await companyService.getApplications(
      req.params.companyId as string,
      req.query as unknown as CompanyApplicationsQuery,
      req.user!.id,
      req.user!.role,
    );
    res.status(200).json({
      success: true,
      data: result.data,
      meta: result.meta,
    });
  }),
);

export default router;
