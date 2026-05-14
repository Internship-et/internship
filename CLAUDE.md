# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repository Context

Backend for the **Ethiopian High School Internship Platform** ("Indeed + Handshake for Ethiopian high schoolers"). Turborepo monorepo with a single deployable Express API and a shared package.

This repo is **rules-heavy** and **checkpoint-driven**. Documentation in the root is not optional reading — it defines the contract the code must satisfy. Before non-trivial changes, read in this order:

1. `AGENTS.md` — agent operating rules (file modification, prohibited actions, checkpoint protocol)
2. `BACKEND_ENGINEERING_BIBLE.md` and `BACKEND_IMPLEMENTATION_REFERENCE.md` — layered-architecture, middleware order, error model
3. `NAMING_CONVENTIONS.md` — kebab-case files, naming standards
4. `API_CONTRACT.md` — route contracts and response envelopes
5. `SECURITY_RULES.md` / `TESTING_RULES.md` when touching those areas
6. `CHECKPOINT_LOG.md` + the matching `docs/checkpoints/CHECKPOINT_X_*.md` for the active phase

The README is out of date — it claims "Phase 0, documentation only," but the code is well past that (phases 1–17 are committed). Trust `CHECKPOINT_LOG.md` for actual status.

## Common Commands

Run from the repo root unless noted. Turbo fans the script out across workspaces.

```bash
npm run dev          # turbo dev — starts apps/api via tsx watch
npm run build        # tsc build per workspace
npm run lint         # eslint across workspaces
npm run test         # vitest run across workspaces
npm run typecheck    # tsc --noEmit across workspaces
```

API-specific (run inside `apps/api/`, or via `npm -w @internship/api run <script>`):

```bash
npm run dev                          # tsx watch src/index.ts
npm run test:watch                   # vitest in watch mode
npm run test:coverage                # vitest with v8 coverage (thresholds: 80/75/80/80)
npx vitest run path/to/file.test.ts  # single file
npx vitest run -t "test name"        # single test by name
npm run db:migrate                   # prisma migrate dev
npm run db:generate                  # prisma generate (output: src/generated/prisma)
npm run db:seed                      # prisma db seed
npm run db:reset                     # prisma migrate reset
```

Local infrastructure:

```bash
docker compose up -d postgres redis test-db   # postgres:5432, redis:6379, test-db:5433
```

Tests connect to `test-db` on port **5433** (see `apps/api/vitest.config.ts` env block). `fileParallelism: false` is intentional — repository tests share one DB and would race otherwise. Do not enable parallelism without redesigning teardown.

## Architecture

### Monorepo layout

- `apps/api/` — the Express service (the only app today)
- `packages/shared/` — cross-workspace shared TS (currently a thin scaffold)
- Workspaces are referenced via `@internship/*` names.

### Modular monolith inside `apps/api/src/`

- `index.ts` → imports `server.ts` for side effect, also re-exports utilities for tests/programmatic use.
- `server.ts` → creates HTTP server, registers SIGTERM/SIGINT graceful shutdown (closes server, then Prisma, then Redis, with a 10s force-exit fallback).
- `app.ts` → `createApp()` factory. Middleware order is load-bearing and documented in the file header; match it exactly when adding middleware.
- `config/index.ts` → env validation at startup. `JWT_SECRET` must be ≥ 32 chars; `DATABASE_URL` is required; `CORS_ORIGINS` (preferred) falls back to legacy `CORS_ORIGIN` then `*`.
- `modules/<domain>/` — each domain (`auth`, `students`, `companies`, `internships`, `applications`, `schools`, `admin`, `health`) is a self-contained slice with `*.routes.ts`, `*.service.ts`, `*.repository.ts`, `*.schema.ts`, and `__tests__/`.
- `shared/middleware/` — request-id, cors, security headers, cache-control, rate limiter (Redis-backed, keyed by `prefix`), logging, validation, auth, error handler, 404 handler.
- `shared/errors/app-error.ts` — `AppError` hierarchy (`ValidationError`, `Unauthorized`, `Forbidden`, `NotFound`, `Conflict`, `Unprocessable`, `RateLimit`, `Internal`). Throw these from services; the global error middleware maps them to the response envelope.
- `shared/lib/` — `prisma.ts`, `redis.ts` (ioredis), `logger.ts` (pino). Import these — do not instantiate clients elsewhere.

### Layering rules (enforced by review, not by tooling)

- **Routes**: parse req, call service, return response. No business logic, no Prisma.
- **Services**: orchestration, business rules, cross-repository calls. Must not import `req`/`res`/`next` or any HTTP type.
- **Repositories**: Prisma only. No validation, no business logic.
- **Schemas**: Zod. Validation middleware consumes these.
- **Middleware**: pure functions or configured closures.

### Data layer

- PostgreSQL is the source of truth. Prisma schema at `apps/api/prisma/schema.prisma`. Generated client lives at `apps/api/src/generated/prisma` (custom output path — import from `../generated/prisma` patterns, not `@prisma/client` directly in app code unless that's already the convention in the file you're editing).
- Redis is for ephemeral state only: rate limit counters, OTPs, sessions, queues. Never use it as a primary store.
- Every schema change requires a paired migration in `apps/api/prisma/migrations/`.
- Don't query in loops — use `in` / batch queries.

### Auth & security

- bcrypt (cost ≥ 10), JWT HS256 with `JWT_SECRET`, access + refresh token split (`JWT_ACCESS_EXPIRES_IN` / `JWT_REFRESH_EXPIRES_IN`).
- All public endpoints go through the global rate limiter mounted in `app.ts`; health endpoints are explicitly skipped (k8s probes).
- All user-facing input must be Zod-validated. Never log passwords, tokens, or PII (pino redaction is configured in the logger).

## Conventions to Preserve

- **TypeScript strict.** No `any`, no `// @ts-ignore`. JSDoc on every exported function.
- **kebab-case filenames** (`auth.service.ts`, not `AuthService.ts`).
- Test files mirror source under `__tests__/` siblings.
- ESM throughout — note the `.js` extensions in TypeScript imports (e.g., `import { createApp } from './app.js'`). This is required for Node ESM resolution after `tsc` build; keep the pattern.
- Don't add scope beyond the active checkpoint. When in doubt, check `CHECKPOINT_LOG.md` and the matching `docs/checkpoints/CHECKPOINT_*.md` spec.
