# AGENTS.md — AI Agent Instructions

> **Purpose:** This file instructs AI coding agents (Cursor, Claude, Copilot, etc.) on how to operate within this repository. Every agent **must** read this file before making any changes.

---

## 1. Always Read This First

Before creating, editing, or deleting any file, the agent must:

1. Read this file (`AGENTS.md`)
2. Read `BACKEND_ENGINEERING_BIBLE.md`
3. Read `BACKEND_IMPLEMENTATION_REFERENCE.md`
4. Read `NAMING_CONVENTIONS.md`
5. Read the relevant checkpoint file in `docs/checkpoints/`
6. Read `CHECKPOINT_LOG.md` to confirm current state

## 2. Authority & Scope

- The agent operates under the **Phase 0 rules** until `CHECKPOINT_LOG.md` indicates otherwise.
- **Phase 0 = Documentation only.** No application code, no Prisma schema, no routes, no migrations, no dependencies.
- In future phases, the agent **must not** skip phases, jump ahead, or implement features not specified in the current checkpoint.
- The agent **must not** install dependencies unless explicitly instructed in the current checkpoint.

## 3. Mandatory Rules

### 3.1 File Modification

- Always read the file before editing it.
- Use `multi_edit` for batch edits to the same file.
- Never leave a file in a broken state.
- Never remove or modify `CHECKPOINT_LOG.md` without updating the status line.

### 3.2 Code Style

- All application code **must** be TypeScript (strict mode).
- All file names **must** follow `kebab-case` conventions (see `NAMING_CONVENTIONS.md`).
- Every exported function **must** have a JSDoc comment.
- Every module **must** have a clear, single responsibility.

### 3.3 Architecture Rules

- Routes **must not** contain business logic.
- Services **must not** import HTTP-related modules (`req`, `res`, `next`).
- Repositories **must not** contain business logic or validation.
- Schemas **must** be defined with Zod.
- Middleware **must** be pure functions or closures with clear configuration.

### 3.4 Database Rules

- PostgreSQL is the source of truth.
- Redis is for temporary state only (rate limits, OTPs, sessions, queues).
- All Prisma schema changes **must** be paired with a migration.
- Never query the database in a loop (use `in` / batch queries).

### 3.5 Security Rules

- Read `SECURITY_RULES.md` before implementing any auth-related code.
- All passwords **must** be hashed with bcrypt (cost factor ≥ 10).
- JWTs **must** use RS256 or HS256 with strong secrets.
- All user-facing input **must** be validated with Zod.
- Rate limiting **must** be applied to all public endpoints.
- Never log sensitive data (passwords, tokens, PII).

### 3.6 Testing Rules

- Read `TESTING_RULES.md` before writing tests.
- Every service function **must** have unit tests.
- Every route **must** have integration tests.
- Test files **must** mirror source file structure under `__tests__/`.

## 4. Checkpoint Protocol

1. Before starting work, read `CHECKPOINT_LOG.md` to confirm the current checkpoint.
2. Find the corresponding spec file in `docs/checkpoints/CHECKPOINT_X_*.md`.
3. Follow the spec exactly — do not add scope.
4. After completing the checkpoint, update `CHECKPOINT_LOG.md`:

```
| CHECKPOINT_X | [CHECKPOINT NAME] | ✅ COMPLETE | YYYY-MM-DD |
```

5. If blocked, log the blocker in `docs/engineering/KNOWN_GAPS_REGISTER.md` and notify.

## 5. Prohibited Actions

The agent **must not**:

- Write application code during Phase 0
- Create Prisma schema before CHECKPOINT_3
- Create routes before CHECKPOINT_4
- Install npm packages without checkpoint instruction
- Run database migrations without reading `MIGRATION_RULES.md`
- Expose API keys, secrets, or credentials in code
- Use `any` type in TypeScript
- Ignore TypeScript errors (no `// @ts-ignore`)
- Write synchronous database queries in request handlers
- Commit directly to `main` branch (always use feature branches)
- Modify checkpoint files retroactively without team approval

## 6. Communication Style

- Report progress in terms of checkpoints and tasks.
- Use exact file paths when referencing files.
- When suggesting changes, provide the exact diff or edit.
- If something is unclear, ask — do not assume.

## 7. Learning Resources

For agents unfamiliar with the domain or stack, read:

- `docs/learning/BACKEND_LEARNING_GUIDE.md`
- `docs/learning/HOW_THE_SYSTEM_WORKS.md`
- `docs/learning/DATABASE_MODEL_EXPLAINED.md`
- `docs/learning/AUTH_AND_ROLES_EXPLAINED.md`

---

*Last updated: Phase 17*
