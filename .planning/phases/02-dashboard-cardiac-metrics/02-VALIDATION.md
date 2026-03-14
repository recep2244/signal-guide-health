---
phase: 2
slug: dashboard-cardiac-metrics
status: draft
nyquist_compliant: true
wave_0_complete: false
created: 2026-03-14
---

# Phase 2 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest (frontend + backend) |
| **Config file** | `vitest.config.ts` (root) |
| **Quick run command** | `npx vitest run --reporter=dot` |
| **Full suite command** | `npx vitest run` |
| **Estimated runtime** | ~30 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run --reporter=dot`
- **After every plan wave:** Run `npx vitest run`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 02-01-01 | 01 | 1 | CARD-02 | unit | `npx vitest run backend/src/lib/riskScores.test.ts` | ❌ W0 | ⬜ pending |
| 02-01-02 | 01 | 1 | CARD-01 | migration | `npx ts-node -e "require('./backend/src/config/database').prisma.cardiacMetric.count()"` | ❌ W0 | ⬜ pending |
| 02-02-01 | 02 | 2 | DASH-01, DASH-02 | integration | `npx vitest run backend/src/routes/patients.test.ts` | ❌ W0 | ⬜ pending |
| 02-02-02 | 02 | 2 | CARD-01, CARD-02, CARD-03 | integration | `npx vitest run backend/src/routes/patients.test.ts` | ❌ W0 | ⬜ pending |
| 02-03-01 | 03 | 2 | DASH-01, DASH-03 | typecheck | `npx tsc --noEmit` | ✅ | ⬜ pending |
| 02-03-02 | 03 | 2 | CARD-01, CARD-03 | typecheck | `npx tsc --noEmit` | ✅ | ⬜ pending |
| 02-04-01 | 04 | 3 | DASH-01, DASH-02, DASH-03 | unit | `npx vitest run src/pilot/pages/Dashboard.test.tsx` | ❌ W0 | ⬜ pending |
| 02-04-02 | 04 | 3 | CARD-01, CARD-03 | unit | `npx vitest run src/pilot/pages/PatientDetail.test.tsx` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `backend/src/lib/riskScores.ts` — GRACE and CHA2DS2-VASc pure functions (created in Plan 02-01 Task 1)
- [ ] `backend/src/lib/riskScores.test.ts` — unit tests for scoring edge cases (created in Plan 02-01 Task 1 TDD)
- [ ] `backend/prisma/migrations/20260314_add_cardiac_metric/migration.sql` — CardiacMetric table (created in Plan 02-01 Task 2)
- [ ] `backend/src/routes/patients.test.ts` — integration tests for new API shape (created in Plan 02-02)
- [ ] `src/pilot/pages/Dashboard.test.tsx` — unit test for API-driven vitals and graceful nulls (created in Plan 02-04)
- [ ] `src/pilot/pages/PatientDetail.test.tsx` — unit test for cardiac metric form (created in Plan 02-04)

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| GRACE score shows "Insufficient data" when creatinine absent | CARD-02 | Requires seeded patient without creatinine | Load PatientDetail for patient with no creatinine; confirm GRACE shows "Insufficient data" label |
| Cardiac metric form persists across page reload | CARD-01 | Requires live DB | Enter EF=45, BNP=150, submit; reload page; confirm values still displayed |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] Feedback latency < 30s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** approved 2026-03-14
