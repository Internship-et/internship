# AGENT_WORKFLOW_GUIDE.md

> **Guide for AI coding agents working on this project.** Explains how to navigate the codebase, understand context, and execute tasks effectively.

---

## 1. Before You Start

As an AI agent, before making any changes:

1. **Read AGENTS.md** — Your operating instructions
2. **Read BACKEND_ENGINEERING_BIBLE.md** — Core principles
3. **Read NAMING_CONVENTIONS.md** — Naming rules
4. **Read CHECKPOINT_LOG.md** — Current phase and status
5. **Read the relevant checkpoint spec** — Know exactly what to build
6. **Read the relevant route contract** — Know the API contract

---

## 2. Understanding the Codebase

### 2.1 File Organization

```
src/
├── app.ts                    # Express app setup
├── server.ts                 # Server entry point
├── config/                   # Configuration
│   └── index.ts
├── shared/                   # Shared code
│   ├── lib/                  # Clients (Prisma, Redis, Logger)
│   ├── middleware/            # Shared middleware
│   ├── utils/                # Utility functions
│   ├── errors/               # Error classes
│   └── types/                # Shared types
├── modules/                  # Feature modules
│   ├── auth/
│   ├── students/
│   ├── companies/
│   ├── internships/
│   ├── applications/
│   ├── schools/
│   └── admin/
└── test/                     # Test utilities
    ├── setup.ts
    ├── factories.ts
    └── utils/
```

### 2.2 Module Structure

Each module has the same structure:

```
modules/<name>/
├── <name>.routes.ts       # Express routes (HTTP handlers)
├── <name>.service.ts      # Business logic
├── <name>.repository.ts   # Database queries
├── <name>.schema.ts       # Zod validation schemas
├── <name>.types.ts        # TypeScript types
├── <name>.middleware.ts    # Module-specific middleware (optional)
├── <name>.errors.ts       # Module-specific errors (optional)
└── __tests__/
    ├── <name>.service.test.ts
    ├── <name>.routes.test.ts
    └── <name>.repository.test.ts
```

---

## 3. Execution Order

When implementing a new feature:

```
1. Read checkpoint spec
       │
2. Read relevant docs (route contract, state machines, etc.)
       │
3. Read all files that need to be modified
       │
4. Plan the implementation
       │
5. Implement in this order:
   a. Types (types.ts)
   b. Validation schemas (schema.ts)
   c. Errors (errors.ts)
   d. Repository (repository.ts)
   e. Service (service.ts) 
   f. Middleware (middleware.ts)
   g. Routes (routes.ts)
   h. Tests (__tests__/)
   i. Register routes in app.ts
       │
6. Verify:
   - TypeScript compiles (npm run typecheck)
   - No lint errors (npm run lint)
   - Tests pass (npm test)
   - Coverage is adequate
       │
7. Update CHECKPOINT_LOG.md
```

---

## 4. Common Patterns

### 4.1 Error Handling Pattern

```typescript
// Service throws typed errors
async getById(id: string) {
  const record = await repository.findById(id);
  if (!record) throw new NotFoundError('Resource not found');
  return record;
}

// Route uses asyncHandler (catches errors automatically)
router.get('/:id', asyncHandler(async (req, res) => {
  const result = await service.getById(req.params.id);
  res.json({ success: true, data: result });
}));
```

### 4.2 Ownership Check Pattern

```typescript
// Always check ownership in service
async update(id: string, userId: string, userRole: string, data: any) {
  const record = await this.getById(id); // throws if not found
  
  // Ownership or admin check
  if (record.ownerId !== userId && userRole !== 'ADMIN') {
    throw new ForbiddenError('You do not own this resource');
  }
  
  return repository.update(id, { ...data, updatedById: userId });
}
```

### 4.3 Pagination Pattern

```typescript
// Controller
async function list(req: Request, res: Response) {
  const { cursor, limit, ...filters } = req.query;
  const result = await service.list({ cursor, limit: Number(limit) || 20, filters });
  res.json({ success: true, data: result.data, meta: result.meta });
}

// Service
async list(params: ListParams) {
  return repository.findAll(params);
}

// Repository
async findAll(params: ListParams) {
  const where = buildWhereClause(params.filters);
  const records = await prisma.internship.findMany({
    where,
    take: params.limit + 1, // Fetch one extra to check hasMore
    cursor: params.cursor ? { id: params.cursor } : undefined,
    orderBy: { createdAt: 'desc' },
  });
  
  const hasMore = records.length > params.limit;
  if (hasMore) records.pop();
  
  return {
    data: records,
    meta: {
      cursor: records.length > 0 ? records[records.length - 1].id : null,
      limit: params.limit,
      hasMore,
    },
  };
}
```

---

## 5. Things to Watch Out For

### 5.1 Common Mistakes

- ❌ Putting business logic in routes
- ❌ Putting database queries in services (use repositories)
- ❌ Forgetting to check ownership
- ❌ Not validating input (every endpoint needs validation)
- ❌ Exposing PII in responses
- ❌ Hardcoding secrets
- ❌ Using `any` type

### 5.2 Checklist Before Submitting

- [ ] Does the code follow the layered architecture?
- [ ] Are all inputs validated?
- [ ] Is authentication required? Is it enforced?
- [ ] Is authorization correct (role + ownership)?
- [ ] Are errors properly typed?
- [ ] Are tests written?
- [ ] Does TypeScript compile?
- [ ] Are naming conventions followed?

---

## 6. Communication

When reporting progress or asking questions:

- **Progress:** "Checkpoint 7 (Auth) — Implemented register route. Working on login route."
- **Blocked:** "Blocked on auth routes — need clarification on refresh token rotation strategy."
- **Decision needed:** "Should company registration require admin verification immediately or can it be deferred?"

---

*You have all the context you need in the docs. Read them thoroughly.*
