# STATE_MACHINES.md

> **State machines define valid transitions for entities.** Every state change must follow the defined paths. Invalid transitions are rejected.

---

## 1. Internship State Machine

```
                    ┌──────────┐
                    │  DRAFT   │
                    └────┬─────┘
                         │ publish
                    ┌────▼─────┐
              ┌─────│  ACTIVE  │──────┐
              │     └────┬─────┘      │
              │          │            │
         close │    extend/deadline   │ expire
              │          │            │
              │     ┌────▼─────┐      │
              └────>│  CLOSED  │<─────┘
                    └──────────┘
```

**States:**
- `DRAFT` — Being edited, not visible to students
- `ACTIVE` — Published, accepting applications
- `CLOSED` — No longer accepting applications (manually closed or expired)

**Transitions:**
| From | To | Trigger | Who |
|------|----|---------|-----|
| DRAFT | ACTIVE | publish | COMPANY, ADMIN |
| ACTIVE | CLOSED | close / expire | COMPANY, ADMIN, system |
| ACTIVE | ACTIVE | extend deadline | COMPANY, ADMIN |
| CLOSED | ACTIVE | reopen | COMPANY, ADMIN |

**Rules:**
- Only `ACTIVE` internships appear in student searches
- Expired internships auto-transition to `CLOSED` via scheduled job
- Closed internships retain their data for reference

---

## 2. Application State Machine

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

**States:**
- `PENDING` — Submitted, awaiting review
- `REVIEWED` — Reviewed by company, no decision yet
- `SHORTLISTED` — Candidate shortlisted for further steps
- `ACCEPTED` — Offer made and accepted
- `REJECTED` — Application not successful
- `WITHDRAWN` — Student withdrew application

**Transitions:**
| From | To | Trigger | Who |
|------|----|---------|-----|
| PENDING | REVIEWED | review | COMPANY |
| PENDING | SHORTLISTED | shortlist | COMPANY |
| PENDING | REJECTED | reject | COMPANY |
| PENDING | WITHDRAWN | withdraw | STUDENT |
| REVIEWED | SHORTLISTED | shortlist | COMPANY |
| REVIEWED | REJECTED | reject | COMPANY |
| SHORTLISTED | ACCEPTED | accept | COMPANY |
| SHORTLISTED | REJECTED | reject | COMPANY |
| ACCEPTED | REJECTED | decline | STUDENT |

**Rules:**
- Student can only withdraw from `PENDING` or `REVIEWED` states
- Company cannot change status after `ACCEPTED` (final)
- Status changes are audited (see `DATABASE_INTEGRITY_RULES.md`)
- Email notification sent on status change to `ACCEPTED` or `REJECTED`

---

## 3. Account State Machine

```
                    ┌──────────┐
              ┌────>│  ACTIVE  │────┐
              │     └──────────┘    │
         reactivate            suspend
              │     ┌──────────┐    │
              └─────│ SUSPENDED│<───┘
                    └──────────┘
                    
                    ┌──────────┐
                    │  PENDING │  ← Registration not yet verified
                    └────┬─────┘
                         │ verify
                    ┌────▼─────┐
                    │  ACTIVE  │
                    └──────────┘
```

**States:**
- `PENDING` — Registered but not verified (email/phone)
- `ACTIVE` — Verified and active
- `SUSPENDED` — Temporarily disabled (by admin or system)

**Transitions:**
| From | To | Trigger | Who |
|------|----|---------|-----|
| PENDING | ACTIVE | verify email/phone | SYSTEM |
| ACTIVE | SUSPENDED | suspend | ADMIN, SYSTEM |
| SUSPENDED | ACTIVE | reactivate | ADMIN |

**Rules:**
- Suspended users cannot log in
- Suspended users' content remains visible (no data loss)
- Account deletion is a separate process (GDPR right to erasure)

---

## 4. Implementation Pattern

State transitions are enforced in the **service layer**:

```typescript
const VALID_TRANSITIONS: Record<ApplicationStatus, ApplicationStatus[]> = {
  PENDING: ['REVIEWED', 'SHORTLISTED', 'REJECTED', 'WITHDRAWN'],
  REVIEWED: ['SHORTLISTED', 'REJECTED'],
  SHORTLISTED: ['ACCEPTED', 'REJECTED'],
  ACCEPTED: [],
  REJECTED: [],
  WITHDRAWN: [],
};

export function validateTransition(
  from: ApplicationStatus, 
  to: ApplicationStatus
): void {
  const allowed = VALID_TRANSITIONS[from];
  if (!allowed.includes(to)) {
    throw new UnprocessableError(
      `Cannot transition application from ${from} to ${to}`
    );
  }
}
```

---

*State machines prevent invalid states. Enforce them rigorously.*
