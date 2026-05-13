# Metrics & Monitoring Plan

> **Planning document for metrics collection and monitoring.**
> This document outlines what metrics should be collected, how they should be exposed, and how monitoring should be configured.
>
> ⚠️ **Scope:** This is a **planning-only** document. No `/metrics` endpoint or Prometheus integration is implemented in this checkpoint.
> The `prom-client` npm package is **not** installed. Implementation is deferred to a future checkpoint.

---

## 1. Metrics to Collect

### 1.1 HTTP Request Metrics

| Metric | Type | Labels | Description |
|--------|------|--------|-------------|
| `http_requests_total` | Counter | `method`, `path`, `status_code` | Total request count |
| `http_request_duration_seconds` | Histogram | `method`, `path`, `status_code` | Request latency (buckets: 0.01, 0.05, 0.1, 0.25, 0.5, 1.0, 2.5, 5.0) |
| `http_request_duration_summary` | Summary | `method`, `path` | Latency P50/P95/P99 |

### 1.2 Application Metrics

| Metric | Type | Labels | Description |
|--------|------|--------|-------------|
| `active_users` | Gauge | `role` | Currently active users (authenticated sessions in last 15 min) |
| `rate_limit_hits_total` | Counter | `prefix`, `identifier` | Rate limit violations by tier |
| `auth_attempts_total` | Counter | `status` (success/failure) | Authentication attempts |
| `db_connection_pool_size` | Gauge | `status` (active/idle/waiting) | Database connection pool usage |
| `redis_memory_used_bytes` | Gauge | — | Redis memory consumption |

### 1.3 System Metrics

| Metric | Type | Labels | Description |
|--------|------|--------|-------------|
| `process_cpu_seconds_total` | Counter | — | Process CPU time |
| `process_resident_memory_bytes` | Gauge | — | Process RSS memory |
| `process_heap_bytes` | Gauge | — | Node.js heap usage |
| `event_loop_lag_seconds` | Gauge | — | Event loop lag (measured via `setInterval` delta) |
| `nodejs_eventloop_lag_p50` | Gauge | — | Event loop lag P50 |
| `nodejs_eventloop_lag_p95` | Gauge | — | Event loop lag P95 |

### 1.4 Business Metrics

| Metric | Type | Labels | Description |
|--------|------|--------|-------------|
| `internships_total` | Gauge | `status` | Total internships by status |
| `applications_total` | Gauge | `status` | Total applications by status |
| `users_total` | Gauge | `role` | Total users by role |
| `applications_per_internship` | Gauge | — | Average applications per internship |

---

## 2. Prometheus Endpoint Design

### 2.1 Proposed Route

- **Path:** `GET /metrics`
- **Auth:** Internal network only (IP whitelist or shared secret header)
- **Response:** `text/plain` Prometheus exposition format

### 2.2 Implementation Plan

```typescript
// Future implementation — not in CP16
import prometheus from 'prom-client';

// Create registry
const register = new prometheus.Registry();

// Collect default Node.js metrics
prometheus.collectDefaultMetrics({ register });

// Define custom metrics
const httpRequestDuration = new prometheus.Histogram({
  name: 'http_request_duration_seconds',
  help: 'Request duration in seconds',
  labelNames: ['method', 'path', 'status_code'],
  buckets: [0.01, 0.05, 0.1, 0.25, 0.5, 1.0, 2.5, 5.0],
  registers: [register],
});

// Export metrics endpoint handler
export async function metricsHandler(req: Request, res: Response): Promise<void> {
  res.setHeader('Content-Type', register.contentType);
  res.end(await register.metrics());
}
```

### 2.3 Middleware Integration

Wrap the request duration histogram around all routes:

```typescript
// Future middleware
app.use((req, res, next) => {
  const end = httpRequestDuration.startTimer();
  res.on('finish', () => {
    end({ method: req.method, path: req.route?.path ?? req.path, status_code: res.statusCode });
  });
  next();
});
```

---

## 3. Grafana Dashboard Layout

### 3.1 Dashboard Sections

| Section | Panels | Refresh |
|---------|--------|---------|
| **Overview** | Request rate (RPS), P95 latency, error rate (5xx%), active users | 1 min |
| **Latency** | P50/P95/P99 latency over time, latency heatmap by endpoint | 1 min |
| **Errors** | 4xx rate, 5xx rate, rate limit hit rate, top error endpoints | 1 min |
| **System** | CPU, RSS memory, heap usage, event loop lag | 15 sec |
| **Dependencies** | DB connection pool, Redis memory, dependency health | 30 sec |
| **Business** | Total internships, applications, users, application ratio | 5 min |

### 3.2 Alert Thresholds

| Alert | Condition | Severity | Notification |
|-------|-----------|----------|--------------|
| High error rate | 5xx rate > 1% for 5 min | Critical | PagerDuty, Slack |
| High latency | P95 > 500ms for 5 min | Warning | Slack |
| DB pool exhaustion | Active connections > 80% of max | Critical | PagerDuty |
| Redis memory | Memory > 80% of max | Warning | Slack |
| Event loop lag | Lag > 100ms for 30 sec | Warning | Slack |
| Service down | Health check fails for 30 sec | Critical | PagerDuty |

---

## 4. Notification Channels

| Channel | Use | Integration |
|---------|-----|-------------|
| **Slack** | Warning alerts, daily digest | Slack webhook |
| **PagerDuty** | Critical alerts (SEV1/SEV2) | PagerDuty API |
| **Email** | Weekly report | SMTP (future) |

---

## 5. Metric Retention

| Tier | Retention | Resolution |
|------|-----------|------------|
| Raw metrics (Prometheus) | 15 days | Full resolution |
| Downsampled (Thanos/ Cortex) | 3 months | 5 min avg |
| Aggregated (PostgreSQL) | 1 year | 1 hour avg |

---

## 6. Implementation Roadmap

| Phase | Task | Dependencies |
|-------|------|--------------|
| CP16 | Plan only (this document) | None |
| CP17 | Install `prom-client`, implement `/metrics`, wire middleware | Prometheus instance |
| CP18 | Set up Grafana dashboards | Prometheus data |
| CP19 | Configure alerting rules | Grafana / Alertmanager |
| CP20 | Add business metrics | Domain stability |

---

*This is a living document. Update as monitoring infrastructure evolves.*
