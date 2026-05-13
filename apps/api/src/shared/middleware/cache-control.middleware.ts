// ─────────────────────────────────────────────────────────────
// Cache-Control Middleware
// Sets Cache-Control headers on every response based on the
// request path. Uses path-based logic (not req.user-dependent)
// to ensure consistent behavior regardless of middleware ordering.
//
// Strategy:
//  - Health endpoints → "public, max-age=0" (CDN-friendly)
//  - /api/v1/* API endpoints → "no-store" (sensitive data)
//  - Everything else → "no-cache" (conservative default)
// ─────────────────────────────────────────────────────────────

import { type Request, type Response, type NextFunction } from 'express';

/**
 * Determines the Cache-Control header value based on the request path.
 *
 * Rules:
 *  - Paths starting with `/health` or `/api/v1/health` → `public, max-age=0`
 *  - Paths starting with `/api/v1/` → `no-store`
 *  - All other paths → `no-cache`
 */
function getCacheControlValue(path: string): string {
  // Health endpoints: allow CDN caching but force revalidation
  if (path === '/health' || path.startsWith('/health/') || path === '/api/v1/health' || path.startsWith('/api/v1/health/')) {
    return 'public, max-age=0';
  }

  // API endpoints: never cache (sensitive/authenticated data)
  if (path.startsWith('/api/v1/')) {
    return 'no-store';
  }

  // Conservative default for all other paths
  return 'no-cache';
}

/**
 * Express middleware that sets Cache-Control headers on every response.
 *
 * Must be mounted early in the middleware stack (after security headers,
 * before rate limiting) to ensure all downstream responses carry the
 * appropriate Cache-Control directive.
 *
 * @param req  - Express request object.
 * @param res  - Express response object.
 * @param next - Express next function.
 */
export function cacheControlMiddleware(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  const cacheControl = getCacheControlValue(req.path);
  res.setHeader('Cache-Control', cacheControl);
  next();
}

export default cacheControlMiddleware;
