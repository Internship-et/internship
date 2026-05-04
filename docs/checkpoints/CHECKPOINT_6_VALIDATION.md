# CHECKPOINT 6: Validation Schemas (Zod)

**Prerequisites:** CHECKPOINT_5_CORE_UTILITIES ✅

---

## Goal

Create Zod validation schemas for all modules.

---

## Tasks

### 1. Create Validation Middleware

- [ ] `src/shared/middleware/validation.middleware.ts`:
  - Accepts Zod schema and source ('body' | 'query' | 'params')
  - Parses and validates
  - Returns structured validation errors on failure
  - Replaces `req.body` / `req.query` with parsed data

### 2. Create Auth Schemas

- [ ] `src/modules/auth/auth.schema.ts`:
  - `registerSchema` — email, password, firstName, lastName, role, phone, schoolId, companyName, agreeToTerms
  - `loginSchema` — email, password
  - `refreshTokenSchema` — refreshToken
  - `forgotPasswordSchema` — email
  - `resetPasswordSchema` — token, newPassword

### 3. Create Student Schemas

- [ ] `src/modules/students/student.schema.ts`:
  - `createStudentSchema` / `updateStudentSchema`
  - `listStudentQuerySchema`

### 4. Create Company Schemas

- [ ] `src/modules/companies/company.schema.ts`:
  - `createCompanySchema` / `updateCompanySchema`
  - `listCompanyQuerySchema`

### 5. Create Internship Schemas

- [ ] `src/modules/internships/internship.schema.ts`:
  - `createInternshipSchema` / `updateInternshipSchema`
  - `listInternshipQuerySchema`
  - `applyInternshipSchema`

### 6. Create Application Schemas

- [ ] `src/modules/applications/application.schema.ts`:
  - `updateApplicationStatusSchema`
  - `withdrawApplicationSchema`
  - `listApplicationQuerySchema`

### 7. Create School Schemas

- [ ] `src/modules/schools/school.schema.ts`:
  - `createSchoolSchema` / `updateSchoolSchema`
  - `verifyStudentSchema`

### 8. Create Admin Schemas

- [ ] `src/modules/admin/admin.schema.ts`:
  - `updateUserStatusSchema`
  - `listAuditLogQuerySchema`

---

## Forbidden Scope

- Do NOT implement business logic, services, or repositories
- Do NOT create API routes or controllers
- Do NOT implement auth middleware or JWT logic
- Do NOT create database queries or Prisma logic

---

## Acceptance Criteria

- [ ] All schemas are defined and exported
- [ ] Validation middleware works correctly
- [ ] Invalid data is rejected with structured errors
- [ ] Valid data passes through unchanged
- [ ] TypeScript types are inferred from schemas

---

## Estimated Time

3 hours
