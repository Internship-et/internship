# COMPANY_ROUTES.md

**Base Path:** `/api/v1/companies`

---

## GET /companies

**Description:** List all companies (public).

**Authentication:** None

### Query Parameters

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `page` | number | 1 | Page number |
| `pageSize` | number | 20 | Items per page |
| `search` | string | — | Search by name or description |
| `industry` | string | — | Filter by industry |
| `city` | string | — | Filter by city |
| `hasActiveInternships` | boolean | — | Filter by active internship availability |
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
      "name": "Ethio Tech Solutions",
      "industry": "TECHNOLOGY",
      "city": "Addis Ababa",
      "description": "Leading tech company...",
      "logoUrl": "https://storage.example.com/logo.png",
      "activeInternshipCount": 5,
      "website": "https://ethiotech.et"
    }
  ],
  "meta": { ... }
}
```

---

## GET /companies/:companyId

**Description:** Get company profile (public).

**Authentication:** None

### Response

```
200 OK
{
  "success": true,
  "data": {
    "id": "uuid",
    "name": "Ethio Tech Solutions",
    "industry": "TECHNOLOGY",
    "description": "Leading technology company based in Addis Ababa...",
    "logoUrl": "https://storage.example.com/logo.png",
    "website": "https://ethiotech.et",
    "city": "Addis Ababa",
    "address": "Bole Road, 123 Street",
    "size": "MEDIUM",          // STARTUP | SMALL | MEDIUM | LARGE
    "foundedYear": 2020,
    "socialLinks": {
      "linkedin": "https://linkedin.com/company/ethiotech",
      "twitter": "https://twitter.com/ethiotech"
    },
    "activeInternshipCount": 5,
    "totalInternshipsCompleted": 12,
    "createdAt": "2024-01-10T08:00:00Z"
  }
}
```

---

## POST /companies

**Description:** Register a company profile.

**Authentication:** Required

**Authorization:** COMPANY

### Request Body

```typescript
{
  name: string;              // Company name, max 200 chars
  industry: string;          // Industry type
  description: string;       // Company description, max 2000 chars
  city: string;
  address?: string;
  size?: 'STARTUP' | 'SMALL' | 'MEDIUM' | 'LARGE';
  foundedYear?: number;
  website?: string;
  logoUrl?: string;          // Uploaded file URL
  socialLinks?: {
    linkedin?: string;
    twitter?: string;
  };
  tinNumber?: string;        // Tax Identification Number (optional until verification)
}
```

### Response

```
201 Created
{
  "success": true,
  "data": { ... }  // Company profile
}
```

### Business Rules

- One company per user account (for now)
- Company name must be unique
- Company may require admin verification before appearing in public listings
- TIN verification is placeholder for Phase 2

---

## PATCH /companies/:companyId

**Description:** Update company profile.

**Authentication:** Required

**Authorization:** OWNER, ADMIN

### Request Body

*(Same fields as POST, all optional)*

### Response

```
200 OK
{
  "success": true,
  "data": { ... }  // Updated profile
}
```

---

## GET /companies/:companyId/internships

**Description:** List company's internships (public).

**Authentication:** None

### Query Parameters

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `status` | string | `ACTIVE` | Filter by status (ACTIVE, DRAFT, CLOSED) |
| `page` | number | 1 | Page number |
| `pageSize` | number | 20 | Items per page |

### Response

```
200 OK
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "title": "Software Engineering Intern",
      "status": "ACTIVE",
      "deadline": "2024-03-01T00:00:00Z",
      "applicationCount": 12
    }
  ],
  "meta": { ... }
}
```

### Business Rules

- Public viewers see only `ACTIVE` internships (by default)
- Company owner sees all statuses
- `applicationCount` visible only to company owner and admin

---

## GET /companies/:companyId/applications

**Description:** List applications to company's internships.

**Authentication:** Required

**Authorization:** OWNER, ADMIN

### Query Parameters

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `internshipId` | UUID | — | Filter by specific internship |
| `status` | string | — | Filter by application status |
| `page` | number | 1 | Page number |
| `pageSize` | number | 20 | Items per page |
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
        "title": "Software Engineering Intern"
      },
      "status": "PENDING",
      "appliedAt": "2024-01-20T10:00:00Z",
      "resumeUrl": "https://storage.example.com/resume.pdf"
    }
  ],
  "meta": { ... }
}
```
