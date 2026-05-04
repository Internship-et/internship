# OWNERSHIP_AND_SCOPED_WRITES.md

> **Who can write what?** Every write operation must be owned by a specific actor and scoped to authorized data.

---

## 1. Ownership Principle

Every data record has an **owner**:
- A student owns their own profile
- A company owns its profile and its internships
- A school owns its profile and its verification records
- An admin owns administrative actions

The owner is the only non-admin entity that can modify their records.

---

## 2. Ownership Fields

Every table with user-generated data has:

```prisma
model Internship {
  // ...
  companyId    String   @map("company_id") @db.Uuid
  createdById  String   @map("created_by_id") @db.Uuid
  updatedById  String   @map("updated_by_id") @db.Uuid
  
  company      Company  @relation(fields: [companyId], references: [id])
}
```

- `createdById` — immutable, set on creation
- `updatedById` — updated on every modification

---

## 3. Ownership Checks in Services

```typescript
// modules/internships/internship.service.ts
async update(internshipId: string, userId: string, userRole: string, data: UpdateInput) {
  const internship = await this.getById(internshipId);
  
  // Ownership check: either the owner or an admin
  if (internship.companyId !== userId && userRole !== 'ADMIN') {
    throw new ForbiddenError('You do not own this internship');
  }
  
  return internshipRepository.update(internshipId, {
    ...data,
    updatedById: userId,
  });
}
```

---

## 4. Scope Rules

### 4.1 Student Scope

A student can:
- Read/write their own profile
- Read their own applications
- Read internship listings (public)
- Create applications (for themselves only)
- Withdraw their own applications

A student cannot:
- Modify another student's profile
- View another student's applications
- Create/update internships
- Change application statuses (except withdraw)

### 4.2 Company Scope

A company can:
- Read/write their own profile
- Create/update/close their own internships
- View applications to their internships
- Change application statuses for their internships

A company cannot:
- Modify another company's profile
- View another company's applications
- Create internships for another company

### 4.3 School Scope

A school can:
- Read/write their own profile
- Verify students as enrolled
- View internship history of their verified students

A school cannot:
- Modify another school's profile
- Create internships
- Apply for internships on behalf of students

### 4.4 Admin Scope

An admin can:
- Read/write any record
- Suspend/activate any user
- View all audit logs
- Override ownership checks

Admin actions are:
- Explicitly flagged in audit logs
- Logged with admin's identity
- Reversible where possible

---

## 5. Write Scoping Implementation

```typescript
// shared/middleware/ownership.middleware.ts
export function requireOwnership(resourceParam: string) {
  return (req: Request, res: Response, next: NextFunction) => {
    const resourceId = req.params[resourceParam];
    const userId = req.user!.id;
    const userRole = req.user!.role;
    
    if (resourceId !== userId && userRole !== 'ADMIN') {
      throw new ForbiddenError('You do not own this resource');
    }
    
    next();
  };
}
```

---

## 6. Data Visibility Rules

| Entity | Who Can See |
|--------|------------|
| Student profile | Student (self), Admin |
| Company profile | Everyone (public) |
| Internship (active) | Everyone (public) |
| Internship (draft/closed) | Owner company, Admin |
| Application | Applicant student, Owner company, Admin |
| School profile | Everyone (public) |
| Audit logs | Admin only |

---

## 7. Admin Override Protocol

When an admin overrides ownership:

1. The override is explicit (admin must intend to override)
2. The action is logged with admin identity
3. The reason is recorded
4. The affected user is notified (if appropriate)

```typescript
async adminOverrideDelete(userId: string, adminId: string, reason: string) {
  // Log the admin action
  await auditLogRepository.create({
    userId: adminId,
    action: 'ADMIN_OVERRIDE_DELETE',
    entity: 'STUDENT',
    entityId: userId,
    newValue: { reason },
  });
  
  // Perform the action
  return studentRepository.hardDelete(userId);
}
```

---

*Ownership is identity. Scope is permission. Both must be verified on every write.*
