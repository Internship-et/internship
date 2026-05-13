# Performance Benchmark Plan

> **Planning document for load and performance benchmarking.**
> This document defines benchmark scenarios, success criteria, tooling recommendations, and reporting templates.
>
> ⚠️ **Scope:** This is a **planning-only** document. No benchmarking tools (k6, autocannon, artillery) are installed or run in this checkpoint.
> Benchmarking execution is deferred to a future checkpoint.

---

## 1. Benchmark Scenarios

### 1.1 GET /internships — Public Listing (Baseline)

| Attribute | Value |
|-----------|-------|
| **Endpoint** | `GET /api/v1/internships` |
| **Auth** | None (public) |
| **Dependencies** | PostgreSQL (read) |
| **Description** | Cursor-paginated listing with filters |
| **Expected P95** | < 100ms |
| **Weight** | 40% of traffic |

**Query parameters for benchmark:**
```
?pageSize=20&sortBy=createdAt&sortOrder=desc
```

### 1.2 GET /health — Health Check (Lightweight)

| Attribute | Value |
|-----------|-------|
| **Endpoint** | `GET /health` |
| **Auth** | None |
| **Dependencies** | PostgreSQL + Redis |
| **Description** | System health with dependency checks |
| **Expected P95** | < 50ms |
| **Weight** | 10% of traffic |

### 1.3 POST /auth/login — Authentication (Heavy)

| Attribute | Value |
|-----------|-------|
| **Endpoint** | `POST /api/v1/auth/login` |
| **Auth** | None (public) |
| **Dependencies** | PostgreSQL + Redis (rate limit + session) + bcrypt |
| **Description** | Email/password login with bcrypt verification |
| **Expected P95** | < 500ms (bcrypt cost factor 10 is slow by design) |
| **Weight** | 5% of traffic |

**Request body:**
```json
{
  "email": "student@test.et",
  "password": "Password123!"
}
```

### 1.4 POST /internships/:id/apply — Write-Heavy

| Attribute | Value |
|-----------|-------|
| **Endpoint** | `POST /api/v1/internships/:id/apply` |
| **Auth** | STUDENT (JWT) |
| **Dependencies** | PostgreSQL + Redis (rate limit) |
| **Description** | Application submission with validation |
| **Expected P95** | < 200ms |
| **Weight** | 15% of traffic |

**Request body:**
```json
{
  "coverLetter": "I am interested in this internship opportunity."
}
```

### 1.5 GET /admin/dashboard — Heavy Read (Aggregation)

| Attribute | Value |
|-----------|-------|
| **Endpoint** | `GET /api/v1/admin/dashboard` |
| **Auth** | ADMIN (JWT) |
| **Dependencies** | PostgreSQL (multiple queries) |
| **Description** | Dashboard with 13 aggregated metrics (3 parallel queries) |
| **Expected P95** | < 300ms |
| **Weight** | 5% of traffic |

---

## 2. Success Criteria

From BACKEND_ENGINEERING_BIBLE.md §7 (Performance Principles):

| Metric | Target | Critical | Source |
|--------|--------|----------|--------|
| **P95 response time** | < 200ms | > 500ms | Bible §7 |
| **Error rate (5xx)** | < 0.1% | > 1% | Bible §7 |
| **Throughput** | > 100 req/s | < 50 req/s | Baseline estimate |
| **Zero race conditions** | ✅ Pass | ❌ Fail | Bible §7 |
| **Zero data integrity failures** | ✅ Pass | ❌ Fail | Bible §7 |

---

## 3. Tooling Recommendations

All tools are **recommended** — none are installed or required for this checkpoint.

### 3.1 Primary: k6 (Recommended)

```bash
# Install k6 (macOS)
brew install k6

# Run benchmark
k6 run benchmarks/load-test.js

# Output format (CLI + JSON)
k6 run --out json=results.json benchmarks/load-test.js
```

**Advantages:**
- JavaScript-based scripts (reuse test data models)
- Built-in metrics (P50/P95/P99, throughput, error rate)
- Cloud or local execution
- Good community support

### 3.2 Alternative: autocannon

```bash
# Install
npm install -g autocannon

# Quick run
autocannon -c 100 -d 60 http://localhost:3000/api/v1/internships
```

**Advantages:**
- Node.js native
- Simple CLI interface
- Real-time progress reporting

### 3.3 Alternative: artillery

```bash
# Install
npm install -g artillery

# Run from YAML config
artillery run benchmarks/load-test.yml
```

**Advantages:**
- YAML-based scenario definitions
- Built-in ramp-up and spike patterns
- Multiple phase support

---

## 4. Load Test Structure

### 4.1 Phases

| Phase | Duration | Target | Pattern |
|-------|----------|--------|---------|
| **Ramp-up** | 60 sec | 1 → 10 → 50 → 100 concurrent | Linear increase every 15 sec |
| **Sustained** | 300 sec (5 min) | 100 concurrent | Hold steady |
| **Spike** | 30 sec | 0 → 200 concurrent | Instant spike |
| **Cooldown** | 30 sec | 200 → 0 | Linear decrease |

### 4.2 User Mix Simulation

| User Type | Percentage | Actions |
|-----------|-----------|---------|
| Anonymous visitor | 40% | Browse internships, view details |
| Student | 35% | Login, browse, apply, check status |
| Company | 15% | Login, create internships, manage listings |
| Admin | 5% | Login, dashboard, manage users |
| Health checks | 5% | /health, /health/live, /health/ready |

---

## 5. Performance Budgets

| Endpoint | P50 | P95 | P99 | Error Rate | Throughput |
|----------|-----|-----|-----|------------|-----------|
| `GET /internships` | < 50ms | < 100ms | < 200ms | < 0.1% | > 200 req/s |
| `GET /health` | < 20ms | < 50ms | < 100ms | < 0.1% | > 500 req/s |
| `POST /auth/login` | < 200ms | < 500ms | < 1000ms | < 1% | > 20 req/s |
| `POST /internships/:id/apply` | < 100ms | < 200ms | < 500ms | < 0.1% | > 50 req/s |
| `GET /admin/dashboard` | < 100ms | < 300ms | < 500ms | < 0.1% | > 30 req/s |

---

## 6. Reporting Template

```json
{
  "scenario": "GET /internships",
  "date": "YYYY-MM-DD",
  "duration": 300,
  "concurrency": 100,
  "results": {
    "requests": { "total": 30000, "success": 29970, "failed": 30 },
    "latency_ms": {
      "min": 5,
      "p50": 35,
      "p95": 95,
      "p99": 180,
      "max": 450
    },
    "error_rate_5xx": 0.001,
    "throughput_req_per_sec": 100,
    "notes": "Baseline measurement. No caching enabled."
  }
}
```

---

## 7. Prerequisites for Benchmarking

Before running benchmarks, ensure:

- [ ] Application is deployed (local build or staging environment)
- [ ] Test data is seeded (minimum 10,000 internships, 1,000 students)
- [ ] Separate benchmark database (do NOT run against production)
- [ ] Monitoring is active (measure server-side metrics)
- [ ] No other load on the target environment
- [ ] Warm-up period completed (100 requests per endpoint)

---

## 8. Performance Regression Check

When to re-run benchmarks:

- Before every production deployment
- After any database schema change
- After any middleware change (rate limiter, auth, logging)
- After any query optimization
- After infrastructure change (DB migration, Redis config)

---

*Measure what matters. Optimize what's slow. Never guess — always benchmark.*
