// ─────────────────────────────────────────────────────────────
// Cache-Control Middleware — Unit Tests
// Tests verify that Cache-Control headers are set correctly
// based on the request path.
// ─────────────────────────────────────────────────────────────

import { describe, it, expect } from 'vitest';
import express from 'express';
import supertest from 'supertest';
import { cacheControlMiddleware } from '../cache-control.middleware.js';

/**
 * Creates a minimal Express app with only the cache-control
 * middleware and a catch-all route that returns 200.
 * Uses a no-param path for the catch-all to avoid Express 5
 * path-to-regexp issues with bare '*'.
 */
function createTestApp(): express.Application {
  const app = express();
  app.use(cacheControlMiddleware);
  app.use((_req, res) => {
    res.status(200).json({ success: true });
  });
  return app;
}

describe('CacheControlMiddleware', () => {
  const app = createTestApp();
  const request = supertest(app);

  describe('health endpoints', () => {
    it('should set public, max-age=0 on GET /health', async () => {
      const res = await request.get('/health');
      expect(res.headers['cache-control']).toBe('public, max-age=0');
    });

    it('should set public, max-age=0 on GET /health/live', async () => {
      const res = await request.get('/health/live');
      expect(res.headers['cache-control']).toBe('public, max-age=0');
    });

    it('should set public, max-age=0 on GET /health/ready', async () => {
      const res = await request.get('/health/ready');
      expect(res.headers['cache-control']).toBe('public, max-age=0');
    });

    it('should set public, max-age=0 on GET /api/v1/health', async () => {
      const res = await request.get('/api/v1/health');
      expect(res.headers['cache-control']).toBe('public, max-age=0');
    });

    it('should set public, max-age=0 on GET /api/v1/health/live', async () => {
      const res = await request.get('/api/v1/health/live');
      expect(res.headers['cache-control']).toBe('public, max-age=0');
    });

    it('should set public, max-age=0 on GET /api/v1/health/ready', async () => {
      const res = await request.get('/api/v1/health/ready');
      expect(res.headers['cache-control']).toBe('public, max-age=0');
    });

    it('should set public, max-age=0 on nested health paths', async () => {
      const res = await request.get('/api/v1/health/deep/nested');
      expect(res.headers['cache-control']).toBe('public, max-age=0');
    });
  });

  describe('API endpoints', () => {
    it('should set no-store on GET /api/v1/internships', async () => {
      const res = await request.get('/api/v1/internships');
      expect(res.headers['cache-control']).toBe('no-store');
    });

    it('should set no-store on POST /api/v1/auth/login', async () => {
      const res = await request.post('/api/v1/auth/login');
      expect(res.headers['cache-control']).toBe('no-store');
    });

    it('should set no-store on GET /api/v1/students/me', async () => {
      const res = await request.get('/api/v1/students/me');
      expect(res.headers['cache-control']).toBe('no-store');
    });

    it('should set no-store on PATCH /api/v1/internships/some-id', async () => {
      const res = await request.patch('/api/v1/internships/some-id');
      expect(res.headers['cache-control']).toBe('no-store');
    });

    it('should set no-store on nested API paths', async () => {
      const res = await request.get('/api/v1/admin/dashboard/users');
      expect(res.headers['cache-control']).toBe('no-store');
    });
  });

  describe('other paths', () => {
    it('should set no-cache on root path', async () => {
      const res = await request.get('/');
      expect(res.headers['cache-control']).toBe('no-cache');
    });

    it('should set no-cache on unknown paths', async () => {
      const res = await request.get('/robots.txt');
      expect(res.headers['cache-control']).toBe('no-cache');
    });

    it('should set no-cache on non-API non-health paths', async () => {
      const res = await request.get('/favicon.ico');
      expect(res.headers['cache-control']).toBe('no-cache');
    });
  });

  describe('edge cases', () => {
    it('should set different headers for /health vs /api/v1/health', async () => {
      // Both are health endpoints, both should get public, max-age=0
      const healthRes = await request.get('/health');
      const apiHealthRes = await request.get('/api/v1/health');

      expect(healthRes.headers['cache-control']).toBe('public, max-age=0');
      expect(apiHealthRes.headers['cache-control']).toBe('public, max-age=0');
    });

    it('should handle paths that look like health but are not exactly', async () => {
      // /healthcheck should NOT be treated as health endpoint
      const res = await request.get('/healthcheck');
      expect(res.headers['cache-control']).toBe('no-cache');
    });

    it('should handle /api/v1/ paths that start with health', async () => {
      // /api/v1/health is health, but /api/v1/healthcare should not be
      const res = await request.get('/api/v1/healthcare');
      expect(res.headers['cache-control']).toBe('no-store');
    });
  });
});
