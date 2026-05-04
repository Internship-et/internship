# ERROR_HANDLING_CONTRACT.md

> **Every error is a contract.** This document defines how errors are created, propagated, logged, and returned to the client.

---

## 1. Error Hierarchy

```
Error
└── AppError (base class)
    ├── ValidationError        (400)
    ├── UnauthorizedError      (401)
    ├── ForbiddenError         (403)
    ├── NotFoundError          (404)
    ├── ConflictError          (409)
    ├── UnprocessableError     (422)
    ├── RateLimitError         (429)
    └── InternalError          (500)
        └── ServiceUnavailableError (503)
```

## 2. AppError Base Class

```typescript
export class AppError extends Error {
  public readonly statusCode: number;
  public readonly code: string;
  public readonly details?: unknown;
  public readonly isOperational: boolean;

  constructor(
    message: string,
    statusCode: number,
    code: string,
    details?: unknown,
    isOperational = true
  ) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
    this.isOperational = isOperational;
    Error.captureStackTrace(this, this.constructor);
  }
}
```

## 3. Standard Error Codes

| HTTP | Code | Class | When |
|------|------|-------|------|
| 400 | `VALIDATION_ERROR` | ValidationError | Zod validation fails |
| 400 | `MISSING_FIELD` | ValidationError | Required field missing |
| 401 | `UNAUTHORIZED` | UnauthorizedError | No token / invalid token |
| 401 | `TOKEN_EXPIRED` | UnauthorizedError | Token expired |
| 403 | `FORBIDDEN` | ForbiddenError | Insufficient role/permissions |
| 403 | `ACCOUNT_SUSPENDED` | ForbiddenError | User account is suspended |
| 404 | `NOT_FOUND` | NotFoundError | Resource not found |
| 409 | `CONFLICT` | ConflictError | Duplicate resource |
| 409 | `ALREADY_APPLIED` | ConflictError | Duplicate application |
| 422 | `INTERNSHIP_CLOSED` | UnprocessableError | Internship no longer accepting |
| 422 | `DEADLINE_PASSED` | UnprocessableError | Application deadline passed |
| 429 | `RATE_LIMIT_EXCEEDED` | RateLimitError | Too many requests |
| 500 | `INTERNAL_ERROR` | InternalError | Unexpected server error |
| 503 | `SERVICE_UNAVAILABLE` | ServiceUnavailableError | Dependency unavailable |

## 4. Error Response Shape

```typescript
// Success
{
  success: true,
  data: { ... }
}

// Error
{
  success: false,
  error: {
    code: "VALIDATION_ERROR",
    message: "Invalid input data",
    details: [
      { field: "email", message: "Invalid email format", code: "invalid_string" }
    ],
    requestId: "req_abc123"
  }
}
```

## 5. Validation Error Details

When Zod validation fails, the `details` array contains:

```typescript
[
  {
    field: "email",
    message: "Invalid email format",
    code: "invalid_string"      // Zod issue code
  },
  {
    field: "age",
    message: "Must be at least 14 years old",
    code: "too_small"
  }
]
```

## 6. Error Handling Middleware

```typescript
// Global error handler — single middleware, registered last
app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
  // 1. Log the error
  logger.error({ err, requestId: req.id });

  // 2. If it's an AppError, use its properties
  if (err instanceof AppError) {
    return res.status(err.statusCode).json({
      success: false,
      error: {
        code: err.code,
        message: err.message,
        details: err.details,
        requestId: req.id
      }
    });
  }

  // 3. If it's a Prisma error, map it
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    return handlePrismaError(err, req, res);
  }

  // 4. Unknown errors — return generic 500
  return res.status(500).json({
    success: false,
    error: {
      code: 'INTERNAL_ERROR',
      message: 'An unexpected error occurred',
      requestId: req.id
    }
  });
});
```

## 7. Prisma Error Mapping

| Prisma Error | HTTP | Code |
|-------------|------|------|
| P2002 (unique constraint) | 409 | CONFLICT |
| P2025 (not found) | 404 | NOT_FOUND |
| P2003 (foreign key) | 400 | INVALID_REFERENCE |
| P2014 (required relation) | 400 | INVALID_RELATION |
| Other | 500 | DATABASE_ERROR |

## 8. Service Layer Error Rules

- Services throw `AppError` subclasses for predictable failures
- Services do NOT catch unexpected errors — let them propagate to the global handler
- Services NEVER return `[null, error]` tuples — throw instead
- Services NEVER send HTTP responses — throw instead

## 9. What NOT to Expose

Never return to the client:
- ❌ Stack traces
- ❌ Database error details
- ❌ Internal IPs or hostnames
- ❌ File paths
- ❌ SQL queries
- ❌ Token or password hints
- ❌ System configuration

## 10. Error Logging Standards

Every logged error includes:
```typescript
{
  level: 'error',
  message: '...',
  requestId: '...',
  userId: '...',          // if authenticated
  method: 'GET',
  path: '/api/v1/...',
  statusCode: 500,
  stack: '...',           // server-side only, never client
  duration: 123,           // request duration in ms
  context: { ... }         // additional relevant context
}
```

---

*Errors are contracts. Handle them consistently.*
