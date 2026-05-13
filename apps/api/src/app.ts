// ─────────────────────────────────────────────────────────────
// Express App Factory
// Creates and configures the Express application with the full
// middleware stack and route registrations.
// ─────────────────────────────────────────────────────────────

import express from 'express';
import { requestIdMiddleware } from './shared/middleware/request-id.middleware.js';
import { corsMiddleware } from './shared/middleware/cors.middleware.js';
import { securityHeadersMiddleware } from './shared/middleware/security-headers.middleware.js';
import { cacheControlMiddleware } from './shared/middleware/cache-control.middleware.js';
import { requestLoggerMiddleware } from './shared/middleware/logging.middleware.js';
import { rateLimiter } from './shared/middleware/rate-limit.middleware.js';
import { notFoundHandler, errorHandler } from './shared/middleware/error.middleware.js';
import healthRoutes from './modules/health/health.routes.js';
import authRoutes from './modules/auth/auth.routes.js';
import studentRoutes from './modules/students/student.routes.js';
import companyRoutes from './modules/companies/company.routes.js';
import internshipRoutes from './modules/internships/internship.routes.js';
import applicationRoutes from './modules/applications/application.routes.js';
import schoolRoutes from './modules/schools/school.routes.js';
import adminRoutes from './modules/admin/admin.routes.js';

/**
 * Creates and returns a fully configured Express application.
 * Middleware order (from BACKEND_IMPLEMENTATION_REFERENCE.md §5):
 *   1. Request ID
 *   2. CORS
 *   3. Security headers
 *   3b. Cache-Control headers
 *   4. Global rate limiter
 *   5. Request logging
 *   6. Body parsing (JSON + URL-encoded)
 *   7. Routes
 *   8. 404 handler
 *   9. Global error handler
 *
 * The global rate limiter is mounted app-wide (before route-specific
 * mounts) so it covers root health paths AND /api/v1 routes.
 */
export function createApp(): express.Application {
  const app = express();

  // ─── 1. Request ID ──────────────────────────────────────────
  app.use(requestIdMiddleware);

  // ─── 2. CORS ────────────────────────────────────────────────
  app.use(corsMiddleware);

  // ─── 3. Security headers ────────────────────────────────────
  app.use(securityHeadersMiddleware);

  // ─── 3b. Cache-Control headers ─────────────────────────────
  // Must be set after security headers and before rate limiting
  // to ensure all responses carry appropriate Cache-Control directives.
  app.use(cacheControlMiddleware);

  // ─── 4. Global rate limiter (app-wide, covers root + /api/v1) ─
  // Health endpoints are skipped (k8s probes must not be throttled).
  app.use(rateLimiter({
    prefix: 'global',
    windowMs: 15 * 60 * 1000,
    max: 100,
    skip: (req) => {
      const path = req.path;
      return (
        path === '/health' ||
        path === '/health/live' ||
        path === '/health/ready' ||
        path === '/api/v1/health' ||
        path === '/api/v1/health/live' ||
        path === '/api/v1/health/ready'
      );
    },
  }));

  // ─── 5. Request logging ─────────────────────────────────────
  app.use(requestLoggerMiddleware);

  // ─── 6. Body parsing ────────────────────────────────────────
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  // ─── 7. Health routes (root paths as required by API contract) ─
  app.use(healthRoutes);

  // Also mount health at /api/v1/health alias
  app.use('/api/v1', healthRoutes);

  // ─── 7b. Auth routes ──────────────────────────────────────
  app.use('/api/v1', authRoutes);

  // ─── 7c. Student routes ────────────────────────────────────
  // `/students/me` routes are registered before `/:studentId` inside the router
  app.use('/api/v1', studentRoutes);

  // ─── 7d. Company routes ───────────────────────────────────
  app.use('/api/v1', companyRoutes);

  // ─── 7e. Internship routes ───────────────────────────────
  app.use('/api/v1', internshipRoutes);

  // ─── 7f. Application routes ─────────────────────────────
  app.use('/api/v1', applicationRoutes);

  // ─── 7g. School routes ──────────────────────────────────────
  app.use('/api/v1', schoolRoutes);

  // ─── 7h. Admin routes ──────────────────────────────────────
  app.use('/api/v1', adminRoutes);

  // ─── 8. 404 handler (must be after all routes) ──────────────
  app.use(notFoundHandler);

  // ─── 9. Global error handler (must be last) ─────────────────
  app.use(errorHandler);

  return app;
}

export default createApp;
