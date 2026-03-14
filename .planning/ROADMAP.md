# Roadmap: CardioWatch — Signal Guide Health

## Milestones

- ✅ **v1.0 Quick Tasks** - Pre-GSD tasks 1-12 (shipped 2026-03-14)
- 🚧 **v1.1 Pilot Hardening & Clinical Completeness** - Phases 1-7 (in progress)

## Phases

<details>
<summary>✅ v1.0 Quick Tasks (Pre-GSD, tasks 1-12) - SHIPPED 2026-03-14</summary>

Completed as unstructured quick tasks before GSD workflow was adopted. Covered: patient API, JWT auth, Redis rate limiting, DB health check, WhatsApp/LLM triage, device pairing, appointments CRUD, alerts CRUD, PatientDetail wiring, doctors CRUD, admin real API, K8s manifests, TypeScript clean.

</details>

### 🚧 v1.1 Pilot Hardening & Clinical Completeness (In Progress)

**Milestone Goal:** Close all gaps blocking real clinical use — real wearable data, clinician notifications, cardiac metrics, security hardening, and growth features for multi-clinic expansion.

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

- [x] **Phase 1: Wearable Data Ingestion** - Replace simulated provider sync with real Fitbit, Apple HealthKit, Garmin, and Withings data plus threshold alert automation
- [ ] **Phase 2: Dashboard & Cardiac Metrics** - Align all dashboard fields to live API data and add clinician-facing cardiac metric entry and computed risk scores
- [ ] **Phase 3: Clinician Alert Notifications** - Email and in-app real-time notifications for RED/AMBER triage events with configurable preferences
- [ ] **Phase 4: Security Hardening & Appointment Reminders** - Account lockout, mandatory 2FA enforcement, and WhatsApp/email appointment reminders
- [ ] **Phase 5: Audit Log Viewer** - Admin UI for paginated, filterable, exportable GDPR audit log
- [ ] **Phase 6: Multi-Org Support** - Super-admin multi-clinic management with strict per-org data scoping
- [ ] **Phase 7: Clinician Mobile App** - React Native app for patient monitoring and alert management on mobile

## Phase Details

### Phase 1: Wearable Data Ingestion
**Goal**: Clinicians see real wearable readings — not simulated data — and the system automatically raises alerts when vitals cross thresholds
**Depends on**: Nothing (first phase of v1.1; v1.0 device pairing is complete)
**Requirements**: WEAR-01, WEAR-02, WEAR-03, WEAR-04, WEAR-05
**Success Criteria** (what must be TRUE):
  1. A patient's Fitbit heart rate, SpO2, steps, and temperature appear in the dashboard after OAuth authorisation — no simulated data (BP not available on Fitbit hardware)
  2. A patient's Apple HealthKit vitals arrive via the push endpoint and populate the same wearable reading record
  3. Garmin Connect and Withings OAuth flows complete and their readings persist identically to Fitbit and Apple; Withings provides BP data
  4. When a wearable reading exceeds a configured HR, BP, or SpO2 threshold, an Alert record is created automatically and appears in the alerts list without manual intervention
**Plans**: 5 plans

Plans:
- [x] 01-01-PLAN.md — Fitbit OAuth PKCE provider class + DB unique constraint + oauth-1.0a install
- [x] 01-02-PLAN.md — Withings OAuth2 provider class (non-standard token exchange, BP/HR/SpO2/temp)
- [x] 01-03-PLAN.md — Garmin OAuth 1.0a provider class + webhook push route
- [x] 01-04-PLAN.md — Apple HealthKit push handler: wire all metric processors to recordReading()
- [x] 01-05-PLAN.md — Wire all providers into factory, replace simulateProviderSync(), PKCE Redis storage

### Phase 2: Dashboard & Cardiac Metrics
**Goal**: Every value on the dashboard and patient detail page is sourced from the live API, and clinicians can record and view cardiac metrics per patient
**Depends on**: Phase 1
**Requirements**: DASH-01, DASH-02, DASH-03, CARD-01, CARD-02, CARD-03
**Success Criteria** (what must be TRUE):
  1. Dashboard vitals panel (HR, SpO2, BP, steps) renders values returned by the API — removing hardcoded mock schema access causes no crashes or blank fields
  2. Patient list triage badges (RED/AMBER/GREEN) reflect the actual alert and wearable state returned by the API, not a static computed field
  3. When a patient has no cardiac metrics recorded, the dashboard shows "Not recorded" for EF, BNP, and GRACE fields instead of crashing or displaying undefined
  4. A clinician can open a patient detail page and enter ejection fraction, BNP/NT-proBNP, troponin, and NYHA class — the values persist and are visible on reload
  5. GRACE and CHA2DS2-VASc risk scores are computed server-side and displayed on the patient detail page — no client-side scoring logic required
**Plans**: TBD

### Phase 3: Clinician Alert Notifications
**Goal**: Clinicians are notified of critical patient deterioration through email and an in-app bell, and can control how they receive those notifications
**Depends on**: Phase 1
**Requirements**: NOTIF-01, NOTIF-02, NOTIF-03, NOTIF-04
**Success Criteria** (what must be TRUE):
  1. When a RED triage alert is created for a clinician's patient, that clinician receives an email within a reasonable delivery window
  2. If a RED alert is not acknowledged within 30 minutes, the clinician receives an escalation email automatically
  3. The navigation bar notification bell updates its unread count when a new alert arrives — without requiring a page refresh
  4. A clinician can open notification preferences and toggle email alerts on or off and set an escalation threshold — the setting persists across sessions
**Plans**: TBD

### Phase 4: Security Hardening & Appointment Reminders
**Goal**: Clinician accounts are protected by lockout and mandatory 2FA, and patients and clinicians receive timely appointment reminders
**Depends on**: Phase 2, Phase 3
**Requirements**: SEC-01, SEC-02, SEC-03, APPT-01, APPT-02, APPT-03
**Success Criteria** (what must be TRUE):
  1. After 5 consecutive failed login attempts, a clinician account is locked for 15 minutes — further login attempts during that window are rejected with a clear message
  2. A doctor or admin account that has not completed TOTP 2FA setup is blocked from accessing patient data endpoints — the API rejects the token with an appropriate error
  3. A request bearing a token without the mfa_verified claim cannot bypass 2FA enforcement on protected routes — even if the JWT is otherwise valid
  4. A patient receives a WhatsApp message 24 hours before a scheduled appointment and again 1 hour before
  5. The responsible clinician receives an email reminder 1 hour before their scheduled appointments
**Plans**: TBD

### Phase 5: Audit Log Viewer
**Goal**: Admins can inspect, filter, and export the full audit trail of patient data access to satisfy GDPR compliance reporting requirements
**Depends on**: Phase 4
**Requirements**: AUDIT-01, AUDIT-02, AUDIT-03
**Success Criteria** (what must be TRUE):
  1. An admin can open the audit log page and see a paginated list of patient data access events — each row shows who accessed what and when
  2. An admin can filter the audit log by user, patient, action type, and date range — the list updates to show only matching events
  3. An admin can export the current filtered audit log as a CSV file suitable for submission to a GDPR compliance report
**Plans**: TBD

### Phase 6: Multi-Org Support
**Goal**: Multiple clinic organisations can operate on the same platform without any cross-org data exposure, each managed by their own admin
**Depends on**: Phase 4
**Requirements**: ORG-01, ORG-02, ORG-03
**Success Criteria** (what must be TRUE):
  1. A super-admin can create a new clinic organisation and assign it an admin user — the organisation appears in the super-admin management view
  2. A doctor in Organisation A cannot see patients, alerts, or appointments belonging to Organisation B — all data queries are scoped by org
  3. An org-level admin can add and remove users within their own clinic and cannot access or modify users in another organisation
**Plans**: TBD

### Phase 7: Clinician Mobile App
**Goal**: Clinicians can monitor patients and act on alerts from a React Native mobile app using the same credentials and live data as the web platform
**Depends on**: Phase 3, Phase 6
**Requirements**: MOB-01, MOB-02, MOB-03, MOB-04, MOB-05
**Success Criteria** (what must be TRUE):
  1. A clinician can log in to the React Native app with their existing web credentials and land on the patient list
  2. The patient list on mobile shows triage status badges and unread alert counts that match the web dashboard
  3. Tapping a patient opens a detail view showing current vitals and recent alerts sourced from the live API
  4. When a RED triage alert is created, the clinician's mobile device receives a push notification
  5. A clinician can acknowledge and resolve an alert from the mobile app — the change is reflected on the web dashboard immediately
**Plans**: TBD

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 2 → 3 → 4 → 5 → 6 → 7

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 1. Wearable Data Ingestion | 3/5 | In Progress|  | - |
| 2. Dashboard & Cardiac Metrics | v1.1 | 0/TBD | Not started | - |
| 3. Clinician Alert Notifications | v1.1 | 0/TBD | Not started | - |
| 4. Security Hardening & Appointment Reminders | v1.1 | 0/TBD | Not started | - |
| 5. Audit Log Viewer | v1.1 | 0/TBD | Not started | - |
| 6. Multi-Org Support | v1.1 | 0/TBD | Not started | - |
| 7. Clinician Mobile App | v1.1 | 0/TBD | Not started | - |
