# CardioWatch Security Policy

## Reporting Security Vulnerabilities

If you discover a security vulnerability, please report it responsibly:

1. **DO NOT** create a public GitHub issue
2. Email security@cardiowatch.com with:
   - Description of the vulnerability
   - Steps to reproduce
   - Potential impact
   - Suggested fix (if any)

We will respond within 48 hours and keep you informed of remediation progress.

---

## Security Architecture

### Authentication & Authorization

| Layer | Implementation |
|-------|----------------|
| Authentication | JWT with 15-minute expiry |
| Refresh Tokens | httpOnly secure cookies, 7-day expiry |
| MFA | TOTP (Google Authenticator compatible) |
| Password Storage | bcrypt with 12 rounds |
| Session Management | Redis-backed with automatic cleanup |
| Authorization | Role-Based Access Control (RBAC) |
| Data Isolation | PostgreSQL Row-Level Security (RLS) |

### Token Security

```
Access Token (JWT):
├── Algorithm: RS256 (asymmetric)
├── Expiry: 15 minutes
├── Storage: Memory only (never localStorage)
├── Contains: userId, role, permissions, organizationId
└── Refresh: Silent refresh before expiry

Refresh Token:
├── Storage: httpOnly, secure, sameSite=strict cookie
├── Expiry: 7 days
├── Rotation: New token issued on each refresh
└── Revocation: Stored in Redis blacklist
```

### Rate Limiting

| Endpoint Type | Limit | Window |
|--------------|-------|--------|
| Global | 100 requests | 15 minutes |
| Authentication | 10 requests | 15 minutes |
| Password Reset | 3 requests | 1 hour |
| API Write Operations | 30 requests | 1 minute |

### Data Protection

#### Encryption

| Data State | Method |
|------------|--------|
| In Transit | TLS 1.3 |
| At Rest (Database) | AES-256 (disk encryption) |
| At Rest (Fields) | AES-256-GCM (PII fields) |
| Backups | AES-256 encrypted |

#### Encrypted Fields (PII)

- `patients.nhs_number`
- `patients.date_of_birth`
- `patients.address_*`
- `patients.emergency_contact_*`
- `users.phone`
- `wearable_devices.access_token_encrypted`
- `wearable_devices.refresh_token_encrypted`

### Input Validation & Sanitization

1. **Schema Validation**: Zod schemas for all inputs
2. **Sanitization**: HTML entity encoding, XSS pattern removal
3. **SQL Injection**: Prisma ORM with parameterized queries
4. **Prototype Pollution**: Blocked `__proto__`, `constructor`, `prototype` keys

### Security Headers (Helmet.js)

```http
Content-Security-Policy: default-src 'self'; script-src 'self'; ...
X-Content-Type-Options: nosniff
X-Frame-Options: DENY
X-XSS-Protection: 1; mode=block
Strict-Transport-Security: max-age=31536000; includeSubDomains; preload
Referrer-Policy: strict-origin-when-cross-origin
Cross-Origin-Opener-Policy: same-origin
Cross-Origin-Resource-Policy: same-site
```

---

## OWASP Top 10 Mitigations

### A01: Broken Access Control
- [x] RBAC with principle of least privilege
- [x] PostgreSQL Row-Level Security
- [x] JWT claims verification on every request
- [x] Resource ownership validation

### A02: Cryptographic Failures
- [x] TLS 1.3 for all connections
- [x] AES-256-GCM for field encryption
- [x] bcrypt for password hashing
- [x] Secure random token generation

### A03: Injection
- [x] Prisma ORM (parameterized queries)
- [x] Input validation with Zod
- [x] Output encoding
- [x] SQL injection pattern detection

### A04: Insecure Design
- [x] Threat modeling completed
- [x] Security requirements documented
- [x] Defense in depth architecture
- [x] Fail-secure defaults

### A05: Security Misconfiguration
- [x] Security headers via Helmet.js
- [x] Environment validation at startup
- [x] Secrets not in codebase
- [x] Error messages don't leak info

### A06: Vulnerable Components
- [x] npm audit in CI pipeline
- [x] Snyk integration
- [x] Dependabot alerts enabled
- [x] Regular dependency updates

### A07: Authentication Failures
- [x] MFA support
- [x] Account lockout after failed attempts
- [x] Secure password requirements
- [x] Session fixation prevention

### A08: Data Integrity Failures
- [x] Signed JWTs
- [x] CSRF protection
- [x] Integrity checks on critical data
- [x] Audit logging

### A09: Security Logging Failures
- [x] Structured audit logging
- [x] PII masking in logs
- [x] Failed auth attempt logging
- [x] Anomaly alerting

### A10: Server-Side Request Forgery
- [x] URL validation for external requests
- [x] Allowlist for external domains
- [x] No user-controlled URLs in server requests

---

## Compliance

### HIPAA (Healthcare)

| Requirement | Implementation |
|-------------|----------------|
| Access Controls | RBAC + RLS |
| Audit Controls | Comprehensive audit logging |
| Integrity | Data validation, checksums |
| Transmission Security | TLS 1.3 |
| Encryption | AES-256 at rest and in transit |

### GDPR (Data Protection)

| Right | Implementation |
|-------|----------------|
| Access | Data export endpoint |
| Rectification | Update endpoints |
| Erasure | Soft delete + anonymization |
| Portability | JSON/CSV export |
| Consent | Explicit opt-in tracking |

---

## Incident Response

### Severity Levels

| Level | Description | Response Time |
|-------|-------------|---------------|
| Critical | Active breach, data exposure | 15 minutes |
| High | Vulnerability with exploit | 4 hours |
| Medium | Vulnerability without exploit | 24 hours |
| Low | Minor security issue | 7 days |

### Response Procedure

1. **Detect**: Automated monitoring alerts
2. **Contain**: Isolate affected systems
3. **Eradicate**: Remove threat
4. **Recover**: Restore services
5. **Review**: Post-incident analysis

---

## Security Checklist for Developers

### Before Committing

- [ ] No secrets in code (use environment variables)
- [ ] Input validation on all endpoints
- [ ] Authorization checks on all protected routes
- [ ] Audit logging for sensitive operations
- [ ] Error messages don't leak sensitive info

### Before Deploying

- [ ] npm audit shows no high/critical vulnerabilities
- [ ] Environment variables properly configured
- [ ] TLS certificates valid
- [ ] Rate limiting enabled
- [ ] Security headers configured

### Regular Tasks

- [ ] Weekly: Review audit logs for anomalies
- [ ] Monthly: Dependency updates
- [ ] Quarterly: Security review
- [ ] Annually: Penetration testing

---

## Contact

- Security Team: security@cardiowatch.com
- Emergency: +44 XXX XXX XXXX (24/7)
