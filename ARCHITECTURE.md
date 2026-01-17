# CardioWatch - Complete System Architecture

## Project Structure

```
signal-guide-health/
├── .github/
│   └── workflows/
│       ├── deploy.yml              # Frontend deployment
│       ├── ci.yml                  # CI pipeline (NEW)
│       └── security-scan.yml      # Security scanning (NEW)
│
├── backend/                        # NEW - Backend API Server
│   ├── src/
│   │   ├── config/
│   │   │   ├── database.ts        # Database connection
│   │   │   ├── redis.ts           # Redis/cache config
│   │   │   ├── env.ts             # Environment validation
│   │   │   └── security.ts        # Security settings
│   │   │
│   │   ├── middleware/
│   │   │   ├── auth.ts            # JWT verification
│   │   │   ├── rbac.ts            # Role-based access
│   │   │   ├── rateLimit.ts       # Rate limiting
│   │   │   ├── csrf.ts            # CSRF protection
│   │   │   ├── helmet.ts          # Security headers
│   │   │   ├── cors.ts            # CORS configuration
│   │   │   ├── audit.ts           # Audit logging
│   │   │   ├── encryption.ts      # Field encryption
│   │   │   ├── sanitize.ts        # Input sanitization
│   │   │   └── errorHandler.ts    # Global error handling
│   │   │
│   │   ├── routes/
│   │   │   ├── auth.ts            # Authentication endpoints
│   │   │   ├── users.ts           # User management
│   │   │   ├── patients.ts        # Patient CRUD
│   │   │   ├── doctors.ts         # Doctor management
│   │   │   ├── alerts.ts          # Alert management
│   │   │   ├── wearables.ts       # Wearable data sync
│   │   │   ├── whatsapp.ts        # WhatsApp webhooks
│   │   │   ├── appointments.ts    # Scheduling
│   │   │   └── admin.ts           # Admin operations
│   │   │
│   │   ├── services/
│   │   │   ├── authService.ts
│   │   │   ├── patientService.ts
│   │   │   ├── alertService.ts
│   │   │   ├── notificationService.ts
│   │   │   ├── wearableService.ts
│   │   │   ├── whatsappService.ts
│   │   │   ├── encryptionService.ts
│   │   │   └── auditService.ts
│   │   │
│   │   ├── models/                 # Prisma/TypeORM models
│   │   │   └── index.ts
│   │   │
│   │   ├── utils/
│   │   │   ├── logger.ts          # Winston logger
│   │   │   ├── crypto.ts          # Encryption helpers
│   │   │   ├── validators.ts      # Input validation
│   │   │   └── sanitizers.ts      # Data sanitization
│   │   │
│   │   ├── jobs/                   # Background jobs
│   │   │   ├── alertProcessor.ts
│   │   │   ├── wearableSync.ts
│   │   │   └── reportGenerator.ts
│   │   │
│   │   └── app.ts                  # Express app setup
│   │
│   ├── prisma/
│   │   └── schema.prisma          # Database schema
│   │
│   ├── tests/
│   │   ├── unit/
│   │   ├── integration/
│   │   └── security/              # Security tests
│   │
│   ├── Dockerfile
│   ├── package.json
│   └── tsconfig.json
│
├── frontend/                       # Current src/ renamed
│   └── (existing React app)
│
├── database/
│   ├── schema.sql                 # PostgreSQL schema
│   ├── seed.sql                   # Demo data
│   ├── migrations/
│   └── README.md
│
├── infrastructure/                 # NEW - IaC
│   ├── docker/
│   │   ├── docker-compose.yml
│   │   ├── docker-compose.prod.yml
│   │   └── nginx/
│   │       └── nginx.conf
│   │
│   ├── kubernetes/
│   │   ├── deployment.yaml
│   │   ├── service.yaml
│   │   ├── ingress.yaml
│   │   └── secrets.yaml
│   │
│   └── terraform/
│       ├── main.tf
│       ├── variables.tf
│       └── outputs.tf
│
├── security/                       # NEW - Security configs
│   ├── SECURITY.md                # Security policy
│   ├── INCIDENT_RESPONSE.md       # Incident procedures
│   ├── csp-policy.json            # Content Security Policy
│   ├── allowed-hosts.json         # CORS whitelist
│   └── rate-limits.json           # Rate limit configs
│
├── docs/                           # NEW - Documentation
│   ├── api/
│   │   └── openapi.yaml           # API specification
│   ├── architecture/
│   │   ├── system-design.md
│   │   ├── data-flow.md
│   │   └── security-model.md
│   └── runbooks/
│       ├── deployment.md
│       ├── incident-response.md
│       └── disaster-recovery.md
│
├── scripts/                        # NEW - Utility scripts
│   ├── setup.sh                   # Development setup
│   ├── migrate.sh                 # Database migrations
│   ├── backup.sh                  # Database backup
│   └── security-scan.sh           # Run security scans
│
├── .env.example
├── .gitignore
├── README.md
├── ARCHITECTURE.md
├── CONTRIBUTING.md
└── LICENSE
```

---

## Cybersecurity Architecture

### 1. Authentication & Authorization

```
┌─────────────────────────────────────────────────────────────────┐
│                    AUTHENTICATION FLOW                          │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  User        Frontend         API Gateway        Auth Service   │
│   │              │                 │                  │         │
│   │──Login───────►│                │                  │         │
│   │              │──Credentials────►│                 │         │
│   │              │                 │──Verify──────────►│        │
│   │              │                 │                  │         │
│   │              │                 │◄──JWT + Refresh──│         │
│   │              │◄──httpOnly Cookie─│                │         │
│   │◄─────────────│                 │                  │         │
│   │              │                 │                  │         │
│   │──API Request─►│──Bearer Token──►│                 │         │
│   │              │                 │──Validate────────►│        │
│   │              │                 │◄──Claims─────────│         │
│   │              │◄──Response──────│                  │         │
│   │◄─────────────│                 │                  │         │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 2. Security Layers

```
┌─────────────────────────────────────────────────────────────────┐
│                     SECURITY LAYERS                             │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ Layer 1: Network Security                                │   │
│  │  • WAF (Web Application Firewall)                        │   │
│  │  • DDoS Protection (Cloudflare/AWS Shield)               │   │
│  │  • TLS 1.3 Only                                          │   │
│  │  • Certificate Pinning                                   │   │
│  └─────────────────────────────────────────────────────────┘   │
│                           │                                     │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ Layer 2: Application Security                            │   │
│  │  • Rate Limiting (per IP, per user, per endpoint)        │   │
│  │  • CSRF Protection (double-submit cookie)                │   │
│  │  • XSS Prevention (CSP headers, sanitization)            │   │
│  │  • SQL Injection Prevention (parameterized queries)      │   │
│  │  • Input Validation (Zod schemas)                        │   │
│  └─────────────────────────────────────────────────────────┘   │
│                           │                                     │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ Layer 3: Authentication & Authorization                  │   │
│  │  • JWT with short expiry (15 min)                        │   │
│  │  • Refresh tokens (httpOnly, secure cookies)             │   │
│  │  • MFA (TOTP/SMS)                                        │   │
│  │  • Role-Based Access Control (RBAC)                      │   │
│  │  • Row-Level Security (PostgreSQL RLS)                   │   │
│  └─────────────────────────────────────────────────────────┘   │
│                           │                                     │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ Layer 4: Data Security                                   │   │
│  │  • Encryption at Rest (AES-256)                          │   │
│  │  • Encryption in Transit (TLS 1.3)                       │   │
│  │  • Field-Level Encryption (PII data)                     │   │
│  │  • Key Management (AWS KMS / HashiCorp Vault)            │   │
│  │  • Data Masking in Logs                                  │   │
│  └─────────────────────────────────────────────────────────┘   │
│                           │                                     │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ Layer 5: Audit & Monitoring                              │   │
│  │  • Comprehensive Audit Logging                           │   │
│  │  • Real-time Intrusion Detection                         │   │
│  │  • Anomaly Detection (ML-based)                          │   │
│  │  • SIEM Integration                                      │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 3. Threat Model (STRIDE)

| Threat | Risk | Mitigation |
|--------|------|------------|
| **Spoofing** | Attacker impersonates user/doctor | MFA, device fingerprinting, session binding |
| **Tampering** | Modify patient data in transit | TLS 1.3, request signing, integrity checks |
| **Repudiation** | Deny clinical actions taken | Immutable audit logs, digital signatures |
| **Information Disclosure** | Leak PHI/patient data | Encryption, access controls, data masking |
| **Denial of Service** | Overwhelm system | Rate limiting, WAF, auto-scaling |
| **Elevation of Privilege** | Gain admin access | RBAC, principle of least privilege, RLS |

### 4. OWASP Top 10 Mitigations

| Vulnerability | Status | Implementation |
|--------------|--------|----------------|
| A01: Broken Access Control | 🟡 Partial | RBAC implemented, need RLS enforcement |
| A02: Cryptographic Failures | 🔴 Missing | Need field-level encryption |
| A03: Injection | 🟢 Mitigated | Prisma ORM with parameterized queries |
| A04: Insecure Design | 🟡 Partial | Need threat modeling review |
| A05: Security Misconfiguration | 🔴 Missing | Need security headers, CSP |
| A06: Vulnerable Components | 🟡 Partial | Need dependency scanning |
| A07: Auth Failures | 🟢 Implemented | JWT + MFA framework ready |
| A08: Data Integrity Failures | 🔴 Missing | Need request signing |
| A09: Logging Failures | 🔴 Missing | Need structured audit logging |
| A10: SSRF | 🟢 N/A | No server-side URL fetching |

---

## Data Flow Architecture

```
┌────────────────────────────────────────────────────────────────────────┐
│                         DATA FLOW DIAGRAM                              │
├────────────────────────────────────────────────────────────────────────┤
│                                                                        │
│  ┌──────────┐    ┌──────────┐    ┌──────────┐    ┌──────────────────┐ │
│  │  Patient │    │ WhatsApp │    │ Wearable │    │ Clinician Portal │ │
│  │   App    │    │   API    │    │  Devices │    │    (React)       │ │
│  └────┬─────┘    └────┬─────┘    └────┬─────┘    └────────┬─────────┘ │
│       │               │               │                   │           │
│       ▼               ▼               ▼                   ▼           │
│  ┌────────────────────────────────────────────────────────────────┐   │
│  │                     API GATEWAY (Kong/AWS)                     │   │
│  │  • Rate Limiting  • Authentication  • Request Validation       │   │
│  └────────────────────────────────────────────────────────────────┘   │
│                               │                                        │
│       ┌───────────────────────┼───────────────────────┐               │
│       ▼                       ▼                       ▼               │
│  ┌─────────┐           ┌─────────────┐         ┌──────────┐          │
│  │  Auth   │           │   Patient   │         │  Alert   │          │
│  │ Service │           │   Service   │         │ Service  │          │
│  └────┬────┘           └──────┬──────┘         └────┬─────┘          │
│       │                       │                     │                 │
│       ▼                       ▼                     ▼                 │
│  ┌────────────────────────────────────────────────────────────────┐   │
│  │                      MESSAGE QUEUE (Redis/RabbitMQ)            │   │
│  │  • Alert Processing  • Notification Dispatch  • Data Sync      │   │
│  └────────────────────────────────────────────────────────────────┘   │
│                               │                                        │
│       ┌───────────────────────┼───────────────────────┐               │
│       ▼                       ▼                       ▼               │
│  ┌─────────┐           ┌─────────────┐         ┌──────────┐          │
│  │Notifier │           │  Analytics  │         │  Audit   │          │
│  │ Worker  │           │   Worker    │         │  Logger  │          │
│  └────┬────┘           └──────┬──────┘         └────┬─────┘          │
│       │                       │                     │                 │
│       ▼                       ▼                     ▼                 │
│  ┌────────────────────────────────────────────────────────────────┐   │
│  │                      PostgreSQL (Primary)                      │   │
│  │  • Row-Level Security  • Encryption at Rest  • Point-in-Time  │   │
│  └────────────────────────────────────────────────────────────────┘   │
│       │                                                               │
│       ▼                                                               │
│  ┌────────────────────────────────────────────────────────────────┐   │
│  │                      PostgreSQL (Replica)                      │   │
│  │  • Read Replicas for Analytics  • Disaster Recovery            │   │
│  └────────────────────────────────────────────────────────────────┘   │
│                                                                        │
└────────────────────────────────────────────────────────────────────────┘
```

---

## Database Schema Summary

### Core Tables (22 total)

**User Management:**
- `organizations` - NHS trusts, hospitals, practices
- `users` - All user accounts with MFA support
- `admins` - Admin permissions and access levels
- `doctors` - Professional details, GMC/NMC numbers
- `patients` - Medical data, triage, cardiac info
- `doctor_patient_assignments` - Care relationships

**Clinical Data:**
- `alerts` - Clinical alerts with severity/escalation
- `alert_actions` - Alert comments and resolutions
- `check_ins` - Daily patient check-in responses
- `patient_medical_history` - Historical conditions

**Wearable Integration:**
- `wearable_devices` - Connected devices per patient
- `wearable_readings` - Daily health metrics (HR, HRV, sleep, steps)

**Communication:**
- `chat_messages` - WhatsApp/SMS message history
- `conversations` - Conversation state and flows
- `notifications` - Multi-channel notification queue

**Appointments:**
- `appointments` - Scheduled visits with video links

**Analytics:**
- `patient_daily_stats` - Per-patient aggregates
- `system_daily_stats` - System-wide metrics

**Security & Audit:**
- `audit_logs` - All sensitive operations
- `user_sessions` - Active sessions with device info
- `password_reset_tokens` - Secure reset flow

---

## What's Missing (Priority Order)

### 🔴 CRITICAL (Security Blockers)

1. **Backend API Server** - No server-side code exists
2. **HTTPS Enforcement** - Currently uses HTTP in dev
3. **Token Security** - JWT in localStorage (vulnerable to XSS)
4. **Input Sanitization** - No server-side validation
5. **Rate Limiting** - No protection against brute force
6. **Audit Logging** - Schema exists, not implemented
7. **Secrets Management** - .env committed to git

### 🟠 HIGH (Production Blockers)

8. **Database ORM** - No Prisma/TypeORM connection
9. **Error Tracking** - Sentry configured but not used
10. **Logging Infrastructure** - Only console.log
11. **Health Checks** - No /health endpoint
12. **Docker Configuration** - Cannot containerize
13. **Environment Validation** - No startup checks

### 🟡 MEDIUM (Before Public Release)

14. **Test Coverage** - Currently ~5%, need 70%+
15. **API Documentation** - No OpenAPI spec
16. **CI Security Scans** - No SAST/DAST
17. **Dependency Auditing** - npm audit not in CI
18. **CSP Headers** - Not configured

### 🟢 LOW (Operational Excellence)

19. **Kubernetes Manifests** - For cloud deployment
20. **Terraform IaC** - Infrastructure automation
21. **Monitoring Dashboards** - Grafana configs
22. **Runbooks** - Operational procedures
