# VALIDATION_RULES.md

> **Every input is guilty until proven innocent.** This document defines the validation strategy, standards, and implementation.

---

## 1. Validation Layers

Validation happens at **two levels**:

```
Layer 1: Route (Structural Validation)
  - Is the email a valid format?
  - Is the required field present?
  - Is the value within allowed range?
  
Layer 2: Service (Business Validation)
  - Is this email already registered?
  - Is this student eligible for this internship?
  - Is the internship still accepting applications?
```

---

## 2. Structural Validation (Route Layer)

### 2.1 Technology: Zod

All structural validation uses **Zod** schemas. Every request body, query parameter, and path parameter is validated.

### 2.2 Schema Location

Schemas live in the module's schema file:

```
modules/students/student.schema.ts
modules/companies/company.schema.ts
modules/internships/internship.schema.ts
modules/applications/application.schema.ts
modules/schools/school.schema.ts
modules/auth/auth.schema.ts
```

### 2.3 Schema Template

```typescript
// modules/example/example.schema.ts
import { z } from 'zod';

// Create schema
export const createExampleSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100, 'Name too long'),
  email: z.string().email('Invalid email format').max(255),
  age: z.number().int().min(14, 'Must be at least 14').max(24, 'Must be at most 24'),
  role: z.enum(['STUDENT', 'COMPANY', 'SCHOOL', 'ADMIN']),
  tags: z.array(z.string().max(50)).max(10).optional(),
  status: z.enum(['ACTIVE', 'INACTIVE']).default('ACTIVE'),
});

// Update schema (all fields optional)
export const updateExampleSchema = createExampleSchema.partial();

// Query params schema
export const listExampleQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().max(200).optional(),
  status: z.string().optional(),
});

// Types inferred from schemas
export type CreateExampleInput = z.infer<typeof createExampleSchema>;
export type UpdateExampleInput = z.infer<typeof updateExampleSchema>;
```

### 2.4 Validation Middleware

```typescript
// src/shared/middleware/validation.middleware.ts
export function validate(schema: ZodSchema, source: 'body' | 'query' | 'params' = 'body') {
  return (req: Request, res: Response, next: NextFunction) => {
    const result = schema.safeParse(req[source]);
    
    if (!result.success) {
      const details = result.error.issues.map(issue => ({
        field: issue.path.join('.'),
        message: issue.message,
        code: issue.code,
      }));
      
      throw new ValidationError('Invalid input data', details);
    }
    
    // Replace with parsed (and possibly transformed) data
    req[source] = result.data;
    next();
  };
}
```

---

## 3. Business Validation (Service Layer)

Business rules are validated in the service layer:

```typescript
// modules/internships/internship.service.ts
async apply(internshipId: string, studentId: string, data: ApplyInput) {
  // 1. Fetch internship
  const internship = await this.getById(internshipId);
  
  // 2. Business rule: Must be active
  if (internship.status !== 'ACTIVE') {
    throw new UnprocessableError('This internship is no longer accepting applications');
  }
  
  // 3. Business rule: Deadline not passed
  if (internship.deadline && new Date() > new Date(internship.deadline)) {
    throw new UnprocessableError('Application deadline has passed');
  }
  
  // 4. Business rule: No duplicate application
  const existing = await applicationRepository.findByStudentAndInternship(studentId, internshipId);
  if (existing) {
    throw new ConflictError('You have already applied to this internship');
  }
  
  // 5. Business rule: Grade requirement
  if (internship.minGrade && student.grade < internship.minGrade) {
    throw new UnprocessableError('You do not meet the grade requirement for this internship');
  }
  
  // Create application
  return applicationRepository.create({ internshipId, studentId, ...data });
}
```

---

## 4. Validation Rules by Field Type

| Field Type | Rules | Zod Method |
|-----------|-------|------------|
| Email | Valid format, max 255, lowercase | `.email().max(255).transform(v => v.toLowerCase())` |
| Password | Min 8, max 128, at least 1 uppercase + 1 number | `.string().min(8).max(128)` |
| Phone | Ethiopian format (+251...) | Custom regex |
| Name | Max 100 chars, trimmed | `.string().max(100).trim()` |
| Age/Grade | Integer, min 14 (grade 9) to max 24 | `.number().int().min(14).max(24)` |
| UUID | Valid UUID format | `.string().uuid()` |
| URL | Valid URL, max 2048 chars | `.string().url().max(2048)` |
| Text | Max length configurable, trimmed | `.string().max(length).trim()` |
| Enum | Must be one of allowed values | `.enum([...])` |
| Array | Max length, item validation | `.array(itemSchema).max(10)` |
| Boolean | Must be true/false | `.boolean()` |
| Date | Valid ISO date, optional future check | `.string().datetime()` |
| Money | Positive integer (cents) | `.number().int().min(0)` |

---

## 5. Input Sanitization

- **Trim whitespace** — all string inputs are trimmed
- **Strip HTML tags** — from description fields (markdown is allowed, but HTML is stripped)
- **Normalize email** — lowercase before storage
- **Normalize phone** — strip spaces, dashes, ensure +251 format
- **Encode output** — no raw HTML/script in responses

---

## 6. Validation Error Response

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid input data",
    "details": [
      { "field": "email", "message": "Invalid email format", "code": "invalid_string" },
      { "field": "age", "message": "Must be at least 14 years old", "code": "too_small" },
      { "field": "password", "message": "Password must be at least 8 characters", "code": "too_small" }
    ],
    "requestId": "req_abc123"
  }
}
```

---

## 7. What NOT to Validate

- ❌ Data that will be validated in the database (unique constraints, foreign keys) — let the database handle these, but catch and map errors
- ❌ Third-party service responses (validate before use, not after)
- ❌ Internal system data (trusted)

---

*Validate everything. Trust nothing.*
