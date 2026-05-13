// ─────────────────────────────────────────────────────────────
// Error Middleware — Unit Tests
// Tests the notFoundHandler (404) and errorHandler (global error handler).
// ─────────────────────────────────────────────────────────────

import { describe, it, expect, vi, beforeEach } from 'vitest';
import express from 'express';
import supertest from 'supertest';
import {
  NotFoundError,
  ValidationError,
  UnauthorizedError,
  ForbiddenError,
  InternalError,
} from '../../errors/app-error.js';

// Mock logger (use vi.hoisted to avoid hoisting issues)
const mockLogger = vi.hoisted(() => ({
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  debug: vi.fn(),
}));
vi.mock('../../lib/logger.js', () => ({
  default: mockLogger,
  createRequestLogger: vi.fn(),
}));

import { notFoundHandler, errorHandler } from '../error.middleware.js';

describe('ErrorMiddleware', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('notFoundHandler', () => {
    it('passes a NotFoundError to next for unknown routes', async () => {
      const app = express();
      app.get('/test', (_req, res) => res.status(200).json({ ok: true }));
      app.use(notFoundHandler);
      app.use(errorHandler);

      const res = await supertest(app).get('/nonexistent');

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('NOT_FOUND');
      expect(res.body.error.message).toContain('Route not found');
    });

    it('includes the HTTP method and path in the error message', async () => {
      const app = express();
      app.use(notFoundHandler);
      app.use(errorHandler);

      const res = await supertest(app).post('/api/unknown');

      expect(res.status).toBe(404);
      expect(res.body.error.message).toContain('POST');
      expect(res.body.error.message).toContain('/api/unknown');
    });

    it('includes a requestId in the error response', async () => {
      const app = express();
      app.use(notFoundHandler);
      app.use(errorHandler);

      const res = await supertest(app).get('/missing');

      expect(res.status).toBe(404);
      expect(res.body.error.requestId).toBeDefined();
    });
  });

  describe('errorHandler', () => {
    it('returns 400 for ValidationError with details', async () => {
      const app = express();
      app.get('/test', () => {
        throw new ValidationError('Invalid input', [
          { field: 'email', message: 'Invalid email', code: 'invalid_string' },
        ]);
      });
      app.use(errorHandler);

      const res = await supertest(app).get('/test');

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
      expect(res.body.error.details).toBeDefined();
      expect(res.body.error.details).toHaveLength(1);
      expect(res.body.error.details[0].field).toBe('email');
    });

    it('returns 401 for UnauthorizedError', async () => {
      const app = express();
      app.get('/test', () => {
        throw new UnauthorizedError('Authentication required');
      });
      app.use(errorHandler);

      const res = await supertest(app).get('/test');

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('UNAUTHORIZED');
    });

    it('returns 403 for ForbiddenError', async () => {
      const app = express();
      app.get('/test', () => {
        throw new ForbiddenError('Insufficient permissions');
      });
      app.use(errorHandler);

      const res = await supertest(app).get('/test');

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('FORBIDDEN');
    });

    it('returns 404 for NotFoundError', async () => {
      const app = express();
      app.get('/test', () => {
        throw new NotFoundError('User not found');
      });
      app.use(errorHandler);

      const res = await supertest(app).get('/test');

      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe('NOT_FOUND');
    });

    it('returns 500 for unknown Error', async () => {
      const app = express();
      app.get('/test', () => {
        throw new Error('Something unexpected');
      });
      app.use(errorHandler);

      const res = await supertest(app).get('/test');

      expect(res.status).toBe(500);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('INTERNAL_ERROR');
      expect(res.body.error.message).toBe('An unexpected error occurred');
    });

    it('returns 500 for InternalError', async () => {
      const app = express();
      app.get('/test', () => {
        throw new InternalError('Database down');
      });
      app.use(errorHandler);

      const res = await supertest(app).get('/test');

      expect(res.status).toBe(500);
      expect(res.body.error.code).toBe('INTERNAL_ERROR');
      expect(res.body.error.message).toBe('Database down');
    });

    it('includes requestId in all error responses', async () => {
      const app = express();
      app.get('/test', () => {
        throw new NotFoundError('Missing');
      });
      app.use(errorHandler);

      const res = await supertest(app).get('/test');

      expect(res.body.error.requestId).toBeDefined();
      expect(typeof res.body.error.requestId).toBe('string');
    });

    it('logs warnings for 4xx errors', async () => {
      const app = express();
      app.get('/test', () => {
        throw new NotFoundError('Not here');
      });
      app.use(errorHandler);

      await supertest(app).get('/test');

      expect(mockLogger.warn).toHaveBeenCalled();
    });

    it('logs errors for 5xx errors', async () => {
      const app = express();
      app.get('/test', () => {
        throw new Error('Boom');
      });
      app.use(errorHandler);

      await supertest(app).get('/test');

      expect(mockLogger.error).toHaveBeenCalled();
    });

    it('handles consecutive errors', async () => {
      const app = express();
      app.get('/err1', () => { throw new NotFoundError('First'); });
      app.get('/err2', () => { throw new ValidationError('Second'); });
      app.use(errorHandler);

      const res1 = await supertest(app).get('/err1');
      const res2 = await supertest(app).get('/err2');

      expect(res1.status).toBe(404);
      expect(res2.status).toBe(400);
    });
  });

  describe('combined notFoundHandler + errorHandler', () => {
    it('catches all unmatched routes with 404', async () => {
      const app = express();
      app.get('/api/test', (_req, res) => res.json({ ok: true }));
      app.use(notFoundHandler);
      app.use(errorHandler);

      const res = await supertest(app).post('/api/test');

      expect(res.status).toBe(404);
      expect(res.body.error.message).toContain('POST');
      expect(res.body.error.message).toContain('/api/test');
    });
  });
});
