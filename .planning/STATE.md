# Project State

**Project:** CardioWatch / Signal Guide Health
**Last activity:** 2026-03-14 - Completed quick task 7: Replace doctors.ts, appointments.ts, admin /stats stubs with real Prisma queries (8 routes)

## Current Phase

Phase 1: Bug Fixes & Infrastructure Hardening (Quick tasks complete)

## Blockers/Concerns

All blockers from quick tasks 1 and 2 resolved:

- [DONE] Patient API endpoints implemented with Prisma queries (10 routes)
- [DONE] Dashboard.test.tsx import fixed to src/demo/pages/Dashboard
- [DONE] Redis wired to rate limiter; in-memory fallback when REDIS_URL not set
- [DONE] /ready DB health check calls checkDatabaseHealth() — returns 503 on failure
- [DONE] AdminIntegrationKey Prisma models added; initializeStorage() DDL removed
- [DONE] Password reset email dispatched via nodemailer when SMTP_* vars set
- [DONE] WhatsApp scheduler filters out patients already checked in today (UTC)
- [DONE] TypeScript: tsc --noEmit exits 0, zero errors across all backend files

## Decisions

- Rate-limit-redis v4 chosen (express-rate-limit v7 compatible)
- Migration SQL file created manually (no DB connection available for prisma migrate dev)
- GDPR soft-delete pattern used for patient deletion (email anonymisation)
- wearableService.ts: ReadingType defined as local union type (not Prisma client export)
- wearableService.ts: WearableReading flat schema — mapReadingToColumns() maps reading types to named metric columns
- TS7030 in wearables.ts: split return res.status().json() into two-statement form (compatible with TypeScript 5.9)
- alertService.createMailTransport duplicated per-service (not shared util) — keeps each service self-contained
- TS18048 non-null assertion on severityOrder array access bounded by index < 3 guard
- req.params['id'] bracket notation used in route files to satisfy TS4111 (index signature access)
- Appointment GET / scopes by role: doctor/patient userId lookup injects where.doctorId/where.patientId
- Promise.all for parallel Prisma count queries in admin /stats handler

## Session

**Stopped at:** Completed quick/7-backend-stubs-implement-doctors-routes-a — 3/3 tasks, verified

### Quick Tasks Completed

| # | Description | Date | Commit | Status | Directory |
|---|-------------|------|--------|--------|-----------|
| 1 | Fix all critical and high severity issues: patient API stubs, broken test, Redis rate limiting, DB health check, Prisma migrations, password reset, WhatsApp deduplication | 2026-03-13 | 6a657db | Verified | [1-fix-all-critical-and-high-severity-issue](./quick/1-fix-all-critical-and-high-severity-issue/) |
| 2 | Fix all remaining pre-existing TypeScript errors: audit.ts, admin.ts, wearables.ts, alertService.ts, encryptionService.ts, patientService.ts, wearableService.ts (schema realignment), appleHealthKit.ts, googleFit.ts, healthConnect.ts | 2026-03-13 | b948026 | Verified | [2-fix-all-remaining-pre-existing-typescrip](./quick/2-fix-all-remaining-pre-existing-typescrip/) |
| 3 | Fix 5 pilot blockers (mock data, alerts stubs, seed passwords, audit persistence, mock default) + device pairing pipeline (QR code, manual 6-digit, deep link, NFC hint) | 2026-03-13 | e88fa8f | Verified | [3-fix-5-pilot-blockers-and-build-device-pa](./quick/3-fix-5-pilot-blockers-and-build-device-pa/) |
| 4 | Complete remaining pilot gaps: sendWhatsAppMessage public API, analyzeWellbeingResponse + escalation wiring, 3 clinical endpoints (overview/patients/trend), GDPR cascade delete, Playwright E2E suite | 2026-03-13 | a266e51 | Verified | [4-complete-remaining-pilot-gaps-whatsapp-s](./quick/4-complete-remaining-pilot-gaps-whatsapp-s/) |
| 5 | Wire Admin real API data (users/audit-logs Prisma queries), useAdmin.ts React Query hooks, PatientDetail Acknowledge Alert/Live Sync/Contact Patient buttons | 2026-03-13 | e1407ed | Verified | [5-fix-ui-quick-wins-admin-real-api-alert-a](./quick/5-fix-ui-quick-wins-admin-real-api-alert-a/) |
| 6 | Alert notification emails (createAlert + escalateAlert nodemailer, SMTP-gated, fire-and-forget); remove 7 obsolete src/pages stubs; commit VITE_API_BASE_URL=/api/v1 | 2026-03-13 | 82c8c94 | Verified | [6-alert-notifications-cleanup-old-src-page](./quick/6-alert-notifications-cleanup-old-src-page/) |
| 7 | Replace doctors.ts, appointments.ts, admin /stats stubs with real Prisma queries (8 routes: doctor list/detail/patients/schedule, appointment CRUD + cancel/confirm, admin stats counts) | 2026-03-14 | 5d5f72f | Verified | [7-backend-stubs-implement-doctors-routes-a](./quick/7-backend-stubs-implement-doctors-routes-a/) |
