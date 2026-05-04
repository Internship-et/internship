# MIGRATION_RULES.md

> **Rules and conventions for database migrations.**

---

## 1. Migration Workflow

### 1.1 Creating a Migration

```bash
# Development
npx prisma migrate dev --name <short-description>

# Production
npx prisma migrate deploy
```

### 1.2 Migration Naming

Migrations are named with a short, kebab-case description:
- `add_student_profile`
- `add_application_status_history`
- `add_index_on_internships_status`

### 1.3 Migration Review

Before deploying a migration to production:
1. Review the generated SQL
2. Check for backward compatibility
3. Verify no destructive changes on production data
4. Test on staging first

---

## 2. Migration Safety Rules

### 2.1 Safe Changes (no downtime)

- ✅ Adding a new table
- ✅ Adding a nullable column
- ✅ Adding a column with a default value
- ✅ Adding an index (concurrently if on large table)
- ✅ Adding a new enum value
- ✅ Creating a new relation (foreign key) — if data is consistent

### 2.2 Risky Changes (may require downtime)

- ⚠️ Adding a NOT NULL column to an existing table (requires backfill)
- ⚠️ Renaming a column (requires app code update + migration)
- ⚠️ Changing a column type (requires CAST)
- ⚠️ Removing a column (app code must stop using it first)

### 2.3 Dangerous Changes (require careful planning)

- ❌ Dropping a table (data loss)
- ❌ Dropping a column (data loss)
- ❌ Renaming a table (requires app update)
- ❌ Changing a relation (data migration required)

---

## 3. Migration Checklist

Before writing a migration, answer:

- [ ] Is this change backward compatible?
- [ ] Will existing data be preserved?
- [ ] Does the application need to be updated simultaneously?
- [ ] Is there a rollback plan?
- [ ] Have I tested on a copy of production data?

---

## 4. Handling Existing Data

When adding a NOT NULL column to an existing table:

```prisma
// Step 1: Add as nullable
model User {
  phoneNumber String? @map("phone_number")
}

// Step 2: Backfill data
// Run a script to populate phoneNumber for existing users

// Step 3: Make NOT NULL
model User {
  phoneNumber String @map("phone_number")
}
```

This three-step process prevents downtime.

---

## 5. Migration Rollback

```bash
# Prisma doesn't support "down" migrations directly.
# To revert:
# 1. Create a new migration that reverses the changes
npx prisma migrate dev --name revert_add_phone_number

# 2. Or reset to a specific migration (development only)
npx prisma migrate reset
```

For production, always create a forward migration that reverses the change.

---

## 6. Testing Migrations

Always test migrations against:
1. An empty database (fresh setup)
2. A copy of production data (realistic volume)

```bash
# Create a copy of production database
pg_dump production_db > prod_backup.sql
createdb migration_test
psql migration_test < prod_backup.sql

# Test migration
DATABASE_URL=postgresql://localhost/migration_test npx prisma migrate deploy
```

---

## 7. Migration Conflicts

If two developers create migrations with the same timestamp:
- The second one to merge will have a conflict
- Resolve by renaming the migration file to have a later timestamp
- Or reset and recreate

---

*Migrations are irreversible in Prisma. Test thoroughly before applying to production.*
