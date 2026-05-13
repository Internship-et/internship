// ─────────────────────────────────────────────────────────────
// CORS Middleware
// Local implementation (no cors npm package dependency).
// Configures allowed origins, methods, headers, and credentials
// using settings from the application config.
// ─────────────────────────────────────────────────────────────

import { type Request, type Response, type NextFunction } from 'express';
import { config } from '../../config/index.js';
import logger from '../lib/logger.js';

const ALLOWED_METHODS = 'GET, POST, PATCH, DELETE, OPTIONS';
const ALLOWED_HEADERS = 'Content-Type, Authorization, X-Request-ID';
const MAX_AGE = '86400'; // 24 hours

const WILDCARD = '*';

/**
 * Checks whether the given origin is in the allowed list.
 * If corsOrigin is '*', all origins are allowed.
 * Otherwise, corsOrigin is a comma-separated list of explicit origins.
 */
function isOriginAllowed(origin: string): boolean {
  if (config.corsOrigin === WILDCARD) {
    return true;
  }

  const allowedOrigins = config.corsOrigin.split(',').map((o) => o.trim());
  return allowedOrigins.includes(origin);
}

/**
 * CORS middleware that configures cross-origin resource sharing.
 *
 * Rules:
 *  - If the request includes an Origin header AND the origin is allowed,
 *    set Access-Control-Allow-Origin to that origin + Vary: Origin.
 *  - If corsOrigin is wildcard ('*'), set ACAO to '*'. Do NOT set
 *    credentials with wildcard (browsers reject ACAO:* + credentials).
 *  - If the request includes an Origin that is NOT allowed, log a warning
 *    and omit ACAO (browser will block the response).
 *  - If the request has NO Origin header (curl, server-to-server), pass
 *    through without CORS restrictions.
 *  - Preflight (OPTIONS) requests are terminated with 204.
 */
export function corsMiddleware(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  const origin = req.headers.origin;

  if (origin) {
    if (isOriginAllowed(origin)) {
      // Explicitly allowed origin — echo it back
      res.setHeader('Access-Control-Allow-Origin', origin);
      res.setHeader('Vary', 'Origin');

      // Only set credentials for explicit origins, never with wildcard
      if (config.corsOrigin !== WILDCARD) {
        res.setHeader('Access-Control-Allow-Credentials', 'true');
      }
    } else {
      // Disallowed origin — log warning, do NOT set ACAO (browser enforces the block)
      logger.warn({ origin }, 'CORS: request from disallowed origin');
    }
  } else if (config.corsOrigin === WILDCARD) {
    // No origin header and wildcard mode — allow all
    res.setHeader('Access-Control-Allow-Origin', WILDCARD);
  }
  // If no origin and not wildcard: pass through without ACAO (non-browser client, fine)

  res.setHeader('Access-Control-Allow-Methods', ALLOWED_METHODS);
  res.setHeader('Access-Control-Allow-Headers', ALLOWED_HEADERS);
  res.setHeader('Access-Control-Max-Age', MAX_AGE);

  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }

  next();
}

export default corsMiddleware;
