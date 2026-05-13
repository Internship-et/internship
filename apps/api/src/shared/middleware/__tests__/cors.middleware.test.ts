 // ─────────────────────────────────────────────────────────────
// CORS Middleware — Unit Tests
// Tests verify:
//  - Allowed origins get ACAO + credentials + Vary: Origin
//  - Disallowed origins are logged and blocked by omission of ACAO
//  - Requests without Origin pass through
//  - Wildcard mode sets ACAO: * without credentials
//  - Preflight (OPTIONS) returns 204
// ─────────────────────────────────────────────────────────────

import { describe, it, expect, vi, beforeEach } from 'vitest';
import express from 'express';
import supertest from 'supertest';

// Mock logger
const mockLogger = {
  warn: vi.fn(),
  error: vi.fn(),
  info: vi.fn(),
  debug: vi.fn(),
};

vi.mock('../../lib/logger.js', () => ({
  default: mockLogger,
  createRequestLogger: vi.fn(),
}));

// Mock config module with mutable corsOrigin for per-test configuration
const mockConfig = {
  nodeEnv: 'test',
  port: 0,
  databaseUrl: 'postgresql://test:test@localhost:5432/test',
  redisUrl: 'redis://localhost:6379',
  jwtSecret: 'test-secret-for-testing-32chars-minimum!!',
  jwtAccessExpiresIn: '15m',
  jwtRefreshExpiresIn: '7d',
  logLevel: 'silent',
  corsOrigin: '',
  rateLimitWindowMs: 900000,
  rateLimitMax: 100,
  apiPrefix: '/api/v1',
};

vi.mock('../../../config/index.js', () => ({
  config: mockConfig,
  default: mockConfig,
}));

describe('CorsMiddleware', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset corsOrigin to default before each test
    mockConfig.corsOrigin = '';
  });

  /**
   * Creates a test app with CORS middleware configured to the given origin.
   * The config is updated before each dynamic import so the middleware
   * reads the correct corsOrigin value.
   */
  async function createTestApp(corsOrigin: string): Promise<express.Application> {
    mockConfig.corsOrigin = corsOrigin;

    // Dynamic import so the module reads the updated mocked config
    const { corsMiddleware } = await import('../cors.middleware.js');

    const app = express();
    app.use(corsMiddleware);
    app.get('/test', (_req, res) => {
      res.status(200).json({ success: true });
    });
    return app;
  }

  describe('explicit allowed origin', () => {
    const ALLOWED_ORIGIN = 'http://localhost:3000';
    const DISALLOWED_ORIGIN = 'https://evil.com';

    it('should set ACAO for an allowed origin', async () => {
      const app = await createTestApp(ALLOWED_ORIGIN);
      const request = supertest(app);

      const res = await request
        .get('/test')
        .set('Origin', ALLOWED_ORIGIN);

      expect(res.headers['access-control-allow-origin']).toBe(ALLOWED_ORIGIN);
    });

    it('should set Access-Control-Allow-Credentials for an allowed origin', async () => {
      const app = await createTestApp(ALLOWED_ORIGIN);
      const request = supertest(app);

      const res = await request
        .get('/test')
        .set('Origin', ALLOWED_ORIGIN);

      expect(res.headers['access-control-allow-credentials']).toBe('true');
    });

    it('should set Vary: Origin for an allowed origin', async () => {
      const app = await createTestApp(ALLOWED_ORIGIN);
      const request = supertest(app);

      const res = await request
        .get('/test')
        .set('Origin', ALLOWED_ORIGIN);

      expect(res.headers['vary']).toBe('Origin');
    });

    it('should NOT set ACAO for a disallowed origin', async () => {
      const app = await createTestApp(ALLOWED_ORIGIN);
      const request = supertest(app);

      const res = await request
        .get('/test')
        .set('Origin', DISALLOWED_ORIGIN);

      expect(res.headers['access-control-allow-origin']).toBeUndefined();
    });

    it('should log a warning for a disallowed origin', async () => {
      const app = await createTestApp(ALLOWED_ORIGIN);
      const request = supertest(app);

      await request
        .get('/test')
        .set('Origin', DISALLOWED_ORIGIN);

      expect(mockLogger.warn).toHaveBeenCalledWith(
        { origin: DISALLOWED_ORIGIN },
        'CORS: request from disallowed origin',
      );
    });
  });

  describe('no origin header', () => {
    it('should allow requests without an Origin header', async () => {
      const app = await createTestApp('http://localhost:3000');
      const request = supertest(app);

      const res = await request.get('/test');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('should not set ACAO when no Origin is present (non-wildcard)', async () => {
      const app = await createTestApp('http://localhost:3000');
      const request = supertest(app);

      const res = await request.get('/test');

      expect(res.headers['access-control-allow-origin']).toBeUndefined();
    });
  });

  describe('wildcard origin', () => {
    it('should set ACAO: * when origin is wildcard', async () => {
      const app = await createTestApp('*');
      const request = supertest(app);

      const res = await request.get('/test');

      expect(res.headers['access-control-allow-origin']).toBe('*');
    });

    it('should NOT set credentials when origin is wildcard', async () => {
      const app = await createTestApp('*');
      const request = supertest(app);

      const res = await request
        .get('/test')
        .set('Origin', 'http://example.com');

      expect(res.headers['access-control-allow-credentials']).toBeUndefined();
    });
  });

  describe('preflight requests', () => {
    it('should return 204 for OPTIONS preflight', async () => {
      const app = await createTestApp('http://localhost:3000');
      const request = supertest(app);

      const res = await request
        .options('/test')
        .set('Origin', 'http://localhost:3000')
        .set('Access-Control-Request-Method', 'GET');

      expect(res.status).toBe(204);
    });

    it('should set CORS headers on preflight response', async () => {
      const app = await createTestApp('http://localhost:3000');
      const request = supertest(app);

      const res = await request
        .options('/test')
        .set('Origin', 'http://localhost:3000')
        .set('Access-Control-Request-Method', 'GET');

      expect(res.headers['access-control-allow-methods']).toBeDefined();
      expect(res.headers['access-control-allow-headers']).toBeDefined();
      expect(res.headers['access-control-max-age']).toBeDefined();
    });
  });

  describe('multiple allowed origins', () => {
    it('should allow any origin in the comma-separated list', async () => {
      const app = await createTestApp('http://localhost:3000, https://app.example.com');
      const request = supertest(app);

      const res = await request
        .get('/test')
        .set('Origin', 'https://app.example.com');

      expect(res.headers['access-control-allow-origin']).toBe('https://app.example.com');
    });
  });

  describe('common CORS headers', () => {
    it('should always set Access-Control-Allow-Methods', async () => {
      const app = await createTestApp('http://localhost:3000');
      const request = supertest(app);

      const res = await request.get('/test');

      expect(res.headers['access-control-allow-methods']).toBe('GET, POST, PATCH, DELETE, OPTIONS');
    });

    it('should always set Access-Control-Allow-Headers', async () => {
      const app = await createTestApp('http://localhost:3000');
      const request = supertest(app);

      const res = await request.get('/test');

      expect(res.headers['access-control-allow-headers']).toBe(
        'Content-Type, Authorization, X-Request-ID',
      );
    });

    it('should always set Access-Control-Max-Age', async () => {
      const app = await createTestApp('http://localhost:3000');
      const request = supertest(app);

      const res = await request.get('/test');
      expect(res.headers['access-control-max-age']).toBe('86400');
    });
  });
});
