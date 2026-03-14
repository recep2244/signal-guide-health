# Project State

**Project:** CardioWatch / Signal Guide Health
**Last activity:** 2026-03-14 - Completed phase 01 plan 04: Wire all Apple HealthKit push metrics to wearableService.recordReading()

## Current Phase

Phase 01: Wearable Data Ingestion (plan 04 of 5 complete)

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
- 01-04: Aggregate HealthKit samples to one WearableReading row per push batch (flat schema requirement)
- 01-04: Apple Watch BP intentionally omitted — hardware gap, no BP sensor on any Apple Watch model
- 01-04: Health Connect BP not yet wired — HR/SpO2/steps/HRV added for Health Connect path (matches Apple Watch scope)

## Session

**Stopped at:** Completed 01-wearable-data-ingestion/01-04 — 1/1 tasks, WEAR-02 satisfied

### Quick Tasks Completed

| # | Description | Date | Commit | Status | Directory |
|---|-------------|------|--------|--------|-----------|
| 1 | Fix all critical and high severity issues: patient API stubs, broken test, Redis rate limiting, DB health check, Prisma migrations, password reset, WhatsApp deduplication | 2026-03-13 | 6a657db | Verified | [1-fix-all-critical-and-high-severity-issue](./quick/1-fix-all-critical-and-high-severity-issue/) |
| 2 | Fix all remaining pre-existing TypeScript errors: audit.ts, admin.ts, wearables.ts, alertService.ts, encryptionService.ts, patientService.ts, wearableService.ts (schema realignment), appleHealthKit.ts, googleFit.ts, healthConnect.ts | 2026-03-13 | b948026 | Verified | [2-fix-all-remaining-pre-existing-typescrip](./quick/2-fix-all-remaining-pre-existing-typescrip/) |
| 3 | Fix 5 pilot blockers (mock data, alerts stubs, seed passwords, audit persistence, mock default) + device pairing pipeline (QR code, manual 6-digit, deep link, NFC hint) | 2026-03-13 | e88fa8f | Verified | [3-fix-5-pilot-blockers-and-build-device-pa](./quick/3-fix-5-pilot-blockers-and-build-device-pa/) |
| 4 | Complete remaining pilot gaps: sendWhatsAppMessage public API, analyzeWellbeingResponse + escalation wiring, 3 clinical endpoints (overview/patients/trend), GDPR cascade delete, Playwright E2E suite | 2026-03-13 | a266e51 | Verified | [4-complete-remaining-pilot-gaps-whatsapp-s](./quick/4-complete-remaining-pilot-gaps-whatsapp-s/) |
| 5 | Wire Admin real API data (users/audit-logs Prisma queries), useAdmin.ts React Query hooks, PatientDetail Acknowledge Alert/Live Sync/Contact Patient buttons | 2026-03-13 | e1407ed | Verified | [5-fix-ui-quick-wins-admin-real-api-alert-a](./quick/5-fix-ui-quick-wins-admin-real-api-alert-a/) |
