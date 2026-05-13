# CHECKPOINT 12: Applications Module

**Prerequisites:** CHECKPOINT_11_INTERNSHIPS ✅

---

## Goal

Implement the Application module: role-scoped listing, detail view, status management (with state machine enforcement), withdrawal, and immutable status history tracking.

> ⚠️ **CP11 Boundary:** `POST /internships/:internshipId/apply` is already implemented in Checkpoint 11. That endpoint creates applications in `PENDING` status. **This checkpoint does NOT re-implement or modify the apply endpoint.** See §6 — Forbidden Scope.

---

## Reference Documents

| Document | Key Insight |
|----------|-------------|
| `docs/api/APPLICATION_ROUTES.md` | Full API contract for all 4 application endpoints |
| `docs/engineering/STATE_MACHINES.md` | Valid application status transitions and enforcement pattern |
| `docs/security/AUTHORIZATION_MATRIX.md` | Role-based access: STUDENT=SELF, COMPANY=OWNER, ADMIN=all |
| `apps/api/prisma/schema.prisma` | `Application` and `ApplicationStatusHistory` models exist — no schema changes needed |
| `apps/api/src/modules/applications/application.schema.ts` | Existing Zod schemas for status update, withdraw, and listing |
| `apps/api/src/modules/internships/internship.repository.ts` | Contains `createApplication()` and `findApplicationByInternshipAndStudent()` — do not duplicate |
| `apps/api/src/modules/internships/internship.service.ts` | Contains `apply()` — creates PENDING applications. Not modified by CP12. |

---

## Endpoints

| Method | Path | Auth | Authorization | Description |
|--------|------|------|---------------|-------------|
| `GET` | `/applications` | Required | Role-scoped | List applications (STUDENT=own, COMPANY=own internship apps, ADMIN=all) |
| `GET` | `/applications/:applicationId` | Required | OWNER/ADMIN | Application detail with status history |
| `PATCH` | `/applications/:applicationId/status` | Required | COMPANY/ADMIN | Update application status (state machine enforced) |
| `POST` | `/applications/:applicationId/withdraw` | Required | STUDENT | Withdraw own application (PENDING or REVIEWED only) |

---

## Tasks

### 1. Update `application.schema.ts`

**Changes needed:**
- Add `applicationIdParamSchema` — validates `:applicationId` as UUID
- Tighten `listApplicationQuerySchema.sort` to use `z.enum(['appliedAt', 'updatedAt', 'status'])` instead of `z.string()` — rejects invalid sort fields at validation layer
- Update `listApplicationQuerySchema` to support cursor-based pagination (`cursor: z.string().uuid().optional()`, `pageSize` transformed to `limit`). No offset-based pagination — cursor-only.
- Add `APPLICATION_SORT_FIELDS` constant export

**Existing schemas to retain** (already correct):
- `updateApplicationStatusSchema` — status (REVIEWED/SHORTLISTED/ACCEPTED/REJECTED), note (max 500), message (max 1000)
- `withdrawApplicationSchema` — reason (max 500, optional)

### 2. Create `application.repository.ts`

**Path:** `apps/api/src/modules/applications/application.repository.ts`

**Methods:**

| Method | Description |
|--------|-------------|
| `findById(id)` | Single application with `student` (user), `internship` (company), `statusHistory` (ordered by `createdAt` ascending). Used for detail view, ownership checks, and status updates. |
| `findAll(filters)` | Role-scoped list with cursor-based pagination, status filter, internshipId filter, sort, order. Returns `limit+1` rows for `hasMore` detection. |
| `updateStatus(id, status)` | Update application status. Returns updated application. |
| `createStatusHistory(data)` | Create immutable `ApplicationStatusHistory` record (fromStatus, toStatus, changedById, note). |
| `withdraw(id)` | Set status to `WITHDRAWN`. |

**Scoping in `findAll`:**
- If `studentId` is provided → filter by `application.studentId`
- If `companyId` is provided → filter by `application.internship.companyId`
- If neither → return all (ADMIN)
- These are mutually exclusive — service layer chooses which path

**No duplicate or creation methods:**
- `createApplication()` and `findApplicationByInternshipAndStudent()` already exist in `internship.repository.ts`
- Do NOT duplicate them here

### 3. Create `application.service.ts`

**Path:** `apps/api/src/modules/applications/application.service.ts`

**Functions:**

| Function | Description |
|----------|-------------|
| `list(userId, userRole, filters)` | Routes to `findAll` with correct scoping: STUDENT → studentId, COMPANY → companyId lookup, ADMIN → no filter. Returns cursor-paginated results with shaped response (no internal fields leaked). |
| `getById(applicationId, userId, userRole)` | Detail view with ownership check. Returns application with status history. Student sees own, Company sees internship-owned, ADMIN sees all. Student CANNOT see `companyNote`. Company CAN see student email/phone/resumeUrl. |
| `updateStatus(applicationId, data, userId, userRole)` | Validates state machine transition. Creates `ApplicationStatusHistory` entry. Does NOT create `AuditLog` entry (deferred — see KNOWN_GAPS_REGISTER.md). Returns updated application. |
| `withdraw(applicationId, data, userId)` | Validates application is in PENDING or REVIEWED. Sets status to WITHDRAWN. Creates `ApplicationStatusHistory` entry. |

**State Machine Implementation:**

```typescript
const VALID_TRANSITIONS: Record<string, string[]> = {
  PENDING: ['REVIEWED', 'SHORTLISTED', 'REJECTED'],
  REVIEWED: ['SHORTLISTED', 'REJECTED'],
  SHORTLISTED: ['ACCEPTED', 'REJECTED'],
  ACCEPTED: [],     // Terminal — no further status changes by company
  REJECTED: [],     // Terminal
  WITHDRAWN: [],    // Terminal
};
```

> **Note:** WITHDRAWN is excluded from `VALID_TRANSITIONS` because it is handled separately by the `withdraw()` function (only from PENDING or REVIEWED). ACCEPTED → REJECTED (student decline) is also not included in company-side transitions — it will be handled as part of the withdraw/decline flow. See `STATE_MACHINES.md` for full transition details.

**Transition validation helper:**

```typescript
function validateTransition(from: string, to: string): void {
  const allowed = VALID_TRANSITIONS[from];
  if (!allowed || !allowed.includes(to)) {
    throw new UnprocessableError(
      `Cannot transition application from ${from} to ${to}`,
    );
  }
}
```

**Notification Gaps:**
- `APPLICATION_ROUTES.md` specifies email notification on status change
- No email provider is integrated (see `KNOWN_GAPS_REGISTER.md`)
- Status update succeeds without email sending
- Notifications are deferred until an email provider is integrated

### 4. Create `application.routes.ts`

**Path:** `apps/api/src/modules/applications/application.routes.ts`

**Routes:**

```typescript
// GET /applications — Role-scoped listing
router.get(
  '/applications',
  authenticate,
  validate(listApplicationQuerySchema, 'query'),
  asyncHandler(async (req: Request, res: Response) => {
    const result = await applicationService.list(
      req.user!.id,
      req.user!.role,
      req.query as unknown as ListApplicationQuery,
    );
    res.status(200).json({
      success: true,
      data: result.data,
      meta: result.meta,
    });
  }),
);

// GET /applications/:applicationId — Detail view
router.get(
  '/applications/:applicationId',
  authenticate,
  validate(applicationIdParamSchema, 'params'),
  asyncHandler(async (req: Request, res: Response) => {
    const result = await applicationService.getById(
      req.params.applicationId,
      req.user!.id,
      req.user!.role,
    );
    res.status(200).json({
      success: true,
      data: result,
    });
  }),
);

// PATCH /applications/:applicationId/status — Status update
router.patch(
  '/applications/:applicationId/status',
  authenticate,
  authorize('COMPANY', 'ADMIN'),
  validate(applicationIdParamSchema, 'params'),
  validate(updateApplicationStatusSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const result = await applicationService.updateStatus(
      req.params.applicationId,
      req.body as UpdateApplicationStatusInput,
      req.user!.id,
      req.user!.role,
    );
    res.status(200).json({
      success: true,
      data: result,
    });
  }),
);

// POST /applications/:applicationId/withdraw — Withdraw
router.post(
  '/applications/:applicationId/withdraw',
  authenticate,
  validate(applicationIdParamSchema, 'params'),
  validate(withdrawApplicationSchema),
  asyncHandler(async (req: Request, res: Response) => {
    // Authorization: must be the applicant student
    const result = await applicationService.withdraw(
      req.params.applicationId,
      req.body,
      req.user!.id,
    );
    res.status(200).json({
      success: true,
      data: result,
    });
  }),
);
```

**Route ordering notes:**
- `authorize('COMPANY', 'ADMIN')` on status update is a coarse gate — service layer enforces strict ownership (company must own the internship)
- Withdraw does NOT use `authorize` middleware — service layer checks that the student owns the application

### 5. Register routes in `app.ts`

**File:** `apps/api/src/app.ts`

**Change:**
```typescript
import applicationRoutes from './modules/applications/application.routes.js';

// After internship routes:
app.use('/api/v1', applicationRoutes);
```

### 6. Write Tests

#### Service unit tests (`__tests__/application.service.test.ts`)

Mock repository layer. No database.

| Test Group | Scenarios | Est. Count |
|------------|-----------|------------|
| `list` | Student sees own apps, Company sees own internship apps, ADMIN sees all, empty results, status filter, internshipId filter, cursor pagination, forbidden access (other student) | 8 |
| `getById` | Student own, Company owner, ADMIN, student contact info visible to company, `companyNote` hidden from student, statusHistory included, NotFound, Forbidden (not owner) | 8 |
| `updateStatus` | Valid transitions for each path: PENDING→REVIEWED, PENDING→SHORTLISTED, PENDING→REJECTED, REVIEWED→SHORTLISTED, REVIEWED→REJECTED, SHORTLISTED→ACCEPTED, SHORTLISTED→REJECTED; invalid transitions: PENDING→ACCEPTED, REVIEWED→ACCEPTED, ACCEPTED→anything, REJECTED→anything, WITHDRAWN→anything; NotFound; Forbidden (not company owner); statusHistory created correctly; note+message handling | 16 |
| `withdraw` | PENDING→WITHDRAWN (valid), REVIEWED→WITHDRAWN (valid), SHORTLISTED (invalid), ACCEPTED (invalid), REJECTED (invalid), WITHDRAWN (already withdrawn), NotFound, Forbidden (not owner) | 8 |

**Est. total: ~40 service tests**

#### Route integration tests (`__tests__/application.routes.test.ts`)

Mock auth middleware, rate limiter, service layer. Supertest.

| Test Group | Scenarios | Est. Count |
|------------|-----------|------------|
| `GET /applications` | 200 (student), 200 (company), 200 (admin), 401 (no auth), status filter, cursor pagination, 400 (invalid sort field), 400 (invalid status filter) | 8 |
| `GET /applications/:id` | 200 (applicant), 200 (company owner), 200 (admin), 404 (not found), 403 (other student), 403 (other company), 400 (invalid UUID), 401 (no auth) | 8 |
| `PATCH /applications/:id/status` | 200 (company owner), 200 (admin), 200 with note+message, 422 (invalid transition), 403 (student), 403 (other company), 404 (not found), 400 (invalid UUID), 400 (invalid status value), 401 (no auth) | 10 |
| `POST /applications/:id/withdraw` | 200 (applicant), 200 with reason, 422 (wrong state e.g., SHORTLISTED), 403 (company), 404 (not found), 400 (invalid UUID), 401 (no auth) | 7 |

**Est. total: ~33 route tests**

**Grand total: ~73 tests** (service + route)

---

## State Machine Enforcement

### Application State Machine

```
                    ┌──────────┐
                    │  PENDING │
                    └────┬─────┘
                         │
              ┌──────────┼──────────┐
              │          │          │
         review     shortlist   reject
              │          │          │
        ┌─────▼───┐ ┌───▼────┐     │
        │ REVIEWED│ │SHORTLIST│     │
        └─────┬───┘ └───┬────┘     │
              │          │          │
         reject    accept/reject    │
              │          │          │
              │     ┌────▼────┐     │
              │     │ACCEPTED │     │
              │     └────┬────┘     │
              │          │          │
              │     ┌────▼────┐     │
              └────>│ REJECTED│<────┘
                     └─────────┘
```

### Valid Transitions

| From | To | Trigger | Who |
|------|----|---------|-----|
| PENDING | REVIEWED | review | COMPANY |
| PENDING | SHORTLISTED | shortlist | COMPANY |
| PENDING | REJECTED | reject | COMPANY |
| PENDING | WITHDRAWN | withdraw | STUDENT |
| REVIEWED | SHORTLISTED | shortlist | COMPANY |
| REVIEWED | REJECTED | reject | COMPANY |
| REVIEWED | WITHDRAWN | withdraw | STUDENT |
| SHORTLISTED | ACCEPTED | accept | COMPANY |
| SHORTLISTED | REJECTED | reject | COMPANY |
| ACCEPTED | REJECTED | decline | STUDENT |

### Transition Rules

- WITHDRAWN is handled by the `withdraw()` service method (separate from `updateStatus`)
- ACCEPTED → REJECTED (student decline) is a student action, not a company action. Implementation detail: either a dedicated `decline` route or a parameter on withdraw.
- Company `updateStatus` does NOT allow WITHDRAWN as a target status
- Company `updateStatus` does NOT allow transitions from WITHDRAWN or REJECTED (terminal states)
- Status history entries are immutable: once created, they cannot be edited or deleted

---

## Authorization Rules

### Route-Level (via `authorize` middleware)

| Endpoint | Middleware Guard |
|----------|-----------------|
| `GET /applications` | Authenticated only — role scoping in service |
| `GET /applications/:id` | Authenticated only — ownership check in service |
| `PATCH /applications/:id/status` | `authorize('COMPANY', 'ADMIN')` |
| `POST /applications/:id/withdraw` | Authenticated only — ownership check in service (must be applicant student) |

### Service-Level (ownership checks)

| Endpoint | Student Check | Company Check | Admin |
|----------|--------------|---------------|-------|
| `list` | `application.studentId === student.id` | `internship.company.userId === userId` | All |
| `getById` | `application.studentId === student.id` | `internship.company.userId === userId` | All |
| `updateStatus` | ❌ Not allowed | `internship.company.userId === userId` | All |
| `withdraw` | `application.studentId === student.id` | ❌ Not allowed | All |

### Data Visibility Rules

#### List View (`GET /applications`) — All Roles
| Field | Student | Company | Admin |
|-------|---------|---------|-------|
| `companyNote` | ❌ | ❌ | ❌ |
| `statusHistory` | ❌ | ❌ | ❌ |
| `student.resumeUrl` | ❌ | ❌ | ❌ |
| `student.user.email` | ❌ | ❌ | ❌ |
| `student.user.phone` | ❌ | ❌ | ❌ |
| Student id, grade, user.id, firstName, lastName | ✅ | ✅ | ✅ |

#### Detail View (`GET /applications/:applicationId`) — By Role
| Field | Student (self) | Company (owner) | Admin |
|-------|---------------|-----------------|-------|
| `coverLetter` | ✅ | ✅ | ✅ |
| `additionalInfo` | ✅ | ✅ | ✅ |
| `statusHistory` | ✅ | ✅ | ✅ |
| Student email/phone | ❌ | ✅ | ✅ |
| Student resumeUrl | ✅ | ✅ | ✅ |
| `companyNote` | ❌ | ✅ | ✅ |
| `message` (shared) | ✅ | ✅ | ✅ |

---

## Validation Rules

| Field/Param | Source | Zod Validation |
|-------------|--------|---------------|
| `applicationId` | params | UUID |
| `status` (update) | body | Enum: `REVIEWED`, `SHORTLISTED`, `ACCEPTED`, `REJECTED` |
| `note` (update) | body | Max 500 chars, trimmed, optional |
| `message` (update) | body | Max 1000 chars, trimmed, optional |
| `reason` (withdraw) | body | Max 500 chars, trimmed, optional |
| `cursor` | query | UUID, optional |
| `pageSize` | query | Coerce to int, 1–100, default 20 |
| `status` (list filter) | query | Enum: all 6 ApplicationStatus values, optional |
| `internshipId` (list filter) | query | UUID, optional |
| `sort` (list) | query | Enum: `appliedAt`, `updatedAt`, `status` |
| `order` (list) | query | Enum: `asc`, `desc`, default `desc` |

---

## Acceptance Criteria

- [ ] `GET /applications` returns scoped results: STUDENT sees own, COMPANY sees own internship apps, ADMIN sees all
- [ ] `GET /applications` supports cursor-based pagination, status filter, internshipId filter, sort, order
- [ ] `GET /applications/:applicationId` returns full detail with `statusHistory`, respects data visibility rules
- [ ] `PATCH /applications/:applicationId/status` enforces state machine: valid transitions succeed, invalid return 422
- [ ] `PATCH /applications/:applicationId/status` creates `ApplicationStatusHistory` entry on every status change
- [ ] `PATCH /applications/:applicationId/status` does NOT create `AuditLog` entries (deferred — logged in KNOWN_GAPS_REGISTER.md)
- [ ] `POST /applications/:applicationId/withdraw` succeeds only for PENDING or REVIEWED applications
- [ ] `POST /applications/:applicationId/withdraw` creates `ApplicationStatusHistory` entry
- [ ] COMPANIES cannot change status after ACCEPTED (terminal)
- [ ] STUDENTS cannot change status via `updateStatus` — only via `withdraw`
- [ ] No email/notification is sent on status change (deferred — logged in KNOWN_GAPS)
- [ ] **List-safe response**: `GET /applications` does NOT expose `companyNote`, `statusHistory`, `student.resumeUrl`, `student.user.email`, or `student.user.phone` for ANY role
- [ ] **Detail data visibility**: `companyNote` hidden from STUDENT; student email/phone visible to COMPANY and ADMIN only (not to STUDENT)
- [ ] All tests pass (service + route)

---

## Known Gaps

### Notification Emails

The API contract specifies email notifications on status changes. Since no email provider is integrated, status update succeeds without sending notifications. This is tracked in `docs/engineering/KNOWN_GAPS_REGISTER.md`. Email integration is deferred to a future checkpoint.

### Audit Log Entries

The `PATCH /applications/:applicationId/status` endpoint creates `ApplicationStatusHistory` records for every status transition, providing an immutable audit trail. However, no centralized `AuditLog` entries are created. A shared audit facility will be built in a future checkpoint. This is tracked in `docs/engineering/KNOWN_GAPS_REGISTER.md`.

### `message` Field Accepted But Not Persisted

`updateApplicationStatusSchema` accepts a `message` field on `PATCH /applications/:applicationId/status`. This field is intended to carry a shared message visible to both the student and the company. However, no corresponding database column exists on either the `Application` or `ApplicationStatusHistory` model. The field is accepted at the API boundary but silently ignored — it is neither stored nor returned in subsequent reads. Tracked in `docs/engineering/KNOWN_GAPS_REGISTER.md`.

### Student Decline (ACCEPTED → REJECTED)

The state machine specifies that a student can decline an accepted offer (ACCEPTED → REJECTED). The initial CP12 implementation should handle this either via:
- A dedicated `POST /applications/:id/decline` endpoint (cleaner separation)
- An extended withdraw endpoint that allows withdrawal from non-waiting states when the user is the student

This decision is deferred to implementation — the spec allows either approach.

---

## Forbidden Scope

- ❌ Do NOT re-implement or modify `POST /internships/:internshipId/apply` (already in CP11)
- ❌ Do NOT modify `internship.repository.ts` or `internship.service.ts` (owned by CP11)
- ❌ Do NOT implement email notifications (no provider — log gap instead)
- ❌ Do NOT modify Prisma schema or run migrations (no changes needed)
- ❌ Do NOT modify auth middleware (`authenticate`/`authorize`)
- ❌ Do NOT modify rate-limit middleware
- ❌ Do NOT modify validation middleware
- ❌ Do NOT modify error middleware
- ❌ Do NOT implement School module (Checkpoint 13)
- ❌ Do NOT implement Admin module (Checkpoint 14)
- ❌ Do NOT implement production readiness features
- ❌ Do NOT install npm packages
- ❌ Do NOT use `any` types in TypeScript
- ❌ Do NOT leave TypeScript errors (no `// @ts-ignore`)

---

## Estimated Time

8 hours

---

## Implementation Order

1. Update `application.schema.ts` — add param schema, tighten sort to enum, add cursor pagination support
2. Create `application.repository.ts` — 5 methods
3. Create `application.service.ts` — 4 functions + state machine
4. Create `application.routes.ts` — 4 endpoints
5. Register routes in `app.ts`
6. Build `__tests__/application.service.test.ts` (~40 tests)
7. Build `__tests__/application.routes.test.ts` (~33 tests)
8. Run `npm run typecheck`, `npm run lint`, `npm run test`
