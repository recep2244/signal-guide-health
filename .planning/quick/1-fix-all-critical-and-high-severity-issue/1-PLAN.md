---
phase: 1-fix-all-critical-and-high-severity-issue
plan: 1
type: execute
wave: 1
depends_on: []
files_modified:
  - backend/src/routes/patients.ts
  - src/test/Dashboard.test.tsx
  - backend/src/app.ts
  - backend/src/config/redis.ts
  - backend/prisma/schema.prisma
  - backend/src/services/authService.ts
  - backend/src/services/whatsappPilotService.ts
autonomous: true
requirements:
  - CRIT-01-patient-api-stubs
  - HIGH-01-broken-test
  - HIGH-02-redis-rate-limiting
  - HIGH-03-db-health-check
  - MED-01-prisma-migrations
  - MED-02-password-reset-email
  - MED-03-whatsapp-deduplication

must_haves:
  truths:
    - "GET /patients returns real rows from the database, not an empty array"
    - "GET /patients/stats returns real triage counts from the database"
    - "GET /patients/:id returns a patient object, or 404 — not null"
    - "GET /patients/:id/alerts returns real alert rows for the patient"
    - "GET /patients/:id/wearables returns real reading rows for the patient"
    - "GET /patients/:id/checkins returns real check-in rows for the patient"
    - "POST /patients creates a user + patient row and returns the created patient"
    - "PATCH /patients/:id/triage updates the triage level and records the actor"
    - "The frontend Dashboard.test.tsx compiles and passes (no import of deleted file)"
    - "GET /ready performs an actual SELECT 1 against the database; returns 503 when DB is unreachable"
    - "Redis client is instantiated and wired to express-rate-limit when REDIS_URL is set; graceful shutdown calls redis.quit()"
    - "admin_integration_keys and admin_integration_key_versions are declared as Prisma models, and a migration file is generated"
    - "requestPasswordReset sends a real email via nodemailer (SMTP) when SMTP_* env vars are set"
    - "startFollowUpBatch skips patients whose lastCheckIn date is today; no patient receives two outbound follow-up messages on the same UTC day"
  artifacts:
    - path: "backend/src/routes/patients.ts"
      provides: "Implemented patient CRUD endpoints using Prisma"
      contains: "prisma.patient.findMany"
    - path: "backend/src/config/redis.ts"
      provides: "ioredis singleton exported as `redis`"
      exports: ["redis"]
    - path: "backend/src/app.ts"
      provides: "Redis-backed rate limiter; live DB SELECT 1 in /ready; redis.quit() in graceful shutdown"
      contains: "prisma.$queryRaw"
    - path: "backend/prisma/schema.prisma"
      provides: "AdminIntegrationKey and AdminIntegrationKeyVersion Prisma models"
      contains: "model AdminIntegrationKey"
    - path: "src/test/Dashboard.test.tsx"
      provides: "Corrected import path pointing to src/demo/pages/Dashboard"
    - path: "backend/src/services/authService.ts"
      provides: "Nodemailer email dispatch in requestPasswordReset"
      contains: "nodemailer"
    - path: "backend/src/services/whatsappPilotService.ts"
      provides: "Date-of-today filter in startFollowUpBatch"
      contains: "lastCheckIn"
  key_links:
    - from: "backend/src/app.ts"
      to: "backend/src/config/redis.ts"
      via: "import { redis } from './config/redis'"
      pattern: "import.*redis.*from.*config/redis"
    - from: "backend/src/app.ts"
      to: "backend/src/config/database.ts"
      via: "checkDatabaseHealth() already exported — import and call in /ready"
      pattern: "checkDatabaseHealth"
    - from: "backend/src/services/integrationKeyService.ts"
      to: "backend/prisma/schema.prisma"
      via: "initializeStorage() removed; Prisma models handle DDL"
      pattern: "AdminIntegrationKey"
---

<objective>
Fix all 7 critical and high-severity issues blocking real pilot operation.

Purpose: The pilot backend currently returns empty data for every patient API
call, has a broken frontend test, unshared in-memory rate limiting across K8s
replicas, a fake readiness probe, un-migrated admin tables, a silent password
reset, and potential duplicate WhatsApp messages per patient per day. Fixing
these brings the backend to a functional state for real clinical use.

Output:
- Implemented patient CRUD endpoints (10 routes, Prisma queries)
- Redis singleton wired to rate limiter and graceful shutdown
- Live DB health check in /ready endpoint
- AdminIntegrationKey Prisma models + migration
- Nodemailer email dispatch for password reset
- WhatsApp daily deduplication in startFollowUpBatch
- Dashboard test fixed to reference the current file path
</objective>

<execution_context>
@./.claude/get-shit-done/workflows/execute-plan.md
@./.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@.planning/CODEBASE_ANALYSIS.md

<interfaces>
<!-- Key Prisma models the executor needs -->

Patient fields used in API responses (from schema.prisma):
  id, userId, nhsNumber, dateOfBirth, gender, triageLevel, wellbeingScore,
  lastCheckIn, primaryDiagnosis, whatsappPhone, whatsappOptedIn,
  addressLine1, city, postcode, notes, createdAt, updatedAt
  Relations: user {firstName, lastName, email}, doctorAssignments, alerts, checkIns, wearableReadings

Alert fields: id, patientId, type, severity, title, message, resolved,
  resolvedAt, acknowledged, escalationLevel, createdAt, metadata

CheckIn fields: id, patientId, channel, timestamp, wellbeingScore,
  symptoms, medicationsTaken, triageOutcome, aiSummary, createdAt

WearableReading fields: id, patientId, deviceId, readingDate,
  restingHeartRate, avgHeartRate, hrvMs, sleepHours, steps, bloodOxygenPercent

Frontend Patient type expects (src/types/patient.ts):
  { id, name, age, gender, condition, dischargeDate, triageLevel,
    lastCheckIn, wellbeingScore, wearableData[], chatHistory[],
    alerts[], sbar, medications[], nhsNumber }

The backend list response shape expected by src/services/patients/patientService.ts
  PatientListResponse: { patients, total, page, limit, stats }
  stats: { red, amber, green, total }

checkDatabaseHealth() is already exported from backend/src/config/database.ts:
  export async function checkDatabaseHealth(): Promise<boolean>

ioredis is already in backend/package.json. REDIS_URL is optional in env schema.

nodemailer is NOT currently in backend/package.json — install it and
@types/nodemailer before implementing email dispatch.

Current password reset token storage (authService.ts ~line 365):
  await prisma.passwordResetToken.create({ data: { userId, tokenHash, expiresAt } })
  The token (unhashed) must be appended to FRONTEND_URL + /reset-password?token=

WhatsApp batch query (whatsappPilotService.ts line 440):
  prisma.patient.findMany({ where: { whatsappOptedIn: true, whatsappPhone: { not: null } } })
  Today-filter to add: lastCheckIn is null OR date(lastCheckIn) < date(today UTC)
  Use Prisma: lastCheckIn: { lt: startOfTodayUTC } OR lastCheckIn: null
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Implement patient API endpoints with Prisma</name>
  <files>backend/src/routes/patients.ts</files>
  <action>
Replace all TODO stub bodies in backend/src/routes/patients.ts with real
Prisma queries. The file already has all route scaffolding, schemas, and
audit logging — only the query bodies are missing.

Implement each endpoint as follows:

GET / (list patients):
- Parse query with patientQuerySchema (already done).
- Build a Prisma `where` clause:
  - If triageLevel is set and not 'all': `{ triageLevel: query.triageLevel }`
  - If search is set: `{ OR: [{ user: { firstName: { contains: search, mode: 'insensitive' } } }, { user: { lastName: { contains: search, mode: 'insensitive' } } }, { nhsNumber: { contains: search } }] }`
  - If hasUnresolvedAlerts is true: `{ alerts: { some: { resolved: false } } }`
- Map sortBy to Prisma orderBy:
  - 'name' -> `{ user: { firstName: 'asc' } }`
  - 'triageLevel' -> `{ triageLevel: query.sortOrder }`
  - 'lastCheckIn' -> `{ lastCheckIn: query.sortOrder }`
  - 'wellbeingScore' -> `{ wellbeingScore: query.sortOrder }`
  - default -> `{ createdAt: 'desc' }`
- Use `prisma.patient.findMany` with `skip: (page-1)*limit`, `take: limit`, include `user: { select: { firstName, lastName, email } }` and `alerts: { where: { resolved: false }, select: { id, type, severity, title, resolved, createdAt } }`.
- Run a parallel `prisma.patient.count({ where })` for total.
- Also run `prisma.patient.groupBy({ by: ['triageLevel'], _count: true })` for stats counts.
- Return: `{ status: 'success', data: { patients, total, page, limit, totalPages: Math.ceil(total/limit), stats: { red, amber, green, total } } }`.

GET /search:
- q is already validated (length >= 2).
- `prisma.patient.findMany({ where: { OR: [firstName contains, lastName contains, nhsNumber contains] }, include: { user: { select: { firstName, lastName, email } }, alerts: { where: { resolved: false } } }, take: 20 })`.
- Return `{ status: 'success', data: { patients } }`.

GET /stats:
- `prisma.patient.groupBy({ by: ['triageLevel'], _count: { _all: true } })`.
- Also `prisma.patient.count({ where: { alerts: { some: { resolved: false } } } })` for withUnresolvedAlerts.
- Return `{ status: 'success', data: { total, red, amber, green, withUnresolvedAlerts } }`.

GET /:id:
- `prisma.patient.findUnique({ where: { id }, include: { user: true, alerts: { orderBy: { createdAt: 'desc' } }, wearableDevices: true, checkIns: { orderBy: { timestamp: 'desc' }, take: 10 } } })`.
- If not found: return 404 `{ status: 'error', code: 'NOT_FOUND', message: 'Patient not found' }`.
- Return `{ status: 'success', data: { patient } }`.

POST /:
- data is already parsed with createPatientSchema.
- Check if user with that email already exists; if so return 409.
- Use `prisma.$transaction`: (1) create User with role 'patient', random passwordHash placeholder (bcrypt hash of uuid), status 'pending_verification'; (2) create Patient with userId, dateOfBirth: new Date(data.dateOfBirth), and other fields from data; (3) if assignedDoctorId provided, create DoctorPatientAssignment.
- Import bcrypt at top of file: `import bcrypt from 'bcryptjs'` (already in package.json).
- Return 201 with `{ status: 'success', data: { patient } }`.

PUT /:id:
- Fetch patient first; 404 if not found.
- `prisma.$transaction`: update Patient fields from data; update User fields (email, firstName, lastName) if provided.
- Return `{ status: 'success', data: { patient: updated } }`.

PATCH /:id/triage:
- Fetch patient first; 404 if not found.
- `prisma.patient.update({ where: { id }, data: { triageLevel: data.triageLevel, triageUpdatedAt: new Date(), triageUpdatedById: req.user?.userId } })`.
- If data.notes, also `prisma.alert.create` a manual alert recording the triage change.
- Return `{ status: 'success', data: { patient: updated } }`.

DELETE /:id (GDPR soft-delete / anonymise):
- Fetch patient; 404 if not found.
- `prisma.$transaction`: update User { email: `deleted_${id}@deleted.invalid`, firstName: 'Deleted', lastName: 'Patient', status: 'inactive' }; update Patient { nhsNumber: null, whatsappPhone: null, notes: null, addressLine1: null, addressLine2: null, city: null, postcode: null }.
- Return `{ status: 'success', message: 'Patient record deleted' }`.

GET /:id/alerts:
- Parse includeResolved from query (default false).
- Fetch patient to verify exists (404 if not).
- `prisma.alert.findMany({ where: { patientId: id, ...(includeResolved ? {} : { resolved: false }) }, orderBy: { createdAt: 'desc' }, include: { actions: { orderBy: { createdAt: 'desc' }, take: 5 } } })`.
- Return `{ status: 'success', data: { alerts } }`.

GET /:id/wearables:
- days defaults to 14; parse as number clamped to 1-90.
- Fetch patient to verify exists (404 if not).
- `prisma.wearableDevice.findMany({ where: { patientId: id } })` for devices.
- `prisma.wearableReading.findMany({ where: { patientId: id, readingDate: { gte: new Date(Date.now() - days*86400000) } }, orderBy: { readingDate: 'desc' } })` for readings.
- Return `{ status: 'success', data: { devices, readings } }`.

GET /:id/checkins:
- limit defaults to 30; parse as number clamped to 1-100.
- Fetch patient to verify exists (404 if not).
- `prisma.checkIn.findMany({ where: { patientId: id }, orderBy: { timestamp: 'desc' }, take: limit })`.
- Return `{ status: 'success', data: { checkins } }`.

All catch blocks: wrap async handlers to catch Prisma errors. On ZodError from schema parse, return 400. On unknown error, rethrow (express error handler picks up).

Add error handling: wrap all handler bodies in try/catch. On Prisma P2025 (record not found) return 404. Rethrow others.
  </action>
  <verify>
    <automated>cd /home/recep/Desktop/Machine_Learning/projects/health_monitor_gp/signal-guide-health/backend && npx tsc --noEmit 2>&1 | grep -E "patients\.ts" || echo "NO_TYPE_ERRORS_IN_PATIENTS"</automated>
  </verify>
  <done>
All patient route handlers contain Prisma queries (no TODO stubs remain). TypeScript compiles backend/src/routes/patients.ts without errors. GET /patients, GET /patients/stats, GET /patients/:id, GET /patients/:id/alerts, GET /patients/:id/wearables, GET /patients/:id/checkins, POST /patients, PUT /patients/:id, PATCH /patients/:id/triage, DELETE /patients/:id all have real database implementations.
  </done>
</task>

<task type="auto">
  <name>Task 2: Fix broken Dashboard test import path</name>
  <files>src/test/Dashboard.test.tsx</files>
  <action>
The test at src/test/Dashboard.test.tsx line 6 imports:
  `import Dashboard from "@/pages/Dashboard";`

`src/pages/Dashboard.tsx` was deleted. The demo dashboard now lives at
`src/demo/pages/Dashboard.tsx`.

Change the import to:
  `import Dashboard from "@/demo/pages/Dashboard";`

The test checks for "Margaret Thompson" which is a mock patient in
`src/data/mockPatients.ts` — the demo dashboard renders mock data, so
this still matches.

No other changes to the test body.
  </action>
  <verify>
    <automated>cd /home/recep/Desktop/Machine_Learning/projects/health_monitor_gp/signal-guide-health && npx vitest run src/test/Dashboard.test.tsx 2>&1 | tail -20</automated>
  </verify>
  <done>
`npx vitest run src/test/Dashboard.test.tsx` exits 0. The test compiles and the "Margaret Thompson" assertion passes.
  </done>
</task>

<task type="auto">
  <name>Task 3: Wire Redis client and fix /ready DB health check</name>
  <files>backend/src/config/redis.ts, backend/src/app.ts</files>
  <action>
**Step A — Create backend/src/config/redis.ts:**

```typescript
/**
 * Redis client singleton (ioredis)
 * Only instantiated when REDIS_URL is set in environment.
 */
import Redis from 'ioredis';
import { env } from './env';
import { logger } from '../utils/logger';

let redis: Redis | null = null;

if (env.REDIS_URL) {
  redis = new Redis(env.REDIS_URL, {
    maxRetriesPerRequest: 3,
    enableReadyCheck: true,
    lazyConnect: false,
  });

  redis.on('connect', () => {
    logger.info({ message: 'Redis connected' });
  });

  redis.on('error', (err: Error) => {
    logger.error({ message: 'Redis error', error: err.message });
  });
}

export { redis };
```

**Step B — Update backend/src/app.ts:**

1. Add import at the top with other config imports:
   ```typescript
   import { redis } from './config/redis';
   import { checkDatabaseHealth } from './config/database';
   ```
   (`checkDatabaseHealth` is already exported from database.ts — use it.)

2. Replace the `express-rate-limit` global limiter creation (~line 116-128) to
   use a Redis store when redis is available. Install `rate-limit-redis` first:
   The package `rate-limit-redis` exports `RedisStore`. Wire it conditionally:
   ```typescript
   import { RedisStore } from 'rate-limit-redis';

   const globalLimiter = rateLimit({
     windowMs: 15 * 60 * 1000,
     max: env.RATE_LIMIT_MAX,
     standardHeaders: true,
     legacyHeaders: false,
     message: { ... }, // keep existing message
     skip: (req) => req.path === '/health',
     ...(redis
       ? {
           store: new RedisStore({
             sendCommand: (...args: string[]) => redis!.call(...args) as Promise<number>,
           }),
         }
       : {}),
   });
   ```
   Do the same for `authLimiter` (same pattern, different windowMs/max).

   Note: `rate-limit-redis` may not be in package.json. Add it:
   Run `npm install rate-limit-redis` in backend/ before implementing. If the
   package doesn't exist, use `ioredis-rate-limit` or implement without — but
   prefer `rate-limit-redis` v4 which is compatible with express-rate-limit v7.

3. Fix the `/ready` endpoint (~line 196-213):
   Uncomment and use `checkDatabaseHealth()`:
   ```typescript
   app.get('/ready', async (_req: Request, res: Response) => {
     const dbHealthy = await checkDatabaseHealth();
     if (dbHealthy) {
       res.status(200).json({
         status: 'ready',
         database: 'connected',
         timestamp: new Date().toISOString(),
       });
     } else {
       res.status(503).json({
         status: 'not ready',
         database: 'disconnected',
         timestamp: new Date().toISOString(),
       });
     }
   });
   ```

4. Fix the graceful shutdown (~line 276-285) — uncomment and fix:
   ```typescript
   server.close(async () => {
     logger.info({ message: 'HTTP server closed' });
     try {
       await prisma.$disconnect();
       logger.info({ message: 'Database disconnected' });
     } catch { /* ignore */ }
     if (redis) {
       try {
         await redis.quit();
         logger.info({ message: 'Redis disconnected' });
       } catch { /* ignore */ }
     }
     process.exit(0);
   });
   ```
   Add `import { prisma } from './config/database';` at top if not already
   imported (check existing imports — prisma may not be imported directly in
   app.ts; it is used via routes, so add the import explicitly for shutdown).

**Packages to install in backend/:**
```
npm install rate-limit-redis
```
ioredis is already installed.
  </action>
  <verify>
    <automated>cd /home/recep/Desktop/Machine_Learning/projects/health_monitor_gp/signal-guide-health/backend && npx tsc --noEmit 2>&1 | grep -E "redis|app\.ts" || echo "NO_REDIS_TYPE_ERRORS"</automated>
  </verify>
  <done>
backend/src/config/redis.ts exists and exports `redis`. backend/src/app.ts imports and uses it for rate limiter store (conditionally when REDIS_URL is set). The /ready handler calls checkDatabaseHealth() and returns 503 on DB failure. The graceful shutdown calls prisma.$disconnect() and redis.quit() (when redis is non-null). TypeScript compiles without errors on these files.
  </done>
</task>

<task type="auto">
  <name>Task 4: Add AdminIntegrationKey Prisma models and generate migration</name>
  <files>backend/prisma/schema.prisma, backend/src/services/integrationKeyService.ts</files>
  <action>
**Step A — Add two models to backend/prisma/schema.prisma:**

Add after the `AuditLog` model (or at the end before closing):

```prisma
// =============================================================================
// INTEGRATION KEY VAULT
// =============================================================================

model AdminIntegrationKey {
  id                    String    @id @default(uuid())
  provider              String
  keyName               String    @map("key_name")
  encryptedValue        String    @map("encrypted_value")
  valueFingerprint      String    @map("value_fingerprint")
  version               Int       @default(1)
  lastRotatedAt         DateTime? @map("last_rotated_at")
  lastValidatedAt       DateTime? @map("last_validated_at")
  lastValidationStatus  String?   @map("last_validation_status")
  lastValidationMessage String?   @map("last_validation_message")
  createdBy             String?   @map("created_by")
  updatedBy             String?   @map("updated_by")
  createdAt             DateTime  @default(now()) @map("created_at")
  updatedAt             DateTime  @updatedAt @map("updated_at")

  versions AdminIntegrationKeyVersion[]

  @@unique([provider, keyName])
  @@map("admin_integration_keys")
}

model AdminIntegrationKeyVersion {
  id               String    @id @default(uuid())
  provider         String
  keyName          String    @map("key_name")
  version          Int
  encryptedValue   String    @map("encrypted_value")
  valueFingerprint String    @map("value_fingerprint")
  status           String    @default("active")
  rotationReason   String?   @map("rotation_reason")
  rotatedBy        String?   @map("rotated_by")
  createdAt        DateTime  @default(now()) @map("created_at")
  revokedAt        DateTime? @map("revoked_at")

  integrationKey AdminIntegrationKey @relation(fields: [provider, keyName], references: [provider, keyName], onDelete: Cascade)

  @@unique([provider, keyName, version])
  @@map("admin_integration_key_versions")
}
```

**Step B — Generate a migration (do NOT run it against the DB — just create the file):**

```bash
cd backend && npx prisma migrate dev --name add_integration_key_models --create-only
```

This creates `backend/prisma/migrations/<timestamp>_add_integration_key_models/migration.sql` without touching the database. The `--create-only` flag is safe to run without a live DB.

**Step C — Update integrationKeyService.ts to remove initializeStorage DDL:**

In `backend/src/services/integrationKeyService.ts`:
1. Remove (or comment out) the `initializeStorage()` method body — the three `$executeRawUnsafe` calls for CREATE TABLE and ALTER TABLE. Replace the body with a no-op comment:
   ```typescript
   private async initializeStorage(): Promise<void> {
     // Tables are now managed by Prisma migrations.
     // See prisma/migrations/ for schema DDL.
   }
   ```
2. Keep `ensureStorage()` and `initPromise` as-is — they now call a no-op,
   which is fine. The lazy init guard remains useful if the method is later
   extended.
  </action>
  <verify>
    <automated>cd /home/recep/Desktop/Machine_Learning/projects/health_monitor_gp/signal-guide-health/backend && npx prisma validate 2>&1 | tail -5</automated>
  </verify>
  <done>
`prisma validate` exits 0 with no schema errors. Both `AdminIntegrationKey` and `AdminIntegrationKeyVersion` appear in schema.prisma with correct `@@map` names matching the existing table names. A migration SQL file exists in backend/prisma/migrations/. The `initializeStorage()` method no longer contains `$executeRawUnsafe` DDL statements.
  </done>
</task>

<task type="auto">
  <name>Task 5: Implement password reset email via nodemailer</name>
  <files>backend/src/services/authService.ts</files>
  <action>
The `requestPasswordReset` method in authService.ts stores a token in the DB
but never sends an email. The env schema already has optional SMTP_* vars.

**Step A — Install nodemailer:**
```bash
cd backend && npm install nodemailer && npm install --save-dev @types/nodemailer
```

**Step B — Add email dispatch in authService.ts:**

At the top of the file, add the import:
```typescript
import nodemailer from 'nodemailer';
```

Add a private helper method to the AuthService class, after the class field declarations:
```typescript
private createMailTransport(): nodemailer.Transporter | null {
  if (!env.SMTP_HOST || !env.SMTP_USER || !env.SMTP_PASSWORD || !env.SMTP_FROM) {
    return null;
  }
  return nodemailer.createTransport({
    host: env.SMTP_HOST,
    port: env.SMTP_PORT ?? 587,
    secure: (env.SMTP_PORT ?? 587) === 465,
    auth: {
      user: env.SMTP_USER,
      pass: env.SMTP_PASSWORD,
    },
  });
}
```

In `requestPasswordReset`, replace the `// TODO: Send email with reset link` comment with:
```typescript
const transport = this.createMailTransport();
if (transport) {
  const resetUrl = `${env.FRONTEND_URL}/reset-password?token=${token}`;
  try {
    await transport.sendMail({
      from: env.SMTP_FROM,
      to: user.email,
      subject: 'CardioWatch — Reset your password',
      text: [
        `Hi ${user.firstName},`,
        '',
        'You requested a password reset for your CardioWatch account.',
        `Click the link below to reset your password (valid for 1 hour):`,
        '',
        resetUrl,
        '',
        'If you did not request this, you can safely ignore this email.',
      ].join('\n'),
      html: `<p>Hi ${user.firstName},</p>
<p>You requested a password reset for your CardioWatch account.</p>
<p><a href="${resetUrl}">Reset your password</a> (valid for 1 hour)</p>
<p>If you did not request this, you can safely ignore this email.</p>`,
    });
    logger.info({ message: 'Password reset email sent', userId: user.id });
  } catch (emailError) {
    logger.error({
      message: 'Failed to send password reset email',
      userId: user.id,
      error: emailError instanceof Error ? emailError.message : 'Unknown error',
    });
    // Do not throw — token is still valid; user can retry or use the token directly.
  }
} else {
  logger.warn({
    message: 'SMTP not configured — password reset email not sent',
    userId: user.id,
  });
}
```

Note: The `token` variable (unhashed) is already in scope at line 361. The
reset URL uses `env.FRONTEND_URL` which is always set. This is safe — even
if SMTP is not configured the token is stored in the DB and the warning is
logged, preventing a silent failure regression.
  </action>
  <verify>
    <automated>cd /home/recep/Desktop/Machine_Learning/projects/health_monitor_gp/signal-guide-health/backend && npx tsc --noEmit 2>&1 | grep "authService" || echo "NO_AUTH_SERVICE_TYPE_ERRORS"</automated>
  </verify>
  <done>
authService.ts imports nodemailer. The `requestPasswordReset` method sends an email when SMTP_* env vars are set, and logs a warning instead of silently failing when SMTP is not configured. TypeScript compiles without errors. nodemailer and @types/nodemailer are in backend/package.json.
  </done>
</task>

<task type="auto">
  <name>Task 6: Add per-patient daily deduplication to WhatsApp batch</name>
  <files>backend/src/services/whatsappPilotService.ts</files>
  <action>
In `backend/src/services/whatsappPilotService.ts`, the `startFollowUpBatch`
method (~line 439) queries all opted-in patients with no date filter. If the
scheduler restarts mid-day, patients already messaged today receive duplicates.

Fix: filter out patients whose `lastCheckIn` date is today (UTC).

Locate the `startFollowUpBatch` method. Replace the `prisma.patient.findMany`
query with a version that excludes patients already checked in today:

```typescript
async startFollowUpBatch(limit = 25): Promise<FollowUpBatchResult> {
  // Start of today in UTC (midnight UTC)
  const startOfTodayUtc = new Date();
  startOfTodayUtc.setUTCHours(0, 0, 0, 0);

  const patients = await prisma.patient.findMany({
    where: {
      whatsappOptedIn: true,
      whatsappPhone: {
        not: null,
      },
      // Exclude patients who already received a follow-up today:
      // lastCheckIn is null (never checked in) OR lastCheckIn is before today UTC
      OR: [
        { lastCheckIn: null },
        { lastCheckIn: { lt: startOfTodayUtc } },
      ],
    },
    select: {
      id: true,
    },
    take: limit,
    orderBy: {
      lastCheckIn: { sort: 'asc', nulls: 'first' },
    },
  });
  // ... rest of method unchanged
```

Keep the rest of the method body (the for-loop calling startFollowUpForPatient,
result accumulation, error handling) completely unchanged.

The `orderBy` change (from `updatedAt: 'desc'` to `lastCheckIn: asc nulls first`)
also prioritises patients who have not checked in recently, which is more
clinically correct than ordering by record update time.

Note: `nulls: 'first'` in Prisma orderBy requires Prisma 4.16+. The project
uses Prisma 5, so this syntax is supported.
  </action>
  <verify>
    <automated>cd /home/recep/Desktop/Machine_Learning/projects/health_monitor_gp/signal-guide-health/backend && npx tsc --noEmit 2>&1 | grep "whatsappPilotService" || echo "NO_WHATSAPP_TYPE_ERRORS"</automated>
  </verify>
  <done>
`startFollowUpBatch` filters patients with `lastCheckIn: null OR lastCheckIn < startOfTodayUtc`. A patient whose lastCheckIn was set by a completed check-in earlier today will not appear in the batch. TypeScript compiles without errors on whatsappPilotService.ts.
  </done>
</task>

</tasks>

<verification>
Run full backend TypeScript check:
```
cd backend && npx tsc --noEmit
```
Expected: 0 errors.

Run frontend test:
```
npx vitest run src/test/Dashboard.test.tsx
```
Expected: PASS.

Run Prisma schema validation:
```
cd backend && npx prisma validate
```
Expected: "The schema at ... is valid."

Spot-check patient routes contain real queries:
```
grep -n "prisma\." backend/src/routes/patients.ts | head -20
```
Expected: 10+ lines with prisma model calls.

Spot-check Redis wiring in app.ts:
```
grep -n "redis\|checkDatabaseHealth\|prisma\.\$disconnect" backend/src/app.ts
```
Expected: imports and usage present.

Spot-check password reset email:
```
grep -n "nodemailer\|sendMail\|SMTP" backend/src/services/authService.ts
```
Expected: 3+ lines.

Spot-check WhatsApp deduplication:
```
grep -n "startOfTodayUtc\|lastCheckIn" backend/src/services/whatsappPilotService.ts
```
Expected: filter present in startFollowUpBatch.
</verification>

<success_criteria>
- All 7 issues from STATE.md blockers list are resolved
- `npx tsc --noEmit` in backend/ exits 0
- `npx vitest run src/test/Dashboard.test.tsx` exits 0
- `npx prisma validate` exits 0
- backend/src/routes/patients.ts contains no remaining `// TODO: Implement` comments
- backend/src/app.ts /ready handler calls checkDatabaseHealth() (not commented out)
- backend/src/config/redis.ts exists with ioredis singleton
- backend/prisma/schema.prisma contains AdminIntegrationKey and AdminIntegrationKeyVersion models
- backend/src/services/authService.ts calls sendMail() for password reset
- backend/src/services/whatsappPilotService.ts startFollowUpBatch filters by today's lastCheckIn
</success_criteria>

<output>
After completion, create `.planning/quick/1-fix-all-critical-and-high-severity-issue/1-SUMMARY.md` with:
- Which tasks completed successfully
- Any TypeScript errors encountered and how they were resolved
- Packages installed (nodemailer, rate-limit-redis)
- Migration file path created by prisma migrate dev --create-only
- Any deviations from the plan with rationale
</output>
