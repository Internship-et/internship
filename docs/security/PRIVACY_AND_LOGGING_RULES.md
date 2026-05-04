# PRIVACY_AND_LOGGING_RULES.md

> **Protecting user privacy is a core requirement.** This document defines how PII is handled and how logging must avoid exposing sensitive data.

---

## 1. PII Definition

**Personally Identifiable Information (PII)** includes:

- Full name
- Email address
- Phone number
- Physical address
- Date of birth
- Government ID (passport, Kebele ID, student ID)
- IP address (in some contexts)
- Device fingerprints
- Biometric data

---

## 2. PII Handling Rules

### 2.1 Storage

- PII is stored in PostgreSQL (encrypted at rest via disk encryption)
- PII is **never** stored in Redis (except temporarily for OTP verification)
- PII is **never** stored in JWT tokens
- PII is **never** stored in logs

### 2.2 Transmission

- All API traffic uses HTTPS (TLS 1.2+)
- PII is **never** transmitted in URLs (query parameters)
- PII is **never** transmitted in error messages
- PII in responses is scoped by authorization (see AUTHORIZATION_MATRIX.md)

### 2.3 Access

- PII is accessible only to:
  - The user themselves
  - Admin users (audited)
  - Companies reviewing applications from a student
- PII access is logged

### 2.4 Retention

- PII is retained for the duration of the user's account
- On account deletion, PII is anonymized or deleted within 30 days
- Audit logs containing PII references are anonymized after 1 year

---

## 3. Logging Rules

### 3.1 What to Log

- Request method, path, status code, duration
- User ID (if authenticated)
- Request ID
- Error code and message (not stack trace in production)
- Rate limit hits
- Authentication events (login, logout, failed login)
- Authorization failures

### 3.2 What NOT to Log

- ❌ Passwords (plain text or hashed)
- ❌ JWT tokens
- ❌ OTP codes
- ❌ Email addresses (in full — log only anonymized versions)
- ❌ Phone numbers
- ❌ Full names
- ❌ Addresses
- ❌ Stack traces (log to stderr, not to the log aggregator)
- ❌ Database error details
- ❌ API keys or secrets

### 3.3 Log Anonymization

When logging is necessary near PII, use anonymization:

```typescript
function anonymizeEmail(email: string): string {
  const [name, domain] = email.split('@');
  return `${name[0]}***@${domain}`;
}
// "abebe@example.com" → "a***@example.com"

function anonymizePhone(phone: string): string {
  return phone.slice(0, 4) + '***' + phone.slice(-2);
}
// "+251911223344" → "+251***44"
```

### 3.4 Structured Logging Format

```typescript
// ✅ Good — no PII
{
  level: 'info',
  message: 'User logged in',
  requestId: 'req_abc123',
  userId: 'uuid',          // Safe — opaque UUID
  method: 'POST',
  path: '/auth/login',
  statusCode: 200,
  duration: 45
}

// ❌ Bad — contains PII
{
  level: 'info',
  message: 'User logged in',
  email: 'abebe@example.com',  // PII!
  ip: '196.188.xxx.xxx',        // Potentially PII
  password: 'hunter2'           // CRITICAL! Never log passwords
}
```

---

## 4. Data Deletion Requests

Users may request deletion of their data (right to erasure):

1. User submits deletion request
2. Admin reviews and approves
3. Within 30 days:
   - User's PII fields are set to NULL or anonymized
   - User's role-based data is preserved (applications, internships) with "deleted user" placeholder
   - User's session is invalidated
   - User's account is hard-deleted or permanently anonymized
4. Confirmation is sent to the user

---

## 5. Data Portability

Users may request a copy of their data:

1. User submits data portability request
2. Within 30 days, system generates a JSON export of:
   - Profile data
   - Application history
   - Account metadata
3. Export is available for download (signed URL, expires in 7 days)

---

## 6. Breach Notification

In the event of a data breach:

1. **Detection:** Automated monitoring or manual report
2. **Containment:** Isolate affected systems
3. **Assessment:** Determine scope and impact
4. **Notification:** 
   - Affected users within 72 hours
   - Relevant authorities per applicable law
   - Notification includes: what happened, what data was affected, what steps are being taken

---

*Privacy is not optional. It is a legal and ethical requirement.*
