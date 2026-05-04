# HOW_THE_SYSTEM_WORKS.md

> **High-level overview of the entire system.** This document explains how the platform works from a technical perspective.

---

## 1. System Overview

The Ethiopian High School Internship Platform is a web application that connects high school students with local organizations offering internships.

**Three main user groups:**
1. **Students** — Browse and apply for internships
2. **Organizations** (Companies, NGOs, Startups, Institutions) — Post internships and manage applicants
3. **Schools** — Verify student enrollment and track student progress

Plus **Admins** who oversee the platform.

---

## 2. Request Lifecycle

```
┌──────────┐     ┌──────────┐     ┌──────────┐     ┌──────────┐
│  Client  │ ──> │  Proxy   │ ──> │ Express  │ ──> │ Service  │
│ (Browser)│ <── │ (nginx)  │ <── │  Routes  │ <── │  Layer   │
└──────────┘     └──────────┘     └──────────┘     └────┬─────┘
                                                         │
                                                    ┌────▼─────┐
                                                    │Repository │
                                                    │  Layer   │
                                                    └────┬─────┘
                                                         │
                                                    ┌────▼─────┐
                                                    │PostgreSQL │
                                                    └──────────┘
```

1. **Client** sends HTTP request
2. **Reverse proxy** (nginx/Caddy) terminates TLS, forwards to Express
3. **Middleware stack** processes request (CORS, rate limiting, logging, auth, validation)
4. **Route handler** parses request, calls service
5. **Service** applies business logic, calls repository
6. **Repository** queries PostgreSQL via Prisma
7. **Response** flows back through the layers

---

## 3. Module Interactions

```
                  ┌─────────┐
                  │   Auth   │
                  └────┬────┘
                       │
    ┌──────────────────┼──────────────────┐
    │                  │                  │
┌───▼────┐     ┌──────▼──────┐     ┌─────▼────┐
│Students│     │  Companies   │     │  Schools │
└───┬────┘     └──────┬──────┘     └─────┬────┘
    │                 │                  │
    │          ┌──────▼──────┐           │
    └──────────│ Internships  │──────────┘
               └──────┬──────┘
                      │
               ┌──────▼──────┐
               │ Applications │
               └─────────────┘
```

- **Auth** — Used by all modules for authentication
- **Students** — Browse internships, submit applications
- **Companies** — Create internships, review applications
- **Schools** — Verify students
- **Internships** — Core listing entity, owned by companies
- **Applications** — Link between students and internships

---

## 4. Key Flows

### 4.1 Student Registration & Verification

```
1. Student fills registration form
2. System validates input (Zod)
3. System creates account (PENDING status)
4. System sends verification email/OTP
5. Student verifies email
6. Account status changes to ACTIVE
7. Student completes profile (school, grade, resume)
   (School verification is optional until required by an internship)
```

### 4.2 Internship Lifecycle

```
1. Company creates internship (DRAFT status)
2. Company reviews and publishes (ACTIVE status)
3. Students browse and apply
4. Deadline passes or company closes (CLOSED status)
5. Applications are processed
6. Internship is archived
```

### 4.3 Application Flow

```
1. Student finds internship and applies
2. Application is created (PENDING status)
3. Company reviews application
4. Company can: Review → Shortlist → Accept/Reject
5. Student is notified of status changes
6. If accepted: onboarding process (Phase 2)
7. If rejected or withdrawn: application is closed
```

---

## 5. Background Jobs

| Job | Schedule | Purpose |
|-----|----------|---------|
| Expire internships | Every hour | Auto-close internships past deadline |
| Send reminders | Daily | Remind companies about pending applications |
| Clean up expired OTPs | Every 15 min | Remove expired OTP codes from Redis |
| Generate reports | Weekly | Aggregated platform statistics |

These are implemented using Bull queues with Redis.

---

## 6. Error Handling

```
Every error → Global Error Handler → Log → Format Response → Return
                          │
                     If AppError → Use its status/code/message
                     If PrismaError → Map to AppError
                     If Unknown → 500 Internal Error
```

All errors are logged with `requestId` for correlation. Stack traces are never exposed to the client.

---

## 7. Data Flow: Read vs Write

**Read operations:**
- Can be cached (Redis, with TTL)
- Typically faster (< 50ms)
- No state changes
- Lower rate limits

**Write operations:**
- Always go to PostgreSQL (source of truth)
- Typically slower (< 200ms)
- Validate + apply business rules
- Trigger side effects (notifications, audit logs)
- Stricter rate limits

---

*This document provides the "big picture." See other docs for specific details.*
