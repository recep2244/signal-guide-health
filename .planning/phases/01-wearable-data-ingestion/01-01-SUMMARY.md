---
phase: 01-wearable-data-ingestion
plan: "01"
subsystem: api
tags: [fitbit, oauth2, pkce, wearables, prisma, typescript]

requires: []

provides:
  - FitbitProvider class implementing WearableProviderInterface (OAuth 2.0 PKCE + data sync)
  - WearableReading DB unique constraint preventing duplicate rows per (patientId, deviceId, readingDate)
  - oauth-1.0a npm package installed (for Plan 03 Garmin)
  - env.ts: FITBIT_REDIRECT_URI, WITHINGS_CLIENT_ID/SECRET/REDIRECT_URI added

affects:
  - 01-02-withings
  - 01-03-garmin
  - 01-05-wearable-data-pipeline

tech-stack:
  added: [oauth-1.0a@2.2.6]
  patterns:
    - "PKCE: generate verifier per OAuth state, challenge = SHA-256(verifier) base64url encoded"
    - "Fitbit REST pull: per-day fetch loop for HR/SpO2/temperature/steps using Bearer token"
    - "BP hardware gap: explicitly skipped at code level with comment referencing WEAR-01"

key-files:
  created:
    - backend/src/services/wearables/fitbit.ts
    - backend/tests/fitbit.test.ts
  modified:
    - backend/prisma/schema.prisma
    - backend/src/config/env.ts
    - backend/package.json

key-decisions:
  - "PKCE verifier stored in in-memory Map keyed by state for single-instance dev; route layer uses Redis in production"
  - "exchangeCodeForTokensWithVerifier() added as separate method to avoid breaking WearableProviderInterface signature"
  - "Temperature stored as nightlyRelative (skin offset from baseline), not absolute body temp — Fitbit limitation"
  - "syncHealthData uses day-by-day loop (Fitbit 24h intraday limit); no batch endpoint available"
  - "@types/oauth-1.0a does not exist on npm — oauth-1.0a ships its own types, --save-dev install skipped"

patterns-established:
  - "TDD for all wearable providers: write failing tests first, then implement, then verify TS compiles"
  - "WearableProviderInterface stub methods throw descriptive errors directing callers to syncHealthData"

requirements-completed: [WEAR-01]

duration: 3min
completed: 2026-03-14
---

# Phase 01 Plan 01: FitbitProvider Summary

**FitbitProvider with OAuth 2.0 PKCE flow, HR/SpO2/temperature/steps sync (no BP — hardware gap), and WearableReading unique constraint preventing duplicate rows on re-sync**

## Performance

- **Duration:** ~3 min
- **Started:** 2026-03-14T02:09:00Z
- **Completed:** 2026-03-14T02:12:20Z
- **Tasks:** 2 (+ TDD RED/GREEN commits)
- **Files modified:** 5

## Accomplishments

- WearableReading schema now has `@@unique([patientId, deviceId, readingDate])` preventing silent duplicate ingestion on re-sync
- FitbitProvider implements full OAuth 2.0 PKCE flow: authorization URL, code exchange, token refresh, access revocation
- syncHealthData fetches HR, SpO2, skin temperature, and steps day-by-day from Fitbit Web API; blood pressure explicitly excluded (hardware gap, commented in code)
- oauth-1.0a installed for Plan 03 Garmin (OAuth 1.0a dependency)
- 20 unit tests pass covering all public methods

## Task Commits

Each task was committed atomically:

1. **Task 1: DB unique constraint + oauth-1.0a + env vars** - `2345251` (chore)
2. **Task 2 RED: Failing FitbitProvider tests** - `9ca31e4` (test)
3. **Task 2 GREEN: FitbitProvider implementation** - `a2a91f1` (feat)

_Note: TDD task has test → feat commits_

## Files Created/Modified

- `backend/src/services/wearables/fitbit.ts` - FitbitProvider class: PKCE helpers, OAuth flow, day-by-day health data sync
- `backend/tests/fitbit.test.ts` - 20 unit tests for FitbitProvider
- `backend/prisma/schema.prisma` - Added `@@unique([patientId, deviceId, readingDate])` to WearableReading
- `backend/src/config/env.ts` - Added FITBIT_REDIRECT_URI (url), WITHINGS_CLIENT_ID, WITHINGS_CLIENT_SECRET, WITHINGS_REDIRECT_URI (url)
- `backend/package.json` - Added oauth-1.0a^2.2.6

## Decisions Made

- **PKCE verifier storage:** In-memory Map for dev; route layer should use Redis for multi-instance production. A `getCodeVerifier(state)` helper exposes the verifier to route handlers.
- **Interface extension without breaking change:** Added `exchangeCodeForTokensWithVerifier(code, codeVerifier)` as a separate method rather than changing the `exchangeCodeForTokens(code)` interface signature.
- **Temperature:** Fitbit skin temperature API returns a nightly relative offset (deviation from baseline), not an absolute reading. Stored as-is — caller must document this limitation.
- **Stub methods:** `getHeartRate`, `getSleep`, `getActivity`, `getBloodOxygen`, `getHRV` throw descriptive errors directing callers to use `syncHealthData` — consistent with Fitbit's REST pull model.
- **@types/oauth-1.0a:** Does not exist on npm (oauth-1.0a ships its own TypeScript types). The `--save-dev` install was skipped with a note in the deviation log.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] @types/oauth-1.0a package does not exist on npm**
- **Found during:** Task 1 (npm install)
- **Issue:** Plan instructed `npm install --save-dev @types/oauth-1.0a` but the package returns 404 on npm
- **Fix:** Skipped the @types install — oauth-1.0a ships its own TypeScript declarations. No separate @types package needed.
- **Files modified:** None (only the main `oauth-1.0a` package was installed)
- **Verification:** TypeScript compiles without errors related to oauth-1.0a
- **Committed in:** `2345251` (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (1 blocking — missing package skipped, not needed)
**Impact on plan:** No scope creep. oauth-1.0a ships its own types so the @types package not existing is irrelevant.

## Issues Encountered

- Pre-existing TS error in `garmin.ts` (getAuthorizationUrl returns `Promise<string>` instead of `string`): out-of-scope pre-existing issue, not introduced by this plan, not fixed here.

## User Setup Required

External services require manual configuration:

- `FITBIT_CLIENT_ID` — Fitbit Developer Dashboard (dev.fitbit.com) → Manage My Apps → your app → OAuth 2.0 Client ID
- `FITBIT_CLIENT_SECRET` — Fitbit Developer Dashboard → your app → Client Secret
- `FITBIT_REDIRECT_URI` — Your backend callback URL, e.g. `https://yourdomain.com/api/v1/wearables/callback/fitbit`

Create app at dev.fitbit.com → Register an App (type: Personal/Server; redirect URI must match FITBIT_REDIRECT_URI).

## Next Phase Readiness

- FitbitProvider exported from `fitbit.ts` — Plan 02 (Withings), Plan 03 (Garmin) can follow same pattern
- Unique constraint in schema.prisma — Plan 05 wearable pipeline can safely upsert without duplicates
- oauth-1.0a is installed for Plan 03 Garmin

---
*Phase: 01-wearable-data-ingestion*
*Completed: 2026-03-14*
