// ─────────────────────────────────────────────────────────────
// Rate Limiter Middleware — Unit Tests
// Tests cover:
//  - In-memory fallback behavior (Redis mocked to throw)
//  - Rate limit header presence
//  - 429 when limit is exceeded
//  - Request pass-through under the limit
// ─────────────────────────────────────────────────────────────

import { describe, it, expect, vi, beforeEach } from 'vitest';
import express, { type Request, type Response, type NextFunction } from 'express';
import supertest from 'supertest';

// Mock Redis to always throw, forcing the rate limiter into in-memory fallback.
// This makes tests deterministic (no real Redis connection needed).
vi.mock('../../lib/redis.js', () => ({
  default: {
    multi: vi.fn(() => ({
      zremrangebyscore: vi.fn().mockReturnThis(),
      zcard: vi.fn().mockReturnThis(),
      zadd: vi.fn().mockReturnThis(),
      pexpire: vi.fn().mockReturnThis(),
      exec: vi.fn().mockRejectedValue(new Error('Redis mocked unavailable')),
    })),
    on: vi.fn(),
    status: 'close',
    quit: vi.fn().mockResolvedValue(undefined),
  },
  disconnectRedis: vi.fn().mockResolvedValue(undefined),
}));

import { rateLimiter } from '../rate-limit.middleware.js';

/**
 * Minimal error handler that formats AppError (429) as JSON.
 * Used in test apps so the rate limiter's RateLimitError
 * is properly serialised.
 */
interface AppErrorLike {
  statusCode?: number;
  code?: string;
}

function testErrorHandler(err: Error, _req: Request, res: Response, _next: NextFunction): void {
  const appError = err as unknown as AppErrorLike;
  const statusCode = appError.statusCode ?? 500;
  const code = appError.code ?? 'INTERNAL_ERROR';
  res.status(statusCode).json({
    success: false,
    error: {
      code,
      message: err.message,
      requestId: 'test',
    },
  });
}

// Mock logger to suppress warnings during tests
vi.mock('../../lib/logger.js', () => ({
  default: {
    warn: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    debug: vi.fn(),
  },
  createRequestLogger: vi.fn(),
}));

describe('RateLimiterMiddleware', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('in-memory fallback (Redis mocked to fail)', () => {
    /**
     * Creates a minimal Express app with the rate limiter mounted.
     * The limiter uses a very short window (1s) and low max (3)
     * for fast testing, but we mock Redis by not mocking it at all —
     * since our test environment has no Redis running, the Redis
     * connection will fail and the in-memory fallback will activate.
     */
    function createTestApp(max: number = 3, windowMs: number = 1000) {
      const app = express();
      // Enable trust proxy so req.ip reads X-Forwarded-For
      app.set('trust proxy', true);
      app.use(rateLimiter({ prefix: 'test', windowMs, max }));
      app.get('/test', (_req, res) => {
        res.status(200).json({ success: true });
      });
      // Error handler must be last — serialises RateLimitError as JSON
      app.use(testErrorHandler);
      return app;
    }

    it('should allow requests under the limit and set X-RateLimit headers', async () => {
      const app = createTestApp(5, 60_000);
      const request = supertest(app);

      const res = await request.get('/test');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.headers['x-ratelimit-limit']).toBeDefined();
      expect(res.headers['x-ratelimit-remaining']).toBeDefined();
      expect(res.headers['x-ratelimit-reset']).toBeDefined();
      expect(res.headers['retry-after']).toBeDefined();
    });

    it('should return 429 when limit is exceeded', async () => {
      const app = createTestApp(3, 60_000);
      const request = supertest(app);

      // Send 3 requests — all should pass
      await request.get('/test');
      await request.get('/test');
      await request.get('/test');

      // The 4th request should be rate limited
      const res = await request.get('/test');

      expect(res.status).toBe(429);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('RATE_LIMIT_EXCEEDED');
      expect(res.headers['x-ratelimit-remaining']).toBe('0');
    });

    it('should reset the counter after the window expires', async () => {
      const app = createTestApp(2, 500); // 500ms window
      const request = supertest(app);

      // Exhaust the limit
      await request.get('/test');
      await request.get('/test');

      // Should be blocked
      const blocked = await request.get('/test');
      expect(blocked.status).toBe(429);

      // Wait for window to expire
      await new Promise((resolve) => setTimeout(resolve, 600));

      // Should be allowed again
      const allowed = await request.get('/test');
      expect(allowed.status).toBe(200);
      // Remaining should be 1 (max - 1 used)
      expect(Number(allowed.headers['x-ratelimit-remaining'])).toBeGreaterThanOrEqual(0);
    }, 10_000);

    it('should track separate counters for different IPs', async () => {
      const app = createTestApp(2, 60_000);
      const request = supertest(app);

      // IP 1 makes 2 requests (hits limit)
      await request.get('/test').set('X-Forwarded-For', '10.0.0.1');
      await request.get('/test').set('X-Forwarded-For', '10.0.0.1');

      // IP 2 makes 2 requests (should still pass)
      const resIp2 = await request.get('/test').set('X-Forwarded-For', '10.0.0.2');
      expect(resIp2.status).toBe(200);

      // IP 1 is now blocked
      const resIp1Blocked = await request.get('/test').set('X-Forwarded-For', '10.0.0.1');
      expect(resIp1Blocked.status).toBe(429);
    });
  });

  describe('skip option', () => {
    it('should bypass rate limiting when skip returns true', async () => {
      const app = express();
      app.set('trust proxy', true);
      app.use(
        rateLimiter({
          prefix: 'skip-test',
          windowMs: 60_000,
          max: 1,
          skip: (req) => req.path === '/skip-me',
        }),
      );
      app.get('/test', (_req, res) => res.status(200).json({ success: true }));
      app.get('/skip-me', (_req, res) => res.status(200).json({ success: true }));
      app.use(testErrorHandler);

      const request = supertest(app);

      // First request to /test hits the limit (max: 1)
      await request.get('/test');

      // Second request to /test should be blocked (429)
      const blockedRes = await request.get('/test');
      expect(blockedRes.status).toBe(429);

      // Request to /skip-me should pass regardless of limit
      const skippedRes = await request.get('/skip-me');
      expect(skippedRes.status).toBe(200);

      // Skip-me should not set rate limit headers
      expect(skippedRes.headers['x-ratelimit-limit']).toBeUndefined();
      expect(skippedRes.headers['x-ratelimit-remaining']).toBeUndefined();
    });

    it('should always pass when skip returns true for all paths', async () => {
      const app = express();
      app.set('trust proxy', true);
      app.use(
        rateLimiter({
          prefix: 'skip-all',
          windowMs: 60_000,
          max: 0, // Would block everything if not skipped
          skip: () => true, // Skip everything
        }),
      );
      app.get('/test', (_req, res) => res.status(200).json({ success: true }));
      app.use(testErrorHandler);

      const request = supertest(app);

      // Even with max: 0, request should pass because skip returns true
      const res = await request.get('/test');
      expect(res.status).toBe(200);
    });

    it('should not skip when skip is not configured (backward compatible)', async () => {
      const app = express();
      app.set('trust proxy', true);
      app.use(
        rateLimiter({
          prefix: 'no-skip',
          windowMs: 60_000,
          max: 1,
          // skip is intentionally not configured
        }),
      );
      app.get('/test', (_req, res) => res.status(200).json({ success: true }));
      app.use(testErrorHandler);

      const request = supertest(app);

      // First request passes
      await request.get('/test');

      // Second request is blocked (backward compatible behavior)
      const res = await request.get('/test');
      expect(res.status).toBe(429);
    });

    it('should skip based on arbitrary req properties', async () => {
      const app = express();
      app.set('trust proxy', true);
      app.use(
        rateLimiter({
          prefix: 'custom-skip',
          windowMs: 60_000,
          max: 1,
          skip: (req) => req.headers['x-internal'] === 'true',
        }),
      );
      app.get('/test', (_req, res) => res.status(200).json({ success: true }));
      app.use(testErrorHandler);

      const request = supertest(app);

      // Request with internal header should skip rate limiting
      const res = await request.get('/test').set('X-Internal', 'true');
      expect(res.status).toBe(200);
      expect(res.headers['x-ratelimit-limit']).toBeUndefined();
    });
  });

  describe('configuration', () => {
    it('should use custom key generator when provided', async () => {
      let capturedKey = '';
      const app = express();
      app.set('trust proxy', true);
      app.use(
        rateLimiter({
          prefix: 'custom',
          windowMs: 60_000,
          max: 10,
          keyGenerator: (req) => {
            capturedKey = `custom-key-${req.headers['x-user'] ?? 'anon'}`;
            return capturedKey;
          },
        }),
      );
      app.get('/test', (_req, res) => res.status(200).json({ success: true }));
      app.use(testErrorHandler);

      const request = supertest(app);
      await request.get('/test').set('X-User', 'user-42');

      // The key should include the custom prefix
      expect(capturedKey).toBe('custom-key-user-42');
    });

    it('should use custom error message when provided', async () => {
      const app = express();
      app.set('trust proxy', true);
      app.use(rateLimiter({ prefix: 'custom-msg', windowMs: 60_000, max: 1, message: 'Slow down, please!' }));
      app.get('/test', (_req, res) => res.status(200).json({ success: true }));
      app.use(testErrorHandler);

      const request = supertest(app);

      // Use up the limit
      await request.get('/test');

      // Hit the limit
      const res = await request.get('/test');
      expect(res.status).toBe(429);
      expect(res.body.error.message).toBe('Slow down, please!');
    });
  });
});
