# CHECKPOINT 7: Auth System

**Prerequisites:** CHECKPOINT_6_VALIDATION ✅

---

## Goal

Implement the complete authentication system: user registration (User record only), login with credential verification and failed-attempt lockout, JWT access/refresh token management, token refresh with rotation, logout with session invalidation, password-reset flow, GET /auth/me, PATCH /auth/me (base fields only), authenticate middleware, and authorize middleware. All sessions stored in Redis by token hash with a user-to-session sorted set index for concurrent-session enforcement. All passwords hashed with bcrypt.

---

## Implementation Tasks

### 1. Install Dependencies

Run from repository root:

```bash
npm install jsonwebtoken bcrypt --workspace=@internship/api
npm install -D @types/jsonwebtoken @types/bcrypt --workspace=@internship/api
```

Then verify `cd apps/api && npm run typecheck` passes.

### 2. Create Token Utilities

- [ ] `apps/api/src/shared/utils/token.ts`:

| Function | Signature | Description |
|----------|-----------|-------------|
| `generateAccessToken` | `(user: { id: string; role: string; email: string }) => string` | Signs JWT with `userId`, `role`, `email`, `iat`, `exp` (15 min). HS256. Secret from `config.jwtSecret`. |
| `generateRefreshToken` | `(user: { id: string; role: string; email: string }) => string` | Signs JWT with `userId`, `role`, `email`, `iat`, `exp` (7 days). HS256. Secret from `config.jwtSecret`. |
| `verifyToken` | `(token: string) => JwtPayload` | Verifies JWT signature and expiry. Returns decoded payload or throws `UnauthorizedError`. |
| `hashToken` | `(token: string) => string` | Creates a SHA-256 hex digest of a token (for Redis key lookup). Uses Node.js `crypto` module. |

- JWT payload type: `{ userId: string; role: UserRole; email: string; iat: number; exp: number }`
- No sensitive data (password, phone, address) in JWT payload

### 3. Update Auth Schema (Modify Existing)

- [ ] **Modify** `apps/api/src/modules/auth/auth.schema.ts`:

  Registration in Checkpoint 7 creates **only the User record**. Role-specific fields (`schoolId`, `companyName`) are deferred to their domain module checkpoints (9–14). Therefore:

  - Remove `schoolId` and `companyName` fields from `registerSchema` and its `superRefine` block
  - Keep: `email`, `password`, `firstName`, `lastName`, `role` (`STUDENT` | `COMPANY` | `SCHOOL`), `phone` (optional), `agreeToTerms` (must be `true`)
  - All other existing schemas (`loginSchema`, `refreshTokenSchema`, `forgotPasswordSchema`, `resetPasswordSchema`) remain unchanged
  - Register schema `RegisterInput` type will change to reflect the removed fields

- [ ] **Add** `updateProfileSchema` for PATCH /auth/me:

  ```typescript
  export const updateProfileSchema = z.object({
    firstName: z.string().min(1).max(100).trim().optional(),
    lastName: z.string().min(1).max(100).trim().optional(),
    phone: z.string().regex(ethiopianPhoneRegex).optional(),
  });
  export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;
  ```

  This covers only base User fields. Role-specific profile fields (bio, resumeUrl, company description, etc.) are deferred to domain modules.

### 4. Create Auth Repository

- [ ] `apps/api/src/modules/auth/auth.repository.ts`:

| Method | Description |
|--------|-------------|
| `findByEmail(email)` | Find non-deleted user by email. Returns user with all fields (including `passwordHash`) or `null`. |
| `findById(id)` | Find non-deleted user by UUID. Returns user with all fields except `passwordHash`, or `null`. |
| `create(data)` | Create user with `passwordHash`, `email`, `firstName`, `lastName`, `role`, `phone?`, `status: PENDING`, `isVerified: false`. Returns the created user (without passwordHash). |
| `updatePassword(id, passwordHash)` | Update password hash only. Returns void. |
| `updateLastLogin(id)` | Set `lastLoginAt` to `new Date()`. Returns void. |
| `updateProfile(id, data)` | Update base User fields (`firstName`, `lastName`, `phone`). Returns updated user (without passwordHash). |

- Uses Prisma `User` model from `apps/api/prisma/schema.prisma`
- Must not contain business logic or validation
- **No `updateFailedAttempts` method** — failed-login tracking is Redis-only ephemeral state

### 5. Create Auth Service

- [ ] `apps/api/src/modules/auth/auth.service.ts`:

**`register(input)`**
- Check email uniqueness via `findByEmail`; if exists, throw `ConflictError('Email already registered')`
- Hash password with bcrypt (cost factor 10)
- Create User record via repository with `status: PENDING`, `isVerified: false`
- Generate access + refresh tokens via token utility
- Create Redis session (see Session Management section below)
- Return `{ user: { id, email, firstName, lastName, role }, token: { accessToken, refreshToken, expiresIn: 900 } }`
- Never return `passwordHash` in response

**`login(input)`**
- **Failed-login lockout check (Redis-only, no Prisma field):**
  - Before password check, read `failed-login:{normalizedEmail}` from Redis
  - If value ≥ 5: throw `UnauthorizedError('Account temporarily locked. Try again later.')`
- Find user by email via `findByEmail`
- If not found OR password does not match (bcrypt compare):
  - `INCR failed-login:{normalizedEmail}` and `EXPIRE 900` (15 min)
  - Throw `UnauthorizedError('Invalid email or password')` — generic, does NOT reveal whether email exists
- On successful password match:
  - `DEL failed-login:{normalizedEmail}`
  - Check user status: if `SUSPENDED` throw `new AppError('Account suspended', 403, 'ACCOUNT_SUSPENDED')`; if `PENDING` throw `new AppError('Account not verified', 403, 'ACCOUNT_NOT_VERIFIED')`
  - Update `lastLoginAt` via repository
  - Generate tokens and create Redis session
  - Return user + tokens

**`refresh(refreshToken)`**
- Verify the refresh token JWT via `verifyToken`
- Hash the provided token: `refreshTokenHash = hashToken(refreshToken)`
- Check Redis `GET session:{refreshTokenHash}`; if not found, throw `UnauthorizedError('Invalid refresh token')`
- Delete old session: `DEL session:{refreshTokenHash}`; `ZREM user-sessions:{userId}` with the hash
- Generate new access + refresh tokens
- Create new Redis session
- Return new `{ accessToken, refreshToken, expiresIn: 900 }`

**`logout(userId, refreshToken?)`**
- If `refreshToken` provided: compute hash, `DEL session:{hash}`, `ZREM user-sessions:{userId} {hash}`
- If no `refreshToken` (logout all): `ZRANGE user-sessions:{userId} 0 -1` to get all hashes, `DEL session:{hash}` for each, `DEL user-sessions:{userId}`
- Return `{ message: 'Logged out successfully' }`

**`forgotPassword(email)`**
- Find user by email (if not found, return success anyway — prevent enumeration)
- Generate crypto-random token (32 bytes hex via `crypto.randomBytes`)
- Hash token: `tokenHash = hashToken(rawToken)`
- Store: `SET password-reset:{tokenHash} → JSON.stringify({ userId })` with TTL 15 min
- **Do NOT return the raw token in the response.** Always return `{ message: 'If the email exists, a reset link has been sent' }`
- See Known Gaps: no email provider available to deliver the token

**`resetPassword(token, newPassword)`**
- Hash provided token: `tokenHash = hashToken(token)`
- `GET password-reset:{tokenHash}`; if not found, throw `UnauthorizedError('Invalid or expired reset token')`
- `DEL password-reset:{tokenHash}` (single-use)
- Hash new password with bcrypt (cost factor 10)
- Update password via repository
- Invalidate all user sessions: `ZRANGE user-sessions:{userId} 0 -1`, `DEL session:{hash}` for each, `DEL user-sessions:{userId}`
- Return `{ message: 'Password reset successfully' }`

**`getMe(userId)`**
- Find user by ID via `findById`
- If not found: throw `NotFoundError('User not found')`
- Return user profile: `{ id, email, firstName, lastName, role, phone, status, isVerified, createdAt }`

**`updateProfile(userId, data)`**
- Find user by ID via `findById` (throws if not found)
- Update base User fields via `repository.updateProfile(userId, data)`
- Return updated user profile

**General rules:**
- All methods use typed inputs from auth schemas
- All methods throw typed `AppError` subclasses or direct `new AppError(...)` for custom codes
- Never log passwords, tokens, or PII
- Never return `passwordHash` in any response

### 6. Session Management — Redis Sorted Set with Concurrent Session Limit

**Data structures:**
- `session:{refreshTokenHash}` → `String`: `JSON.stringify({ userId, role, createdAt })` — TTL 7 days (604800 seconds)
- `user-sessions:{userId}` → `Sorted Set`: score = Unix timestamp (ms), member = `refreshTokenHash` — TTL 7 days

**On session creation** (register, login, refresh):
```
1. hash = hashToken(refreshToken)
2. now = Date.now()
3. SET session:{hash}  "{userId,role,createdAt}"  EX 604800
4. ZADD user-sessions:{userId}  now  hash
5. oldHashes = ZRANGE user-sessions:{userId}  0  -6
   // Gets the oldest elements (ranks 0 through N-6), if they exist.
   // When there are ≤5 sessions, this returns empty; when 6+, returns the oldest.
6. For each oldHash: DEL session:{oldHash}
7. ZREMRANGEBYRANK user-sessions:{userId}  0  -6
   // Removes the same oldest elements from the set.
8. EXPIRE user-sessions:{userId}  604800
```

This evicts the oldest session automatically when a sixth is added. No login is rejected — the oldest session is silently rotated out.

**On refresh** (rotation):
```
1. hash = hashToken(oldRefreshToken)
2. GET session:{hash}  → verify exists
3. DEL session:{hash}
4. ZREM user-sessions:{userId}  hash
5. Generate new access + refresh tokens
6. Follow session creation steps (1–8) for the new token
```

**On logout (single session):**
```
1. hash = hashToken(refreshToken)
2. DEL session:{hash}
3. ZREM user-sessions:{userId}  hash
```

**On logout-all / password-reset:**
```
1. oldHashes = ZRANGE user-sessions:{userId}  0  -1
2. For each oldHash: DEL session:{oldHash}
3. DEL user-sessions:{userId}
```

**No Redis `KEYS` or `SCAN` commands are used anywhere.**

### 7. Create Auth Middleware

- [ ] `apps/api/src/shared/middleware/auth.middleware.ts`:

**`authenticate`** — Express middleware:
- Extract `Authorization: Bearer <token>` header
- If missing/malformed: throw `UnauthorizedError('Authentication required')`
- Verify token via `verifyToken`. On `TokenExpiredError`: throw `UnauthorizedError('Token expired')`. On other JWT error: throw `UnauthorizedError('Invalid token')`
- Fetch user via repository `findById(payload.userId)`
- If user not found or status !== `'ACTIVE'`: throw `UnauthorizedError('Account is not active')`
- Attach `req.user = { id: user.id, role: user.role, email: user.email }` (uses existing Express type extension)
- Call `next()`

**`authorize(...allowedRoles: string[])`** — Middleware factory:
- Returns middleware that checks `req.user.role` is in `allowedRoles`
- If not: throw `ForbiddenError('Insufficient permissions')`
- Call `next()`

### 8. Create Auth Routes

- [ ] `apps/api/src/modules/auth/auth.routes.ts`:

| Method | Path | Auth Required | Validation | Handler |
|--------|------|---------------|------------|---------|
| POST | `/auth/register` | No | `validate(registerSchema)` | `authService.register` |
| POST | `/auth/login` | No | `validate(loginSchema)` | `authService.login` |
| POST | `/auth/refresh` | No | `validate(refreshTokenSchema)` | `authService.refresh` |
| POST | `/auth/logout` | `authenticate` | (body optional) | `authService.logout` |
| POST | `/auth/forgot-password` | No | `validate(forgotPasswordSchema)` | `authService.forgotPassword` |
| POST | `/auth/reset-password` | No | `validate(resetPasswordSchema)` | `authService.resetPassword` |
| GET | `/auth/me` | `authenticate` | — | `authService.getMe` |
| PATCH | `/auth/me` | `authenticate` | `validate(updateProfileSchema)` | `authService.updateProfile` |

- Use `asyncHandler` wrapper on all handlers
- Export `default router`

### 9. Register Auth Routes in App

- [ ] **Modify** `apps/api/src/app.ts`:
  - Import `authRoutes` from `@/modules/auth/auth.routes`
  - Mount at `app.use('/api/v1', authRoutes)` (after health routes, before 404 handler)
  - Middleware order: request-id → CORS → logging → body parsing → health routes → **auth routes** → 404 → error handler

### 10. Verify Build

- [ ] `cd apps/api && npm run typecheck` passes
- [ ] `cd apps/api && npm run lint` passes
- [ ] No `any` or `@ts-ignore` used
- [ ] No Checkpoint 8 scope (rate limiting, security headers, CORS hardening) leaked in
- [ ] No domain module scope (Student, Company, School repositories) created
- [ ] No Prisma schema or migration changes made

---

## Custom Error Codes for Account Status

The existing `ForbiddenError` class always uses code `FORBIDDEN`. For the account status checks on login, the service **must** use the `AppError` base class directly to set distinct error codes:

```typescript
import { AppError, ForbiddenError } from '@/shared/errors/app-error';

// Inside login service:
if (user.status === 'SUSPENDED') {
  throw new AppError('Account suspended', 403, 'ACCOUNT_SUSPENDED');
}
if (user.status === 'PENDING') {
  throw new AppError('Account not verified', 403, 'ACCOUNT_NOT_VERIFIED');
}
```

This does NOT require modifying `app-error.ts` — `AppError` already accepts an optional `code` parameter. No new error subclass is needed.

---

## Forbidden Scope

- ❌ Do NOT implement rate limiting middleware (CHECKPOINT_8)
- ❌ Do NOT implement security headers (CHECKPOINT_8)
- ❌ Do NOT modify CORS configuration beyond current state (CHECKPOINT_8)
- ❌ Do NOT create domain modules (students, companies, internships, applications, schools, admin)
- ❌ Do NOT create domain repositories (student.repository.ts, company.repository.ts, etc.)
- ❌ Do NOT create domain profiles during registration — only the User record
- ❌ Do NOT implement email sending (see Known Gaps)
- ❌ Do NOT modify Prisma schema or create migrations
- ❌ Do NOT deploy to production

---

## Redis Key Summary

| Key Pattern | Type | TTL | Purpose |
|-------------|------|-----|---------|
| `session:{refreshTokenHash}` | String | 7 days | Active refresh session — value `{ userId, role, createdAt }` |
| `user-sessions:{userId}` | Sorted Set | 7 days | Index of active session hashes, scored by timestamp; max 5 newest kept |
| `failed-login:{normalizedEmail}` | String | 15 min | Consecutive failed login counter (value is integer string) |
| `password-reset:{tokenHash}` | String | 15 min | Password reset token — value `{ userId }` |

---

## Known Gaps (Logged in KNOWN_GAPS_REGISTER.md)

1. **Password reset token delivery unavailable:** No email provider is integrated. The `forgotPassword` endpoint generates and stores a token in Redis but has no means to deliver it to the user. For development/testing, a developer must:
   - Generate a known token locally (e.g., `const token = crypto.randomBytes(32).toString('hex')`)
   - Hash it with the same `hashToken` function
   - Write the Redis key manually: `SET password-reset:{tokenHash} '{ "userId": "..." }' EX 900`
   - Then call `POST /auth/reset-password` with `{ "token": "<known-token>", "newPassword": "..." }`
   - This gap is resolved when an email provider is integrated (post-Checkpoint 17 or separate task).

2. **Account verification flow absent:** Registration creates users with `status: PENDING` and `isVerified: false`, but no verification endpoint or email/OTP verification exists in Checkpoint 7. Newly registered users cannot access protected routes (the `authenticate` middleware rejects non-`ACTIVE` users). The system relies on:
   - Admin manually activating accounts (via future admin module)
   - Seed users or admin-created users with status `ACTIVE` can authenticate normally
   - A verification system must be implemented in a future checkpoint

3. **API contract mismatch — register endpoint:** `docs/api/AUTH_ROUTES.md` documents `schoolId` (for STUDENT) and `companyName` (for COMPANY) in the register request body. Checkpoint 7 omits these fields because they belong to domain profile creation. The API contract doc should be updated when those domain modules are implemented.

4. **API contract mismatch — GET /auth/me response:** `docs/api/AUTH_ROUTES.md` documents `profileComplete` and role-specific profile objects (`studentProfile`, `companyProfile`, `schoolProfile`) in the response. Checkpoint 7 returns only base User fields. The API contract doc should be updated when domain modules are implemented.

5. **No tests:** Unit/integration tests for auth service, routes, and middleware are deferred to CHECKPOINT_15 (Tests).

6. **No account lockout on password-reset reuse:** Using an already-consumed reset token is caught (Redis key deleted on use), but no additional back-off is applied.

---

## Acceptance Criteria

- [ ] `POST /auth/register` creates User record only, hashes password, returns user + tokens
- [ ] `POST /auth/register` returns 409 on duplicate email
- [ ] `POST /auth/login` returns 200 with user + tokens on valid credentials
- [ ] `POST /auth/login` returns 401 with `'Invalid email or password'` on wrong credentials (generic; does not reveal email existence)
- [ ] `POST /auth/login` returns `ACCOUNT_SUSPENDED` (403) for suspended accounts
- [ ] `POST /auth/login` returns `ACCOUNT_NOT_VERIFIED` (403) for PENDING accounts
- [ ] `POST /auth/login` returns lockout message (401) after 5 failed attempts within 15 min
- [ ] Successful login resets the failed-attempt counter (DEL in Redis)
- [ ] `POST /auth/refresh` rotates tokens, returns new access + refresh token
- [ ] `POST /auth/refresh` returns 401 for invalid/expired/already-rotated refresh token
- [ ] `POST /auth/logout` invalidates specific session in Redis
- [ ] `POST /auth/logout` (no body) invalidates all sessions for the user
- [ ] `POST /auth/forgot-password` always returns generic success (no email enumeration)
- [ ] `POST /auth/reset-password` updates password and invalidates all sessions
- [ ] `POST /auth/reset-password` returns 401 for invalid/expired token
- [ ] `GET /auth/me` returns authenticated user profile (no passwordHash)
- [ ] `GET /auth/me` returns 401 when no token provided
- [ ] `PATCH /auth/me` updates base User fields (`firstName`, `lastName`, `phone`)
- [ ] `PATCH /auth/me` returns 400 on invalid input (Zod validation)
- [ ] `authenticate` middleware populates `req.user`, returns 401 on invalid/missing token
- [ ] `authorize(['ADMIN'])` returns 403 when user role is STUDENT
- [ ] Sessions stored as `session:{sha256(token)}` with 7-day TTL
- [ ] User-session index uses Redis Sorted Set scored by timestamp
- [ ] Adding a 6th session silently evicts the oldest (ZRANGE + ZREMRANGEBYRANK 0 -6)
- [ ] Failed-login lockout uses `failed-login:{email}` key with 15-min TTL
- [ ] No Redis `KEYS` or `SCAN` commands used
- [ ] Passwords hashed with bcrypt (cost factor 10)
- [ ] JWT contains `userId`, `role`, `email`, `iat`, `exp`
- [ ] No sensitive data (passwords, tokens, PII) logged
- [ ] `npm run typecheck` passes
- [ ] `npm run lint` passes
- [ ] No Prisma schema or migration changes

---

## Estimated Time

6–8 hours
