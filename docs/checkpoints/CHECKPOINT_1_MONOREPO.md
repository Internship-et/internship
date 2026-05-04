# CHECKPOINT 1: Monorepo Setup (Turborepo)

**Prerequisites:** CHECKPOINT_0_PREFLIGHT ✅

---

## Goal

Set up the Turborepo monorepo with TypeScript configuration, ESLint, and shared workspace tooling.

---

## Tasks

### 1. Initialize Turborepo

- [ ] Create root `package.json` with:
  ```json
  {
    "name": "internship-platform",
    "private": true,
    "scripts": {
      "dev": "turbo dev",
      "build": "turbo build",
      "lint": "turbo lint",
      "test": "turbo test",
      "typecheck": "turbo typecheck"
    },
    "packageManager": "npm@10.0.0"
  }
  ```
- [ ] Create `turbo.json` with pipeline configuration
- [ ] Create `packages/` directory for shared packages
- [ ] Create `apps/` directory for applications (currently just `api`)

### 2. Configure TypeScript

- [ ] Create root `tsconfig.json` with base config:
  ```json
  {
    "compilerOptions": {
      "target": "ES2022",
      "module": "ESNext",
      "moduleResolution": "bundler",
      "strict": true,
      "esModuleInterop": true,
      "skipLibCheck": true,
      "forceConsistentCasingInFileNames": true,
      "resolveJsonModule": true,
      "declaration": true,
      "declarationMap": true,
      "sourceMap": true
    }
  }
  ```
- [ ] Create `apps/api/tsconfig.json` extending root
- [ ] Create `packages/shared/tsconfig.json` extending root

### 3. Configure ESLint

- [ ] Create root `.eslintrc.js` with TypeScript rules:
  - No `any` types
  - No `// @ts-ignore`
  - No unused variables
  - Consistent return types
  - Prefer `const` over `let`
  - No console.log (use logger)
- [ ] Create `apps/api/.eslintrc.js`

### 4. Create Package Structure

- [ ] `apps/api/` — The Express backend application
- [ ] `packages/shared/` — Shared TypeScript types and utilities

### 5. Install Root Dependencies

- [ ] `turbo` (dev dependency)
- [ ] `typescript` (dev dependency)
- [ ] `eslint` (dev dependency)
- [ ] `@typescript-eslint/parser` (dev dependency)
- [ ] `@typescript-eslint/eslint-plugin` (dev dependency)
- [ ] `prettier` (dev dependency)

---

## Forbidden Scope

- Do NOT write any business logic or application code
- Do NOT create Docker or database configuration
- Do NOT install application dependencies (Express, Prisma, etc.)
- Do NOT create API routes or middleware

---

## Acceptance Criteria

- [ ] `npm run typecheck` passes on root
- [ ] `npm run lint` passes (no errors)
- [ ] Project structure matches specification
- [ ] TypeScript path aliases work (`@/` → `apps/api/src/`)

---

## Estimated Time

2-3 hours
