// ─────────────────────────────────────────────────────────────
// AppError — Unit Tests
// Tests all error subclasses for correct status codes,
// default codes, custom codes, details, and JSON serialization.
// ─────────────────────────────────────────────────────────────

import { describe, it, expect } from 'vitest';
import {
  AppError,
  ValidationError,
  UnauthorizedError,
  ForbiddenError,
  NotFoundError,
  ConflictError,
  UnprocessableError,
  RateLimitError,
  InternalError,
} from '../app-error.js';

describe('AppError', () => {
  describe('base class', () => {
    it('creates error with message and statusCode', () => {
      const error = new AppError('Custom error', 400, 'CUSTOM_CODE');
      expect(error.message).toBe('Custom error');
      expect(error.statusCode).toBe(400);
      expect(error.code).toBe('CUSTOM_CODE');
      expect(error.name).toBe('AppError');
    });

    it('uses default code for known status codes', () => {
      const error = new AppError('Not found', 404);
      expect(error.code).toBe('NOT_FOUND');
    });

    it('uses UNKNOWN_ERROR for unrecognized status codes', () => {
      const error = new AppError('Weird', 999);
      expect(error.code).toBe('UNKNOWN_ERROR');
    });

    it('stores optional details', () => {
      const details = [{ field: 'email', message: 'Invalid' }];
      const error = new AppError('Bad input', 400, 'VALIDATION_ERROR', details);
      expect(error.details).toEqual(details);
    });

    it('serializes to JSON correctly without details', () => {
      const error = new AppError('Not found', 404);
      const json = error.toJSON();
      expect(json).toEqual({
        code: 'NOT_FOUND',
        message: 'Not found',
      });
    });

    it('serializes to JSON correctly with details', () => {
      const details = { reason: 'missing' };
      const error = new AppError('Not found', 404, 'NOT_FOUND', details);
      const json = error.toJSON();
      expect(json).toEqual({
        code: 'NOT_FOUND',
        message: 'Not found',
        details: { reason: 'missing' },
      });
    });

    it('maintains proper prototype chain', () => {
      const error = new AppError('Test', 400, 'TEST');
      expect(error).toBeInstanceOf(Error);
      expect(error).toBeInstanceOf(AppError);
    });

    it('captures stack trace', () => {
      const error = new AppError('Test', 400, 'TEST');
      expect(error.stack).toBeDefined();
    });

    it('has all default code mappings', () => {
      const expectations = [
        { status: 400, code: 'VALIDATION_ERROR' },
        { status: 401, code: 'UNAUTHORIZED' },
        { status: 403, code: 'FORBIDDEN' },
        { status: 404, code: 'NOT_FOUND' },
        { status: 409, code: 'CONFLICT' },
        { status: 422, code: 'UNPROCESSABLE_ENTITY' },
        { status: 429, code: 'RATE_LIMIT_EXCEEDED' },
        { status: 500, code: 'INTERNAL_ERROR' },
      ];

      for (const { status, code } of expectations) {
        const error = new AppError('Test', status);
        expect(error.code).toBe(code);
      }
    });
  });

  describe('ValidationError', () => {
    it('has status 400 and code VALIDATION_ERROR', () => {
      const error = new ValidationError();
      expect(error.statusCode).toBe(400);
      expect(error.code).toBe('VALIDATION_ERROR');
      expect(error.message).toBe('Validation failed');
    });

    it('accepts custom message and details', () => {
      const details = [{ field: 'email', message: 'Invalid', code: 'invalid_string' }];
      const error = new ValidationError('Invalid input data', details);
      expect(error.message).toBe('Invalid input data');
      expect(error.details).toEqual(details);
    });

    it('is instance of AppError', () => {
      expect(new ValidationError()).toBeInstanceOf(AppError);
    });
  });

  describe('UnauthorizedError', () => {
    it('has status 401 and code UNAUTHORIZED', () => {
      const error = new UnauthorizedError();
      expect(error.statusCode).toBe(401);
      expect(error.code).toBe('UNAUTHORIZED');
      expect(error.message).toBe('Authentication required');
    });

    it('accepts custom message', () => {
      const error = new UnauthorizedError('Token expired');
      expect(error.message).toBe('Token expired');
    });

    it('is instance of AppError', () => {
      expect(new UnauthorizedError()).toBeInstanceOf(AppError);
    });
  });

  describe('ForbiddenError', () => {
    it('has status 403 and code FORBIDDEN', () => {
      const error = new ForbiddenError();
      expect(error.statusCode).toBe(403);
      expect(error.code).toBe('FORBIDDEN');
      expect(error.message).toBe('Access denied');
    });

    it('accepts custom message', () => {
      const error = new ForbiddenError('Insufficient permissions');
      expect(error.message).toBe('Insufficient permissions');
    });

    it('is instance of AppError', () => {
      expect(new ForbiddenError()).toBeInstanceOf(AppError);
    });
  });

  describe('NotFoundError', () => {
    it('has status 404 and code NOT_FOUND', () => {
      const error = new NotFoundError();
      expect(error.statusCode).toBe(404);
      expect(error.code).toBe('NOT_FOUND');
      expect(error.message).toBe('Resource not found');
    });

    it('accepts custom message', () => {
      const error = new NotFoundError('User not found');
      expect(error.message).toBe('User not found');
    });

    it('is instance of AppError', () => {
      expect(new NotFoundError()).toBeInstanceOf(AppError);
    });
  });

  describe('ConflictError', () => {
    it('has status 409 and code CONFLICT', () => {
      const error = new ConflictError();
      expect(error.statusCode).toBe(409);
      expect(error.code).toBe('CONFLICT');
      expect(error.message).toBe('Resource already exists');
    });

    it('accepts custom message', () => {
      const error = new ConflictError('Email already registered');
      expect(error.message).toBe('Email already registered');
    });

    it('is instance of AppError', () => {
      expect(new ConflictError()).toBeInstanceOf(AppError);
    });
  });

  describe('UnprocessableError', () => {
    it('has status 422 and code UNPROCESSABLE_ENTITY', () => {
      const error = new UnprocessableError();
      expect(error.statusCode).toBe(422);
      expect(error.code).toBe('UNPROCESSABLE_ENTITY');
      expect(error.message).toBe('Unprocessable entity');
    });

    it('accepts custom message and details', () => {
      const error = new UnprocessableError('Resume required', { missingField: 'resumeUrl' });
      expect(error.message).toBe('Resume required');
      expect(error.details).toEqual({ missingField: 'resumeUrl' });
    });

    it('is instance of AppError', () => {
      expect(new UnprocessableError()).toBeInstanceOf(AppError);
    });
  });

  describe('RateLimitError', () => {
    it('has status 429 and code RATE_LIMIT_EXCEEDED', () => {
      const error = new RateLimitError();
      expect(error.statusCode).toBe(429);
      expect(error.code).toBe('RATE_LIMIT_EXCEEDED');
      expect(error.message).toBe('Too many requests, please try again later');
    });

    it('accepts custom message', () => {
      const error = new RateLimitError('Slow down!');
      expect(error.message).toBe('Slow down!');
    });

    it('is instance of AppError', () => {
      expect(new RateLimitError()).toBeInstanceOf(AppError);
    });
  });

  describe('InternalError', () => {
    it('has status 500 and code INTERNAL_ERROR', () => {
      const error = new InternalError();
      expect(error.statusCode).toBe(500);
      expect(error.code).toBe('INTERNAL_ERROR');
      expect(error.message).toBe('Internal server error');
    });

    it('accepts custom message', () => {
      const error = new InternalError('Database connection failed');
      expect(error.message).toBe('Database connection failed');
    });

    it('is instance of AppError', () => {
      expect(new InternalError()).toBeInstanceOf(AppError);
    });
  });
});
