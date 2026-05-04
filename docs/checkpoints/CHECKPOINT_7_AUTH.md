# CHECKPOINT 8: Rate Limiting & Security Middleware

**Prerequisites:** CHECKPOINT_7_AUTH ✅

---

## Goal

Implement Redis-based rate limiting and security middleware (security headers, CORS hardening).

---

## Tasks

### 1. Create Rate Limiter Middleware

- [ ] `src/shared/middleware/rate-limit.middleware.ts`:
  - Redis-based sliding window
  - Configurable per route (window, max requests)
  - Keyed by IP (unauthenticated) or user ID (authenticated)
  - In-memory fallback when Redis is unavailable
  - Sets `X-RateLimit-*` headers
  - Returns 429 when exceeded

### 2. Apply Rate Limiting

- [ ] Global default: 100 req / 15 min
- [ ] Auth endpoints: 20 req / 15 min
- [ ] Password reset: 5 req / 15 min
- [ ] OTP requests: 3 req / 15 min
- [ ] Application submission: 10 req / 15 min
- [ ] Admin endpoints: 200 req / 15 min

### 3. Implement Security Middleware

- [ ] Security headers middleware (`helmet`):
  - `Strict-Transport-Security`
  - `X-Content-Type-Options`
  - `X-Frame-Options`
  - `X-XSS-Protection`
  - `Content-Security-Policy`
  - `Referrer-Policy`

### 4. Harden CORS

- [ ] Restrict origins based on environment
- [ ] Validate credentials mode
- [ ] Restrict allowed methods and headers

### 5. Write Tests

- [ ] Test: rate limit is exceeded and returns 429
- [ ] Test: rate limit resets after window
- [ ] Test: security headers are present
- [ ] Test: CORS blocks disallowed origins

---

## Forbidden Scope

- Do NOT implement domain modules (students, companies, internships, etc.)
- Do NOT create business logic services or repositories
- Do NOT modify auth middleware or JWT logic
- Do NOT deploy to production

---

## Acceptance Criteria

- [ ] Rate limiting works with Redis
- [ ] Rate limiting falls back to in-memory when Redis is down
- [ ] Security headers are present on all responses
- [ ] CORS is correctly configured
- [ ] Rate limit headers are returned
- [ ] All tests pass

---

## Estimated Time

4 hours
