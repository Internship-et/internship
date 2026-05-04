# BACKEND_ENGINEERING_BIBLE.md

> **The constitution of this codebase.** Every decision, architectural choice, and implementation detail must trace back to the principles defined here.

---

## 0. Core Philosophy

### 0.1 The Platform's Purpose

This platform connects **Ethiopian high school students** with local organizations offering internships. Every technical decision serves this goal:
- **Accessibility** — the system must work for students with limited devices or internet
- **Trust** — verification of students, organizations, and opportunities is paramount
- **Scale** — designed to grow from hundreds to millions of users
- **Simplicity** — avoid over-engineering; solve today's problems today

### 0.2 Engineering Values

| Value | Meaning |
|-------|---------|
| **Correctness** | The system must be provably correct. Tested, validated, and auditable. |
| **Clarity** | Code is written for humans first, machines second. |
| **Security** | Every endpoint is guilty until proven innocent. |
| **Resilience** | The system degrades gracefully. Failures are isolated. |
| **Traceability** | Every request leaves a trail. Every change has an owner. |
| **Simplicity** | The simplest correct solution is the best solution. |

---

## 1. Architecture Principles

### 1.1 Modular Monolith

The system is a **modular monolith** — organized into logical modules but deployed as a single service.

**Why not microservices?**
- Premature distribution adds complexity without proven value
- Team size doesn't warrant it
- Can extract modules into services later if needed

**Module boundaries:**
```
auth/          — Authentication & authorization
students/      — Student profile management
companies/     — Company/organization management
internships/   — Internship opportunity management
applications/  — Application workflow
schools/       — School verification & partnerships
admin/         — Admin operations
shared/        — Shared utilities, types, middleware
```

### 1.2 Layered Architecture

```
┌─────────────────────────────┐
│         Routes              │  ← HTTP only (parse, delegate, respond)
├─────────────────────────────┤
│       Middleware             │  ← Auth, validation, logging, rate limiting, CORS, errors
├─────────────────────────────┤
│        Services              │  ← Business logic (orchestrate, validate rules)
├─────────────────────────────┤
│      Repositories            │  ← Database access (Prisma queries)
├─────────────────────────────┤
│       Prisma / DB            │  ← PostgreSQL (source of truth)
└─────────────────────────────┘
```

**Strict rules:**
- Routes import services, not repositories
- Services import repositories, not routes
- Repositories import Prisma client only
- No layer skips another (route → service → repository)

### 1.3 The Middleware Stack

Request pipeline (in order):

1. **Request ID** — assign unique ID to every request
2. **CORS** — allow configured origins
3. **Rate Limiting** — per-endpoint rate checks
4. **Logging** — structured request logging
5. **Body Parsing** — JSON, URL-encoded
6. **Validation** — Zod schema validation
7. **Authentication** — JWT verification (if required)
8. **Authorization** — role/permission check (if required)
9. **Route Handler** — controller logic
10. **Error Handler** — catch-all error formatting

### 1.4 PostgreSQL as Source of Truth

- All persistent data lives in PostgreSQL
- All relationships, constraints, and integrity rules are enforced at the database level
- Prisma migrations manage schema evolution
- Never bypass Prisma — raw SQL only when Prisma cannot express the query

### 1.5 Redis for Temporary State Only

Redis is used for:
- Rate limit counters
- OTP codes and verification tokens
- Session tokens (if needed)
- Job queues (Bull or similar)
- Cache (only for computed/derived data, never as source of truth)

Redis **must not** contain:
- User profiles
- Business-critical state
- Data that cannot be regenerated

---

## 2. Module Structure Convention

Every module follows this structure:

```
modules/<module-name>/
├── <module-name>.routes.ts       # Express routes
├── <module-name>.service.ts      # Business logic
├── <module-name>.repository.ts   # Database queries
├── <module-name>.schema.ts       # Zod schemas
├── <module-name>.types.ts        # TypeScript types
├── <module-name>.middleware.ts    # Module-specific middleware
├── <module-name>.errors.ts       # Module-specific errors
└── __tests__/
    ├── <module-name>.service.test.ts
    ├── <module-name>.routes.test.ts
    └── <module-name>.repository.test.ts
```

Exceptions:
- `shared/` module has no routes
- `auth/` module may deviate for passport/JWT strategy setup

---

## 3. Error Handling Philosophy

### 3.1 Domain Errors

Domain errors are predictable business-rule violations:
- "Email already registered"
- "Internship application deadline has passed"
- "Student is not enrolled at this school"

These are represented as **typed error classes** extending `AppError`.

### 3.2 System Errors

System errors are unexpected failures:
- Database connection lost
- Redis unavailable
- External API timeout

These are caught by the global error handler, logged, and returned as 500s with minimal detail (no stack traces to clients).

### 3.3 The Error Contract

Every error response follows this shape:
```typescript
{
  success: false,
  error: {
    code: string,          // Machine-readable error code
    message: string,       // Human-readable message
    details?: unknown,     // Optional validation details
    requestId: string      // Correlation ID
  }
}
```

See `docs/engineering/ERROR_HANDLING_CONTRACT.md` for the full specification.

---

## 4. Validation Philosophy

- All input validation uses **Zod**
- Validation happens at two levels:
  1. **Route level** — structural validation (is this a valid email? is this field required?)
  2. **Service level** — business validation (is this email already taken? is this student eligible?)
- Never trust the client. Validate server-side for everything.
- Sanitize strings (trim whitespace, normalize case) before storage.

---

## 5. Authentication & Authorization

- **Authentication** = "Who are you?" (JWT verification)
- **Authorization** = "What can you do?" (Role & permission check)
- JWTs contain: `userId`, `role`, `email`, `iat`, `exp`
- Roles: `STUDENT`, `COMPANY`, `SCHOOL`, `ADMIN`
- Every protected route checks auth + authorization
- Passwords hashed with bcrypt (cost factor ≥ 10)

See `SECURITY_RULES.md` for detailed requirements.

---

## 6. Testing Philosophy

- **Unit tests** for service functions (mocked repositories)
- **Integration tests** for routes (supertest + test database)
- **Repository tests** against a real test database
- Coverage target: ≥ 85% for services, ≥ 90% for routes, ≥ 70% overall
- Test files live in `__tests__/` next to source files

See `TESTING_RULES.md` for the complete testing contract.

---

## 7. Performance Principles

- N+1 queries are forbidden. Use Prisma includes / batch loading.
- Response times should be < 200ms for 95th percentile.
- Paginate all list endpoints (cursor-based preferred).
- Use database indexes thoughtfully (measure before adding).
- Profile before optimizing.

---

## 8. Security Principles

- Least privilege: every endpoint gets the minimum access needed.
- Defense in depth: validate at route level, service level, and database level.
- No secrets in code. All secrets in environment variables.
- Rate limit aggressively on auth endpoints.
- Sanitize all output (no leaking internal IDs, stack traces, or PII).

See `SECURITY_RULES.md` for the complete security contract.

---

## 9. Data Integrity

- All constraints enforced at database level (foreign keys, unique constraints, check constraints).
- Soft deletes preferred for user-facing data (`deletedAt` timestamp).
- Audit fields required on all tables: `createdAt`, `updatedAt`, `createdBy`, `updatedBy`.
- Immutable audit log for critical actions (application status changes, payments, role changes).

See `docs/engineering/DATABASE_INTEGRITY_RULES.md`.

---

## 10. Operational Principles

- All services must start without external dependencies (graceful degradation).
- Health check endpoint (`GET /health`) returns dependency status.
- Structured logging (JSON) to stdout.
- Metrics exposed for monitoring (Prometheus format).
- Graceful shutdown on SIGTERM/SIGINT.

---

*This document is the engineering constitution. All other documents derive from it.*
