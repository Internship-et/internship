# API_CONTRACT.md

> **The definitive contract for all API interactions.** Every endpoint, response format, status code, and error shape is specified here. Frontend and backend must agree to this contract.

---

## 1. Base URL

```
Development: http://localhost:3000/api/v1
Staging:     https://staging-api.internship-platform.et/api/v1
Production:  https://api.internship-platform.et/api/v1
```

## 2. Standard Response Format

### 2.1 Success Response

```typescript
{
  success: true,
  data: T,                    // The response payload
  meta?: {
    page?: number,
    pageSize?: number,
    total?: number,
    hasMore?: boolean,
    cursor?: string
  }
}
```

### 2.2 Error Response

```typescript
{
  success: false,
  error: {
    code: string,             // Machine-readable error code
    message: string,          // Human-readable message (i18n key)
    details?: unknown,        // Validation errors array
    requestId: string         // Correlation ID for debugging
  }
}
```

### 2.3 Pagination Meta

For list endpoints, the `meta` object includes:
```typescript
{
  page: number,              // Current page (1-indexed)
  pageSize: number,          // Items per page
  total: number,             // Total items matching query
  hasMore: boolean,          // Whether more pages exist
  // OR for cursor-based:
  cursor: string | null,     // Next cursor (null if last page)
  hasMore: boolean
}
```

---

## 3. Standard Status Codes

| Method | Success | Created | No Content | Bad Request | Unauthorized | Forbidden | Not Found | Conflict | Too Many | Server Error |
|--------|---------|---------|------------|-------------|--------------|-----------|-----------|----------|----------|--------------|
| GET    | 200     | —       | —          | 400         | 401          | 403       | 404       | —        | 429      | 500          |
| POST   | 200     | 201     | —          | 400         | 401          | 403       | 404       | 409      | 429      | 500          |
| PATCH  | 200     | —       | —          | 400         | 401          | 403       | 404       | 409      | 429      | 500          |
| PUT    | 200     | —       | —          | 400         | 401          | 403       | 404       | 409      | 429      | 500          |
| DELETE | 200     | —       | 204        | 400         | 401          | 403       | 404       | 409      | 429      | 500          |

---

## 4. Standard Headers

### 4.1 Request Headers

| Header | Required | Description |
|--------|----------|-------------|
| `Authorization` | For protected routes | `Bearer <jwt_token>` |
| `Content-Type` | For POST/PATCH/PUT | `application/json` |
| `Accept-Language` | No | Language preference (en, am, om, etc.) |
| `X-Request-ID` | No | Client-generated request ID |

### 4.2 Response Headers

| Header | Description |
|--------|-------------|
| `X-Request-ID` | The request's correlation ID |
| `X-RateLimit-Limit` | Max requests per window |
| `X-RateLimit-Remaining` | Remaining requests in current window |
| `X-RateLimit-Reset` | Timestamp when rate limit resets |
| `X-Response-Time` | Server processing time in ms |

---

## 5. API Endpoints Overview

### 5.1 Authentication

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/auth/register` | No | Register a new user |
| POST | `/auth/login` | No | Login |
| POST | `/auth/refresh` | No | Refresh JWT token |
| POST | `/auth/logout` | Yes | Invalidate session |
| POST | `/auth/forgot-password` | No | Request password reset |
| POST | `/auth/reset-password` | No | Reset password with token |
| GET | `/auth/me` | Yes | Get current user profile |
| PATCH | `/auth/me` | Yes | Update own profile |

### 5.2 Students

| Method | Path | Auth | Role | Description |
|--------|------|------|------|-------------|
| GET | `/students` | Yes | ADMIN | List all students (paginated) |
| GET | `/students/:studentId` | Yes | * | Get student profile |
| PATCH | `/students/:studentId` | Yes | SELF, ADMIN | Update student profile |
| GET | `/students/:studentId/applications` | Yes | SELF, ADMIN | List student's applications |
| GET | `/students/:studentId/recommendations` | Yes | SELF | Get recommended internships |

### 5.3 Companies

| Method | Path | Auth | Role | Description |
|--------|------|------|------|-------------|
| GET | `/companies` | No | — | List companies (public) |
| GET | `/companies/:companyId` | No | — | Get company profile (public) |
| POST | `/companies` | Yes | COMPANY | Register company profile |
| PATCH | `/companies/:companyId` | Yes | OWNER, ADMIN | Update company |
| GET | `/companies/:companyId/internships` | No | — | List company's internships |
| GET | `/companies/:companyId/applications` | Yes | OWNER, ADMIN | List applications to company's internships |

### 5.4 Internships

| Method | Path | Auth | Role | Description |
|--------|------|------|------|-------------|
| GET | `/internships` | No | — | List internships (paginated, filterable) |
| GET | `/internships/:internshipId` | No | — | Get internship details |
| POST | `/internships` | Yes | COMPANY, ADMIN | Create internship |
| PATCH | `/internships/:internshipId` | Yes | OWNER, ADMIN | Update internship |
| DELETE | `/internships/:internshipId` | Yes | OWNER, ADMIN | Close internship |
| POST | `/internships/:internshipId/apply` | Yes | STUDENT | Apply for internship |

### 5.5 Applications

| Method | Path | Auth | Role | Description |
|--------|------|------|------|-------------|
| GET | `/applications` | Yes | * | List applications (scoped to role) |
| GET | `/applications/:applicationId` | Yes | * | Get application details |
| PATCH | `/applications/:applicationId/status` | Yes | COMPANY, ADMIN | Update application status |
| POST | `/applications/:applicationId/withdraw` | Yes | STUDENT | Withdraw application |

### 5.6 Schools

| Method | Path | Auth | Role | Description |
|--------|------|------|------|-------------|
| GET | `/schools` | No | — | List schools (public) |
| GET | `/schools/:schoolId` | No | — | Get school profile |
| POST | `/schools` | Yes | SCHOOL, ADMIN | Register school |
| PATCH | `/schools/:schoolId` | Yes | OWNER, ADMIN | Update school |
| POST | `/schools/:schoolId/verify-student` | Yes | SCHOOL | Verify student enrollment |

### 5.7 Admin

| Method | Path | Auth | Role | Description |
|--------|------|------|------|-------------|
| GET | `/admin/dashboard` | Yes | ADMIN | Dashboard statistics |
| GET | `/admin/users` | Yes | ADMIN | List all users |
| PATCH | `/admin/users/:userId/status` | Yes | ADMIN | Activate/suspend user |
| GET | `/admin/audit-logs` | Yes | ADMIN | View audit logs |
| GET | `/admin/reports` | Yes | ADMIN | Generate reports |

### 5.8 Health

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/health` | No | Health check (returns DB, Redis, uptime status) |
| GET | `/health/ready` | No | Readiness probe |
| GET | `/health/live` | No | Liveness probe |

---

## 6. Query Parameters for List Endpoints

### 6.1 Pagination

```
?page=1&pageSize=20          (offset-based)
?cursor=abc123&limit=20      (cursor-based, preferred)
```

### 6.2 Filtering

```
?status=ACTIVE               (exact match)
&search=software             (text search)
&tags[]=tech&tags[]=remote   (array filter)
&minDuration=4               (range filter)
&maxDuration=12              (range filter)
```

### 6.3 Sorting

```
?sort=createdAt              (field to sort by)
&order=desc                  (asc or desc, default desc)
```

### 6.4 Field Selection

```
?fields=id,title,companyName  (comma-separated field list)
```

---

## 7. Rate Limiting

| Endpoint Group | Window | Max Requests |
|---------------|--------|-------------|
| Public endpoints | 15 min | 100 |
| Auth endpoints | 15 min | 20 |
| Application submission | 15 min | 10 |
| Admin endpoints | 15 min | 200 |

See `docs/security/RATE_LIMITING_RULES.md` for the detailed rate limiting contract.

---

## 8. Versioning

- API version is in the URL path: `/api/v1/...`
- Breaking changes require a new version (`/api/v2/...`)
- Non-breaking changes (adding fields) do not require version bump
- Deprecated endpoints include `Sunset` header with removal date

---

## 9. Content Negotiation

- The API only supports `application/json`
- Request body must be `application/json` for POST/PATCH/PUT
- Future: `application/json; charset=utf-8` with multi-language support

---

*This contract is binding. Frontend and backend must both adhere to it.*
