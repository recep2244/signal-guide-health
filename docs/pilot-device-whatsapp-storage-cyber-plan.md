# Pilot Plan: Device Match, WhatsApp Interface, Storage, Cyber Actions

## 1) Device Matching Plan

### 1.1 Identity model
- Use `patient.id` as the single internal source of truth.
- Bind channels to patient:
  - WhatsApp: normalized E.164 phone (`+1...`) in `patients.whatsapp_phone`
  - Apple Watch: `wearable_devices.serial_number` (or vendor device ID)
  - Mobile app session: authenticated `userId` from your iOS app token

### 1.2 Enrollment flow (recommended)
1. Admin creates/enables patient profile with consent.
2. Patient verifies WhatsApp ownership (OTP or one-time verification message).
3. Patient signs in to iOS app and links Apple Health permissions.
4. iOS app registers Apple Watch device with backend (`/api/v1/wearables/register-device`).
5. Backend stores mapping: `patientId <-> whatsappPhone <-> deviceId`.

### 1.3 Matching rules
- Phone normalization before compare (strip spaces/dashes, enforce `+` country code).
- Reject duplicate active mapping:
  - One active WhatsApp number should not map to multiple active patients.
  - One active device ID should not map to multiple active patients.
- Store confidence + source:
  - `matched_by`: `otp_verified` | `manual_admin` | `device_token`
  - `matched_at`, `matched_by_user_id`

### 1.4 Reconciliation jobs
- Daily job: detect collisions and stale mappings.
- Alert if:
  - same WhatsApp phone appears on multiple active patients
  - device sync received for unknown/mismatched patient
  - no Apple Watch sync in >24h for enrolled patient

## 2) WhatsApp Interface Plan

### 2.1 Conversation design
- Keep pilot flow deterministic:
  - `wellbeing -> symptoms -> medications -> completed`
- Use quick replies/buttons for YES/NO and score choices where possible.
- Keep fallback parser for free text.

### 2.2 Message UX standards
- First message includes patient first name and purpose.
- Each question should be single-intent.
- For parse failures: one short retry prompt, then escalation to human review.
- Completion message must include triage outcome and expectation.

### 2.3 Operational states
- `active`, `paused`, `resolved`, `failed_delivery`.
- Timeout rules:
  - no patient reply in 2h: reminder
  - no reply in 24h: mark missed check-in
- Escalation:
  - RED: urgent callback queue
  - AMBER: same-day review queue

### 2.4 Dashboard metrics
- send -> delivered -> read conversion
- completion rate
- median response time per step
- RED/AMBER volume and callback SLA

## 3) Storage Plan

### 3.1 Core data stores
- Keep current relational model (Postgres + Prisma) for operational records:
  - `patients`, `wearable_devices`, `wearable_readings`
  - `conversations`, `chat_messages`, `check_ins`, `alerts`
- Add analytics rollups (hour/day) for fast dashboard reads:
  - e.g. `pilot_kpi_hourly` materialized aggregates

### 3.2 Data retention
- Raw chat + webhook payload metadata: 90 days hot storage, then archive.
- Clinical summaries/check-ins/alerts: per policy (typically years, jurisdiction dependent).
- Keep PHI minimization: only store fields needed for care operations.

### 3.3 Data quality and audit
- Idempotency keys for webhook ingestion (`whatsapp_message_id`, provider event ID).
- Full audit logs for:
  - mapping changes
  - manual overrides
  - alert resolution actions

### 3.4 Backups and recovery
- Postgres PITR enabled.
- Daily backup verification restore test (non-prod environment).
- Recovery objectives:
  - RPO <= 15 min
  - RTO <= 2 hours

## 4) Cybersecurity Action Plan

### 4.1 Immediate actions (Week 1-2)
- Enforce raw-body HMAC verification for WhatsApp/Apple webhooks.
- Rotate all webhook/API secrets; move to secret manager (not file-based in prod).
- Lock ingress:
  - TLS everywhere
  - IP/rate limiting on webhook endpoints
- Enable structured security logs and alerting for:
  - signature failures
  - auth failures
  - unusual message spikes

### 4.2 Hardening actions (Week 3-6)
- RBAC tightening:
  - admin-only pilot operations
  - least privilege DB roles
- Encrypt sensitive fields at app layer where needed.
- Add WAF rules and bot filtering for public endpoints.
- Implement dependency and container vulnerability gates in CI.
- Add SAST + secret scanning + IaC scanning in CI.

### 4.3 Compliance/security governance (Week 6-10)
- HIPAA/SOC2 style control mapping (or local healthcare equivalent).
- Incident response runbook:
  - detect, contain, eradicate, recover, postmortem
- Tabletop exercise for:
  - compromised webhook secret
  - data exfiltration attempt
  - ransomware-style availability incident

### 4.4 Security KPIs
- Mean time to detect (MTTD)
- Mean time to contain (MTTC)
- % webhook requests failing signature
- % privileged actions with audit trail
- patch SLA compliance (critical/high)

## 5) 30-60-90 Execution Plan

### 30 days
- Stable patient-device-phone matching.
- Pilot Ops dashboard live (`/pilot-ops`) with real data.
- Webhook signature + secret management hardened.

### 60 days
- Automated reconciliation + stale-sync alerts.
- Dashboard SLA metrics and callback performance tracking.
- Security controls integrated in CI/CD and runtime alerts.

### 90 days
- Security incident drills completed.
- Retention/archive lifecycle active.
- Production readiness review completed for scale-up cohort.

## 6) Decisions Needed From You
- Primary compliance target: HIPAA only, or HIPAA + SOC2?
- Retention policy for chat data and wearable raw data.
- Callback SLA targets (RED and AMBER).
- Whether to allow one patient to have multiple WhatsApp numbers.
