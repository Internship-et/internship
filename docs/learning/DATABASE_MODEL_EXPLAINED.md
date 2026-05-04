# DATABASE_MODEL_EXPLAINED.md

> **Explanation of the database model, relationships, and design decisions.**

---

## 1. Entity-Relationship Overview

```
Users (base table for all accounts)
  ├── Students (role-specific data)
  ├── Companies (role-specific data)
  └── Schools (role-specific data)

Internships (owned by Companies)
  ├── Tags
  └── Benefits

Applications (link between Students and Internships)
  └── StatusHistory

AuditLogs (immutable record of all critical actions)
```

---

## 2. Core Tables

### 2.1 Users

```prisma
model User {
  id           String   @id @default(uuid()) @db.Uuid
  email        String   @unique
  passwordHash String   @map("password_hash")
  firstName    String   @map("first_name")
  lastName     String   @map("last_name")
  phone        String?
  role         UserRole  // STUDENT | COMPANY | SCHOOL | ADMIN
  status       UserStatus // PENDING | ACTIVE | SUSPENDED
  isVerified   Boolean  @default(false) @map("is_verified")
  
  // Timestamps
  createdAt    DateTime @default(now()) @map("created_at")
  updatedAt    DateTime @updatedAt @map("updated_at")
  deletedAt    DateTime? @map("deleted_at")
  lastLoginAt  DateTime? @map("last_login_at")
  
  // Relations
  studentProfile  Student?
  companyProfile  Company?
  schoolProfile   School?
  auditLogs       AuditLog[]
  
  @@map("users")
}
```

**Design Notes:**
- Single `users` table with `role` discriminator (not separate tables per role)
- Simplifies auth (one login flow for all roles)
- Role-specific data in separate tables (Student, Company, School)
- Soft delete for recoverability
- `lastLoginAt` for monitoring active users

### 2.2 Students

```prisma
model Student {
  id           String   @id @default(uuid()) @db.Uuid
  userId       String   @unique @map("user_id") @db.Uuid
  schoolId     String?  @map("school_id") @db.Uuid
  grade        Int?     // 9-12
  dateOfBirth  DateTime? @map("date_of_birth")
  bio          String?
  skills       String[]  // Array of skill names
  interests    String[]
  languages    String[]
  resumeUrl    String?  @map("resume_url")
  profileImageUrl String? @map("profile_image_url")
  isSchoolVerified Boolean @default(false) @map("is_school_verified")
  
  // Timestamps
  createdAt    DateTime @default(now()) @map("created_at")
  updatedAt    DateTime @updatedAt @map("updated_at")
  
  // Relations
  user         User     @relation(fields: [userId], references: [id])
  school       School?  @relation(fields: [schoolId], references: [id])
  applications Application[]
  
  @@map("students")
}
```

### 2.3 Companies

```prisma
model Company {
  id           String   @id @default(uuid()) @db.Uuid
  userId       String   @unique @map("user_id") @db.Uuid
  name         String   @unique
  industry     String
  description  String?
  logoUrl      String?  @map("logo_url")
  website      String?
  city         String
  address      String?
  size         CompanySize? // STARTUP | SMALL | MEDIUM | LARGE
  foundedYear  Int?     @map("founded_year")
  tinNumber    String?  @map("tin_number") @unique
  socialLinks  Json?    @map("social_links") // { linkedin?: string, twitter?: string }
  isVerified   Boolean  @default(false) @map("is_verified")
  
  // Timestamps
  createdAt    DateTime @default(now()) @map("created_at")
  updatedAt    DateTime @updatedAt @map("updated_at")
  deletedAt    DateTime? @map("deleted_at")
  
  // Relations
  user         User       @relation(fields: [userId], references: [id])
  internships  Internship[]
  
  @@map("companies")
}
```

### 2.4 Schools

```prisma
model School {
  id             String   @id @default(uuid()) @db.Uuid
  userId         String   @unique @map("user_id") @db.Uuid
  name           String   @unique
  type           SchoolType // PUBLIC | PRIVATE | GOVERNMENT
  city           String
  address        String?
  phone          String?
  email          String?
  website        String?
  principal      String?
  gradesOffered  Int[]    @map("grades_offered")
  logoUrl        String?  @map("logo_url")
  licenseNumber  String?  @map("license_number")
  isVerified     Boolean  @default(false) @map("is_verified")
  
  // Timestamps
  createdAt      DateTime @default(now()) @map("created_at")
  updatedAt      DateTime @updatedAt @map("updated_at")
  deletedAt      DateTime? @map("deleted_at")
  
  // Relations
  user           User      @relation(fields: [userId], references: [id])
  students       Student[]
  
  @@map("schools")
}
```

### 2.5 Internships

```prisma
model Internship {
  id              String   @id @default(uuid()) @db.Uuid
  companyId       String   @map("company_id") @db.Uuid
  title           String
  description     String
  responsibilities String[]?
  requirements    String[]
  preferredSkills String[]  @map("preferred_skills")
  type            InternshipType // ON_SITE | REMOTE | HYBRID
  city            String
  address         String?
  durationMonths  Int      @map("duration_months")
  weeklyHours     Int?     @map("weekly_hours")
  startDate       DateTime? @map("start_date")
  deadline        DateTime?
  stipend         Json?    // { amount: number, currency: string, period: string }
  benefits        String[]
  tags            String[]
  minGrade        Int?     @map("min_grade")
  maxGrade        Int?     @map("max_grade")
  status          InternshipStatus // DRAFT | ACTIVE | CLOSED
  
  // Timestamps
  createdAt       DateTime @default(now()) @map("created_at")
  updatedAt       DateTime @updatedAt @map("updated_at")
  deletedAt       DateTime? @map("deleted_at")
  
  // Relations
  company         Company       @relation(fields: [companyId], references: [id])
  applications    Application[]
  
  @@map("internships")
}
```

### 2.6 Applications

```prisma
model Application {
  id           String   @id @default(uuid()) @db.Uuid
  internshipId String   @map("internship_id") @db.Uuid
  studentId    String   @map("student_id") @db.Uuid
  status       ApplicationStatus // PENDING | REVIEWED | SHORTLISTED | ACCEPTED | REJECTED | WITHDRAWN
  coverLetter  String?  @map("cover_letter")
  additionalInfo String? @map("additional_info")
  companyNote  String?  @map("company_note") // Internal note, not visible to student
  
  // Timestamps
  appliedAt    DateTime @default(now()) @map("applied_at")
  updatedAt    DateTime @updatedAt @map("updated_at")
  
  // Relations
  internship   Internship        @relation(fields: [internshipId], references: [id])
  student      Student           @relation(fields: [studentId], references: [id])
  statusHistory ApplicationStatusHistory[]
  
  @@unique([internshipId, studentId]) // One application per student per internship
  @@map("applications")
}
```

### 2.7 Application Status History

```prisma
model ApplicationStatusHistory {
  id            String   @id @default(uuid()) @db.Uuid
  applicationId String   @map("application_id") @db.Uuid
  fromStatus    ApplicationStatus @map("from_status")
  toStatus      ApplicationStatus @map("to_status")
  changedById   String   @map("changed_by_id") @db.Uuid
  note          String?
  
  createdAt     DateTime @default(now()) @map("created_at")
  
  // Relations
  application   Application @relation(fields: [applicationId], references: [id])
  
  @@map("application_status_history")
}
```

### 2.8 Audit Logs

```prisma
model AuditLog {
  id        String   @id @default(uuid()) @db.Uuid
  userId    String   @map("user_id") @db.Uuid
  action    String   // 'CREATE' | 'UPDATE' | 'DELETE' | 'STATUS_CHANGE' | 'ADMIN_ACTION'
  entity    String   // 'USER' | 'STUDENT' | 'COMPANY' | 'INTERNSHIP' | 'APPLICATION'
  entityId  String   @map("entity_id")
  oldValue  Json?    @map("old_value")
  newValue  Json?    @map("new_value")
  ipAddress String?  @map("ip_address")
  userAgent String?  @map("user_agent")
  
  createdAt DateTime @default(now()) @map("created_at")
  
  @@index([userId])
  @@index([entity, entityId])
  @@index([action])
  @@map("audit_logs")
}
```

---

## 3. Indexes

| Table | Index | Purpose |
|-------|-------|---------|
| users | `email` (unique) | Fast login lookup |
| users | `role` | Filter users by role |
| users | `status` | Filter by account status |
| internships | `company_id` | Find company's internships |
| internships | `status` | Filter active internships |
| internships | `(status, created_at)` | Sort active listings by date |
| internships | `city` | Filter by location |
| internships | `tags` (GIN) | Tag-based search |
| applications | `(internship_id, student_id)` (unique) | Prevent duplicates |
| applications | `student_id` | Find student's applications |
| applications | `internship_id` | Find internship's applications |
| applications | `status` | Filter by status |
| audit_logs | `(entity, entity_id)` | Look up entity history |

---

*This model is the source of truth. Prisma schema and migrations must match.*
