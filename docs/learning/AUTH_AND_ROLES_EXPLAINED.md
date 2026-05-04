# AUTH_AND_ROLES_EXPLAINED.md

> **How authentication and authorization work in this platform.**

---

## 1. Authentication System

### 1.1 Token Flow

```
Registration/Login
       │
       ▼
  Generate Tokens
  ├── Access Token (JWT, 15 min)
  └── Refresh Token (JWT, 7 days)
       │
       ▼
  Access Token → Client stores in memory/localStorage
  Refresh Token → Client stores in httpOnly cookie (preferred) or localStorage
       │
       ▼
  API Request
  ├── Has valid Access Token? → Process request
  └── Access Token expired?
      ├── Use Refresh Token → Get new Access Token
      └── Refresh Token expired → Redirect to login
```

### 1.2 JWT Structure

```typescript
// Decoded JWT payload
{
  "userId": "550e8400-e29b-41d4-a716-446655440000",
  "role": "STUDENT",
  "email": "abebe@example.com",
  "iat": 1700000000,      // Issued at
  "exp": 1700000900       // Expires (15 min later)
}
```

**What's in the JWT:**
- ✅ `userId` — Opaque identifier
- ✅ `role` — For authorization checks
- ✅ `email` — For display/context (not sensitive)
- ✅ `iat` / `exp` — Token timing

**What's NOT in the JWT:**
- ❌ Password hash
- ❌ Phone number
- ❌ Address
- ❌ Any other PII

### 1.3 Password Security

```
User submits password
       │
       ▼
Validate (min 8 chars, max 128 chars)
       │
       ▼
Hash with bcrypt (cost factor 10)
       │
       ▼
Store hash in database
       │
       ▼
On login: compare submitted password with stored hash
       │
       ▼
If match → Generate tokens
If no match → Return 401 (generic error)
```

**Why bcrypt?**
- Slow by design (cost factor 10 = ~100ms per hash)
- Includes salt automatically
- Resistant to GPU/ASIC attacks

---

## 2. Role System

### 2.1 Roles

| Role | Description |
|------|-------------|
| `STUDENT` | High school student seeking internships |
| `COMPANY` | Organization offering internships |
| `SCHOOL` | Educational institution |
| `ADMIN` | Platform administrator |

### 2.2 Role Assignment

- Roles are assigned at registration
- A user can have **exactly one** role (for now)
- Role changes require admin approval
- Role is stored in the `users` table and included in the JWT

### 2.3 Account Statuses

| Status | Description |
|--------|-------------|
| `PENDING` | Registered but not verified (email/phone pending) |
| `ACTIVE` | Verified and fully functional |
| `SUSPENDED` | Temporarily disabled by admin |

---

## 3. Authorization Flow

```
Request arrives
       │
       ▼
authenticate() middleware
├── Extracts JWT from Authorization header
├── Verifies JWT signature
├── Checks JWT expiry
├── Fetches user from DB (to check status)
└── Attaches user to req.user
       │
       ▼
authorize(['STUDENT']) middleware
├── Checks req.user.role against allowed roles
└── If not allowed → Returns 403 Forbidden
       │
       ▼
Route handler
├── Calls service
└── Service may do additional ownership checks
       │
       ▼
Response
```

### 3.1 Authenticate Middleware

```typescript
// src/shared/middleware/auth.middleware.ts
async function authenticate(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    throw new UnauthorizedError('Authentication required');
  }
  
  const token = authHeader.split(' ')[1];
  
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    const user = await userRepository.findById(payload.userId);
    
    if (!user || user.status !== 'ACTIVE') {
      throw new UnauthorizedError('Account is not active');
    }
    
    req.user = {
      id: user.id,
      role: user.role,
      email: user.email,
    };
    
    next();
  } catch (error) {
    if (error instanceof TokenExpiredError) {
      throw new UnauthorizedError('Token expired');
    }
    throw new UnauthorizedError('Invalid token');
  }
}
```

### 3.2 Authorize Middleware

```typescript
function authorize(...allowedRoles: string[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user || !allowedRoles.includes(req.user.role)) {
      throw new ForbiddenError('Insufficient permissions');
    }
    next();
  };
}
```

### 3.3 Ownership Check (in Service)

```typescript
// In the service layer
async updateInternship(internshipId: string, userId: string, userRole: string, data: any) {
  const internship = await internshipRepository.findById(internshipId);
  
  if (!internship) {
    throw new NotFoundError('Internship not found');
  }
  
  // Ownership check: company owns their internship, admin can do anything
  if (internship.company.userId !== userId && userRole !== 'ADMIN') {
    throw new ForbiddenError('You do not own this internship');
  }
  
  return internshipRepository.update(internshipId, data);
}
```

---

## 4. Session Management

- Refresh tokens are stored in Redis: `session:{refreshToken}`
- Max 5 concurrent sessions per user
- On password change: all sessions are invalidated
- On logout: specific session is invalidated
- Session data: `{ userId, role, createdAt, lastUsedAt }`

---

## 5. Security Considerations

| Concern | Mitigation |
|---------|------------|
| Token theft | Short-lived access tokens (15 min) |
| Token replay | Include `iat` check |
| Refresh token theft | Rotate on each use, httpOnly cookies |
| Password brute force | Rate limiting, bcrypt, account lockout |
| Session hijacking | Token binding (optional, future) |
| CSRF | SameSite cookies, CSRF tokens (if using cookies) |

---

*Auth is the gateway. Protect it rigorously.*
