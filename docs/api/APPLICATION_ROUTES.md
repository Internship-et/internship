# APPLICATION_ROUTES.md

**Base Path:** `/api/v1/applications`

---

## GET /applications

**Description:** List applications (scoped to user role).

**Authentication:** Required

**Authorization:** * (scoped)

### Query Parameters

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `page` | number | 1 | Page number |
| `pageSize` | number | 20 | Items per page |
| `status` | string | — | Filter by status |
| `internshipId` | UUID | — | Filter by internship |
| `sort` | string | `appliedAt` | Sort field |
| `order` | asc/desc | `desc` | Sort order |

### Response

```
200 OK
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "student": {
        "id": "uuid",
        "firstName": "Abebe",
        "lastName": "Kebede",
        "school": { "id": "uuid", "name": "Bole High School" },
        "grade": 11
      },
      "internship": {
        "id": "uuid",
        "title": "Software Engineering Intern",
        "company": { "id": "uuid", "name": "Ethio Tech Solutions" }
      },
      "status": "PENDING",
      "appliedAt": "2024-01-20T10:00:00Z",
      "updatedAt": "2024-01-20T10:00:00Z"
    }
  ],
  "meta": { ... }
}
```

### Scope Rules

- **STUDENT:** Sees only their own applications
- **COMPANY:** Sees applications to their own internships
- **SCHOOL:** Sees applications from their verified students (future)
- **ADMIN:** Sees all applications

---

## GET /applications/:applicationId

**Description:** Get application details.

**Authentication:** Required

**Authorization:** APPLICANT, COMPANY (owner of internship), ADMIN

### Response

```
200 OK
{
  "success": true,
  "data": {
    "id": "uuid",
    "student": {
      "id": "uuid",
      "firstName": "Abebe",
      "lastName": "Kebede",
      "email": "abebe@example.com",
      "phone": "+251911223344",
      "school": { "id": "uuid", "name": "Bole High School" },
      "grade": 11,
      "skills": ["Programming"],
      "resumeUrl": "https://storage.example.com/resume.pdf"
    },
    "internship": {
      "id": "uuid",
      "title": "Software Engineering Intern",
      "company": { "id": "uuid", "name": "Ethio Tech Solutions" }
    },
    "status": "PENDING",
    "coverLetter": "I am writing to express my interest...",
    "additionalInfo": "...",
    "statusHistory": [
      { "from": "PENDING", "to": "REVIEWED", "changedBy": "uuid", "changedAt": "2024-01-25T10:00:00Z" }
    ],
    "appliedAt": "2024-01-20T10:00:00Z",
    "updatedAt": "2024-01-25T10:00:00Z"
  }
}
```

### Business Rules

- Student's contact info (email, phone) is visible to the company
- Company's internal notes are NOT visible to the student
- `statusHistory` is visible to both parties

---

## PATCH /applications/:applicationId/status

**Description:** Update application status.

**Authentication:** Required

**Authorization:** COMPANY (owner of internship), ADMIN

### Request Body

```typescript
{
  status: 'REVIEWED' | 'SHORTLISTED' | 'ACCEPTED' | 'REJECTED';
  note?: string;       // Internal note (max 500 chars)
  message?: string;    // Message to student (optional)
}
```

### Response

```
200 OK
{
  "success": true,
  "data": {
    "id": "uuid",
    "status": "SHORTLISTED",
    "updatedAt": "2024-01-25T10:00:00Z"
  }
}
```

### Business Rules

- Status transitions must follow `STATE_MACHINES.md`
- Student is notified (email) on each status change
- `note` is internal to the company (not shared with student)
- `message` is shared with the student
- Status changes are immutable (history preserved)

### Error Scenarios

| Scenario | HTTP | Code |
|----------|------|------|
| Invalid status transition | 422 | UNPROCESSABLE_ENTITY |
| Application already in final state | 422 | UNPROCESSABLE_ENTITY |

---

## POST /applications/:applicationId/withdraw

**Description:** Withdraw an application.

**Authentication:** Required

**Authorization:** APPLICANT (STUDENT)

### Request Body

```typescript
{
  reason?: string;  // Max 500 chars
}
```

### Response

```
200 OK
{
  "success": true,
  "data": {
    "id": "uuid",
    "status": "WITHDRAWN",
    "updatedAt": "2024-01-25T10:00:00Z"
  }
}
```

### Business Rules

- Student can only withdraw from `PENDING` or `REVIEWED` status
- Company is notified of withdrawal
- Cannot undo withdrawal
- Withdrawn applications are still visible in history
