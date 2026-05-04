# CHECKPOINT 5: Core Utilities

**Prerequisites:** CHECKPOINT_4_API_SHELL ✅

---

## Goal

Create shared utility classes, error types, logger, and helper functions.

---

## Tasks

### 1. Create Error Classes

- [ ] `src/shared/errors/app-error.ts` — Base `AppError` class
- [ ] `ValidationError` (400)
- [ ] `UnauthorizedError` (401)
- [ ] `ForbiddenError` (403)
- [ ] `NotFoundError` (404)
- [ ] `ConflictError` (409)
- [ ] `UnprocessableError` (422)
- [ ] `RateLimitError` (429)
- [ ] `InternalError` (500)

### 2. Create Logger

- [ ] Install `pino` and `pino-pretty`
- [ ] Create `src/shared/lib/logger.ts`:
  - Structured JSON logging
  - Log levels: debug, info, warn, error
  - Request ID context support
  - Pino-pretty in development

### 3. Create Async Handler

- [ ] `src/shared/utils/async-handler.ts`:
  ```typescript
  export const asyncHandler = (fn: RequestHandler) => 
    (req: Request, res: Response, next: NextFunction) =>
      Promise.resolve(fn(req, res, next)).catch(next);
  ```

### 4. Create Pagination Helpers

- [ ] `src/shared/utils/pagination.ts`:
  - Cursor-based pagination utilities
  - Offset-based pagination utilities
  - Build pagination meta

### 5. Create Type Extensions

- [ ] `src/shared/types/express.d.ts`:
  ```typescript
  declare global {
    namespace Express {
      interface Request {
        id: string;
        user?: {
          id: string;
          role: string;
          email: string;
        };
      }
    }
  }
  ```

### 6. Create Redis Client

- [ ] `src/shared/lib/redis.ts` — Redis client singleton

### 7. Create Config Module

- [ ] `src/config/index.ts` — Load and validate env vars

---

## Forbidden Scope

- Do NOT implement business logic, services, or repositories
- Do NOT create API routes or controllers
- Do NOT create validation schemas (reserved for CHECKPOINT_6)
- Do NOT implement auth middleware or JWT logic

---

## Acceptance Criteria

- [ ] All error classes are typed and functional
- [ ] Logger produces structured JSON output
- [ ] `asyncHandler` correctly catches async errors
- [ ] Pagination helpers produce correct meta
- [ ] TypeScript compiles without errors

---

## Estimated Time

3 hours
- [ ] Error handler returns consistent error format
- [ ] Server starts without errors

---

## Estimated Time

3 hours
