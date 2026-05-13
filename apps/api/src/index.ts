// ─────────────────────────────────────────────────────────────
// API Application Entry Point
// Exports all shared utilities, errors, config, and the app factory.
// Importing this module starts the server.
// ─────────────────────────────────────────────────────────────

// Start the server (import for side effect)
import './server.js';

export { config } from './config/index.js';

// Error Classes
export {
  AppError,
  ValidationError,
  UnauthorizedError,
  ForbiddenError,
  NotFoundError,
  ConflictError,
  UnprocessableError,
  RateLimitError,
  InternalError,
} from './shared/errors/app-error.js';

// Logger
export { default as logger, createRequestLogger } from './shared/lib/logger.js';

// Redis Client
export { default as redis, disconnectRedis } from './shared/lib/redis.js';

// Prisma Client
export { prisma } from './shared/lib/prisma.js';

// App factory (for testing or programmatic use)
export { createApp } from './app.js';

// Utils
export { asyncHandler } from './shared/utils/async-handler.js';

export {
  parseOffsetPagination,
  getOffsetPaginationInput,
  buildOffsetPaginationMeta,
  parseCursorPagination,
  getCursorPaginationInput,
  buildCursorPaginationMeta,
  buildPaginationMeta,
} from './shared/utils/pagination.js';

// eslint-disable-next-line no-console
console.log('@internship/api — started on port', process.env.PORT || 3000);
