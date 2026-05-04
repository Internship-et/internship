# ADMIN_ROUTES.md

**Base Path:** `/api/v1/admin`

---

## GET /admin/dashboard

**Description:** Get admin dashboard statistics.

**Authentication:** Required

**Authorization:** ADMIN

### Response

```
200 OK
{
  "success": true,
  "data": {
    "overview": {
      "totalUsers": 1500,
      "totalStudents": 1200,
      "totalCompanies": 200,
      "totalSchools": 80,
      "totalInternships": 350,
      "totalApplications": 2800,
      "activeUsersToday": 45,
      "activeUsersThisWeek": 320
    },
    "recentActivity": {
      "newUsersToday": 12,
      "newInternshipsToday": 5,
      "newApplicationsToday": 28
    },
    "platformMetrics": {
      "applicationsPerInternship": 8.0,
      "fillRate": 0.65,
      "averageTimeToHire": 14.5  // days
    },
    "userGrowth": [
      { "date": "2024-01-01", "count": 100 },
      { "date": "2024-02-01", "count": 350 }
    ]
  }
}
```

---

## GET /admin/users

**Description:** List all users with filtering.

**Authentication:** Required

**Authorization:** ADMIN

### Query Parameters

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `page` | number | 1 | Page number |
| `pageSize` | number | 20 | Items per page |
| `search` | string | — | Search by name or email |
| `role` | string | — | Filter by role |
| `status` | string | — | Filter by account status |
| `isVerified` | boolean | — | Filter by verification status |
| `sort` | string | `createdAt` | Sort field |
| `order` | asc/desc | `desc` | Sort order |

### Response

```
200 OK
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "email": "user@example.com",
      "firstName": "Abebe",
      "lastName": "Kebede",
      "role": "STUDENT",
      "status": "ACTIVE",
      "isVerified": true,
      "createdAt": "2024-01-15T10:30:00Z",
      "lastLoginAt": "2024-02-10T08:00:00Z"
    }
  ],
  "meta": { ... }
}
```

---

## PATCH /admin/users/:userId/status

**Description:** Activate or suspend a user account.

**Authentication:** Required

**Authorization:** ADMIN

### Request Body

```typescript
{
  status: 'ACTIVE' | 'SUSPENDED';
  reason: string;       // Required, max 500 chars
  notifyUser?: boolean; // Default: true
}
```

### Response

```
200 OK
{
  "success": true,
  "data": {
    "userId": "uuid",
    "status": "SUSPENDED",
    "updatedAt": "2024-02-10T10:00:00Z"
  }
}
```

### Business Rules

- Reason is logged in audit trail
- User is notified by default
- Suspended users cannot log in
- Suspended users' content remains accessible
- Admin cannot suspend themselves

---

## GET /admin/audit-logs

**Description:** View system audit logs.

**Authentication:** Required

**Authorization:** ADMIN

### Query Parameters

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `page` | number | 1 | Page number |
| `pageSize` | number | 50 | Items per page |
| `userId` | UUID | — | Filter by user |
| `action` | string | — | Filter by action type |
| `entity` | string | — | Filter by entity type |
| `from` | ISO date | — | Start date |
| `to` | ISO date | — | End date |

### Response

```
200 OK
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "userId": "uuid",
      "userEmail": "admin@example.com",
      "action": "USER_STATUS_CHANGE",
      "entity": "USER",
      "entityId": "uuid",
      "oldValue": { "status": "ACTIVE" },
      "newValue": { "status": "SUSPENDED" },
      "ipAddress": "196.188.xxx.xxx",
      "createdAt": "2024-02-10T10:00:00Z"
    }
  ],
  "meta": { ... }
}
```

---

## GET /admin/reports

**Description:** Generate platform reports.

**Authentication:** Required

**Authorization:** ADMIN

### Query Parameters

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `type` | string | — | Report type: `users`, `internships`, `applications`, `companies`, `schools` |
| `format` | string | `json` | `json` or `csv` |
| `from` | ISO date | 30 days ago | Start date |
| `to` | ISO date | today | End date |

### Response

```
200 OK
{
  "success": true,
  "data": {
    "reportType": "users",
    "generatedAt": "2024-02-10T12:00:00Z",
    "parameters": { "from": "2024-01-11", "to": "2024-02-10" },
    "data": [ ... ]  // Report-specific data
  }
}
```

### Notes

- Report generation may be asynchronous for large datasets (future)
- CSV format returns `Content-Type: text/csv` with appropriate headers
- Reports include generated timestamp for caching
