---
phase: 02-dashboard-cardiac-metrics
plan: 01
subsystem: database
tags: [prisma, postgresql, cardiac-metrics, grace-score, cha2ds2vasc, date-fns, vitest]

# Dependency graph
requires: []
provides:
  - CardiacMetric Prisma model with all biomarker columns (EF, NYHA, BNP, NT-proBNP, hs-troponin, creatinine, Killip)
  - Manual migration SQL for cardiac_metrics table with FK constraints and index
  - computeGrace() pure function using GRACE 2.0 published ESC lookup tables
  - computeCha2ds2vasc() pure function using ESC 2023 AF Guidelines 9-point scale
affects:
  - 02-02 (patients API — imports computeGrace, computeCha2ds2vasc; uses CardiacMetric include)
  - 02-03 (frontend types — CardiacMetric shape; computedRiskScores envelope)

# Tech tracking
tech-stack:
  added: [date-fns (backend)]
  patterns:
    - Manual migration SQL (no prisma migrate dev — no live DB; follows project pattern)
    - Pure server-side risk scoring — never ship GRACE/CHA2DS2-VASc logic to frontend
    - TDD red-green: write failing test first, implement minimal code to pass

key-files:
  created:
    - backend/prisma/migrations/20260314_add_cardiac_metric/migration.sql
    - backend/src/lib/riskScores.ts
    - backend/src/lib/riskScores.test.ts
  modified:
    - backend/prisma/schema.prisma
    - backend/vitest.config.ts
    - backend/package.json

key-decisions:
  - "date-fns installed as backend dependency (was only in root/frontend); required for differenceInYears in computeCha2ds2vasc"
  - "backend vitest.config.ts include pattern extended to src/**/*.test.ts (was tests/**/*.test.ts only)"
  - "computeGrace returns null not 0 when age is absent — 0 implies low risk, which is clinically dangerous"
  - "Simplified GRACE using age + HR + SBP + optional creatinine; full GRACE (Killip, ST elevation, cardiac arrest) deferred — those fields not reliably available from wearables"

patterns-established:
  - "Pattern: Server-side risk scores — computeGrace/computeCha2ds2vasc called in GET handlers, returned in computedRiskScores envelope"
  - "Pattern: Manual migration SQL — CREATE TABLE with REFERENCES ... ON DELETE CASCADE/SET NULL"
  - "Pattern: GRACE null guard — return null not 0 when minimum inputs absent"

requirements-completed: [CARD-01, CARD-02]

# Metrics
duration: 16min
completed: 2026-03-14
---

# Phase 02 Plan 01: Dashboard & Cardiac Metrics — Schema + Risk Scores Summary

**CardiacMetric Prisma model with biomarker columns, manual migration SQL, and GRACE 2.0 / CHA2DS2-VASc pure functions with 12 passing tests**

## Performance

- **Duration:** 16 min
- **Started:** 2026-03-14T04:36:01Z
- **Completed:** 2026-03-14T04:52:22Z
- **Tasks:** 2
- **Files modified:** 5

## Accomplishments

- CardiacMetric model added to schema.prisma with all planned biomarker columns; `prisma validate` exits 0
- Manual migration SQL creates `cardiac_metrics` table with FK to `patients` (CASCADE) and `users` (SET NULL), plus composite index on `(patient_id, recorded_at)`
- `computeGrace()` implements GRACE 2.0 age/HR/SBP/creatinine lookup tables, returns `null` when age is absent (not 0 — clinical safety requirement)
- `computeCha2ds2vasc()` implements ESC 2023 9-point CHA2DS2-VASc scale with regex-based chronic condition matching
- All 12 unit tests pass; `tsc --noEmit` exits 0

## Task Commits

Each task was committed atomically:

1. **Task 1: Add CardiacMetric model + migration SQL** - `4c16197` (feat)
2. **Task 2 RED: Failing unit tests for risk score functions** - `9179bbd` (test)
3. **Task 2 GREEN: Implement riskScores.ts** - `063bfec` (feat)

_Note: TDD task has two commits (test RED → feat GREEN)_

## Files Created/Modified

- `backend/prisma/schema.prisma` — CardiacMetric model added; Patient and User relations updated
- `backend/prisma/migrations/20260314_add_cardiac_metric/migration.sql` — DDL for cardiac_metrics table
- `backend/src/lib/riskScores.ts` — Pure functions computeGrace() and computeCha2ds2vasc()
- `backend/src/lib/riskScores.test.ts` — 12 unit tests (6 GRACE, 6 CHA2DS2-VASc)
- `backend/vitest.config.ts` — Extended include pattern to cover src/**/*.test.ts
- `backend/package.json` — date-fns added as dependency

## Decisions Made

- **date-fns in backend:** The package was only in the frontend (root node_modules). Added it to `backend/package.json` since the backend test runner resolves from its own node_modules. Rule 3 auto-fix (blocking dependency).
- **vitest config include expanded:** Backend config only covered `tests/**/*.test.ts`; plan places tests at `src/lib/`. Extended include to `src/**/*.test.ts`. Rule 3 auto-fix (blocking).
- **GRACE returns null, not 0:** Returning 0 for missing age would imply "low risk" — a patient safety issue. Returning null lets callers surface "Insufficient data" in UI.
- **Simplified GRACE inputs:** Full GRACE 2.0 requires Killip class, ST-elevation, cardiac arrest markers — not reliably available from wearables. Implemented age + HR + SBP + optional creatinine subset. Noted in RESEARCH.md as recommended approach.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Installed date-fns in backend**
- **Found during:** Task 2 (implementing riskScores.ts)
- **Issue:** date-fns was only in root/frontend node_modules; backend test runner could not resolve it
- **Fix:** `npm install date-fns --save` in backend directory
- **Files modified:** backend/package.json, backend/package-lock.json
- **Verification:** Import resolves, all 12 tests pass
- **Committed in:** 9179bbd (Task 2 RED commit)

**2. [Rule 3 - Blocking] Extended backend vitest include pattern**
- **Found during:** Task 2 (running tests)
- **Issue:** backend/vitest.config.ts only included `tests/**/*.test.ts`; plan places test at `src/lib/riskScores.test.ts`
- **Fix:** Added `src/**/*.test.ts` to the include array
- **Files modified:** backend/vitest.config.ts
- **Verification:** `npx vitest run src/lib/riskScores.test.ts` finds and runs all 12 tests
- **Committed in:** 9179bbd (Task 2 RED commit)

---

**Total deviations:** 2 auto-fixed (both Rule 3 — blocking)
**Impact on plan:** Both fixes essential for test discovery. No scope creep. The test command in PLAN.md runs from root (`cd /path && npx vitest run backend/src/...`) which the root jsdom vitest config cannot pick up; tests must be run from `backend/` directory — this is documented above.

## Issues Encountered

- Root `npx vitest run backend/src/lib/riskScores.test.ts` fails because root vitest config includes only `src/**/*.{test,spec}.{ts,tsx}` (frontend). Tests must be run as `cd backend && npx vitest run src/lib/riskScores.test.ts`. All tests pass when run this way.

## User Setup Required

None - no external service configuration required. Migration SQL is written; apply it with `psql` when a live DB is available.

## Next Phase Readiness

- CardiacMetric model available for Plan 02 to include in `GET /patients/:id` queries
- `computeGrace` and `computeCha2ds2vasc` ready for import in `backend/src/routes/patients.ts`
- No blockers for Plan 02 (cardiac metrics API endpoints + patient list expansion)

---
*Phase: 02-dashboard-cardiac-metrics*
*Completed: 2026-03-14*
