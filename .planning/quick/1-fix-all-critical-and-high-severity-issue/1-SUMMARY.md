---
phase: 1-fix-all-critical-and-high-severity-issue
plan: 1
subsystem: backend-api, frontend-tests, infrastructure
tags: [bug-fix, patient-api, redis, prisma, nodemailer, whatsapp, testing]
dependency_graph:
  requires: []
  provides:
    - Functional patient CRUD API with real Prisma queries
    - Redis-backed shared rate limiting across replicas
    - Live DB health check in /ready endpoint
    - AdminIntegrationKey Prisma models + migration
    - Password reset email via nodemailer SMTP
    - WhatsApp daily deduplication
    - Passing Dashboard frontend test
  affects:
    - backend/src/routes/patients.ts
    - backend/src/app.ts
    - backend/src/config/redis.ts
    - backend/prisma/schema.prisma
    - backend/src/services/authService.ts
    - backend/src/services/whatsappPilotService.ts
    - src/test/Dashboard.test.tsx
tech_stack:
  added:
    - rate-limit-redis v4 (Redis store for express-rate-limit)
    - nodemailer + @types/nodemailer (SMTP email dispatch)
  patterns:
    - Prisma transaction pattern for multi-table writes
    - Conditional Redis store wiring (REDIS_URL-gated)
    - GDPR soft-delete anonymisation pattern
key_files:
  created:
    - backend/src/config/redis.ts
    - backend/prisma/migrations/20260313203957_add_integration_key_models/migration.sql
  modified:
    - backend/src/routes/patients.ts
    - backend/src/app.ts
    - backend/prisma/schema.prisma
    - backend/src/services/integrationKeyService.ts
    - backend/src/services/authService.ts
    - backend/src/services/whatsappPilotService.ts
    - src/test/Dashboard.test.tsx
decisions:
  - "Used manual migration SQL file instead of prisma migrate dev --create-only (no DB connection available)"
  - "Cast redis.call to typed function signature to satisfy TypeScript spread arg constraint"
  - "Preserved existing $queryRaw pattern in integrationKeyService since those queries are complex and use raw SQL — only removed DDL initializeStorage"
metrics:
  duration: ~6 minutes
  completed: "2026-03-13"
  tasks_completed: 6
  tasks_total: 6
  files_modified: 8
  files_created: 2
---

# Phase 1-fix Plan 1: Fix All Critical and High Severity Issues Summary

**One-liner:** Fixed all 7 pilot blockers: Prisma patient CRUD (10 routes), Redis rate limiter, live DB /ready, AdminIntegrationKey migrations, nodemailer password reset email, WhatsApp daily deduplication, and broken Dashboard test.

## Tasks Completed

| Task | Name | Commit | Status |
|------|------|--------|--------|
| 1 | Implement patient API endpoints with Prisma | 1cf747a | Complete |
| 2 | Fix broken Dashboard test import path | 33c41e3 | Complete |
| 3 | Wire Redis client and fix /ready DB health check | 14a89d0 | Complete |
| 4 | Add AdminIntegrationKey Prisma models and generate migration | 7f08cb9 | Complete |
| 5 | Implement password reset email via nodemailer | 19a38e2 | Complete |
| 6 | Add per-patient daily deduplication to WhatsApp batch | 6a657db | Complete |

## Packages Installed

- `rate-limit-redis@^4.3.1` — Redis store for express-rate-limit v7 (backend/)
- `nodemailer@latest` + `@types/nodemailer` (backend/)

## Migration File Created

`backend/prisma/migrations/20260313203957_add_integration_key_models/migration.sql`

Created manually (no DB connection available for `prisma migrate dev --create-only`). The SQL creates both `admin_integration_keys` and `admin_integration_key_versions` tables with the same schema defined in the Prisma models.

## Verification Results

- `npx tsc --noEmit` (patients.ts, app.ts, redis.ts, authService.ts, whatsappPilotService.ts): All pass with 0 errors
- `npx vitest run src/test/Dashboard.test.tsx`: PASS (Margaret Thompson assertion passes)
- `npx prisma validate`: "The schema at prisma/schema.prisma is valid"
- All patient routes contain real prisma.* calls (20+ lines)
- Redis wiring, checkDatabaseHealth, prisma.$disconnect confirmed present in app.ts
- nodemailer import, sendMail, SMTP references confirmed present in authService.ts
- startOfTodayUtc filter confirmed present in whatsappPilotService.ts

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] TypeScript error in PATCH /patients/:id/triage alert creation**
- **Found during:** Task 1 verification
- **Issue:** `patientId: id` where `id` is `string | undefined` from req.params was rejected by Prisma's strict types
- **Fix:** Added explicit `as string` cast since the route parameter is always a string at runtime, and patient existence is verified before this line
- **Files modified:** backend/src/routes/patients.ts
- **Commit:** 1cf747a

**2. [Rule 1 - Bug] TypeScript error in Redis store sendCommand spread argument**
- **Found during:** Task 3 verification
- **Issue:** `redis!.call(...args)` failed with TS2556 "spread argument must have tuple type"
- **Fix:** Cast redis.call to `(...a: string[]) => Promise<number>` to satisfy TypeScript's strict tuple requirement
- **Files modified:** backend/src/app.ts
- **Commit:** 14a89d0

**3. [Rule 3 - Blocking] No DB connection for prisma migrate dev**
- **Found during:** Task 4
- **Issue:** `prisma migrate dev --create-only` requires a DATABASE_URL to be reachable even with `--create-only`
- **Fix:** Created migration SQL file manually based on the Prisma model definitions (same DDL that Prisma would generate)
- **Files created:** backend/prisma/migrations/20260313203957_add_integration_key_models/migration.sql
- **Commit:** 7f08cb9

## Pre-existing TypeScript Errors (Out of Scope)

The following files have pre-existing TypeScript errors that were not introduced by this plan and were not modified:
- `backend/src/middleware/audit.ts` — 5 type errors (string | undefined args)
- `backend/src/routes/admin.ts` — 1 type error (Record<string, unknown> vs InputJsonValue)
- `backend/src/routes/wearables.ts` — 8 type errors (missing return paths, index signature)
- `backend/src/services/alertService.ts` — 1 type error (possibly undefined)
- `backend/src/services/encryptionService.ts` — 1 type error (Buffer arg)

These are logged here for future remediation but were not touched in this plan.

## Self-Check: PASSED

- FOUND: backend/src/config/redis.ts
- FOUND: backend/prisma/migrations/20260313203957_add_integration_key_models/migration.sql
- FOUND: .planning/quick/1-fix-all-critical-and-high-severity-issue/1-SUMMARY.md
- All 6 commits verified in git log: 1cf747a, 33c41e3, 14a89d0, 7f08cb9, 19a38e2, 6a657db
