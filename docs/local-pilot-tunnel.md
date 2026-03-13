# Local Pilot Tunnel Runbook (Option 1)

Use this runbook when backend and storage stay local, but external providers (WhatsApp, Apple, Android) must call your webhook endpoints.

## 1) Local prerequisites

1. Backend running on `http://localhost:8080`
2. Frontend running on `http://localhost:5173`
3. PostgreSQL local and reachable by backend
4. `backend/.env` configured with provider secrets:
   - WhatsApp: `WHATSAPP_*`
   - Apple: `APPLE_WEBHOOK_SECRET`
   - Android: `HEALTH_CONNECT_WEBHOOK_SECRET`
   - Google (if used): `GOOGLE_*`

## 2) Start local services

```bash
# terminal 1
cd backend
npm run dev

# terminal 2
cd ..
npm run dev
```

## 3) Create secure tunnel to backend

### Install Cloudflare tunnel binary (one-time)

```bash
./scripts/setup_cloudflared.sh
```

### One-command helper (recommended)

```bash
./scripts/start_pilot_tunnel.sh cloudflare 8080
```

This command auto-detects the public URL and prints all webhook endpoints.

### Recommended: Cloudflare quick tunnel

```bash
cloudflared tunnel --url http://localhost:8080
```

Cloudflare prints a public URL like:

`https://abc-123-xyz.trycloudflare.com`

### Fallback: ngrok

```bash
ngrok http http://localhost:8080
```

ngrok prints a public URL like:

`https://abcd-1234.ngrok-free.app`

Helper command:

```bash
./scripts/start_pilot_tunnel.sh ngrok 8080
```

## 4) Configure provider callback URLs

Assume `PUBLIC_BASE_URL=https://your-tunnel-domain`.

- WhatsApp verify + webhook:
  - `GET/POST ${PUBLIC_BASE_URL}/webhooks/whatsapp`
- Apple webhook:
  - `POST ${PUBLIC_BASE_URL}/webhooks/apple-health`
- Android Health Connect webhook:
  - `POST ${PUBLIC_BASE_URL}/webhooks/health-connect`
- Google Fit Pub/Sub push (if enabled):
  - `POST ${PUBLIC_BASE_URL}/webhooks/google-fit?token=<GOOGLE_PUBSUB_TOKEN>`

## 5) WhatsApp verification fields (Meta dashboard)

1. Callback URL: `${PUBLIC_BASE_URL}/webhooks/whatsapp`
2. Verify token: value of `WHATSAPP_WEBHOOK_VERIFY_TOKEN` (or fallback `WHATSAPP_WEBHOOK_SECRET`)
3. Subscribe message/status events

## 6) Quick verification checklist

1. Health check:

```bash
curl -i http://localhost:8080/health
```

2. Tunnel endpoint health:

```bash
curl -i "${PUBLIC_BASE_URL}/health"
```

3. WhatsApp verification path reachable:

```bash
curl -i "${PUBLIC_BASE_URL}/webhooks/whatsapp"
```

You should get `403` without verification query params, which confirms route reachability.

4. Watch backend logs for webhook receipts and signature outcomes.

## 6.1 Runtime checks in UI

In Admin Pilot Ops (`/pilot-ops`):

1. Open `Runtime + Webhook Control`.
2. Paste your tunnel URL and click `Save URL`.
3. Use `Check Now` to verify:
   - local API health
   - database reachability
   - provider key readiness
   - tunnel/webhook endpoint response codes
4. Copy endpoint URLs directly from the UI into provider dashboards.

## 7) Security guardrails for local pilot

1. Keep secrets only in backend env and integration key storage. Do not put provider secrets in frontend `VITE_*`.
2. Keep the tunnel target on backend only (`localhost:8080`), not frontend.
3. Rotate secrets after demos or if tunnel URL is leaked.
4. Keep MFA enabled for admin key operations.
5. Use a small pilot cohort and real audit log review in `/admin` and `/pilot-ops`.

## 8) Known limitations of local-only infra

1. Laptop or local machine downtime stops all inbound webhooks.
2. Tunnel URL may change on restart unless you use a reserved domain plan.
3. No production-grade HA, backup isolation, or managed uptime guarantees.

## 9) Hosted doctor page + local admin split

If you host the doctor page publicly but keep admin local-only:

1. Frontend (doctor/public build): set `VITE_ENABLE_ADMIN_UI=false`.
2. Backend: set `ADMIN_LOCAL_ONLY=true` to block `/api/v1/admin/*` unless requests come from localhost.
3. Keep doctor data on `/api/v1/clinical/*` and do not expose admin key management UI in the hosted build.
