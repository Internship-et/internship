# BACKEND_LEARNING_GUIDE.md

> **A guide for developers new to this project.** Read this to understand the stack, architecture, and development workflow.

---

## 1. Prerequisites

Before working on this project, you should be comfortable with:

- **TypeScript** — types, interfaces, generics, async/await
- **Node.js** — Express, middleware patterns, request/response cycle
- **PostgreSQL** — basic SQL, relationships, indexes
- **Prisma** — schema definition, migrations, queries
- **Redis** — basic key-value operations, TTL
- **Docker** — containers, docker-compose
- **Git** — branching, merging, PRs

---

## 2. Project Architecture (Quick Overview)

```
┌────────────────────────────────────────────────┐
│                   Routes                        │
│  (HTTP handlers — parse, delegate, respond)     │
├────────────────────────────────────────────────┤
│                 Middleware                      │
│  (Auth, validation, rate limiting, logging)     │
├────────────────────────────────────────────────┤
│                 Services                        │
│  (Business logic — orchestrate, validate)       │
├────────────────────────────────────────────────┤
│               Repositories                     │
│  (Database access — Prisma queries)            │
├────────────────────────────────────────────────┤
│          PostgreSQL + Redis                    │
│  (Source of truth + temporary state)           │
└────────────────────────────────────────────────┘
```

---

## 3. Key Files to Know

| File | Purpose |
|------|---------|
| `BACKEND_ENGINEERING_BIBLE.md` | Core principles and architecture |
| `BACKEND_IMPLEMENTATION_REFERENCE.md` | Quick implementation reference |
| `AGENTS.md` | AI agent operating instructions |
| `NAMING_CONVENTIONS.md` | Naming standards |
| `SECURITY_RULES.md` | Security requirements |
| `TESTING_RULES.md` | Testing requirements |
| `CHECKPOINT_LOG.md` | Current phase and progress |
| `docs/engineering/ERROR_HANDLING_CONTRACT.md` | Error handling specification |
| `docs/engineering/DATABASE_INTEGRITY_RULES.md` | Database rules |
| `docs/engineering/STATE_MACHINES.md` | State machine definitions |
| `docs/engineering/CHECKPOINT_PROCESS.md` | How checkpoints work |

---

## 4. Development Workflow

### 4.1 Daily Workflow

1. Pull latest from `main` branch
2. Read `CHECKPOINT_LOG.md` to understand current phase
3. Create a feature branch: `git checkout -b feature/checkpoint-X-task`
4. Implement changes following checkpoint spec
5. Write tests
6. Run `npm run lint` and `npm run typecheck`
7. Run tests: `npm test`
8. Commit: `git commit -m "feat(module): description"`
9. Push and create PR
10. Wait for CI to pass

### 4.2 Checkpoint Workflow

See `docs/engineering/CHECKPOINT_PROCESS.md` for the detailed checkpoint workflow.

---

## 5. Common Tasks

### 5.1 Adding a New Endpoint

1. Define the schema in `<module>.schema.ts`
2. Add the query to `<module>.repository.ts`
3. Add business logic to `<module>.service.ts`
4. Add the route to `<module>.routes.ts`
5. Add tests in `<module>/__tests__/`
6. Register the route in `app.ts` (if new module)

### 5.2 Adding a New Database Table

1. Add the model to `schema.prisma`
2. Run `npx prisma migrate dev --name description`
3. Add repository methods in the relevant repository file
4. Update service methods as needed

### 5.3 Adding a New Middleware

1. Create the middleware file in `src/shared/middleware/`
2. Add it to the middleware stack in `app.ts`
3. Write tests
4. Document the middleware

---

## 6. Stack Details

### 6.1 TypeScript

- Strict mode enabled
- Path aliases: `@/` maps to `src/`
- ES modules (`"type": "module"` in package.json)

### 6.2 Express

- Modular monolith with route-level middleware
- Async handler wrapper for all route handlers
- Global error handler at the end of the middleware stack

### 6.3 Prisma

- Schema in `prisma/schema.prisma`
- Migrations in `prisma/migrations/`
- Client in `src/shared/lib/prisma.ts` (singleton)
- Seed script in `prisma/seed.ts`

### 6.4 Redis

- Client in `src/shared/lib/redis.ts` (singleton)
- Used for: rate limiting, OTPs, sessions, queues
- Fallback to in-memory if Redis is unavailable

---

## 7. Helpful Commands

```bash
# Development
npm run dev            # Start dev server with hot reload
npm run build          # Build TypeScript
npm run lint           # Run ESLint
npm run typecheck      # Run TypeScript compiler check

# Database
npx prisma migrate dev        # Create migration
npx prisma migrate deploy     # Apply migrations
npx prisma generate           # Generate Prisma client
npx prisma studio             # Open Prisma Studio (GUI)
npx prisma db seed            # Run seed script

# Docker
docker compose up -d         # Start services
docker compose down          # Stop services
docker compose logs -f       # View logs

# Testing
npm test                     # Run all tests
npm run test:watch           # Run tests in watch mode
npm run test:coverage        # Run tests with coverage
```

---

*Welcome to the team. Read the docs, ask questions, and build great things.*
