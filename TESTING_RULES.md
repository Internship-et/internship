# TESTING_RULES.md

> **If it isn't tested, it's broken.** This document defines the testing strategy, standards, and requirements for the entire codebase.

---

## 1. Testing Philosophy

- **Unit tests** verify business logic in isolation
- **Integration tests** verify that components work together
- **Repository tests** verify database queries against a real database
- Tests are **first-class citizens** — they live alongside source code
- Every PR **must** include tests for new functionality
- Tests **must** be deterministic (no flaky tests)

---

## 2. Test Framework

- **Runtime:** Vitest (fast, TypeScript-native)
- **Assertions:** Vitest built-in (expect)
- **HTTP testing:** Supertest
- **Mocking:** Vitest mocking (vi.mock, vi.spyOn)
- **Database testing:** Testcontainers or Docker-based PostgreSQL
- **Coverage:** Vitest `--coverage` (c8/istanbul)

---

## 3. Coverage Requirements

| Layer | Minimum Coverage |
|-------|-----------------|
| Services | ≥ 85% |
| Routes (integration) | ≥ 90% |
| Repositories | ≥ 70% |
| Middleware | ≥ 80% |
| Utils | ≥ 90% |
| **Overall** | **≥ 80%** |

Coverage is enforced via CI. PRs that reduce coverage **must** be rejected.

---

## 4. File Structure

Tests live in `__tests__/` directories, mirroring the source structure:

```
src/
├── modules/
│   ├── students/
│   │   ├── student.service.ts
│   │   ├── student.routes.ts
│   │   ├── student.repository.ts
│   │   ├── student.schema.ts
│   │   └── __tests__/
│   │       ├── student.service.test.ts
│   │       ├── student.routes.test.ts
│   │       └── student.repository.test.ts
│   └── companies/
│       └── ...
└── shared/
    ├── middleware/
    │   ├── auth.middleware.ts
    │   └── __tests__/
    │       └── auth.middleware.test.ts
    └── utils/
        ├── pagination.ts
        └── __tests__/
            └── pagination.test.ts
```

---

## 5. Test Types

### 5.1 Unit Tests (Services)

```typescript
// modules/example/__tests__/example.service.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { exampleService } from '../example.service';
import { exampleRepository } from '../example.repository';

// Mock the repository
vi.mock('../example.repository');

describe('ExampleService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getById', () => {
    it('should return the record when found', async () => {
      const mockRecord = { id: '1', name: 'Test' };
      vi.mocked(exampleRepository.findById).mockResolvedValue(mockRecord);
      
      const result = await exampleService.getById('1');
      expect(result).toEqual(mockRecord);
      expect(exampleRepository.findById).toHaveBeenCalledWith('1');
    });

    it('should throw NotFoundError when not found', async () => {
      vi.mocked(exampleRepository.findById).mockResolvedValue(null);
      
      await expect(exampleService.getById('999')).rejects.toThrow('not found');
    });
  });
});
```

### 5.2 Integration Tests (Routes)

```typescript
// modules/example/__tests__/example.routes.test.ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import supertest from 'supertest';
import { createApp } from '@/app';
import { prisma } from '@/shared/lib/prisma';

const app = createApp();
const request = supertest(app);

describe('GET /api/v1/examples/:id', () => {
  it('should return 401 when not authenticated', async () => {
    const res = await request.get('/api/v1/examples/1');
    expect(res.status).toBe(401);
  });

  it('should return 200 with record when authenticated', async () => {
    const token = generateTestToken({ role: 'STUDENT' });
    const res = await request
      .get('/api/v1/examples/1')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });
});
```

### 5.3 Repository Tests

```typescript
// modules/example/__tests__/example.repository.test.ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { prisma } from '@/shared/lib/prisma';
import { exampleRepository } from '../example.repository';
import { setupTestDatabase, teardownTestDatabase } from '@/test/setup';

describe('ExampleRepository', () => {
  beforeAll(async () => {
    await setupTestDatabase();
  });

  afterAll(async () => {
    await teardownTestDatabase();
  });

  describe('create', () => {
    it('should create a record in the database', async () => {
      const record = await exampleRepository.create({
        name: 'Test',
        email: 'test@example.com',
      });
      expect(record.id).toBeDefined();
      expect(record.name).toBe('Test');
    });
  });
});
```

---

## 6. Testing Patterns

### 6.1 Mocking Rules

- Mock external dependencies (Redis, email services, file storage)
- Do **not** mock the database — use a real test database
- Do **not** mock Prisma — use a real PostgreSQL instance
- Mock at the boundary (repository layer for service tests)
- Restore all mocks after each test

### 6.2 Test Data

- Factories for generating test data (use `@faker-js/faker`)
- Seeds for common test scenarios
- Test data **must** be cleaned up after each test
- Use `beforeEach` for state isolation, not `beforeAll`

### 6.3 Async Testing

- All async code **must** be awaited or returned
- Timeouts: default 10s, adjust for integration tests
- Never use `done` callback — use async/await

---

## 7. Test Database

- Integration and repository tests use a **real PostgreSQL** database
- Docker Compose provides the test database service
- Each test run gets a fresh database schema (migrate + truncate)
- Test database **must not** be the same as development database
- Connection string: `DATABASE_URL=postgresql://.../internship_test`

---

## 8. CI Pipeline

```
┌──────────────┐
│  Unit Tests  │  ← Parallel, fast (~30s)
├──────────────┤
│ Integration  │  ← Sequential, slower (~2min)
├──────────────┤
│  Coverage    │  ← Generates coverage report
├──────────────┤
│  Lint + Type │  ← TypeScript checks
└──────────────┘
```

- All tests **must** pass before merge
- Coverage **must** meet minimum thresholds
- Flaky tests **must** be quarantined immediately

---

## 9. What to Test

### 9.1 Always Test
- Success paths (happy path)
- Error paths (validation failures, not found, conflicts)
- Boundary conditions (empty lists, pagination edges)
- Authorization (unauthorized access, wrong role)
- Business rules (status transitions, eligibility checks)

### 9.2 Never Test
- Third-party library behavior (Prisma, Zod, bcrypt)
- Node.js built-in behavior
- Trivial getters/setters (unless they contain logic)

---

## 10. Test Naming Convention

```
describe('ModuleName', () => {
  describe('methodName', () => {
    it('should [expected behavior] when [condition]', () => { ... });
    it('should throw [ErrorType] when [condition]', () => { ... });
  });
});
```

Examples:
- `"should return the student when found"`
- `"should throw NotFoundError when student does not exist"`
- `"should return 400 when email is invalid"`
- `"should return 403 when student tries to update another student's profile"`

---

## 11. Manual Testing

- API endpoints **must** be documented with examples (see docs/api/)
- Postman/Insomnia collection **must** be maintained
- Smoke tests **must** pass before deployment to staging
- Load tests **must** be run before production release

---

## 12. Edge Cases Checklist

Before shipping any feature, test:

- [ ] Empty request body
- [ ] Missing required fields
- [ ] Invalid data types
- [ ] Extremely long strings
- [ ] Unicode/special characters
- [ ] SQL injection attempts
- [ ] XSS payloads
- [ ] Data that doesn't exist (404)
- [ ] Duplicate data (409)
- [ ] Rate limit exceeded (429)
- [ ] Expired tokens (401)
- [ ] Wrong role (403)
- [ ] Concurrent modifications
- [ ] Network timeout
- [ ] Database down gracefully

---

*Tests are not optional. Untested code is legacy code.*
