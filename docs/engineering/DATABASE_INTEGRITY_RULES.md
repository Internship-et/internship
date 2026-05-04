# DATABASE_INTEGRITY_RULES.md

> **The database is the source of truth.** These rules ensure data integrity, consistency, and auditability at the database level.

---

## 1. Schema Design Principles

### 1.1 Normalization

- All tables must be in at least **3rd Normal Form (3NF)**
- Denormalization is allowed **only** for performance optimization, and must be documented in `ARCHITECTURE_DECISIONS.md`
- No duplicate data across tables

### 1.2 Constraints

Every table must have:
- **Primary key:** `id` (UUID, auto-generated)
- **Foreign keys:** with `ON DELETE RESTRICT` (prevent orphaned records)
- **NOT NULL** constraints where applicable
- **UNIQUE** constraints where applicable
- **CHECK** constraints where applicable (Prisma `@validation`)

### 1.3 Audit Fields

Every user-facing table must include:
```prisma
model BaseEntity {
  id         String   @id @default(uuid()) @db.Uuid
  createdAt  DateTime @default(now())
  updatedAt  DateTime @updatedAt
  createdBy  String?  @db.Uuid  // User ID who created the record
  updatedBy  String?  @db.Uuid  // User ID who last updated the record
  deletedAt  DateTime?          // Soft delete timestamp
}
```

---

## 2. Critical Integrity Rules

### 2.1 Referential Integrity

- All foreign keys are enforced at the database level (Prisma enforces this)
- Cascade deletes are **forbidden** — use `ON DELETE RESTRICT` always
- Orphaned records are not tolerated
- When a referenced record is "deleted" (soft delete), the foreign key remains valid

### 2.2 Unique Constraints

Prevent duplicate:
- Emails (students, company users, school users)
- Phone numbers
- Company registrations (one company per TIN/registration number)
- Applications (one student, one internship = one application)
- Usernames (if used)

### 2.3 Data Types

- **IDs:** `UUID v4` (stored as `@db.Uuid`)
- **Timestamps:** `DateTime` with timezone
- **Enums:** Prisma `enum` type (stored as string in PostgreSQL)
- **Money/Cents:** Integer (store in cents, display in Birr)
- **Phone:** String (with country code validation)
- **Email:** String (with unique constraint)
- **Text:** String with configurable max length

---

## 3. Soft Delete Convention

```prisma
model Student {
  // ... other fields
  deletedAt DateTime?  // null = active, non-null = deleted
  
  // All queries must exclude deleted records by default
}
```

**Repository rules:**
- `findMany` excludes `deletedAt: { not: null }` by default
- `findById` does NOT exclude deleted (for admin recovery)
- A separate `findActive` method filters `deletedAt: null`
- `delete()` sets `deletedAt` to `new Date()` (soft delete)
- `hardDelete()` is private and only used for test cleanup

---

## 4. Indexing Strategy

### 4.1 Default Indexes

- Primary keys (auto-indexed)
- Foreign keys (always index)
- `deletedAt` (for soft delete filtering)
- `createdAt` (for sorting)
- `status` fields (for filtering)

### 4.2 Composite Indexes

Add composite indexes for common query patterns:
- `(status, createdAt)` — for listing active records sorted by date
- `(companyId, status)` — for filtering by company and status
- `(studentId, internshipId)` — for checking existing applications

### 4.3 Index Rules

- Measure before adding an index (use `EXPLAIN ANALYZE`)
- No more than 5 indexes per table
- Avoid over-indexing (write performance impact)
- Index `WHERE` clauses in soft deletes

---

## 5. Migration Rules

- Every schema change requires a migration
- Migrations must be reversible (write `down` migration or use Prisma's migration history)
- Never edit a migration that has been applied
- Test migrations against a copy of production data
- Large tables require zero-downtime migration strategies

See `docs/operations/MIGRATION_RULES.md`.

---

## 6. Query Rules

- N+1 queries are forbidden
- Use Prisma `include` and `select` to fetch only needed data
- Large result sets must be paginated (no unbounded queries)
- Use transactions for operations that modify multiple records
- Read replicas for read-heavy workloads (Phase 2 concern)

---

## 7. Data Validation at Database Level

- PostgreSQL CHECK constraints for business rules (duplicated at app layer)
- Example: `CHECK (age >= 14 AND age <= 24)` for student age
- Example: `CHECK (salary >= 0)` for salary fields
- Example: `CHECK (status IN ('PENDING', 'ACCEPTED', 'REJECTED'))`

---

## 8. Audit Logging

```prisma
model AuditLog {
  id         String   @id @default(uuid())
  userId     String   @db.Uuid
  action     String   // 'CREATE', 'UPDATE', 'DELETE', 'STATUS_CHANGE'
  entity     String   // 'APPLICATION', 'INTERNSHIP', etc.
  entityId   String   // UUID of the affected record
  oldValue   Json?    // Previous state (for updates)
  newValue   Json?    // New state
  ipAddress  String?
  userAgent  String?
  createdAt  DateTime @default(now())
}
```

Audit-logged actions:
- ✅ Application status changes
- ✅ Internship creation/closing
- ✅ User role changes
- ✅ Password changes
- ✅ Account suspension/activation
- ❌ Regular CRUD on non-sensitive data

---

## 9. Seed Data

- Seeds are managed via Prisma seed scripts
- Seeds include: admin user, sample schools, sample companies
- Seeds must be idempotent (safe to run multiple times)
- Test seeds are separate from development seeds

---

*The database is immutable history. Treat every record with respect.*
