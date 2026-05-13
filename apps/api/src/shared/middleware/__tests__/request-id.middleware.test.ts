// ─────────────────────────────────────────────────────────────
// Request ID Middleware — Unit Tests
// Tests that a UUID v4 is assigned to every request,
// and that a client-provided X-Request-ID is honored.
// ─────────────────────────────────────────────────────────────

import { describe, it, expect } from 'vitest';
import express from 'express';
import supertest from 'supertest';
import { requestIdMiddleware } from '../request-id.middleware.js';

/**
 * Creates a minimal Express app with requestIdMiddleware.
 */
function createTestApp(): express.Application {
  const app = express();
  app.use(requestIdMiddleware);
  app.get('/test', (req, res) => {
    res.status(200).json({ requestId: req.id });
  });
  return app;
}

describe('RequestIdMiddleware', () => {
  const app = createTestApp();
  const request = supertest(app);

  it('should assign a UUID v4 requestId to every request', async () => {
    const res = await request.get('/test');
    expect(res.status).toBe(200);
    expect(res.body.requestId).toBeDefined();
    // UUID v4 format: 8-4-4-4-12 hex digits
    expect(res.body.requestId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    );
  });

  it('should echo X-Request-ID in the response header', async () => {
    const res = await request.get('/test');
    expect(res.headers['x-request-id']).toBeDefined();
    expect(res.headers['x-request-id']).toBe(res.body.requestId);
  });

  it('should honor a client-provided X-Request-ID header', async () => {
    const clientId = 'client-provided-id-12345';
    const res = await request
      .get('/test')
      .set('X-Request-ID', clientId);

    expect(res.body.requestId).toBe(clientId);
    expect(res.headers['x-request-id']).toBe(clientId);
  });

  it('should generate new IDs for consecutive requests', async () => {
    const res1 = await request.get('/test');
    const res2 = await request.get('/test');

    expect(res1.body.requestId).not.toBe(res2.body.requestId);
  });

  it('should generate unique IDs for concurrent requests', async () => {
    const [res1, res2] = await Promise.all([
      request.get('/test'),
      request.get('/test'),
    ]);

    expect(res1.body.requestId).not.toBe(res2.body.requestId);
  });

  it('should handle empty X-Request-ID by generating a new one', async () => {
    const res = await request
      .get('/test')
      .set('X-Request-ID', '');

    expect(res.body.requestId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    );
  });

  it('should set requestId on req.id for downstream middleware', async () => {
    let capturedId: string | undefined;
    const app = express();
    app.use(requestIdMiddleware);
    app.use((req, _res, next) => {
      capturedId = req.id;
      next();
    });
    app.get('/test', (_req, res) => res.status(200).json({ ok: true }));

    await supertest(app).get('/test');
    expect(capturedId).toBeDefined();
    expect(capturedId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    );
  });
});
