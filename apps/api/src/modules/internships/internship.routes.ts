// ─────────────────────────────────────────────────────────────
// Internship Routes
// All internship-related endpoints.
// Routes must not contain business logic.
// Order matters: static paths before parameterized paths.
// ─────────────────────────────────────────────────────────────

import { Router, type Request, type Response } from 'express';
import { asyncHandler } from '../../shared/utils/async-handler.js';
import { validate } from '../../shared/middleware/validation.middleware.js';
import { authenticate, authorize } from '../../shared/middleware/auth.middleware.js';
import { rateLimiter } from '../../shared/middleware/rate-limit.middleware.js';
import {
  createInternshipSchema,
  updateInternshipSchema,
  listInternshipQuerySchema,
  internshipIdParamSchema,
  applyInternshipSchema,
  type ListInternshipQuery,
  type ApplyInternshipInput,
  type CreateInternshipInput,
  type UpdateInternshipInput,
} from './internship.schema.js';
import * as internshipService from './internship.service.js';

const router = Router();

// ─── GET /internships — Public listing ───────────────────────

/**
 * GET /internships
 * Public paginated listing of all ACTIVE internships with search, filter, and sort.
 * Cursor-based pagination only. No authentication required.
 * Internal fields (_count, companyId, deletedAt, company.userId) stripped.
 */
router.get(
  '/internships',
  validate(listInternshipQuerySchema, 'query'),
  asyncHandler(async (req: Request, res: Response) => {
    const result = await internshipService.list(req.query as unknown as ListInternshipQuery);
    res.status(200).json({
      success: true,
      data: result.data,
      meta: result.meta,
    });
  }),
);

// ─── GET /internships/:internshipId — Public details ─────────

/**
 * GET /internships/:internshipId
 * Public details of a single ACTIVE internship.
 * No authentication required. Only ACTIVE internships are returned.
 * Internal fields (_count, companyId, deletedAt, company.userId) stripped.
 */
router.get(
  '/internships/:internshipId',
  validate(internshipIdParamSchema, 'params'),
  asyncHandler(async (req: Request, res: Response) => {
    const result = await internshipService.getById(req.params.internshipId as string);
    res.status(200).json({
      success: true,
      data: result,
    });
  }),
);

// ─── POST /internships — Create internship ───────────────────

/**
 * POST /internships
 * Creates a new internship listing in DRAFT status.
 * Requires COMPANY or ADMIN role. The user's company profile is looked up automatically.
 */
router.post(
  '/internships',
  authenticate,
  authorize('COMPANY', 'ADMIN'),
  validate(createInternshipSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const result = await internshipService.create(
      req.body as CreateInternshipInput,
      req.user!.id,
      req.user!.role,
    );
    res.status(201).json({
      success: true,
      data: result,
    });
  }),
);

// ─── PATCH /internships/:internshipId — Update internship ────

/**
 * PATCH /internships/:internshipId
 * Updates an existing internship.
 * Accessible only by OWNER (company that owns the internship) or ADMIN.
 * Status field allowed for DRAFT→ACTIVE transition (publish).
 * Cross-field validation (minGrade ≤ maxGrade) enforced by Zod.
 */
router.patch(
  '/internships/:internshipId',
  authenticate,
  validate(internshipIdParamSchema, 'params'),
  validate(updateInternshipSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const result = await internshipService.update(
      req.params.internshipId as string,
      req.body as UpdateInternshipInput,
      req.user!.id,
      req.user!.role,
    );
    res.status(200).json({
      success: true,
      data: result,
    });
  }),
);

// ─── DELETE /internships/:internshipId — Close internship ────

/**
 * DELETE /internships/:internshipId
 * Soft-closes an internship — sets status to CLOSED and deletedAt timestamp.
 * Accessible only by OWNER or ADMIN.
 * Returns 204 No Content (no body).
 * Cannot close if there are ACCEPTED applications.
 */
router.delete(
  '/internships/:internshipId',
  authenticate,
  validate(internshipIdParamSchema, 'params'),
  asyncHandler(async (req: Request, res: Response) => {
    await internshipService.close(
      req.params.internshipId as string,
      req.user!.id,
      req.user!.role,
    );
    res.status(204).send();
  }),
);

// ─── POST /internships/:internshipId/apply — Apply ──────────

/**
 * POST /internships/:internshipId/apply
 * Submits an application to an ACTIVE internship.
 * Requires STUDENT role.
 * Rate-limited: 10 applications per 15 minutes per user.
 * Validates: grade requirements, deadline, and duplicate applications.
 */
router.post(
  '/internships/:internshipId/apply',
  authenticate,
  authorize('STUDENT'),
  validate(internshipIdParamSchema, 'params'),
  validate(applyInternshipSchema),
  rateLimiter({
    prefix: 'application',
    max: 10,
    windowMs: 15 * 60 * 1000,
    keyGenerator: (req) => req.user!.id,
  }),
  asyncHandler(async (req: Request, res: Response) => {
    const result = await internshipService.apply(
      req.params.internshipId as string,
      req.user!.id,
      req.body as ApplyInternshipInput,
    );
    res.status(201).json({
      success: true,
      data: result,
    });
  }),
);

export default router;
