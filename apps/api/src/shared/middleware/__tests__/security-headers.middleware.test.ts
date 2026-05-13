// ─────────────────────────────────────────────────────────────
// Security Headers Middleware — Unit Tests
// Tests verify that all 6 security headers are present
// on every response from a minimal Express app.
// ─────────────────────────────────────────────────────────────

import { describe, it, expect } from 'vitest';
import express from 'express';
import supertest from 'supertest';
import { securityHeadersMiddleware } from '../security-headers.middleware.js';

/**
 * Creates a minimal Express app with only the security headers
 * middleware and a simple health-like route.
 */
function createTestApp(): express.Application {
  const app = express();
  app.use(securityHeadersMiddleware);
  app.get('/test', (_req, res) => {
    res.status(200).json({ success: true });
  });
  return app;
}

describe('SecurityHeadersMiddleware', () => {
  const app = createTestApp();
  const request = supertest(app);

  it('should set Strict-Transport-Security header with preload', async () => {
    const res = await request.get('/test');
    expect(res.headers['strict-transport-security']).toBe(
      'max-age=31536000; includeSubDomains; preload',
    );
  });

  it('should set X-Content-Type-Options header', async () => {
    const res = await request.get('/test');
    expect(res.headers['x-content-type-options']).toBe('nosniff');
  });

  it('should set X-Frame-Options header', async () => {
    const res = await request.get('/test');
    expect(res.headers['x-frame-options']).toBe('DENY');
  });

  it('should set X-XSS-Protection header', async () => {
    const res = await request.get('/test');
    expect(res.headers['x-xss-protection']).toBe('1; mode=block');
  });

  it('should set Content-Security-Policy header', async () => {
    const res = await request.get('/test');
    expect(res.headers['content-security-policy']).toBe("default-src 'self'");
  });

  it('should set Referrer-Policy header', async () => {
    const res = await request.get('/test');
    expect(res.headers['referrer-policy']).toBe('strict-origin-when-cross-origin');
  });

  it('should set Permissions-Policy header', async () => {
    const res = await request.get('/test');
    expect(res.headers['permissions-policy']).toBe(
      'camera=(), microphone=(), geolocation=()',
    );
  });

  it('should set Cross-Origin-Opener-Policy header', async () => {
    const res = await request.get('/test');
    expect(res.headers['cross-origin-opener-policy']).toBe(
      'same-origin-allow-popups',
    );
  });

  it('should NOT set Cross-Origin-Embedder-Policy header (intentionally skipped)', async () => {
    const res = await request.get('/test');
    expect(res.headers['cross-origin-embedder-policy']).toBeUndefined();
  });

  it('should set all 8 security-related headers on a single response', async () => {
    const res = await request.get('/test');

    const expectedHeaders = [
      'strict-transport-security',
      'x-content-type-options',
      'x-frame-options',
      'x-xss-protection',
      'content-security-policy',
      'referrer-policy',
      'permissions-policy',
      'cross-origin-opener-policy',
    ];

    for (const header of expectedHeaders) {
      expect(res.headers[header]).toBeDefined();
    }
  });
});
