# Cache-Control Policy

> **Defines the cache-control strategy for all API responses.**
> This document explains the rationale behind each Cache-Control directive
> and documents why certain headers (notably COEP) are intentionally skipped.

---

## 1. Cache-Control Strategy

### 1.1 By Path

| Path Pattern | Cache-Control | Rationale |
|-------------|---------------|-----------|
| `/health`, `/health/live`, `/health/ready`, `/api/v1/health*` | `public, max-age=0` | Health endpoints contain no sensitive data. CDN caching is safe and improves probe reliability. `max-age=0` forces revalidation but allows serving stale data if origin is unreachable. |
| `/api/v1/*` | `no-store` | API endpoints may return authenticated/sensitive data. `no-store` prevents any caching at all levels (browser, CDN, proxy). This is the most secure option per SECURITY_RULES.md §3.6. |
| All other paths | `no-cache` | Conservative default for non-API, non-health responses. Allows caching but requires revalidation on every request. |

### 1.2 Implementation

The cache-control strategy is implemented as **path-based middleware** in `src/shared/middleware/cache-control.middleware.ts`.

**Design decisions:**
- **Path-based, not `req.user`-based**: Relying on `req.user` would couple the middleware to authentication state and make the behavior dependent on middleware ordering. Path-based matching is explicit, predictable, and testable.
- **Mounted early in the stack**: After security headers, before rate limiting. This ensures all downstream responses get the header regardless of route handler behavior.
- **No `Surrogate-Control` header**: Not needed for the current deployment architecture. Can be added if a CDN with surrogate control is introduced.

---

## 2. Related Security Headers

### 2.1 Strict-Transport-Security (HSTS)

```
Strict-Transport-Security: max-age=31536000; includeSubDomains; preload
```

- 1 year (31536000 seconds) is the recommended max-age for production
- `includeSubDomains` covers all subdomains
- `preload` allows submission to browser HSTS preload lists
- See: `security-headers.middleware.ts`

### 2.2 Permissions-Policy

```
Permissions-Policy: camera=(), microphone=(), geolocation=()
```

Disables all sensitive device features by default. This is a restrictive policy — no camera, microphone, or geolocation access is allowed. Relax this policy only if the application explicitly requires these features.

### 2.3 Cross-Origin-Opener-Policy (COOP)

```
Cross-Origin-Opener-Policy: same-origin-allow-popups
```

- `same-origin-allow-popups` allows the page to open popups that retain `window.opener` references
- This is more permissive than `same-origin` but avoids breaking legitimate use cases (OAuth flows, payment gateways)
- A future hardening pass may switch to `same-origin` if no popups are needed

---

## 3. COEP — Intentionally Skipped

### 3.1 What COEP Does

`Cross-Origin-Embedder-Policy: require-corp` forces all cross-origin resources loaded by the page to explicitly opt-in via `Cross-Origin-Resource-Policy` headers. Without this opt-in, resources are blocked.

### 3.2 Why COEP is Skipped

Enabling `require-corp` would break all external resources that do not set the appropriate `Cross-Origin-Resource-Policy` or CORS headers. Common examples:

| Resource Type | Example | Impact if COEP enabled |
|--------------|---------|----------------------|
| CDN fonts | Google Fonts, custom icon fonts | Fonts fail to load |
| Analytics scripts | Google Analytics, Plausible | Scripts blocked |
| Third-party widgets | Chat widgets, embedded maps | Widgets broken |
| Images from CDN | User avatars, logos hosted externally | Images blocked |
| Iframes | Embedded content from partner domains | Iframes blocked |

### 3.3 When COEP Can Be Enabled

Before enabling COEP, conduct a full audit of all resources the frontend loads:

1. Catalog every external resource loaded by the application
2. Verify each resource supports `Cross-Origin-Resource-Policy: cross-origin` or appropriate CORS headers
3. Update or replace any resource that does not comply
4. Deploy COEP with `Credentialless` mode as a transition step

### 3.4 COEP Audit Checklist

- [ ] All fonts hosted on same origin or CDN with CORP headers
- [ ] All analytics/tracking scripts opt in via CORP or CORS
- [ ] All embedded resources (iframes, images, widgets) are compatible
- [ ] All API calls from the frontend use CORS (not CORP-dependent)
- [ ] No browser console warnings or errors for blocked resources

**Without completing this audit, do not add `Cross-Origin-Embedder-Policy` to the security headers middleware.**

---

## 4. Cache-Control Testing

When verifying Cache-Control behavior, test these scenarios:

| Test | Path | Expected Header |
|------|------|----------------|
| Health root | `GET /health` | `Cache-Control: public, max-age=0` |
| Health live | `GET /health/live` | `Cache-Control: public, max-age=0` |
| Health ready | `GET /health/ready` | `Cache-Control: public, max-age=0` |
| API health | `GET /api/v1/health` | `Cache-Control: public, max-age=0` |
| API auth | `POST /api/v1/auth/login` | `Cache-Control: no-store` |
| API internships | `GET /api/v1/internships` | `Cache-Control: no-store` |
| Unknown path | `GET /robots.txt` | `Cache-Control: no-cache` |

---

*Cache-Control is a security header. Use `no-store` for sensitive data, `public` only for deliberately cacheable endpoints.*
