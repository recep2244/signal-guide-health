---
phase: 01-wearable-data-ingestion
plan: 03
subsystem: api
tags: [garmin, oauth-1.0a, webhook, hmac-sha1, hmac-sha256, wearables]

# Dependency graph
requires:
  - phase: 01-wearable-data-ingestion
    provides: WearableProviderInterface, wearableService.recordReading, env.GARMIN_* vars
provides:
  - GarminProvider class with OAuth 1.0a HMAC-SHA1 signing
  - POST /api/v1/wearables/garmin/webhook route for push summaries
  - GET /api/v1/wearables/garmin/oauth-start for async request-token exchange
  - extractReadingsFromSummary mapping HR/steps/SpO2 to typed readings
  - Garmin early-return guard in POST /sync/:deviceId
affects:
  - 01-04 (Samsung, Withings providers follow same pattern)
  - 01-05 (data pipeline uses readings from all providers)

# Tech tracking
tech-stack:
  added: [oauth-1.0a (already in package.json — confirmed used)]
  patterns: [push-provider webhook route, env-var guard for partner approval, TDD with vitest]

key-files:
  created:
    - backend/src/services/wearables/garmin.ts
    - backend/tests/garmin.test.ts
  modified:
    - backend/src/routes/wearables.ts

key-decisions:
  - "getAuthorizationUrl is synchronous per WearableProviderInterface — Garmin OAuth 1.0a async request-token exchange moved to fetchRequestTokenUrl() and /garmin/oauth-start route"
  - "Webhook signature validation skips gracefully when GARMIN_WEBHOOK_SECRET absent (pilot mode) — returns 503 only for missing GARMIN_CONSUMER_KEY"
  - "refreshTokens no-op for OAuth 1.0a — token secret stored as refreshToken for subsequent signing"
  - "GarminDailySummary kept as internal interface in garmin.ts — route uses any cast for the summary parameter"

patterns-established:
  - "Push-provider pattern: webhook route + env-var guard for partner approval + 200 return on unknown userId"
  - "TDD: failing tests committed first, then implementation to green, test file updated for sync API change"

requirements-completed: [WEAR-03]

# Metrics
duration: 6min
completed: 2026-03-14
---

# Phase 1 Plan 03: Garmin Provider Summary

**GarminProvider with OAuth 1.0a HMAC-SHA1 signing and POST /garmin/webhook push-summary ingestion, guarded by GARMIN_CONSUMER_KEY env var for pre-approval deployment**

## Performance

- **Duration:** 6 min
- **Started:** 2026-03-14T02:09:39Z
- **Completed:** 2026-03-14T02:15:20Z
- **Tasks:** 2
- **Files modified:** 3 (garmin.ts created, garmin.test.ts created, wearables.ts modified)

## Accomplishments
- GarminProvider class implementing WearableProviderInterface with full OAuth 1.0a support (oauth-1.0a package, HMAC-SHA1)
- Webhook route POST /garmin/webhook: validates signature, parses payload, persists readings via wearableService.recordReading
- Push model correctly enforced: syncHealthData returns immediately, stub methods throw informative errors, /sync/:deviceId early-returns for Garmin
- 34 vitest tests covering all behavior: signature validation, push model, reading extraction, stub stubs, constructor warning

## Task Commits

Each task was committed atomically:

1. **Task 1 RED: failing garmin tests** - `aa05af3` (test)
2. **Task 1 GREEN: GarminProvider implementation** - `cd28cad` (feat)
3. **Task 2: Garmin webhook route** - `bc85f38` (feat)

## Files Created/Modified
- `backend/src/services/wearables/garmin.ts` - GarminProvider class: OAuth 1.0a, validateWebhook, parseWebhookPayload, extractReadingsFromSummary, push-model syncHealthData
- `backend/tests/garmin.test.ts` - 34 vitest tests covering all GarminProvider behaviors
- `backend/src/routes/wearables.ts` - Added garmin import, POST /garmin/webhook, GET /garmin/oauth-start, Garmin guard in /sync/:deviceId

## Decisions Made
- `getAuthorizationUrl` must be synchronous per `WearableProviderInterface`. Garmin OAuth 1.0a requires an async request-token round-trip before the authorization URL is known. Solution: `getAuthorizationUrl` returns a backend `/garmin/oauth-start?state=...` URL (or placeholder when key absent); the async round-trip is in `fetchRequestTokenUrl()` called by the `/garmin/oauth-start` route.
- OAuth 1.0a has no token expiry in the same sense as OAuth 2.0. The token secret is stored as `refreshToken` for use in subsequent request signing. `refreshTokens()` is a no-op returning the same value.
- Webhook signature skipped (with warning) when `GARMIN_WEBHOOK_SECRET` is absent — prevents blocking pilot deployments before partner credentials arrive.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] getAuthorizationUrl return type mismatch**
- **Found during:** Task 1 (TypeScript compilation verification)
- **Issue:** Plan specified `getAuthorizationUrl` as `async` returning `Promise<string>`, but `WearableProviderInterface` requires synchronous `string` return. TypeScript error TS2416.
- **Fix:** Made `getAuthorizationUrl` synchronous (returns backend oauth-start URL or partner-approval-pending placeholder). Async Garmin request-token fetch moved to new `fetchRequestTokenUrl()` method called from a new GET /garmin/oauth-start route.
- **Files modified:** backend/src/services/wearables/garmin.ts, backend/src/routes/wearables.ts
- **Verification:** `npx tsc --noEmit` exits 0; all 34 tests pass
- **Committed in:** cd28cad (Task 1 GREEN commit)

---

**Total deviations:** 1 auto-fixed (Rule 1 - Bug)
**Impact on plan:** Interface contract maintained. The async OAuth 1.0a logic is preserved in fetchRequestTokenUrl() + route handler. No scope creep.

## Issues Encountered
- vitest `vi.resetModules()` inside `beforeEach` does not hoist `vi.mock()` calls — module-level mock in tests was unreliable after resetModules. Resolved by restructuring tests to use a single top-level `vi.mock` and a `providerWithSecret()` helper for isolated secret testing via field override.

## User Setup Required
None — Garmin credentials are optional; code deploys safely without them (503 guard).

Required env vars when Garmin partner approval arrives:
- `GARMIN_CONSUMER_KEY` — Garmin partner consumer key
- `GARMIN_CONSUMER_SECRET` — Garmin partner consumer secret
- `GARMIN_WEBHOOK_SECRET` — Used for HMAC-SHA256 webhook signature validation

## Next Phase Readiness
- Garmin push pipeline is ready; webhook endpoint live once GARMIN_CONSUMER_KEY is configured
- Pattern established for remaining push-webhook providers (Samsung, Withings in plans 04+)
- All existing tests still pass (113 total)

## Self-Check: PASSED

- FOUND: backend/src/services/wearables/garmin.ts
- FOUND: backend/tests/garmin.test.ts
- FOUND: .planning/phases/01-wearable-data-ingestion/01-03-SUMMARY.md
- FOUND: aa05af3 (test commit)
- FOUND: cd28cad (feat commit GarminProvider)
- FOUND: bc85f38 (feat commit webhook route)

---
*Phase: 01-wearable-data-ingestion*
*Completed: 2026-03-14*
