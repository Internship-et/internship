# PUBLIC_ENDPOINT_ABUSE_RULES.md

> **Public endpoints are the most vulnerable to abuse.** This document defines protections for unauthenticated endpoints.

---

## 1. List of Public Endpoints

The following endpoints require no authentication:

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/auth/register` | POST | User registration |
| `/auth/login` | POST | User login |
| `/auth/refresh` | POST | Token refresh |
| `/auth/forgot-password` | POST | Password reset request |
| `/auth/reset-password` | POST | Password reset |
| `/internships` | GET | List internships |
| `/internships/:id` | GET | Get internship details |
| `/companies` | GET | List companies |
| `/companies/:id` | GET | Get company details |
| `/companies/:id/internships` | GET | List company internships |
| `/schools` | GET | List schools |
| `/schools/:id` | GET | Get school details |
| `/health` | GET | Health check |
| `/health/ready` | GET | Readiness probe |
| `/health/live` | GET | Liveness probe |

---

## 2. Abuse Vectors

### 2.1 Web Scraping

**Threat:** Automated scripts scrape all internship/company data.

**Mitigation:**
- Rate limiting (100 req/15 min per IP)
- Cursor-based pagination (slows sequential scraping)
- Data is public by design (scraping is tolerated but rate-limited)
- Future: CAPTCHA on excessive requests from same IP

### 2.2 Account Creation Flooding

**Threat:** Automated scripts create thousands of fake accounts.

**Mitigation:**
- Rate limiting (20 req/15 min per IP)
- Email verification required before activation
- Rate limit by IP + email domain
- CAPTCHA (future)

### 2.3 Brute Force Login

**Threat:** Automated password guessing against known emails.

**Mitigation:**
- Rate limiting (20 req/15 min per IP)
- Account lockout after 5 failed attempts (15 min)
- Bcrypt cost factor 10 (slow hashing)
- Return generic error (don't reveal if email exists)

### 2.4 OTP Bombing

**Threat:** Repeated OTP requests to spam a phone number.

**Mitigation:**
- Rate limit: 3 OTP requests per phone/email per hour
- Rate limit by IP (5 requests per 15 min)
- OTP expiry: 5 minutes (limited window for abuse)

### 2.5 Reconnaissance

**Threat:** Probing endpoints to discover valid IDs, user existence, etc.

**Mitigation:**
- UUIDs (non-sequential, cannot be guessed)
- Consistent error messages (don't reveal whether resource exists or user exists)
- Rate limiting blunts automated probing

---

## 3. Public Data Visibility

Even though these endpoints are public, they expose only **intentionally public** data:

- Internship listings: title, company name, location, description (no applicant PII)
- Company listings: company name, industry, description (no employee PII)
- School listings: school name, city, type (no student PII)

---

## 4. Enforcement

All protections are enforced via:
1. **Rate limiting middleware** — first line of defense
2. **Validation middleware** — rejects malformed requests
3. **Service layer** — business rule validation
4. **Error handler** — consistent, non-revealing errors

---

*Public does not mean unprotected.*
