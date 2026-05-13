// ─────────────────────────────────────────────────────────────
// Validation Middleware
// Validates inbound request data (body / query / params) against
// a Zod schema.  On success, replaces the source with the parsed
// data.  On failure, throws a structured ValidationError matching
// the API_RESPONSE_CONTRACT.md error envelope.
// ─────────────────────────────────────────────────────────────

import { type Request, type Response, type NextFunction } from 'express';
import { ValidationError } from '../errors/app-error.js';
import type { ZodSchema, TypeOf, ZodError } from 'zod';

/** A single validation-error detail, as defined in the API contract. */
export interface ValidationDetail {
  field: string;
  message: string;
  code: string;
}

/**
 * Maps a ZodError into the `ValidationDetail[]` array expected by
 * the API_RESPONSE_CONTRACT.md error envelope.
 */
function mapZodIssues(error: ZodError): ValidationDetail[] {
  return error.issues.map((issue) => ({
    field: issue.path.join('.'),
    message: issue.message,
    code: issue.code,
  }));
}

/**
 * Express middleware factory that validates `req[source]` against
 * the supplied Zod schema.
 *
 * @param schema  – A Zod schema to validate against.
 * @param source  – The request property to validate ('body', 'query', or 'params').
 *                  Defaults to 'body'.
 * @returns Express middleware that throws a `ValidationError` on failure
 *          or replaces `req[source]` with the parsed (and transformed) data.
 *
 * @example
 * ```ts
 * router.post('/students', validate(createStudentSchema), handler);
 * router.get('/students', validate(listStudentQuerySchema, 'query'), handler);
 * ```
 */
export function validate<T extends ZodSchema>(
  schema: T,
  source: 'body' | 'query' | 'params' = 'body',
) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req[source]);

    if (!result.success) {
      const details = mapZodIssues(result.error);
      throw new ValidationError('Invalid input data', details);
    }

    // Replace the request data with the parsed (and possibly transformed) data.
    // In Express 5, `req.query` and `req.params` may be read-only getters,
    // so use Object.defineProperty to safely override them when needed.
    try {
      req[source] = result.data as TypeOf<T>;
    } catch {
      // Property is read-only (e.g., req.query in Express 5) — use defineProperty
      Object.defineProperty(req, source, {
        value: result.data,
        writable: true,
        configurable: true,
      });
    }
    next();
  };
}

export default validate;
