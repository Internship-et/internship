# NAMING_CONVENTIONS.md

> **Consistent naming reduces cognitive load.** Follow these conventions strictly.

---

## 1. File & Directory Naming

| Item | Convention | Example |
|------|-----------|---------|
| Source files | `kebab-case` | `student-routes.ts` |
| Test files | `kebab-case` | `student.service.test.ts` |
| Directories | `kebab-case` | `modules/student-profiles/` |
| Config files | `kebab-case` | `docker-compose.yml` |
| Markdown docs | `UPPER_SNAKE_CASE` (for root), `kebab-case` (in docs/) | `SECURITY_RULES.md`, `error-handling-rules.md` |
| Docker files | kebab-case | `Dockerfile`, `docker-compose.yml` |

---

## 2. TypeScript Naming

| Item | Convention | Example |
|------|-----------|---------|
| Classes | `PascalCase` | `class NotFoundError extends AppError` |
| Interfaces | `PascalCase` (no `I` prefix) | `interface CreateStudentInput` |
| Types | `PascalCase` | `type UserRole = 'STUDENT' \| 'COMPANY'` |
| Enums | `PascalCase` | `enum UserRole` |
| Enum values | `UPPER_SNAKE_CASE` | `UserRole.STUDENT`, `UserRole.COMPANY_ADMIN` |
| Functions | `camelCase` | `function getStudentById()` |
| Methods | `camelCase` | `async create(data: CreateInput)` |
| Variables | `camelCase` | `const studentName = ...` |
| Constants (true constants) | `UPPER_SNAKE_CASE` | `const SALT_ROUNDS = 10` |
| Private members | `camelCase` (no `_` prefix) | `private calculateHash()` |
| Boolean variables | `camelCase` (prefix `is`, `has`, `should`) | `isActive`, `hasPermission` |
| Generic type params | `PascalCase` (single letter or descriptive) | `<T>`, `<TResponse>` |

---

## 3. Database Naming

| Item | Convention | Example |
|------|-----------|---------|
| Table names | `snake_case` (plural) | `students`, `internship_applications` |
| Column names | `snake_case` | `first_name`, `created_at` |
| Join tables | `snake_case` (both table names) | `students_skills`, `internship_tags` |
| Foreign key columns | `snake_case` (referenced table singular + `_id`) | `student_id`, `company_id` |
| Primary key column | `id` (UUID) | `id` |
| Timestamp columns | `created_at`, `updated_at`, `deleted_at` | `created_at` |
| Index names | `idx_{table}_{column}` | `idx_students_email` |
| Unique constraint names | `uq_{table}_{column}` | `uq_students_email` |
| Foreign key names | `fk_{child_table}_{parent_table}` | `fk_applications_students` |

---

## 4. API Naming

| Item | Convention | Example |
|------|-----------|---------|
| Route paths | `kebab-case` (plural for collections) | `/api/v1/students`, `/api/v1/internship-applications` |
| Route params | `camelCase` | `:studentId`, `:companyId` |
| Query params | `camelCase` | `?pageSize=20&sortBy=createdAt` |
| Request body fields | `camelCase` | `{ "firstName": "Abebe" }` |
| Response fields | `camelCase` | `{ "success": true, "data": { "firstName": "Abebe" } }` |

---

## 5. Error Code Naming

| Convention | Example |
|-----------|---------|
| `UPPER_SNAKE_CASE` | `VALIDATION_ERROR`, `NOT_FOUND`, `RATE_LIMIT_EXCEEDED` |
| Prefix with domain when ambiguous | `STUDENT_ALREADY_APPLIED`, `INTERNSHIP_DEADLINE_PASSED` |

---

## 6. Environment Variable Naming

| Convention | Example |
|-----------|---------|
| `UPPER_SNAKE_CASE` | `DATABASE_URL`, `JWT_SECRET`, `REDIS_URL` |
| Prefix with app | `INTERNSHIP_` prefix for app-specific vars |

---

## 7. Git Branch Naming

| Type | Convention | Example |
|------|-----------|---------|
| Feature | `feature/{checkpoint-name}-{description}` | `feature/checkpoint-7-auth` |
| Bug fix | `fix/{short-description}` | `fix/email-validation` |
| Docs | `docs/{description}` | `docs/api-contract` |
| Chore | `chore/{description}` | `chore/update-deps` |

---

## 8. Commit Message Convention

```
type(scope): description

Examples:
feat(auth): implement JWT token refresh
fix(students): handle duplicate email gracefully
docs(api): update internship route contract
test(applications): add status transition tests
chore(deps): update prisma to v5.0
```

Types: `feat`, `fix`, `docs`, `test`, `chore`, `refactor`, `perf`, `security`

---

## 9. What NOT to Do

| Bad | Good | Reason |
|-----|------|--------|
| `IStudent` | `Student` or `IStudentData` | No Hungarian notation |
| `student_service.ts` | `student-service.ts` | Files use kebab-case |
| `get_all_students()` | `getAllStudents()` | Functions use camelCase |
| `StudentTable` | `students` | Tables use snake_case, plural |
| `data` | `studentData` | Be descriptive |
| `temp` | `temporaryToken` | No abbreviations |
| `handler` | `createStudentHandler` | Be specific |
| `StudentObj` | `Student` | No type suffixes |

---

*When in doubt, be explicit. Clarity over brevity.*
