# CHECKPOINT 13: Schools Module

**Prerequisites:** CHECKPOINT_12_APPLICATIONS ✅

---

## Goal

Implement the School module: school profiles, student verification.

---

## Tasks

### 1. Create School Repository

- `src/modules/schools/school.repository.ts`:
  - `findAll(filters)` — public list
  - `findById(id)` — with students relation
  - `findByUserId(userId)` — find school by user ID
  - `create(data)` — create school profile
  - `update(id, data)` — update school

### 2. Create School Service

- `src/modules/schools/school.service.ts`:
  - `list(filters)` — public list
  - `getById(id)` — public profile
  - `create(data, userId)` — create (SCHOOL, ADMIN)
  - `update(id, data, userId, userRole)` — with ownership check
  - `verifyStudent(schoolId, data, userId, userRole)` — verify enrollment

### 3. Create School Routes

- `src/modules/schools/school.routes.ts`:
  - `GET /schools` — public list
  - `GET /schools/:schoolId` — public profile
  - `POST /schools` — create (SCHOOL, ADMIN)
  - `PATCH /schools/:schoolId` — update (OWNER, ADMIN)
  - `POST /schools/:schoolId/verify-student` — verify (OWNER, ADMIN)

### 4. Write Tests

- Service unit tests (CRUD, verification logic)
- Route integration tests (public access, auth, ownership)

---

## Forbidden Scope

- Do NOT implement admin module (reserved for CHECKPOINT_14)
- Do NOT modify student, company, internship, or application modules
- Do NOT modify auth or rate limiting middleware
- Do NOT deploy to production

---

## Acceptance Criteria

- [ ] School CRUD works with proper authorization
- [ ] Public listing is available without auth
- [ ] Student verification is logged and audited
- [ ] School can only verify students who have selected them
- [ ] All tests pass

---

## Estimated Time

3 hours
