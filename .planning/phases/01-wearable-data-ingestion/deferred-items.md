# Deferred Items — Phase 01: Wearable Data Ingestion

## Pre-existing TypeScript Errors (out of scope for plan 01-02)

### garmin.ts TS2416
- **File:** `backend/src/services/wearables/garmin.ts:104`
- **Error:** `Property 'getAuthorizationUrl' in type 'GarminProvider' is not assignable to the same property in base type 'WearableProviderInterface'. Type 'Promise<string>' is not assignable to type 'string'.`
- **Existed before:** Yes — present before any 01-02 changes (verified via git stash check)
- **Fix:** GarminProvider.getAuthorizationUrl should return `string`, not `Promise<string>`, OR use Garmin's OAuth 1.0a redirect pattern correctly
- **Plan to address:** Can be fixed in plan 01-04 (Garmin provider plan) or a dedicated fix plan
