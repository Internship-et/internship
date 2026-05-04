# INTERNSHIP_ROUTES.md

**Base Path:** `/api/v1/internships`

---

## GET /internships

**Description:** List internships with search and filters (public).

**Authentication:** None

### Query Parameters

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `page` | number | 1 | Page number |
| `pageSize` | number | 20 | Items per page |
| `cursor` | string | — | Cursor for cursor-based pagination |
| `search` | string | — | Search by title, description, or company name |
| `companyId` | UUID | — | Filter by company |
| `industry` | string | — | Filter by industry |
| `city` | string | — | Filter by location city |
| `type` | string | — | Filter by type (ON_SITE, REMOTE, HYBRID) |
| `minDuration` | number | — | Minimum duration in months |
| `maxDuration` | number | — | Maximum duration in months |
| `minGrade` | number | — | Minimum required grade level |
| `maxGrade` | number | — | Maximum required grade level |
| `tags` | string[] | — | Filter by tags |
| `sort` | string | `createdAt` | Sort field |
| `order` | asc/desc | `desc` | Sort order |
| `fields` | string | — | Comma-separated field list |

### Response

```
200 OK
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "title": "Software Engineering Intern",
      "company": {
        "id": "uuid",
        "name": "Ethio Tech Solutions",
        "logoUrl": "https://storage.example.com/logo.png"
      },
      "location": {
        "city": "Addis Ababa",
        "address": "Bole Road"
      },
      "type": "HYBRID",
      "duration": "3 months",
      "durationMonths": 3,
      "status": "ACTIVE",
      "deadline": "2024-03-01T00:00:00Z",
      "description": "We are looking for...",
      "requirements": ["Basic programming knowledge", "Grade 10+"],
      "tags": ["Technology", "Software", "Entry Level"],
      "stipend": {
        "amount": 3000,
        "currency": "ETB",
        "period": "MONTHLY"
      },
      "applicantCount": 12,
      "createdAt": "2024-01-15T10:30:00Z"
    }
  ],
  "meta": {
    "cursor": "eyJpZCI6ImludGVybi0wMDEifQ==",
    "limit": 20,
    "hasMore": true
  }
}
```

### Business Rules

- Only `ACTIVE` internships are returned for unauthenticated users
- Draft/closed internships are filtered out
- `applicantCount` is approximate (cached, not real-time)

---

## GET /internships/:internshipId

**Description:** Get internship details (public).

**Authentication:** None

### Response

```
200 OK
{
  "success": true,
  "data": {
    "id": "uuid",
    "title": "Software Engineering Intern",
    "company": {
      "id": "uuid",
      "name": "Ethio Tech Solutions",
      "logoUrl": "https://storage.example.com/logo.png",
      "industry": "TECHNOLOGY"
    },
    "description": "Full description of the internship...",
    "responsibilities": ["Develop web applications", "Write tests"],
    "requirements": ["Grade 10+", "Basic programming knowledge"],
    "preferredSkills": ["JavaScript", "Python"],
    "type": "HYBRID",
    "location": {
      "city": "Addis Ababa",
      "address": "Bole Road 123"
    },
    "duration": "3 months",
    "durationMonths": 3,
    "weeklyHours": 20,
    "startDate": "2024-06-01",
    "deadline": "2024-03-01T00:00:00Z",
    "stipend": {
      "amount": 3000,
      "currency": "ETB",
      "period": "MONTHLY"
    },
    "benefits": ["Mentorship", "Certificate", "Lunch provided"],
    "tags": ["Technology", "Software"],
    "status": "ACTIVE",
    "applicationCount": 12,
    "createdAt": "2024-01-15T10:30:00Z",
    "updatedAt": "2024-02-01T14:20:00Z"
  }
}
```

---

## POST /internships

**Description:** Create a new internship listing.

**Authentication:** Required

**Authorization:** COMPANY, ADMIN

### Request Body

```typescript
{
  title: string;                    // Max 200 chars
  description: string;              // Max 5000 chars, markdown supported
  responsibilities?: string[];      // Max 10 items
  requirements: string[];           // Min 1, max 10 items
  preferredSkills?: string[];
  type: 'ON_SITE' | 'REMOTE' | 'HYBRID';
  city: string;
  address?: string;
  durationMonths: number;           // 1-12
  weeklyHours?: number;             // 5-40
  startDate?: string;               // ISO date
  deadline?: string;                // ISO datetime (default: 30 days from now)
  stipend?: {
    amount: number;                 // In ETB cents (or integer Birr based on convention)
    currency: string;               // Default: "ETB"
    period: 'MONTHLY' | 'ONCE' | 'WEEKLY';
  };
  benefits?: string[];              // Max 10 items
  tags?: string[];
  minGrade?: number;                // 9-12
  maxGrade?: number;                // 9-12
}
```

### Response

```
201 Created
{
  "success": true,
  "data": { ... }  // Full internship object
}
```

### Business Rules

- Created in `DRAFT` status by default
- Must be explicitly published to be visible
- Company can only create internships for their own company

---

## PATCH /internships/:internshipId

**Description:** Update internship listing.

**Authentication:** Required

**Authorization:** OWNER, ADMIN

### Request Body

*(Same fields as POST, all optional)*

### Response

```
200 OK
{
  "success": true,
  "data": { ... }  // Updated internship
}
```

### Business Rules

- Cannot edit after status is `CLOSED`
- Cannot edit if applications exist (to maintain integrity) — or allow edits with restrictions

---

## DELETE /internships/:internshipId

**Description:** Close (not hard-delete) an internship.

**Authentication:** Required

**Authorization:** OWNER, ADMIN

### Response

```
204 No Content
```

### Business Rules

- This is a soft delete (status changes to `CLOSED`)
- Cannot delete if there are accepted applications (must be resolved first)
- Data is preserved for reference

---

## POST /internships/:internshipId/apply

**Description:** Apply for an internship.

**Authentication:** Required

**Authorization:** STUDENT

### Request Body

```typescript
{
  coverLetter?: string;        // Max 2000 chars
  additionalInfo?: string;     // Max 1000 chars
}
```

### Response

```
201 Created
{
  "success": true,
  "data": {
    "id": "uuid",
    "internshipId": "uuid",
    "studentId": "uuid",
    "status": "PENDING",
    "appliedAt": "2024-01-20T10:00:00Z"
  }
}
```

### Business Rules

- Student can only apply once per internship (duplicate check)
- Internship must be in `ACTIVE` status
- Application deadline must not have passed
- Student must have a complete profile (resume uploaded, grade set)
- School verification may be required (placeholder)
