---
phase: quick
plan: 5
subsystem: admin-ui, patient-detail, backend-admin
tags: [admin, api, react-query, prisma, whatsapp, device-pairing]
dependency_graph:
  requires: []
  provides: [admin-real-data, alert-acknowledge-api, live-sync-modal, contact-whatsapp]
  affects: [Admin.tsx, PatientDetail.tsx, backend/admin routes]
tech_stack:
  added: []
  patterns: [react-query hooks, Prisma paginated queries, optimistic update]
key_files:
  created:
    - src/hooks/useAdmin.ts
  modified:
    - backend/src/routes/admin.ts
    - src/pilot/pages/Admin.tsx
    - src/pilot/pages/PatientDetail.tsx
    - src/pilot/components/DevicePairingModal.tsx
decisions:
  - "Used firstName/lastName from User schema (no name field); rendered as concatenated string in table"
  - "AuditLog orderBy uses createdAt (schema has no timestamp field)"
  - "DevicePairingModal accepts optional initialToken/initialShortCode/initialQrPayload to skip self-generate when pre-fetched"
  - "handleContactPatient casts patient to access whatsappPhone (not in static type); toast fallback if absent"
metrics:
  duration: "~20 minutes"
  completed: "2026-03-13"
  tasks_completed: 3
  files_changed: 5
---

# Quick Task 5: Wire Admin real API data, Acknowledge Alert, Live Sync, Contact Patient

**One-liner:** Real Prisma pagination for admin users/audit-logs; React Query hooks replace mock arrays; PatientDetail buttons call PATCH acknowledge, POST pairing/generate (with modal pre-seed), and wa.me WhatsApp link.

## Tasks Completed

| # | Task | Commit | Files |
|---|------|--------|-------|
| 1 | Wire admin.ts stubs to real Prisma queries | ff9cde7 | backend/src/routes/admin.ts |
| 2 | Create useAdmin.ts hook; update Admin.tsx to use live data | 652f6d7 | src/hooks/useAdmin.ts, src/pilot/pages/Admin.tsx |
| 3 | Wire PatientDetail 3 buttons | e1407ed | src/pilot/pages/PatientDetail.tsx, src/pilot/components/DevicePairingModal.tsx |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] TypeScript TS4111 index signature access in admin.ts**
- **Found during:** Task 1 (first tsc run)
- **Issue:** `req.query.page` and `req.query.limit` use dot notation which TS4111 disallows for index signatures in strict mode
- **Fix:** Changed to bracket notation `req.query['page']`, `req.query['limit']`
- **Files modified:** backend/src/routes/admin.ts
- **Commit:** ff9cde7

**2. [Rule 1 - Bug] Prisma schema field mismatch in admin.ts**
- **Found during:** Task 1 (first tsc run)
- **Issue:** Plan used `name` on User (does not exist — schema has `firstName`/`lastName`) and `timestamp` on AuditLog (does not exist — schema has `createdAt`)
- **Fix:** Switched select to `{ firstName, lastName }` and orderBy to `{ createdAt: 'desc' }`
- **Files modified:** backend/src/routes/admin.ts
- **Commit:** ff9cde7

**3. [Rule 2 - Missing functionality] DevicePairingModal needed new props for pre-seeded session**
- **Found during:** Task 3
- **Issue:** Plan required PatientDetail to pass `initialToken/initialShortCode/initialQrPayload` to DevicePairingModal, but the component's Props interface did not accept them
- **Fix:** Added three optional props to DevicePairingModalProps interface; added early-return branch in useEffect to use pre-fetched session data (skipping redundant generateSession call)
- **Files modified:** src/pilot/components/DevicePairingModal.tsx
- **Commit:** e1407ed

## Verification

- `cd backend && npx tsc --noEmit` — zero errors
- `npx tsc --noEmit` at root — zero errors

## Self-Check: PASSED

Files exist:
- src/hooks/useAdmin.ts: FOUND
- src/pilot/pages/Admin.tsx: FOUND (modified)
- src/pilot/pages/PatientDetail.tsx: FOUND (modified)
- src/pilot/components/DevicePairingModal.tsx: FOUND (modified)
- backend/src/routes/admin.ts: FOUND (modified)

Commits exist: ff9cde7, 652f6d7, e1407ed — all verified in git log.
