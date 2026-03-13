# End-to-End Pilot Pipeline Process Guide

This guide is the single runbook for the local pilot pipeline:

- WhatsApp AI follow-up bot
- Apple Watch + Android (Health Connect/Wear OS) sync
- Admin key management UI
- Doctor data-sharing UI
- Local DeepSeek (Ollama) triage support

It also includes the current gap list and what must be done next.

## 1. Current Pipeline Architecture

1. Admin configures integration keys in Admin UI (`/admin`) via `/api/v1/admin/integrations/keys/*`.
2. Admin runs pilot operations in `/pilot-ops`:
   - configure patient WhatsApp mapping
   - connect/mock-connect wearable devices
   - trigger follow-up messages
3. WhatsApp inbound webhook (`/webhooks/whatsapp`) validates signature and stores chat history.
4. Follow-up flow progresses (`wellbeing -> symptoms -> medications -> completed`) and creates:
   - `chat_messages`
   - `check_ins`
   - `alerts` (for amber/red)
5. Apple/Android webhook endpoints (`/webhooks/apple-health`, `/webhooks/health-connect`) ingest wearable data into `wearable_readings`.
6. Local LLM (DeepSeek via Ollama) assists parsing/triage when `LOCAL_LLM_ENABLED=true`.
7. Doctor UI (`/doctor-ops`) reads shared data from `/api/v1/clinical/*`.

## 2. What Is Working Now

1. Frontend build passes (`npm run build`).
2. Frontend tests pass (`npm test`).
3. Backend tests pass (`npm --prefix backend test`).
4. Webhook security hardening is in place (signature enforcement and missing-secret fail-closed behavior).
5. Dependency vulnerabilities are currently cleared (`npm audit` and `npm --prefix backend audit` both report 0).
6. Pilot and doctor operational routes are implemented:
   - admin: `/api/v1/admin/pilot/*`
   - doctor: `/api/v1/clinical/pilot/*`

## 3. Critical Gaps (Must Fix)

1. Auth pipeline is not production-ready.
   - `backend/src/routes/auth.ts` references `authService` without import/initialization and contains multiple TODO handlers.
   - `src/components/ProtectedRoute.tsx` uses demo auth only (`useDemoAuth`) instead of backend token auth.
   - `src/pages/Login.tsx` signs in via demo mode, not real backend auth.
2. Backend TypeScript build is failing (`npm --prefix backend run build`).
   - Many type errors across middleware/routes/services block production packaging.
3. Role model mismatch across frontend/backend.
   - Frontend roles use `clinician`; backend uses `doctor`/`nurse`/`admin`/`super_admin`.
4. Core non-pilot patient routes are placeholders.
   - `backend/src/routes/patients.ts` contains multiple TODO sections.

## 4. High-Priority Gaps (Needed for Reliable Pilot)

1. Follow-up orchestration is manual only.
   - No scheduler/cron/queue for daily cohort execution.
2. Mobile app ingestion clients are not included in this repo.
   - iOS/Android must send signed payloads to webhook endpoints.
3. End-to-end auth+RBAC tests are missing for admin/clinical pilot endpoints.
4. Provider-specific webhook signature/header assumptions need real-provider validation (especially Garmin/Withings/Samsung variants).

## 5. Process to Run Pilot Locally (Current Best Path)

### Stage A: Environment and DB

1. Prepare backend env:
   - `cp backend/.env.local-pilot.example backend/.env`
2. Fill required values:
   - `JWT_SECRET`, `REFRESH_TOKEN_SECRET`, `COOKIE_SECRET`, `ENCRYPTION_KEY`
   - `DATABASE_URL`
   - `WHATSAPP_*`, `APPLE_WEBHOOK_SECRET`, `HEALTH_CONNECT_WEBHOOK_SECRET`
   - local LLM config if used
3. Sync DB schema:
   - `npm --prefix backend run db:push`
4. Optional seed:
   - `npm run db:seed`

### Stage B: Start services

1. Backend API:
   - `cd backend && npm run dev`
2. Frontend UI:
   - `cd .. && npm run dev`

### Stage C: Configure keys in UI

1. Open `/admin`.
2. Add/validate WhatsApp, Apple, Android keys in Integration Keys panel.
3. Confirm provider readiness in `/pilot-ops` runtime panel.

### Stage D: Webhook reachability

1. Start tunnel:
   - `./scripts/start_pilot_tunnel.sh cloudflare 8080`
2. Copy public endpoints to provider consoles:
   - `/webhooks/whatsapp`
   - `/webhooks/apple-health`
   - `/webhooks/health-connect`
3. Verify runtime checks in `/pilot-ops`.

### Stage E: Execute pilot flow

1. In `/pilot-ops`, ensure patient has:
   - valid E.164 WhatsApp number
   - opted-in flag enabled
2. Trigger follow-up:
   - single or batch
3. Send WhatsApp replies from patient phone.
4. Confirm persistence:
   - conversation + chat history
   - check-in and triage
   - alert creation for amber/red
5. Verify wearable sync visibility in pilot/doctor dashboards.

### Stage F: Doctor sharing mode

1. Build/deploy doctor UI with admin UI disabled (Cloudflare workflow already configured).
2. Set backend:
   - `ADMIN_LOCAL_ONLY=true`
   - `ALLOWED_ORIGINS=<doctor portal domain>`
3. Validate:
   - `/api/v1/clinical/*` works from hosted doctor portal
   - `/api/v1/admin/*` blocked externally

## 6. Security Operations Checklist

1. Rotate all provider secrets before and after demos.
2. Keep secrets backend-only (never `VITE_*` for provider tokens).
3. Keep MFA enabled for key rotation/update endpoints.
4. Review audit logs for integration-key operations.
5. Keep `npm audit` checks in CI and fail on high/critical.
6. Add backup + restore drill for local DB if pilot data is important.

## 7. Required Work Plan (Recommended Order)

### Phase 1 (P0: unblock real pipeline)

1. Fix backend auth routes and wire `authService` correctly.
2. Replace demo-only frontend auth path with real token flow.
3. Align role naming across FE/BE (`clinician` vs `doctor/nurse`).
4. Resolve backend TypeScript build failures.

### Phase 2 (P1: stabilize pilot operations)

1. Add scheduler/queue for daily follow-up batches.
2. Add end-to-end integration tests for:
   - admin key management
   - webhook ingestion
   - pilot follow-up completion and alert creation
   - doctor-scoped access controls
3. Add webhook replay/idempotency hardening tests for all providers.

### Phase 3 (P2: scale and reliability)

1. Move backend from local-only runtime to always-on host (if continuous operation required).
2. Add observability dashboards (error rate, webhook failure rate, sync lag, queue backlog).
3. Finalize retention/archive and incident runbook.

## 8. Go/No-Go Criteria for Pilot

Pilot is ready for controlled external use only when all are true:

1. Real auth and RBAC are active (no demo-only route guard).
2. Backend build passes cleanly.
3. Admin and doctor access boundaries validated.
4. Webhook signature validation verified with real provider payloads.
5. End-to-end test run passes for WhatsApp + Apple + Android data path.

## 9. Runnable Phase Commands

Use these commands as the implementation entry points:

1. `npm run phase1:ready`
   - installs dependencies
   - creates `backend/.env` from pilot template if missing
   - syncs schema (`prisma db push`) and auto-attempts Docker Postgres/Redis startup if DB is offline
   - runs frontend/backend tests and frontend build
   - optional UI-only check mode: `./scripts/phase1_ready.sh --skip-db`
2. `npm run phase2:ready`
   - enables scheduler flags for pilot follow-up
   - runs backend integration tests and high-severity dependency audits
3. `npm run phase3:ready`
   - runs production-style build/test readiness checks
4. `npm run phases:ready`
   - runs Phase 1 -> Phase 2 -> Phase 3 in sequence
   - optional for UI/test-only environments: `./scripts/run_all_phases.sh --skip-db`
