# AUTH_ROUTES.md

**Base Path:** `/api/v1/auth`

---

## POST /auth/register

**Description:** Register a new user account.

**Authentication:** None

**Rate Limit:** 20 requests per 15 minutes

### Request Body

```typescript
{
  email: string;           // Valid email, max 255 chars
  password: string;        // Min 8, max 128 chars
  firstName: string;       // Max 100 chars
  lastName: string;        // Max 100 chars
  role: 'STUDENT' | 'COMPANY' | 'SCHOOL';
  phone?: string;          // Ethiopian phone number (+251...)
  schoolId?: string;       // UUID, required if role is STUDENT
  companyName?: string;    // Required if role is COMPANY
  agreeToTerms: boolean;   // Must be true
}
```

### Response

```
201 Created
{
  "success": true,
  "data": {
    "user": {
      "id": "uuid",
      "email": "user@example.com",
      "firstName": "Abebe",
      "lastName": "Kebede",
      "role": "STUDENT"
    },
    "token": {
      "accessToken": "jwt...",
      "refreshToken": "jwt...",
      "expiresIn": 900
    }
  }
}
```

### Business Rules

- Email must be unique
- Password is hashed with bcrypt (cost factor 10)
- A verification email/OTP is sent
- Account is created in `PENDING` status until verified
- School verification may be required for student accounts

### Error Scenarios

| Scenario | HTTP | Code |
|----------|------|------|
| Email already registered | 409 | CONFLICT |
| Invalid email format | 400 | VALIDATION_ERROR |
| Password too weak | 400 | VALIDATION_ERROR |
| Terms not accepted | 400 | VALIDATION_ERROR |

---

## POST /auth/login

**Description:** Authenticate and receive JWT tokens.

**Authentication:** None

**Rate Limit:** 20 requests per 15 minutes

### Request Body

```typescript
{
  email: string;
  password: string;
}
```

### Response

```
200 OK
{
  "success": true,
  "data": {
    "user": {
      "id": "uuid",
      "email": "user@example.com",
      "firstName": "Abebe",
      "lastName": "Kebede",
      "role": "STUDENT"
    },
    "token": {
      "accessToken": "jwt...",
      "refreshToken": "jwt...",
      "expiresIn": 900
    }
  }
}
```

### Business Rules

- Max 5 failed attempts before temporary lockout (15 min)
- Account must be verified (not in `PENDING` status)
- Suspended accounts cannot log in
- Returns identical error for "user not found" and "wrong password" (security)

### Error Scenarios

| Scenario | HTTP | Code |
|----------|------|------|
| Invalid credentials | 401 | UNAUTHORIZED |
| Account suspended | 403 | ACCOUNT_SUSPENDED |
| Account not verified | 403 | ACCOUNT_NOT_VERIFIED |

---

## POST /auth/refresh

**Description:** Refresh an expired access token.

**Authentication:** None (uses refresh token)

### Request Body

```typescript
{
  refreshToken: string;
}
```

### Response

```
200 OK
{
  "success": true,
  "data": {
    "accessToken": "jwt...",
    "refreshToken": "jwt...",  // Rotated
    "expiresIn": 900
  }
}
```

### Business Rules

- Refresh token is rotated (old one invalidated)
- Refresh token expires after 7 days
- Refresh token is single-use

---

## POST /auth/logout

**Description:** Invalidate current session.

**Authentication:** Required

### Request Body

```typescript
{
  refreshToken?: string;  // Optional: invalidate specific session
}
```

### Response

```
200 OK
{
  "success": true,
  "data": { "message": "Logged out successfully" }
}
```

---

## POST /auth/forgot-password

**Description:** Request a password reset email/OTP.

**Authentication:** None

**Rate Limit:** 5 requests per 15 minutes

### Request Body

```typescript
{
  email: string;
}
```

### Response

```
200 OK
{
  "success": true,
  "data": { "message": "If the email exists, a reset link has been sent" }
}
```

### Business Rules

- Always returns success (don't reveal if email exists)
- Reset token expires in 15 minutes
- Token is single-use

---

## POST /auth/reset-password

**Description:** Reset password using token.

**Authentication:** None

### Request Body

```typescript
{
  token: string;
  newPassword: string;  // Min 8, max 128 chars
}
```

### Response

```
200 OK
{
  "success": true,
  "data": { "message": "Password reset successfully" }
}
```

---

## GET /auth/me

**Description:** Get current authenticated user's profile.

**Authentication:** Required

### Response

```
200 OK
{
  "success": true,
  "data": {
    "id": "uuid",
    "email": "user@example.com",
    "firstName": "Abebe",
    "lastName": "Kebede",
    "role": "STUDENT",
    "phone": "+251911223344",
    "isVerified": true,
    "profileComplete": true,
    // Role-specific fields
    "studentProfile": { ... },    // If role is STUDENT
    "companyProfile": { ... },    // If role is COMPANY
    "schoolProfile": { ... }      // If role is SCHOOL
  }
}
```

---

## PATCH /auth/me

**Description:** Update own profile.

**Authentication:** Required

### Request Body

```typescript
{
  firstName?: string;
  lastName?: string;
  phone?: string;
  // Role-specific fields
}
```

### Response

```
200 OK
{
  "success": true,
  "data": { ... }  // Updated profile
}
```
