# STAGING_AND_PRODUCTION_READINESS_GUIDE.md

> **Guide for preparing the application for staging deployment and production release.**

---

## 1. Staging Deployment Checklist

### 1.1 Code Quality

- [ ] All tests pass (`npm test`)
- [ ] Coverage meets thresholds (≥80% overall)
- [ ] TypeScript compiles (`npm run typecheck`)
- [ ] ESLint passes (`npm run lint`)
- [ ] No `TODO` or `FIXME` in production code
- [ ] No `console.log` statements (use proper logger)
- [ ] All dependencies are pinned to exact versions

### 1.2 Configuration

- [ ] Environment variables set for staging (see ENVIRONMENT_VARIABLES.md)
- [ ] Database migrations have been run
- [ ] Redis is configured and accessible
- [ ] CORS origins configured for staging domain
- [ ] Rate limits configured for staging (lower if needed)

### 1.3 Security

- [ ] JWT secret is set (not default)
- [ ] Database password is set (not default)
- [ ] HTTPS is configured (via reverse proxy)
- [ ] Security headers are tested
- [ ] Auth flow works end-to-end
- [ ] Rate limiting is active

### 1.4 Monitoring

- [ ] Health check endpoint returns correct status
- [ ] Structured logging is working
- [ ] Error tracking is configured (Sentry or similar — future)

---

## 2. Production Deployment Checklist

### 2.1 Infrastructure

- [ ] Reverse proxy (Nginx/Caddy) configured with TLS
- [ ] Database is configured with:
  - Automated backups (daily)
  - Connection pooling (PgBouncer or similar)
  - Read replica (if needed)
- [ ] Redis is configured with:
  - Persistence (RDB snapshots)
  - Max memory limit
- [ ] Container resource limits set (CPU, memory)
- [ ] Load balancer configured (if multiple instances)

### 2.2 Performance

- [ ] Load testing completed (minimum 100 concurrent users)
- [ ] P95 response time < 200ms for reads
- [ ] P95 response time < 500ms for writes
- [ ] Database query optimization complete
- [ ] No N+1 queries detected
- [ ] Index strategy verified with `EXPLAIN ANALYZE`

### 2.3 Reliability

- [ ] Graceful shutdown tested
- [ ] Startup without dependencies tested (graceful degradation)
- [ ] Retry logic for external services tested
- [ ] Circuit breakers configured

### 2.4 Security (Final)

- [ ] Penetration testing completed (or automated security scan)
- [ ] All secrets in environment variables or secrets manager
- [ ] Database access restricted to application user only
- [ ] Server runs as non-root user
- [ ] Dependencies scanned for vulnerabilities (`npm audit`)
- [ ] CORS configured for production domain only

### 2.5 Documentation

- [ ] API contract is up to date
- [ ] Environment variables documented
- [ ] Deployment runbook is current
- [ ] Incident response plan is in place
- [ ] Rollback plan is documented

---

## 3. Rollback Plan

### 3.1 Immediate Rollback (within 1 hour)

```
1. Identify the problematic deployment
2. Revert the code to the previous known-good commit
3. Re-run migrations (may need down migration)
4. Re-deploy
5. Verify health check
```

### 3.2 Database Rollback

If a migration caused issues:
```
1. Identify the migration that caused issues
2. Run `npx prisma migrate down` (if reversible)
3. Or restore from backup
4. Re-deploy with previous code version
```

### 3.3 Data Recovery

If data corruption occurred:
```
1. Identify the affected data (audit logs help here)
2. Restore from the most recent backup
3. Apply any transactions since the backup (replay from logs)
4. Verify data integrity
```

---

## 4. Environment Promotion

```
Development → Staging → Production
     │            │           │
   Hot reload   Deployed    Deployed
   Docker       Docker      Docker
   .env.dev     .env.stage  .env.prod
```

### Promotion Flow:

1. Code is merged to `main` branch
2. CI runs tests, lint, typecheck
3. If all pass, Docker image is built and tagged
4. Image is deployed to **staging**
5. Staging gate checklist is run (see STAGING_GATE.md)
6. If all pass, image is promoted to **production**
7. Production deployment uses blue-green or rolling update

---

## 5. Environment-Specific Config

| Setting | Development | Staging | Production |
|---------|------------|---------|------------|
| Log level | debug | info | info |
| Rate limits | relaxed | matching prod | as configured |
| CORS origins | localhost:3000 | staging domain | production domain |
| Database | local | staging | production |
| Redis | local | staging | production (cluster) |
| Email | console/log | sandbox | real provider |
| SMS | console/log | sandbox | real provider |

---

*Production readiness is a process, not a checkbox. Review this guide before every release.*
