---
phase: "02"
plan: "04"
subsystem: frontend-ui
tags: [dashboard, patient-detail, cardiac-metrics, latestReading, latestCardiacMetric, computedRiskScores, form]
dependency_graph:
  requires: [02-03]
  provides: [dashboard-latestReading, patient-detail-latestCardiacMetric, record-cardiac-metric-form]
  affects: [Dashboard.tsx, PatientDetail.tsx, patient.ts]
tech_stack:
  added: []
  patterns: [useRecordCardiacMetric-mutation, null-safe-field-access, computedRiskScores-fallback]
key_files:
  created: []
  modified:
    - src/types/patient.ts
    - src/pilot/pages/Dashboard.tsx
    - src/pilot/pages/PatientDetail.tsx
decisions:
  - "computedRiskScores fallback pattern: (computedRiskScores?.grace ?? riskScores?.grace) — backend-computed scores preferred, mock scores as fallback"
  - "useRecordCardiacMetric takes {patientId, metric} at mutation time — not curried — form calls mutateAsync({patientId: patient.id, metric: metricInput})"
  - "Record Cardiac Metrics card placed as always-visible standalone card before Care Actions grid, not nested inside conditional cardiac panel"
  - "latestWearable computation replaced with latestReading = patient.latestReading ?? null; deltas set to 0 (no history array available)"
  - "VitalTrends receives [] until a wearable history endpoint exists; wearableData field removed from Patient type"
metrics:
  duration: "13 minutes"
  completed: "2026-03-14T05:43:00Z"
  tasks: 5
  files: 3
---

# Phase 02 Plan 04: Fix Dashboard + PatientDetail Field Access; Add Cardiac Metric Form Summary

**One-liner:** Dashboard and PatientDetail migrated from removed mock fields (wearableData, ejectionFraction, cardiacBiomarkers) to latestReading/latestCardiacMetric with null-safe access and computedRiskScores fallback; Record Cardiac Metrics form added using useRecordCardiacMetric hook.

## Tasks Completed

| # | Task | Commit | Files |
|---|------|--------|-------|
| 0 | Add computedRiskScores to Patient type | 4c2e443 | src/types/patient.ts |
| 1 | Fix Dashboard.tsx (stats + EF + biomarker + risk score panels) | 4c2e443 | src/pilot/pages/Dashboard.tsx |
| 2 | Fix PatientDetail.tsx + add cardiac metric entry form | 4c2e443 | src/pilot/pages/PatientDetail.tsx |

## What Was Built

### Task 0 — computedRiskScores on Patient type
Added `computedRiskScores?: { grace: number | null; cha2ds2vasc: number | null }` to the Patient interface in `src/types/patient.ts`, positioned after the existing `riskScores` field.

### Task 1 — Dashboard.tsx fixes

**Stats block (Fix A):** Replaced the IIFE that computed avgHR/avgHRV/avgSleep from the removed `wearableData[]` with a null-safe version using `latestReading`. Each metric filters to patients with non-null values before averaging. Metric card values display "Not recorded" when no data exists. Color conditions use `(value ?? fallback)` to avoid null comparison issues.

**Ejection Fraction panel (Fix B):** All `p.ejectionFraction` references replaced with `p.latestCardiacMetric?.ejectionFraction`. Filter, sort, and display expressions updated.

**Biomarker Alerts panel (Fix C):** All `p.cardiacBiomarkers` references replaced with `p.latestCardiacMetric`. Filter changed to check `ntProBNP != null || hsTroponinI != null`. Threshold comparisons use `(bio.ntProBNP ?? 0) > 300` pattern.

**Risk Scores panel (Fix D):** Filter and sort use `computedRiskScores || riskScores` fallback pattern. All score access uses `(p.computedRiskScores?.grace ?? p.riskScores?.grace)` throughout.

### Task 2 — PatientDetail.tsx fixes and form

**Fix A (latestWearable removed):** Replaced 18-line `wearableData` computation block with `const latestReading = patient.latestReading ?? null` and zero-value deltas.

**Fix B (vitals display):** All `latestWearable.*` references updated to `latestReading.*` with new field names (`restingHeartRate`, `hrvMs`, `sleepHours`, `steps`) and `?? 0` null guards.

**Fix C (cardiac panel):** Panel condition changed from `patient.ejectionFraction !== undefined` to `patient.latestCardiacMetric != null`. EF block wrapped in `{patient.latestCardiacMetric?.ejectionFraction != null && (...)}`; NT-proBNP and troponin blocks updated to use `latestCardiacMetric` fields. Risk score badges use `computedRiskScores ?? riskScores` fallback. Bloods drawn line uses `latestCardiacMetric?.lastDrawDate`.

**Fix D (VitalTrends):** Both `patient.wearableData ?? []` occurrences replaced with `[]`.

**Fix E (metric form):** Added imports for `useRecordCardiacMetric`, `RecordCardiacMetricRequest`, `NYHAClass`. Added `showMetricForm`, `metricInput`, `recordMetric` state. Added "Record Cardiac Metrics" card as standalone always-visible card before the Care Actions grid, with a 2×2 input grid (EF, NT-proBNP, hs-TnI, NYHA select), Save/Cancel buttons, and error display.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Hook signature mismatch: useRecordCardiacMetric does not accept patientId as argument**

- **Found during:** Task 2, Fix E
- **Issue:** Plan specified `useRecordCardiacMetric(patient.id)` (curried pattern) but the existing hook signature is `useRecordCardiacMetric()` — it takes `{patientId, metric}` at mutation time, not at hook initialization
- **Fix:** Used `useRecordCardiacMetric()` with no argument; form submits `recordMetric.mutateAsync({ patientId: patient.id, metric: metricInput })`
- **Files modified:** src/pilot/pages/PatientDetail.tsx
- **Commit:** 4c2e443

## Self-Check: PASSED

- src/types/patient.ts — FOUND (computedRiskScores field added)
- src/pilot/pages/Dashboard.tsx — FOUND (latestReading, latestCardiacMetric, computedRiskScores used)
- src/pilot/pages/PatientDetail.tsx — FOUND (latestReading, latestCardiacMetric, Record Cardiac Metrics card)
- Commit 4c2e443 — FOUND
- TypeScript: `npx tsc --noEmit` exits 0 — PASSED
