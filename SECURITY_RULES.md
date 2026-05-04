# SECURITY_RULES.md

> **Security is not a feature — it is a property of the system.** Every line of code must be written with these rules in mind.

---

## 1. Authentication

### 1.1 Password Requirements

- Passwords **must** be hashed with **bcrypt** (cost factor ≥ 10)
- Minimum password length: **8 characters**
- Maximum password length: **128 characters** (bcrypt truncates at 72)
- Passwords **must not** be logged, stored in plain text, or transmitted in URLs
- Password reset tokens **must** be single-use and expire in 15 minutes

### 1.2 JWT Requirements

- JWTs **must** be signed with **HS256** (or RS256 if asymmetric keys are needed)
- JWT secret **must** be at least 256 bits (32 characters of entropy)
- Access token expiry: **15 minutes**
- Refresh token expiry: **7 days**
- JWTs **must** include: `userId`, `role`, `email`, `iat`, `exp`
- JWTs **must not** include sensitive data (password, phone, address)
- Token refresh **must** invalidate the old refresh token

### 1.3 OTP & Verification

- OTP codes: **6 digits**, numeric only
- OTP expiry: **5 minutes**
- Maximum **3 OTP requests per phone/email per hour**
- OTP **must** be rate-limited by IP address
- OTP **must** be stored as a hash in Redis (never plain text)

---

## 2. Authorization

### 2.1 Role Hierarchy

```
ADMIN > SCHOOL > COMPANY > STUDENT
```

- **ADMIN** — full system access
- **SCHOOL** — can verify students, post school profiles
- **COMPANY** — can post internships, manage applications
- **STUDENT** — can browse internships, apply, manage own profile

### 2.2 Permission Model

| Resource | Create | Read | Update | Delete |
|----------|--------|------|--------|--------|
| Student Profile | SELF | SELF, ADMIN | SELF, ADMIN | ADMIN |
| Company Profile | COMPANY | ALL | OWNER, ADMIN | ADMIN |
| Internship | COMPANY, ADMIN | ALL | OWNER, ADMIN | OWNER, ADMIN |
| Application | STUDENT | SELF, COMPANY, ADMIN | STUDENT (withdraw), COMPANY (status) | ADMIN |
| School Profile | SCHOOL, ADMIN | ALL | OWNER, ADMIN | ADMIN |
| Admin Functions | — | ADMIN | ADMIN | ADMIN |

See `docs/security/AUTHORIZATION_MATRIX.md` for the full matrix.

### 2.3 Ownership Checks

- Every mutation **must** verify the requesting user owns the resource (or has admin role)
- Ownership check **must** happen in the service layer, not the route layer
- Admin override **must** be explicit and logged

---

## 3. Input Validation

- **All** user input **must** be validated with Zod schemas
- Validation happens at two levels:
  1. Structural validation (route middleware)
  2. Business validation (service layer)
- HTML tags **must** be stripped or encoded from text fields
- SQL injection is prevented by Prisma (but raw SQL **must** use parameterized queries)
- File uploads **must** be validated for type, size, and content

See `docs/security/VALIDATION_RULES.md` for the full validation contract.

---

## 4. Rate Limiting

- **All** public endpoints **must** be rate-limited
- Auth endpoints get stricter limits
- Rate limit state **must** be stored in Redis, not in memory
- Rate limit headers **must** be returned with every response

| Endpoint | Window | Max Requests |
|----------|--------|-------------|
| Global default | 15 min | 100 |
| Auth (register, login) | 15 min | 20 |
| Password reset | 15 min | 5 |
| OTP request | 15 min | 3 |
| Application submit | 15 min | 10 |
| Admin | 15 min | 200 |

See `docs/security/RATE_LIMITING_RULES.md`.

---

## 5. Data Protection

### 5.1 PII Handling

- Personally Identifiable Information (PII) includes: name, email, phone, address, date of birth, government ID
- PII **must** be encrypted at rest (database-level encryption)
- PII **must not** be logged in plain text
- PII **must not** be included in JWT tokens
- PII **must** be deletable on user request (right to erasure)

### 5.2 Data Exposure

- API responses **must not** expose: password hashes, internal IDs (use UUIDs), stack traces, database errors, internal IPs
- List endpoints **must** be filtered per user role
- Search results **must** respect visibility rules

---

## 6. Session Management

- Session tokens (refresh tokens) **must** be stored in Redis
- Sessions **must** be invalidated on password change
- Concurrent sessions: maximum **5** per user (enforced via Redis)
- Idle session timeout: **24 hours**
- Absolute session timeout: **30 days**

---

## 7. CORS

- CORS **must** be explicitly configured for allowed origins
- In development: allow `http://localhost:3000` and `http://localhost:5173`
- In staging/production: allow only the specific frontend domain
- Credentials: `true` (cookies for refresh tokens)
- Methods: `GET, POST, PATCH, DELETE, OPTIONS`
- Allowed headers: `Content-Type, Authorization, X-Request-ID`

---

## 8. HTTP Security Headers

Every response **must** include:

```
Strict-Transport-Security: max-age=31536000; includeSubDomains
X-Content-Type-Options: nosniff
X-Frame-Options: DENY
X-XSS-Protection: 1; mode=block
Content-Security-Policy: default-src 'self'
Referrer-Policy: strict-origin-when-cross-origin
Cache-Control: no-store (for authenticated responses)
```

---

## 9. Logging & Auditing

- All authentication events **must** be logged (login, logout, failed login, password reset)
- All authorization failures **must** be logged
- All mutations to sensitive data **must** be audited (who, what, when, old value, new value)
- Audit logs **must** be immutable (append-only)
- Logs **must not** contain: passwords, tokens, PII (see Privacy rules)

See `docs/security/PRIVACY_AND_LOGGING_RULES.md`.

---

## 10. Error Handling

- Error messages **must not** reveal system internals
- 500 errors return a generic message: "An unexpected error occurred"
- Stack traces **must** be logged server-side only
- Validation errors **must** specify which fields failed
- Error responses include `requestId` for correlation

---

## 11. Dependency Security

- `npm audit` **must** pass before any merge to main
- Dependencies **must** be pinned to exact versions (no `^` or `~`)
- Known vulnerable dependencies **must** be updated within 48 hours
- All dependencies **must** be scanned with Snyk or equivalent

---

## 12. Production Security

- Secrets **must** be loaded from environment variables or a secrets manager (e.g., Vault)
- Secrets **must not** be committed to version control
- The server **must** run as a non-root user
- The server **must** be behind a reverse proxy (nginx, Caddy) with TLS termination
- Database access **must** be restricted to the application user only
- All API traffic **must** use HTTPS

---

## 13. Incident Response

- Security incidents **must** be logged in the incident response system
- Breach notification timeline: **72 hours** per GDPR/DPDP
- Incident severity levels:
  - **SEV1** — Data breach, service compromise
  - **SEV2** — Vulnerability discovered, no exploit
  - **SEV3** — Policy violation, misconfiguration

See `docs/operations/INCIDENT_RESPONSE.md`.

---

*These rules are mandatory. Exceptions require written approval from the security lead.*
