# CHECKPOINT 3: Prisma Schema & Migrations

**Prerequisites:** CHECKPOINT_2_DOCKER_ENV ✅

---

## Goal

Create the Prisma schema, generate the client, and create the initial database migration.

---

## Tasks

### 1. Install Prisma Dependencies

- [ ] `npm install @prisma/client`
- [ ] `npm install -D prisma`

### 2. Initialize Prisma

- [ ] `npx prisma init` — creates `prisma/schema.prisma`
- [ ] Configure datasource for PostgreSQL

### 3. Create Schema

- [ ] Define all models per `docs/learning/DATABASE_MODEL_EXPLAINED.md`:
  - `User` (with role enum, status enum)
  - `Student`
  - `Company`
  - `School`
  - `Internship`
  - `Application`
  - `ApplicationStatusHistory`
  - `AuditLog`
- [ ] Define enums: `UserRole`, `UserStatus`, `InternshipStatus`, `ApplicationStatus`, `CompanySize`, `SchoolType`, `InternshipType`
- [ ] Add all relations, indexes, unique constraints
- [ ] Add `@@map` for snake_case table names
- [ ] Add `@map` for snake_case column names

### 4. Create Seed Script

- [ ] Create `prisma/seed.ts`:
  - Admin user
  - Sample schools (3-5)
  - Sample companies (3-5)
  - Sample internships (5-10)
  - Sample students (5-10)
  - Sample applications

### 5. Run Migration

- [ ] `npx prisma migrate dev --name init` — creates initial migration
- [ ] `npx prisma generate` — generates Prisma client
- [ ] `npx prisma db seed` — runs seed script

### 6. Create Prisma Client Singleton

- [ ] Create `src/shared/lib/prisma.ts`:
  ```typescript
  import { PrismaClient } from '@prisma/client';
  
  const globalForPrisma = globalThis as unknown as {
    prisma: PrismaClient | undefined;
  };
  
  export const prisma = globalForPrisma.prisma ?? new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
  });
  
  if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;
  ```

---

## Forbidden Scope

- Do NOT implement any business logic, services, or routes
- Do NOT create API endpoints or middleware
- Do NOT write application-layer code beyond the Prisma client singleton
- Do NOT deploy migrations to production

---

## Acceptance Criteria

- [ ] All models are defined in schema.prisma
- [ ] Migration runs successfully
- [ ] Prisma client generates without errors
- [ ] Seed script populates test data
- [ ] Prisma Studio can view data (`npx prisma studio`)

---

## Estimated Time

4 hours
