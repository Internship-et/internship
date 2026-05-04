# STUDENT_ROUTES.md

**Base Path:** `/api/v1/students`

---

## GET /students

**Description:** List all students (admin only).

**Authentication:** Required

**Authorization:** ADMIN

### Query Parameters

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `page` | number | 1 | Page number |
| `pageSize` | number | 20 | Items per page |
| `search` | string | — | Search by name or email |
| `schoolId` | UUID | — | Filter by school |
| `grade` | number | — | Filter by grade |
| `status` | string | — | Filter by account status |
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
      "firstName": "Abebe",
      "lastName": "Kebede",
      "email": "abebe@example.com",
      "phone": "+251911223344",
      "school": { "id": "uuid", "name": "Bole High School" },
      "grade": 11,
      "isVerified": true,
      "applicationCount": 3,
      "createdAt": "2024-01-15T10:30:00Z"
    }
  ],
  "meta": { "page": 1, "pageSize": 20, "total": 150, "totalPages": 8, "hasMore": true }
}
```

---

## GET /students/:studentId

**Description:** Get a specific student's profile.

**Authentication:** Required

**Authorization:** SELF, ADMIN

### Response

```
200 OK
{
  "success": true,
  "data": {
    "id": "uuid",
    "firstName": "Abebe",
    "lastName": "Kebede",
    "email": "abebe@example.com",
    "phone": "+251911223344",
    "bio": "10th grade student at Bole High...",
    "school": { "id": "uuid", "name": "Bole High School" },
    "grade": 11,
    "dateOfBirth": "2008-05-15",
    "skills": ["Programming", "Writing", "Leadership"],
    "interests": ["Technology", "Healthcare"],
    "languages": ["Amharic", "English", "Oromo"],
    "resumeUrl": "https://storage.example.com/resume.pdf",
    "profileImageUrl": "https://storage.example.com/profile.jpg",
    "isVerified": true,
    "completedInternships": 0,
    "createdAt": "2024-01-15T10:30:00Z",
    "updatedAt": "2024-02-01T14:20:00Z"
  }
}
```

### Business Rules

- Public fields (name, school, grade) visible to anyone
- Contact info (email, phone) visible only to SELF, ADMIN, and companies with active applications
- `resumeUrl` visible only to SELF and ADMIN

---

## PATCH /students/:studentId

**Description:** Update student profile.

**Authentication:** Required

**Authorization:** SELF, ADMIN

### Request Body

```typescript
{
  firstName?: string;
  lastName?: string;
  bio?: string;              // Max 500 chars
  grade?: number;            // 9-12
  dateOfBirth?: string;      // ISO date
  skills?: string[];         // Max 10 skills
  interests?: string[];      // Max 10 interests
  languages?: string[];
  phone?: string;
  profileImageUrl?: string;  // Uploaded file URL
  resumeUrl?: string;        // Uploaded file URL
}
```

### Response

```
200 OK
{
  "success": true,
  "data": { ... }  // Updated profile
}
```

---

## GET /students/:studentId/applications

**Description:** List student's applications.

**Authentication:** Required

**Authorization:** SELF, ADMIN

### Query Parameters

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `status` | string | — | Filter by application status |
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
      "internship": {
        "id": "uuid",
        "title": "Software Engineering Intern",
        "company": { "id": "uuid", "name": "Ethio Tech" }
      },
      "status": "PENDING",
      "appliedAt": "2024-01-20T10:00:00Z"
    }
  ],
  "meta": { ... }
}
```

---

## GET /students/:studentId/recommendations

**Description:** Get recommended internships based on student profile.

**Authentication:** Required

**Authorization:** SELF

### Query Parameters

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
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
      "title": "Internship Title",
      "company": { "id": "uuid", "name": "Company" },
      "matchScore": 0.85,
      "location": "Addis Ababa",
      "type": "HYBRID",
      "deadline": "2024-03-01T00:00:00Z"
    }
  ],
  "meta": { ... }
}
```

### Business Rules

- Recommendations are based on student's skills, interests, grade, and location
- *Placeholder:* Recommendation algorithm TBD (initially returns latest internships)
- Excludes internships the student has already applied to
- Excludes internships past their deadline
