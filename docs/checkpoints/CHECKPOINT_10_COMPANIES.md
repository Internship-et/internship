# CHECKPOINT 10: Companies Module

**Prerequisites:** CHECKPOINT_9_STUDENTS ✅

---

## Goal

Implement the Company module: company profiles, public listing, and application management.

---

## Tasks

### 1. Create Company Repository

- `src/modules/companies/company.repository.ts`:
  - `findAll(filters)` — public company listing
  - `findById(id)` — with user relation
  - `findByUserId(userId)` — find company by user ID
  - `create(data)` — create company profile
  - `update(id, data)` — update company

### 2. Create Company Service

- `src/modules/companies/company.service.ts`:
  - `list(filters)` — public list
  - `getById(id)` — public profile
  - `create(data, userId)` — create (COMPANY role)
  - `update(id, data, userId, userRole)` — with ownership check
  - `getInternships(companyId, filters)` — list company internships
  - `getApplications(companyId, filters, userId, userRole)` — list applications to company's internships

### 3. Create Company Routes

- `src/modules/companies/company.routes.ts`:
  - `GET /companies` — public list
  - `GET /companies/:companyId` — public profile
  - `POST /companies` — create (COMPANY, ADMIN)
  - `PATCH /companies/:companyId` — update (OWNER, ADMIN)
  - `GET /companies/:companyId/internships` — public list
  - `GET /companies/:companyId/applications` — scoped (OWNER, ADMIN)

### 4. Write Tests

- Service unit tests (list, getById, create, update with ownership)
- Route integration tests (public access, auth failures, ownership)

---

## Forbidden Scope

- Do NOT implement student, internship, or application modules
- Do NOT create school or admin functionality
- Do NOT modify auth or rate limiting middleware
- Do NOT deploy to production

---

## Acceptance Criteria

- [ ] Public company listing works
- [ ] Company profiles are viewable without auth
- [ ] Ownership checks prevent unauthorized edits
- [ ] Company can view applications to their internships
- [ ] All tests pass

---

## Estimated Time

4 hours
