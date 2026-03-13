# Pilot: WhatsApp Follow-up + Apple Watch Sync

This pilot adds:

- Automated WhatsApp follow-up flow processing on inbound webhook messages.
- Admin trigger endpoints to start follow-ups for one patient or a batch.
- Apple Watch push webhook ingestion already wired at `/webhooks/apple-health`.

## 1. Required Backend Environment

Add these values in `backend/.env`:

- `WHATSAPP_API_URL=https://graph.facebook.com/v18.0`
- `WHATSAPP_ACCESS_TOKEN=...`
- `WHATSAPP_PHONE_NUMBER_ID=...`
- `WHATSAPP_WEBHOOK_SECRET=...`
- `WHATSAPP_WEBHOOK_VERIFY_TOKEN=...`
- `APPLE_WEBHOOK_SECRET=...`

Optional but now supported:

- `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REDIRECT_URI`
- `HEALTH_CONNECT_WEBHOOK_SECRET`

## 2. WhatsApp Webhook

Webhook routes:

- `GET /webhooks/whatsapp` (Meta verify challenge)
- `POST /webhooks/whatsapp` (inbound messages + status updates)

What happens on inbound message:

1. Signature verification.
2. Patient lookup by WhatsApp number (`patients.whatsapp_phone`, opted-in only).
3. Conversation state machine progression (`wellbeing -> symptoms -> medications -> completed`).
4. Chat message persistence (`chat_messages`).
5. Check-in creation (`check_ins`) on completion.
6. Alert creation for AMBER/RED outcomes (`alerts`).

## 3. Admin Trigger Endpoints

Protected by admin role (`/api/v1/admin/...`):

- `POST /api/v1/admin/pilot/whatsapp/follow-up/:patientId`
- `POST /api/v1/admin/pilot/whatsapp/follow-up-batch`

Example batch body:

```json
{
  "limit": 25
}
```

## 4. Apple Watch Sync Route

Apple Watch push ingestion route:

- `POST /webhooks/apple-health`

Expected body fields:

- `userId`
- `deviceId`
- `dataType` (`heart_rate`, `sleep`, `blood_oxygen`, `hrv`)
- `samples`
- `syncToken` (optional)

Header:

- `x-apple-signature` (HMAC validated with `APPLE_WEBHOOK_SECRET`)

## 5. Notes for Pilot Rollout

- Use a limited patient cohort with `whatsapp_opted_in=true`.
- Ensure patient `whatsapp_phone` values are normalized and match Meta inbound numbers.
- Start with manual trigger from admin endpoint before scheduling automation.
- Capture all pilot messages/check-ins/alerts in dashboards for clinical review.

## 5.1 Pilot Tracking Dashboard

Backend analytics endpoint:

- `GET /api/v1/admin/pilot/overview?hours=24`

Returns:

- WhatsApp funnel and delivery status
- Triage outcomes from check-ins
- Apple Watch sync coverage and lag
- Recent check-in/sync activity events

Frontend admin page:

- `/pilot-ops`

## 6. Go-Live Checklist (Kubernetes)

1. Fill pilot secrets in `infrastructure/kubernetes/secrets.yaml`:
   - `whatsapp-access-token`, `whatsapp-phone-number-id`
   - `whatsapp-webhook-secret`, `whatsapp-webhook-verify-token`
   - `apple-webhook-secret`
   - `google-client-id`, `google-client-secret`, `google-redirect-uri`
   - `health-connect-webhook-secret`
2. Apply manifests:

```bash
kubectl apply -f infrastructure/kubernetes/namespace.yaml
kubectl apply -f infrastructure/kubernetes/configmap.yaml
kubectl apply -f infrastructure/kubernetes/secrets.yaml
kubectl apply -f infrastructure/kubernetes/api-deployment.yaml
kubectl apply -f infrastructure/kubernetes/ingress.yaml
```

3. Set external webhook URLs:
   - Meta WhatsApp webhook: `https://api.<your-domain>/webhooks/whatsapp`
   - Apple push webhook: `https://api.<your-domain>/webhooks/apple-health`
4. Validate after deploy:
   - `GET /health` returns `200`
   - Meta verify challenge succeeds on `GET /webhooks/whatsapp`
   - Run one admin pilot trigger for a known opted-in patient

## 7. Extended Architecture & Security Plan

For detailed implementation planning on device matching, WhatsApp interface state, storage strategy, and cyber actions, see:

- `docs/pilot-device-whatsapp-storage-cyber-plan.md`
- `docs/admin-integration-keys-plan.md`

## 8. Local Pilot with Internet Access (Tunnel)

If you are running the pilot fully local (local backend + local database) and still need real provider callbacks, use:

- `docs/local-pilot-tunnel.md`

Helper script:

- `scripts/pilot_webhook_endpoints.sh <public_base_url>`
