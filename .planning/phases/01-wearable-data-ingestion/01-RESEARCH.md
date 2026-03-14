# Phase 1: Wearable Data Ingestion - Research

**Researched:** 2026-03-14
**Domain:** Wearable Health APIs — Fitbit Web API, Apple HealthKit (push), Garmin Health API, Withings API; OAuth 2.0/1.0a token flows; Express/Prisma data ingestion pipeline
**Confidence:** HIGH (architecture and existing code); MEDIUM (Garmin and Withings specifics — partner approval required for full docs)

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| WEAR-01 | System syncs real HR, BP, SpO2, steps, temperature from Fitbit via OAuth | Fitbit Web API PKCE flow fully documented; BP not available from Fitbit hardware (no BP sensor); remaining 4 metrics confirmed available |
| WEAR-02 | System syncs real HR, BP, SpO2, steps, temperature from Apple HealthKit push endpoint | Apple HealthKit push handler already partially implemented; BP and temperature processors need wiring |
| WEAR-03 | System syncs real data from Garmin Connect via OAuth | Garmin uses OAuth 1.0a + HMAC-SHA1 signing; push-first model; requires partner approval for API access |
| WEAR-04 | System syncs real data from Withings via OAuth | Withings OAuth2 non-standard (action=requesttoken); measure/getmeas endpoint returns all metrics; BP meastype codes confirmed |
| WEAR-05 | Wearable readings trigger threshold alerts (HR, BP, SpO2) automatically | `wearableService.analyzeReading()` and `alertService.createAlert()` already implemented and correct — just needs to be called from real data path |
</phase_requirements>

---

## Summary

This phase replaces the `simulateProviderSync()` stub with real provider API calls for four wearable ecosystems. The backend already has significant scaffolding: `WearableProviderInterface`, Apple HealthKit push processing (partial), Google Fit OAuth (complete, not in scope), and a flat `WearableReading` schema with `mapReadingToColumns`. The threshold alert pipeline in `wearableService` is already implemented and correct — it just never gets called with real data.

The core work is writing three new provider modules (Fitbit, Garmin, Withings) that implement `WearableProviderInterface`, completing the Apple HealthKit push handler to process BP/SpO2/temperature/steps (processors exist but the push-data route only calls `processHeartRateSamples`), and wiring all four into the route layer so real readings reach `recordReading()` and trigger alerts.

**Primary recommendation:** Build each provider as a standalone class in `backend/src/services/wearables/`, following the pattern established by `googleFit.ts`. Replace `simulateProviderSync()` by routing `syncFromProvider()` through the real provider's `syncHealthData()`. Wire Apple's `push-data` route to call all five metric processors, not just heart rate.

**Critical hardware limitation:** Fitbit devices do not have blood pressure sensors. There is no BP endpoint in the Fitbit Web API. The WEAR-01 requirement for BP from Fitbit cannot be fulfilled at the device hardware level — plan must acknowledge this and skip BP for Fitbit.

---

## Standard Stack

### Core (already in place)
| Library/Pattern | Version | Purpose | Status |
|-----------------|---------|---------|--------|
| Express 4 | ^4.x | HTTP routing for OAuth callbacks, push endpoints | In use |
| Prisma 5 | ^5.x | DB access — WearableDevice, WearableReading, Alert | In use |
| TypeScript 5.3 | ~5.3 | Type safety across provider interfaces | In use |
| `encryptionService` | internal | AES-256 encrypt/decrypt of OAuth tokens at rest | In use |
| `alertService.createAlert()` | internal | Alert creation + triage escalation | In use, correct |
| `wearableService.analyzeReading()` | internal | Threshold evaluation, returns TriageLevel | In use, correct |
| Node 18+ `fetch` | built-in | HTTP calls to provider APIs | Available |

### New Dependencies Needed
| Library | Purpose | When to Use |
|---------|---------|-------------|
| `oauth-1.0a` (npm) | Garmin OAuth 1.0a HMAC-SHA1 request signing | Garmin only — OAuth 2.0 providers use plain fetch |
| `crypto` (built-in) | PKCE code_verifier/code_challenge for Fitbit | Already imported in routes |

**Installation:**
```bash
cd backend && npm install oauth-1.0a
npm install --save-dev @types/oauth-1.0a
```

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `oauth-1.0a` npm | Manual HMAC-SHA1 signing | Manual is error-prone with URL encoding; library is 6KB, well-tested |
| Custom fetch wrappers | Axios | fetch is built-in to Node 18+; no extra dep needed |

---

## Architecture Patterns

### Recommended Project Structure

```
backend/src/services/wearables/
├── types.ts              # WearableProviderInterface (existing, keep as-is)
├── index.ts              # getWearableProvider() factory (add fitbit, garmin, withings cases)
├── appleHealthKit.ts     # Push handler (existing — extend processors)
├── googleFit.ts          # OAuth pull (existing — out of scope for Phase 1)
├── healthConnect.ts      # Push handler (existing — out of scope for Phase 1)
├── fitbit.ts             # NEW: OAuth 2.0 PKCE + pull sync
├── garmin.ts             # NEW: OAuth 1.0a + push webhook handler
└── withings.ts           # NEW: OAuth 2.0 (non-standard) + pull sync
```

### Pattern 1: OAuth Pull Provider (Fitbit / Withings)

**What:** Provider issues OAuth tokens; server calls provider REST API on demand to pull data since last sync.
**When to use:** Fitbit, Withings — both support server-side token exchange and data pull endpoints.

```typescript
// Source: pattern from googleFit.ts, applied to Fitbit
export class FitbitProvider implements WearableProviderInterface {
  readonly provider = 'fitbit' as const;

  // PKCE flow — code_verifier stored in Redis/session, not provider class
  getAuthorizationUrl(state: string): string {
    const codeChallenge = generateCodeChallenge(); // SHA-256(verifier), base64url
    return `https://www.fitbit.com/oauth2/authorize?` +
      `client_id=${this.config.clientId}&response_type=code` +
      `&code_challenge=${codeChallenge}&code_challenge_method=S256` +
      `&scope=heartrate+oxygen_saturation+temperature+activity+sleep` +
      `&state=${state}`;
  }

  async exchangeCodeForTokens(code: string): Promise<WearableAuthResult> {
    // POST https://api.fitbit.com/oauth2/token
    // Header: Authorization: Basic base64(clientId:clientSecret)
    // Body: grant_type=authorization_code&code=...&code_verifier=...&redirect_uri=...
  }

  async syncHealthData(accessToken: string, since?: Date): Promise<SyncResult> {
    // Call: GET https://api.fitbit.com/1/user/-/activities/heart/date/[date]/1d.json
    // Call: GET https://api.fitbit.com/1/user/-/spo2/date/[date]/all.json
    // Call: GET https://api.fitbit.com/1/user/-/temp/skin/date/[date].json
    // Call: GET https://api.fitbit.com/1/user/-/activities/steps/date/[date]/1d.json
    // NOTE: No blood pressure endpoint exists in Fitbit API
  }
}
```

### Pattern 2: OAuth 1.0a Push Provider (Garmin)

**What:** Garmin uses OAuth 1.0a (consumer key + access token) and pushes summary data via webhooks. The server receives JSON POSTs; no pull model.
**When to use:** Garmin only.

```typescript
// Source: Garmin Health API docs + oauth-1.0a npm
import OAuth from 'oauth-1.0a';
import crypto from 'crypto';

export class GarminProvider {
  // OAuth 1.0a signing for callback validation
  private oauth = new OAuth({
    consumer: { key: this.consumerKey, secret: this.consumerSecret },
    signature_method: 'HMAC-SHA1',
    hash_function(base_string, key) {
      return crypto.createHmac('sha1', key).update(base_string).digest('base64');
    },
  });

  // Webhook push handler — called by Garmin servers
  parseWebhookPayload(body: GarminPushPayload): GarminSummary[] {
    // body.summaries[] contains dailies, epochs, activities, sleeps
    // Each summary has: userId, summaryId, activityType, steps, averageHeartRateInBeatsPerMinute
  }
}
```

**Garmin OAuth flow specifics:**
- Authorization URL: `https://connect.garmin.com/oauthConfirm`
- Request token URL: `https://connectapi.garmin.com/oauth-service/oauth/request_token`
- Access token URL: `https://connectapi.garmin.com/oauth-service/oauth/access_token`
- All requests signed with HMAC-SHA1, OAuth 1.0a header format
- Data arrives via push to your registered callback; no on-demand pull endpoint

### Pattern 3: Withings Non-Standard OAuth + Pull

**What:** Withings looks like OAuth 2.0 but token exchange requires `action=requesttoken` in body (not standard). Data is pulled via `POST https://wbsapi.withings.net/measure` with `action=getmeas`.
**When to use:** Withings only.

```typescript
// Source: Withings developer documentation
export class WithingsProvider implements WearableProviderInterface {
  getAuthorizationUrl(state: string): string {
    return `https://account.withings.com/oauth2_user/authorize2?` +
      `response_type=code&client_id=${clientId}` +
      `&scope=user.metrics,user.activity&redirect_uri=${redirectUri}&state=${state}`;
  }

  async exchangeCodeForTokens(code: string): Promise<WearableAuthResult> {
    // POST https://wbsapi.withings.net/v2/oauth2
    // Body (form-urlencoded):
    //   action=requesttoken
    //   client_id, client_secret, code
    //   grant_type=authorization_code, redirect_uri
    //   nonce (unix timestamp string)
    //   signature (HMAC-SHA256 of sorted params — see docs)
    // Access token valid: 3 hours; refresh token valid: 1 year
    // ALWAYS replace refresh_token on each refresh
  }

  async getMeasurements(accessToken: string, since: Date): Promise<WithingsMeasure[]> {
    // POST https://wbsapi.withings.net/measure
    // Header: Authorization: Bearer {accessToken}
    // Body: action=getmeas&startdate={unix}&enddate={unix}&meastypes=9,10,11,54,71
    // meastype codes: 9=diastolic BP, 10=systolic BP, 11=heart_rate, 54=SpO2, 71=body_temp
  }
}
```

### Pattern 4: Apple HealthKit Push — Fix Incomplete Handler

**What:** The existing `/push-data` route only calls `processHeartRateSamples()`. All other processors (`processBloodOxygenSamples`, `processActivitySamples`, `processSleepSamples`, `processHRVSamples`) exist in `appleHealthKit.ts` but are not called.
**When to use:** Immediately — this is a wire-up task, not a new build.

```typescript
// Source: existing appleHealthKit.ts — processors already exist
// Fix in: backend/src/routes/wearables.ts POST /push-data

if (provider === 'apple_watch') {
  const { dataType, samples } = data;
  switch (dataType) {
    case HEALTHKIT_DATA_TYPES.HEART_RATE:
      processed = appleHealthKitProvider.processHeartRateSamples(samples);
      break;
    case HEALTHKIT_DATA_TYPES.BLOOD_OXYGEN:
      processed = appleHealthKitProvider.processBloodOxygenSamples(samples);
      break;
    case HEALTHKIT_DATA_TYPES.BODY_TEMPERATURE:
      processed = appleHealthKitProvider.processTemperatureSamples(samples); // needs adding
      break;
    case HEALTHKIT_DATA_TYPES.STEP_COUNT:
      processed = appleHealthKitProvider.processActivitySamples(samples, dataType);
      break;
    // Blood pressure: Apple Watch does not have a BP sensor
  }
  // Then: map processed data -> WearableReading via wearableService.recordReading()
}
```

**Apple Watch hardware note:** Apple Watch does not have a blood pressure sensor. BP is out of scope for WEAR-02.

### Pattern 5: Wiring syncFromProvider to Real Providers

```typescript
// Source: wearableService.ts syncFromProvider() (line 476-498)
// Replace: simulateProviderSync() call

async syncFromProvider(wearableId: string): Promise<{ synced: number }> {
  // ...existing device lookup...
  const provider = getWearableProvider(wearable.deviceType as WearableProvider);
  const since = wearable.lastSyncAt || new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  // Calls real API, returns SyncResult
  const syncResult = await provider.syncHealthData(accessToken, since);

  // Map SyncResult -> WearableReading records via recordReading()
  // syncHealthData should persist readings internally, OR
  // syncFromProvider maps and calls recordReading() after
}
```

### Anti-Patterns to Avoid

- **Storing raw provider IDs in state parameter without Redis:** The current route stores state only in local memory; use Redis (already in stack) for state/code_verifier storage with 10-minute TTL.
- **Calling recordReading() per individual sample:** For Fitbit sync returning 1440 heart rate readings, create a daily aggregated WearableReading row (avgHeartRate, restingHeartRate, etc.) — the schema is daily-aggregate-oriented, not per-reading time series.
- **Duplicating readings on re-sync:** Use `upsert` on `(patientId, deviceId, readingDate)` — there is no unique constraint yet; add one or use findFirst+create logic.
- **Blocking sync in the HTTP handler:** Sync for pull providers can take 5-30 seconds; the `/sync/:deviceId` route should trigger sync and return immediately with a job reference, or set a generous timeout.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| OAuth 1.0a HMAC-SHA1 signing | Manual signing logic | `oauth-1.0a` npm package | Header construction, parameter sorting, and encoding rules are notoriously error-prone |
| PKCE code verifier/challenge | Manual crypto | Node's built-in `crypto.randomBytes` + `createHash('sha256')` + base64url encode | 3 lines, no dep needed |
| Token encryption at rest | Custom AES | `encryptionService` (already in codebase) | Already tested, consistent with existing device tokens |
| Threshold alerting | Custom threshold logic | `wearableService.analyzeReading()` (already correct) | Already implements all required HR/BP/SpO2 thresholds |
| Withings signature generation | Manual HMAC | Document the 3-line snippet — it IS custom but trivial | Withings `nonce`+`signature` is simple HMAC-SHA256 of sorted params |

**Key insight:** The alert pipeline (`analyzeReading` → `createAlert`) is production-ready. The only missing piece is getting real data values into `recordReading()`. Don't touch the alerting logic.

---

## Common Pitfalls

### Pitfall 1: Fitbit Blood Pressure — Hardware Gap

**What goes wrong:** WEAR-01 specifies BP from Fitbit. The Fitbit Web API has no blood pressure endpoint. Fitbit devices have no BP sensor (as of 2025). Attempting to call a BP endpoint will 404.
**Why it happens:** Requirement written assuming Fitbit parity with Withings/medical devices.
**How to avoid:** Document in the plan that Fitbit syncs HR, SpO2, temperature, and steps only. Skip BP for Fitbit. The requirement can be partially satisfied.
**Warning signs:** Any code looking for a Fitbit BP endpoint in the API docs.

### Pitfall 2: Fitbit Intraday HR — 24-Hour Limit

**What goes wrong:** Calling the intraday heart rate endpoint with a date range longer than 24 hours returns only summary data, not intraday samples.
**Why it happens:** Fitbit API restriction: `detail-level` intraday requires single-day requests.
**How to avoid:** In `syncHealthData()`, loop day-by-day for the `since`-to-now range. For a 7-day sync, make 7 individual requests.
**Warning signs:** Empty `activities-heart-intraday.dataset` in response.

### Pitfall 3: Withings Token Refresh — Replace Both Tokens

**What goes wrong:** After refreshing a Withings access token, the old refresh token is invalidated immediately. Storing only the new access token causes permanent auth failure after 3 hours.
**Why it happens:** Withings rotates refresh tokens on every renewal (unlike Fitbit which issues persistent refresh tokens).
**How to avoid:** In `refreshTokens()`, always upsert BOTH `accessTokenEncrypted` AND `refreshTokenEncrypted` in `WearableDevice`.
**Warning signs:** "Invalid refresh token" errors after the first successful refresh.

### Pitfall 4: Garmin Push vs. Pull Confusion

**What goes wrong:** Attempting to call a Garmin "pull" endpoint to fetch data on demand. Garmin's Health API is push-first. The backend must receive Garmin's HTTP POST to a registered callback URL.
**Why it happens:** Other providers (Fitbit, Withings) support on-demand pull; Garmin does not in the standard tier.
**How to avoid:** Implement a `POST /api/v1/wearables/garmin/webhook` endpoint that receives Garmin push payloads. The `/sync/:deviceId` route for Garmin devices should indicate "sync is automatic" (same as the current Apple/push path).
**Warning signs:** Trying to define `syncHealthData()` with an active outbound HTTP call for Garmin.

### Pitfall 5: WearableReading Upsert on Duplicate Date

**What goes wrong:** Running sync twice for the same day creates duplicate `WearableReading` rows for the same `(patientId, readingDate)`. The schema has no unique constraint on this pair.
**Why it happens:** `recordReading()` always calls `prisma.wearableReading.create()`.
**How to avoid:** Use `upsert` with `where: { patientId_deviceId_readingDate: ... }` or add a migration to add the unique constraint. Check if a row exists for that day before inserting.
**Warning signs:** Query for latest readings returns multiple rows for the same date.

### Pitfall 6: PKCE Code Verifier Storage

**What goes wrong:** The code verifier generated during `/connect/fitbit` must be matched during the `/callback/fitbit` exchange. Storing it in memory (local variable) fails across server restarts or multiple instances.
**Why it happens:** The current route generates `state` but doesn't persist the code_verifier anywhere durable.
**How to avoid:** Store `{ state: codeVerifier }` in Redis with 10-minute TTL. Redis is already in the stack.
**Warning signs:** "code_verifier mismatch" errors from Fitbit token endpoint.

### Pitfall 7: Garmin Partner Program Access

**What goes wrong:** Garmin Health API requires formal application and approval through their partner program. Without approval, you cannot register a callback URL or obtain consumer keys.
**Why it happens:** Garmin gates Health API access — it is not a self-service registration.
**How to avoid:** The plan should stage WEAR-03 implementation such that the provider class is built and tested with mock tokens first, with production access pending partner approval. Use Garmin's evaluation environment if available.
**Warning signs:** 401/403 with no clear OAuth error on Garmin API calls.

---

## Code Examples

Verified patterns from official sources and existing codebase:

### Fitbit OAuth 2.0 PKCE — Token Exchange

```typescript
// Source: https://dev.fitbit.com/build/reference/web-api/developer-guide/authorization/
async exchangeCodeForTokens(code: string, codeVerifier: string): Promise<WearableAuthResult> {
  const credentials = Buffer.from(`${this.clientId}:${this.clientSecret}`).toString('base64');

  const response = await fetch('https://api.fitbit.com/oauth2/token', {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${credentials}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      code_verifier: codeVerifier,
      redirect_uri: this.redirectUri,
    }),
  });
  // Returns: access_token, refresh_token, expires_in, user_id, scope
}
```

### Fitbit SpO2 Daily Summary

```typescript
// Source: https://dev.fitbit.com/build/reference/web-api/
// Scope: oxygen_saturation
// Endpoint: GET https://api.fitbit.com/1/user/-/spo2/date/{date}/all.json
const response = await fetch(
  `https://api.fitbit.com/1/user/-/spo2/date/${dateStr}/all.json`,
  { headers: { Authorization: `Bearer ${accessToken}` } }
);
// Response: { dateTime: "2024-01-15", value: { avg: 97.5, min: 95.0, max: 99.0 } }
```

### Withings Token Exchange (Non-Standard)

```typescript
// Source: https://developer.withings.com — action=requesttoken is mandatory
const response = await fetch('https://wbsapi.withings.net/v2/oauth2', {
  method: 'POST',
  headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  body: new URLSearchParams({
    action: 'requesttoken',         // NON-STANDARD — required
    client_id: this.clientId,
    client_secret: this.clientSecret,
    code,
    grant_type: 'authorization_code',
    redirect_uri: this.redirectUri,
    nonce: Date.now().toString(),
    // signature: HMAC-SHA256 of sorted params (see Withings docs)
  }),
});
// access_token valid 3 hours; refresh_token valid 1 year (ROTATE on each refresh)
```

### Withings Measurements Fetch

```typescript
// Source: https://developer.withings.com — meastype codes confirmed
// meastype 9 = diastolic BP, 10 = systolic BP, 11 = heart rate, 54 = SpO2, 71 = body temp
const response = await fetch('https://wbsapi.withings.net/measure', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${accessToken}`,
    'Content-Type': 'application/x-www-form-urlencoded',
  },
  body: new URLSearchParams({
    action: 'getmeas',
    startdate: Math.floor(since.getTime() / 1000).toString(),
    enddate: Math.floor(Date.now() / 1000).toString(),
    meastypes: '9,10,11,54,71',
  }),
});
// Response: { status: 0, body: { measuregrps: [{ measures: [{ type, value, unit }] }] } }
// value is integer; actual = value * 10^unit (e.g. value=975, unit=-2 => 9.75)
```

### Mapping Provider Data to WearableReading (existing pattern)

```typescript
// Source: wearableService.ts mapReadingToColumns() — existing, use this
// For each daily aggregate from provider, call:
await wearableService.recordReading({
  patientId: device.patientId,
  wearableId: device.id,
  type: 'HEART_RATE',   // ReadingType
  value: avgHr,
  unit: 'bpm',
  metadata: { source: 'fitbit', date: dateStr },
});
// recordReading() persists to DB AND calls analyzeReading() AND creates Alert if abnormal
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Google Fit (legacy) | Health Connect (Android) | 2023 | Google Fit deprecated for new apps; Health Connect is current Android standard — existing `healthConnect.ts` is correct |
| Fitbit API v1 | Fitbit Web API v1 (unchanged, still current) | N/A | Still at v1 base path (`/1/user/-/`) — no migration needed |
| OAuth 1.0a (Garmin) | Garmin maintains OAuth 1.0a | No change planned | Garmin has not moved to OAuth 2.0 for Health API as of 2025 |
| Withings OAuth 1.0 | Withings OAuth 2.0 (non-standard) | ~2019 | v2 is current; old OAuth 1.0 endpoint is deprecated |

**Deprecated/outdated:**
- `simulateProviderSync()`: Replace entirely — it generates random values and serves no production purpose.
- Fitbit blood pressure API: Was removed from the API in ~2015; never re-added; do not implement.
- Google Fit API: Out of scope for Phase 1 (not in WEAR-01 through WEAR-04); keep existing implementation unchanged.

---

## Open Questions

1. **Garmin Partner Approval Status**
   - What we know: Garmin Health API requires formal partner program approval before you can register a callback URL and receive push data.
   - What's unclear: Has the team applied? Is there an evaluation environment available?
   - Recommendation: Build the Garmin provider class against the published API spec. Stage WEAR-03 so the code can be deployed and tested as soon as credentials are issued. If approval is pending, implement with environment variable guards (`if (!env.GARMIN_CONSUMER_KEY) skip`).

2. **PKCE Code Verifier Persistence**
   - What we know: Redis is in the stack (configured in `backend/src/config/redis.ts`). The current `/connect/:provider` route doesn't persist state.
   - What's unclear: Is Redis always available in the dev/prod environment?
   - Recommendation: Use Redis with `SET state:${stateToken} ${codeVerifier} EX 600`. Fall back to an in-memory Map for local dev if Redis is unavailable (LOG warning).

3. **WearableReading Duplicate Prevention**
   - What we know: No unique constraint exists on `(patientId, deviceId, readingDate)`. Re-syncing creates duplicates.
   - What's unclear: Whether a Prisma migration is acceptable in this phase or deferred.
   - Recommendation: Add a migration to create the unique constraint as part of Phase 1 Wave 0. Use `upsert` in the sync path.

4. **Fitbit WEAR-01 BP Gap**
   - What we know: Fitbit has no blood pressure sensor or API endpoint.
   - What's unclear: Whether the product team wants to mark WEAR-01 BP as "not applicable for Fitbit" or defer to a connected Withings BP device.
   - Recommendation: Implement WEAR-01 for HR, SpO2, temperature, and steps. Document the BP gap explicitly. Withings (WEAR-04) covers BP.

---

## Sources

### Primary (HIGH confidence)
- Fitbit Web API official docs — https://dev.fitbit.com/build/reference/web-api/developer-guide/authorization/ — PKCE flow, token endpoints, scopes
- Fitbit HR Intraday endpoint — https://dev.fitbit.com/build/reference/web-api/intraday/get-heartrate-intraday-by-date-range/ — 24-hour limit confirmed
- Withings OAuth authorization URL — https://developer.withings.com/developer-guide/v3/integration-guide/public-health-data-api/get-access/oauth-authorization-url/ — scopes, state, auth URL
- Withings token exchange — https://developer.withings.com/developer-guide/v3/integration-guide/public-health-data-api/get-access/access-and-refresh-tokens-no-recover/ — action=requesttoken, 3-hour TTL, token rotation
- Existing codebase — `appleHealthKit.ts`, `googleFit.ts`, `wearableService.ts`, `schema.prisma` — architecture, interfaces, column names
- env.ts schema — Fitbit and Garmin env vars already defined: `FITBIT_CLIENT_ID`, `FITBIT_CLIENT_SECRET`, `GARMIN_CONSUMER_KEY`, `GARMIN_CONSUMER_SECRET`, `WITHINGS_WEBHOOK_SECRET`

### Secondary (MEDIUM confidence)
- Withings meastype codes (9, 10, 11, 54, 71) — cross-referenced via Withings All Available Health Data page + Go package documentation
- Garmin push/pull model and OAuth 1.0a — confirmed via Garmin Health API overview page + February 2026 serverless integration article
- Fitbit blood pressure hardware gap — confirmed via community forum + hardware comparison articles

### Tertiary (LOW confidence — flag for validation)
- Garmin OAuth 1.0a specific endpoint URLs (`connectapi.garmin.com/oauth-service/...`) — found in third-party docs; verify against Garmin partner portal once access is granted
- Withings signature generation (HMAC-SHA256 of sorted params) — documented in v3 docs but exact implementation details require testing

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all existing code verified by direct file read
- Apple HealthKit architecture: HIGH — code exists, gap is wire-up only
- Fitbit OAuth + endpoints: HIGH — official docs verified
- Withings OAuth + endpoints: HIGH — official docs verified, meastype codes cross-referenced
- Garmin OAuth + push model: MEDIUM — general architecture confirmed, exact endpoint URLs require partner portal verification
- Pitfalls (Fitbit BP, intraday limit, Withings token rotation): HIGH — confirmed from official sources
- WearableReading duplicate gap: HIGH — confirmed by direct schema read

**Research date:** 2026-03-14
**Valid until:** 2026-04-14 (Fitbit/Withings stable; Garmin — verify endpoint URLs when partner access obtained)
