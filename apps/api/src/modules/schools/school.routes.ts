// ─────────────────────────────────────────────────────────────
// School Routes
// All school-related endpoints.
// Routes must not contain business logic.
// Order: static paths (/) before parameterized paths (/:schoolId).
// ─────────────────────────────────────────────────────────────

import { Router, type Request, type Response } from 'express';
import { asyncHandler } from '../../shared/utils/async-handler.js';
import { validate } from '../../shared/middleware/validation.middleware.js';
import { authenticate, authorize } from '../../shared/middleware/auth.middleware.js';
import {
  createSchoolSchema,
  updateSchoolSchema,
  listSchoolQuerySchema,
  schoolIdParamSchema,
  verifyStudentSchema,
  type ListSchoolQuery,
} from './school.schema.js';
import * as schoolService from './school.service.js';

const router = Router();

// ─── GET /schools — Public listing ─────────────────────────

/**
 * GET /schools
 * Public paginated listing of all schools with search, filter, and sort.
 * No authentication required. Sensitive fields (userId, licenseNumber) stripped.
 */
router.get(
  '/schools',
  validate(listSchoolQuerySchema, 'query'),
  asyncHandler(async (req: Request, res: Response) => {
    const result = await schoolService.list(req.query as unknown as ListSchoolQuery);
    res.status(200).json({
      success: true,
      data: result.data,
      meta: result.meta,
    });
  }),
);

// ─── GET /schools/:schoolId — Public profile ──────────────

/**
 * GET /schools/:schoolId
 * Public school profile with student counts.
 * No authentication required. Sensitive fields stripped.
 */
router.get(
  '/schools/:schoolId',
  validate(schoolIdParamSchema, 'params'),
  asyncHandler(async (req: Request, res: Response) => {
    const result = await schoolService.getById(req.params.schoolId as string);
    res.status(200).json({
      success: true,
      data: result,
    });
  }),
);

// ─── POST /schools — Create school profile ────────────────

/**
 * POST /schools
 * Creates a new school profile for the authenticated user.
 * Requires SCHOOL or ADMIN role.
 * Checks: one-school-per-user, name uniqueness.
 */
router.post(
  '/schools',
  authenticate,
  authorize('SCHOOL', 'ADMIN'),
  validate(createSchoolSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const result = await schoolService.create(req.body, req.user!.id);
    res.status(201).json({
      success: true,
      data: result,
    });
  }),
);

// ─── PATCH /schools/:schoolId — Update school profile ─────

/**
 * PATCH /schools/:schoolId
 * Updates an existing school profile.
 * Accessible only by OWNER (school.userId matches) or ADMIN.
 * Name uniqueness checked on change.
 */
router.patch(
  '/schools/:schoolId',
  authenticate,
  validate(schoolIdParamSchema, 'params'),
  validate(updateSchoolSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const result = await schoolService.update(
      req.params.schoolId as string,
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

// ─── POST /schools/:schoolId/verify-student — Verify enrollment ─

/**
 * POST /schools/:schoolId/verify-student
 * Verifies or revokes a student's enrollment at the school.
 * Accessible only by OWNER (school owner) or ADMIN.
 * Student must have this school set as their school.
 * Creates an audit log entry.
 */
router.post(
  '/schools/:schoolId/verify-student',
  authenticate,
  validate(schoolIdParamSchema, 'params'),
  validate(verifyStudentSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const result = await schoolService.verifyStudent(
      req.params.schoolId as string,
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

export default router;
