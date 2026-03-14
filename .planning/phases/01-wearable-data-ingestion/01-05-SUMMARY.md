---
phase: 01-wearable-data-ingestion
plan: 05
subsystem: wearables
tags: [fitbit, withings, garmin, oauth, pkce, redis, sync, alerts]
dependency_graph:
  requires:
    - "01-01 (FitbitProvider)"
    - "01-02 (WithingsProvider)"
    - "01-03 (GarminProvider)"
    - "01-04 (Apple push handler)"
  provides:
    - "Complete pull-sync pipeline: syncFromProvider() calls real providers"
    - "Alert pipeline fires on every real reading via recordReading()"
    - "PKCE verifier persisted in Redis for multi-instance Fitbit auth"
  affects:
    - "backend/src/services/wearables/index.ts"
    - "backend/src/services/wearableService.ts"
    - "backend/src/routes/wearables.ts"
    - "backend/src/services/wearables/fitbit.ts"
    - "backend/src/services/wearables/withings.ts"
tech_stack:
  added: []
  patterns:
    - "syncHealthDataWithContext pattern: provider fetches + persists via wearableService"
    - "PKCE Redis key: pkce:{state} with 10-minute TTL, single-use"
    - "Bracket notation required for Record<string,number> index access (TS4111)"
key_files:
  created: []
  modified:
    - backend/src/services/wearables/index.ts
    - backend/src/services/wearableService.ts
    - backend/src/services/wearableService.ts (WearableReading.readingDate added)
    - backend/src/routes/wearables.ts
    - backend/src/services/wearables/fitbit.ts
    - backend/src/services/wearables/withings.ts
decisions:
  - "syncHealthDataWithContext added to Fitbit/Withings providers; interface-level syncHealthData kept for compliance"
  - "WearableReading.readingDate: optional Date field added so providers can pass the actual measurement date"
  - "Record<string,number> counters use bracket notation + (val??0)+1 pattern to satisfy TS noUncheckedIndexedAccess"
  - "Redis PKCE key is single-use: deleted on first callback retrieval"
  - "Garmin excluded from pull sync — push-only via webhook"
metrics:
  duration: "~25 minutes"
  completed: "2026-03-14"
  tasks_completed: 2
  tasks_total: 2
  files_modified: 5
---

# Phase 01 Plan 05: Wire Provider Factory + Real Sync Summary

**One-liner:** Real provider wiring via syncHealthDataWithContext pattern + Fitbit PKCE verifier persisted in Redis with 10-minute TTL.

## What Was Built

### Task 1: Provider factory + real syncFromProvider()

**backend/src/services/wearables/index.ts**
- Imports and exports `fitbitProvider`, `garminProvider`, `withingsProvider`
- `getWearableProvider()` now returns real instances for fitbit/garmin/withings; no longer throws
- Samsung still throws as not-yet-implemented

**backend/src/services/wearableService.ts**
- `simulateProviderSync()` method deleted entirely
- `syncFromProvider()` rewired to call `getWearableProvider()` and invoke `syncHealthDataWithContext()` when available; falls back to `syncHealthData()` for other OAuth providers
- Garmin and push-based devices return `{ synced: 0 }` immediately (correct — they are push-only)
- `WearableReading` interface gains optional `readingDate?: Date` field
- `recordReading()` uses `reading.readingDate ?? new Date()` so historical data is stored with the correct date

**backend/src/services/wearables/fitbit.ts**
- `syncHealthDataWithContext(accessToken, since, patientId, wearableId)` added
- Fetches HR, SpO2, temperature, steps day-by-day and calls `wearableService.recordReading()` per reading
- Each reading row gets the actual date (not insertion time)
- Alert pipeline fires automatically via `recordReading()` → `analyzeReading()` → `createAlert()`

**backend/src/services/wearables/withings.ts**
- `syncHealthDataWithContext(accessToken, since, patientId, wearableId)` added
- Fetches all measurement groups and calls `recordReading()` for HR, SpO2, temperature, systolic BP, diastolic BP
- BP written as two separate rows (flat schema: BLOOD_PRESSURE_SYSTOLIC + BLOOD_PRESSURE_DIASTOLIC)

### Task 2: PKCE code_verifier Redis storage

**backend/src/routes/wearables.ts**
- `redis` imported from `../config/redis`
- `WearableAuthResult` type imported for explicit callback result typing
- **POST /connect/:provider:** after `getAuthorizationUrl(state)`, calls `fitbitProv.getCodeVerifier(state)` and stores it in Redis as `pkce:{state}` with 10-minute TTL; logs warning if Redis unavailable
- **POST /callback/:provider:** retrieves verifier from Redis (`redis.get('pkce:{state}')`), deletes key on retrieval, falls back to in-memory `getCodeVerifier()` if Redis unavailable; calls `exchangeCodeForTokensWithVerifier(code, verifier)` for Fitbit; all other providers use standard `exchangeCodeForTokens(code)`

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] WearableReading missing readingDate field**
- **Found during:** Task 1 — adding syncHealthDataWithContext which passes per-day dates
- **Issue:** `recordReading()` hardcoded `readingDate: new Date()` — all historical synced data would be stamped with sync time not measurement time
- **Fix:** Added `readingDate?: Date` to `WearableReading` interface; `recordReading()` uses `reading.readingDate ?? new Date()`
- **Files modified:** `backend/src/services/wearableService.ts`
- **Commit:** 7a29b03

**2. [Rule 3 - Blocking] TS4111 + TS2532 on Record<string,number> index access**
- **Found during:** Task 1 TypeScript compile check
- **Issue:** `counts['heartRate']++` raised TS2532 (possibly undefined) then TS4111 (must use bracket notation for index signatures)
- **Fix:** Replaced `++` with `counts['key'] = (counts['key'] ?? 0) + 1` pattern throughout fitbit.ts and withings.ts
- **Files modified:** `fitbit.ts`, `withings.ts`
- **Commit:** 7a29b03

## Self-Check

- [x] `simulateProviderSync` not present in wearableService.ts: `NOT FOUND - correctly deleted`
- [x] `getWearableProvider` returns fitbitProvider at index.ts line 35, garminProvider at line 37, withingsProvider at line 39
- [x] `syncHealthDataWithContext` present in fitbit.ts and withings.ts
- [x] PKCE Redis store in connect route + retrieval in callback route
- [x] TypeScript compiles with zero errors

## Self-Check: PASSED
