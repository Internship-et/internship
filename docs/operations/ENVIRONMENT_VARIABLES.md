# ENVIRONMENT_VARIABLES.md

> **All environment variables required by the application.** Variables are categorized by required/optional and environment.

---

## Required Variables

| Variable | Description | Default | Example |
|----------|-------------|---------|---------|
| `NODE_ENV` | Environment | `development` | `production` |
| `PORT` | Server port | `3000` | `3000` |
| `DATABASE_URL` | PostgreSQL connection string | — | `postgresql://user:pass@localhost:5432/internship` |
| `JWT_SECRET` | JWT signing secret (min 32 chars) | — | Min 32 chars of entropy |
| `REDIS_URL` | Redis connection string (optional — defaults to `redis://localhost:6379`; in-memory fallback if unavailable) | `redis://localhost:6379` | Production (recommended) |

---

## Optional Variables

| Variable | Description | Default | Required In |
|----------|-------------|---------|-------------|
| `JWT_ACCESS_EXPIRES_IN` | Access token expiry | `15m` | — |
| `JWT_REFRESH_EXPIRES_IN` | Refresh token expiry | `7d` | — |
| `BCRYPT_SALT_ROUNDS` | Bcrypt cost factor | `10` | — |
| `CORS_ORIGINS` | Allowed CORS origins (comma-separated). **Preferred** — if both `CORS_ORIGINS` and `CORS_ORIGIN` are set, this wins. | `http://localhost:3000` | Production |
| `CORS_ORIGIN` | Allowed CORS origins (comma-separated). **Legacy/deprecated** — use `CORS_ORIGINS` instead. Falls back to `*` if neither is set. | `*` | — |
| `API_PREFIX` | API route prefix | `/api/v1` | — |
| `RATE_LIMIT_WINDOW_MS` | Rate limit window | `900000` (15 min) | — |
| `RATE_LIMIT_MAX` | Default max requests | `100` | — |
| `LOG_LEVEL` | Logging level | `info` | Production |
| `REDIS_PASSWORD` | Redis password | — | Production |
| `EMAIL_HOST` | SMTP host | — | Production |
| `EMAIL_PORT` | SMTP port | `587` | Production |
| `EMAIL_USER` | SMTP username | — | Production |
| `EMAIL_PASS` | SMTP password | — | Production |
| `SMS_API_KEY` | SMS provider API key | — | Production |
| `SMS_API_SECRET` | SMS provider API secret | — | Production |
| `STORAGE_ENDPOINT` | File storage endpoint | — | Production |
| `STORAGE_BUCKET` | File storage bucket name | — | Production |
| `STORAGE_ACCESS_KEY` | Storage access key | — | Production |
| `STORAGE_SECRET_KEY` | Storage secret key | — | Production |
| `SENTRY_DSN` | Sentry error tracking DSN | — | Production |

---

## Configuration Template

An example production environment file is available at:
[`apps/api/.env.prod.example`](../apps/api/.env.prod.example)

Copy and modify for your environment:

```bash
cp apps/api/.env.prod.example apps/api/.env.prod
# Then edit .env.prod with real values
```

---

## Environment-Specific Defaults

### Development (.env.dev)

```
NODE_ENV=development
PORT=3000
DATABASE_URL=postgresql://internship:internship_dev@localhost:5432/internship_dev
REDIS_URL=redis://localhost:6379
JWT_SECRET=dev-secret-do-not-use-in-production-change-this
CORS_ORIGINS=http://localhost:3000,http://localhost:5173
LOG_LEVEL=debug
```

### Staging (.env.stage)

```
NODE_ENV=staging
PORT=3000
DATABASE_URL=postgresql://internship:XXX@staging-db:5432/internship_stage
REDIS_URL=redis://:XXX@staging-redis:6379
JWT_SECRET=<strong-random-secret>
CORS_ORIGINS=https://staging.internship-platform.et
LOG_LEVEL=info
```

### Production (.env.prod)

```
NODE_ENV=production
PORT=3000
DATABASE_URL=postgresql://internship:XXX@prod-db:5432/internship_prod
REDIS_URL=redis://:XXX@prod-redis:6379
JWT_SECRET=<strong-random-secret>
CORS_ORIGINS=https://internship-platform.et
LOG_LEVEL=info
SENTRY_DSN=https://XXX@sentry.io/XXX
```

---

## Secrets Management

- Secrets **must not** be committed to version control
- Use `.env` files for local development (added to `.gitignore`)
- Use a secrets manager (Vault, AWS Secrets Manager, Doppler) for staging/production
- Rotate secrets periodically (minimum every 90 days)
- Rotate secrets immediately if compromised

---

## JWT Secret Requirements

`JWT_SECRET` must be **at least 32 characters long**. The application validates this at startup and will throw an error if the secret is too short.

Generate a strong secret:

```bash
# 64-character random hex string
openssl rand -hex 32
```

---

## Validation at Startup

The application validates required environment variables at startup:

```typescript
// src/config/index.ts
const requiredVars = ['DATABASE_URL', 'JWT_SECRET'];

for (const varName of requiredVars) {
  if (!process.env[varName]) {
    throw new Error(`Environment variable ${varName} is required`);
  }
}
```

Note: `REDIS_URL` is **optional** — if not provided, the application defaults to `redis://localhost:6379` and falls back to in-memory operation if Redis is unavailable.
