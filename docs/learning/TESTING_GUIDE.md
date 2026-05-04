# TESTING_GUIDE.md

> **Practical guide for writing and running tests in this project.**

---

## 1. Test Runner Setup

The project uses **Vitest** as the test runner.

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm run test:coverage

# Run tests for a specific module
npx vitest modules/students
```

---

## 2. Writing Tests

### 2.1 Unit Test (Service)

```typescript
// modules/students/__tests__/student.service.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { studentService } from '../student.service';
import { studentRepository } from '../student.repository';
import { NotFoundError } from '@/shared/errors/app-error';

// Mock the repository
vi.mock('../student.repository');

describe('StudentService', () => {
  const mockStudent = {
    id: 'uuid-1',
    userId: 'user-uuid-1',
    firstName: 'Abebe',
    lastName: 'Kebede',
    grade: 11,
    schoolId: 'school-uuid',
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getById', () => {
    it('should return student when found', async () => {
      vi.mocked(studentRepository.findById).mockResolvedValue(mockStudent);
      
      const result = await studentService.getById('uuid-1');
      expect(result).toEqual(mockStudent);
    });

    it('should throw NotFoundError when student not found', async () => {
      vi.mocked(studentRepository.findById).mockResolvedValue(null);
      
      await expect(studentService.getById('nonexistent'))
        .rejects.toThrow(NotFoundError);
    });
  });

  describe('update', () => {
    it('should update student when authorized', async () => {
      vi.mocked(studentRepository.findById).mockResolvedValue(mockStudent);
      vi.mocked(studentRepository.update).mockResolvedValue({
        ...mockStudent,
        grade: 12,
      });
      
      const result = await studentService.update(
        'uuid-1', 
        mockStudent.userId, 
        'STUDENT', 
        { grade: 12 }
      );
      
      expect(result.grade).toBe(12);
    });

    it('should throw ForbiddenError when not owner', async () => {
      vi.mocked(studentRepository.findById).mockResolvedValue(mockStudent);
      
      await expect(studentService.update(
        'uuid-1',
        'different-user',  // Not the owner
        'STUDENT',
        { grade: 12 }
      )).rejects.toThrow('not authorized');
    });
  });
});
```

### 2.2 Integration Test (Route)

```typescript
// modules/internships/__tests__/internship.routes.test.ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import supertest from 'supertest';
import { createApp } from '@/app';
import { prisma } from '@/shared/lib/prisma';

const app = createApp();
const request = supertest(app);

describe('GET /api/v1/internships', () => {
  it('should return paginated internships', async () => {
    const res = await request
      .get('/api/v1/internships')
      .query({ page: 1, pageSize: 10 });
    
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.meta).toBeDefined();
    expect(res.body.meta.page).toBe(1);
  });

  it('should filter by city', async () => {
    const res = await request
      .get('/api/v1/internships')
      .query({ city: 'Addis Ababa' });
    
    expect(res.status).toBe(200);
    // All results should be in Addis Ababa
    res.body.data.forEach((internship: any) => {
      expect(internship.location.city).toBe('Addis Ababa');
    });
  });
});

describe('POST /api/v1/internships/:id/apply', () => {
  it('should return 401 when not authenticated', async () => {
    const res = await request
      .post('/api/v1/internships/some-id/apply')
      .send({});
    
    expect(res.status).toBe(401);
  });

  it('should return 201 when successfully applied', async () => {
    const token = generateTestToken({ role: 'STUDENT', id: 'student-uuid' });
    
    const res = await request
      .post('/api/v1/internships/active-internship-id/apply')
      .set('Authorization', `Bearer ${token}`)
      .send({ coverLetter: 'I am interested...' });
    
    expect(res.status).toBe(201);
    expect(res.body.data.status).toBe('PENDING');
  });
});
```

### 2.3 Repository Test

```typescript
// modules/students/__tests__/student.repository.test.ts
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { prisma } from '@/shared/lib/prisma';
import { studentRepository } from '../student.repository';
import { setupTestDatabase, teardownTestDatabase, clearTestData } from '@/test/setup';

describe('StudentRepository', () => {
  beforeAll(async () => {
    await setupTestDatabase();
  });

  afterAll(async () => {
    await teardownTestDatabase();
  });

  beforeEach(async () => {
    await clearTestData();
  });

  describe('findById', () => {
    it('should return null for non-existent student', async () => {
      const result = await studentRepository.findById('nonexistent');
      expect(result).toBeNull();
    });

    it('should return student when found', async () => {
      // Create test data
      const user = await prisma.user.create({
        data: { email: 'test@test.com', /* ... */ }
      });
      const student = await prisma.student.create({
        data: { userId: user.id, grade: 11 }
      });
      
      const result = await studentRepository.findById(student.id);
      expect(result).toBeDefined();
      expect(result?.id).toBe(student.id);
    });
  });
});
```

---

## 3. Mocking Patterns

### 3.1 Mocking External Services

```typescript
// Mock email service
vi.mock('@/shared/lib/email', () => ({
  emailService: {
    send: vi.fn().mockResolvedValue(true),
  },
}));

// Mock Redis
vi.mock('@/shared/lib/redis', () => ({
  redisClient: {
    incr: vi.fn().mockResolvedValue(1),
    expire: vi.fn().mockResolvedValue(true),
    ttl: vi.fn().mockResolvedValue(900),
    set: vi.fn().mockResolvedValue(true),
    get: vi.fn().mockResolvedValue(null),
    del: vi.fn().mockResolvedValue(true),
  },
}));
```

### 3.2 Generating Test Tokens

```typescript
// test/utils/auth.ts
import jwt from 'jsonwebtoken';

export function generateTestToken(overrides = {}) {
  const payload = {
    userId: 'test-user-id',
    role: 'STUDENT',
    email: 'test@example.com',
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + 900,
    ...overrides,
  };
  
  return jwt.sign(payload, process.env.JWT_SECRET!);
}
```

---

## 4. Test Database Setup

```typescript
// test/setup.ts
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function setupTestDatabase() {
  // Run migrations
  await execSync('npx prisma migrate deploy');
  
  // Seed test data
  await seedTestData();
}

export async function teardownTestDatabase() {
  await prisma.$disconnect();
}

export async function clearTestData() {
  // Truncate all tables in dependency order
  await prisma.applicationStatusHistory.deleteMany();
  await prisma.application.deleteMany();
  await prisma.internship.deleteMany();
  await prisma.student.deleteMany();
  await prisma.company.deleteMany();
  await prisma.school.deleteMany();
  await prisma.user.deleteMany();
}
```

---

## 5. Test Data Factories

```typescript
// test/factories.ts
import { faker } from '@faker-js/faker';
import { prisma } from '@/shared/lib/prisma';
import bcrypt from 'bcrypt';

export async function createTestUser(overrides = {}) {
  return prisma.user.create({
    data: {
      email: faker.internet.email().toLowerCase(),
      passwordHash: await bcrypt.hash('Password123!', 10),
      firstName: faker.person.firstName(),
      lastName: faker.person.lastName(),
      role: 'STUDENT',
      status: 'ACTIVE',
      isVerified: true,
      ...overrides,
    },
  });
}
```

---

## 6. Coverage Configuration

```typescript
// vitest.config.ts
export default defineConfig({
  test: {
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      thresholds: {
        statements: 80,
        branches: 75,
        functions: 80,
        lines: 80,
      },
      exclude: [
        '**/*.test.ts',
        '**/__tests__/**',
        'prisma/**',
        'src/shared/lib/prisma.ts',
      ],
    },
  },
});
```

---

*Write tests first. Your future self will thank you.*
