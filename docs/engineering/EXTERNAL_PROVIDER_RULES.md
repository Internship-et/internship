# EXTERNAL_PROVIDER_RULES.md

> **Rules for integrating with external services.** The platform depends on several external providers for core functionality.

---

## 1. General Rules

### 1.1 Provider Abstraction

Every external provider **must** be wrapped behind an abstraction layer:

```typescript
// ✅ Good
// modules/notifications/email.provider.ts
export interface EmailProvider {
  send(to: string, subject: string, body: string): Promise<void>;
}

// ❌ Bad
// Directly calling SendGrid API in service code
```

This allows:
- Swapping providers without changing business logic
- Mocking in tests
- Graceful degradation when provider is down

### 1.2 Configuration

- All provider credentials go in environment variables (never in code)
- Provider configuration is validated at startup
- Each provider has a health check method

### 1.3 Rate Limits

- Respect provider rate limits (configured per provider)
- Implement queuing when approaching limits
- Log provider rate limit errors

---

## 2. Email Provider

**Purpose:** Sending notifications, verification emails, password resets.

**Placeholder Provider:** *TBD — SendGrid / AWS SES / Mailgun*

**Requirements:**
- Transactional email sending
- Template support (HTML emails)
- Delivery tracking (optional)
- Rate limit: handle gracefully if exceeded

**Abstraction:**
```typescript
interface EmailService {
  sendVerificationEmail(to: string, code: string): Promise<void>;
  sendPasswordResetEmail(to: string, token: string): Promise<void>;
  sendApplicationStatusEmail(
    to: string, 
    studentName: string, 
    internshipTitle: string, 
    status: ApplicationStatus
  ): Promise<void>;
  sendWelcomeEmail(to: string, name: string): Promise<void>;
}
```

---

## 3. SMS Provider

**Purpose:** OTP delivery for phone verification.

**Placeholder Provider:** *TBD — Twilio / Africa's Talking / Vonage*

**Requirements:**
- Reliable delivery in Ethiopia
- OTP sending
- Rate limit: max 3 per phone per hour

**Abstraction:**
```typescript
interface SmsService {
  sendOtp(phone: string, code: string): Promise<void>;
  sendNotification(phone: string, message: string): Promise<void>;
}
```

---

## 4. File Storage Provider

**Purpose:** Storing resumes, profile pictures, company logos, internship documents.

**Placeholder Provider:** *TBD — AWS S3 / Cloudflare R2 / MinIO (self-hosted)*

**Requirements:**
- Public and private file storage
- Pre-signed URLs for secure uploads
- File type validation (only PDF, DOCX, images)
- File size limit: 10MB per file
- Virus scanning (future)

**Abstraction:**
```typescript
interface FileStorageService {
  upload(file: Buffer, path: string, mimeType: string): Promise<string>;
  getSignedUrl(path: string, expiresIn?: number): Promise<string>;
  delete(path: string): Promise<void>;
}
```

---

## 5. Mapping / Geolocation Provider (Future)

**Purpose:** Showing internship locations on a map, finding opportunities near a student.

**Placeholder Provider:** *TBD — Google Maps / Mapbox / OpenStreetMap*

---

## 6. Testing with External Providers

- Integration tests use **mocked providers**
- A "sandbox" mode uses email printing to console
- A "test" mode for SMS that logs instead of sending
- File storage tests use local filesystem instead of S3

---

## 7. Provider Health Checks

Each provider implements:
```typescript
interface ProviderHealthCheck {
  name: string;
  check(): Promise<{ healthy: boolean; latency: number; error?: string }>;
}
```

These are aggregated in the `/health` endpoint.

---

*External providers are dependencies, not core logic. Abstract everything.*
