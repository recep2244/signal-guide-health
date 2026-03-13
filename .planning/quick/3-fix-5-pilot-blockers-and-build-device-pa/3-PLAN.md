---
phase: quick-3
plan: 3
type: execute
wave: 1
depends_on: []
files_modified:
  - src/pilot/pages/PatientDetail.tsx
  - backend/src/routes/alerts.ts
  - src/hooks/usePatientData.ts
  - .env.pilot
  - backend/prisma/seed.ts
  - backend/src/middleware/audit.ts
  - backend/prisma/schema.prisma
  - backend/src/routes/pairing.ts
  - backend/src/app.ts
  - src/pilot/components/DevicePairingModal.tsx
  - package.json
autonomous: true
requirements:
  - BLOCKER-1
  - BLOCKER-2
  - BLOCKER-3
  - BLOCKER-4
  - BLOCKER-5
  - DEVICE-PAIRING

must_haves:
  truths:
    - "src/pilot/pages/PatientDetail.tsx imports no mockPatients symbols — uses usePatientDetail hook and shows a loading/error state"
    - "GET /api/v1/alerts returns real Alert rows from DB; POST creates; resolve/escalate/acknowledge update rows"
    - "VITE_ENABLE_MOCK_DATA defaults to false in usePatientData.ts; .env.pilot sets it explicitly to false"
    - "backend/prisma/seed.ts prints generated passwords to stdout and never contains literal 'admin123' or 'doctor123'"
    - "logAuditEvent and the auditLogger middleware both write to the AuditLog Prisma table (not logger only)"
    - "POST /api/v1/pairing/generate returns { token, shortCode, qrPayload } for a valid patientId"
    - "POST /api/v1/pairing/confirm accepts token OR shortCode, creates WearableDevice, marks token used"
    - "POST /api/v1/pairing/confirm returns 400 for expired or already-used tokens"
    - "DevicePairingModal renders three tabs: QR Code (qrcode canvas), Manual Code (6-digit + countdown), Deep Link (button)"
    - "PatientDetail page has a Connect Device button that opens DevicePairingModal"
  artifacts:
    - path: "src/pilot/pages/PatientDetail.tsx"
      provides: "Real-data patient detail using usePatientDetail hook"
    - path: "backend/src/routes/alerts.ts"
      provides: "Full CRUD alert routes backed by Prisma"
    - path: "src/hooks/usePatientData.ts"
      provides: "VITE_ENABLE_MOCK_DATA default-false guard"
    - path: ".env.pilot"
      provides: "Pilot env file with VITE_ENABLE_MOCK_DATA=false"
    - path: "backend/prisma/seed.ts"
      provides: "Crypto-random generated passwords printed to stdout"
    - path: "backend/src/middleware/audit.ts"
      provides: "AuditLog DB persistence in both middleware and logAuditEvent"
    - path: "backend/prisma/schema.prisma"
      provides: "PairingToken model using WearableType enum (no separate PairingDeviceType)"
    - path: "backend/src/routes/pairing.ts"
      provides: "generate / confirm / status / device delete endpoints; generate has IDOR ownership check for patient-role callers"
    - path: "backend/src/app.ts"
      provides: "pairing router mounted at /api/v1/pairing"
    - path: "src/pilot/components/DevicePairingModal.tsx"
      provides: "Three-tab device pairing modal with QR, manual code, deep link"
    - path: "package.json"
      provides: "qrcode and @types/qrcode added as dependencies"
  key_links:
    - from: "src/pilot/pages/PatientDetail.tsx"
      to: "src/hooks/usePatientData.ts"
      via: "usePatientDetail(patientId)"
      pattern: "usePatientDetail"
    - from: "backend/src/routes/alerts.ts"
      to: "prisma.alert"
      via: "Prisma CRUD methods"
      pattern: "prisma\\.alert\\.(findMany|findUnique|create|update)"
    - from: "backend/src/middleware/audit.ts"
      to: "prisma.auditLog"
      via: "prisma.auditLog.create"
      pattern: "prisma\\.auditLog\\.create"
    - from: "backend/src/routes/pairing.ts"
      to: "prisma.pairingToken"
      via: "Prisma create / findFirst / update"
      pattern: "prisma\\.pairingToken"
    - from: "src/pilot/components/DevicePairingModal.tsx"
      to: "/api/v1/pairing/generate"
      via: "fetch on modal open"
      pattern: "pairing/generate"
    - from: "src/pilot/components/DevicePairingModal.tsx"
      to: "/api/v1/pairing/status"
      via: "setInterval 3000ms polling"
      pattern: "pairing/status"
---

<objective>
Fix 5 pilot deployment blockers and implement the complete device pairing pipeline (backend + frontend).

Purpose: Unblock the pilot from shipping with mock data, hardcoded passwords, missing audit persistence, and missing device pairing flow.

Output:
- PatientDetail pilot page uses real API data
- Alerts API fully backed by Prisma
- Mock data default corrected + .env.pilot created
- Seed passwords generated securely
- Audit logs persisted to DB
- PairingToken schema + backend pairing routes
- DevicePairingModal with QR / manual code / deep link tabs
- "Connect Device" button wired into PatientDetail
</objective>

<execution_context>
@./.claude/get-shit-done/workflows/execute-plan.md
@./.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@.planning/CODEBASE_ANALYSIS.md
</context>

<tasks>

<task type="auto">
  <name>Task 1: Fix 5 Pilot Blockers</name>
  <files>
    src/pilot/pages/PatientDetail.tsx,
    src/hooks/usePatientData.ts,
    .env.pilot,
    backend/prisma/seed.ts,
    backend/src/middleware/audit.ts
  </files>
  <action>
**Blocker 1 — PatientDetail mock imports**

Replace the entire import block in `src/pilot/pages/PatientDetail.tsx`. Remove:
- `import { applyResolvedAlerts, getPatientById, mockPatients } from '@/data/mockPatients';`
- `import { calculateBaseline } from '@/data/mockPatients';`

Add:
```typescript
import { usePatientDetail } from '@/hooks/usePatientData';
```

Replace the `patient` derivation logic (lines that use `useMemo` + `mockPatients`):
```typescript
const { data: patient, isLoading, error } = usePatientDetail(patientId || '');
```

Add a loading/error guard immediately after the hooks section:
```typescript
if (isLoading) {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="text-center"><p className="text-muted-foreground">Loading patient data...</p></div>
    </div>
  );
}
if (error || !patient) {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="text-center">
        <h1 className="text-xl font-semibold mb-2">Patient not found</h1>
        <Button onClick={() => navigate(dashboardPath)}>Return to Dashboard</Button>
      </div>
    </div>
  );
}
```

Remove the old `if (!patient)` guard that was below the hooks.

The `wearableData`, `baseline`, and `delta` calculations below depend on `patient`. They reference `patient.wearableData` which is the mock shape. For the pilot page, replace the wearable card section content with a safe default: check `patient.wearableData?.length > 0` before computing deltas. If the API patient type does not expose `wearableData`, use optional chaining (`patient.wearableData?.[patient.wearableData.length - 1]`) and guard all delta computations behind a `if (latestWearable)` block so they do not throw. The `useAlerts` context call and `resolvedAlertIds` usage can remain — they are context-based and do not import mock data.

**Blocker 3 — VITE_ENABLE_MOCK_DATA default**

In `src/hooks/usePatientData.ts`, change line 14 from:
```typescript
const USE_MOCK = import.meta.env.VITE_ENABLE_MOCK_DATA !== "false";
```
to:
```typescript
const USE_MOCK = import.meta.env.VITE_ENABLE_MOCK_DATA === "true";
```

This means: unless the env var is explicitly set to the string `"true"`, mock data is OFF.

Create `.env.pilot` at the project root with:
```
# Pilot deployment environment — never commit secrets
VITE_ENABLE_MOCK_DATA=false
VITE_API_BASE_URL=http://localhost:8080
```

**Blocker 4 — Hardcoded seed passwords**

In `backend/prisma/seed.ts`:

1. Add `import crypto from 'crypto';` at the top (Node built-in, no install needed).

2. Add a helper:
```typescript
function generatePassword(length = 20): string {
  return crypto.randomBytes(Math.ceil(length * 3 / 4))
    .toString('base64')
    .replace(/[+/=]/g, '')
    .slice(0, length);
}
```

3. Remove the hardcoded `password` field from each entry in `PILOT_USERS`. Instead, generate passwords at runtime in `main()` and pass them in:
```typescript
async function main(): Promise<void> {
  const generatedPasswords: Record<string, string> = {};
  for (const user of PILOT_USERS) {
    generatedPasswords[user.email] = generatePassword();
  }
  const patientPassword = generatePassword();
  // ...
  for (const user of PILOT_USERS) {
    await upsertUser({ ...user, password: generatedPasswords[user.email] }, org.id);
  }
  // ...
  // Replace patient123 in upsertPatient — accept password param
```

4. Update `upsertPatient` signature to accept `password: string` as a second argument instead of hardcoding `'patient123'`. In `main()`, pass `patientPassword`.

5. Replace the `console.log` at the end:
```typescript
console.log('\n=== GENERATED PILOT CREDENTIALS (save these — shown once) ===');
for (const user of PILOT_USERS) {
  console.log(`${user.email}  ${generatedPasswords[user.email]}`);
}
console.log(`patient accounts (all):  ${patientPassword}`);
console.log('=============================================================\n');
```

The `SeedUser` type's `password` field can remain — it is populated at call time now.

**Blocker 5 — Audit log DB persistence**

In `backend/src/middleware/audit.ts`:

1. Add at the top after existing imports:
```typescript
import { prisma } from '../config/database';
```

2. In the `logAuditEvent` function, replace the commented-out line at the end:
```typescript
  // In production, persist to database
  // await prisma.auditLog.create({ data: auditEntry });
```
with:
```typescript
  try {
    await prisma.auditLog.create({
      data: {
        id: auditEntry.id,
        userId: auditEntry.userId ?? null,
        action: auditEntry.action,
        entityType: auditEntry.entityType ?? 'unknown',
        entityId: auditEntry.entityId ?? null,
        oldValues: auditEntry.oldValues ? (auditEntry.oldValues as Record<string, unknown>) : undefined,
        newValues: auditEntry.newValues ? (auditEntry.newValues as Record<string, unknown>) : undefined,
        ipAddress: auditEntry.metadata?.ipAddress ?? null,
        status: auditEntry.status ?? 'success',
        errorMessage: auditEntry.errorMessage ?? null,
      },
    });
  } catch (dbErr) {
    logger.error({ type: 'audit_persist_error', err: dbErr });
  }
```

3. For the `auditLogger` middleware (request/response audit hook, around line 245-252), do the same replacement:
```typescript
    // In production, also write to audit_logs table
    // await prisma.auditLog.create({ data: auditEntry });
```
becomes:
```typescript
    prisma.auditLog.create({
      data: {
        id: auditEntry.id,
        userId: auditEntry.userId ?? null,
        action: auditEntry.action,
        entityType: auditEntry.entityType ?? 'api_request',
        entityId: auditEntry.entityId ?? null,
        ipAddress: auditEntry.metadata?.ipAddress ?? null,
        status: auditEntry.status ?? 'success',
        errorMessage: auditEntry.errorMessage ?? null,
      },
    }).catch((dbErr: unknown) => logger.error({ type: 'audit_persist_error', err: dbErr }));
```
Note: In the middleware path, do NOT await (fire-and-forget to avoid delaying the response). In `logAuditEvent`, await it (already async).
  </action>
  <verify>
    <automated>cd /home/recep/Desktop/Machine_Learning/projects/health_monitor_gp/signal-guide-health && npx tsc --noEmit 2>&1 | head -30 && cd backend && npx tsc --noEmit 2>&1 | head -30</automated>
  </verify>
  <done>
    - PatientDetail has no mockPatients imports; renders loading/error states; calls usePatientDetail
    - usePatientData.ts: USE_MOCK = env === "true" (default false)
    - .env.pilot exists with VITE_ENABLE_MOCK_DATA=false
    - seed.ts: no literal admin123/doctor123; generates passwords with crypto.randomBytes; prints to stdout
    - audit.ts: logAuditEvent awaits prisma.auditLog.create; auditLogger fires-and-forgets the same
    - root tsc --noEmit exits 0; backend tsc --noEmit exits 0
  </done>
</task>

<task type="auto">
  <name>Task 2: Alerts CRUD + PairingToken Schema + Pairing Routes</name>
  <files>
    backend/src/routes/alerts.ts,
    backend/prisma/schema.prisma,
    backend/src/routes/pairing.ts,
    backend/src/app.ts
  </files>
  <action>
**Blocker 2 — Alerts CRUD with Prisma**

Rewrite `backend/src/routes/alerts.ts` fully. Keep the existing Zod schemas and route structure. Add:

```typescript
import { prisma } from '../config/database';
```

Replace each stub handler:

`GET /` — list alerts with optional filters:
```typescript
const page = Math.max(1, Number(req.query.page) || 1);
const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 20));
const where: Record<string, unknown> = {};
if (req.query.patientId) where.patientId = req.query.patientId as string;
if (req.query.severity) where.severity = req.query.severity as string;
if (req.query.resolved !== undefined) where.resolved = req.query.resolved === 'true';

const [alerts, total] = await Promise.all([
  prisma.alert.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    skip: (page - 1) * limit,
    take: limit,
    include: { patient: { select: { id: true, nhsNumber: true, user: { select: { firstName: true, lastName: true } } } } },
  }),
  prisma.alert.count({ where }),
]);
res.json({ status: 'success', data: { alerts, total, page, limit } });
```

`GET /:id` — fetch single alert by id:
```typescript
const alert = await prisma.alert.findUnique({ where: { id }, include: { actions: true } });
if (!alert) { res.status(404).json({ status: 'error', message: 'Alert not found' }); return; }
// ... logAuditEvent call (already present) ...
res.json({ status: 'success', data: { alert } });
```

`POST /` — create alert:
```typescript
const alert = await prisma.alert.create({ data: { ...data, triggerValue: data.triggerValue ?? undefined, thresholdValue: data.thresholdValue ?? undefined } });
// ... logAuditEvent (already present) ...
res.status(201).json({ status: 'success', data: { alert } });
```

`POST /:id/resolve`:
```typescript
const alert = await prisma.alert.findUnique({ where: { id } });
if (!alert) { res.status(404).json({ status: 'error', message: 'Alert not found' }); return; }
const updated = await prisma.alert.update({
  where: { id },
  data: { resolved: true, resolvedAt: new Date(), resolvedById: req.user?.userId ?? null, resolutionNotes: data.resolutionNotes },
});
// ... logAuditEvent ...
res.json({ status: 'success', data: { alert: updated } });
```

`POST /:id/escalate`:
```typescript
const alert = await prisma.alert.findUnique({ where: { id } });
if (!alert) { res.status(404).json({ status: 'error', message: 'Alert not found' }); return; }
const updated = await prisma.alert.update({
  where: { id },
  data: { escalationLevel: alert.escalationLevel + 1, escalatedAt: new Date() },
});
// ... logAuditEvent ...
res.json({ status: 'success', data: { alert: updated } });
```

`POST /:id/acknowledge`:
```typescript
const alert = await prisma.alert.findUnique({ where: { id } });
if (!alert) { res.status(404).json({ status: 'error', message: 'Alert not found' }); return; }
const updated = await prisma.alert.update({
  where: { id },
  data: { acknowledged: true, acknowledgedAt: new Date(), acknowledgedById: req.user?.userId ?? null },
});
res.json({ status: 'success', data: { alert: updated } });
```

Wrap all async handler bodies in try/catch; on catch call `next(err)` (add `next: NextFunction` to each handler signature where missing).

**PairingToken Prisma model**

Add to `backend/prisma/schema.prisma` immediately before the closing of the file (after the last model).

IMPORTANT: Do NOT create a `PairingDeviceType` enum. The `PairingToken.deviceType` field must reuse the existing `WearableType` enum already defined in schema.prisma (used by the `WearableDevice` model). This keeps device type values consistent across the schema and avoids introducing an 'other' value that does not exist on `WearableType`.

First, confirm `WearableType` is already defined (grep for `enum WearableType`). Then add:

```prisma
// =============================================================================
// DEVICE PAIRING
// =============================================================================

model PairingToken {
  id          String        @id @default(uuid())
  patientId   String        @map("patient_id")
  token       String        @unique
  shortCode   String        @map("short_code") // 6-digit numeric string
  expiresAt   DateTime      @map("expires_at")
  usedAt      DateTime?     @map("used_at")
  deviceType  WearableType? @map("device_type")
  createdAt   DateTime      @default(now()) @map("created_at")

  patient Patient @relation(fields: [patientId], references: [id], onDelete: Cascade)

  @@index([token])
  @@index([shortCode])
  @@index([patientId])
  @@map("pairing_tokens")
}
```

Also add `pairingTokens PairingToken[]` to the `Patient` model's relation list (after `dailyStats`).

**Pairing routes**

Create `backend/src/routes/pairing.ts`:

```typescript
/**
 * Device Pairing Routes
 * Generates time-limited tokens for wearable device linking
 */
import { Router, Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import { z } from 'zod';
import { authenticate, requireRole } from '../middleware/auth';
import { prisma } from '../config/database';
import { WearableType } from '@prisma/client';

const router: Router = Router();
router.use(authenticate);

// Use the WearableType enum values for Zod validation — keeps device type consistent with WearableDevice.
// Do NOT introduce a separate PairingDeviceType enum.
const WEARABLE_TYPE_VALUES = Object.values(WearableType) as [WearableType, ...WearableType[]];

const generateSchema = z.object({
  patientId: z.string().uuid(),
  deviceType: z.enum(WEARABLE_TYPE_VALUES).optional(),
});

const confirmSchema = z.object({
  token: z.string().optional(),
  shortCode: z.string().regex(/^\d{6}$/).optional(),
  deviceType: z.enum(WEARABLE_TYPE_VALUES).optional(),
  deviceName: z.string().optional(),
}).refine(d => d.token || d.shortCode, { message: 'token or shortCode required' });

/**
 * POST /pairing/generate
 * Creates a 15-min pairing token + 6-digit short code; returns QR payload.
 * IDOR guard: patient-role callers may only generate tokens for their own patient record.
 */
router.post('/generate', requireRole('doctor', 'nurse', 'admin', 'patient'), async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { patientId, deviceType } = generateSchema.parse(req.body);

    // IDOR ownership check: patients may only pair their own record
    if (req.user?.role === 'patient') {
      const ownRecord = await prisma.patient.findFirst({
        where: { id: patientId, userId: req.user.userId },
      });
      if (!ownRecord) {
        res.status(403).json({ status: 'error', message: 'Forbidden: patient ID does not belong to this user' });
        return;
      }
    }

    const token = crypto.randomBytes(32).toString('hex');
    const shortCode = String(Math.floor(100000 + Math.random() * 900000));
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000);

    await prisma.pairingToken.create({
      data: { patientId, token, shortCode, expiresAt, deviceType: deviceType ?? null },
    });

    const qrPayload = `cardiowatch://pair?token=${token}&pid=${patientId}`;

    res.status(201).json({
      status: 'success',
      data: { token, shortCode, qrPayload, expiresAt },
    });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /pairing/confirm
 * Validates token OR shortCode, creates WearableDevice, marks token used.
 * Returns 400 if token is expired or already used.
 */
router.post('/confirm', requireRole('doctor', 'nurse', 'admin', 'patient'), async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const body = confirmSchema.parse(req.body);
    const now = new Date();

    const pairingToken = await prisma.pairingToken.findFirst({
      where: {
        usedAt: null,
        expiresAt: { gt: now },
        ...(body.token ? { token: body.token } : { shortCode: body.shortCode }),
      },
    });

    if (!pairingToken) {
      res.status(400).json({ status: 'error', message: 'Invalid or expired pairing code' });
      return;
    }

    const deviceType = body.deviceType ?? pairingToken.deviceType ?? WearableType.apple_watch;

    const [device] = await prisma.$transaction([
      prisma.wearableDevice.create({
        data: {
          patientId: pairingToken.patientId,
          deviceType,
          deviceName: body.deviceName ?? 'Paired Device',
          isConnected: true,
          connectionStatus: 'connected',
        },
      }),
      prisma.pairingToken.update({
        where: { id: pairingToken.id },
        data: { usedAt: now },
      }),
    ]);

    res.json({ status: 'success', data: { device } });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /pairing/status/:patientId
 * Returns all connected wearable devices for a patient.
 */
router.get('/status/:patientId', requireRole('doctor', 'nurse', 'admin', 'patient'), async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { patientId } = req.params;
    const devices = await prisma.wearableDevice.findMany({
      where: { patientId, isConnected: true },
      orderBy: { createdAt: 'desc' },
    });
    res.json({ status: 'success', data: { devices } });
  } catch (err) {
    next(err);
  }
});

/**
 * DELETE /pairing/device/:deviceId
 * Unpair (soft-disconnect) a wearable device.
 */
router.delete('/device/:deviceId', requireRole('doctor', 'nurse', 'admin'), async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { deviceId } = req.params;
    const device = await prisma.wearableDevice.findUnique({ where: { id: deviceId } });
    if (!device) { res.status(404).json({ status: 'error', message: 'Device not found' }); return; }
    await prisma.wearableDevice.update({
      where: { id: deviceId },
      data: { isConnected: false, connectionStatus: 'disconnected' },
    });
    res.json({ status: 'success', message: 'Device unpaired' });
  } catch (err) {
    next(err);
  }
});

export default router;
```

**Register pairing router in app.ts**

In `backend/src/app.ts`, add to the route imports section:
```typescript
import pairingRoutes from './routes/pairing';
```

In the `apiRouter.use(...)` section (after the existing route mounts, before the error section):
```typescript
apiRouter.use('/pairing', pairingRoutes);
```
  </action>
  <verify>
    <automated>cd /home/recep/Desktop/Machine_Learning/projects/health_monitor_gp/signal-guide-health/backend && npx tsc --noEmit 2>&1 | head -30</automated>
  </verify>
  <done>
    - alerts.ts: all 6 handlers query/mutate prisma.alert, return real data, propagate errors via next(err)
    - schema.prisma: PairingToken model present with WearableType? for deviceType (no PairingDeviceType enum); Patient model has pairingTokens relation
    - pairing.ts: generateSchema and confirmSchema use z.enum(Object.values(WearableType)); generate handler checks patient ownership for patient-role callers (403 on IDOR); confirm returns 400 for expired/used tokens
    - app.ts: pairingRoutes imported and mounted at /pairing
    - backend tsc --noEmit exits 0
  </done>
</task>

<task type="auto">
  <name>Task 3: DevicePairingModal + Connect Device Button + qrcode package</name>
  <files>
    src/pilot/components/DevicePairingModal.tsx,
    src/pilot/pages/PatientDetail.tsx,
    package.json
  </files>
  <action>
NOTE: This task modifies `src/pilot/pages/PatientDetail.tsx` a second time. Task 1 must complete first — the file at this point already uses `usePatientDetail` and has the loading/error guard in place. The edits here are additive (import + state + JSX only) and do not conflict with Task 1's changes.

**Install qrcode**

In the root `package.json`, add to `"dependencies"`:
```json
"qrcode": "^1.5.4",
"@types/qrcode": "^1.5.5"
```
(Add `@types/qrcode` to `"devDependencies"` instead if preferred — either works.)

After editing package.json, run `npm install` to install them.

**Create DevicePairingModal**

Create `src/pilot/components/DevicePairingModal.tsx`:

```tsx
/**
 * DevicePairingModal
 * Tabs: QR Code | Manual Code | Deep Link
 * Polls /pairing/status every 3s to detect successful pairing.
 */
import { useState, useEffect, useRef } from 'react';
import QRCode from 'qrcode';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Smartphone, QrCode, Hash, Link2, Wifi, CheckCircle2, Loader2, Nfc } from 'lucide-react';
import { toast } from 'sonner';

interface PairingSession {
  token: string;
  shortCode: string;
  qrPayload: string;
  expiresAt: string;
}

interface ConnectedDevice {
  id: string;
  deviceName: string;
  deviceType: string;
  connectionStatus: string;
}

interface DevicePairingModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  patientId: string;
  apiBaseUrl?: string;
}

const PAIRING_TTL_SECONDS = 15 * 60; // 15 minutes

export function DevicePairingModal({ open, onOpenChange, patientId, apiBaseUrl = '' }: DevicePairingModalProps) {
  const [session, setSession] = useState<PairingSession | null>(null);
  const [loading, setLoading] = useState(false);
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [secondsLeft, setSecondsLeft] = useState(PAIRING_TTL_SECONDS);
  const [paired, setPaired] = useState(false);
  const [pairedDevices, setPairedDevices] = useState<ConnectedDevice[]>([]);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Generate pairing session when modal opens
  useEffect(() => {
    if (!open) {
      clearInterval(pollRef.current ?? undefined);
      clearInterval(countdownRef.current ?? undefined);
      setSession(null);
      setQrDataUrl('');
      setPaired(false);
      setSecondsLeft(PAIRING_TTL_SECONDS);
      return;
    }
    void generateSession();
  }, [open, patientId]);

  async function generateSession() {
    setLoading(true);
    try {
      const res = await fetch(`${apiBaseUrl}/api/v1/pairing/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ patientId }),
      });
      const json = await res.json() as { status: string; data: PairingSession };
      if (!res.ok) throw new Error('Failed to generate pairing session');
      const s = json.data;
      setSession(s);

      // Render QR code to data URL
      const dataUrl = await QRCode.toDataURL(s.qrPayload, { width: 240, margin: 2 });
      setQrDataUrl(dataUrl);

      // Countdown timer
      const expiryMs = new Date(s.expiresAt).getTime();
      countdownRef.current = setInterval(() => {
        const remaining = Math.max(0, Math.floor((expiryMs - Date.now()) / 1000));
        setSecondsLeft(remaining);
        if (remaining === 0) clearInterval(countdownRef.current ?? undefined);
      }, 1000);

      // Poll for pairing confirmation
      pollRef.current = setInterval(async () => {
        try {
          const pollRes = await fetch(`${apiBaseUrl}/api/v1/pairing/status/${patientId}`, {
            credentials: 'include',
          });
          const pollJson = await pollRes.json() as { status: string; data: { devices: ConnectedDevice[] } };
          if (pollJson.data.devices.length > 0) {
            setPairedDevices(pollJson.data.devices);
            setPaired(true);
            clearInterval(pollRef.current ?? undefined);
            toast.success('Device paired successfully!');
          }
        } catch {
          // Swallow poll errors silently
        }
      }, 3000);
    } catch {
      toast.error('Could not start pairing session. Try again.');
    } finally {
      setLoading(false);
    }
  }

  const formatCountdown = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m}:${String(sec).padStart(2, '0')}`;
  };

  const openDeepLink = () => {
    if (!session) return;
    window.location.href = session.qrPayload;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Smartphone size={18} className="text-teal-600" />
            Connect Wearable Device
          </DialogTitle>
        </DialogHeader>

        {paired ? (
          <div className="text-center py-6">
            <CheckCircle2 size={48} className="text-green-500 mx-auto mb-3" />
            <p className="text-lg font-semibold text-slate-900">Device Paired!</p>
            <p className="text-sm text-slate-500 mt-1">
              {pairedDevices[0]?.deviceName ?? 'Device'} is now connected.
            </p>
            <Button className="mt-4" onClick={() => onOpenChange(false)}>Done</Button>
          </div>
        ) : loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 size={32} className="animate-spin text-teal-600" />
          </div>
        ) : session ? (
          <Tabs defaultValue="qr">
            <TabsList className="w-full grid grid-cols-3 mb-4">
              <TabsTrigger value="qr" className="flex items-center gap-1.5">
                <QrCode size={14} />
                QR Code
              </TabsTrigger>
              <TabsTrigger value="manual" className="flex items-center gap-1.5">
                <Hash size={14} />
                Manual Code
              </TabsTrigger>
              <TabsTrigger value="deeplink" className="flex items-center gap-1.5">
                <Link2 size={14} />
                Deep Link
              </TabsTrigger>
            </TabsList>

            {/* QR Tab */}
            <TabsContent value="qr" className="text-center">
              <p className="text-sm text-slate-500 mb-4">
                Open the CardioWatch app on the patient's phone and scan this code.
              </p>
              {qrDataUrl ? (
                <img src={qrDataUrl} alt="Pairing QR code" className="mx-auto rounded-xl border-2 border-slate-200" width={240} height={240} />
              ) : (
                <div className="w-60 h-60 mx-auto bg-slate-100 rounded-xl flex items-center justify-center">
                  <Loader2 size={24} className="animate-spin text-slate-400" />
                </div>
              )}
              <p className="text-xs text-slate-400 mt-3">
                Expires in <span className="font-mono font-semibold text-slate-700">{formatCountdown(secondsLeft)}</span>
              </p>

              {/* NFC indicator — informational */}
              <div className="mt-4 flex items-center justify-center gap-2 p-3 rounded-xl bg-blue-50 border border-blue-100">
                <Nfc size={16} className="text-blue-500" />
                <p className="text-xs text-blue-700">Hold phone to device for NFC pairing (if supported)</p>
              </div>
            </TabsContent>

            {/* Manual Code Tab */}
            <TabsContent value="manual" className="text-center">
              <p className="text-sm text-slate-500 mb-4">
                Enter this 6-digit code in the CardioWatch app.
              </p>
              <div className="text-5xl font-mono font-bold tracking-widest text-slate-900 py-4">
                {session.shortCode}
              </div>
              <div className="flex items-center justify-center gap-2 mt-2">
                <Wifi size={14} className="text-amber-500" />
                <p className="text-xs text-slate-400">
                  Expires in <span className="font-mono font-semibold text-slate-700">{formatCountdown(secondsLeft)}</span>
                </p>
              </div>
              <Badge variant="outline" className="mt-4 text-xs bg-amber-50 text-amber-700 border-amber-200">
                Waiting for confirmation...
              </Badge>
            </TabsContent>

            {/* Deep Link Tab */}
            <TabsContent value="deeplink" className="text-center">
              <p className="text-sm text-slate-500 mb-4">
                On a mobile device? Tap the button below to open the CardioWatch app directly.
              </p>
              <Button
                size="lg"
                className="w-full"
                onClick={openDeepLink}
              >
                <Link2 size={16} className="mr-2" />
                Open CardioWatch App
              </Button>
              <p className="text-xs text-slate-400 mt-3 break-all font-mono">{session.qrPayload}</p>
              <p className="text-xs text-slate-400 mt-1">
                Expires in <span className="font-mono font-semibold text-slate-700">{formatCountdown(secondsLeft)}</span>
              </p>

              {/* NFC indicator */}
              <div className="mt-4 flex items-center justify-center gap-2 p-3 rounded-xl bg-blue-50 border border-blue-100">
                <Nfc size={16} className="text-blue-500" />
                <p className="text-xs text-blue-700">Hold phone to device for NFC pairing (if supported)</p>
              </div>
            </TabsContent>
          </Tabs>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
```

**Add Connect Device button to PatientDetail**

In `src/pilot/pages/PatientDetail.tsx` (which already has the Task 1 changes applied — usePatientDetail hook, loading/error guards):

1. Add import:
```typescript
import { DevicePairingModal } from '@/pilot/components/DevicePairingModal';
```

2. Add state near the top of the component function (after hooks):
```typescript
const [pairingOpen, setPairingOpen] = useState(false);
```

3. Add `useState` to the existing `react` import if it isn't already imported (it is imported via `useMemo`).

4. In the action buttons row (the `flex flex-wrap gap-2` div around line 151–164 in the original, now shifted slightly), add a "Connect Device" button:
```tsx
<Button variant="outline" size="sm" onClick={() => setPairingOpen(true)}>
  <Smartphone size={16} className="mr-1.5" />
  Connect Device
</Button>
```
Place it between the "Message" and "Call" buttons (or after "Request Appointment" — either position is fine).

5. Before the closing `</div>` of the returned JSX (just before `</div>` that closes the outer `min-h-screen`), render the modal:
```tsx
<DevicePairingModal
  open={pairingOpen}
  onOpenChange={setPairingOpen}
  patientId={patientId || ''}
/>
```
  </action>
  <verify>
    <automated>cd /home/recep/Desktop/Machine_Learning/projects/health_monitor_gp/signal-guide-health && npx tsc --noEmit 2>&1 | head -30</automated>
  </verify>
  <done>
    - package.json contains qrcode and @types/qrcode
    - DevicePairingModal.tsx exists with QR/Manual/Deep Link tabs, NFC indicator, 3s polling, countdown timer
    - PatientDetail.tsx imports and renders DevicePairingModal; has a Connect Device button in the header actions
    - Root tsc --noEmit exits 0
  </done>
</task>

</tasks>

<verification>
Run the following after all tasks complete:

```bash
# Frontend TypeScript clean
npx tsc --noEmit

# Backend TypeScript clean
cd backend && npx tsc --noEmit

# Verify no mockPatients import in pilot PatientDetail
grep -n "mockPatients" src/pilot/pages/PatientDetail.tsx && echo "FAIL: mock import remains" || echo "PASS: no mock imports"

# Verify USE_MOCK default is false (requires string "true")
grep "USE_MOCK" src/hooks/usePatientData.ts

# Verify seed.ts has no hardcoded passwords
grep -n "admin123\|doctor123\|patient123" backend/prisma/seed.ts && echo "FAIL: hardcoded passwords remain" || echo "PASS: no hardcoded passwords"

# Verify audit DB persist is uncommented
grep -n "prisma.auditLog.create" backend/src/middleware/audit.ts

# Verify no PairingDeviceType enum in schema (should use WearableType instead)
grep -n "PairingDeviceType" backend/prisma/schema.prisma && echo "FAIL: custom enum present — use WearableType" || echo "PASS: no PairingDeviceType enum"

# Verify PairingToken in schema uses WearableType
grep -n "PairingToken\|pairing_tokens\|WearableType" backend/prisma/schema.prisma

# Verify pairing router mounted
grep "pairingRoutes\|/pairing" backend/src/app.ts

# Verify IDOR ownership check is present
grep -n "ownRecord\|userId.*req.user" backend/src/routes/pairing.ts
```
</verification>

<success_criteria>
- Zero TypeScript errors (both root and backend)
- No mockPatients imports in `src/pilot/pages/PatientDetail.tsx`
- `USE_MOCK` in `usePatientData.ts` evaluates to false by default
- `.env.pilot` exists with `VITE_ENABLE_MOCK_DATA=false`
- `backend/prisma/seed.ts` contains no literal strings `admin123`, `doctor123`, or `patient123`
- `backend/src/middleware/audit.ts` calls `prisma.auditLog.create` in both `logAuditEvent` and `auditLogger`
- `PairingToken` model present in `backend/prisma/schema.prisma` with `WearableType?` for deviceType (no `PairingDeviceType` enum)
- `backend/src/routes/pairing.ts` exists with generate/confirm/status/delete endpoints; generate enforces patient-record ownership for patient-role callers (403); confirm returns 400 for expired/used tokens
- `pairing` router registered in `backend/src/app.ts`
- `src/pilot/components/DevicePairingModal.tsx` exists with QR/Manual/Deep Link tabs and NFC indicator section
- `DevicePairingModal` imported and rendered in `src/pilot/pages/PatientDetail.tsx` with Connect Device button
- `qrcode` present in root `package.json` dependencies
</success_criteria>

<output>
After completion, create `.planning/quick/3-fix-5-pilot-blockers-and-build-device-pa/3-SUMMARY.md` with:
- What was implemented (per blocker and per pairing feature)
- Any TypeScript edge cases encountered and how they were resolved
- Files modified with brief description of changes
</output>
