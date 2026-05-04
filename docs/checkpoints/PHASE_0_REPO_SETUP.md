# PHASE 0: Repo Setup — Documentation & Structure

**Status:** ✅ Complete

This phase creates the entire documentation foundation. No application code is written.

---

## Tasks

- [x] Create root Markdown files (README, AGENTS, BIBLE, REFERENCE, API_CONTRACT, SECURITY, TESTING, NAMING, CHECKPOINT)
- [x] Create `docs/engineering/` — architecture decisions, error handling, data integrity, state machines, failure modes, external providers, Redis rules, ownership rules, known gaps, staging gate
- [x] Create `docs/api/` — response contract, route template, all module route contracts
- [x] Create `docs/security/` — threat model, authorization matrix, rate limiting, validation, privacy, public endpoint abuse rules
- [x] Create `docs/learning/` — guides for developers and agents
- [x] Create `docs/checkpoints/` — all checkpoint spec files
- [x] Create `docs/operations/` — operational runbooks
- [x] Create `.deepseek/INSTRUCTIONS.md`

## Files Created

See root directory and `docs/` for the complete list.

## Forbidden Scope

- Do NOT write any application code (no `.ts` or `.js` files)
- Do NOT create a Prisma schema or run migrations
- Do NOT install npm packages or create `package.json`
- Do NOT create routes, services, or repositories
- Do NOT create Docker files or configuration

---

## Next Phase

Proceed to **Checkpoint 0: Preflight** — Verify that all required tools are installed and the environment is ready.
