// ─────────────────────────────────────────────────────────────
// Auth — Zod Validation Schemas
// Defines request validation for all auth endpoints.
// ─────────────────────────────────────────────────────────────

import { z } from 'zod';

// ─── Helpers ─────────────────────────────────────────────────

/** Ethiopian phone number: +251 followed by 9 digits. */
const ethiopianPhoneRegex = /^\+251\d{9}$/;

/** Common password rules. */
const passwordSchema = z
  .string()
  .min(8, 'Password must be at least 8 characters')
  .max(128, 'Password must not exceed 128 characters');

/** Common email rules. */
const emailSchema = z
  .string()
  .email('Invalid email format')
  .max(255, 'Email must not exceed 255 characters')
  .transform((v) => v.toLowerCase());

// ─── Registration ────────────────────────────────────────────

/**
 * Schema for `POST /auth/register`.
 * Creates only the User record. Role-specific profile fields
 * (schoolId, companyName) are deferred to domain module
 * checkpoints (9–14).
 */
export const registerSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
  firstName: z
    .string()
    .min(1, 'First name is required')
    .max(100, 'First name must not exceed 100 characters')
    .trim(),
  lastName: z
    .string()
    .min(1, 'Last name is required')
    .max(100, 'Last name must not exceed 100 characters')
    .trim(),
  role: z.enum(['STUDENT', 'COMPANY', 'SCHOOL'], {
    message: 'Role must be STUDENT, COMPANY, or SCHOOL',
  }),
  phone: z
    .string()
    .regex(ethiopianPhoneRegex, 'Phone must be a valid Ethiopian number (+251...)')
    .optional(),
  agreeToTerms: z.literal(true, {
    message: 'You must agree to the terms of service',
  }),
});

export type RegisterInput = z.infer<typeof registerSchema>;

// ─── Login ───────────────────────────────────────────────────

/** Schema for `POST /auth/login`. */
export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, 'Password is required'),
});

export type LoginInput = z.infer<typeof loginSchema>;

// ─── Refresh Token ───────────────────────────────────────────

/** Schema for `POST /auth/refresh`. */
export const refreshTokenSchema = z.object({
  refreshToken: z.string().min(1, 'Refresh token is required'),
});

export type RefreshTokenInput = z.infer<typeof refreshTokenSchema>;

// ─── Forgot Password ─────────────────────────────────────────

/** Schema for `POST /auth/forgot-password`. */
export const forgotPasswordSchema = z.object({
  email: emailSchema,
});

export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;

// ─── Reset Password ──────────────────────────────────────────

/** Schema for `POST /auth/reset-password`. */
export const resetPasswordSchema = z.object({
  token: z.string().min(1, 'Reset token is required'),
  newPassword: passwordSchema,
});

export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;

// ─── Logout ────────────────────────────────────────────────

/**
 * Schema for `POST /auth/logout`.
 * Body is optional; if present, `refreshToken` must be a non-empty string.
 */
export const logoutSchema = z
  .object({
    refreshToken: z
      .string()
      .min(1, 'Refresh token must not be empty')
      .optional(),
  })
  .default({});

export type LogoutInput = z.infer<typeof logoutSchema>;

// ─── Update Profile ──────────────────────────────────────────

/**
 * Schema for `PATCH /auth/me`.
 * Only base User fields can be updated here.
 * Role-specific profile fields belong to domain modules.
 */
export const updateProfileSchema = z.object({
  firstName: z
    .string()
    .min(1, 'First name must not be empty')
    .max(100, 'First name must not exceed 100 characters')
    .trim()
    .optional(),
  lastName: z
    .string()
    .min(1, 'Last name must not be empty')
    .max(100, 'Last name must not exceed 100 characters')
    .trim()
    .optional(),
  phone: z
    .string()
    .regex(ethiopianPhoneRegex, 'Phone must be a valid Ethiopian number (+251...)')
    .optional(),
});

export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;
