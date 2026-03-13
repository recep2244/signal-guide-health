# Admin Portal Plan: Integration Keys (WhatsApp, Apple, Android)

## 1) Goal
- Add an admin-only portal to manage integration credentials safely.
- Cover:
  - WhatsApp Business
  - Apple HealthKit bridge
  - Android Health Connect + Google Fit OAuth

## 2) Required Key Sets

### 2.1 WhatsApp
- `WHATSAPP_API_URL`
- `WHATSAPP_ACCESS_TOKEN`
- `WHATSAPP_PHONE_NUMBER_ID`
- `WHATSAPP_WEBHOOK_SECRET`
- `WHATSAPP_WEBHOOK_VERIFY_TOKEN`

### 2.2 Apple
- `APPLE_WEBHOOK_SECRET`
- `APPLE_HEALTHKIT_TEAM_ID`
- `APPLE_HEALTHKIT_KEY_ID`

### 2.3 Android
- `HEALTH_CONNECT_WEBHOOK_SECRET`
- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- `GOOGLE_REDIRECT_URI`

### 2.4 Optional Providers
- Fitbit: `FITBIT_CLIENT_ID`, `FITBIT_CLIENT_SECRET`
- Garmin: `GARMIN_CONSUMER_KEY`, `GARMIN_CONSUMER_SECRET`

## 3) Admin UI Design

### 3.1 New Admin section
- Add tab: `Integration Keys`.
- Provider cards:
  - WhatsApp
  - Apple Health
  - Android Health

### 3.2 UX rules
- Never show full secret values after save.
- Show only:
  - configured/not configured
  - last rotated date
  - last validation status
  - masked preview (last 4 chars only)
- Buttons:
  - `Save`
  - `Validate`
  - `Rotate`
  - `Test Webhook Signature`

### 3.3 Access control
- `super_admin` only for create/update/rotate.
- `admin` can view status only.
- Force MFA for secret write operations.

## 4) Backend API Contract

### 4.1 Status endpoint
- `GET /api/v1/admin/integrations/keys/status`
- Returns only metadata, never raw secret.

### 4.2 Upsert provider keys
- `PUT /api/v1/admin/integrations/keys/:provider`
- Provider: `whatsapp | apple | android`
- Payload: provider-specific fields.
- Server validates schema and stores encrypted values.

### 4.3 Validation endpoint
- `POST /api/v1/admin/integrations/keys/:provider/validate`
- Runs provider checks:
  - WhatsApp token + phone number ID
  - Apple webhook HMAC test
  - Google OAuth config consistency
  - Health Connect webhook secret check

### 4.4 Rotation endpoint
- `POST /api/v1/admin/integrations/keys/:provider/rotate`
- Creates new version and marks previous as revoked.

## Current implementation
- `GET /api/v1/admin/integrations/keys/status` implemented.
- `PUT /api/v1/admin/integrations/keys/:provider` implemented (`super_admin` + MFA required).
- `POST /api/v1/admin/integrations/keys/:provider/validate` implemented.
- `POST /api/v1/admin/integrations/keys/:provider/rotate` implemented (`super_admin` + MFA required).
- `GET /api/v1/admin/integrations/keys/:provider/history` implemented.
- `POST /api/v1/admin/integrations/keys/:provider/rollback` implemented (`super_admin` + MFA required).
- `GET /api/v1/admin/integrations/keys/audit` implemented.
- Encrypted version history table implemented: `admin_integration_key_versions`.
- Integration key actions now write to `audit_logs` with operation + actor context.

## 5) Storage Strategy

## Preferred
- Use cloud secret manager (AWS/GCP/Azure) as source of truth.
- App stores only metadata in DB:
  - `provider`, `keyName`, `version`, `status`, `lastRotatedAt`, `lastValidatedAt`, `updatedBy`.

## Fallback (if no secret manager yet)
- Store encrypted secrets in DB with envelope encryption.
- Use existing encryption service + master key from environment.
- Add versioning and soft-delete/revoke fields.

## 6) Security Controls (must-have)
- Encrypt secrets at rest.
- TLS only in transit.
- Input validation + payload size limits.
- Full audit logging:
  - who changed what provider
  - time, IP, result
- Rate limit secret endpoints.
- Alert on repeated validation failures.
- Quarterly key rotation policy.

## 7) Android Coverage Plan

### 7.1 Health Connect
- Keep signed webhook ingestion at `/webhooks/health-connect`.
- Admin must be able to update and rotate `HEALTH_CONNECT_WEBHOOK_SECRET`.
- Add status metric: valid signatures vs failures.

### 7.2 Google Fit
- Admin manages OAuth client keys + redirect URI.
- Validation checks:
  - redirect URI format
  - token endpoint exchange test (non-destructive)
- Add status metric: OAuth callback success/fail ratio.

## 8) Rollout Plan

### Phase 1 (1 sprint)
- Status-only dashboard + provider health.
- No write actions yet.

### Phase 2 (1 sprint)
- Secure save/update + validation endpoints.
- UI save/validate actions.

### Phase 3 (1 sprint)
- Rotation, version history, and rollback.
- Alerting and audit exports.

## 9) Acceptance Criteria
- Admin sees real configured status per provider.
- Super admin can securely update keys without exposing raw values.
- WhatsApp, Apple, and Android validation runs from UI.
- All key changes are auditable.
- Production deployment works without hardcoding secrets in code.
