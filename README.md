# Ethiopian High School Internship Platform — Backend

**Connecting Ethiopian high school students with local companies, NGOs, schools, startups, and institutions offering internships.**

Think of it as **Indeed + Handshake**, purpose-built for Ethiopian high school students.

---

## Project Overview

This monorepo contains the backend system for a web platform that bridges the gap between Ethiopian high school students and organizations offering internship opportunities. The platform enables:

- **Students** to discover, apply for, and manage internship opportunities
- **Companies, NGOs, schools, startups, and institutions** to post opportunities and manage applicants
- **Schools** to verify student enrollment and track student progress
- **Admins** to oversee the ecosystem and ensure quality

## Stack

| Layer | Technology |
|-------|-----------|
| Runtime | Node 20 |
| Language | TypeScript |
| Framework | Express |
| Database ORM | Prisma |
| Database | PostgreSQL |
| Cache / Temp State | Redis |
| Monorepo | Turborepo |
| Validation | Zod |
| Auth | JWT + bcrypt |
| Containerization | Docker |

## Architecture Philosophy

**Modular Monolith.** The system is organized into logical modules (students, companies, internships, applications, schools, admin) but deployed as a single service in its early stages. This avoids premature microservice complexity while maintaining clean separation of concerns.

**Layered pattern:**
- **Routes** — handle HTTP only (parse request, delegate to service, send response)
- **Services** — business logic (orchestrate, validate rules, call repositories)
- **Repositories** — database access (Prisma queries only, no business logic)
- **Schemas** — Zod validation schemas (define what valid data looks like)
- **Middleware** — cross-cutting concerns (auth, validation, rate limiting, logging, CORS, request IDs, error handling)

**PostgreSQL** is the source of truth. **Redis** is used only for temporary state: rate limits, OTPs, sessions, and job queues.

## Project Status

**Phase 0 — Foundation.** This repository currently contains documentation, engineering rules, architecture decisions, and checkpoint workflows. No application code has been written yet.

See [CHECKPOINT_LOG.md](./CHECKPOINT_LOG.md) for the current phase status.

## Getting Started (Future)

Once implementation begins, refer to:

- [LOCAL_DEVELOPMENT.md](./docs/operations/LOCAL_DEVELOPMENT.md) — local environment setup
- [ENVIRONMENT_VARIABLES.md](./docs/operations/ENVIRONMENT_VARIABLES.md) — required configuration
- [DEPLOYMENT_READINESS.md](./docs/operations/DEPLOYMENT_READINESS.md) — staging & production

## Documentation Map

```
.
├── README.md                          ← You are here
├── AGENTS.md                          ← AI agent instructions
├── BACKEND_ENGINEERING_BIBLE.md       ← Core engineering principles
├── BACKEND_IMPLEMENTATION_REFERENCE.md ← Quick reference for implementation
├── API_CONTRACT.md                    ← API design contract
├── SECURITY_RULES.md                  ← Security requirements
├── TESTING_RULES.md                   ← Testing requirements
├── NAMING_CONVENTIONS.md              ← Naming standards
├── CHECKPOINT_LOG.md                  ← Phase checkpoint tracking
├── .deepseek/
│   └── INSTRUCTIONS.md                ← Agent-specific instructions
└── docs/
    ├── engineering/                   ← Architecture & process docs
    ├── api/                           ← Route & contract docs
    ├── security/                      ← Threat models & rules
    ├── learning/                      ← Explanatory guides
    ├── checkpoints/                   ← Checkpoint-by-checkpoint specs
    └── operations/                    ← Operational runbooks
```

## License

*Placeholder — TBD*

## Contact

*Placeholder — internal team contact information*
