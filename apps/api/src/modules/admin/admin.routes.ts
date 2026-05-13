// ─────────────────────────────────────────────────────────────
// Admin Routes
// All admin panel endpoints.
// Routes must not contain business logic.
// Every route: authenticate → authorize('ADMIN') → rate limit → validate → handler
// ─────────────────────────────────────────────────────────────

import { Router, type Request, type Response } from 'express';
import { asyncHandler } from '../../shared/utils/async-handler.js';
import { validate } from '../../shared/middleware/validation.middleware.js';
import { authenticate, authorize } from '../../shared/middleware/auth.middleware.js';
import { rateLimiter } from '../../shared/middleware/rate-limit.middleware.js';
import {
  updateUserStatusSchema,
  userIdParamSchema,
  listUsersQuerySchema,
  dashboardQuerySchema,
  reportQuerySchema,
  listAuditLogQuerySchema,
  type DashboardQuery,
  type ListUsersQuery,
  type ListAuditLogQuery,
} from './admin.schema.js';
import * as adminService from './admin.service.js';

const router = Router();

// ─── Admin rate limiter (shared across all admin routes) ───

/** Rate limiter: 200 requests per 15 minutes, keyed by user ID. */
const adminRateLimiter = rateLimiter({
  prefix: 'admin',
  max: 200,
  windowMs: 15 * 60 * 1000,
  keyGenerator: (req) => req.user!.id,
});

// ─── GET /admin/dashboard — Platform overview ─────────────

/**
 * GET /admin/dashboard
 * Returns dashboard overview, platform metrics, and user growth data.
 * Supports optional date range filter (from/to).
 * ADMIN only.
 */
router.get(
  '/admin/dashboard',
  authenticate,
  authorize('ADMIN'),
  adminRateLimiter,
  validate(dashboardQuerySchema, 'query'),
  asyncHandler(async (req: Request, res: Response) => {
    const result = await adminService.getDashboard(req.query as DashboardQuery);
    res.status(200).json({
      success: true,
      data: result,
    });
  }),
);

// ─── GET /admin/users — List all users ────────────────────

/**
 * GET /admin/users
 * Paginated listing of all platform users with search, filter, and sort.
 * ADMIN only.
 */
router.get(
  '/admin/users',
  authenticate,
  authorize('ADMIN'),
  adminRateLimiter,
  validate(listUsersQuerySchema, 'query'),
  asyncHandler(async (req: Request, res: Response) => {
    const result = await adminService.listUsers(req.query as unknown as ListUsersQuery);
    res.status(200).json({
      success: true,
      data: result.data,
      meta: result.meta,
    });
  }),
);

// ─── PATCH /admin/users/:userId/status — Update user status ─

/**
 * PATCH /admin/users/:userId/status
 * Activates or suspends a user account.
 * ADMIN only. Self-suspension is blocked by the service.
 */
router.patch(
  '/admin/users/:userId/status',
  authenticate,
  authorize('ADMIN'),
  adminRateLimiter,
  validate(userIdParamSchema, 'params'),
  validate(updateUserStatusSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const { status, reason, notifyUser } = req.body;
    const result = await adminService.updateUserStatus(
      req.params.userId as string,
      status,
      reason,
      notifyUser,
      req.user!.id,
      req.ip,
      req.headers['user-agent'],
    );
    res.status(200).json({
      success: true,
      data: result,
    });
  }),
);

// ─── GET /admin/audit-logs — List audit logs ─────────────

/**
 * GET /admin/audit-logs
 * Paginated listing of audit log entries with filters.
 * ADMIN only. Does not expose ipAddress or userAgent.
 */
router.get(
  '/admin/audit-logs',
  authenticate,
  authorize('ADMIN'),
  adminRateLimiter,
  validate(listAuditLogQuerySchema, 'query'),
  asyncHandler(async (req: Request, res: Response) => {
    const result = await adminService.listAuditLogs(req.query as unknown as ListAuditLogQuery);
    res.status(200).json({
      success: true,
      data: result.data,
      meta: result.meta,
    });
  }),
);

// ─── GET /admin/reports — Generate reports ────────────────

/**
 * GET /admin/reports
 * Generates a report of the specified type (users, internships, applications,
 * companies, schools) in JSON or CSV format.
 * ADMIN only.
 */
router.get(
  '/admin/reports',
  authenticate,
  authorize('ADMIN'),
  adminRateLimiter,
  validate(reportQuerySchema, 'query'),
  asyncHandler(async (req: Request, res: Response) => {
    const query = req.query as { type: string; format: string; from?: string; to?: string };
    const result = await adminService.generateReport({
      type: query.type as 'users' | 'internships' | 'applications' | 'companies' | 'schools',
      format: (query.format as 'json' | 'csv') ?? 'json',
      from: query.from,
      to: query.to,
    } as const);

    // CSV response: set Content-Type and Content-Disposition headers
    if ('csv' in result) {
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="${result.filename}"`);
      res.status(200).send(result.csv);
      return;
    }

    // JSON response
    res.status(200).json({
      success: true,
      data: result,
    });
  }),
);

export default router;
