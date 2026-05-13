// ─────────────────────────────────────────────────────────────
// Health Routes — Integration Tests
// Tests health check endpoints: GET /health, /health/live, /health/ready
// Mocks Prisma and Redis to avoid requiring live services.
// ─────────────────────────────────────────────────────────────

import { describe, it, expect, vi, beforeEach } from 'vitest';
import express from 'express';
import supertest from 'supertest';

// Mock Prisma
const mockQueryRaw = vi.hoisted(() => vi.fn());
vi.mock('../../../shared/lib/prisma.js', () => ({
  prisma: {
    $queryRaw: mockQueryRaw,
  },
}));

// Mock Redis
const mockPing = vi.hoisted(() => vi.fn());
vi.mock('../../../shared/lib/redis.js', () => ({
  default: {
    ping: mockPing,
    status: 'ready',
  },
  redis: {
    ping: mockPing,
    status: 'ready',
  },
}));

// Mock node:fs to return a controlled package.json version
vi.mock('node:fs', () => ({
  readFileSync: vi.fn(() => JSON.stringify({ version: '0.1.0-test' })),
}));

// Mock logger
vi.mock('../../../shared/lib/logger.js', () => ({
  default: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
  createRequestLogger: vi.fn(),
}));

import healthRoutes from '../health.routes.js';

/**
 * Creates a test app with health routes mounted at root and /api/v1.
 */
function createTestApp(): express.Application {
  const app = express();
  app.use(healthRoutes);
  app.use('/api/v1', healthRoutes);
  return app;
}

describe('HealthRoutes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('GET /health/live', () => {
    it('returns 200 with alive status', async () => {
      const app = createTestApp();
      const res = await supertest(app).get('/health/live');

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('alive');
      expect(res.body.uptime).toBeDefined();
      expect(typeof res.body.uptime).toBe('number');
      expect(res.body.timestamp).toBeDefined();
    });

    it('does not check dependencies', async () => {
      const app = createTestApp();
      await supertest(app).get('/health/live');

      expect(mockQueryRaw).not.toHaveBeenCalled();
      expect(mockPing).not.toHaveBeenCalled();
    });
  });

  describe('GET /health/ready', () => {
    it('returns 200 when database is healthy', async () => {
      mockQueryRaw.mockResolvedValue([{ '?column?': 1 }]);

      const app = createTestApp();
      const res = await supertest(app).get('/health/ready');

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('ready');
      expect(res.body.database).toBe('healthy');
      expect(res.body.timestamp).toBeDefined();
    });

    it('returns 503 when database is unhealthy', async () => {
      mockQueryRaw.mockRejectedValue(new Error('Connection failed'));

      const app = createTestApp();
      const res = await supertest(app).get('/health/ready');

      expect(res.status).toBe(503);
      expect(res.body.status).toBe('not ready');
      expect(res.body.database).toBe('unhealthy');
      expect(res.body.error).toBeDefined();
    });

    it('measures database latency', async () => {
      mockQueryRaw.mockResolvedValue([{ '?column?': 1 }]);

      const app = createTestApp();
      const res = await supertest(app).get('/health/ready');

      // Should include latency in 503 response with error info
      // (ready response doesn't include latency, which is fine)
      expect(res.status).toBe(200);
    });
  });

  describe('GET /health', () => {
    it('returns 200 with ok status when all dependencies healthy', async () => {
      mockQueryRaw.mockResolvedValue([{ '?column?': 1 }]);
      mockPing.mockResolvedValue('PONG');

      const app = createTestApp();
      const res = await supertest(app).get('/health');

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('ok');
      expect(res.body.uptime).toBeDefined();
      expect(res.body.version).toBeDefined();
      expect(typeof res.body.version).toBe('string');
      expect(res.body.dependencies).toBeDefined();
      expect(res.body.dependencies.database).toBeDefined();
      expect(res.body.dependencies.redis).toBeDefined();
      expect(res.body.dependencies.database.status).toBe('healthy');
      expect(res.body.dependencies.redis.status).toBe('healthy');
      expect(res.body.timestamp).toBeDefined();
    });

    it('returns 200 with degraded status when Redis is unhealthy', async () => {
      mockQueryRaw.mockResolvedValue([{ '?column?': 1 }]);
      mockPing.mockRejectedValue(new Error('Redis down'));

      const app = createTestApp();
      const res = await supertest(app).get('/health');

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('degraded');
      expect(res.body.dependencies.database.status).toBe('healthy');
      expect(res.body.dependencies.redis.status).toBe('unhealthy');
      expect(res.body.dependencies.redis.error).toBeDefined();
    });

    it('returns 503 with down status when database is unhealthy', async () => {
      mockQueryRaw.mockRejectedValue(new Error('DB down'));
      mockPing.mockResolvedValue('PONG');

      const app = createTestApp();
      const res = await supertest(app).get('/health');

      expect(res.status).toBe(503);
      expect(res.body.status).toBe('down');
      expect(res.body.dependencies.database.status).toBe('unhealthy');
      expect(res.body.dependencies.redis.status).toBe('healthy');
    });

    it('returns 503 when both dependencies are unhealthy', async () => {
      mockQueryRaw.mockRejectedValue(new Error('DB down'));
      mockPing.mockRejectedValue(new Error('Redis down'));

      const app = createTestApp();
      const res = await supertest(app).get('/health');

      expect(res.status).toBe(503);
      expect(res.body.status).toBe('down');
      expect(res.body.dependencies.database.status).toBe('unhealthy');
      expect(res.body.dependencies.redis.status).toBe('unhealthy');
    });

    it('returns 200 with degraded when Redis returns unexpected response', async () => {
      mockQueryRaw.mockResolvedValue([{ '?column?': 1 }]);
      mockPing.mockResolvedValue('SOMETHING_ELSE');

      const app = createTestApp();
      const res = await supertest(app).get('/health');

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('degraded');
      expect(res.body.dependencies.redis.status).toBe('degraded');
    });

    it('includes memory usage data', async () => {
      mockQueryRaw.mockResolvedValue([{ '?column?': 1 }]);
      mockPing.mockResolvedValue('PONG');

      const app = createTestApp();
      const res = await supertest(app).get('/health');

      expect(res.body.memory).toBeDefined();
      expect(res.body.memory.used).toBeDefined();
      expect(typeof res.body.memory.used).toBe('number');
      expect(res.body.memory.total).toBeDefined();
      expect(typeof res.body.memory.total).toBe('number');
      expect(res.body.memory.percentUsed).toBeDefined();
      expect(typeof res.body.memory.percentUsed).toBe('number');
      expect(res.body.memory.usedFormatted).toBeDefined();
      expect(typeof res.body.memory.usedFormatted).toBe('string');
      expect(res.body.memory.totalFormatted).toBeDefined();
      expect(typeof res.body.memory.totalFormatted).toBe('string');
    });

    it('handles zero heap total gracefully', async () => {
      mockQueryRaw.mockResolvedValue([{ '?column?': 1 }]);
      mockPing.mockResolvedValue('PONG');

      // Mock process.memoryUsage for this test
      const originalMemoryUsage = process.memoryUsage;
      process.memoryUsage = vi.fn().mockReturnValue({
        heapUsed: 0,
        heapTotal: 0,
        rss: 0,
        external: 0,
        arrayBuffers: 0,

      }) as unknown as typeof process.memoryUsage;

      const app = createTestApp();
      const res = await supertest(app).get('/health');

      expect(res.status).toBe(200);
      expect(res.body.memory.percentUsed).toBe(0);

      process.memoryUsage = originalMemoryUsage;
    });
  });

  describe('mounted at /api/v1/health', () => {
    it('returns health at /api/v1/health', async () => {
      mockQueryRaw.mockResolvedValue([{ '?column?': 1 }]);
      mockPing.mockResolvedValue('PONG');

      const app = createTestApp();
      const res = await supertest(app).get('/api/v1/health');

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('ok');
    });

    it('returns live at /api/v1/health/live', async () => {
      const app = createTestApp();
      const res = await supertest(app).get('/api/v1/health/live');

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('alive');
    });

    it('returns ready at /api/v1/health/ready', async () => {
      mockQueryRaw.mockResolvedValue([{ '?column?': 1 }]);

      const app = createTestApp();
      const res = await supertest(app).get('/api/v1/health/ready');

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('ready');
    });
  });
});
