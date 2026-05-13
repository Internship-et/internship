// ─────────────────────────────────────────────────────────────
// Auth Routes
// All authentication-related endpoints.
// Routes must not contain business logic.
// ─────────────────────────────────────────────────────────────

import { Router, type Request, type Response } from 'express';
import { asyncHandler } from '../../shared/utils/async-handler.js';
import { validate } from '../../shared/middleware/validation.middleware.js';
import { authenticate } from '../../shared/middleware/auth.middleware.js';
import { rateLimiter } from '../../shared/middleware/rate-limit.middleware.js';
import {
  registerSchema,
  loginSchema,
  refreshTokenSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  logoutSchema,
  updateProfileSchema,
} from './auth.schema.js';
import * as authService from './auth.service.js';

const router = Router();

// ─── POST /auth/register ────────────────────────────────────

/**
 * POST /auth/register
 * Creates a new user account (User record only) and returns tokens.
 * Rate limited: 20 requests per 15 minutes (IP-keyed).
 */
router.post(
  '/auth/register',
  rateLimiter({ prefix: 'auth', windowMs: 15 * 60 * 1000, max: 20 }),
  validate(registerSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const result = await authService.register(req.body);
    res.status(201).json({
      success: true,
      data: result,
    });
  }),
);

// ─── POST /auth/login ───────────────────────────────────────

/**
 * POST /auth/login
 * Authenticates a user and returns JWT tokens.
 * Rate limited: 20 requests per 15 minutes (IP-keyed).
 */
router.post(
  '/auth/login',
  rateLimiter({ prefix: 'auth', windowMs: 15 * 60 * 1000, max: 20 }),
  validate(loginSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const result = await authService.login(req.body);
    res.status(200).json({
      success: true,
      data: result,
    });
  }),
);

// ─── POST /auth/refresh ─────────────────────────────────────

/**
 * POST /auth/refresh
 * Rotates an existing refresh token and returns a new token pair.
 */
router.post(
  '/auth/refresh',
  validate(refreshTokenSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const result = await authService.refresh(req.body.refreshToken);
    res.status(200).json({
      success: true,
      data: result,
    });
  }),
);

// ─── POST /auth/logout ──────────────────────────────────────

/**
 * POST /auth/logout
 * Invalidates the current session (or all sessions if no token provided).
 * Body is optional. If refreshToken is provided and is not a string,
 * the validate(logoutSchema) middleware returns 400 with validation details.
 * Requires authentication.
 */
router.post(
  '/auth/logout',
  authenticate,
  validate(logoutSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const result = await authService.logout(req.user!.id, req.body.refreshToken);
    res.status(200).json({
      success: true,
      data: result,
    });
  }),
);

// ─── POST /auth/forgot-password ─────────────────────────────

/**
 * POST /auth/forgot-password
 * Sends a password reset link (or generic success message) to the given email.
 * Rate limited: 5 requests per 15 minutes (IP-keyed).
 */
router.post(
  '/auth/forgot-password',
  rateLimiter({ prefix: 'password-reset', windowMs: 15 * 60 * 1000, max: 5 }),
  validate(forgotPasswordSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const result = await authService.forgotPassword(req.body.email);
    res.status(200).json({
      success: true,
      data: result,
    });
  }),
);

// ─── POST /auth/reset-password ──────────────────────────────

/**
 * POST /auth/reset-password
 * Resets the password using a valid reset token.
 * Rate limited: 5 requests per 15 minutes (IP-keyed).
 */
router.post(
  '/auth/reset-password',
  rateLimiter({ prefix: 'password-reset', windowMs: 15 * 60 * 1000, max: 5 }),
  validate(resetPasswordSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const result = await authService.resetPassword(req.body.token, req.body.newPassword);
    res.status(200).json({
      success: true,
      data: result,
    });
  }),
);

// ─── GET /auth/me ───────────────────────────────────────────

/**
 * GET /auth/me
 * Returns the authenticated user's profile.
 */
router.get(
  '/auth/me',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    const result = await authService.getMe(req.user!.id);
    res.status(200).json({
      success: true,
      data: result,
    });
  }),
);

// ─── PATCH /auth/me ─────────────────────────────────────────

/**
 * PATCH /auth/me
 * Updates the authenticated user's base profile fields
 * (firstName, lastName, phone only).
 */
router.patch(
  '/auth/me',
  authenticate,
  validate(updateProfileSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const result = await authService.updateProfile(req.user!.id, req.body);
    res.status(200).json({
      success: true,
      data: result,
    });
  }),
);

export default router;
