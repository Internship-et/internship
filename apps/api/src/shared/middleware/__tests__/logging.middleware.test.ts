// ─────────────────────────────────────────────────────────────
// Logging Middleware — Unit Tests
// Tests that incoming requests and outgoing responses are logged
// with the correct level based on status code.
// ─────────────────────────────────────────────────────────────

import { describe, it, expect, vi, beforeEach } from 'vitest';
import express, { type Request, type Response, type NextFunction } from 'express';
import supertest from 'supertest';

// Create a mock logger instance (use vi.hoisted to avoid hoisting issues)
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

import { requestLoggerMiddleware } from '../logging.middleware.js';

describe('LoggingMiddleware', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  interface RequestWithId extends Request {
    id: string;
  }

  function createTestApp(statusCode: number = 200) {
    const app = express();
    app.use((req: RequestWithId, _res: Response, next: NextFunction) => {
      req.id = 'test-request-id';
      next();
    });
    app.use(requestLoggerMiddleware);
    app.get('/test', (_req, res) => {
      res.status(statusCode).json({ success: true });
    });
    return app;
  }

  it('should log incoming request on GET', async () => {
    const app = createTestApp(200);
    await supertest(app).get('/test');

    expect(mockLogger.info).toHaveBeenCalledWith(
      expect.objectContaining({
        method: 'GET',
        url: '/test',
        requestId: 'test-request-id',
      }),
      'incoming request',
    );
  });

  it('should log outgoing response on finish', async () => {
    const app = createTestApp(200);
    await supertest(app).get('/test');

    expect(mockLogger.info).toHaveBeenCalledWith(
      expect.objectContaining({
        method: 'GET',
        url: '/test',
        statusCode: 200,
        requestId: 'test-request-id',
      }),
      'outgoing response',
    );
  });

  it('should log 4xx responses as warnings', async () => {
    const app = createTestApp(404);
    await supertest(app).get('/test');

    expect(mockLogger.warn).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: 404,
      }),
      'outgoing response',
    );
  });

  it('should log 5xx responses as errors', async () => {
    const app = createTestApp(500);
    await supertest(app).get('/test');

    expect(mockLogger.error).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: 500,
      }),
      'outgoing response',
    );
  });

  it('should log response time as a number', async () => {
    const app = createTestApp(200);
    await supertest(app).get('/test');

    const callArgs = mockLogger.info.mock.calls.find(
      (args) => args[1] === 'outgoing response',
    );
    expect(callArgs).toBeDefined();
    expect(typeof callArgs![0].responseTime).toBe('number');
    expect(callArgs![0].responseTime).toBeGreaterThanOrEqual(0);
  });
});
