# INTERNSHIP_APPLICATION_FLOW_EXPLAINED.md

> **Step-by-step walkthrough of the internship application process.**

---

## 1. Complete Flow Diagram

```
STUDENT                            COMPANY                         SYSTEM
   │                                  │                              │
   ├── Browse internships ────────────┤                              │
   │     (GET /internships)           │                              │
   │                                  │                              │
   ├── View internship details ───────┤                              │
   │     (GET /internships/:id)       │                              │
   │                                  │                              │
   ├── Apply for internship ──────────┤                              │
   │     (POST /internships/:id/apply)│                              │
   │                                  │                              ├── Validate input
   │                                  │                              ├── Check duplicate
   │                                  │                              ├── Check status/deadline
   │                                  │                              ├── Create application
   │                                  │                              ├── Create audit log
   │                                  │                              └── Notify company
   │                                  │                              │
   │                                  ├── Receives notification ─────┤
   │                                  ├── Reviews application ──────┤
   │                                  │     (GET /applications/:id)  │
   │                                  │                              │
   │                                  ├── Updates status ───────────┤
   │                                  │     (PATCH /applications/    │
   │                                  │       :id/status)            ├── Validate transition
   │                                  │                              ├── Update status
   │                                  │                              ├── Create history entry
   │                                  │                              ├── Create audit log
   │                                  │                              └── Notify student
   │                                  │                              │
   ├── Receives notification ─────────┤                              │
   ├── Views status update ──────────┤                              │
   │                                  │                              │
   │                              (Continue until accepted/rejected) │
```

---

## 2. Step-by-Step Detail

### Step 1: Browsing Internships (Public)

**Who:** Student (no auth required for browsing)

**Endpoint:** `GET /api/v1/internships`

**What happens:**
1. Student searches with optional filters (city, type, grade, tags)
2. System queries database for `ACTIVE` internships
3. Results are paginated (cursor-based)
4. Only public fields are returned (no applicant data)

**Filters available:**
- Search by keyword (title, description, company name)
- Filter by city, type, duration, grade level
- Filter by tags
- Sort by date, title, company

### Step 2: Viewing Internship Details (Public)

**Who:** Student (no auth required)

**Endpoint:** `GET /api/v1/internships/:id`

**What happens:**
1. Student clicks on an internship
2. System returns full details (description, requirements, stipend, deadline)
3. Company information is included (name, logo, industry)

### Step 3: Applying (Authenticated)

**Who:** Student (must be authenticated, role = STUDENT)

**Endpoint:** `POST /api/v1/internships/:id/apply`

**What the system checks:**
1. ✅ Is the student authenticated?
2. ✅ Is the student's role `STUDENT`?
3. ✅ Is the internship in `ACTIVE` status?
4. ✅ Has the deadline passed?
5. ✅ Has the student already applied? (duplicate check)
6. ✅ Does the student meet grade requirements?
7. ✅ Is the student's profile complete? (resume uploaded, school set)

**If all checks pass:**
1. Application is created with status `PENDING`
2. Audit log entry is created
3. Company receives notification (email)
4. Student sees confirmation

**If any check fails:**
- Appropriate error is returned (422 for business rules, 409 for duplicates)

### Step 4: Company Reviews

**Who:** Company user (must be authenticated, must own the internship)

**Endpoint:** `GET /api/v1/applications/:id`

**What the company sees:**
- Student's name, school, grade
- Resume (downloadable)
- Cover letter
- Application timeline

**What the company does NOT see:**
- Student's contact info (email, phone) — intentionally hidden until further stages
- Other applicants' data

### Step 5: Status Update

**Who:** Company user

**Endpoint:** `PATCH /api/v1/applications/:id/status`

**Valid transitions (see STATE_MACHINES.md):**
- `PENDING → REVIEWED` (acknowledged receipt)
- `PENDING → SHORTLISTED` (interested candidate)
- `PENDING → REJECTED` (not moving forward)
- `REVIEWED → SHORTLISTED` (interested after review)
- `REVIEWED → REJECTED` (not moving forward after review)
- `SHORTLISTED → ACCEPTED` (offer!)
- `SHORTLISTED → REJECTED` (not selected)

**What happens on status update:**
1. System validates the transition is allowed
2. Application status is updated
3. Status history entry is created (immutable)
4. Audit log is created
5. Student is notified (email)

### Step 6: Student Can Withdraw

**Who:** Student

**Endpoint:** `POST /api/v1/applications/:id/withdraw`

**Rules:**
- Can only withdraw from `PENDING` or `REVIEWED` status
- Cannot undo withdrawal
- Company is notified
- Withdrawn applications remain visible in history (marked as WITHDRAWN)

---

## 3. Business Rules Summary

| Rule | Where Enforced | Consequence |
|------|---------------|-------------|
| One application per internship per student | DB unique constraint + service check | Duplicate = 409 |
| Internship must be ACTIVE | Service check | Closed internship = 422 |
| Deadline must not have passed | Service check | Past deadline = 422 |
| Student must meet grade requirements | Service check | Below minimum = 422 |
| Student must have complete profile | Service check | Incomplete = 422 |
| Status transitions must be valid | Service check | Invalid transition = 422 |
| Only company can change status | Auth middleware + ownership check | Unauthorized = 403 |
| Only student can withdraw own application | Auth middleware + ownership check | Unauthorized = 403 |

---

## 4. Notification Triggers

| Event | Notification Type | Recipient |
|-------|-------------------|-----------|
| New application submitted | Email | Company |
| Application status changed | Email | Student |
| Application withdrawn | Email | Company |
| Internship expiring soon | Email | Company (future) |
| New internship matching profile | Email | Student (future) |

---

## 5. Edge Cases

| Scenario | Handling |
|----------|----------|
| Student applies, then internship is closed | Application remains valid, internship shows as CLOSED |
| Student deletes account after applying | Application stays, student marked as "deleted user" |
| Company deletes account | Internships are closed, applications are closed |
| Two students apply simultaneously | Each is independent, no race condition |
| Student applies twice (duplicate) | 409 Conflict — "Already applied" |
| Company rejects, then wants to revert | Not allowed — state machines are one-directional |

---

*This flow is the heart of the platform. Test every path.*
