# CHECKPOINT 15: Tests

**Prerequisites:** CHECKPOINT_14_ADMIN ✅

---

## Goal

Write comprehensive tests for all modules: unit tests, integration tests, and repository tests.

---

## Tasks

### 1. Test Infrastructure

- [ ] Configure Vitest with coverage
- [ ] Create test database setup/teardown utilities
- [ ] Create test data factories
- [ ] Create test token generation utility

### 2. Write Service Tests (Unit Tests)

Each service must have tests covering:

| Service | Test Cases |
|---------|-----------|
| Auth | register, login, refresh, logout, forgot/reset password, edge cases |
| Students | CRUD, ownership check, visibility rules, recommendations |
| Companies | CRUD, ownership check, public vs private data |
| Internships | CRUD, state transitions, search, filter, apply rules |
| Applications | status transitions, withdraw rules, scoping |
| Schools | CRUD, verification logic, ownership |
| Admin | dashboard, user management, audit logs |

### 3. Write Route Tests (Integration Tests)

Each route must have tests for:
- Success case (200/201)
- Validation error (400)
- Unauthorized (401)
- Forbidden (403)
- Not found (404)
- Conflict (409) — where applicable
- Business rule violation (422) — where applicable

### 4. Write Repository Tests

- Test queries against a real test database
- Test pagination
- Test filtering
- Test unique constraints

### 5. Verify Coverage

- [ ] Overall coverage ≥ 80%
- [ ] Service coverage ≥ 85%
- [ ] Route coverage ≥ 90%
- [ ] Repository coverage ≥ 70%

---

## Forbidden Scope

- Do NOT implement new features or business logic
- Do NOT modify application code except to fix bugs uncovered by tests
- Do NOT modify Prisma schema or create migrations
- Do NOT deploy to production

---

## Acceptance Criteria

- [ ] All tests pass
- [ ] Coverage meets minimum thresholds
- [ ] Test database is separate from development
- [ ] Tests are deterministic (no flaky tests)
- [ ] CI pipeline runs tests automatically

---

## Estimated Time

8 hours
