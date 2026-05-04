# API_RESPONSE_CONTRACT.md

> **Every API response must follow this contract.** Frontend and backend agree on this shape.

---

## 1. Response Envelope

Every response (except `204 No Content`) uses this envelope:

```typescript
// Success
{
  success: true,
  data: T,                           // The actual response payload
  meta?: PaginationMeta              // Only for list endpoints
}

// Error
{
  success: false,
  error: {
    code: string,                    // Machine-readable (e.g., "VALIDATION_ERROR")
    message: string,                 // Human-readable
    details?: ValidationDetail[],    // Validation errors
    requestId: string                // Correlation ID
  }
}
```

---

## 2. Type Definitions

```typescript
// Pagination meta (offset-based)
interface OffsetPaginationMeta {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  hasMore: boolean;
}

// Pagination meta (cursor-based)
interface CursorPaginationMeta {
  cursor: string | null;
  limit: number;
  hasMore: boolean;
}

// Validation error detail
interface ValidationDetail {
  field: string;        // The field name (dot notation for nested)
  message: string;      // Human-readable error
  code: string;         // Machine-readable error code
}

// Error body
interface ApiError {
  code: string;
  message: string;
  details?: ValidationDetail[];
  requestId: string;
}
```

---

## 3. Response Examples

### 3.1 Success — Single Resource

```
GET /api/v1/students/abc-123

200 OK
{
  "success": true,
  "data": {
    "id": "abc-123",
    "firstName": "Abebe",
    "lastName": "Kebede",
    "email": "abebe@example.com",
    "phone": "+251911223344",
    "schoolId": "school-456",
    "grade": 11,
    "createdAt": "2024-01-15T10:30:00Z"
  }
}
```

### 3.2 Success — List with Pagination

```
GET /api/v1/internships?page=1&pageSize=10

200 OK
{
  "success": true,
  "data": [
    {
      "id": "intern-001",
      "title": "Software Engineering Intern",
      "companyName": "Ethio Tech Solutions",
      "location": "Addis Ababa",
      "type": "HYBRID",
      "duration": "3 months"
    }
  ],
  "meta": {
    "page": 1,
    "pageSize": 10,
    "total": 47,
    "totalPages": 5,
    "hasMore": true
  }
}
```

### 3.3 Success — Created

```
POST /api/v1/companies

201 Created
{
  "success": true,
  "data": {
    "id": "comp-789",
    "name": "Ethio Tech Solutions",
    "industry": "TECHNOLOGY"
  }
}
```

### 3.4 Success — No Content

```
DELETE /api/v1/internships/old-intern

204 No Content
```

### 3.5 Validation Error

```
POST /api/v1/students
{
  "email": "invalid",
  "age": 12
}

400 Bad Request
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid input data",
    "details": [
      { "field": "email", "message": "Invalid email format", "code": "invalid_string" },
      { "field": "age", "message": "Must be at least 14 years old", "code": "too_small" }
    ],
    "requestId": "req_xyz789"
  }
}
```

### 3.6 Not Found

```
GET /api/v1/internships/non-existent

404 Not Found
{
  "success": false,
  "error": {
    "code": "NOT_FOUND",
    "message": "Internship not found",
    "requestId": "req_abc123"
  }
}
```

### 3.7 Unauthorized

```
GET /api/v1/students/me
(no auth header)

401 Unauthorized
{
  "success": false,
  "error": {
    "code": "UNAUTHORIZED",
    "message": "Authentication required",
    "requestId": "req_def456"
  }
}
```

### 3.8 Forbidden

```
PATCH /api/v1/students/other-student
(as student user, not the owner)

403 Forbidden
{
  "success": false,
  "error": {
    "code": "FORBIDDEN",
    "message": "You do not have permission to modify this resource",
    "requestId": "req_ghi789"
  }
}
```

### 3.9 Rate Limited

```
POST /api/v1/auth/login
(too many requests)

429 Too Many Requests
{
  "success": false,
  "error": {
    "code": "RATE_LIMIT_EXCEEDED",
    "message": "Too many requests. Please try again later.",
    "requestId": "req_jkl012"
  }
}
```

### 3.10 Internal Error

```
GET /api/v1/internships

500 Internal Server Error
{
  "success": false,
  "error": {
    "code": "INTERNAL_ERROR",
    "message": "An unexpected error occurred",
    "requestId": "req_mno345"
  }
}
```

---

## 4. Date/Time Format

- All dates are **ISO 8601** with timezone: `2024-01-15T10:30:00.000Z`
- All dates are in UTC
- Frontend converts to local time for display

---

## 5. ID Format

- All IDs are **UUID v4** strings
- Example: `"550e8400-e29b-41d4-a716-446655440000"`
- IDs are opaque — no business logic should depend on format

---

*This contract is enforced by the error handling middleware and validation layer.*
