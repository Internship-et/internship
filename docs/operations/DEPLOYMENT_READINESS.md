# DEPLOYMENT_READINESS.md

> **Checklist and runbook for deploying to production.**

---

## 1. Pre-Deployment Checklist

### 1.1 Code Readiness

- [ ] All tests pass (829+ tests, 86%+ coverage)
- [ ] CI pipeline passes (lint → typecheck → test:coverage → npm audit)
- [ ] No TypeScript errors
- [ ] No lint errors
- [ ] All PRs reviewed and approved
- [ ] `CHECKPOINT_LOG.md` is up to date
- [ ] CHANGELOG is updated (if applicable)

### 1.2 Infrastructure Readiness

- [ ] PostgreSQL is running and accessible
- [ ] Redis is running and accessible
- [ ] Reverse proxy (nginx/Caddy) is configured
- [ ] TLS certificates are valid
- [ ] Load balancer is configured (if multi-instance)
- [ ] Monitoring is active (health checks, alerts)
- [ ] Backups are configured

### 1.3 Configuration Readiness

- [ ] All environment variables are set (see `ENVIRONMENT_VARIABLES.md`)
- [ ] `JWT_SECRET` is set (minimum 32 characters)
- [ ] `CORS_ORIGINS` or legacy `CORS_ORIGIN` is configured for production domain
- [ ] `DATABASE_URL` is correct
- [ ] `REDIS_URL` is correct (optional — in-memory fallback available)
- [ ] `API_PREFIX` is set (default: `/api/v1`)
- [ ] `JWT_ACCESS_EXPIRES_IN` and `JWT_REFRESH_EXPIRES_IN` are configured
- [ ] Rate limits are configured for production
- [ ] `NODE_ENV=production` is set

---

## 2. Deployment Process

### 2.1 Blue-Green Deployment

```
1. Build new Docker image (tag: v1.2.3)
2. Push image to registry
3. Deploy to "green" environment
4. Run smoke tests on green
5. Switch load balancer to green
6. Monitor for 15 minutes
7. Keep "blue" as rollback target
```

### 2.2 Rolling Update (Single Instance)

```
1. Pull latest code
2. Install dependencies: npm ci --production
3. Build: npm run build
4. Run migrations: npx prisma migrate deploy
5. Restart process: pm2 restart api (or similar)
6. Verify health endpoint
```

### 2.3 Docker-Based Deployment

```bash
# Build
docker build -t internship-api:latest .
docker tag internship-api:latest registry.example.com/internship-api:v1.2.3

# Push
docker push registry.example.com/internship-api:v1.2.3

# Deploy
docker pull registry.example.com/internship-api:v1.2.3
docker stop internship-api || true
docker rm internship-api || true
docker run -d \
  --name internship-api \
  --restart unless-stopped \
  --network prod-network \
  -p 3000:3000 \
  --env-file .env.prod \
  registry.example.com/internship-api:v1.2.3

# Verify
sleep 5
curl -f http://localhost:3000/health
```

---

## 3. Post-Deployment Verification

- [ ] Health check returns `ok`
- [ ] All dependencies report healthy
- [ ] Login/registration flow works
- [ ] Core CRUD operations work
- [ ] Rate limiting is active
- [ ] Error handling returns correct format
- [ ] Logs show expected traffic
- [ ] No errors in error tracking system

---

## 4. Rollback Plan

### 4.1 Code Rollback

```bash
# Git revert
git revert HEAD --no-edit
git push origin main

# Or deploy previous Docker image
docker run -d --name internship-api \
  registry.example.com/internship-api:v1.2.2
```

### 4.2 Database Rollback

If migration caused issues:
```bash
# Create a new migration to reverse the changes
npx prisma migrate dev --name revert_<migration_name>

# Deploy the reverse migration
npx prisma migrate deploy
```

### 4.3 Full Rollback (data + code)

1. Restore database from backup
2. Deploy previous code version
3. Verify health check
4. Run smoke tests

---

## 5. Monitoring After Deployment

| Metric | Watch | Alert Threshold |
|--------|-------|-----------------|
| Response time (P95) | < 200ms | > 500ms |
| Error rate (5xx) | < 0.1% | > 1% |
| CPU usage | < 70% | > 85% |
| Memory usage | < 70% | > 85% |
| Database connections | < 50 | > 80% of max |
| Redis memory | < 50% | > 80% of max |

See also:
- `docs/operations/METRICS_AND_MONITORING.md` — Full metrics plan
- `docs/operations/ERROR_TRACKING_PLAN.md` — Error tracking plan
- `docs/operations/PERFORMANCE_BENCHMARK_PLAN.md` — Benchmark plan
- `docs/operations/DOCKER_PRODUCTION_GUIDE.md` — Docker deployment guide

---

*Deploy with confidence, but always have a rollback plan.*
