---
phase: 02-dashboard-cardiac-metrics
plan: 02
subsystem: api
tags: [express, prisma, zod, risk-scores, cardiac-metrics, date-fns, vitest]

# Dependency graph
requires:
  - phase: 02-01
    provides: CardiacMetric Prisma model, computeGrace(), computeCha2ds2vasc() functions
provides:
  - GET /patients returns latestReading (wearable vitals), latestCardiacMetric, computedRiskScores per patient
  - GET /patients/:id returns same enriched shape plus full patient relations
  - POST /patients/:id/cardiac-metrics creates CardiacMetric row, returns 201
  - GET /patients/:id/cardiac-metrics returns up to 20 metrics ordered by recordedAt desc
  - cardiacMetricSchema (Zod) exported to shared module with 13 unit tests
affects:
  - 02-03 (frontend types — Patient type now has latestReading, latestCardiacMetric, computedRiskScores)
  - 02-04 (Dashboard.tsx and PatientDetail.tsx field accesses — API shape is now correct)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - Serialiser map after Prisma findMany — coerce Decimal fields with Number(), set raw arrays to undefined
    - cardiacMetricSchema extracted to separate .schema.ts file (shared between route and tests)
    - Cardiac-metric sub-routes placed before /:id wildcard to prevent Express route swallowing
    - PATIENT_UPDATE audit action used for cardiac metric creation (AuditAction union has no CARDIAC_METRIC_RECORD)

key-files:
  created:
    - backend/src/routes/cardiacMetric.schema.ts
    - backend/src/routes/cardiacMetric.schema.test.ts
  modified:
    - backend/src/routes/patients.ts

key-decisions:
  - "cardiacMetricSchema extracted to cardiacMetric.schema.ts — imported by both patients.ts and the test file; avoids duplication"
  - "PATIENT_UPDATE used as audit action for POST /:id/cardiac-metrics — AuditAction union does not include CARDIAC_METRIC_RECORD; adding a new action type is a Rule 4 architectural change, deferred"
  - "prisma generate run as Rule 3 fix — CardiacMetric was added to schema.prisma in plan 01 but client was not regenerated; TypeScript could not resolve cardiacMetrics include until client was regenerated"
  - "patientId cast with id as string in prisma.cardiacMetric.create — Prisma requires string not string|undefined; patient existence is already guarded above"

patterns-established:
  - "Pattern: Serialiser map — after Prisma findMany/findUnique, map raw rows through serialiser that coerces Decimal fields, computes derived fields (latestReading, latestCardiacMetric, computedRiskScores), and sets raw arrays to undefined"
  - "Pattern: Schema module separation — Zod schemas shared between route handler and test file exported from .schema.ts companion file"

requirements-completed: [DASH-01, DASH-02, CARD-01, CARD-02, CARD-03]

# Metrics
duration: 8min
completed: 2026-03-14
---

# Phase 02 Plan 02: Dashboard & Cardiac Metrics — API Extension Summary

**GET /patients and GET /:id enriched with latestReading, latestCardiacMetric, and server-side GRACE/CHA2DS2-VASc risk scores; POST/GET cardiac-metric sub-routes added with Zod validation and 13 passing unit tests**

## Performance

- **Duration:** 8 min
- **Started:** 2026-03-14T05:19:48Z
- **Completed:** 2026-03-14T05:28:02Z
- **Tasks:** 2
- **Files modified:** 3 (patients.ts) / 2 created (schema + test)

## Accomplishments

- GET /patients now includes `latestReading` (wearable vitals with Decimal coercion), `latestCardiacMetric` (or null), and `computedRiskScores` per patient; raw `wearableReadings` and `cardiacMetrics` arrays suppressed from response
- GET /patients/:id applies identical serialiser plus retains all existing includes (user, alerts, wearableDevices, checkIns)
- POST /patients/:id/cardiac-metrics creates a CardiacMetric row with Zod validation; returns 201 on success, 400 on validation failure
- GET /patients/:id/cardiac-metrics returns paginated history (take 20, ordered by recordedAt desc)
- 13 schema unit tests cover ejectionFraction (0-100 boundaries), nyhaClass (1-4 only, integer), and notes (max 1000 chars)

## Task Commits

Each task was committed atomically:

1. **Task 1: Extend GET /patients and GET /:id** - `f5c774e` (feat)
2. **Task 2 RED: Failing schema validation tests** - `713c956` (test)
3. **Task 2 GREEN: cardiacMetricSchema module + cardiac-metric routes** - `b3c3a05` (feat)

_Note: TDD task has two commits (test RED → feat GREEN)_

## Files Created/Modified

- `backend/src/routes/patients.ts` — Added date-fns/riskScores imports; extended GET / and GET /:id includes; added serialiser maps; added POST and GET /:id/cardiac-metrics routes before /:id wildcard
- `backend/src/routes/cardiacMetric.schema.ts` — Exported `cardiacMetricSchema` Zod object with ejectionFraction, nyhaClass, BNP/troponin/creatinine fields
- `backend/src/routes/cardiacMetric.schema.test.ts` — 13 unit tests for schema constraints

## Decisions Made

- **cardiacMetricSchema extracted:** The schema lives in `cardiacMetric.schema.ts` so the route file and test file can both import it without duplication.
- **PATIENT_UPDATE audit action:** `AuditAction` union in `audit.ts` does not include `CARDIAC_METRIC_RECORD`. Adding a new union member is a Rule 4 architectural change (audit type registry is a shared interface); deferred. `PATIENT_UPDATE` is semantically closest.
- **prisma generate as Rule 3 fix:** Plan 01 added the CardiacMetric model to schema.prisma but did not regenerate the Prisma client. TypeScript couldn't resolve `cardiacMetrics` in include blocks. Running `prisma generate` resolved both TS errors.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Regenerated Prisma client after plan 01 schema changes**
- **Found during:** Task 1 (extending GET / include block)
- **Issue:** `cardiacMetrics` property not recognised in Prisma `PatientInclude` — Prisma client had not been regenerated since plan 01 added the CardiacMetric model
- **Fix:** `cd backend && npx prisma generate`
- **Files modified:** backend/node_modules/.prisma/client/* (generated, not committed)
- **Verification:** tsc --noEmit exits 0 after regeneration
- **Committed in:** f5c774e (Task 1 commit — generation output not staged)

**2. [Rule 1 - Bug] Used PATIENT_UPDATE audit action for cardiac metric creation**
- **Found during:** Task 2 GREEN (fixing TS errors)
- **Issue:** `'CARDIAC_METRIC_RECORD'` not in `AuditAction` union type — TypeScript error TS2345
- **Fix:** Replaced with `'PATIENT_UPDATE'` (closest valid action in the union)
- **Files modified:** backend/src/routes/patients.ts
- **Verification:** tsc --noEmit exits 0
- **Committed in:** b3c3a05 (Task 2 GREEN commit)

**3. [Rule 1 - Bug] Cast `id as string` in prisma.cardiacMetric.create**
- **Found during:** Task 2 GREEN (fixing TS errors)
- **Issue:** TypeScript infers `req.params.id` as `string | undefined`; Prisma `patientId` requires `string`
- **Fix:** Used `id as string` — patient existence already guarded by the 404 check above
- **Files modified:** backend/src/routes/patients.ts
- **Verification:** tsc --noEmit exits 0
- **Committed in:** b3c3a05 (Task 2 GREEN commit)

---

**Total deviations:** 3 auto-fixed (1 Rule 3 blocking, 2 Rule 1 bugs)
**Impact on plan:** All fixes essential for TypeScript compilation and correct behaviour. No scope creep. Prisma generate is a standard step after schema changes.

## Issues Encountered

- 3 pre-existing test suite failures (`encryptionService.ts`, `wearableService.ts`, `fitbit.test.ts`) caused by missing `ENCRYPTION_KEY` env var — unrelated to this plan's changes. 86 tests pass. New 13-test suite passes.

## User Setup Required

None — no external service configuration required. The cardiac_metrics table DDL migration SQL was created in plan 01. Apply it with `psql` when a live DB is available.

## Next Phase Readiness

- API shape (`latestReading`, `latestCardiacMetric`, `computedRiskScores`) ready for plan 02-03 (frontend TypeScript types)
- `POST /patients/:id/cardiac-metrics` and `GET /patients/:id/cardiac-metrics` live for plan 02-04 (PatientDetail cardiac metric entry form)
- No blockers for plan 02-03

---
*Phase: 02-dashboard-cardiac-metrics*
*Completed: 2026-03-14*
