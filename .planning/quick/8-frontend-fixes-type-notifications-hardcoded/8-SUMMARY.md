---
phase: quick-8
plan: "01"
subsystem: frontend
tags: [types, react-query, hardcoding, notifications, admin]
dependency_graph:
  requires: []
  provides: [Patient.whatsappPhone, useAdminStats, live-alerts-bell]
  affects: [src/types/patient.ts, src/hooks/useAdmin.ts, src/pilot/pages/Admin.tsx, src/pilot/components/PilotDashboardHeader.tsx, src/pilot/pages/PatientDetail.tsx]
tech_stack:
  added: []
  patterns: [react-query useQuery, apiClient.get, graceful '--' fallbacks]
key_files:
  modified:
    - src/types/patient.ts
    - src/pilot/pages/PatientDetail.tsx
    - src/hooks/useAdmin.ts
    - src/pilot/pages/Admin.tsx
    - src/pilot/components/PilotDashboardHeader.tsx
decisions:
  - CheckCircle2 import retained in PilotDashboardHeader — still used in empty-state "All caught up" view
  - unreadAlerts prop kept for backward compat but display now driven by liveUnreadCount from API
  - Pre-existing webhookHandler.ts TS2678 error left untouched (out of scope, predates these changes)
metrics:
  duration: "~15 min"
  completed: "2026-03-14"
  tasks_completed: 3
  files_modified: 5
---

# Phase quick-8 Plan 01: Frontend Fixes (Type, Notifications, Hardcoded Data) Summary

**One-liner:** Removed four demo-data hardcodings: added Patient.whatsappPhone type field, wired notifications bell to live GET /alerts, replaced hardcoded clinicianName with patient.consultant, and replaced static usageMetrics object with useAdminStats hook calling GET /admin/stats.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Add whatsappPhone to Patient type and fix PatientDetail type cast | 83c5424 | src/types/patient.ts, src/pilot/pages/PatientDetail.tsx |
| 2 | Add useAdminStats hook and wire Admin.tsx usageMetrics to real API | 69cb3f5 | src/hooks/useAdmin.ts, src/pilot/pages/Admin.tsx |
| 3 | Wire notifications bell to real alerts API | 470bd13 | src/pilot/components/PilotDashboardHeader.tsx |

## Changes by File

### src/types/patient.ts
- Added `whatsappPhone?: string` field to Patient interface after `avatar?` with JSDoc comment

### src/pilot/pages/PatientDetail.tsx
- Removed type cast `(patient as { whatsappPhone?: string }).whatsappPhone` — now accesses `patient.whatsappPhone` directly
- Replaced `const clinicianName = 'Dr. Sarah Mitchell'` with `const clinicianName = patient.consultant ?? '--'`

### src/hooks/useAdmin.ts
- Added `AdminStats` and `AdminStatsResponse` interfaces
- Exported `useAdminStats()` hook: calls `GET /admin/stats`, staleTime 60s

### src/pilot/pages/Admin.tsx
- Updated import to include `useAdminStats`
- Removed module-level hardcoded `const usageMetrics = { dailyActiveUsers: 24, ... }`
- Added `useAdminStats()` call inside component, derives `usageMetrics` from API data with `'--'` fallbacks for all 12 fields

### src/pilot/components/PilotDashboardHeader.tsx
- Added `useQuery` and `apiClient` imports
- Added `ApiAlert` and `AlertsResponse` interfaces
- Added query inside component: `GET /alerts?resolved=false&limit=10`, staleTime 30s, retry false
- Bell badge and unread counter now use `liveUnreadCount` (live alert count from API)
- Replaced three hardcoded pt-001/pt-002/pt-003 buttons with `liveAlerts.map()` dynamic render
- Alert items colored by severity (critical/high = red, otherwise amber), show real patient names and timestamps

## Verification

- `tsc --noEmit` exits 0 errors across all 5 modified files
- No `'Dr. Sarah Mitchell'` in PatientDetail.tsx
- No `dailyActiveUsers: 24` in Admin.tsx
- No `pt-001`/`pt-002`/`pt-003` in PilotDashboardHeader.tsx
- `grep whatsappPhone src/types/patient.ts` confirms field present
- `grep useAdminStats src/hooks/useAdmin.ts` confirms export present

## Deviations from Plan

None — plan executed exactly as written.

## Self-Check: PASSED

- src/types/patient.ts: FOUND (whatsappPhone field at line 166)
- src/hooks/useAdmin.ts: FOUND (useAdminStats export at line 79)
- src/pilot/pages/Admin.tsx: FOUND (useAdminStats import, usageMetrics from stats)
- src/pilot/components/PilotDashboardHeader.tsx: FOUND (liveAlerts.map, no hardcoded pt-00x)
- src/pilot/pages/PatientDetail.tsx: FOUND (patient.consultant ?? '--', no type cast)
- Commits: 83c5424, 69cb3f5, 470bd13 — all present in git log
