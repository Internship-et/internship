# CHECKPOINT 4: API Shell

**Prerequisites:** CHECKPOINT_3_PRISMA ✅

---

## Goal

Create the Express application shell: app factory, server lifecycle, base middleware stack, and health check routes. Core Utilities (error classes, logger, config, etc.) are already present from prior work and must not be modified.

---

## Tasks

### 1. Create Request ID Middleware
- `src/shared/middleware/request-id.middleware.ts`
  - Generate a UUID v4 for each request using `crypto.randomUUID()`
  - Attach to `req.id`
  - Set `X-Request-ID` response header
  - Honor client-provided `X-Request-ID` header if present (passthrough)

### 2. Create Basic Request Logging Middleware
- `src/shared/middleware/logging.middleware.ts`
  - Log incoming requests (method, url, requestId) using existing `logger`
  - Log outgoing responses (status code, response time) on finish
  - Do NOT log sensitive headers (authorization, cookie)

### 3. Create CORS Middleware
- `src/shared/middleware/cors.middleware.ts`
  - Implement as a pure function (not the `cors` npm package)
  - Read allowed origins from `config.corsOrigin`
  - Set `Access-Control-Allow-Origin`, `Allow-Credentials`, `Allow-Methods`, `Allow-Headers`
  - Handle preflight `OPTIONS` requests
  - Reflect origin for allowed origins; deny unlisted origins

### 4. Create Global Error Handler Middleware
- `src/shared/middleware/error.middleware.ts`
  - Catch all errors (both `AppError` and unknown)
  - For `AppError`: use `err.toJSON()` for structured response
  - For unknown errors: log with `logger.error`, return 500 `INTERNAL_ERROR`
  - Response shape: `{ success: false, error: { code, message, requestId } }`
  - Include `requestId` in every error response
  - Never leak stack traces to the client

### 5. Create 404 Handler
- `src/shared/middleware/error.middleware.ts` — included in the same file as the global error handler
  - Catch-all after all routes
  - Return `{ success: false, error: { code: "NOT_FOUND", message: "Route not found", requestId } }` with 404

### 6. Create Health Module Routes
- `src/modules/health/health.routes.ts`
  - `GET /health` — returns status, uptime (seconds), DB connectivity, Redis connectivity
  - `GET /health/ready` — readiness probe (200 if dependencies ready, 503 otherwise)
  - `GET /health/live` — liveness probe (200 OK, simple)
  - These routes do NOT require auth

### 7. Create Express App Factory
- `src/app.ts`
  - Register middleware in this exact order (per `BACKEND_IMPLEMENTATION_REFERENCE.md` §5):

```typescript
app.use(requestId());          // 1. Request ID
app.use(corsMiddleware());     // 2. CORS (local implementation)
app.use(requestLogger());      // 3. Request logging
app.use(express.json());       // 4. Body parsing (JSON)
app.use(express.urlencoded()); // 4. Body parsing (URL-encoded)
// Health routes registered here
app.use(errorHandler());       // 5. Global error handler (last, includes 404)
```

  - Mount health routes at **root paths** (`/health`, `/health/ready`, `/health/live`) as required by `BACKEND_ENGINEERING_BIBLE.md` and `API_CONTRACT.md`
  - Optionally also mount an alias at `/api/v1/health`
  - Export `createApp()` factory function

### 8. Create Server Lifecycle
- `src/server.ts`
  - Start HTTP server on `config.port`
  - Log startup (port, environment)
  - Handle graceful shutdown on `SIGTERM` and `SIGINT`
  - Disconnect Prisma (`prisma.$disconnect()`) and Redis (`disconnectRedis()`) on shutdown

### 9. Update Entry Point
- `src/index.ts` — update to import and call `server.ts` instead of bare exports

---

## Forbidden Scope

- Do NOT implement auth middleware or JWT logic (CHECKPOINT_7)
- Do NOT implement validation middleware or Zod schemas (CHECKPOINT_6)
- Do NOT implement rate limiting (CHECKPOINT_8)
- Do NOT create domain modules (students, companies, internships, applications, schools, admin)
- Do NOT modify existing Core Utilities files (`src/shared/lib/*`, `src/shared/errors/*`, `src/shared/utils/*`, `src/shared/types/*`, `src/config/*`)
- Do NOT install the `cors` npm package or `uuid` npm package
- Do NOT write tests (reserved for CHECKPOINT_15)

---

## Acceptance Criteria

- [ ] Server starts on the configured port without errors
- [ ] `GET /health` returns status, uptime, DB status, Redis status
- [ ] `GET /health/ready` and `GET /health/live` return 200
- [ ] Unknown routes return `404` with `{ success: false, error: { code: "NOT_FOUND", ... } }`
- [ ] Errors are caught and formatted with `success: false` and `requestId`
- [ ] Every response has `X-Request-ID` header
- [ ] CORS headers present on responses (Origin, Methods, Headers, Credentials)
- [ ] OPTIONS preflight requests handled correctly
- [ ] Requests and responses are logged via pino
- [ ] Graceful shutdown disconnects Prisma and Redis
- [ ] TypeScript compiles without errors (`npm run typecheck`)
- [ ] ESLint passes without errors (`npm run lint`)

---

## Estimated Time

3 hours
