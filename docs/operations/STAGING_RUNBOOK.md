# STAGING_RUNBOOK.md

> **Operational runbook for the staging environment.**

---

## 1. Staging Environment Overview

| Component | Value |
|-----------|-------|
| URL | `https://staging-api.internship-platform.et` |
| Database | Internally hosted PostgreSQL (Docker) |
| Redis | Internally hosted Redis (Docker) |
| Logs | JSON to stdout, aggregated via [logging tool] |
| Monitoring | Health endpoint, uptime monitoring |

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

## 3. Common Tasks

### 3.1 Deploy to Staging

```bash
# Build and deploy
docker compose -f docker-compose.stage.yml build
docker compose -f docker-compose.stage.yml up -d

# Run migrations
docker compose -f docker-compose.stage.yml exec api npx prisma migrate deploy

# Verify
curl https://staging-api.internship-platform.et/health
```

### 3.2 View Logs

```bash
# All services
docker compose -f docker-compose.stage.yml logs -f

# API only
docker compose -f docker-compose.stage.yml logs -f api
```

### 3.3 Reset Database

```bash
# Reset and re-seed
docker compose -f docker-compose.stage.yml exec api npx prisma migrate reset --force
docker compose -f docker-compose.stage.yml exec api npx prisma db seed
```

### 3.4 Access Database

```bash
# Direct psql access
docker compose -f docker-compose.stage.yml exec postgres psql -U internship internship_stage

# Prisma Studio (forward port)
docker compose -f docker-compose.stage.yml exec api npx prisma studio --port 5555
# Access at http://localhost:5555
```

---

## 4. Smoke Tests

After deploying to staging, run these smoke tests:

```bash
# 1. Health check
curl https://staging-api.internship-platform.et/health
# → status: "ok"

# 2. Public endpoints
curl https://staging-api.internship-platform.et/api/v1/internships
# → 200 with data

# 3. Registration
curl -X POST https://staging-api.internship-platform.et/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"test@test.et","password":"Test1234!","firstName":"Test","lastName":"User","role":"STUDENT","agreeToTerms":true}'
# → 201 with tokens

# 4. Login
curl -X POST https://staging-api.internship-platform.et/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"student@test.et","password":"Password123!"}'
# → 200 with tokens

# 5. Authenticated endpoint
curl https://staging-api.internship-platform.et/api/v1/auth/me \
  -H "Authorization: Bearer <token>"
# → 200 with user data

# 6. Rate limiting
for i in {1..30}; do curl -s -o /dev/null -w "%{http_code}\n" https://staging-api.internship-platform.et/api/v1/auth/login -X POST -H "Content-Type: application/json" -d '{"email":"wrong@test.et","password":"wrong"}'; done
# → Eventually returns 429
```

---

## 5. Staging vs Production Differences

| Aspect | Staging | Production |
|--------|---------|------------|
| Data | Synthetic test data | Real user data |
| Scale | Low volume | Production volume |
| Monitoring | Basic | Full monitoring + alerts |
| Email | Console/logged | Real email provider |
| SMS | Console/logged | Real SMS provider |
| TLS | Self-signed or Let's Encrypt | Full certificate chain |
| Backups | None needed | Automated daily |

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

*Staging is where you break things so production doesn't have to.*
