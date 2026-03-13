---
phase: quick
plan: 4
subsystem: pilot-services
tags: [whatsapp, llm, clinical, gdpr, e2e, playwright]
key-files:
  modified:
    - backend/src/services/localLlmService.ts
    - backend/src/services/whatsappPilotService.ts
    - backend/src/routes/clinical.ts
    - backend/src/routes/patients.ts
    - package.json
  created:
    - playwright.config.ts
    - tests/e2e/auth.spec.ts
    - tests/e2e/patient-alert.spec.ts
    - tests/e2e/device-pairing.spec.ts
decisions:
  - "analyzeWellbeingResponse added to LocalLlmService as public method, reuses existing chatJson/normalizeTriage helpers"
  - "sendWhatsAppMessage is a thin public wrapper over private sendTextMessage with normalizePhone"
  - "Playwright installed without --with-deps (sudo not available); chromium binary downloaded successfully"
  - "GDPR cascade uses explicit deleteMany inside transaction for order-control; cascade-annotated models handled automatically by Prisma"
metrics:
  duration: ~8 minutes
  completed: 2026-03-13
  tasks: 3
  files: 8
---

# Quick Task 4: Complete Remaining Pilot Gaps Summary

One-liner: WhatsApp public API + LLM wellbeing analysis + 3 clinical endpoints + GDPR cascade delete + Playwright E2E suite with 3 spec files.

## What Was Implemented

### Task 1: WhatsApp + LLM Service Additions

**localLlmService.ts** — added `analyzeWellbeingResponse(text)` public method:
- Calls `chatJson` with a clinician-facing system prompt requesting `{level, summary, escalate}` JSON
- Returns `{ level: 'green'|'amber'|'red', summary: string (max 200 chars), escalate: boolean }` or `null`
- Reuses existing `normalizeTriage` helper for level validation

**whatsappPilotService.ts** — two additions:
1. `sendWhatsAppMessage(phone, message)` public method: thin wrapper over private `sendTextMessage` with `normalizePhone` normalization
2. Wired `analyzeWellbeingResponse` into medications step completion: builds a context string from wellbeing score, symptoms, medications and calls the LLM; logs a warning when `escalate=true` and triage is `red`

### Task 2: Three Clinical Endpoints

All three routes added to `clinical.ts` before `export default router`:

- `GET /overview` — parallel queries for totalPatients, redTriage count, amberTriage count, today's unresolved alerts, and avg heart rate across wearable readings; respects `getScopedPatientIds` scoping
- `GET /patients` — returns up to 300 patients (default 100) with id, name, triageLevel, lastCheckIn, wearableCount (connected devices only); ordered by triage severity then lastCheckIn ascending
- `GET /patient/:id/trend` — fetches 7-day WearableReadings for one patient, aggregates by day into avgHeartRate, steps, bloodOxygenPercent; enforces scope access control

### Task 3: GDPR Cascade + Playwright

**patients.ts DELETE** — added four `deleteMany` operations inside the existing `prisma.$transaction` array before the soft-delete operations:
- `prisma.alert.deleteMany({ where: { patientId: id } })`
- `prisma.wearableReading.deleteMany({ where: { patientId: id } })`
- `prisma.wearableDevice.deleteMany({ where: { patientId: id } })`
- `prisma.pairingToken.deleteMany({ where: { patientId: id } })`

**Playwright setup:**
- `@playwright/test` installed as devDependency
- Chromium browser binary downloaded (~111 MB)
- `test:e2e` script added to root `package.json`
- `playwright.config.ts` at project root: single chromium project, `testDir=./tests/e2e`, `baseURL` from `BASE_URL` env (default `http://localhost:8081`), headless, list reporter

**E2E spec files:**
- `tests/e2e/auth.spec.ts` — login with pilot credentials, verify dashboard loads, logout
- `tests/e2e/patient-alert.spec.ts` — login, navigate to first patient, acknowledge first alert (graceful skip if no alerts)
- `tests/e2e/device-pairing.spec.ts` — login, navigate to first patient, open device pairing modal, verify QR/Manual/DeepLink tabs

## TypeScript Issues Encountered

None. `cd backend && npx tsc --noEmit` and root `npx tsc --noEmit` both exited 0 after each task.

## Deviations from Plan

**Playwright --with-deps flag**: `npx playwright install chromium --with-deps` failed because it requires sudo. Ran `npx playwright install chromium` instead which successfully downloaded the Chromium binary. System-level dependencies (libnss3 etc.) must be installed separately on this machine if not already present. Tracked as Rule 3 auto-fix (blocking issue resolved).

## Self-Check: PASSED

- `backend/src/services/localLlmService.ts` — analyzeWellbeingResponse method present
- `backend/src/services/whatsappPilotService.ts` — sendWhatsAppMessage public method present
- `backend/src/routes/clinical.ts` — GET /overview, /patients, /patient/:id/trend present
- `backend/src/routes/patients.ts` — prisma.alert.deleteMany inside transaction present
- `playwright.config.ts` — exists at project root
- `tests/e2e/auth.spec.ts`, `patient-alert.spec.ts`, `device-pairing.spec.ts` — all present
- Commits: ff104f6, 00308dd, a266e51
