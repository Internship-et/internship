# REDIS_INTEGRITY_RULES.md

> **Redis is for temporary state only.** PostgreSQL is the source of truth. This document defines how Redis is used and what guarantees it must provide.

---

## 1. Redis Usage — Allowed

### 1.1 Rate Limiting

```typescript
// Key: ratelimit:{route}:{ip}
// Value: { count: number, resetAt: timestamp }
// TTL: matching the rate limit window
```

- Sliding window algorithm (or fixed window with jitter)
- Data can be lost without breaking business logic
- Worst case: rate limits reset, allowing extra requests temporarily

### 1.2 OTP Storage

```typescript
// Key: otp:{phone|email}
// Value: { code: hashed_code, attempts: number }
// TTL: 5 minutes
```

- OTPs are stored as **hashes** (never plain text)
- Maximum 3 verification attempts before invalidation
- Expiry is critical — OTPs must not be usable after 5 minutes

### 1.3 Session Tokens (Refresh Tokens)

```typescript
// Key: session:{refreshToken}
// Value: { userId, role, createdAt }
// TTL: 7 days (matching refresh token expiry)
```

- Session invalidation via `DEL key`
- On password change, all sessions for that user are deleted
- Max 5 concurrent sessions per user

### 1.4 Job Queues

```typescript
// Using Bull or similar library
// Queues: email-notifications, application-status, cleanup-jobs
```

- Queue jobs are retried on failure
- Failed jobs are stored for debugging
- Queue persistence is acceptable (Redis persistence enabled)

### 1.5 Computed Cache

```typescript
// Key: cache:{entity}:{id}:{variant}
// Value: serialized JSON
// TTL: configurable per cache type (default 5 minutes)
```

- Cache is **never** the source of truth
- Cache is invalidated on related writes (write-through or TTL)
- Cache misses trigger recomputation from PostgreSQL

---

## 2. Redis Usage — Forbidden

Redis **must not** contain:
- ❌ User profiles
- ❌ Internship data
- ❌ Application data
- ❌ Company information
- ❌ Any data that cannot be regenerated from PostgreSQL
- ❌ Business-critical state

If Redis is flushed, the only impact should be:
- Rate limits reset
- Active OTPs invalidated
- Users need to re-login
- Caches need to warm up

---

## 3. Redis Configuration

### 3.1 Persistence

- Redis persistence: **RDB snapshots** (every 5 minutes)
- AOF (Append-Only File): disabled for now
- Rationale: Data in Redis is temporary; losing it is acceptable

### 3.2 Memory Management

- Max memory: 256MB (configurable)
- Eviction policy: `allkeys-lru` (least recently used)
- Monitor memory usage; alert at 80%

### 3.3 Connection Management

- Connection pool: max 20 connections
- Retry on error: yes (exponential backoff)
- Timeout: 5 seconds

---

## 4. Graceful Degradation

When Redis is unavailable:

1. **Rate limiting:** Fall back to in-memory store with warning log
2. **OTP verification:** Fail (cannot verify OTPs without Redis)
3. **Sessions:** Fail (users must re-authenticate each request, or fall back to JWT-only)
4. **Job queues:** Pause processing (jobs remain in memory)
5. **Cache:** Bypass cache, query PostgreSQL directly

---

## 5. Redis Client

```typescript
// src/shared/lib/redis.ts
import { createClient } from 'redis';

const redisClient = createClient({
  url: process.env.REDIS_URL,
  socket: {
    reconnectStrategy: (retries) => Math.min(retries * 50, 2000),
    connectTimeout: 5000,
  },
});

redisClient.on('error', (err) => {
  logger.error({ err }, 'Redis connection error');
});

redisClient.on('connect', () => {
  logger.info('Redis connected');
});

export { redisClient };
```

---

## 6. Testing with Redis

- Tests use a **mocked Redis client**
- Integration tests use a real Redis instance via Docker
- Test keys are prefixed with `test:` to avoid collision
- Database is flushed between test runs

---

*Redis is a helper, not a source of truth. Treat it accordingly.*
