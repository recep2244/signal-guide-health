---
phase: quick-3
plan: 3
subsystem: pilot-blockers, device-pairing
tags: [pilot, pairing, alerts, audit, seed, mock-data]
key-files:
  modified:
    - src/pilot/pages/PatientDetail.tsx
    - src/hooks/usePatientData.ts
    - backend/prisma/seed.ts
    - backend/src/middleware/audit.ts
    - backend/src/routes/alerts.ts
    - backend/prisma/schema.prisma
    - backend/src/app.ts
    - package.json
  created:
    - .env.pilot
    - backend/src/routes/pairing.ts
    - src/pilot/components/DevicePairingModal.tsx
decisions:
  - "USE_MOCK changed to === true (explicit opt-in) instead of !== false (explicit opt-out)"
  - "PairingToken.deviceType reuses WearableType enum — no separate PairingDeviceType"
  - "Audit middleware: logAuditEvent awaits DB write; auditLogger fires-and-forgets to avoid response delay"
  - "Baseline HR/HRV/sleep/steps computed inline in PatientDetail from wearableData array (calculateBaseline removed with mockPatients)"
  - "Prisma.InputJsonValue cast used for audit JSON fields (Record<string, unknown> is not directly assignable)"
metrics:
  duration: ~25 min
  completed: 2026-03-13
  tasks: 3
  files: 11
---

# Quick Task 3: Fix 5 Pilot Blockers and Build Device Pairing — Summary

One-liner: Removed all mock data coupling from PatientDetail, secured seed credentials with crypto.randomBytes, wired AuditLog DB persistence, built full Prisma-backed alerts CRUD, added PairingToken schema, and delivered a three-tab DevicePairingModal with QR/manual/deep-link pairing.

## What Was Implemented

### Blocker 1 — PatientDetail mock imports removed
`src/pilot/pages/PatientDetail.tsx` was rewritten to:
- Replace `applyResolvedAlerts / getPatientById / mockPatients / calculateBaseline` imports with `usePatientDetail` from `@/hooks/usePatientData`
- Add `isLoading` and `error` guards before the main render (loading spinner + "Patient not found" fallback)
- Compute HR/HRV/sleep/steps deltas inline from `patient.wearableData` with optional chaining — no throws if `wearableData` is empty or absent
- Render `DevicePairingModal` and a Connect Device button (Task 3 changes applied in the same write)

### Blocker 2 — Alerts CRUD with Prisma
`backend/src/routes/alerts.ts` rewritten: all 6 handlers (`GET /`, `GET /:id`, `POST /`, `POST /:id/resolve`, `POST /:id/escalate`, `POST /:id/acknowledge`) now query and mutate `prisma.alert`. Each handler has a try/catch with `next(err)`. Query params accessed via bracket notation to satisfy TypeScript index signature strictness (`req.query['page']` etc.).

### Blocker 3 — VITE_ENABLE_MOCK_DATA default false
`src/hooks/usePatientData.ts` line 14 changed from `!== "false"` to `=== "true"`. Mock data is now OFF unless explicitly opted in.

`.env.pilot` created at project root with `VITE_ENABLE_MOCK_DATA=false` and `VITE_API_BASE_URL=http://localhost:8080`.

### Blocker 4 — Hardcoded seed passwords
`backend/prisma/seed.ts` updated:
- `import crypto from 'crypto'` added
- `generatePassword(length = 20)` helper using `crypto.randomBytes` added
- `PILOT_USERS` array changed to `Omit<SeedUser, 'password'>[]`
- `main()` generates passwords map and `patientPassword` at runtime; passes them into `upsertUser` and `upsertPatient`
- `upsertPatient` signature updated to accept `password: string` parameter
- Output replaced with structured credential printout to stdout

### Blocker 5 — Audit log DB persistence
`backend/src/middleware/audit.ts` updated:
- `import { prisma } from '../config/database'` and `import { Prisma } from '@prisma/client'` added
- `logAuditEvent`: the commented-out block replaced with `await prisma.auditLog.create(...)` in a try/catch; `Prisma.InputJsonValue` cast used for `oldValues`/`newValues` JSON fields
- `auditLogger` middleware: the commented-out block replaced with fire-and-forget `prisma.auditLog.create(...).catch(...)` to avoid delaying the HTTP response

### Device Pairing Pipeline

**Schema** (`backend/prisma/schema.prisma`):
- `PairingToken` model added with `WearableType?` for `deviceType` (no new enum)
- `Patient.pairingTokens PairingToken[]` relation added
- `npx prisma generate` run to regenerate client

**Backend routes** (`backend/src/routes/pairing.ts`):
- `POST /generate`: creates token + 6-digit shortCode + 15-min expiry; IDOR guard for patient-role callers; returns `{ token, shortCode, qrPayload, expiresAt }`
- `POST /confirm`: finds non-expired, non-used token by token or shortCode; creates `WearableDevice` + marks token `usedAt` in a `$transaction`; returns 400 for invalid/expired codes
- `GET /status/:patientId`: returns connected devices for polling
- `DELETE /device/:deviceId`: soft-disconnect
- Registered at `/api/v1/pairing` in `backend/src/app.ts`

**Frontend** (`src/pilot/components/DevicePairingModal.tsx`):
- Three-tab modal: QR Code (qrcode canvas via `QRCode.toDataURL`), Manual Code (6-digit + 15-min countdown), Deep Link (opens `cardiowatch://` deep link)
- NFC pairing hint shown in QR and Deep Link tabs
- Polls `/api/v1/pairing/status/:patientId` every 3 seconds; shows success state on first connected device
- `DevicePairingModal` imported and rendered in `PatientDetail` with `pairingOpen` state; Connect Device button placed in header actions row

**Package**: `qrcode ^1.5.4` and `@types/qrcode ^1.5.5` added to root `package.json`.

## TypeScript Edge Cases Resolved

1. **Prisma JSON field cast**: `Record<string, unknown>` is not directly assignable to `NullableJsonNullValueInput | InputJsonValue`. Fixed with double cast `as unknown as Prisma.InputJsonValue` after importing `Prisma` from `@prisma/client`.

2. **Index signature property access**: TypeScript strict mode (`noPropertyAccessFromIndexSignature`) requires `req.query['key']` bracket notation instead of `req.query.key` dot notation. Fixed in alerts.ts `GET /` handler.

3. **PILOT_USERS type**: Changed from `SeedUser[]` to `Omit<SeedUser, 'password'>[]` to reflect that passwords are generated at runtime rather than stored in the array literal.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] DevicePairingModal in PatientDetail applied in Task 1 write**
- The plan specified Task 3 would add the modal import, state, and JSX to PatientDetail on top of Task 1 changes.
- Since Task 1 required a full file rewrite (removing all mock imports), the modal code was included in that single write to avoid a second full-file replacement.
- No functional difference — the end state matches the plan spec exactly.

**2. [Rule 1 - Bug] Prisma.InputJsonValue cast for audit JSON fields**
- Found during Task 1: `Record<string, unknown>` is not assignable to `InputJsonValue` in Prisma's generated types.
- Fix: imported `Prisma` namespace from `@prisma/client` and used `as unknown as Prisma.InputJsonValue`.

**3. [Rule 1 - Bug] req.query bracket notation in alerts.ts**
- Found during Task 2: TypeScript index signature error on `req.query.page` etc.
- Fix: changed all query property accesses to bracket notation.

## Self-Check

Files verified present:
- /home/recep/Desktop/Machine_Learning/projects/health_monitor_gp/signal-guide-health/src/pilot/pages/PatientDetail.tsx — FOUND
- /home/recep/Desktop/Machine_Learning/projects/health_monitor_gp/signal-guide-health/src/hooks/usePatientData.ts — FOUND
- /home/recep/Desktop/Machine_Learning/projects/health_monitor_gp/signal-guide-health/.env.pilot — FOUND
- /home/recep/Desktop/Machine_Learning/projects/health_monitor_gp/signal-guide-health/backend/prisma/seed.ts — FOUND
- /home/recep/Desktop/Machine_Learning/projects/health_monitor_gp/signal-guide-health/backend/src/middleware/audit.ts — FOUND
- /home/recep/Desktop/Machine_Learning/projects/health_monitor_gp/signal-guide-health/backend/src/routes/alerts.ts — FOUND
- /home/recep/Desktop/Machine_Learning/projects/health_monitor_gp/signal-guide-health/backend/prisma/schema.prisma — FOUND
- /home/recep/Desktop/Machine_Learning/projects/health_monitor_gp/signal-guide-health/backend/src/routes/pairing.ts — FOUND
- /home/recep/Desktop/Machine_Learning/projects/health_monitor_gp/signal-guide-health/backend/src/app.ts — FOUND
- /home/recep/Desktop/Machine_Learning/projects/health_monitor_gp/signal-guide-health/src/pilot/components/DevicePairingModal.tsx — FOUND

Commits verified: e82e9f1, 2603dfc, e88fa8f

Frontend tsc --noEmit: PASSED (zero errors)
Backend tsc --noEmit: PASSED (zero errors)

## Self-Check: PASSED
