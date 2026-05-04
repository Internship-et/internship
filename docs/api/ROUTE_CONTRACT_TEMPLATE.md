# ROUTE_CONTRACT_TEMPLATE.md

> **Template for documenting individual route contracts.** Use this template for every module's route documentation.

---

## Module: [Module Name]

**Base Path:** `/api/v1/[module-path]`

---

## Endpoint Template

### `METHOD /path`

**Description:** One-line description of what this endpoint does.

**Authentication:** Required | Optional | None

**Authorization:** [Role(s)] — Who can access this endpoint

**Rate Limit:** [Optional: override description]

---

### Request

**Path Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `id` | UUID | Yes | Resource identifier |

**Query Parameters:**

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `page` | number | No | 1 | Page number (offset pagination) |
| `pageSize` | number | No | 20 | Items per page |
| `cursor` | string | No | — | Cursor for cursor-based pagination |
| `sort` | string | No | `createdAt` | Sort field |
| `order` | `asc` \| `desc` | No | `desc` | Sort order |

**Request Body (for POST/PATCH/PUT):**

```typescript
{
  // Zod schema reference or inline type
}
```

---

### Response

**Status Codes:**

| Code | Description |
|------|-------------|
| 200 | Success |
| 201 | Created (for POST) |
| 400 | Validation error |
| 401 | Unauthorized |
| 403 | Forbidden |
| 404 | Not found |
| 409 | Conflict |
| 429 | Rate limit exceeded |
| 500 | Internal error |

**Success Response Body:**

```json
{
  "success": true,
  "data": {
    // Response fields
  }
}
```

**Error Response Body:**

```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "Human-readable message",
    "details": [],
    "requestId": "req_abc123"
  }
}
```

---

### Examples

**Request:**
```
METHOD /api/v1/[path]/:id
Authorization: Bearer <token>
Content-Type: application/json

{
  "field": "value"
}
```

**Response:**
```
200 OK
{
  "success": true,
  "data": { ... }
}
```

---

### Business Rules

- Rule 1
- Rule 2

### Error Scenarios

| Scenario | HTTP | Code |
|----------|------|------|
| Scenario description | 404 | NOT_FOUND |
| Scenario description | 409 | CONFLICT |

---

*Use this template for all route documentation files.*
