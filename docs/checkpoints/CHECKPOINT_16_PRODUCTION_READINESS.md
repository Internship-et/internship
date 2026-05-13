# CHECKPOINT 16: Production Readiness

**Prerequisites:** CHECKPOINT_15_TESTS ✅

---

## Goal

Audit, harden, and verify the platform for production deployment. This checkpoint does **not** deploy to production — it ensures everything is production-ready so that Checkpoint 17 (Staging Remediation & Launch) can proceed safely.

---

## Existing Artifacts (Already Built)

The following production-readiness infrastructure already exists and should be **audited and verified** (not rebuilt):

### Monitoring & Health
- ✅ `GET /health` — Overall system health with dependency status, uptime, memory, version
- ✅ `GET /health/ready` — Readiness probe (DB connectivity check)
- ✅ `GET /health/live` — Liveness probe (process alive check)
- ✅ Dependency monitoring: PostgreSQL + Redis connectivity checks with `healthy`/`unhealthy`/`degraded` states
- ✅ `status: 'ok' | 'degraded' | 'down'` overall health classification
- ✅ Graceful degradation: Redis down → in-memory fallback, DB down → 503

### Security Middleware
- ✅ Security headers (HSTS 1y, X-Content-Type-Options, X-Frame-Options DENY, X-XSS-Protection, CSP `self`, Referrer-Policy)
- ✅ CORS middleware (native, dynamic origin validation, Vary header, credentials with explicit origins)
- ✅ Rate limiting (Redis sliding window via ZSET + MULTI/EXEC, in-memory Map fallback, X-RateLimit-* headers, Retry-After)
- ✅ Per-route rate limit tiers: global (100/15min IP), auth (20/15min IP), password-reset (5/15min IP), admin (200/15min user-ID), application (10/15min user-ID)

### Error Handling
- ✅ Global error handler (404 + 500, AppError typed subclasses, requestId correlation, no stack traces to client)
- ✅ Standard error response shape: `{ success, error: { code, message, details?, requestId } }`
- ✅ Error codes: VALIDATION_ERROR, UNAUTHORIZED, FORBIDDEN, NOT_FOUND, CONFLICT, UNPROCESSABLE_ENTITY, RATE_LIMIT_EXCEEDED, INTERNAL_ERROR, SERVICE_UNAVAILABLE

### Logging & Privacy
- ✅ Structured JSON logging (Pino) with request ID correlation via child loggers
- ✅ PII redaction: `req.headers.authorization`, `req.headers.cookie`, `body.password`, `body.token`
- ✅ Request logging middleware (duration, status-based log levels)
- ✅ `PRIVACY_AND_LOGGING_RULES.md` — documented PII handling rules, anonymization guidelines, logging policies

### Infrastructure & Operations
- ✅ Docker multi-stage build (node:20-alpine, npm ci, tsc build, dist-only runner)
- ✅ docker-compose.yml (postgres 16-alpine, redis 7-alpine, test-db, api)
- ✅ Graceful shutdown (SIGTERM/SIGINT → stop accepting → drain → Prisma disconnect → Redis disconnect → 10s force exit)
- ✅ Config validation at startup (DATABASE_URL, JWT_SECRET required; REDIS_URL optional with fallback)
- ✅ CI pipeline (GitHub Actions: checkout → setup-node 22 → npm ci → Prisma generate → migrate deploy → lint → typecheck → test:coverage)
- ✅ `DEPLOYMENT_READINESS.md` — Pre-deployment checklist, blue-green deployment, Docker deployment, rollback plan, monitoring thresholds
- ✅ `STAGING_RUNBOOK.md` — Staging environment operations, smoke tests, troubleshooting
- ✅ `ENVIRONMENT_VARIABLES.md` — Required/optional vars, environment-specific defaults, secrets management
- ✅ `EXTERNAL_PROVIDERS.md` — Provider abstraction interfaces (Email, SMS, File Storage, Error Tracking)
- ✅ `BACKUP_AND_RESTORE.md` — pg_dump/pg_restore commands, Docker backup, automated script template, PITR plan
- ✅ `INCIDENT_RESPONSE.md` — SEV1–SEV4 definitions, response flow, runbooks, communication templates
- ✅ `PRODUCTION_FAILURE_MODE_RULES.md` — Graceful degradation, circuit breaker, health check shape, retry policy
- ✅ `STAGING_GATE.md` — Functional/integration/performance/security/code-quality/documentation verification checklist
- ✅ Threat model (STRIDE framework, assets, mitigations, trust boundaries, data flows)
- ✅ `KNOWN_GAPS_REGISTER.md` — Gap tracking, resolutions, decision log

### Test Infrastructure
- ✅ 829 tests (34 files) passing with 86.11% statement coverage
- ✅ Test factories (7 files: user, student, company, internship, application, audit-log, school)
- ✅ Mock auth utilities (mockAuthenticate, mockAuthorize, token generators)
- ✅ Test DB service (postgres 16-alpine on port 5433, migrations applied via global-setup)
- ✅ CI pipeline runs tests automatically

---

## Tasks

### 1. Production Configuration Audit

- [ ] Verify all environment variables documented in `ENVIRONMENT_VARIABLES.md` match the `config/index.ts` implementation
- [ ] Ensure `JWT_SECRET` minimum length is enforced (≥ 32 chars)
- [ ] Ensure `REDIS_URL` is correctly documented as optional (with in-memory fallback) — current doc lists it as required
- [ ] Verify `CORS_ORIGIN` vs `CORS_ORIGINS` naming consistency between docs and config
- [ ] Document the `API_PREFIX` variable in `ENVIRONMENT_VARIABLES.md`
- [ ] Verify production environment variable template (`.env.prod`) covers all required vars
- [ ] Ensure startup validation covers all production-critical variables (not just DATABASE_URL, JWT_SECRET)

### 2. Health / Readiness / Liveness Audit

- [ ] Verify health endpoints are excluded from global rate limiting (k8s probes must not be throttled)
- [ ] Replace hardcoded `version: '1.0.0'` in health routes with dynamic value from `package.json`
- [ ] Verify `GET /health/ready` correctly reports DB readiness (returns 503 when DB is down)
- [ ] Verify `GET /health/live` is lightweight (no DB/Redis calls required)
- [ ] Verify memory reporting uses meaningful units (currently raw bytes — consider MB/GB formatting)
- [ ] Ensure health endpoint response matches `PRODUCTION_FAILURE_MODE_RULES.md` §5 spec

### 3. Metrics / Observability Plan

- [ ] Create a `docs/operations/METRICS_AND_MONITORING.md` plan covering:
  - Which metrics to collect (request count, latency P50/P95/P99, error rate by status code, active users, rate limit hits, DB connection pool usage, Redis memory, event loop lag)
  - Prometheus endpoint design (`GET /metrics` — **not** implemented in this checkpoint, but planned)
  - Grafana dashboard layout (if applicable)
  - Alert thresholds and notification channels
- [ ] Document the metrics scope explicitly as **planning only** — no `/metrics` endpoint implementation in CP16
- [ ] Note: `prom-client` npm package is **not** to be installed in this checkpoint without explicit approval

### 4. Error Tracking Plan

- [ ] Create a `docs/operations/ERROR_TRACKING_PLAN.md` covering:
  - What to track (unhandled exceptions, 5xx errors, slow queries > 1s, rate limit violations)
  - What NOT to track (PII, passwords, tokens, stack traces in error messages)
  - Configuration template from `EXTERNAL_PROVIDERS.md` §5
  - PII scrubbing rules before sending to Sentry
- [ ] **Do not** install `@sentry/node` or implement Sentry in code during this checkpoint
- [ ] Document as deferred for implementation in CP17 or a dedicated security hardening pass

### 5. Security Headers & Cache-Control Audit

- [ ] Audit current security headers middleware (6 headers) against OWASP recommendations:
  - Verify `Strict-Transport-Security` includes `preload` directive
  - Consider adding `Permissions-Policy` header
  - Consider adding `Cross-Origin-Embedder-Policy` and `Cross-Origin-Opener-Policy` headers
- [ ] **Implement `Cache-Control` headers:**
  - `Cache-Control: no-store` on all authenticated API responses (per SECURITY_RULES.md §3.6)
  - `Cache-Control: public, max-age=0` or appropriate caching on health endpoints
  - Implement via middleware or per-route configuration
- [ ] Document the cache-control strategy in `docs/security/CACHE_CONTROL_POLICY.md`

### 6. Rate Limit Tier Audit

- [ ] Audit all route registrations in `app.ts` and per-route rate limiter applications
- [ ] Verify tier documentation matches implemented tiers:

| Tier | Default Config | Applied To |
|------|---------------|------------|
| Global | 100 req / 15 min / IP | All routes (app-wide) |
| Auth | 20 req / 15 min / IP | `/auth/register`, `/auth/login` |
| Password Reset | 5 req / 15 min / IP | `/auth/forgot-password`, `/auth/reset-password` |
| Application | 10 req / 15 min / User ID | `POST /internships/:id/apply` |
| Admin | 200 req / 15 min / User ID | All admin routes |

- [ ] Ensure health endpoints bypass rate limiting (use a `skip` option or `no-rate-limit` prefix)
- [ ] Verify rate limit headers (`X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset`) are consistently applied
- [ ] Verify `Retry-After` header format is RFC-compliant (decimal seconds)

### 7. Dependency Scanning & CI Hardening

- [ ] Add `npm audit` step to CI pipeline (non-blocking advisory mode initially, failing on critical/high after review):
  ```yaml
  - name: Dependency audit
    run: npm audit --audit-level=high || true
  ```
- [ ] Consider adding `snyk` or `trivy` scanning to CI (document plan, **do not** install without approval)
- [ ] Verify CI runs on push to `main`, `release/*`, and PRs to `main`
- [ ] Verify CI includes: lint → typecheck → test:coverage → (new) npm audit
- [ ] Verify `node-version` matrix or pinning (currently node 22 — consider if 20 LTS is the production target)

### 8. Docker Production Readiness

- [ ] Audit the existing Dockerfile for production readiness:
  - Verify multi-stage build correctly excludes dev dependencies in runner stage
  - Verify `node:20-alpine` is the correct production base image (LTS)
  - Consider adding `USER node` for non-root execution
  - Consider adding `HEALTHCHECK` instruction to Dockerfile
  - Consider adding `NODE_ENV=production` environment variable
  - Verify `npm ci --production` or equivalent in build stage (currently uses `npm ci --workspace`)
- [ ] Create a `docs/operations/DOCKER_PRODUCTION_GUIDE.md` covering:
  - Building and tagging images for production
  - Image registry configuration
  - Environment-specific compose files (if needed)
- [ ] **Do not** create `docker-compose.prod.yml` in this checkpoint — document requirements only

### 9. Backup Automation

- [ ] Create a working backup script at `scripts/backup.sh` based on the template in `BACKUP_AND_RESTORE.md` §2.3
- [ ] The script should:
  - Support configurable DB connection via environment variables
  - Create timestamped, compressed SQL dumps
  - Rotate backups older than configurable retention days
  - Log success/failure to stdout (for integration with log aggregators)
  - Exit non-zero on failure (for cron alerting)
- [ ] Update `BACKUP_AND_RESTORE.md` to reference the actual script (replace template placeholder)
- [ ] Document backup automation schedule recommendation (daily via cron/systemd timer)
- [ ] **Do not** configure cron jobs or systemd timers in this checkpoint

### 10. Load / Performance Benchmark Plan

- [ ] Create `docs/operations/PERFORMANCE_BENCHMARK_PLAN.md` covering:
  - Benchmark Scenarios:
    - `GET /internships` — public listing with pagination (baseline)
    - `GET /health` — health check (lightweight)
    - `POST /auth/login` — authentication (bcrypt + DB + Redis)
    - `POST /internships/:id/apply` — write-heavy (DB + Redis + validation)
    - `GET /admin/dashboard` — dashboard aggregation (heavy read)
  - Success Criteria (from BACKEND_ENGINEERING_BIBLE.md §7):
    - P95 response time < 200ms
    - Error rate (5xx) < 0.1%
    - Zero race conditions or data integrity failures under concurrency
  - Tooling recommendations (k6, autocannon, or artillery — **do not** install in this checkpoint)
  - Load test structure plan:
    - Ramp-up: 1 → 10 → 50 → 100 concurrent users
    - Sustained: 100 concurrent users for 5 minutes
    - Spike: 0 → 200 concurrent users instantly
  - Performance budget for each endpoint
  - Reporting template (results table documenting P50/P95/P99, error rate, throughput)

### 11. Documentation Verification

- [ ] Audit `DEPLOYMENT_READINESS.md` against actual codebase:
  - Verify pre-deployment checklist items are accurate
  - Verify deployment process steps are reproducible
  - Verify monitoring thresholds are documented
- [ ] Audit `STAGING_RUNBOOK.md` against actual staging environment:
  - Verify test account credentials are current
  - Verify smoke test endpoints exist and return correct responses
  - Verify troubleshooting steps are accurate
- [ ] Audit `ENVIRONMENT_VARIABLES.md`:
  - Verify all variables documented match `config/index.ts` implementation
  - Fix REDIS_URL classification (currently listed as Required, implemented as optional)
  - Add missing variables (API_PREFIX)
  - Verify JWT environment variable names (`JWT_ACCESS_EXPIRES_IN` vs `JWT_ACCESS_EXPIRY`)
- [ ] Audit `INCIDENT_RESPONSE.md` runbooks against actual failure modes
- [ ] Update `KNOWN_GAPS_REGISTER.md` to close CP15 infrastructure gaps (test DB, factories, CI)
- [ ] Add CP16 checkpoint artifacts to gap register as resolved (spec restoration)

### 12. Cross-Cutting Verifications

- [ ] Verify no `console.log` statements exist in production code (only `logger.*` calls)
- [ ] Verify all `process.exit` calls are intentional and documented (only in `server.ts` graceful shutdown)
- [ ] Verify all environment variable access goes through `config/index.ts` (no direct `process.env` in modules)
- [ ] Verify all error messages are user-safe (no internal details, stack traces, or PII)
- [ ] Verify no `any` type assertions exist (TypeScript strict mode)
- [ ] Verify no `// @ts-ignore` comments exist
- [ ] Verify all module exports have JSDoc comments

---

## Explicitly Allowed Scope

The following are explicitly allowed in CP16:

- ✅ **Operational routes** — `GET /metrics` may be **specified** in the metrics plan but **not implemented** without approval
- ✅ **Middleware modifications** — Cache-Control middleware implementation, rate-limit middleware bypass for health
- ✅ **Config changes** — Environment variable handling improvements, health version read from package.json
- ✅ **Documentation** — New and updated docs (metrics plan, error tracking plan, cache policy, Docker guide, performance plan)
- ✅ **Scripts** — `scripts/backup.sh` backup automation script
- ✅ **CI changes** — `npm audit` step addition
- ✅ **Dockerfile improvements** — Non-root user, HEALTHCHECK, NODE_ENV
- ✅ **Audit and verification** — Code review, config audit, documentation verification
- ✅ **Known gaps updates** — Mark CP15 infrastructure gaps as resolved, add CP16 spec restoration entry

---

## Forbidden Scope

**Do NOT** implement the following in CP16:

- ❌ **New domain/business routes** — No new feature endpoints (students, companies, internships, applications, schools, auth, admin)
- ❌ **Prisma schema changes** — No new models, fields, indexes, or enums
- ❌ **Database migrations** — No `prisma migrate` commands or migration files
- ❌ **Production deployment** — Do not deploy to any production environment
- ❌ **Email/SMS provider integration** — No wiring of SendGrid, AWS SES, Twilio, or similar
- ❌ **File storage provider integration** — No S3, R2, MinIO, or similar implementation
- ❌ **New npm dependencies** — Do not install `prom-client`, `@sentry/node`, `k6`, `autocannon`, `artillery`, or any other package without explicit checkpoint approval
- ❌ **Sentry implementation** — Plan only, no `@sentry/node` integration code
- ❌ **Prometheus `/metrics` endpoint implementation** — Plan only, code deferred
- ❌ **docker-compose.prod.yml** — Document requirements only
- ❌ **Cron jobs or systemd timers** — Document backup schedule only
- ❌ **Marking CP16 complete** — Do not update `CHECKPOINT_LOG.md` to mark CP16 complete
- ❌ **Skipping to CP17** — All CP17 work remains deferred

---

## Acceptance Criteria

- [ ] All 12 tasks verified complete
- [ ] Health endpoints bypass rate limiting
- [ ] Version is read dynamically (not hardcoded `'1.0.0'`)
- [ ] Cache-Control headers implemented on authenticated responses
- [ ] `npm audit` runs in CI
- [ ] Dockerfile has `USER node`, `HEALTHCHECK`, and `NODE_ENV=production`
- [ ] Backup script created (`scripts/backup.sh`)
- [ ] Metrics/observability plan documented
- [ ] Error tracking plan documented
- [ ] Performance benchmark plan documented
- [ ] Cache-control policy documented
- [ ] Docker production guide documented
- [ ] Environment variable docs reconciled with implementation
- [ ] Known gaps register updated (CP15 infrastructure gaps closed, CP16 spec restoration logged)
- [ ] No CP16 work is marked as complete in CHECKPOINT_LOG.md
- [ ] All docs verified against actual codebase

---

## Estimated Time

6–8 hours (majority audit/documentation; ~2 hours for light code changes)

---

## Dependencies

- **No new npm packages** required for the allowed scope
- **No Prisma schema changes** required
- **No database migrations** required
