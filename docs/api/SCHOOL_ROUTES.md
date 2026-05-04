# SCHOOL_ROUTES.md

**Base Path:** `/api/v1/schools`

---

## GET /schools

**Description:** List all schools (public).

**Authentication:** None

### Query Parameters

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `page` | number | 1 | Page number |
| `pageSize` | number | 20 | Items per page |
| `search` | string | — | Search by name or city |
| `city` | string | — | Filter by city |
| `sort` | string | `name` | Sort field |
| `order` | asc/desc | `asc` | Sort order |

### Response

```
200 OK
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "name": "Bole High School",
      "city": "Addis Ababa",
      "type": "PUBLIC",
      "studentCount": 1200,
      "verifiedStudentCount": 45
    }
  ],
  "meta": { ... }
}
```

---

## GET /schools/:schoolId

**Description:** Get school profile (public).

**Authentication:** None

### Response

```
200 OK
{
  "success": true,
  "data": {
    "id": "uuid",
    "name": "Bole High School",
    "type": "PUBLIC",          // PUBLIC | PRIVATE | GOVERNMENT
    "city": "Addis Ababa",
    "address": "Bole Sub-city, Kebele 14",
    "phone": "+251111234567",
    "email": "info@bolehigh.edu.et",
    "website": "https://bolehigh.edu.et",
    "principal": "Tadesse Alemu",
    "gradesOffered": [9, 10, 11, 12],
    "studentCount": 1200,
    "verifiedStudentCount": 45,
    "logoUrl": "https://storage.example.com/school-logo.png",
    "createdAt": "2024-01-15T10:30:00Z"
  }
}
```

---

## POST /schools

**Description:** Register a school profile.

**Authentication:** Required

**Authorization:** SCHOOL, ADMIN

### Request Body

```typescript
{
  name: string;                    // Max 200 chars
  type: 'PUBLIC' | 'PRIVATE' | 'GOVERNMENT';
  city: string;
  address?: string;
  phone?: string;
  email?: string;
  website?: string;
  principal?: string;
  gradesOffered?: number[];       // [9, 10, 11, 12]
  logoUrl?: string;
  licenseNumber?: string;         // Ministry of Education license number
}
```

### Response

```
201 Created
{
  "success": true,
  "data": { ... }
}
```

### Business Rules

- School name must be unique
- School may require admin verification
- License number verification is placeholder

---

## PATCH /schools/:schoolId

**Description:** Update school profile.

**Authentication:** Required

**Authorization:** OWNER, ADMIN

### Request Body

*(Same fields as POST, all optional)*

### Response

```
200 OK
{
  "success": true,
  "data": { ... }
}
```

---

## POST /schools/:schoolId/verify-student

**Description:** Verify a student's enrollment at the school.

**Authentication:** Required

**Authorization:** SCHOOL (owner), ADMIN

### Request Body

```typescript
{
  studentId: string;       // UUID of the student
  isEnrolled: boolean;     // true = verified enrolled, false = mark as not enrolled
  grade?: number;          // 9-12, required if isEnrolled is true
  graduationYear?: number; // Expected graduation year
  notes?: string;          // Admin notes
}
```

### Response

```
200 OK
{
  "success": true,
  "data": {
    "studentId": "uuid",
    "schoolId": "uuid",
    "isVerified": true,
    "grade": 11,
    "verifiedAt": "2024-01-25T10:00:00Z",
    "verifiedBy": "school-user-uuid"
  }
}
```

### Business Rules

- School can only verify students who have listed them as their school
- Verification is logged and audited
- Verified status is shown on student's profile
- Some internships may require verified enrollment
- Verification can be revoked by the school or admin
