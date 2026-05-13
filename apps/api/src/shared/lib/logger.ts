// ─────────────────────────────────────────────────────────────
// Logger
// Structured JSON logging with pino.
// Supports log levels, request ID context, and pino-pretty in development.
// ─────────────────────────────────────────────────────────────

import pino from 'pino';
import { config } from '../../config/index.js';

const isDev = config.nodeEnv === 'development';

const transport = isDev
  ? pino.transport({
      target: 'pino-pretty',
      options: {
        colorize: true,
        translateTime: 'SYS:standard',
        ignore: 'pid,hostname',
      },
    })
  : undefined;

const logger = pino(
  {
    level: config.logLevel || 'info',
    serializers: {
      req: (req) => ({
        method: req.method,
        url: req.url,
        requestId: req.id,
        userAgent: req.headers?.['user-agent'],
        ip: req.ip,
      }),
      res: (res) => ({
        statusCode: res.statusCode,
        responseTime: res.responseTime,
      }),
      err: pino.stdSerializers.err,
    },
    redact: {
      paths: ['req.headers.authorization', 'req.headers.cookie', 'body.password', 'body.token'],
      censor: '[REDACTED]',
    },
  },
  transport,
);

/**
 * Creates a child logger bound to a specific request ID for correlation.
 */
export function createRequestLogger(requestId: string): pino.Logger {
  return logger.child({ requestId });
}

export default logger;
