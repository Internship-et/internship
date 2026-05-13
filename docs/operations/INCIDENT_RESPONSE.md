# INCIDENT_RESPONSE.md

> **How to respond to production incidents.**

---

## 1. Incident Severity Levels

| Level | Definition | Response Time | Example |
|-------|-----------|---------------|---------|
| **SEV1** | Complete service outage or data breach | Immediate (24/7) | API is down, database compromised |
| **SEV2** | Major feature broken, partial outage | 1 hour | Cannot apply for internships, login failures |
| **SEV3** | Minor feature broken, no user impact | 8 hours | Profile image not loading, minor UI error |
| **SEV4** | Cosmetic issue, low priority | Next sprint | Typo in error message, minor layout issue |

---

## 2. Incident Response Flow

```
1. DETECT
   │
   ▼
2. ASSESS
   │
   ▼
3. RESPOND
   │
   ▼
4. RESOLVE
   │
   ▼
5. REVIEW
```

### Step 1: Detect

Incidents can be detected through:
- Automated monitoring alerts (health check failures, error rate spikes)
- User reports (customer support)
- Team member observation

### Step 2: Assess

Determine:
- **Severity** (SEV1-SEV4)
- **Scope** (how many users affected?)
- **Root cause** (what is failing?)
- **Impact** (what functionality is broken?)

### Step 3: Respond

#### SEV1 Response

1. **Immediate:** Declare incident in team channel
2. **Contain:** If security incident, isolate affected systems
   - If database issue, consider read-only mode
   - If code issue, roll back to previous version
3. **Communicate:** Update status page, notify stakeholders
4. **Mitigate:** Apply hotfix if safe, otherwise rollback

#### SEV2 Response

1. Within 1 hour: Investigate root cause
2. Apply fix or rollback
3. Verify fix
4. Post-mortem within 24 hours

#### SEV3/SEV4

1. Log in issue tracker
2. Fix in normal development cycle

### Step 4: Resolve

1. Apply the fix
2. Verify the fix (health check, smoke test)
3. Monitor for 30 minutes (SEV1/SEV2)
4. Close the incident

### Step 5: Review (Post-Mortem)

For SEV1 and SEV2 incidents:
1. **What happened?** — Timeline of events
2. **Why did it happen?** — Root cause analysis
3. **What was the impact?** — User impact, data impact
4. **What went well?** — Response strengths
5. **What can improve?** — Prevention, detection, response
6. **Action items** — Owner, deadline for each

---

## 3. Common Incident Runbooks

### 3.1 API is Down (500 errors)

```
1. Check health endpoint
2. Check server logs
3. Check database connectivity
4. Check Redis connectivity
5. Check recent deployments
6. If code issue → rollback
7. If infrastructure issue → restart services
```

### 3.2 Database Connection Issues

```
1. Check database server is running
2. Check database connection string
3. Check database user permissions
4. Check connection pool exhaustion
5. Check network connectivity
6. If corrupted → restore from backup
```

### 3.3 Redis Issues

```
1. Check Redis server is running
2. Check Redis memory usage
3. Check Redis connection string
4. If Redis is down → application degrades gracefully
5. If OOM → restart with increased memory
```

### 3.4 Security Incident

```
1. Contain: Isolate affected systems
2. Assess: Determine scope of breach
3. Notify: Security lead, stakeholders
4. Investigate: How did it happen?
5. Remediate: Fix vulnerability
6. Report: File incident report
```

---

## 4. Communication Template

### Initial Alert

```
🚨 SEV[1/2] INCIDENT
Time: [UTC timestamp]
Service: [service name]
Impact: [what's broken]
Scope: [users affected]
Action: [investigating / rolling back / fixed]
ETA: [estimated resolution time]
```

### Resolution

```
✅ INCIDENT RESOLVED
Time: [UTC timestamp]
Service: [service name]
Duration: [minutes]
Root Cause: [what caused it]
Fix: [what was done]
Monitoring: [status]
Post-mortem: [scheduled for]
```

---

## 5. Post-Incident Checklist

- [ ] Incident documented in incident log
- [ ] Root cause identified
- [ ] Fix applied and verified
- [ ] Monitoring updated (if needed)
- [ ] Post-mortem scheduled (SEV1/SEV2)
- [ ] Action items created
- [ ] Stakeholders notified

---

## 6. Related Documentation

- `docs/operations/DEPLOYMENT_READINESS.md` — Deployment and rollback procedures
- `docs/operations/BACKUP_AND_RESTORE.md` — Database backup and restore
- `docs/operations/METRICS_AND_MONITORING.md` — Metrics collection and alert thresholds
- `docs/operations/ERROR_TRACKING_PLAN.md` — Error tracking configuration
- `docs/operations/STAGING_RUNBOOK.md` — Staging operations and smoke tests
- `docs/security/THREAT_MODEL.md` — Security threat model

---

*Stay calm, follow the process, and communicate clearly.*
