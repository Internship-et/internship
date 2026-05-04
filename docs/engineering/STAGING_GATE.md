# STAGING_GATE.md

> **The staging gate is the quality checkpoint before production.** Every deployment to production must pass through this gate.

---

## 1. Purpose

The staging gate ensures that:
- All features work correctly in a production-like environment
- No regressions are introduced
- Performance is acceptable
- Security is verified
- Documentation is up to date

---

## 2. Gate Checklist

### 2.1 Functional Verification

- [ ] All endpoints respond correctly (smoke test)
- [ ] Auth flow works (register, login, refresh, logout)
- [ ] All CRUD operations work for each module
- [ ] Business rules are enforced (state machines, ownership)
- [ ] Pagination works on all list endpoints
- [ ] Search/filter works on searchable endpoints
- [ ] Rate limiting is active and returns 429 when exceeded
- [ ] Error responses follow the contract format

### 2.2 Integration Verification

- [ ] PostgreSQL connection works
- [ ] Redis connection works
- [ ] Email sending works (sandbox)
- [ ] File upload works (if implemented)
- [ ] CORS is configured correctly
- [ ] Health check endpoint reports correctly

### 2.3 Performance Verification

- [ ] P95 response time < 200ms for simple queries
- [ ] P95 response time < 500ms for complex queries
- [ ] Database query count per request ≤ 5 (excluding N+1 checks)
- [ ] No memory leaks (steady memory usage over 1 hour of load)

### 2.4 Security Verification

- [ ] JWT auth works on all protected routes
- [ ] Authorization checks work (role-based access)
- [ ] Ownership checks work
- [ ] Input validation rejects invalid data
- [ ] Rate limiting is active
- [ ] Security headers are present
- [ ] No secrets exposed in responses
- [ ] SQL injection attempts fail (Prisma handles this)

### 2.5 Code Quality Verification

- [ ] TypeScript compiles without errors
- [ ] ESLint passes with no errors
- [ ] All tests pass
- [ ] Coverage meets minimum thresholds
- [ ] No `TODO` or `FIXME` comments in production code
- [ ] Dependencies are up to date (no known vulnerabilities)

### 2.6 Documentation Verification

- [ ] API contract is up to date
- [ ] Environment variables documented
- [ ] Deployment runbook is current
- [ ] CHANGELOG or CHECKPOINT_LOG is updated

---

## 3. Gate Process

```
Feature Branch → Staging → Gate Review → Production
                      ↑                      ↑
                 Automatic checks       Manual approval
```

1. Code is merged to `staging` branch
2. Automatic checks run (CI pipeline)
3. Manual verification (gate checklist)
4. If all passed, merge to `main` for production deployment
5. If failed, fix and repeat

---

## 4. Verdicts

After completing the gate checklist and review, the staging gate produces one of three verdicts:

| Verdict | Meaning | Next Action |
|---------|---------|-------------|
| **SAFE FOR STAGING** | All checks pass. No critical, high, or medium issues found. | Proceed to staging deployment. |
| **UNSAFE FOR STAGING** | Critical or high issues found. Deployment is blocked. | Fix all critical/high issues, then re-run the gate. |
| **SAFE ONLY WITH LIMITATIONS** | Medium or minor issues found, but no critical/high blockers. | Deploy with documented limitations. Issues must be resolved before production. |

---

## 5. Rollback Criteria

Deploy to production is blocked if:

- **CRITICAL:** Any P0 endpoint returns 500
- **CRITICAL:** Auth flow is broken (users cannot log in)
- **HIGH:** A core business function is broken (cannot apply, cannot post internship)
- **HIGH:** Data integrity is compromised
- **MEDIUM:** Performance degrades beyond P95 thresholds
- **MEDIUM:** Security vulnerability is discovered

---

## 6. Staging Environment

The staging environment mirrors production:
- Separate PostgreSQL database (restored from production backup weekly)
- Separate Redis instance
- Same Docker configuration as production
- Monitoring and logging enabled
- Accessible only via VPN or IP whitelist

---

*The staging gate protects production. Do not bypass it.*
