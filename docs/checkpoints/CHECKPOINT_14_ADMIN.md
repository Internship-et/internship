# CHECKPOINT 14: Admin Module

**Prerequisites:** CHECKPOINT_13_SCHOOLS ✅

---

## Goal

Implement the Admin module: dashboard, user management, audit logs, and reports.

All admin endpoints are ADMIN-only. Every route requires `authenticate` + `authorize('ADMIN')` (uses rest parameters, so `authorize('ADMIN')` not `authorize(['ADMIN'])`).

---

## Tasks

### 1. Extend Admin Schema

- `src/modules/admin/admin.schema.ts` (add to existing):

  - **`userIdParamSchema`** — `z.object({ userId: z.string().uuid('User ID must be a valid UUID') })` for `PATCH /admin/users/:userId/status` and detail lookups.
  - **`listUsersQuerySchema`** — offset pagination (`page`, `pageSize`), `search` (string, trimmed, max 200), `role` (enum UserRole), `status` (enum UserStatus), `isVerified` (coerced boolean), `sort` (default `createdAt`), `order` (asc/desc, default `desc`).
  - **`dashboardQuerySchema`** — optional `from`/`to` ISO datetime range for dashboard date window (defaults to today and 30 days ago if not provided).
  - **`reportQuerySchema`** — `type` (enum: `users`, `internships`, `applications`, `companies`, `schools`), `format` (enum: `json` | `csv`, default `json`), `from` (optional ISO datetime, default 30 days ago), `to` (optional ISO datetime, default today).

  **Retain existing schemas** (do not remove):
  - `updateUserStatusSchema` — `status` (ACTIVE | SUSPENDED), `reason` (1–500 chars, trimmed, required), `notifyUser` (boolean, default true).
  - `listAuditLogQuerySchema` — offset pagination with `page`, `pageSize`, `userId`, `action`, `entity`, `from`, `to` filters.

### 2. Create Admin Repository

- `src/modules/admin/admin.repository.ts`:

  - **Dashboard / Stats**
    - `countUsers(role?, status?)` — count users optionally filtered by role/status.
    - `countStudents()` — total active student profiles.
    - `countCompanies()` — total non-deleted companies.
    - `countSchools()` — total non-deleted schools.
    - `countInternships()` — total non-deleted internships with ACTIVE status.
    - `countApplications()` — total applications.
    - `countNewUsersToday()` — users with `createdAt >= startOfToday`.
    - `countNewUsersThisWeek()` — users with `createdAt >= startOfWeek`.
    - `countNewInternshipsToday()` — internships with `createdAt >= startOfToday`.
    - `countNewApplicationsToday()` — applications with `appliedAt >= startOfToday`.
    - `getUserGrowthByDay(days: number)` — groupBy `createdAt` by day for the last N days, `[{ date: string, count: number }]`.
    - `getActiveUsersToday()` — users with `lastLoginAt >= startOfToday`.
    - `getActiveUsersThisWeek()` — users with `lastLoginAt >= startOfWeek`.
    - `getTotalApplicationsPerInternship()` — aggregate: total applications / total internships.

  - **User Management**
    - `findAllUsers(filters)` — offset-paginated, with `search` (name/email), `role`, `status`, `isVerified`, `sort`, `order`. Returns user rows with selected fields.
    - `countAllUsers(filters)` — count matching same filters.
    - `findUserById(userId)` — single user by ID.
    - `updateUserStatus(userId, status)` — update user status.

  - **Audit Logs**
    - `findAllAuditLogs(filters)` — offset-paginated, filterable by `userId`, `action`, `entity`, `from`, `to`. Include user relation for `userEmail`.
    - `countAllAuditLogs(filters)` — count matching.

  - **Audit Log Creation**
    - `createAuditLog(data)` — create an `AuditLog` entry with `userId`, `action`, `entity`, `entityId`, `oldValue`, `newValue`, `ipAddress`, `userAgent`. Follows the existing school module pattern.

  - **Reports**
    - `getReportData(type, from, to)` — fetch raw data for the given report type (users, internships, applications, companies, schools) within the date range.

### 3. Create Admin Types

- `src/modules/admin/admin.types.ts`:

  - `DashboardResponse` — typed interface matching ADMIN_ROUTES.md: `overview` (totalUsers, totalStudents, totalCompanies, totalSchools, totalInternships, totalApplications, activeUsersToday, activeUsersThisWeek), `recentActivity` (newUsersToday, newInternshipsToday, newApplicationsToday), `platformMetrics` (applicationsPerInternship, fillRate, averageTimeToHire), `userGrowth` (array of `{ date: string, count: number }`).
  - `ListUsersFilters` — typed interface for query params.
  - `ListAuditLogFilters` — typed interface for query params.
  - `ReportParams` — typed interface for report query params.
  - `ReportResponse` — typed interface for report response data (reportType, generatedAt, parameters, data).

### 4. Create Admin Service

- `src/modules/admin/admin.service.ts`:

  - **`getDashboard(from?, to?)`** — composes the dashboard response:
    - Calls repository count methods for overview stats.
    - Computes `applicationsPerInternship` (totalApps / totalInternships, handle divide-by-zero).
    - Computes fill rate and average time to hire as placeholder/derived metrics (fillRate = 0.65 placeholder for now, averageTimeToHire = 14.5 placeholder).
    - Calls `getUserGrowthByDay()` for user growth array.
    - Returns typed `DashboardResponse`.

  - **`listUsers(filters)`** — offset-paginated user listing with search/filter/sort:
    - Delegates to repository `findAllUsers` + `countAllUsers`.
    - Returns `{ data, meta }` with offset pagination meta.

  - **`updateUserStatus(userId, status, reason, notifyUser, adminUserId, ipAddress, userAgent)`** — updates user status:
    - **Self-suspension guard**: If `adminUserId === userId`, throw `ForbiddenError('Admin cannot suspend themselves')`.
    - Fetches current user state via `findUserById`; throws `NotFoundError` if not found.
    - Calls `updateUserStatus`.
    - Creates an `AuditLog` entry capturing `oldValue` (previous status) and `newValue` (new status).
    - `notifyUser` is accepted but **no email is sent** — no email provider exists. This is a documented gap.
    - Returns `{ userId, status, updatedAt }`.

  - **`listAuditLogs(filters)`** — offset-paginated audit log listing:
    - Delegates to repository `findAllAuditLogs` + `countAllAuditLogs`.
    - Returns `{ data, meta }`.

  - **`generateReport(type, format, from, to)`** — generates platform reports:
    - Delegates to repository `getReportData` for the requested type and date range.
    - If `format === 'csv'`, serializes the data array to CSV string using simple in-service column mapping (no external dependencies).
    - If `format === 'json'`, returns the data array directly.
    - Returns `{ reportType, generatedAt, parameters: { from, to }, data }` where `data` is either a JSON array or CSV string.
    - Reports are synchronous only; async generation is deferred (documented gap).

### 5. Create Admin Routes

- `src/modules/admin/admin.routes.ts`:

  All routes mounted at `/admin` prefix (which will be registered at `/api/v1/admin` in app.ts).

  - **`GET /admin/dashboard`**
    - `authenticate`, `authorize('ADMIN')`
    - Optional query validation via `dashboardQuerySchema`
    - Calls `adminService.getDashboard(from, to)`
    - Response: `200 { success: true, data: DashboardResponse }`

  - **`GET /admin/users`**
    - `authenticate`, `authorize('ADMIN')`
    - Query validation via `listUsersQuerySchema`
    - Calls `adminService.listUsers(filters)`
    - Response: `200 { success: true, data: User[], meta: PaginationMeta }`

  - **`PATCH /admin/users/:userId/status`**
    - `authenticate`, `authorize('ADMIN')`
    - Params validation via `userIdParamSchema`
    - Body validation via `updateUserStatusSchema`
    - Calls `adminService.updateUserStatus(userId, status, reason, notifyUser, req.user!.id, req.ip, req.headers['user-agent'])`
    - Response: `200 { success: true, data: { userId, status, updatedAt } }`

  - **`GET /admin/audit-logs`**
    - `authenticate`, `authorize('ADMIN')`
    - Query validation via `listAuditLogQuerySchema`
    - Calls `adminService.listAuditLogs(filters)`
    - Response: `200 { success: true, data: AuditLog[], meta: PaginationMeta }`

  - **`GET /admin/reports`**
    - `authenticate`, `authorize('ADMIN')`
    - Query validation via `reportQuerySchema`
    - Calls `adminService.generateReport(type, format, from, to)`
    - If format is `csv`, set `Content-Type: text/csv` header; if `json`, return standard JSON response
    - Response: `200 { success: true, data: ReportResponse }`

### 6. Register Routes in app.ts

- In `src/app.ts`:
  - Add: `import adminRoutes from './modules/admin/admin.routes.js';`
  - Add: `app.use('/api/v1', adminRoutes);` after school routes (7h).

### 7. Write Tests

#### Service Unit Tests (`__tests__/admin.service.test.ts`)

Mock all repository methods. Tests should cover:

- **`getDashboard`**: returns complete dashboard structure, handles zero counts (empty platform), date range filtering.
- **`listUsers`**: returns paginated results, applies filters (search, role, status), returns empty when no matches.
- **`updateUserStatus`**: successfully suspends user, successfully activates user, throws `NotFoundError` for missing user, throws `ForbiddenError` for self-suspension, creates audit log on status change, accepts notifyUser flag (gap acknowledged).
- **`listAuditLogs`**: returns paginated results, applies filters (userId, action, date range).
- **`generateReport`**: returns JSON data for each report type (users, internships, applications, companies, schools), returns CSV string when format=csv, respects date range filters.

#### Route Integration Tests (`__tests__/admin.routes.test.ts`)

Mock auth middleware and service layer. Tests should cover:

- **GET /admin/dashboard**: 200 with dashboard data, 401 without auth, 403 for non-ADMIN roles (STUDENT, COMPANY, SCHOOL), 400 for invalid date params.
- **GET /admin/users**: 200 with paginated data, 200 with search/role filters, 401 without auth, 403 for non-ADMIN.
- **PATCH /admin/users/:userId/status**: 200 on suspend, 200 on activate, 400 for invalid status value, 400 for missing reason, 400 for invalid userId UUID, 401 without auth, 403 for non-ADMIN, 404 for nonexistent user, 403 for self-suspension.
- **GET /admin/audit-logs**: 200 with paginated data, 200 with filters, 401 without auth, 403 for non-ADMIN.
- **GET /admin/reports**: 200 with JSON users report, 200 with CSV format, 200 with internships/companies/schools/applications types, 400 for invalid report type, 401 without auth, 403 for non-ADMIN.

---

## Authorization Summary

| Endpoint | Method | Auth | Roles |
|----------|--------|------|-------|
| `/admin/dashboard` | GET | authenticate | ADMIN |
| `/admin/users` | GET | authenticate | ADMIN |
| `/admin/users/:userId/status` | PATCH | authenticate | ADMIN |
| `/admin/audit-logs` | GET | authenticate | ADMIN |
| `/admin/reports` | GET | authenticate | ADMIN |

All routes use `authorize('ADMIN')` (rest parameters pattern).

---

## Rate Limiting

- **Admin endpoints** (all `/admin/*`): 200 requests per 15 minutes, keyed by `req.user.id`.
- Applied at route level using `rateLimiter({ prefix: 'admin', max: 200, windowMs: 15 * 60 * 1000, keyGenerator: (req) => req.user!.id })`.
- Applied after `authenticate` and `authorize('ADMIN')` middleware (ensures `req.user` is populated).

---

## Documentation & Patterns

### Pagination

- All admin list endpoints use **offset-based pagination** (`page`, `pageSize` params).
- Use shared utilities `getOffsetPaginationInput` and `buildOffsetPaginationMeta` from `src/shared/utils/pagination.ts`.
- Default `pageSize` values: users = 20, audit logs = 50.

### Audit Log Creation

- `updateUserStatus` **must** create an `AuditLog` entry capturing:
  - `userId` = the admin's ID (who performed the action)
  - `action` = `'USER_STATUS_CHANGE'`
  - `entity` = `'USER'`
  - `entityId` = the target user's ID
  - `oldValue` = `{ status: previousStatus }`
  - `newValue` = `{ status: newStatus }`
  - `ipAddress` = from request
  - `userAgent` = from request
- Follows the existing pattern from the schools module (`school.repository.ts` `createAuditLog`).

### Error Handling

- Use typed errors from `src/shared/errors/app-error.ts`:
  - `NotFoundError('User not found')` for missing users
  - `ForbiddenError('Admin cannot suspend themselves')` for self-suspension
  - `ForbiddenError('Insufficient permissions')` for role checks (handled by authorize middleware)
- Standard error response shape: `{ success: false, error: { code, message, requestId } }`

### Response Shaping

- Dashboard response matches `DashboardResponse` type structure per `ADMIN_ROUTES.md`.
- User list excludes `passwordHash`, `deletedAt`.
- Audit log list includes `user.email` as `userEmail`.
- Report response includes `reportType`, `generatedAt`, `parameters`, and `data`.

---

## Forbidden Scope

- Do NOT modify Prisma schema or create migrations.
- Do NOT modify auth middleware (`authenticate`, `authorize`).
- Do NOT modify rate limiting middleware (`rateLimiter`).
- Do NOT modify error handling middleware.
- Do NOT modify existing domain modules (students, companies, internships, applications, schools, auth).
- Do NOT install any npm dependencies.
- Do NOT implement email notifications (no email provider exists — gap acknowledged).
- Do NOT implement async report generation (deferred — gap acknowledged).
- Do NOT deploy to production.

---

## Known Gaps (Documented)

| Gap | Status | Reference |
|-----|--------|-----------|
| Email notifications (`notifyUser`) | Accepted — no email sent, no provider exists | `KNOWN_GAPS_REGISTER.md` |
| Async report generation | Deferred — reports are synchronous only | `KNOWN_GAPS_REGISTER.md` |
| Persistent analytics model (daily stats table) | Deferred — userGrowth computed on-the-fly | Future checkpoint |
| CSV export library | Handled via simple in-service serialization, no dependency install | CP14 scope |

---

## Acceptance Criteria

- [ ] Dashboard returns platform overview stats, recent activity, platform metrics, and user growth data
- [ ] User listing supports offset pagination, search (name/email), and filter by role/status/isVerified
- [ ] User status update (suspend/activate) works with proper validation
- [ ] Admin cannot suspend themselves (`ForbiddenError`)
- [ ] User status changes are recorded in AuditLog
- [ ] Audit log listing supports offset pagination and filters (userId, action, entity, date range)
- [ ] Report generation works for all types (users, internships, applications, companies, schools)
- [ ] CSV report output uses simple in-service serialization
- [ ] All endpoints require `authenticate` + `authorize('ADMIN')`
- [ ] All admin endpoints are rate-limited (200 req/15min, user-ID-keyed)
- [ ] All validation errors return 400 with `VALIDATION_ERROR` code
- [ ] All tests pass (typecheck, lint, full test suite)
- [ ] No Prisma schema, middleware, dependency, or domain module changes

---

## Estimated Time

3 hours
