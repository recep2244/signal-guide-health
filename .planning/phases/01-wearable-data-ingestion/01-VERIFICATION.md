---
phase: 01-wearable-data-ingestion
verified: 2026-03-14T12:00:00Z
status: passed
score: 4/4 success criteria verified
re_verification:
  previous_status: gaps_found
  previous_score: 2/4
  gaps_closed:
    - "Garmin webhook now calls garminProvider.extractReadingsFromSummary() and wearableService.recordReading() for each daily summary reading"
    - "POST /sync/:deviceId now calls wearableService.syncFromProvider(deviceId) — routes through recordReading() pipeline and fires threshold alerts"
  gaps_remaining: []
  regressions: []
---

# Phase 1: Wearable Data Ingestion Verification Report

**Phase Goal:** Clinicians see real wearable readings — not simulated data — and the system automatically raises alerts when vitals cross thresholds
**Verified:** 2026-03-14
**Status:** passed
**Re-verification:** Yes — after gap closure (2 gaps fixed)

## Goal Achievement

### Observable Truths (from ROADMAP.md Success Criteria)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | A patient's Fitbit heart rate, SpO2, steps, and temperature appear in the dashboard after OAuth authorisation — no simulated data | VERIFIED | fitbit.ts syncHealthDataWithContext() calls wearableService.recordReading() per day per metric. simulateProviderSync() deleted. PKCE verifier stored in Redis. |
| 2 | A patient's Apple HealthKit vitals arrive via the push endpoint and populate the same wearable reading record | VERIFIED | wearables.ts POST /push-data handles HEART_RATE, BLOOD_OXYGEN, BODY_TEMPERATURE, STEP_COUNT, HRV — each calls wearableService.recordReading(). |
| 3 | Garmin Connect and Withings OAuth flows complete and their readings persist identically to Fitbit and Apple; Withings provides BP data | VERIFIED | Garmin: webhooks.ts POST /garmin now looks up WearableDevice by serialNumber, calls garminProvider.extractReadingsFromSummary(), iterates readings, calls wearableService.recordReading() for each (lines 726-750). Withings: syncHealthDataWithContext() persists HR, SpO2, temperature, BLOOD_PRESSURE_SYSTOLIC, BLOOD_PRESSURE_DIASTOLIC via recordReading(). |
| 4 | When a wearable reading exceeds a configured HR, BP, or SpO2 threshold, an Alert record is created automatically and appears in the alerts list without manual intervention | VERIFIED | recordReading() -> analyzeReading() -> createAlert() pipeline fires for all paths: Apple push, Fitbit/Withings context-aware sync, Garmin webhook, and POST /sync/:deviceId (now routes through wearableService.syncFromProvider(deviceId) at line 824). |

**Score:** 4/4 truths verified

---

## Required Artifacts

| Artifact | Expected | Status | Details |
|----------|---------|--------|---------|
| `backend/src/services/wearables/fitbit.ts` | FitbitProvider with syncHealthDataWithContext | VERIFIED | PKCE helpers, exchangeCodeForTokensWithVerifier(), syncHealthDataWithContext() all present. Calls recordReading() per day/metric. |
| `backend/src/services/wearables/withings.ts` | WithingsProvider with BP sync | VERIFIED | action=requesttoken in exchange and refresh. getMeasurements() requests meastypes 9/10/11/54/71. syncHealthDataWithContext() persists BP as BLOOD_PRESSURE_SYSTOLIC + BLOOD_PRESSURE_DIASTOLIC. |
| `backend/src/services/wearables/garmin.ts` | GarminProvider with webhook parsing | VERIFIED | extractReadingsFromSummary() implemented and now called from webhooks.ts route handler. |
| `backend/src/services/wearables/index.ts` | Factory returning fitbit/garmin/withings | VERIFIED | getWearableProvider() switch returns fitbitProvider, garminProvider, withingsProvider. |
| `backend/src/services/wearableService.ts` | syncFromProvider() real; simulateProviderSync deleted | VERIFIED | simulateProviderSync() absent. syncFromProvider() calls syncHealthDataWithContext() via type-cast. |
| `backend/prisma/schema.prisma` | @@unique constraint on wearable_readings | VERIFIED | @@unique([patientId, deviceId, readingDate]) present. |
| `backend/src/routes/wearables.ts` | push-data calls recordReading(); /sync/:deviceId uses syncFromProvider | VERIFIED | push-data: recordReading() called across all metric paths. /sync/:deviceId line 824: wearableService.syncFromProvider(deviceId). |
| `backend/src/routes/webhooks.ts` | Garmin webhook persists readings | VERIFIED | Lines 726-750: device lookup by serialNumber, extractReadingsFromSummary() loop, recordReading() per reading. |
| `backend/src/config/env.ts` | FITBIT_REDIRECT_URI, WITHINGS_* env vars | VERIFIED | All four vars present. |

---

## Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `FitbitProvider.syncHealthDataWithContext()` | `wearableService.recordReading()` | Direct import, called per day per metric | WIRED | Lines 521, 542, 565, 589 in fitbit.ts |
| `WithingsProvider.syncHealthDataWithContext()` | `wearableService.recordReading()` | Direct import, called per measgrp | WIRED | Lines 514, 525, 536, 557, 567 in withings.ts |
| `wearableService.syncFromProvider()` | `fitbitProvider.syncHealthDataWithContext()` | getWearableProvider() + type-cast | WIRED | Lines 507-517 in wearableService.ts |
| `wearableService.recordReading()` | `alertService.createAlert()` | analyzeReading() threshold check | WIRED | Lines 201-220 in wearableService.ts |
| `POST /api/v1/wearables/push-data` | `wearableService.recordReading()` | apple_watch switch in route handler | WIRED | Multiple recordReading() calls confirmed |
| `POST /garmin webhook` | `garminProvider.extractReadingsFromSummary()` | Route handler device lookup + loop | WIRED | webhooks.ts lines 734-748: extractReadingsFromSummary() called per summary, recordReading() called per reading |
| `POST /sync/:deviceId` | `wearableService.syncFromProvider()` | Route handler line 824 | WIRED | wearableService.syncFromProvider(deviceId) — routes through syncHealthDataWithContext() -> recordReading() -> alerts |
| `FitbitProvider.getAuthorizationUrl()` | Redis PKCE verifier | redis.set('pkce:{state}', verifier, 'EX', 600) | WIRED | Lines 201-215 in wearables.ts connect route |

---

## Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| WEAR-01 | 01-01, 01-05 | Fitbit HR, SpO2, steps, temperature via OAuth PKCE | SATISFIED | FitbitProvider.syncHealthDataWithContext() fetches real Fitbit Web API endpoints. BP explicitly omitted per hardware gap. |
| WEAR-02 | 01-04 | Apple HealthKit push endpoint for all metrics | SATISFIED | POST /push-data switch handles all 5 metric types and calls recordReading() for each. |
| WEAR-03 | 01-03, 01-05 | Garmin Connect via OAuth 1.0a | SATISFIED | GarminProvider with OAuth 1.0a signing. webhooks.ts POST /garmin now calls extractReadingsFromSummary() and recordReading() — data reaches WearableReading table. |
| WEAR-04 | 01-02, 01-05 | Withings OAuth2 with BP data | SATISFIED | WithingsProvider persists BP as BLOOD_PRESSURE_SYSTOLIC + BLOOD_PRESSURE_DIASTOLIC via recordReading(). |
| WEAR-05 | 01-05 | Threshold alerts fire automatically | SATISFIED | recordReading() -> analyzeReading() -> createAlert() pipeline wired for all four ingestion paths including the previously bypassed /sync/:deviceId route. |

---

## Anti-Patterns Found

None. Previous blockers resolved:

- `webhooks.ts` Garmin handler: stub comment and empty body replaced with real device lookup, extractReadingsFromSummary() call, and recordReading() loop.
- `wearables.ts` /sync/:deviceId: direct provider.syncHealthData() replaced with wearableService.syncFromProvider(deviceId).

---

## Human Verification Required

### 1. Garmin end-to-end flow

**Test:** Send a POST to /webhooks/garmin with a valid HMAC signature and a dailies payload whose userId maps to a WearableDevice.serialNumber. Confirm a WearableReading row is created and, if the value crosses a threshold, an Alert row is created.
**Expected:** WearableReading row inserted; Alert row inserted if threshold crossed.
**Why human:** Requires a live Garmin webhook payload and a seeded WearableDevice row to trace the full DB write.

### 2. Manual sync alert fire

**Test:** Trigger POST /api/v1/wearables/sync/:deviceId for a Fitbit device whose most recent data contains an HR value above 150 bpm. Confirm an Alert is created.
**Expected:** Alert record created with severity matching threshold config.
**Why human:** Requires a real or mocked Fitbit token and above-threshold data.

---

## Summary

Both previously failing gaps are now closed. All four success criteria are verified.

- **WEAR-01 (Fitbit):** OAuth PKCE flow complete; syncHealthDataWithContext() persists real readings.
- **WEAR-02 (Apple):** Push endpoint handles all metric types via recordReading().
- **WEAR-03 (Garmin):** Webhook handler now calls extractReadingsFromSummary() and recordReading() — no longer a stub.
- **WEAR-04 (Withings):** BP data persisted as BLOOD_PRESSURE_SYSTOLIC/DIASTOLIC.
- **WEAR-05 (Alerts):** recordReading() -> analyzeReading() -> createAlert() pipeline wired for all four ingestion paths including the previously bypassed /sync/:deviceId route.

---

_Verified: 2026-03-14T12:00:00Z_
_Verifier: Claude (gsd-verifier) — re-verification after gap closure_
