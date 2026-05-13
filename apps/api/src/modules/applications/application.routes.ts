// ─────────────────────────────────────────────────────────────
// Application Routes
// All application-related endpoints.
// Routes must not contain business logic.
// Order matters: static paths before parameterized paths.
// ─────────────────────────────────────────────────────────────

import { Router, type Request, type Response } from 'express';
import { asyncHandler } from '../../shared/utils/async-handler.js';
import { validate } from '../../shared/middleware/validation.middleware.js';
import { authenticate, authorize } from '../../shared/middleware/auth.middleware.js';
import {
  listApplicationQuerySchema,
  applicationIdParamSchema,
  updateApplicationStatusSchema,
  withdrawApplicationSchema,
  type ListApplicationQuery,
  type UpdateApplicationStatusInput,
  type WithdrawApplicationInput,
} from './application.schema.js';
import * as applicationService from './application.service.js';

const router = Router();

// ─── GET /applications — Role-scoped listing ─────────────────

/**
 * GET /applications
 * Role-scoped paginated listing of applications.
 * STUDENT → sees own applications.
 * COMPANY → sees applications to own internships.
 * ADMIN → sees all applications.
 * Cursor-based pagination only. Requires authentication.
 */
router.get(
  '/applications',
  authenticate,
  validate(listApplicationQuerySchema, 'query'),
  asyncHandler(async (req: Request, res: Response) => {
    const result = await applicationService.list(
      req.user!.id,
      req.user!.role,
      req.query as unknown as ListApplicationQuery,
    );
    res.status(200).json({
      success: true,
      data: result.data,
      meta: result.meta,
    });
  }),
);

// ─── GET /applications/:applicationId — Detail view ─────────

/**
 * GET /applications/:applicationId
 * Application detail with full status history.
 * Requires authentication. Ownership check in service layer.
 * Data visibility: companyNote hidden from student.
 * Student contact info visible to company and admin.
 */
router.get(
  '/applications/:applicationId',
  authenticate,
  validate(applicationIdParamSchema, 'params'),
  asyncHandler(async (req: Request, res: Response) => {
    const result = await applicationService.getById(
      req.params.applicationId as string,
      req.user!.id,
      req.user!.role,
    );
    res.status(200).json({
      success: true,
      data: result,
    });
  }),
);

// ─── PATCH /applications/:applicationId/status — Status update ──

/**
 * PATCH /applications/:applicationId/status
 * Updates application status (COMPANY or ADMIN only).
 * Enforces state machine transitions in service layer.
 * Creates ApplicationStatusHistory entry on every change.
 * Accepts `message` field but does not persist it (deferred — see KNOWN_GAPS_REGISTER.md).
 */
router.patch(
  '/applications/:applicationId/status',
  authenticate,
  authorize('COMPANY', 'ADMIN'),
  validate(applicationIdParamSchema, 'params'),
  validate(updateApplicationStatusSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const result = await applicationService.updateStatus(
      req.params.applicationId as string,
      req.body as UpdateApplicationStatusInput,
      req.user!.id,
      req.user!.role,
    );
    res.status(200).json({
      success: true,
      data: result,
    });
  }),
);

// ─── POST /applications/:applicationId/withdraw — Withdraw ───

/**
 * POST /applications/:applicationId/withdraw
 * Withdraws an application (STUDENT self-service only).
 * Route uses `authenticate` only — service layer enforces STUDENT + ownership.
 * Only PENDING or REVIEWED applications can be withdrawn.
 * Creates ApplicationStatusHistory entry on withdrawal.
 * COMPANY, SCHOOL, ADMIN, and non-owner students are rejected with 403.
 */
router.post(
  '/applications/:applicationId/withdraw',
  authenticate,
  validate(applicationIdParamSchema, 'params'),
  validate(withdrawApplicationSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const result = await applicationService.withdraw(
      req.params.applicationId as string,
      req.body as WithdrawApplicationInput,
      req.user!.id,
    );
    res.status(200).json({
      success: true,
      data: result,
    });
  }),
);

export default router;
