---
phase: 02-dashboard-cardiac-metrics
plan: "03"
subsystem: ui
tags: [typescript, react-query, patient-types, cardiac-metrics, mutations]

# Dependency graph
requires:
  - phase: quick/5-fix-ui-quick-wins-admin-real-api-alert-a
    provides: usePatientData hooks pattern and Patient type baseline
provides:
  - LatestReading type (matches WearableReading Prisma model)
  - CardiacMetric type (structured clinical metric record)
  - RecordCardiacMetricRequest input type
  - useRecordCardiacMetric useMutation hook with mock fallback
  - cardiacMetrics query key in patientDataKeys
affects: [02-dashboard-cardiac-metrics, Dashboard, PatientDetail, pilot/PatientDetail]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "CardiacMetric type replaces ejectionFraction+cardiacBiomarkers inline fields on Patient"
    - "LatestReading mirrors Prisma WearableReading shape (nullable optional fields)"
    - "useMutation mock fallback pattern: returns synthetic object when USE_MOCK=true"

key-files:
  created: []
  modified:
    - src/types/patient.ts
    - src/hooks/usePatientData.ts

key-decisions:
  - "wearableData[] removed from Patient type — fetch via usePatientHealthTrends instead"
  - "ejectionFraction and cardiacBiomarkers removed as direct Patient fields — moved into CardiacMetric"
  - "LatestReading uses nullable optional fields to match Prisma WearableReading (not the mock WearableReading shape)"
  - "useRecordCardiacMetric posts to /patients/:id/cardiac-metrics — endpoint to be implemented in Wave 3 backend work"
  - "TypeScript errors in Dashboard/PatientDetail/mockPatients.ts are Wave-3 scope — not fixed here"

patterns-established:
  - "Pattern: CardiacMetric is the single source of truth for all clinician-recorded cardiac values"
  - "Pattern: latestCardiacMetric on Patient is a denormalized snapshot; full history fetched separately"

requirements-completed: []

# Metrics
duration: 3min
completed: 2026-03-14
---

# Phase 02 Plan 03: Dashboard Cardiac Metrics — Type Foundations Summary

**Patient type refactored to use database-aligned LatestReading and CardiacMetric types, replacing mock wearableData array and inline ejectionFraction/cardiacBiomarkers fields; useRecordCardiacMetric mutation hook added**

## Performance

- **Duration:** 3 min
- **Started:** 2026-03-14T05:22:15Z
- **Completed:** 2026-03-14T05:25:00Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments

- `Patient` type cleaned of mock-only fields (`wearableData[]`, `ejectionFraction`, `cardiacBiomarkers`)
- `LatestReading` interface added matching the Prisma `WearableReading` model shape (nullable columns)
- `CardiacMetric` + `RecordCardiacMetricRequest` types added for structured clinical measurements
- `useRecordCardiacMetric` useMutation hook wired with mock fallback (synthetic CardiacMetric) and real API path (`POST /patients/:id/cardiac-metrics`)
- `cardiacMetrics` query key added to `patientDataKeys` map for cache invalidation

## Task Commits

1. **Task 1: Update Patient type** - `6de0341` (feat)
2. **Task 2: Add useRecordCardiacMetric hook** - `2a312f3` (feat)

## Files Created/Modified

- `src/types/patient.ts` — Added LatestReading, CardiacMetric, RecordCardiacMetricRequest interfaces; removed wearableData[], ejectionFraction, cardiacBiomarkers from Patient; riskScores retained
- `src/hooks/usePatientData.ts` — Added CardiacMetric/RecordCardiacMetricRequest imports, cardiacMetrics query key, useRecordCardiacMetric mutation hook

## Decisions Made

- `wearableData[]` removed from `Patient` — the 14-day mock array was never loaded from the API. Real wearable data is fetched via `usePatientHealthTrends`. Removing it forces consumers to use the proper hook.
- `ejectionFraction` and `cardiacBiomarkers` removed as top-level `Patient` fields — both are now captured inside `CardiacMetric`. This decouples the list/detail patient shape from time-varying clinical measurements.
- `LatestReading` uses nullable fields to match the Prisma schema (all wearable columns are optional). The mock `WearableReading` was non-nullable — not compatible with the real schema.
- `useRecordCardiacMetric` includes a mock path returning a synthetic `CardiacMetric` object so the demo mode continues to work before the backend endpoint exists.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None — TypeScript compiles with exit 0 after both changes. Dashboard/PatientDetail consumers reference removed fields but TypeScript does not error due to `strictNullChecks: false` in tsconfig; those files will be fixed in Wave 3.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Types are ready for Wave 3: Dashboard and PatientDetail can be updated to use `latestReading` and `latestCardiacMetric` instead of the removed fields
- Backend needs `POST /patients/:id/cardiac-metrics` route (Wave 3 backend work)
- `mockPatients.ts` still contains `wearableData`, `ejectionFraction`, `cardiacBiomarkers` fields — Wave 3 will update the mock data shape

## Self-Check: PASSED

- FOUND: src/types/patient.ts
- FOUND: src/hooks/usePatientData.ts
- FOUND: .planning/phases/02-dashboard-cardiac-metrics/02-03-SUMMARY.md
- FOUND: commit 6de0341 (feat: Patient type update)
- FOUND: commit 2a312f3 (feat: useRecordCardiacMetric hook)

---
*Phase: 02-dashboard-cardiac-metrics*
*Completed: 2026-03-14*
