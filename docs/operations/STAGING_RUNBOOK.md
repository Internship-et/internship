# STAGING_RUNBOOK.md

> **Operational runbook for the staging environment.**

---

## 1. Staging Environment Overview

| Component | Value |
|-----------|-------|
| URL | `https://staging-api.internship-platform.et` |
| Database | Internally hosted PostgreSQL (Docker) |
| Redis | Internally hosted Redis (Docker) |
| Logs | JSON to stdout, aggregated via Pino logger |
| Monitoring | Health endpoint (`GET /health`, `/health/live`, `/health/ready`), CI pipeline (lint → typecheck → test:coverage → npm audit) |
| CI | GitHub Actions — runs on push to `main`/`release/*` and PRs to `main` |
| Docker | Multi-stage build, `node:20-alpine` base, HEALTHCHECK configured |

---

## 2. Access

- Staging is accessible via VPN or IP whitelist
- No production data is used in staging
- Test accounts are seeded with the seed script

### Test Accounts (Seeded)

| Role | Email | Password |
|------|-------|----------|
| Admin | `admin@test.et` | `Password123!` |
| Student | `student@test.et` | `Password123!` |
| Company | `company@test.et` | `Password123!` |
| School | `school@test.et` | `Password123!` |

---

## 2b. Prerequisites for Real Staging Deployment

Before deploying to a real staging environment (remote server with URL, DNS, TLS):

- [ ] A target server/VM is provisioned with Docker and Docker Compose
- [ ] DNS A/AAAA record for `staging-api.internship-platform.et` points to the server's public IP
- [ ] TLS certificate is obtained (Let's Encrypt via Certbot, or internal CA)
- [ ] Reverse proxy (nginx/Caddy) is configured with TLS termination
- [ ] `STAGE_JWT_SECRET` is set to a strong random value (`openssl rand -hex 32`)
- [ ] `STAGE_DB_PASSWORD` is set to a strong random value
- [ ] `STAGE_CORS_ORIGINS` is configured for the staging domain
- [ ] VPN or IP whitelist is configured for access control
- [ ] `apps/api/.env.stage` is populated with real secrets (copied from `.env.stage.example`)
- [ ] Monitoring and log aggregation are configured (see `docs/operations/METRICS_AND_MONITORING.md`)
- [ ] Staging environment is smoke-tested after every deployment

See `docs/operations/DEPLOYMENT_READINESS.md` for the full pre-deployment checklist.

---

## 3. Common Tasks

### 3.1 Local Staging Simulation

Run a production-like staging environment locally for verification. This uses
separate ports (5434/6380/3001) so it can run alongside the development stack.

```bash
# 1. Prepare environment
cp apps/api/.env.stage.example apps/api/.env.stage
# Edit .env.stage if needed (defaults work for local simulation)

# 2. Set required variables
export STAGE_JWT_SECRET=local-stage-simulation-32char-minimum!!
export STAGE_DB_PASSWORD=stage_dev

# 3. Build and start
docker compose -f docker-compose.stage.yml up -d

# 4. Run migrations
docker compose -f docker-compose.stage.yml exec api npx prisma migrate deploy

# 5. (Optional) Seed test data
docker compose -f docker-compose.stage.yml exec api npx prisma db seed

# 6. Run smoke tests
curl http://localhost:3001/health
curl http://localhost:3001/health/live
curl http://localhost:3001/health/ready
curl http://localhost:3001/api/v1/internships

# 7. Clean up when done
docker compose -f docker-compose.stage.yml down -v
```

### 3.2 Deploy to Real Staging (External Server)

```bash
# Build and deploy
docker compose -f docker-compose.stage.yml build
docker compose -f docker-compose.stage.yml up -d

# Run migrations
docker compose -f docker-compose.stage.yml exec api npx prisma migrate deploy

# Verify
curl https://staging-api.internship-platform.et/health
```

### 3.3 View Logs

```bash
# All services
docker compose -f docker-compose.stage.yml logs -f

# API only
docker compose -f docker-compose.stage.yml logs -f api
```

### 3.4 Reset Database

```bash
# Reset and re-seed
docker compose -f docker-compose.stage.yml exec api npx prisma migrate reset --force
docker compose -f docker-compose.stage.yml exec api npx prisma db seed
```

### 3.5 Access Database

```bash
# Direct psql access
docker compose -f docker-compose.stage.yml exec postgres psql -U internship internship_stage

# Prisma Studio (forward port)
docker compose -f docker-compose.stage.yml exec api npx prisma studio --port 5555
# Access at http://localhost:5555
```

---

## 4. Smoke Tests

After deploying to staging (local or remote), run these smoke tests:

```bash
# 1. Health check (adjust URL for local: http://localhost:3001)
curl https://staging-api.internship-platform.et/health
# → status: "ok"

# 2. Liveness probe
curl https://staging-api.internship-platform.et/health/live
# → status: "alive"

# 3. Readiness probe
curl https://staging-api.internship-platform.et/health/ready
# → status: "ready"

# 4. Public endpoints
curl https://staging-api.internship-platform.et/api/v1/internships
# → 200 with data

# 5. Registration
curl -X POST https://staging-api.internship-platform.et/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"test@test.et","password":"Test1234!","firstName":"Test","lastName":"User","role":"STUDENT","agreeToTerms":true}'
# → 201 with tokens

# 6. Login
curl -X POST https://staging-api.internship-platform.et/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"student@test.et","password":"Password123!"}'
# → 200 with tokens

# 7. Authenticated endpoint
curl https://staging-api.internship-platform.et/api/v1/auth/me \
  -H "Authorization: Bearer <token>"
# → 200 with user data

# 8. Rate limiting
for i in {1..30}; do curl -s -o /dev/null -w "%{http_code}\n" https://staging-api.internship-platform.et/api/v1/auth/login -X POST -H "Content-Type: application/json" -d '{"email":"wrong@test.et","password":"wrong"}'; done
# → Eventually returns 429
```

---

## 5. Staging vs Production Differences

| Aspect | Staging | Production |
|--------|---------|------------|
| Data | Synthetic test data | Real user data |
| Scale | Low volume | Production volume |
| Monitoring | Basic (health endpoint) | Full monitoring + alerts (see `METRICS_AND_MONITORING.md`) |
| Email | Console/logged | Real email provider |
| SMS | Console/logged | Real SMS provider |
| TLS | Self-signed or Let's Encrypt | Full certificate chain |
| Backups | None needed | Automated daily (`scripts/backup.sh`) |
| Error tracking | None | Sentry (planned — see `ERROR_TRACKING_PLAN.md`) |
| Cache-Control | No caching | `no-store` on API, `public, max-age=0` on health |

---

## 6. Troubleshooting

### API returns 500

1. Check logs: `docker compose logs -f api`
2. Check database connectivity: `docker compose exec api curl http://postgres:5432`
3. Check migrations are up to date

### Database connection refused

1. Check PostgreSQL is running: `docker compose ps postgres`
2. Check logs: `docker compose logs postgres`
3. Verify connection string in environment

### Redis connection refused

1. Check Redis is running: `docker compose ps redis`
2. Check logs: `docker compose logs redis`
3. Verify connection string in environment

### Migrations fail

1. Check migration status: `docker compose exec api npx prisma migrate status`
2. Reset if needed: `docker compose exec api npx prisma migrate reset --force`

---

## 7. Related Documentation

- `docs/operations/DEPLOYMENT_READINESS.md` — Production deployment checklist
- `docs/operations/DOCKER_PRODUCTION_GUIDE.md` — Docker production build/deploy guide
- `docs/operations/BACKUP_AND_RESTORE.md` — Database backup and restore
- `docs/operations/INCIDENT_RESPONSE.md` — Incident response procedures
- `docs/engineering/STAGING_GATE.md` — Staging gate checklist and process
- `docs/security/CACHE_CONTROL_POLICY.md` — Cache-control strategy
- `docker-compose.stage.yml` — Staging Docker Compose file (project root)

---

*Staging is where you break things so production doesn't have to.*
