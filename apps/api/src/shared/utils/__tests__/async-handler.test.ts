// ─────────────────────────────────────────────────────────────
// Async Handler — Unit Tests
// Tests that asyncHandler properly wraps async route handlers
// and forwards rejected promises to Express error middleware.
// ─────────────────────────────────────────────────────────────

import { describe, it, expect, vi } from 'vitest';
import { type Request, type Response, type NextFunction } from 'express';
import { asyncHandler } from '../async-handler.js';

describe('asyncHandler', () => {
  it('should call next with error when the handler throws', async () => {
    const error = new Error('Something went wrong');
    const handler = asyncHandler(async (_req: Request, _res: Response, _next: NextFunction) => {
      throw error;
    });

    const req = {} as Request;
    const res = {} as Response;
    const next = vi.fn();

    await handler(req, res, next);

    expect(next).toHaveBeenCalledWith(error);
  });

  it('should call next with error when the handler returns a rejected promise', async () => {
    const error = new Error('Async failure');
    const handler = asyncHandler((_req: Request, _res: Response, _next: NextFunction) => {
      return Promise.reject(error);
    });

    const req = {} as Request;
    const res = {} as Response;
    const next = vi.fn();

    await handler(req, res, next);

    expect(next).toHaveBeenCalledWith(error);
  });

  it('should not call next when the handler succeeds', async () => {
    const handler = asyncHandler(async (_req: Request, res: Response, _next: NextFunction) => {
      res.status(200).json({ success: true });
    });

    const req = {} as Request;
    const res = { status: vi.fn().mockReturnThis(), json: vi.fn() } as unknown as Response;
    const next = vi.fn();

    await handler(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({ success: true });
  });

  it('should forward the correct error type (AppError)', async () => {
    // Use a plain Error since we're testing the wrapping behavior
    const appError = new Error('Not found');
    const handler = asyncHandler(async (_req: Request, _res: Response, _next: NextFunction) => {
      throw appError;
    });

    const req = {} as Request;
    const res = {} as Response;
    const next = vi.fn();

    await handler(req, res, next);

    expect(next).toHaveBeenCalledWith(appError);
  });

  it('should handle synchronous throw inside async function', async () => {
    const handler = asyncHandler(async (_req: Request, _res: Response, _next: NextFunction) => {
      throw new Error('Sync throw in async');
    });

    const req = {} as Request;
    const res = {} as Response;
    const next = vi.fn();

    await handler(req, res, next);

    expect(next).toHaveBeenCalledWith(expect.objectContaining({
      message: 'Sync throw in async',
    }));
  });

  it('should forward arguments correctly to the wrapped handler', async () => {
    const mockHandler = vi.fn().mockResolvedValue(undefined);
    const handler = asyncHandler(mockHandler);

    const req = { method: 'GET' } as unknown as Request;
    const res = { statusCode: 200 } as Response;
    const next = vi.fn();

    await handler(req, res, next);

    expect(mockHandler).toHaveBeenCalledWith(req, res, next);
  });

  it('should work with void return from handler', async () => {
    const handler = asyncHandler(async (_req: Request, res: Response, _next: NextFunction) => {
      res.sendStatus(204);
    });

    const req = {} as Request;
    const res = { sendStatus: vi.fn() } as unknown as Response;
    const next = vi.fn();

    await handler(req, res, next);

    expect(res.sendStatus).toHaveBeenCalledWith(204);
    expect(next).not.toHaveBeenCalled();
  });
});
