# KNOWN_GAPS_REGISTER.md

> **Register of known gaps, unresolved issues, and technical debt.** Add entries here when a gap is identified during implementation.

---

## Format

```
## [YYYY-MM-DD] — [Short Title]

**Type:** Gap | Bug | Tech Debt | Blocker | Decision Pending
**Severity:** Low | Medium | High | Critical
**Source:** Checkpoint X | Code Review | Bug Report
**Status:** Open | In Progress | Resolved | Won't Fix

**Description:**
Clear description of the gap.

**Impact:**
What breaks or is affected?

**Proposed Solution:**
Ideas for resolution.

**Owner:**
*Unassigned*
```

---

---

## Launch Readiness Assessment (CP17 — 2026-05-12)

The following gaps are **documented and accepted as deferred work**. They are **not launch blockers**. Each gap is tracked for post-launch resolution.

| # | Gap | Severity | Launch Blocker? | Rationale |
|---|-----|----------|----------------|----------|
| 1 | Email notification service (no provider integrated) | Medium | 🟢 No — deferred | Core flows work without email. Admin accepts `notifyUser` flag silently. Users check status via API. Email integration is a post-launch feature requiring provider selection (SendGrid/SES/Mailgun). |
| 2 | Document upload endpoint missing | Medium | 🟢 No — deferred | `resumeUrl` field exists in schema; uploads can be set out-of-band (admin enters URL directly). Upload endpoint is a post-launch feature. |
| 3 | Password reset token delivery unavailable | Medium | 🟢 No — deferred | Admins can activate/reset users manually via `PATCH /admin/users/:userId/status`. Self-service password reset requires email provider. |
| 4 | Account verification flow not implemented | Medium | 🟢 No — deferred | New self-registered users start `PENDING`; admin activates via admin module. Email verification is a post-launch feature. |
| 5 | Application status update message not persisted | Low | 🟢 No — minor | Field accepted at API boundary but silently ignored. Does not break any flow. Fix requires Prisma schema migration (post-launch). |
| 6 | Cross-module audit logging (application status changes) | Low | 🟢 No — minor | Admin module has per-action `AuditLog`. Other modules use domain-specific history tables. Shared audit service deferred to post-launch. |
| 7 | Admin async report generation deferred | Low | 🟢 No — minor | Synchronous reports work for current dataset sizes. Async infrastructure (job queue, polling) deferred to post-launch. |
| 8 | COEP header intentionally skipped | Won't Fix | 🟢 No — documented decision | Would break CDN/third-party resource loading. No plan to enable. Documented in security headers middleware. |
| 9 | Dashboard fillRate/averageTimeToHire placeholders | Low | 🟢 No — minor | Hardcoded placeholder values. Requires persistent analytics infrastructure (post-launch). |

**Assessment:** All known gaps are either resolved, accepted deferred work, or documented won't-fix decisions. **None block production launch.**

---

## Current Gaps

## 2026-05-04 — Malformed Checkpoint Specifications

**Type:** Blocker
**Severity:** High
**Source:** Repository Documentation Sweep
**Status:** Open

**Description:**
Several checkpoint files do not match their filenames or expected implementation scope. `docs/checkpoints/CHECKPOINT_7_AUTH.md` duplicates Rate Limiting, `docs/checkpoints/CHECKPOINT_9_STUDENTS.md` duplicates Companies, `docs/checkpoints/CHECKPOINT_12_APPLICATIONS.md` duplicates Internships, `docs/checkpoints/CHECKPOINT_14_ADMIN.md` duplicates Schools, and `docs/checkpoints/CHECKPOINT_16_PRODUCTION_READINESS.md` duplicates Tests.

**Resolved sub-issue — Checkpoint 4 API Shell spec restored:**
`docs/checkpoints/CHECKPOINT_4_API_SHELL.md` previously contained a duplicate of Core Utilities content. It has been restored with a valid API Shell specification (Express app factory, middleware stack, health routes, server lifecycle). The API Shell has been implemented and verified. `CHECKPOINT_LOG.md` now marks Phase 4 as API Shell ✅ COMPLETE. Path (b) from the original resolution options was chosen.

**Resolved sub-issue — Checkpoint 5 Core Utilities attribution:**
The `CHECKPOINT_LOG.md` previously listed Phase 5 / Checkpoint 5 as "(reserved)". The checkpoint spec `docs/checkpoints/CHECKPOINT_5_CORE_UTILITIES.md` was always a valid Core Utilities spec. The implementation (error classes, logger, async handler, pagination helpers, Express types, Redis client, config module) is now verified complete. `CHECKPOINT_LOG.md` updated: Phase 5 / Checkpoint 5 = Core Utilities ✅ COMPLETE.

**Resolved sub-issue — Checkpoint 7 Auth spec restored:**
`docs/checkpoints/CHECKPOINT_7_AUTH.md` previously contained a duplicate of Rate Limiting content. It has been restored with a valid Auth System specification (register, login, refresh, logout, forgot-password, reset-password, me, auth middleware, authorize middleware, JWT/bcrypt/Redis session management). Approval for implementation is pending.

**Resolved sub-issue — Checkpoint 9 Student spec restored:**
`docs/checkpoints/CHECKPOINT_9_STUDENTS.md` previously contained a duplicate of Companies (Checkpoint 10) content. It has been restored with a valid Student Module specification (student profile CRUD, admin listing, profile visibility rules, student application listing, first-time profile creation via PATCH). Scope explicitly defers the recommendations endpoint to Checkpoint 11+ and forbids Prisma schema changes, auth/JWT modifications, and dependency installs.

**Resolved sub-issue — Checkpoint 12 Application spec restored:**
`docs/checkpoints/CHECKPOINT_12_APPLICATIONS.md` previously contained a duplicate of Internships (Checkpoint 11) content. It has been restored with a valid Application Module specification covering: role-scoped listing (`GET /applications`), detail view (`GET /applications/:id`), status management with state machine enforcement (`PATCH /applications/:id/status`), withdrawal (`POST /applications/:id/withdraw`), and immutable status history via `ApplicationStatusHistory` model. Scope explicitly does NOT re-implement or modify the CP11 apply endpoint, does NOT implement email notifications (deferred — no provider), and forbids Prisma schema changes, auth/rate-limit/validation/error middleware changes, and CP13+ school/admin work.

**Resolved sub-issue — Checkpoint 14 Admin spec restored AND implemented:**
`docs/checkpoints/CHECKPOINT_14_ADMIN.md` previously contained a duplicate of Schools (Checkpoint 13) content. It has been restored with a valid Admin Module specification and fully implemented (2025-07-13):
- 5 endpoints: `GET /admin/dashboard`, `GET /admin/users`, `PATCH /admin/users/:userId/status`, `GET /admin/audit-logs`, `GET /admin/reports`
- All ADMIN-only with authenticate + authorize('ADMIN') (rest parameters)
- Rate limited: 200 req/15min keyed by user ID
- Repository: 18 methods including `createAuditLog` with ipAddress/userAgent
- Service: 5 functions with Promise.all parallelization, self-suspension guard, CSV serialization
- 74 tests (31 service + 43 route), typecheck ✅, lint ✅, full suite 453 tests passing
- Scope: No Prisma schema changes, no middleware changes, no dependency installs
- Known gaps: email notifications not sent (no provider), async report generation deferred, persistent analytics model deferred, fillRate/averageTimeToHire hardcoded as placeholders

**Impact:**
All checkpoint spec files are now valid. CP16 has been restored with a valid Production Readiness specification. No further spec restoration is needed.

**Resolved sub-issue — Checkpoint 16 Production Readiness spec restored:**
`docs/checkpoints/CHECKPOINT_16_PRODUCTION_READINESS.md` previously contained a duplicate of Tests (Checkpoint 15) content. It has been restored with a valid Production Readiness specification covering: production configuration audit, health/readiness/liveness review, metrics/observability plan, error tracking plan, security header and cache-control audit, rate limit tier audit, dependency scanning and CI hardening, Docker production readiness, backup automation, load/performance benchmark plan, documentation verification, and cross-cutting verifications. Scope explicitly allows middleware/config/CI/Dockerfile changes but forbids new routes, Prisma schema changes, migrations, production deployment, provider integrations, and new npm dependencies. CP16 remains ⏳ PENDING.

**Implementation Status (2026-05-12):**
CP16 has been fully implemented in a single pass. All code changes, documentation updates, and test additions have been verified. See `CHECKPOINT_LOG.md` for final status.

**Owner:**
*Unassigned*

---

## 2025-05-15 — Application Status Update Message Not Persisted

**Type:** Gap
**Severity:** Low
**Source:** Checkpoint 12 — Application Module
**Status:** Open

**Description:**
`updateApplicationStatusSchema` accepts a `message` field (max 1000 chars, trimmed, optional) on `PATCH /applications/:applicationId/status`. This field is intended to carry a shared message visible to both the student and the company (e.g., "Congratulations! You are moving to the next stage."). However, no corresponding database column exists on either the `Application` or `ApplicationStatusHistory` model. The field is accepted at the API boundary but silently ignored — it is neither stored nor returned in subsequent reads.

**Impact:**
Any `message` value sent in a status update request is lost. The API contract specifies that this field should be visible to both parties, but persisted reads will not include it. Clients that depend on retrieving the message later will receive stale or empty data.

**Proposed Solution:**
Add a `message` or `sharedNote` column to the `Application` model (or a new dedicated model) via a future Prisma schema migration:
1. Add `message String? @map("message")` to the `Application` model in `schema.prisma`
2. Generate and run the migration
3. Update `application.repository.ts` to include `message` in `updateStatus` writes
4. Update `application.service.ts` `updateStatus()` to pass `data.message` through
5. Update response shaping to include `message` in the response payload

**Owner:**
*Unassigned*

---

## 2025-05-15 — Application Status Change Audit Log Entries Deferred

**Type:** Gap
**Severity:** Low
**Source:** Checkpoint 12 — Application Module
**Status:** Open

**Description:**
The application status update endpoint (`PATCH /applications/:applicationId/status`) creates `ApplicationStatusHistory` records for every status transition, providing an immutable audit trail of status changes. However, full audit log entries (actor identity, action type, resource identifier, IP address, user-agent, old/new values in JSON format) as defined by the `AuditLog` model in `schema.prisma` are not created. No shared audit facility exists yet to create these entries consistently across all modules.

**Impact:**
Application status changes are traceable via `ApplicationStatusHistory`, but there is no centralized audit log that captures all system actions (status changes, profile updates, admin actions) in a single queryable table. Cross-module auditing and compliance reporting are not possible. Note: The Admin module (CP14) implements per-action `AuditLog` creation for user status changes, but no shared audit service exists yet for cross-module use.

**Proposed Solution:**
Build a shared audit facility as a separate checkpoint or task:
1. Create a shared `AuditService` or `AuditRepository` that wraps `AuditLog` creation
2. Wire it into `application.service.ts` `updateStatus()` and `withdraw()`
3. Wire it into other modules (auth, company, internship) for critical actions
4. Consider middleware-based automatic audit logging for common patterns

**Owner:**
*Unassigned*

---

## 2025-05-15 — Admin User Status Change Email Notification Unavailable

**Type:** Gap
**Severity:** Medium
**Source:** Checkpoint 14 — Admin Module
**Status:** Open

**Description:**
The `PATCH /admin/users/:userId/status` endpoint accepts a `notifyUser` boolean field (default `true`) intended to notify users when their account is activated or suspended. No email provider is integrated, so the `notifyUser` parameter is accepted at the API boundary but no notification is sent. This is a shared dependency with other deferred email features (application status changes, password reset).

**Impact:**
Users whose status is changed by an admin receive no notification. They must discover the status change by attempting to log in (suspended users) or by manual inquiry. The `notifyUser` flag is silently ignored.

**Proposed Solution:**
Integrate an email provider (SendGrid, AWS SES, Mailgun) in a future checkpoint. The `notifyUser` field in `updateUserStatusSchema` is already defined and will be wired when the provider is available.

**Owner:**
*Unassigned*

---

## 2025-05-15 — Admin Async Report Generation Deferred

**Type:** Gap
**Severity:** Low
**Source:** Checkpoint 14 — Admin Module
**Status:** Open

**Description:**
The API contract (`docs/api/ADMIN_ROUTES.md`) specifies that report generation may be asynchronous for large datasets in the future. The current implementation generates reports synchronously, suitable for moderate dataset sizes. No async infrastructure (job queue, polling endpoint, status tracking) has been implemented.

**Impact:**
Large report requests may cause request timeouts or poor user experience under heavy load. There is no mechanism to poll for report completion or retrieve previously generated reports.

**Proposed Solution:**
Implement async report generation in a future checkpoint:
1. Create a `ReportRequest` model or Redis-based job queue
2. Generate reports in background worker processes
3. Implement a report status polling endpoint
4. Add report caching and expiration

**Owner:**
*Unassigned*

---

## YYYY-MM-DD — Application Status Change Email Notifications Unavailable

**Type:** Gap
**Severity:** Medium
**Source:** Checkpoint 12 — Application Module
**Status:** Open

**Description:**
The API contract (`docs/api/APPLICATION_ROUTES.md`) specifies that students should receive email notifications on status changes (e.g., when an application is reviewed, shortlisted, accepted, or rejected). The `INTERNSHIP_APPLICATION_FLOW_EXPLAINED.md` document lists notification triggers for every status transition. However, no email provider is integrated into the platform.

**Impact:**
Status changes succeed without sending any notification to the student or company. Users must manually check the application status by calling `GET /applications`. This reduces user engagement and creates a poor experience where students are unaware of important updates to their applications.

**Proposed Solution:**
Integrate an email provider (SendGrid, AWS SES, Mailgun) in a future checkpoint. The notification abstraction layer is already defined in `docs/engineering/EXTERNAL_PROVIDER_RULES.md` with a placeholder `EmailService` interface. Implementation steps:
1. Implement the `EmailService` interface with the chosen provider
2. Wire notifications into the `application.service.ts` `updateStatus()` and `withdraw()` functions
3. Add provider health checks to the `/health` endpoint
4. Test with sandbox/mock provider

**Owner:**
*Unassigned*

---

## YYYY-MM-DD — Password Reset Token Delivery Unavailable

**Type:** Gap
**Severity:** Medium
**Source:** Checkpoint 7
**Status:** Open

**Description:**
The password reset flow generates a cryptographically random token and stores its hash in Redis (`password-reset:{tokenHash}` → 15 min TTL), but no email provider is integrated to deliver the reset link/token to the user. The `forgotPassword` endpoint always returns a generic success message and does not expose the raw token in the response.

**Impact:**
Password reset is technically implemented but unusable from the user's perspective until an email delivery mechanism exists. Developers can test the flow by generating a known token locally, hashing it with the same `hashToken` function, and writing the Redis key manually, then calling `/auth/reset-password` with the known token.

**Proposed Solution:**
Integrate an email provider (SendGrid, AWS SES, Mailgun) in a future checkpoint or as a standalone task after the core module checkpoints are complete.

**Owner:**
*Unassigned*

---

## YYYY-MM-DD — Account Verification Flow Not Implemented

**Type:** Gap
**Severity:** Medium
**Source:** Checkpoint 7
**Status:** Open

**Description:**
Registration creates users with `status: PENDING` and `isVerified: false`, but no verification endpoint, email verification, or OTP flow exists in Checkpoint 7. The `authenticate` middleware rejects non-`ACTIVE` users, so newly self-registered users cannot access protected routes.

**Impact:**
New self-registered users are effectively locked out until an admin (or future automated verification system) activates their account. Only seed users or admin-created users with status `ACTIVE` can authenticate and use the system.

**Proposed Solution:**
Implement an email verification flow (verify token → set status to `ACTIVE`) in a future checkpoint. Alternatively, the admin module (Checkpoint 14) could provide account activation capabilities.

**Owner:**
*Unassigned*

---

## YYYY-MM-DD — Missing Test Database Infrastructure

**Type:** Gap
**Severity:** Critical
**Source:** Checkpoint 15 — Tests Phase
**Status:** Resolved

**Description:**
No test database service existed in `docker-compose.yml` (only `postgres` for development). The `vitest.config.ts` specified `DATABASE_URL=postgresql://test:test@localhost:5432/test` but no matching Docker service or database existed. No DB setup/teardown utilities or test data factories had been implemented.

**Resolution:**
CP15 completed with all 829 tests passing (34 files), 86.11% statement coverage.
- ✅ `test-db` service added to `docker-compose.yml` (postgres 16-alpine on port 5433)
- ✅ `src/test/setup.ts` with globalSetup running Prisma migrations
- ✅ `src/test/global-setup.ts` applying migrations once per test session
- ✅ 7 factory files created (`src/test/factories/`)
- ✅ 6 repository test files written across all modules
- ✅ CI pipeline (`.github/workflows/ci.yml`) runs tests automatically
- ✅ `src/test/**` excluded from coverage in `vitest.config.ts`
- ✅ Lint errors in test files resolved
- ✅ Coverage thresholds met: 86.11% statements, 76.93% branches, 93.79% functions, 87.45% lines

---

## 2025-07-14 — CP15 Coverage Gap: Repository Tests Blocked

**Type:** Blocker
**Severity:** Critical
**Source:** Checkpoint 15 — Tests Phase
**Status:** Resolved

**Description:**
Checkpoint 15 (Tests) was BLOCKED. Repository tests could not be written, coverage thresholds could not pass, no CI pipeline existed, lint errors were present in test files, and test infrastructure was incomplete.

**Resolution:**
All acceptance criteria for CP15 have been met:
1. ✅ Repository tests — 6 files written against real test database (postgres 16-alpine on port 5433)
2. ✅ Coverage thresholds met — 86.11% stmts, 76.93% branches, 93.79% funcs, 87.45% lines
3. ✅ CI pipeline — GitHub Actions workflow runs lint → typecheck → test:coverage on push/PR
4. ✅ Lint errors — resolved in all test files
5. ✅ `src/test/**` excluded from coverage
6. ✅ Full suite: 829 tests passing (34 files)
7. ✅ CP15 marked ✅ COMPLETE in CHECKPOINT_LOG.md

---

## Resolved Gaps

## 2025-05-04 — Checkpoint 5 Core Utilities Attribution

**Type:** Gap
**Severity:** Low
**Source:** Checkpoint Log Reconciliation
**Status:** Resolved

**Description:**
`CHECKPOINT_LOG.md` listed Phase 5 / Checkpoint 5 as "(reserved)" despite `docs/checkpoints/CHECKPOINT_5_CORE_UTILITIES.md` containing a valid Core Utilities specification. The implementation was already present in the codebase.

**Resolution:**
`CHECKPOINT_LOG.md` updated to mark Phase 5 / Checkpoint 5 as Core Utilities ✅ COMPLETE with completion date 2025-05-04. All 7 utility files verified against the spec.

---

## YYYY-MM-DD — Checkpoint 7 Auth Spec Restored

**Type:** Gap
**Severity:** High
**Source:** Repository Documentation Sweep
**Status:** Resolved

**Description:**
`docs/checkpoints/CHECKPOINT_7_AUTH.md` was malformed — it contained the Rate Limiting (Checkpoint 8) spec instead of the Auth System spec.

**Resolution:**
`docs/checkpoints/CHECKPOINT_7_AUTH.md` has been restored with a valid Auth System specification covering: register, login, refresh, logout, forgot-password, reset-password, GET /auth/me, PATCH /auth/me (base fields), authenticate middleware, authorize middleware, JWT access/refresh tokens, bcrypt password hashing (cost factor 10), Redis session management with sorted-set index and max-5-session eviction, and failed-login lockout. Scope explicitly excludes Checkpoint 8 concerns (rate limiting, security headers, CORS hardening), domain modules, and Prisma schema changes.

---

## YYYY-MM-DD — Checkpoint 9 Student Spec Restored

**Type:** Gap
**Severity:** High
**Source:** Repository Documentation Sweep
**Status:** Resolved

**Description:**
`docs/checkpoints/CHECKPOINT_9_STUDENTS.md` was malformed — it contained the Companies Module (Checkpoint 10) spec instead of the Student Module spec.

**Resolution:**
`docs/checkpoints/CHECKPOINT_9_STUDENTS.md` has been restored with a valid Student Module specification covering: student profile CRUD (repository, service, routes), admin listing with search/filter/pagination, profile visibility rules (email/phone/resumeUrl visible only to SELF and ADMIN), first-time profile creation via PATCH (upsert pattern), student application listing (read-only), and comprehensive test requirements. Scope explicitly defers the recommendations endpoint to Checkpoint 11+ and forbids Prisma schema changes, auth/JWT modifications, and dependency installs.

---

*Gaps are not failures — they are opportunities to improve. Document them honestly.*
