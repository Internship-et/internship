// ─────────────────────────────────────────────────────────────
// Request ID Middleware
// Assigns a unique UUID v4 to every request for correlation tracing.
// Honors an X-Request-ID header sent by the client.
// ─────────────────────────────────────────────────────────────

import { type Request, type Response, type NextFunction } from 'express';
import crypto from 'node:crypto';

/**
 * Middleware that assigns a unique request ID to every request.
 * If the client sends an X-Request-ID header, it is used as-is.
 * Otherwise, a new UUID v4 is generated via crypto.randomUUID().
 * The ID is set on req.id and echoed back in the X-Request-ID response header.
 */
export function requestIdMiddleware(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  const clientId = req.headers['x-request-id'];
  const id = typeof clientId === 'string' && clientId.length > 0
    ? clientId
    : crypto.randomUUID();

  req.id = id;
  res.setHeader('X-Request-ID', id);
  next();
}

export default requestIdMiddleware;
