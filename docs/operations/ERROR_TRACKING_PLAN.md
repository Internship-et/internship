# Error Tracking Plan

> **Planning document for error tracking and exception monitoring.**
> This document defines what errors to track, what NOT to track, and how to configure error reporting.
>
> ⚠️ **Scope:** This is a **planning-only** document. The `@sentry/node` package is **not** installed and Sentry is **not** implemented in this checkpoint.
> Error tracking implementation is deferred to a future checkpoint.

---

## 1. What to Track

### 1.1 Automatic Capture

| Category | Description | Example |
|----------|-------------|---------|
| **Unhandled exceptions** | Process-level `uncaughtException` and `unhandledRejection` | `TypeError: Cannot read properties of undefined` |
| **5xx responses** | All internal server errors | `INTERNAL_ERROR` responses |
| **Slow queries** | Database queries exceeding 1 second | Prisma query timeouts |
| **Rate limit violations** | Frequent 429 responses | Brute force attempts |
| **Auth failures** | Invalid tokens, expired tokens, unauthorized access | JWT expired errors |

### 1.2 Manual Capture (Future)

```typescript
// Future implementation — sentry wrapper in error handler
import * as Sentry from '@sentry/node';

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: process.env.NODE_ENV,
  tracesSampleRate: 0.1, // 10% sampling for performance
});

// In global error handler
app.use((err, req, res, next) => {
  Sentry.withScope((scope) => {
    scope.setTag('requestId', req.id);
    scope.setExtra('method', req.method);
    scope.setExtra('path', req.path);
    Sentry.captureException(err);
  });
  // ... existing error handler
});
```

---

## 2. What NOT to Track

**Under no circumstances** should the following be sent to external error tracking services:

| Data | Reason | Example Field Names |
|------|--------|-------------------|
| **Passwords** | Plaintext credential exposure | `password`, `newPassword`, `currentPassword` |
| **JWT tokens** | Session hijacking risk | `token`, `accessToken`, `refreshToken` |
| **OTP codes** | Account takeover risk | `otp`, `code`, `verificationCode` |
| **Email addresses** | User privacy (unless anonymized) | `email` |
| **Phone numbers** | User privacy | `phone`, `mobile` |
| **Full names** | User privacy | `firstName`, `lastName`, `fullName` |
| **Addresses** | User privacy | `address`, `city`, `street` |
| **API keys** | Infrastructure compromise | `apiKey`, `apiSecret`, `apiToken` |
| **Database URLs** | Infrastructure compromise | `DATABASE_URL`, `REDIS_URL` |
| **Stack traces in error messages** | Information disclosure | `error.message` (if contains internal paths) |

---

## 3. PII Scrubbing Rules

### 3.1 Breadcrumb Scrubbing

Before sending to Sentry (or any error tracking service), scrub PII from breadcrumbs:

```typescript
// Future implementation
function scrubBreadcrumb(breadcrumb: Sentry.Breadcrumb): Sentry.Breadcrumb {
  const SENSITIVE_KEYS = ['password', 'token', 'secret', 'authorization'];

  if (breadcrumb.data) {
    for (const key of Object.keys(breadcrumb.data)) {
      if (SENSITIVE_KEYS.some((sensitive) => key.toLowerCase().includes(sensitive))) {
        breadcrumb.data[key] = '[REDACTED]';
      }
    }
  }
  return breadcrumb;
}

Sentry.init({
  // ...
  beforeBreadcrumb: scrubBreadcrumb,
});
```

### 3.2 Event Scrubbing

Scrub request data before sending:

```typescript
// Future implementation
function scrubEvent(event: Sentry.Event): Sentry.Event {
  if (event.request) {
    // Redact sensitive headers
    if (event.request.headers) {
      if (event.request.headers.Authorization) {
        event.request.headers.Authorization = '[REDACTED]';
      }
      if (event.request.headers.Cookie) {
        event.request.headers.Cookie = '[REDACTED]';
      }
    }

    // Redact sensitive body fields
    if (event.request.data) {
      const SENSITIVE_FIELDS = ['password', 'token', 'otp', 'secret'];
      const data = typeof event.request.data === 'string'
        ? JSON.parse(event.request.data)
        : event.request.data;
      for (const field of SENSITIVE_FIELDS) {
        if (data[field]) {
          data[field] = '[REDACTED]';
        }
      }
      event.request.data = data;
    }
  }
  return event;
}
```

---

## 4. Configuration Template

Based on the provider abstraction in `docs/engineering/EXTERNAL_PROVIDERS.md` §5:

### 4.1 Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `SENTRY_DSN` | Sentry Project DSN | Required for production |
| `SENTRY_ENVIRONMENT` | Environment tag | Optional (defaults to NODE_ENV) |
| `SENTRY_TRACES_SAMPLE_RATE` | Performance tracing sample rate | Optional (defaults to 0.1) |

### 4.2 Error Tracking Interface (from EXTERNAL_PROVIDERS.md)

```typescript
interface ErrorTrackingService {
  captureException(exception: Error, context?: Record<string, unknown>): void;
  captureMessage(message: string, level?: 'info' | 'warning' | 'error'): void;
  setUser(userId: string | null): void;
  close(): Promise<void>;
}
```

---

## 5. Implementation Roadmap

| Phase | Task | Dependencies |
|-------|------|--------------|
| CP16 | Plan only (this document) | None |
| CP17 | Install `@sentry/node`, configure DSN, wire error handler | Sentry account/DSN |
| CP17 | Implement PII scrubbing (beforeBreadcrumb, beforeSend) | Sentry integration |
| CP18 | Add performance tracing (tracesSampleRate) | Production traffic |
| CP19 | Set up alerting rules in Sentry | Error volume baseline |

---

## 6. Integration Points

The error tracking service should be integrated at these points:

1. **Global error handler** (`src/shared/middleware/error.middleware.ts`) — capture all unhandled errors
2. **Prisma error handler** (repository layer) — capture database query errors
3. **Rate limiter** — capture when rate limit is exceeded (configurable threshold)
4. **Health check** — capture dependency failures (DB, Redis)
5. **Startup** — capture initialization failures

---

*Error tracking is not optional for production. Plan first, implement carefully, test thoroughly.*
