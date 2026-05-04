# THREAT_MODEL.md

> **Threat modeling for the Ethiopian High School Internship Platform.** This document identifies threats, assesses risks, and defines mitigations.

---

## 1. Methodology

This threat model uses the **STRIDE** framework:
- **S**poofing — Impersonating another user or system
- **T**ampering — Modifying data without authorization
- **R**epudiation — Denying an action without proof
- **I**nformation Disclosure — Exposing data to unauthorized parties
- **D**enial of Service — Making the system unavailable
- **E**levation of Privilege — Gaining unauthorized access

---

## 2. Assets

| Asset | Sensitivity | Description |
|-------|-------------|-------------|
| User credentials | CRITICAL | Passwords, password hashes |
| JWT secrets | CRITICAL | Token signing keys |
| PII (student data) | HIGH | Names, emails, phones, addresses, DOB |
| Application data | MEDIUM | Internship applications, statuses |
| Company data | MEDIUM | Company profiles, contact info |
| Audit logs | MEDIUM | Immutable record of actions |
| Session tokens | HIGH | Active session identifiers |
| OTP codes | HIGH | One-time passwords for verification |
| Database credentials | CRITICAL | PostgreSQL connection strings |
| API keys | CRITICAL | External service credentials |

---

## 3. Threats & Mitigations

### 3.1 Spoofing

| Threat | Risk | Mitigation |
|--------|------|------------|
| Attacker uses stolen JWT | HIGH | Short-lived tokens (15 min), refresh token rotation |
| Attacker guesses password | HIGH | Rate limiting, bcrypt hashing, lockout after 5 attempts |
| Attacker replays old JWT | MEDIUM | Include `iat` and `exp` claims, check expiry server-side |
| Attacker forges OTP | HIGH | Store OTP as hash, limit attempts (3 max), expiry (5 min) |
| Attacker uses another user's refresh token | HIGH | Token binding (user agent fingerprint), rotation |

### 3.2 Tampering

| Threat | Risk | Mitigation |
|--------|------|------------|
| Attacker modifies application status | HIGH | Ownership checks, state machine validation |
| Attacker modifies another user's profile | HIGH | Ownership checks, authorization middleware |
| Attacker modifies internship data | HIGH | Ownership checks (company owns their internships) |
| Attacker modifies audit logs | MEDIUM | Append-only logs, database-level read-only for logs |
| Man-in-the-middle modifies request | MEDIUM | HTTPS everywhere, HSTS headers |

### 3.3 Repudiation

| Threat | Risk | Mitigation |
|--------|------|------------|
| User denies submitting application | MEDIUM | Audit log with timestamp, user ID, IP address |
| Admin denies suspending a user | MEDIUM | Audit log with admin identity, reason, timestamp |
| Company denies rejecting an applicant | LOW | Status history with user ID and timestamp |

### 3.4 Information Disclosure

| Threat | Risk | Mitigation |
|--------|------|------------|
| PII leak via API response | HIGH | Field-level filtering by role, never expose sensitive fields |
| Stack trace in error response | HIGH | Global error handler strips stack traces |
| Database error details exposed | HIGH | Global error handler catches and sanitizes |
| User enumeration via login | MEDIUM | Return same error for "user not found" and "wrong password" |
| Timing attack on login | LOW | Use constant-time comparison for passwords (bcrypt handles this) |
| Logs containing PII | HIGH | Structured logging, never log passwords/tokens/PII |

### 3.5 Denial of Service

| Threat | Risk | Mitigation |
|--------|------|------------|
| Brute force login attempts | MEDIUM | Rate limiting (20 req/15 min), account lockout |
| API endpoint flooding | MEDIUM | Rate limiting per IP, per endpoint |
| Database query overload | MEDIUM | Query timeouts, connection pooling, pagination |
| Resource exhaustion (file upload) | LOW | File size limits, type validation |
| Redis memory exhaustion | LOW | Max memory config, LRU eviction |

### 3.6 Elevation of Privilege

| Threat | Risk | Mitigation |
|--------|------|------------|
| Student accesses admin endpoints | HIGH | Role-based authorization middleware |
| Company modifies another company's data | HIGH | Ownership checks on all mutations |
| User modifies JWT role claim | HIGH | JWT is signed and verified server-side |
| SQL injection to read unauthorized data | MEDIUM | Prisma parameterized queries (raw SQL only with params) |

---

## 4. Trust Boundaries

```
[Internet] → [CDN/Reverse Proxy] → [Express API] → [PostgreSQL]
                                          ↓
                                     [Redis]
                                          ↓
                                     [External Providers]
```

Boundary 1: Internet → Reverse Proxy (TLS, rate limiting, WAF)
Boundary 2: Reverse Proxy → Express (internal network only)
Boundary 3: Express → PostgreSQL (database user with least privileges)
Boundary 4: Express → Redis (network-isolated, with password)
Boundary 5: Express → External Providers (API keys, rate limited)

---

## 5. Data Flow: Authentication

```
User → POST /auth/login → Rate Limiter → Validate Input → 
  → Find User → Verify Password (bcrypt) → Check Status → 
  → Generate JWT → Store Session (Redis) → Return Tokens
```

Threats at each step:
1. Rate limit bypass → Redis-based rate limiting with IP tracking
2. Password brute force → Bcrypt cost factor 10, account lockout
3. JWT forgery → HS256 with strong secret (32+ chars)
4. Session hijack → Short-lived access token, rotated refresh token

---

## 6. Data Flow: Application Submission

```
Student → POST /internships/:id/apply → Authenticate → Authorize (STUDENT) →
  → Validate Input → Check Duplicate → Check Internship Status →
  → Check Deadline → Create Application → Audit Log → Notify Company
```

Threats at each step:
1. Unauthorized access → JWT auth + STUDENT role check
2. Duplicate application → Database unique constraint
3. Race condition → Database transaction or unique constraint
4. Stale data → Read internship status within transaction

---

*Threat model is reviewed quarterly. Update as new features are added.*
