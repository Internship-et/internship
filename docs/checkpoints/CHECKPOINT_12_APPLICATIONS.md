# CHECKPOINT 11: Internships Module

**Prerequisites:** CHECKPOINT_10_COMPANIES ✅

---

## Goal

Implement the Internship module: CRUD operations, search, filtering, pagination, and application submission.

---

## Tasks

### 1. Create Internship Repository

- `src/modules/internships/internship.repository.ts`:
  - `findAll(filters)` — paginated, filterable, searchable
  - `findById(id)` — with company relation
  - `create(data)` — create internship
  - `update(id, data)` — update internship
  - `softDelete(id)` — close internship (set status to CLOSED)
  - `findActive()` — active internships only

### 2. Create Internship Service

- `src/modules/internships/internship.service.ts`:
  - `list(filters)` — public, only ACTIVE for non-owners
  - `getById(id, requestingUser?)` — public, all statuses for owner
  - `create(data, companyId, userId)` — create in DRAFT status
  - `update(id, data, userId, userRole)` — with ownership check, status transition validation
  - `close(id, userId, userRole)` — close internship
  - `apply(internshipId, studentId, data)` — apply, with business rule checks

### 3. Create Internship Routes

- `src/modules/internships/internship.routes.ts`:
  - `GET /internships` — public list
  - `GET /internships/:internshipId` — public details
  - `POST /internships` — create (COMPANY, ADMIN)
  - `PATCH /internships/:internshipId` — update (OWNER, ADMIN)
  - `DELETE /internships/:internshipId` — close (OWNER, ADMIN)
  - `POST /internships/:internshipId/apply` — apply (STUDENT)

### 4. Write Tests

- Service unit tests (CRUD, state transitions, application validation)
- Route integration tests (public access, auth, business rules)

---

## Forbidden Scope

- Do NOT implement school or admin modules
- Do NOT implement application status management (reserved for CHECKPOINT_12)
- Do NOT modify auth or rate limiting middleware
- Do NOT deploy to production

---

## Acceptance Criteria

- [ ] Internship CRUD works with proper authorization
- [ ] Search and filtering work (city, type, tags, grade)
- [ ] Cursor-based pagination works
- [ ] State transitions follow STATE_MACHINES.md
- [ ] Application submission validates all business rules
- [ ] All tests pass

---

## Estimated Time

6 hours
