# AUTHORIZATION_MATRIX.md

> **Complete authorization matrix for all endpoints.**

---

## 1. Role Definitions

| Role | ID | Description |
|------|-----|-------------|
| STUDENT | `STUDENT` | High school student seeking internships |
| COMPANY | `COMPANY` | Organization offering internships |
| SCHOOL | `SCHOOL` | Educational institution verifying students |
| ADMIN | `ADMIN` | Platform administrator |

---

## 2. Matrix

### 2.1 Authentication Endpoints

| Endpoint | Method | No Auth | STUDENT | COMPANY | SCHOOL | ADMIN |
|----------|--------|---------|---------|---------|--------|-------|
| `/auth/register` | POST | ✅ | — | — | — | — |
| `/auth/login` | POST | ✅ | — | — | — | — |
| `/auth/refresh` | POST | ✅* | — | — | — | — |
| `/auth/logout` | POST | — | ✅ | ✅ | ✅ | ✅ |
| `/auth/forgot-password` | POST | ✅ | — | — | — | — |
| `/auth/reset-password` | POST | ✅ | — | — | — | — |
| `/auth/me` | GET | — | ✅ | ✅ | ✅ | ✅ |
| `/auth/me` | PATCH | — | ✅ | ✅ | ✅ | ✅ |

*Refresh uses refresh token, not access token.

### 2.2 Student Endpoints

| Endpoint | Method | STUDENT | COMPANY | SCHOOL | ADMIN |
|----------|--------|---------|---------|--------|-------|
| `/students` | GET | — | — | — | ✅ |
| `/students/:id` | GET | SELF | — | — | ✅ |
| `/students/:id` | PATCH | SELF | — | — | ✅ |
| `/students/:id/applications` | GET | SELF | — | — | ✅ |
| `/students/:id/recommendations` | GET | SELF | — | — | — |

### 2.3 Company Endpoints

| Endpoint | Method | STUDENT | COMPANY | SCHOOL | ADMIN | No Auth |
|----------|--------|---------|---------|--------|-------|---------|
| `/companies` | GET | — | — | — | — | ✅ |
| `/companies/:id` | GET | — | — | — | — | ✅ |
| `/companies` | POST | — | ✅ | — | ✅ | — |
| `/companies/:id` | PATCH | — | OWNER | — | ✅ | — |
| `/companies/:id/internships` | GET | — | — | — | — | ✅ |
| `/companies/:id/applications` | GET | — | OWNER | — | ✅ | — |

### 2.4 Internship Endpoints

| Endpoint | Method | STUDENT | COMPANY | SCHOOL | ADMIN | No Auth |
|----------|--------|---------|---------|--------|-------|---------|
| `/internships` | GET | — | — | — | — | ✅ |
| `/internships/:id` | GET | — | — | — | — | ✅ |
| `/internships` | POST | — | ✅ | — | ✅ | — |
| `/internships/:id` | PATCH | — | OWNER | — | ✅ | — |
| `/internships/:id` | DELETE | — | OWNER | — | ✅ | — |
| `/internships/:id/apply` | POST | ✅ | — | — | — | — |

### 2.5 Application Endpoints

| Endpoint | Method | STUDENT | COMPANY | SCHOOL | ADMIN |
|----------|--------|---------|---------|--------|-------|
| `/applications` | GET | SELF | OWNER | — | ✅ |
| `/applications/:id` | GET | SELF | OWNER | — | ✅ |
| `/applications/:id/status` | PATCH | — | OWNER | — | ✅ |
| `/applications/:id/withdraw` | POST | SELF | — | — | — |

### 2.6 School Endpoints

| Endpoint | Method | STUDENT | COMPANY | SCHOOL | ADMIN | No Auth |
|----------|--------|---------|---------|--------|-------|---------|
| `/schools` | GET | — | — | — | — | ✅ |
| `/schools/:id` | GET | — | — | — | — | ✅ |
| `/schools` | POST | — | — | ✅ | ✅ | — |
| `/schools/:id` | PATCH | — | — | OWNER | ✅ | — |
| `/schools/:id/verify-student` | POST | — | — | OWNER | ✅ | — |

### 2.7 Admin Endpoints

| Endpoint | Method | STUDENT | COMPANY | SCHOOL | ADMIN |
|----------|--------|---------|---------|--------|-------|
| `/admin/dashboard` | GET | — | — | — | ✅ |
| `/admin/users` | GET | — | — | — | ✅ |
| `/admin/users/:id/status` | PATCH | — | — | — | ✅ |
| `/admin/audit-logs` | GET | — | — | — | ✅ |
| `/admin/reports` | GET | — | — | — | ✅ |

### 2.8 Health

| Endpoint | Method | No Auth |
|----------|--------|---------|
| `/health` | GET | ✅ |
| `/health/ready` | GET | ✅ |
| `/health/live` | GET | ✅ |

---

## 3. Access Key

| Symbol | Meaning |
|--------|---------|
| ✅ | All users with this role can access |
| SELF | Only the user who owns the resource |
| OWNER | Only the user/company that owns the resource |
| — | Access denied |

---

## 4. Authorization Enforcement

Authorization is enforced at two levels:

### 4.1 Route Level (Role Check)

```typescript
// In route definition
router.get('/admin/users', authenticate, authorize(['ADMIN']), handler);
```

### 4.2 Service Level (Ownership Check)

```typescript
// In service
async updateStudent(studentId: string, userId: string, userRole: string, data: any) {
  if (studentId !== userId && userRole !== 'ADMIN') {
    throw new ForbiddenError('You do not own this resource');
  }
  // Proceed with update
}
```

---

*This matrix must be kept in sync with the actual route authorization middleware.*
