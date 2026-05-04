# RATE_LIMITING_RULES.md

> **Rate limiting protects the platform from abuse and ensures fair usage.** This document defines the rate limiting strategy, configuration, and implementation.

---

## 1. Strategy

- **Algorithm:** Sliding window (or fixed window with random jitter)
- **Storage:** Redis (in-memory fallback if Redis is unavailable)
- **Key pattern:** `ratelimit:{route_group}:{identifier}`
- **Identifier:** IP address for unauthenticated, user ID for authenticated

---

## 2. Rate Limit Tiers

| Tier | Endpoints | Window | Max Requests | Key |
|------|-----------|--------|-------------|-----|
| **Public** | GET /internships, GET /companies, GET /schools | 15 min | 100 | IP |
| **Auth** | POST /auth/register, POST /auth/login | 15 min | 20 | IP |
| **Password Reset** | POST /auth/forgot-password, POST /auth/reset-password | 15 min | 5 | IP |
| **OTP** | POST /auth/request-otp | 15 min | 3 | IP + Email |
| **Write** | POST/PATCH/DELETE on any resource | 15 min | 60 | User ID / IP |
| **Application** | POST /internships/:id/apply | 15 min | 10 | User ID |
| **Admin** | All /admin/* endpoints | 15 min | 200 | User ID |
| **Health** | GET /health | 1 min | 30 | IP |

---

## 3. Implementation

### 3.1 Rate Limiter Middleware

```typescript
// src/shared/middleware/rate-limit.middleware.ts

interface RateLimitConfig {
  windowMs: number;      // Time window in milliseconds
  max: number;           // Max requests per window
  keyGenerator?: (req: Request) => string;
  message?: string;
  statusCode?: number;
}

export function rateLimiter(config: RateLimitConfig) {
  return async (req: Request, res: Response, next: NextFunction) => {
    const key = config.keyGenerator 
      ? config.keyGenerator(req) 
      : req.ip;
    
    const redisKey = `ratelimit:${req.path}:${key}`;
    
    try {
      const current = await redisClient.incr(redisKey);
      
      if (current === 1) {
        // First request in window - set expiry
        await redisClient.expire(redisKey, config.windowMs / 1000);
      }
      
      const ttl = await redisClient.ttl(redisKey);
      
      // Set rate limit headers
      res.setHeader('X-RateLimit-Limit', config.max);
      res.setHeader('X-RateLimit-Remaining', Math.max(0, config.max - current));
      res.setHeader('X-RateLimit-Reset', Date.now() + (ttl * 1000));
      
      if (current > config.max) {
        throw new RateLimitError('Too many requests. Please try again later.');
      }
      
      next();
    } catch (error) {
      if (error instanceof RateLimitError) {
        next(error);
      } else {
        // Redis failure - fall back to in-memory
        logger.warn({ err: error }, 'Rate limiter Redis failure, using in-memory fallback');
        const inMemoryResult = inMemoryRateLimiter(config, req);
        // ... in-memory fallback logic
        next();
      }
    }
  };
}
```

### 3.2 Per-Route Configuration

```typescript
// Public endpoints
router.use('/internships', rateLimiter({ windowMs: 15 * 60 * 1000, max: 100 }));
router.use('/companies', rateLimiter({ windowMs: 15 * 60 * 1000, max: 100 }));

// Auth endpoints (stricter)
router.use('/auth/login', rateLimiter({ windowMs: 15 * 60 * 1000, max: 20 }));
router.use('/auth/register', rateLimiter({ windowMs: 15 * 60 * 1000, max: 20 }));
router.use('/auth/forgot-password', rateLimiter({ windowMs: 15 * 60 * 1000, max: 5 }));

// Write endpoints
router.use('/internships/:id/apply', rateLimiter({ windowMs: 15 * 60 * 1000, max: 10, keyGenerator: (req) => req.user!.id }));
```

---

## 4. Response

When rate limited, the API returns:

```
429 Too Many Requests
X-RateLimit-Limit: 20
X-RateLimit-Remaining: 0
X-RateLimit-Reset: 1700000000000
Retry-After: 360

{
  "success": false,
  "error": {
    "code": "RATE_LIMIT_EXCEEDED",
    "message": "Too many requests. Please try again later.",
    "requestId": "req_abc123"
  }
}
```

---

## 5. Rate Limit Headers

Every response includes:

| Header | Description |
|--------|-------------|
| `X-RateLimit-Limit` | Max requests allowed in the window |
| `X-RateLimit-Remaining` | Remaining requests in the current window |
| `X-RateLimit-Reset` | Unix timestamp when the window resets |

---

## 6. Bypass Rules

- Admin users may have higher limits (or no limits in extreme cases)
- Internal service-to-service calls bypass rate limiting (internal network)
- Health check endpoints are minimally limited

---

## 7. Monitoring & Alerting

- Alert when any endpoint reaches 80% of its rate limit consistently
- Alert when Redis is unavailable and in-memory fallback is active
- Monitor rate limit violation rates per IP

---

*Rate limits protect the platform. Do not disable them.*
