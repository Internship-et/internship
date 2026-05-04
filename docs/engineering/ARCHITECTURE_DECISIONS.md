# ARCHITECTURE_DECISIONS.md

> **Architecture Decision Records (ADRs)** for the Ethiopian High School Internship Platform. Each decision is recorded with context, options considered, and rationale.

---

## ADR-001: Modular Monolith over Microservices

**Status:** ✅ Accepted

**Context:** The platform connects high school students with internship providers. Initially, the team is small and the domain is well-understood. Microservices would add operational complexity (service discovery, distributed transactions, inter-service communication) without proven benefit.

**Options Considered:**
1. **Microservices** — Each module as an independent service
2. **Modular Monolith** — Single deployment, logical module boundaries
3. **Monolith** — No module boundaries

**Decision:** Modular monolith with strict module boundaries.

**Consequences:**
- ✅ Simpler deployment, debugging, and development
- ✅ Module boundaries preserve option to extract services later
- ❌ Requires discipline to maintain module boundaries
- ❌ Single point of deployment (scaling is all-or-nothing initially)

**Migration Path:** If scaling demands, extract high-traffic modules (e.g., applications) into separate services.

---

## ADR-002: Zod for Validation

**Status:** ✅ Accepted

**Context:** Need runtime validation that integrates well with TypeScript's type system.

**Options Considered:**
1. **Zod** — TypeScript-first schema validation
2. **Joi** — Mature but no TypeScript inference
3. **Yup** — Good but TypeScript support is less ergonomic
4. **JSON Schema + Ajv** — Standard but verbose

**Decision:** Zod. Best TypeScript integration, excellent error messages, and composable schemas.

---

## ADR-003: Prisma as ORM

**Status:** ✅ Accepted

**Context:** Need type-safe database access with migration management.

**Options Considered:**
1. **Prisma** — Type-safe, auto-generated client, migrations
2. **TypeORM** — Full-featured but decorator-heavy
3. **Drizzle** — Lighter but newer, smaller ecosystem
4. **Knex** — Query builder, no ORM features

**Decision:** Prisma. Best TypeScript integration, excellent migration tooling, and active community.

---

## ADR-004: Cursor-Based Pagination as Default

**Status:** ✅ Accepted

**Context:** List endpoints need pagination. Offset-based pagination has issues with data consistency (items inserted/deleted between pages).

**Options Considered:**
1. **Cursor-based** — Uses opaque cursor, stable under data changes
2. **Offset-based** — Simple but unstable for real-time data
3. **Keyset pagination** — Efficient but requires careful implementation

**Decision:** Cursor-based as default. Offset-based available for admin endpoints where stability is less critical.

---

## ADR-005: Soft Deletes for User-Facing Data

**Status:** ✅ Accepted

**Context:** Need to recover accidentally deleted data and maintain audit trails.

**Decision:** Soft deletes (`deletedAt` timestamp) for all user-facing entities. Hard deletes only for internal/non-critical data (sessions, logs).

---

## ADR-006: Redis for Temporary State Only

**Status:** ✅ Accepted

**Context:** Need fast temporary storage for rate limiting, OTPs, sessions.

**Decision:** Redis is used exclusively for:
- Rate limit counters
- OTP codes (hashed)
- Session tokens
- Job queues
- Computed caches (derived data only)

PostgreSQL remains the source of truth for all persistent data.

---

## ADR-007: ES Modules over CommonJS

**Status:** ✅ Accepted

**Context:** Node.js 20 has stable ESM support. The ecosystem is moving toward ESM.

**Decision:** Use ES modules (`"type": "module"` in package.json) throughout.

---

## ADR-008: UUIDs as Primary Keys

**Status:** ✅ Accepted

**Context:** Need unique identifiers that can be safely exposed in URLs and APIs without revealing sequential information.

**Options Considered:**
1. **UUIDv4** — Random, no ordering
2. **CUID2** — More compact, but less standard
3. **Auto-increment integers** — Simple but exposes data volume
4. **ULID** — Sortable, but less ecosystem support

**Decision:** UUIDv4 for all primary keys. Cursor-based pagination uses UUIDs as cursors.

---

## ADR-009: Async Handler Wrapper for Routes

**Status:** ✅ Accepted

**Context:** Express doesn't catch async errors by default. Every async route handler needs error handling.

**Decision:** Create an `asyncHandler` wrapper that catches async errors and forwards them to the error middleware.

---

## ADR-010: Structured JSON Logging

**Status:** ✅ Accepted

**Context:** Need logs that can be parsed by log aggregation tools (ELK, Datadog, etc.).

**Decision:** All logging is structured JSON using Pino logger. Each log line includes: timestamp, level, message, requestId, module, and relevant context.

---

*New ADRs are added as architectural decisions are made.*
