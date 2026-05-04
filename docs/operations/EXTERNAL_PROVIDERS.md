# EXTERNAL_PROVIDERS.md

> **Configuration and management of external service providers.**

---

## 1. Provider List

| Provider | Purpose | Service |
|----------|---------|---------|
| Email | Notifications, verification | *TBD* (SendGrid/AWS SES/Mailgun) |
| SMS | OTP delivery | *TBD* (Twilio/Africa's Talking/Vonage) |
| File Storage | Resumes, profile images | *TBD* (AWS S3/Cloudflare R2/MinIO) |
| Error Tracking | Error monitoring | *TBD* (Sentry) |

---

## 2. Email Provider

**Placeholder:** *SendGrid / AWS SES / Mailgun*

### Configuration

```
EMAIL_HOST=smtp.sendgrid.net
EMAIL_PORT=587
EMAIL_USER=apikey
EMAIL_PASS=<api-key>
EMAIL_FROM=noreply@internship-platform.et
```

### Templates

| Template | Description |
|----------|-------------|
| `welcome` | Welcome email on registration |
| `verify-email` | Email verification link |
| `password-reset` | Password reset link |
| `application-received` | Confirmation to student |
| `application-status-change` | Status update to student |
| `new-application` | Notification to company |

### Development Mode

In development, emails are logged to console instead of sent:
```
Email: to=student@example.com subject="Welcome!" body="..."
```

---

## 3. SMS Provider

**Placeholder:** *Twilio / Africa's Talking / Vonage*

### Configuration

```
SMS_API_KEY=<api-key>
SMS_API_SECRET=<api-secret>
SMS_FROM=InternshipET
```

### Use Cases

- OTP verification codes
- Application status notifications (future)

### Development Mode

In development, SMS messages are logged to console:
```
SMS: to=+251911223344 message="Your code is 123456"
```

---

## 4. File Storage Provider

**Placeholder:** *AWS S3 / Cloudflare R2 / MinIO (self-hosted)*

### Configuration

```
STORAGE_ENDPOINT=https://s3.amazonaws.com
STORAGE_BUCKET=internship-platform-uploads
STORAGE_ACCESS_KEY=<access-key>
STORAGE_SECRET_KEY=<secret-key>
STORAGE_REGION=eu-west-1
STORAGE_PUBLIC_URL=https://cdn.internship-platform.et
```

### File Types Allowed

| File Type | Extensions | Max Size | Purpose |
|-----------|------------|----------|---------|
| Resume | `.pdf`, `.docx` | 10MB | Student resumes |
| Profile Image | `.jpg`, `.png`, `.webp` | 5MB | User avatars |
| Company Logo | `.jpg`, `.png`, `.webp` | 5MB | Company branding |
| School Logo | `.jpg`, `.png`, `.webp` | 5MB | School branding |

### File Naming Convention

```
{entity}/{userId}/{uuid}.{extension}
Examples:
resumes/user-abc123/resume-xyz.pdf
avatars/user-abc123/profile.jpg
logos/company-abc123/logo.png
```

### Security

- Uploads go through pre-signed URLs (client uploads directly to storage)
- File type is validated server-side before generating pre-signed URL
- Virus scanning (future feature)

---

## 5. Error Tracking (Future)

**Placeholder:** *Sentry*

### Configuration

```
SENTRY_DSN=https://xxx@sentry.io/xxx
SENTRY_ENVIRONMENT=production
```

### What to Track

- Unhandled exceptions
- 5xx errors
- Slow database queries (> 1s)
- Rate limit violations (future)

---

## 6. Provider Health Checks

Each provider implements a health check:

```typescript
interface ProviderHealth {
  name: string;
  status: 'healthy' | 'unhealthy';
  latency: number;
  error?: string;
}
```

These are aggregated in the `/health` endpoint.

---

## 7. Provider Migration

If switching providers:
1. Implement new provider behind the same interface
2. Test in staging
3. Switch environment variables
4. Verify functionality
5. Decommission old provider

---

*Providers are abstracted behind interfaces. Swapping them should not require code changes.*
