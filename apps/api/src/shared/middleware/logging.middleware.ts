// ─────────────────────────────────────────────────────────────
// Request Logging Middleware
// Logs incoming requests and outgoing responses using the structured pino logger.
// ─────────────────────────────────────────────────────────────

import { type Request, type Response, type NextFunction } from 'express';
import logger from '../lib/logger.js';

/**
 * Middleware that logs each incoming request and its corresponding response.
 * Request log: method, url, requestId
 * Response log: status code, response time (ms), requestId
 */
export function requestLoggerMiddleware(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  const start = Date.now();

  logger.info(
    {
      method: req.method,
      url: req.originalUrl || req.url,
      requestId: req.id,
    },
    'incoming request',
  );

  // Log the response once it finishes
  res.on('finish', () => {
    const responseTime = Date.now() - start;

    const logLevel = res.statusCode >= 500 ? 'error'
      : res.statusCode >= 400 ? 'warn'
      : 'info';

    logger[logLevel](
      {
        method: req.method,
        url: req.originalUrl || req.url,
        statusCode: res.statusCode,
        responseTime,
        requestId: req.id,
      },
      'outgoing response',
    );
  });

  next();
}

export default requestLoggerMiddleware;
