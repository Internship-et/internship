# CHECKPOINT 9: Students Module

**Prerequisites:** CHECKPOINT_8_RATE_LIMITING ✅

---

## Goal

Implement the Student module: student profile CRUD, profile visibility rules, student application listing, and admin listing.

---

## Tasks

### 1. Create Student Repository

- `src/modules/students/student.repository.ts`:
  - `findAll(filters)` — admin listing with search, filter, pagination, and sort. Includes `user` and `school` relations.
  - `findById(id)` — find by student profile ID (UUID), includes `user` and `school` relations
  - `findByUserId(userId)` — find student profile by `user.id` (one-to-one relationship); used for ownership checks and `GET /students/me` lookups
  - `create(data)` — create a new student profile record for a user; `data` includes `userId` and student-specific fields. Empty array fields (`skills`, `interests`, `languages`) default to `[]`.
  - `update(id, data)` — update **Student-only** fields (bio, grade, dateOfBirth, skills, interests, languages, profileImageUrl, resumeUrl, schoolId). Does NOT touch the User table.
  - `count(filters)` — total count for pagination meta
  - `findApplicationsByStudentId(studentId, filters)` — read-only query on Application model. Returns paginated applications with `include: { internship: { include: { company: true } } }`. Implements offset pagination via `skip`/`take` and optional `status` filter.
  - `countApplicationsByStudentId(studentId, filters)` — count of applications matching the same filters, used for pagination meta.
  - `upsertUserAndStudent(userId, userData, studentData)` — **transactional** dual-table write:
    - Wraps User update (`prisma.user.update`) and Student create/update (`prisma.student.upsert`) in a single `prisma.$transaction()`
    - If User update succeeds but Student upsert fails, the entire transaction rolls back
    - If no User fields changed (`userData` is empty), only the Student upsert runs
    - Returns the complete result (User + Student with relations)

### 2. Create Student Service

- `src/modules/students/student.service.ts`:
  - `list(filters)` — admin-only paginated listing with search, filter by school/grade/status, sort
  - `getById(id, requestingUserId, requestingUserRole)` — single profile:
    - Authorization: **SELF (student.userId === requestingUserId) or ADMIN only**
    - Throws `NotFoundError` if student does not exist
    - Throws `ForbiddenError` if requester is neither SELF nor ADMIN
    - `email`, `phone` (User fields) and `resumeUrl` (Student field) visible only to SELF or ADMIN
    - All other fields visible to authorized caller
  - `getMyProfile(userId)` — shortcut for SELF: looks up student profile by `userId`, returns full profile with all fields
  - `upsertMyProfile(userId, userRole, data)` — self-upsert for `PATCH /students/me`:
    - **Role gate**: Only users with `role === 'STUDENT'` may create/update a self Student profile. COMPANY, SCHOOL, and ADMIN roles are rejected with `ForbiddenError`.
    - **First-time setup**: If no Student profile exists for this user:
      - Validates that `userId` matches the authenticated user and `role` is STUDENT
      - Calls repository's `upsertUserAndStudent` in a transaction, passing User fields (firstName, lastName, phone) and Student fields (bio, grade, dateOfBirth, skills, interests, languages, profileImageUrl, resumeUrl, schoolId)
      - Missing array fields (`skills`, `interests`, `languages`) default to `[]`
    - **Subsequent updates**: If a Student profile already exists, updates both User and Student tables via the same transactional method
    - **Return value**: Returns `{ profile, created }` where `profile` is the full Student profile (with User and School relations) and `created` is a boolean — `true` when a new Student profile was created, `false` when an existing one was updated. The route handler uses `created` to set the HTTP status: **201** when `created === true`, **200** when `created === false`. This prevents the route from guessing the status code.
    - **Empty body**: If `data` is empty `{}` and no profile exists, creates a minimal Student profile (all arrays `[]`, scalars `null`). Returns `{ profile, created: true }` (→ 201). This allows students to establish their profile identity early and fill in details later.
    - If `data` is empty `{}` and a profile already exists, returns the existing profile unchanged with `{ profile, created: false }` (→ 200).
  - `updateByStudentId(studentId, data, requestingUserId, requestingUserRole)` — update by Student UUID:
    - **Requires an existing Student profile** (throws `NotFoundError` if missing)
    - Validates ownership: `student.userId` must match `requestingUserId` OR role must be ADMIN
    - Updates **Student-only** fields (bio, grade, dateOfBirth, skills, interests, languages, profileImageUrl, resumeUrl, schoolId)
    - Does NOT update User fields; use `PATCH /students/me` for User-level fields
  - `getApplications(studentId, filters, requestingUserId, requestingUserRole)` — list applications belonging to the student:
    - Authorization: SELF (student.userId matches requester) or ADMIN
    - Verifies student exists (`throw NotFoundError`), verifies authorization (`throw ForbiddenError`)
    - Delegates to `repository.findApplicationsByStudentId` and `repository.countApplicationsByStudentId`
    - Filter by application `status` (optional via `filters.status`)
    - Paginated response with internship and company details
    - **Read-only**: No Application service module, no status changes, no write operations.

### 3. Create Student Routes

- `src/modules/students/student.routes.ts`:
  - **Order matters**: `/students/me` routes MUST be registered BEFORE `/students/:studentId` to prevent Express from matching `me` as a `:studentId` value.

  - `GET /students` — admin list (
      authenticate,
      authorize('ADMIN'),
      validate(listStudentQuerySchema, 'query'),
    )
  - `GET /students/me` — own profile (
      authenticate,
    )
  - `PATCH /students/me` — self-upsert / own-profile update (
      authenticate,
      validate(updateStudentSchema),
    )
  - `GET /students/:studentId` — profile by Student UUID (
      authenticate,
      validate(studentIdParamSchema, 'params'),
    )
  - `PATCH /students/:studentId` — update existing Student profile by UUID (
      authenticate,
      validate(studentIdParamSchema, 'params'),
      validate(updateStudentProfileSchema),  ← Student-only fields only
    )
  - `GET /students/:studentId/applications` — list student's applications (
      authenticate,
      validate(studentIdParamSchema, 'params'),
      validate(studentApplicationsQuerySchema, 'query'),
    )

### 4. Wire Routes in App

- Import `studentRoutes` in `src/app.ts` and mount at `app.use('/api/v1', studentRoutes)`

### 5. Write Tests

- **Service unit tests (mock the repository layer — 21 tests):**
  - `list` — returns paginated results with filters
  - `list` — applies default pagination when no filters provided
  - `getById` — returns full profile for SELF
  - `getById` — returns full profile for ADMIN
  - `getById` — throws `ForbiddenError` for non-SELF, non-ADMIN
  - `getById` — throws `NotFoundError` when student does not exist
  - `getMyProfile` — returns own profile when found
  - `getMyProfile` — throws `NotFoundError` when no profile exists
  - `upsertMyProfile` — creates new Student profile + updates User fields on first-time call
  - `upsertMyProfile` — updates existing Student profile + User fields on subsequent calls
  - `upsertMyProfile` — does not call User update if no User-level fields changed
  - `upsertMyProfile` — throws `ForbiddenError` when user role is not STUDENT (e.g., COMPANY or ADMIN)
  - `upsertMyProfile` — empty body creates minimal profile on first call (201)
  - `upsertMyProfile` — empty body returns existing profile unchanged (200)
  - `updateByStudentId` — updates Student fields on existing profile
  - `updateByStudentId` — throws `NotFoundError` when student does not exist
  - `updateByStudentId` — throws `ForbiddenError` for non-owner, non-ADMIN
  - `getApplications` — returns paginated applications for SELF
  - `getApplications` — returns paginated applications for ADMIN
  - `getApplications` — throws `ForbiddenError` for unauthorized user
  - `getApplications` — throws `NotFoundError` when student not found

- **Route integration tests (supertest, mock service layer — 30 tests):**
  - `GET /students` — 200 with data (ADMIN)
  - `GET /students` — 403 for STUDENT role
  - `GET /students` — 401 without auth token
  - `GET /students/me` — 200 with own profile (STUDENT)
  - `GET /students/me` — 401 without auth token
  - `PATCH /students/me` — 201 creates profile on first-time setup (STUDENT)
  - `PATCH /students/me` — 200 updates existing profile (STUDENT)
  - `PATCH /students/me` — 400 with invalid data
  - `PATCH /students/me` — 401 without auth token
  - `GET /students/:studentId` — 200 for SELF with full fields
  - `GET /students/:studentId` — 200 for ADMIN
  - `GET /students/:studentId` — 403 for non-SELF, non-ADMIN
  - `GET /students/:studentId` — 401 without auth token
  - `GET /students/:studentId` — 404 when student not found
  - `GET /students/:studentId` — 400 when studentId is not a valid UUID
  - `PATCH /students/:studentId` — 200 for SELF update
  - `PATCH /students/:studentId` — 200 for ADMIN update
  - `PATCH /students/:studentId` — 403 for non-owner, non-ADMIN
  - `PATCH /students/:studentId` — 401 without auth token
  - `PATCH /students/:studentId` — 400 with invalid data
  - `PATCH /students/:studentId` — 400 when studentId is not a valid UUID
  - `PATCH /students/:studentId` — 404 when student profile does not exist
  - `PATCH /students/:studentId` — 400 when body contains `firstName` (unknown field rejected by `.strict()`)
  - `PATCH /students/:studentId` — 400 when body contains `lastName` (unknown field rejected by `.strict()`)
  - `PATCH /students/:studentId` — 400 when body contains `phone` (unknown field rejected by `.strict()`)
  - `GET /students/:studentId/applications` — 200 for SELF
  - `GET /students/:studentId/applications` — 403 for non-owner
  - `GET /students/:studentId/applications` — 401 without auth token
  - `GET /students/:studentId/applications` — 400 when studentId is not a valid UUID

- **Repository tests: DEFERRED (missing test DB infrastructure)**
  - **Reason**: No test database service exists in `docker-compose.yml` (only `postgres` for dev). No `@/test/setup` utilities (`setupTestDatabase`, `teardownTestDatabase`) exist. The `vitest.config.ts` `DATABASE_URL` points to `postgresql://test:test@localhost:5432/test` which has no matching Docker service.
  - **Status**: Logged as a gap in `KNOWN_GAPS_REGISTER.md`. Repository tests will be implemented when test DB infrastructure is established (target: CHECKPOINT 15 — Tests Phase).

---

## Route Summary

| Method | Path | Auth | AuthZ | Description |
|--------|------|------|-------|-------------|
| GET | /students | Required | ADMIN | List all students (paginated, filtered) |
| GET | /students/me | Required | SELF | Get own student profile |
| PATCH | /students/me | Required | SELF | Create or update own profile (upsert) |
| GET | /students/:studentId | Required | SELF, ADMIN | Get student profile by Student UUID |
| PATCH | /students/:studentId | Required | SELF, ADMIN | Update existing Student profile by UUID |
| GET | /students/:studentId/applications | Required | SELF, ADMIN | List student's applications (read-only) |

---

## Validation Schemas

Existing schemas in `student.schema.ts`:
- `createStudentSchema` — base schema with all Student + User fields (firstName, lastName, phone, bio, grade, dateOfBirth, skills, interests, languages, profileImageUrl, resumeUrl)
- `updateStudentSchema` — `createStudentSchema.partial()` — all fields optional; used by `PATCH /students/me`
- `listStudentQuerySchema` — query params for `GET /students` (page, pageSize, search, schoolId, grade, status, sort, order)

### New schema: `updateStudentProfileSchema`

A Student-only partial schema for `PATCH /students/:studentId`. Excludes User fields (firstName, lastName, phone). Uses `.strict()` so any unknown fields (e.g., `firstName`, `lastName`, `phone`) cause Zod to reject the request with a **400 Bad Request** error — they are NOT silently ignored.

```typescript
export const updateStudentProfileSchema = z.object({
  bio: z.string().max(500).trim().optional(),
  grade: z.number().int().min(9).max(12).optional(),
  dateOfBirth: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  skills: z.array(z.string().max(50).trim()).max(10).optional(),
  interests: z.array(z.string().max(50).trim()).max(10).optional(),
  languages: z.array(z.string().max(50).trim()).optional(),
  profileImageUrl: z.string().url().max(2048).optional(),
  resumeUrl: z.string().url().max(2048).optional(),
  schoolId: z.string().uuid().optional(),
}).strict();
```

### New schema: `studentIdParamSchema`

```typescript
export const studentIdParamSchema = z.object({
  studentId: z.string().uuid('studentId must be a valid UUID'),
});
```

Used via `validate(studentIdParamSchema, 'params')` on all `/:studentId` routes.

### New schema: `studentApplicationsQuerySchema`

```typescript
export const studentApplicationsQuerySchema = z.object({
  status: z.string().optional(),
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});
```

Used via `validate(studentApplicationsQuerySchema, 'query')` on `GET /students/:studentId/applications`.

### Schema usage summary

| Endpoint | Schema | Source |
|----------|--------|--------|
| GET /students | `listStudentQuerySchema` | query |
| PATCH /students/me | `updateStudentSchema` (User + Student fields) | body |
| GET /students/:studentId | `studentIdParamSchema` | params |
| PATCH /students/:studentId | `studentIdParamSchema` (params) + `updateStudentProfileSchema` (body, Student-only) | params + body |
| GET /students/:studentId/applications | `studentIdParamSchema` (params) + `studentApplicationsQuerySchema` (query) | params + query |

---

## User vs Student Field Ownership

| Field | Table | Updated via |
|-------|-------|------------|
| `firstName` | User | `PATCH /students/me` (service updates User table) |
| `lastName` | User | `PATCH /students/me` (service updates User table) |
| `phone` | User | `PATCH /students/me` (service updates User table) |
| `bio` | Student | `PATCH /students/me` and `PATCH /students/:studentId` |
| `grade` (9-12) | Student | Both PATCH endpoints |
| `dateOfBirth` | Student | Both PATCH endpoints |
| `skills` | Student | Both PATCH endpoints |
| `interests` | Student | Both PATCH endpoints |
| `languages` | Student | Both PATCH endpoints |
| `profileImageUrl` | Student | Both PATCH endpoints |
| `resumeUrl` | Student | Both PATCH endpoints |
| `schoolId` | Student | Both PATCH endpoints |

**Key rule**: `PATCH /students/:studentId` uses `updateStudentProfileSchema` (Student-only) with `.strict()`. If User fields (`firstName`, `lastName`, `phone`) are included in the request body, Zod rejects them with a validation error and the server returns **400 Bad Request**. User fields are NEVER silently ignored. Only `PATCH /students/me` (using `updateStudentSchema`) accepts User fields.

---

## Documentation Mismatches

The following documented behaviors in `docs/api/STUDENT_ROUTES.md` are **not** implemented in CHECKPOINT 9:

| Documented Behavior | Actual in CHECKPOINT 9 | Reason |
|---------------------|------------------------|--------|
| `GET /students/:studentId` — public fields (name, school, grade) visible to any authenticated user | `GET /students/:studentId` — **SELF or ADMIN only** | Per `SECURITY_RULES.md`, Student Profile Read is SELF/ADMIN only. Broader access deferred to a future checkpoint if requirements change. |
| `GET /students/:studentId/recommendations` | Deferred | Depends on Internship module and recommendation algorithm (CHECKPOINT 11+) |

---

## Deferred Endpoints

The following endpoint is documented in `STUDENT_ROUTES.md` but is **explicitly excluded** from CHECKPOINT 9:

| Method | Path | Reason for Deferral |
|--------|------|---------------------|
| GET | /students/:studentId/recommendations | Depends on Internship module and recommendation algorithm (CHECKPOINT 11+) |

---

## Forbidden Scope

- Do NOT implement Companies, Internships, Applications (beyond read-only repository-level Application queries with internship/company includes), Schools, or Admin modules
- Do NOT modify Prisma schema or run migrations
- Do NOT modify auth/JWT/bcrypt logic
- Do NOT install dependencies
- Do NOT implement any Application service or Application status changes
- Do NOT implement `GET /students/:studentId/recommendations` (deferred)
- Do NOT implement public/any-authenticated profile reads (deferred; see Documentation Mismatches)

---

## Acceptance Criteria

- [ ] Admin can list all students with search, filter, sort, and pagination
- [ ] Students can view their own profile (via `/students/me`)
- [ ] Students can view other students' profiles only if they are ADMIN
- [ ] Students can create their profile via `PATCH /students/me` (first-time upsert)
- [ ] Students can update their own profile via `PATCH /students/me`
- [ ] Students can update their own Student profile via `PATCH /students/:studentId` (Student UUID)
- [ ] Ownership checks prevent unauthorized edits (`PATCH /students/:studentId`)
- [ ] UUID validation on all `:studentId` params prevents malformed UUIDs reaching Prisma
- [ ] Students can list their own applications (read-only)
- [ ] All tests pass (service unit + route integration)
- [ ] `npm run typecheck` passes
- [ ] `npm run lint` passes
- [ ] `npm run test` passes (root monorepo command)

---

## Estimated Time

4 hours
