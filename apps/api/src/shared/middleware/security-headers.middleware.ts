// ─────────────────────────────────────────────────────────────
// Security Headers Middleware
// Sets HTTP security headers on every response to harden
// the application against common web vulnerabilities.
// This is a native implementation (no helmet dependency).
// ─────────────────────────────────────────────────────────────

import { type Request, type Response, type NextFunction } from 'express';

/**
 * Middleware that sets security-related HTTP headers on every response.
 *
 * Headers set:
 *  - Strict-Transport-Security (HSTS) — enforces HTTPS for 1 year, preload
 *  - X-Content-Type-Options — prevents MIME type sniffing
 *  - X-Frame-Options — prevents clickjacking
 *  - X-XSS-Protection — enables XSS filter in legacy browsers
 *  - Content-Security-Policy — restricts resource sources to 'self'
 *  - Referrer-Policy — controls referrer information on cross-origin requests
 *  - Permissions-Policy — disables camera, microphone, geolocation
 *  - Cross-Origin-Opener-Policy — isolates cross-origin windows
 *
 * NOTE: Cross-Origin-Embedder-Policy (COEP) is intentionally NOT set.
 * Enabling COEP (require-corp) would block all cross-origin resources
 * (CDN fonts, analytics scripts, third-party widgets). Before enabling
 * COEP, a full audit of all external resources loading in the browser
 * must be completed. See docs/security/CACHE_CONTROL_POLICY.md.
 *
 * @param _req - Express request object (unused).
 * @param res  - Express response object.
 * @param next - Express next function.
 */
export function securityHeadersMiddleware(
  _req: Request,
  res: Response,
  next: NextFunction,
): void {
  // HTTP Strict Transport Security — enforce HTTPS for 1 year,
  // include subdomains, and submit to browser preload lists
  res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');

  // X-Content-Type-Options — prevent MIME type sniffing
  res.setHeader('X-Content-Type-Options', 'nosniff');

  // X-Frame-Options — prevent clickjacking (DENY = no framing at all)
  res.setHeader('X-Frame-Options', 'DENY');

  // X-XSS-Protection — enable XSS filter in legacy browsers (deprecated but still set)
  res.setHeader('X-XSS-Protection', '1; mode=block');

  // Content-Security-Policy — restrict resources to same origin only
  res.setHeader('Content-Security-Policy', "default-src 'self'");

  // Referrer-Policy — only send origin, path, and querystring for same-origin requests;
  // for cross-origin, only send origin
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');

  // Permissions-Policy — disable sensitive browser features by default
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');

  // Cross-Origin-Opener-Policy — allow popups to preserve window references
  // (same-origin-allow-popups is more conservative than restrict-props)
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin-allow-popups');

  next();
}

export default securityHeadersMiddleware;
