# BACKEND_IMPLEMENTATION_REFERENCE.md

> **Quick-reference guide for implementation.** Use this as a checklist when building any new feature or module. Read the full Bible for rationale; use this for execution.

---

## 1. Creating a New Module

```
modules/<name>/
├── <name>.routes.ts
├── <name>.service.ts
├── <name>.repository.ts
├── <name>.schema.ts
├── <name>.types.ts
├── <name>.middleware.ts       (if needed)
├── <name>.errors.ts           (if needed)
└── __tests__/
    ├── <name>.service.test.ts
    ├── <name>.routes.test.ts
    └── <name>.repository.test.ts
```

**Steps:**
1. Define types in `<name>.types.ts`
2. Define schemas in `<name>.schema.ts` (Zod)
3. Define repository in `<name>.repository.ts` (Prisma queries)
4. Define errors in `<name>.errors.ts` (if custom errors needed)
5. Define service in `<name>.service.ts` (business logic)
6. Define middleware in `<name>.middleware.ts` (if module-specific)
7. Define routes in `<name>.routes.ts` (HTTP handlers)
8. Register routes in `app.ts` or `router.ts`
9. Write tests in `__tests__/`

---

## 2. Route Handler Template

```typescript
// modules/example/example.routes.ts
import { Router, Request, Response, NextFunction } from 'express';
import { validate } from '@/shared/middleware/validation.middleware';
import { authenticate } from '@/shared/middleware/auth.middleware';
import { authorize } from '@/shared/middleware/auth.middleware';
import { exampleService } from './example.service';
import { createExampleSchema, updateExampleSchema } from './example.schema';
import { asyncHandler } from '@/shared/utils/async-handler';

const router = Router();

router.get(
  '/',
  authenticate,
  authorize(['ADMIN']),
  asyncHandler(async (req: Request, res: Response) => {
    const result = await exampleService.list(req.query);
    res.status(200).json({ success: true, data: result });
  })
);

router.get(
  '/:id',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    const result = await exampleService.getById(req.params.id);
    res.status(200).json({ success: true, data: result });
  })
);

router.post(
  '/',
  authenticate,
  authorize(['ADMIN', 'COMPANY']),
  validate(createExampleSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const result = await exampleService.create(req.user!.id, req.body);
    res.status(201).json({ success: true, data: result });
  })
);

router.patch(
  '/:id',
  authenticate,
  authorize(['ADMIN']),
  validate(updateExampleSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const result = await exampleService.update(req.params.id, req.body);
    res.status(200).json({ success: true, data: result });
  })
);

router.delete(
  '/:id',
  authenticate,
  authorize(['ADMIN']),
  asyncHandler(async (req: Request, res: Response) => {
    await exampleService.delete(req.params.id);
    res.status(204).send();
  })
);

export default router;
```

---

## 3. Service Template

```typescript
// modules/example/example.service.ts
import { exampleRepository } from './example.repository';
import { NotFoundError, ConflictError } from '@/shared/errors/app-error';
import type { CreateExampleInput, UpdateExampleInput } from './example.schema';

export const exampleService = {
  async list(filters: Record<string, unknown>) {
    return exampleRepository.findAll(filters);
  },

  async getById(id: string) {
    const record = await exampleRepository.findById(id);
    if (!record) throw new NotFoundError('Example not found');
    return record;
  },

  async create(userId: string, data: CreateExampleInput) {
    // Business rule checks here
    const existing = await exampleRepository.findByEmail(data.email);
    if (existing) throw new ConflictError('Email already in use');
    
    return exampleRepository.create({ ...data, createdBy: userId });
  },

  async update(id: string, data: UpdateExampleInput) {
    const existing = await this.getById(id); // throws NotFoundError if missing
    // Business rule checks
    return exampleRepository.update(id, data);
  },

  async delete(id: string) {
    await this.getById(id); // throws NotFoundError if missing
    return exampleRepository.softDelete(id);
  },
};
```

---

## 4. Repository Template

```typescript
// modules/example/example.repository.ts
import { prisma } from '@/shared/lib/prisma';
import type { Prisma } from '@prisma/client';

export const exampleRepository = {
  async findAll(filters: Record<string, unknown>) {
    const where: Prisma.ExampleWhereInput = {};
    // Build where clause from filters
    return prisma.example.findMany({ where, orderBy: { createdAt: 'desc' } });
  },

  async findById(id: string) {
    return prisma.example.findUnique({ where: { id } });
  },

  async findByEmail(email: string) {
    return prisma.example.findUnique({ where: { email } });
  },

  async create(data: Prisma.ExampleCreateInput) {
    return prisma.example.create({ data });
  },

  async update(id: string, data: Prisma.ExampleUpdateInput) {
    return prisma.example.update({ where: { id }, data });
  },

  async softDelete(id: string) {
    return prisma.example.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  },
};
```

---

## 5. Middleware Stack Order

```typescript
// src/app.ts
app.use(requestId());           // 1. Assign request ID
app.use(cors(corsConfig));      // 2. CORS
app.use(rateLimiter());         // 3. Rate limiting
app.use(requestLogger());       // 4. Structured logging
app.use(express.json());        // 5. Body parsing
app.use(express.urlencoded());  // 5. Body parsing
app.use(validateSchema());      // 6. Validation (route-specific)
app.use(authenticate());        // 7. Auth (route-specific)
app.use(authorize());           // 8. Authorization (route-specific)
// Routes registered here
app.use(errorHandler());        // 9. Error handler (last)
```

---

## 6. Common Utilities Location

```
src/shared/
├── lib/
│   ├── prisma.ts               # Prisma client singleton
│   ├── redis.ts                # Redis client
│   └── logger.ts               # Winston/Pino logger
├── middleware/
│   ├── auth.middleware.ts      # JWT verification
│   ├── validation.middleware.ts # Zod validation
│   ├── rate-limit.middleware.ts # Rate limiting
│   ├── logging.middleware.ts   # Request logging
│   ├── request-id.middleware.ts # Request ID assignment
│   ├── cors.middleware.ts      # CORS configuration
│   └── error.middleware.ts     # Global error handler
├── utils/
│   ├── async-handler.ts        # Async route wrapper
│   ├── pagination.ts           # Pagination helpers
│   ├── sanitization.ts         # Input sanitization
│   └── token.ts                # JWT helpers
├── errors/
│   └── app-error.ts            # Base AppError class + subtypes
└── types/
    ├── express.d.ts            # Express type extensions
    └── common.types.ts         # Shared types
```

---

## 7. Module Registration

```typescript
// src/app.ts
import { authRoutes } from '@/modules/auth/auth.routes';
import { studentRoutes } from '@/modules/students/student.routes';
// ...

const router = Router();
router.use('/auth', authRoutes);
router.use('/students', studentRoutes);
router.use('/companies', companyRoutes);
router.use('/internships', internshipRoutes);
router.use('/applications', applicationRoutes);
router.use('/schools', schoolRoutes);
router.use('/admin', adminRoutes);

app.use('/api/v1', router);
```

---

## 8. Quick Reference: Naming

| Item | Convention | Example |
|------|-----------|---------|
| Files | `kebab-case` | `student-routes.ts` |
| Classes/PascalCase | `PascalCase` | `NotFoundError` |
| Functions/variables | `camelCase` | `getStudentById` |
| Constants (true constants) | `UPPER_SNAKE_CASE` | `SALT_ROUNDS` |
| Types/Interfaces | `PascalCase` | `CreateStudentInput` |
| Enums | `PascalCase` | `UserRole` |
| Enum values | `UPPER_SNAKE_CASE` | `Role.ADMIN` |
| Database tables | `snake_case` | `internship_applications` |
| Database columns | `snake_case` | `created_at` |
| Route params | `camelCase` | `req.params.studentId` |

---

## 9. Quick Reference: Error Codes

| HTTP | Code | Meaning |
|------|------|---------|
| 400 | `VALIDATION_ERROR` | Input validation failed |
| 401 | `UNAUTHORIZED` | Missing or invalid auth token |
| 403 | `FORBIDDEN` | Authenticated but not authorized |
| 404 | `NOT_FOUND` | Resource not found |
| 409 | `CONFLICT` | Resource already exists / state conflict |
| 422 | `UNPROCESSABLE_ENTITY` | Business rule violation |
| 429 | `RATE_LIMIT_EXCEEDED` | Too many requests |
| 500 | `INTERNAL_ERROR` | Unexpected server error |
| 503 | `SERVICE_UNAVAILABLE` | Dependency unavailable |

---

## 10. Environment Variables Quick Reference

```
# Required
DATABASE_URL=postgresql://...
JWT_SECRET=...
REDIS_URL=redis://...

# Optional with defaults
PORT=3000
NODE_ENV=development
CORS_ORIGINS=http://localhost:3000
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX=100
LOG_LEVEL=info
```

See `docs/operations/ENVIRONMENT_VARIABLES.md` for the full specification.
