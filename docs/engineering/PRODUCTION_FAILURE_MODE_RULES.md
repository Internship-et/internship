# PRODUCTION_FAILURE_MODE_RULES.md

> **Plan for failure.** This document describes how the system behaves when dependencies fail, and how failures are handled.

---

## 1. Failure Mode Principles

- **Graceful degradation** — the system should continue working, possibly with reduced functionality
- **Fail fast** — if a dependency is unavailable, surface the error immediately (don't hang)
- **Circuit break** — stop hammering failing dependencies
- **Timeout early** — every external call has a timeout (default 5s)
- **Log everything** — every failure is logged with context

---

## 2. Dependency Failure Scenarios

### 2.1 PostgreSQL Down

**Impact:** Full system outage. The application cannot operate without the database.

**Behavior:**
- Health check returns `503` with `database: unhealthy`
- All database-dependent endpoints return `503 SERVICE_UNAVAILABLE`
- The server stays running (doesn't crash) to serve health checks
- Retry connection with exponential backoff

**Recovery:**
- Automatic: Prisma reconnects when DB is available
- Manual: Check DB server, network, credentials

### 2.2 Redis Down

**Impact:** Partial degradation. Auth, rate limiting, and OTP features break.

**Behavior:**
- Rate limiting falls back to in-memory (with warning log)
- OTP verification fails (cannot store/verify OTPs)
- Session validation fails (users may need to re-login)
- The application continues serving requests without Redis features
- Health check reports `redis: unhealthy`

**Recovery:**
- Automatic: Redis client reconnects
- Manual: Check Redis server, memory, network

### 2.3 External Email Service Down

**Impact:** Email notifications are not sent. Core application still works.

**Behavior:**
- Email sending is retried up to 3 times with exponential backoff
- Failed emails are queued for retry (Redis queue)
- After all retries, the failure is logged but the request succeeds (non-blocking)
- Admin is alerted of email delivery failures

### 2.4 External SMS Service Down

**Impact:** OTP delivery fails. Phone verification does not work.

**Behavior:**
- OTP sending fails fast (no silent failure)
- User sees error: "Unable to send verification code. Try again later."
- Fallback: email-based OTP as alternative

---

## 3. Application Failure Modes

### 3.1 Unhandled Exception

- Global error handler catches all unhandled exceptions
- Server logs the error with full stack trace
- Returns `500` with generic message
- Process does NOT crash (using graceful error handling, not `process.exit`)

### 3.2 Memory Pressure

- Monitor memory usage (prometheus metrics)
- If memory exceeds 80% of container limit, log warning
- If memory exceeds 95%, begin graceful connection draining

### 3.3 Slow Queries

- Prisma query logging enabled in production (slow query threshold: 500ms)
- Queries exceeding 1s are logged as warnings
- Queries exceeding 5s are logged as errors
- Long-running queries are cancelled via `Promise.race` with timeout

---

## 4. Circuit Breaker Pattern

For external API calls (email, SMS, file storage):

```typescript
interface CircuitBreakerState {
  failures: number;
  lastFailureTime: number;
  state: 'CLOSED' | 'OPEN' | 'HALF_OPEN';
}

const THRESHOLD = 5;       // failures before opening
const TIMEOUT = 30000;     // 30s before trying again
```

- **CLOSED:** Normal operation. Calls pass through.
- **OPEN:** Failing fast. Calls are rejected immediately.
- **HALF_OPEN:** Testing if service is back. One call is allowed through.

---

## 5. Health Check Endpoint

```
GET /health
{
  status: 'ok' | 'degraded' | 'down',
  uptime: 12345,
  version: '1.0.0',
  dependencies: {
    database: { status: 'healthy' | 'unhealthy', latency: 5 },
    redis: { status: 'healthy' | 'unhealthy' | 'degraded', latency: 2 },
    emailService: { status: 'healthy' | 'unhealthy' }
  },
  memory: {
    used: '128MB',
    total: '512MB',
    percentage: 25
  }
}
```

- `ok` — All dependencies healthy
- `degraded` — Non-critical dependency unhealthy (Redis, email)
- `down` — Critical dependency unhealthy (database)

---

## 6. Graceful Shutdown

On `SIGTERM` or `SIGINT`:

```
1. Stop accepting new requests (drain)
2. Wait for in-flight requests (max 30s)
3. Close database connections
4. Close Redis connections
5. Close HTTP server
6. Exit process (code 0 for intentional, 1 for error)
```

---

## 7. Retry Policy

| Operation | Max Retries | Backoff | Timeout |
|-----------|-------------|---------|---------|
| Database connection | ∞ | Exponential (1s, 2s, 4s, ...) | 10s per attempt |
| Redis connection | 3 | Exponential (500ms, 1s, 2s) | 5s per attempt |
| Email send | 3 | Exponential (1s, 5s, 15s) | 10s per attempt |
| SMS send | 2 | Fixed (2s) | 5s per attempt |

---

*Assume failure. Build for recovery.*
