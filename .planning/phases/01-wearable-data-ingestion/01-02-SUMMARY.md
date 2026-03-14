---
phase: 01-wearable-data-ingestion
plan: 02
subsystem: api
tags: [withings, oauth2, wearables, blood-pressure, health-data, typescript]

# Dependency graph
requires:
  - phase: 01-wearable-data-ingestion/01-01
    provides: WearableProviderInterface and OAuthTokens types, env.ts Withings vars

provides:
  - WithingsProvider class implementing WearableProviderInterface
  - withingsProvider singleton
  - Non-standard Withings OAuth2 flow (action=requesttoken)
  - Measurement pull for BP (meastype 9/10), HR (11), SpO2 (54), temperature (71)
  - scaleWithingsValue helper (actual = value * 10^unit)
  - HMAC-SHA256 webhook validation with timing-safe comparison

affects:
  - 01-wearable-data-ingestion/01-05 (provider registry that imports withingsProvider)
  - wearables route handler (callback/withings)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - Withings non-standard token pattern (action=requesttoken in both auth and refresh)
    - Both access AND refresh tokens rotated on every refresh (Withings invalidates old refresh token immediately)
    - Withings value scaling: actual = value * Math.pow(10, unit)
    - timingSafeEqual with explicit length check before comparison (avoids RangeError)

key-files:
  created:
    - backend/src/services/wearables/withings.ts
    - backend/tests/withings.test.ts
  modified:
    - backend/src/config/env.ts (WITHINGS_CLIENT_ID/SECRET/REDIRECT_URI added in plan 01-01 commit)

key-decisions:
  - "action=requesttoken sent in both token exchange AND refresh bodies — Withings returns error 293 without it"
  - "refreshTokens always returns new refresh_token — Withings rotates both tokens; caller must persist both or auth fails after 3 hours"
  - "getMeasurements fetches meastypes 9,10,11,54,71 in one POST to /measure — no per-type requests"
  - "revokeAccess returns true without API call — Withings has no standard token revocation endpoint"
  - "getSleep and getActivity return empty arrays — these require separate Withings v2 endpoints scoped to a later plan"
  - "validateWebhook: HMAC-SHA256 with length guard before timingSafeEqual (prevents RangeError on mismatched buffer sizes)"

patterns-established:
  - "Withings token POST pattern: URLSearchParams with action=requesttoken, POST to wbsapi.withings.net/v2/oauth2"
  - "Withings measurement fetch: POST to wbsapi.withings.net/measure with action=getmeas"

requirements-completed: [WEAR-04]

# Metrics
duration: 15min
completed: 2026-03-14
---

# Phase 1 Plan 02: WithingsProvider Summary

**WithingsProvider implementing WearableProviderInterface with non-standard action=requesttoken OAuth2, dual-token rotation on refresh, and BP/HR/SpO2/temperature measurement pull via meastypes 9,10,11,54,71**

## Performance

- **Duration:** ~15 min
- **Started:** 2026-03-14T02:09:00Z
- **Completed:** 2026-03-14T02:24:00Z
- **Tasks:** 1 (TDD: RED + GREEN + bug fix)
- **Files modified:** 3

## Accomplishments

- WithingsProvider with full WearableProviderInterface compliance — 25/25 tests passing
- Non-standard Withings OAuth2 implemented correctly (action=requesttoken mandatory in both exchange and refresh)
- Blood pressure data pipeline: meastype 9 (diastolic) + 10 (systolic) — only Phase-1 provider with BP support
- Dual-token rotation on every refresh with explicit warning in code to callers
- scaleWithingsValue correctly decodes Withings-encoded measurements (value * 10^unit)

## Task Commits

TDD execution:

1. **RED — withings.test.ts** - `1a5c20d` (test)
2. **GREEN — withings.ts implementation** - `1c07db7` (feat)

Note: validateWebhook bug (timingSafeEqual RangeError on unequal-length buffers) fixed inline in GREEN commit.

## Files Created/Modified

- `backend/src/services/wearables/withings.ts` — WithingsProvider class and withingsProvider singleton (471 lines)
- `backend/tests/withings.test.ts` — 25 tests covering all public methods
- `backend/src/config/env.ts` — WITHINGS_CLIENT_ID/SECRET/REDIRECT_URI added (committed in plan 01-01 env setup)

## Decisions Made

- **action=requesttoken**: Present in both exchangeCodeForTokens and refreshTokens bodies. Withings returns error 293 without this non-standard field.
- **Both tokens returned on refresh**: Withings invalidates old refresh_token on use. Callers must persist both accessToken and refreshToken immediately.
- **Single /measure call**: All 5 meastype codes (9,10,11,54,71) fetched in one POST — avoids 5 separate API calls.
- **Sleep/Activity stubs**: Return empty arrays — requires separate Withings v2 endpoints (/v2/sleep, /v2/measure?action=getactivity) not scoped to this plan.
- **revokeAccess returns true**: Withings has no standard revocation endpoint in the non-premium tier. Interface contract satisfied without API call.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] validateWebhook: timingSafeEqual RangeError on unequal buffer lengths**
- **Found during:** Task 1 GREEN phase (test run)
- **Issue:** `crypto.timingSafeEqual` throws `RangeError: Input buffers must have the same byte length` when signature length differs from expected HMAC hex (64 chars). Test passed short `'sig'` string.
- **Fix:** Added explicit length guard before `timingSafeEqual` — if lengths differ, return false immediately (no timing leak since equal-length attacker cannot deduce secret from mismatched lengths).
- **Files modified:** `backend/src/services/wearables/withings.ts`
- **Verification:** All 25 tests pass including validateWebhook test.
- **Committed in:** `1c07db7` (GREEN task commit)

---

**Total deviations:** 1 auto-fixed (Rule 1 - bug)
**Impact on plan:** Fix required for correctness and security. No scope creep.

## Issues Encountered

- Pre-existing `garmin.ts` TS2416 error (GarminProvider.getAuthorizationUrl returns Promise<string> instead of string). Not caused by this plan's changes — logged to deferred-items.md.

## User Setup Required

External service credentials required for Withings OAuth2 to function:

| Variable | Source |
|----------|--------|
| `WITHINGS_CLIENT_ID` | developer.withings.com -> My Apps -> your app -> Client ID |
| `WITHINGS_CLIENT_SECRET` | developer.withings.com -> My Apps -> your app -> Client Secret |
| `WITHINGS_REDIRECT_URI` | Your backend callback, e.g. `https://yourdomain.com/api/v1/wearables/callback/withings` |

Create a Withings app at developer.withings.com and request scopes: `user.metrics`, `user.activity`.

## Next Phase Readiness

- WithingsProvider ready to be registered in provider index (plan 01-05)
- Blood pressure data available from Withings once credentials configured
- getSleep/getActivity stubs in place — can be expanded when /v2/sleep is scoped

## Self-Check: PASSED

- FOUND: `backend/src/services/wearables/withings.ts`
- FOUND: `backend/tests/withings.test.ts`
- FOUND: `.planning/phases/01-wearable-data-ingestion/01-02-SUMMARY.md`
- FOUND: commit `1a5c20d` (RED: failing tests)
- FOUND: commit `1c07db7` (GREEN: implementation)
- All 25 tests passing

---
*Phase: 01-wearable-data-ingestion*
*Completed: 2026-03-14*
