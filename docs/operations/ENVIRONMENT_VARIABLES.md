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
| `REDIS_URL` | Redis connection string | — | `redis://localhost:6379` |

---

## Optional Variables

| Variable | Description | Default | Required In |
|----------|-------------|---------|-------------|
| `JWT_ACCESS_EXPIRY` | Access token expiry | `15m` | — |
| `JWT_REFRESH_EXPIRY` | Refresh token expiry | `7d` | — |
| `BCRYPT_SALT_ROUNDS` | Bcrypt cost factor | `10` | — |
| `CORS_ORIGINS` | Allowed CORS origins (comma-separated) | `http://localhost:3000` | Production |
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

## Validation at Startup

The application validates required environment variables at startup:

```typescript
// src/config/index.ts
const requiredVars = ['DATABASE_URL', 'JWT_SECRET', 'REDIS_URL'];

for (const varName of requiredVars) {
  if (!process.env[varName]) {
    throw new Error(`Environment variable ${varName} is required`);
  }
}
```
