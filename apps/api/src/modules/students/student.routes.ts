// ─────────────────────────────────────────────────────────────
// Student Routes
// All student-related endpoints.
// Routes must not contain business logic.
// Order matters: `/students/me` routes MUST be registered BEFORE
// `/students/:studentId` to prevent Express from matching `me`
// as a `:studentId` value.
// ─────────────────────────────────────────────────────────────

import { Router, type Request, type Response } from 'express';
import { asyncHandler } from '../../shared/utils/async-handler.js';
import { validate } from '../../shared/middleware/validation.middleware.js';
import { authenticate, authorize } from '../../shared/middleware/auth.middleware.js';
import {
  updateStudentSchema,
  updateStudentProfileSchema,
  studentIdParamSchema,
  studentApplicationsQuerySchema,
  listStudentQuerySchema,
  type ListStudentQuery,
  type StudentApplicationsQuery,
} from './student.schema.js';
import * as studentService from './student.service.js';

const router = Router();

// ─── GET /students — Admin list ─────────────────────────────

/**
 * GET /students
 * Admin-only paginated listing of all students with search, filter, and sort.
 */
router.get(
  '/students',
  authenticate,
  authorize('ADMIN'),
  validate(listStudentQuerySchema, 'query'),
  asyncHandler(async (req: Request, res: Response) => {
    const result = await studentService.list(req.query as unknown as ListStudentQuery);
    res.status(200).json({
      success: true,
      data: result.data,
      meta: result.meta,
    });
  }),
);

// ─── GET /students/me — Own profile ─────────────────────────

/**
 * GET /students/me
 * Returns the authenticated user's own student profile.
 * Must be registered BEFORE `/students/:studentId`.
 */
router.get(
  '/students/me',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    const result = await studentService.getMyProfile(req.user!.id);
    res.status(200).json({
      success: true,
      data: result,
    });
  }),
);

// ─── PATCH /students/me — Self-upsert ───────────────────────

/**
 * PATCH /students/me
 * Creates or updates the authenticated user's own student profile (upsert).
 * Accepts both User fields (firstName, lastName, phone) and Student fields.
 * Returns 201 if a new profile was created, 200 if an existing one was updated.
 * Only STUDENT role users may create/update their profile.
 */
router.patch(
  '/students/me',
  authenticate,
  validate(updateStudentSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const { profile, created } = await studentService.upsertMyProfile(
      req.user!.id,
      req.user!.role,
      req.body,
    );
    res.status(created ? 201 : 200).json({
      success: true,
      data: profile,
    });
  }),
);

// ─── GET /students/:studentId — Profile by UUID ─────────────

/**
 * GET /students/:studentId
 * Returns a student profile by Student UUID.
 * Accessible only by SELF (the student owner) or ADMIN.
 */
router.get(
  '/students/:studentId',
  authenticate,
  validate(studentIdParamSchema, 'params'),
  asyncHandler(async (req: Request, res: Response) => {
    const result = await studentService.getById(
      req.params.studentId as string,
      req.user!.id,
      req.user!.role,
    );
    res.status(200).json({
      success: true,
      data: result,
    });
  }),
);

// ─── PATCH /students/:studentId — Update by UUID ────────────

/**
 * PATCH /students/:studentId
 * Updates an existing Student profile by Student UUID.
 * Accepts Student-only fields (bio, grade, dateOfBirth, skills, etc.).
 * Uses `updateStudentProfileSchema` with `.strict()` — any unknown fields
 * (e.g., firstName, lastName, phone) will cause a 400 Bad Request.
 * Accessible only by SELF (the student owner) or ADMIN.
 */
router.patch(
  '/students/:studentId',
  authenticate,
  validate(studentIdParamSchema, 'params'),
  validate(updateStudentProfileSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const result = await studentService.updateByStudentId(
      req.params.studentId as string,
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

// ─── GET /students/:studentId/applications ──────────────────

/**
 * GET /students/:studentId/applications
 * Lists a student's applications (read-only).
 * Accessible only by SELF (the student owner) or ADMIN.
 */
router.get(
  '/students/:studentId/applications',
  authenticate,
  validate(studentIdParamSchema, 'params'),
  validate(studentApplicationsQuerySchema, 'query'),
  asyncHandler(async (req: Request, res: Response) => {
    const result = await studentService.getApplications(
      req.params.studentId as string,
      req.query as unknown as StudentApplicationsQuery,
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
