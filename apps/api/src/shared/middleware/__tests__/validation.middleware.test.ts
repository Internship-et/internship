// ─────────────────────────────────────────────────────────────
// Validation Middleware — Unit Tests
// Tests the validate() middleware factory with body, query, and params schemas.
// ─────────────────────────────────────────────────────────────

import { describe, it, expect, vi } from 'vitest';
import express from 'express';
import supertest from 'supertest';
import { z } from 'zod';
import { validate } from '../validation.middleware.js';
import { errorHandler } from '../error.middleware.js';

// Mock logger
vi.mock('../../lib/logger.js', () => ({
  default: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
  createRequestLogger: vi.fn(),
}));

describe('ValidationMiddleware', () => {
  describe('body validation', () => {
    const testSchema = z.object({
      name: z.string().min(1, 'Name is required'),
      age: z.number().int().min(0, 'Age must be positive'),
    });

    it('passes valid body data and replaces req.body with parsed data', async () => {
      const app = express();
      app.use(express.json());
      app.post(
        '/test',
        validate(testSchema),
        (req, res) => {
          res.status(200).json({ data: req.body });
        },
      );
      app.use(errorHandler);

      const res = await supertest(app)
        .post('/test')
        .send({ name: 'Alice', age: 25 });

      expect(res.status).toBe(200);
      expect(res.body.data).toEqual({ name: 'Alice', age: 25 });
    });

    it('returns 400 for invalid body', async () => {
      const app = express();
      app.use(express.json());
      app.post('/test', validate(testSchema), (_req, res) => {
        res.status(200).json({ ok: true });
      });
      app.use(errorHandler);

      const res = await supertest(app)
        .post('/test')
        .send({ name: '', age: -1 });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
      expect(res.body.error.details).toBeDefined();
    });

    it('returns validation details with field, message, and code', async () => {
      const app = express();
      app.use(express.json());
      app.post('/test', validate(testSchema), (_req, res) => {
        res.status(200).json({ ok: true });
      });
      app.use(errorHandler);

      const res = await supertest(app)
        .post('/test')
        .send({ name: '', age: 25 });

      expect(res.status).toBe(400);
      expect(res.body.error.details[0]).toHaveProperty('field');
      expect(res.body.error.details[0]).toHaveProperty('message');
      expect(res.body.error.details[0]).toHaveProperty('code');
      expect(res.body.error.details[0].field).toBe('name');
    });

    it('applies Zod transforms to body data', async () => {
      const transformSchema = z.object({
        email: z.string().email().transform((v) => v.toLowerCase()),
      });
      const app = express();
      app.use(express.json());
      app.post('/test', validate(transformSchema), (req, res) => {
        res.status(200).json({ data: req.body });
      });
      app.use(errorHandler);

      const res = await supertest(app)
        .post('/test')
        .send({ email: 'ALICE@EXAMPLE.COM' });

      expect(res.status).toBe(200);
      expect(res.body.data.email).toBe('alice@example.com');
    });
  });

  describe('query validation', () => {
    const querySchema = z.object({
      page: z.string().optional(),
      limit: z.string().optional(),
    });

    it('passes valid query params', async () => {
      const app = express();
      app.get(
        '/test',
        validate(querySchema, 'query'),
        (req, res) => {
          res.status(200).json({ query: req.query });
        },
      );
      app.use(errorHandler);

      const res = await supertest(app)
        .get('/test')
        .query({ page: '1', limit: '20' });

      expect(res.status).toBe(200);
      expect(res.body.query).toEqual({ page: '1', limit: '20' });
    });

    it('returns 400 for invalid query params', async () => {
      const strictQuerySchema = z.object({
        status: z.enum(['active', 'inactive']),
      });
      const app = express();
      app.get(
        '/test',
        validate(strictQuerySchema, 'query'),
        (_req, res) => res.status(200).json({ ok: true }),
      );
      app.use(errorHandler);

      const res = await supertest(app)
        .get('/test')
        .query({ status: 'bogus' });

      expect(res.status).toBe(400);
    });
  });

  describe('params validation', () => {
    const paramsSchema = z.object({
      id: z.string().uuid('Must be a valid UUID'),
    });

    it('passes valid route params', async () => {
      const app = express();
      app.get(
        '/test/:id',
        validate(paramsSchema, 'params'),
        (req, res) => {
          res.status(200).json({ id: req.params.id });
        },
      );
      app.use(errorHandler);

      const res = await supertest(app).get(
        '/test/a1b2c3d4-e5f6-7890-abcd-ef1234567890',
      );

      expect(res.status).toBe(200);
      expect(res.body.id).toBe('a1b2c3d4-e5f6-7890-abcd-ef1234567890');
    });

    it('returns 400 for invalid UUID param', async () => {
      const app = express();
      app.get(
        '/test/:id',
        validate(paramsSchema, 'params'),
        (_req, res) => res.status(200).json({ ok: true }),
      );
      app.use(errorHandler);

      const res = await supertest(app).get('/test/not-a-uuid');

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });
  });

  describe('edge cases', () => {
    it('handles empty request body', async () => {
      const schema = z.object({
        name: z.string().min(1),
      });
      const app = express();
      app.use(express.json());
      app.post('/test', validate(schema), (_req, res) => {
        res.status(200).json({ ok: true });
      });
      app.use(errorHandler);

      const res = await supertest(app)
        .post('/test')
        .send({});

      expect(res.status).toBe(400);
    });

    it('handles missing required fields as validation error', async () => {
      const schema = z.object({
        name: z.string().min(1),
      });
      const app = express();
      app.use(express.json());
      app.post('/test', validate(schema), (_req, res) => {
        res.status(200).json({ ok: true });
      });
      app.use(errorHandler);

      const res = await supertest(app)
        .post('/test')
        .send({ name: '' });

      expect(res.status).toBe(400);
    });

    it('rejects extra fields not in schema', async () => {
      const schema = z.object({
        name: z.string(),
      });
      // Use .strict() to reject unknown fields
      const strictSchema = schema.strict();
      const app = express();
      app.use(express.json());
      app.post('/test', validate(strictSchema), (_req, res) => {
        res.status(200).json({ ok: true });
      });
      app.use(errorHandler);

      const res = await supertest(app)
        .post('/test')
        .send({ name: 'Alice', extraField: 'should be rejected' });

      expect(res.status).toBe(400);
    });

    it('validates deeply nested objects', async () => {
      const nestedSchema = z.object({
        user: z.object({
          name: z.string().min(1),
          address: z.object({
            city: z.string().min(1),
          }),
        }),
      });
      const app = express();
      app.use(express.json());
      app.post('/test', validate(nestedSchema), (_req, res) => {
        res.status(200).json({ ok: true });
      });
      app.use(errorHandler);

      const validRes = await supertest(app)
        .post('/test')
        .send({ user: { name: 'Alice', address: { city: 'Addis' } } });

      expect(validRes.status).toBe(200);

      const invalidRes = await supertest(app)
        .post('/test')
        .send({ user: { name: '', address: { city: '' } } });

      expect(invalidRes.status).toBe(400);
      expect(invalidRes.body.error.details.length).toBeGreaterThanOrEqual(2);
    });

    it('generates field paths with dot notation for nested errors', async () => {
      const nestedSchema = z.object({
        user: z.object({
          profile: z.object({
            age: z.number().min(18),
          }),
        }),
      });
      const app = express();
      app.use(express.json());
      app.post('/test', validate(nestedSchema), (_req, res) => {
        res.status(200).json({ ok: true });
      });
      app.use(errorHandler);

      const res = await supertest(app)
        .post('/test')
        .send({ user: { profile: { age: 15 } } });

      expect(res.status).toBe(400);
      expect(res.body.error.details[0].field).toBe('user.profile.age');
    });
  });
});
