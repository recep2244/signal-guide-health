# Requirements: CardioWatch — Signal Guide Health

**Defined:** 2026-03-14
**Core Value:** Clinicians see deteriorating cardiac patients before they re-admit — through continuous wearable monitoring, daily WhatsApp check-ins, and automated triage escalation.

## v1.1 Requirements

### Wearable Data Ingestion

- [x] **WEAR-01**: System syncs real heart rate, blood pressure, SpO2, steps, and temperature from Fitbit via OAuth
- [ ] **WEAR-02**: System syncs real heart rate, blood pressure, SpO2, steps, and temperature from Apple HealthKit push endpoint
- [x] **WEAR-03**: System syncs real data from Garmin Connect via OAuth
- [ ] **WEAR-04**: System syncs real data from Withings via OAuth
- [ ] **WEAR-05**: Wearable readings trigger threshold alerts (HR, BP, SpO2) and create Alert records automatically

### Dashboard & API Alignment

- [ ] **DASH-01**: Dashboard vitals (HR, SpO2, BP, steps) sourced from real backend API fields — no hardcoded mock schema access
- [ ] **DASH-02**: Patient list triage badges computed from real alert and wearable data returned by API
- [ ] **DASH-03**: Dashboard handles gracefully when cardiac metric fields (EF, BNP, GRACE) are absent — shows "Not recorded" instead of crashing

### Cardiac Metrics

- [ ] **CARD-01**: Clinician can manually enter cardiac metrics per patient (ejection fraction, BNP/NT-proBNP, troponin, NYHA class)
- [ ] **CARD-02**: GRACE and CHA2DS2-VASc risk scores computed server-side from patient data and returned by API
- [ ] **CARD-03**: Patient detail page displays cardiac metrics from API (not hardcoded)

### Clinician Alert Notifications

- [ ] **NOTIF-01**: Clinician receives email when a RED triage alert is created for their patient
- [ ] **NOTIF-02**: Clinician receives email when a RED alert escalates (no acknowledgement within 30 minutes)
- [ ] **NOTIF-03**: In-app notification bell shows unread alert count in real-time (polling or WebSocket)
- [ ] **NOTIF-04**: Clinician can configure notification preferences (email on/off, escalation threshold)

### Security Hardening

- [ ] **SEC-01**: Account locked for 15 minutes after 5 consecutive failed login attempts (uses existing failedLoginAttempts field)
- [ ] **SEC-02**: Admin and doctor accounts must complete 2FA (TOTP) setup before accessing patient data
- [ ] **SEC-03**: 2FA enforcement bypass blocked — protected routes reject tokens without mfa_verified claim

### Appointment Reminders

- [ ] **APPT-01**: Patient receives WhatsApp reminder 24 hours before a scheduled appointment
- [ ] **APPT-02**: Patient receives WhatsApp reminder 1 hour before a scheduled appointment
- [ ] **APPT-03**: Clinician receives email reminder 1 hour before their scheduled appointments

### Audit Log Viewer

- [ ] **AUDIT-01**: Admin can view paginated audit log of all patient data access events
- [ ] **AUDIT-02**: Audit log is filterable by user, patient, action type, and date range
- [ ] **AUDIT-03**: Admin can export audit log as CSV for GDPR compliance reporting

### Multi-Org / Multi-Clinic

- [ ] **ORG-01**: Super-admin can create and manage multiple clinic organisations
- [ ] **ORG-02**: Patients, doctors, and data are scoped to their organisation — no cross-org data leakage
- [ ] **ORG-03**: Each organisation has its own admin user who manages their clinic's users

### Clinician Mobile App

- [ ] **MOB-01**: Clinician can log in to React Native mobile app with same credentials as web
- [ ] **MOB-02**: Mobile app shows patient list with triage status and unread alert count
- [ ] **MOB-03**: Mobile app shows patient detail with current vitals and recent alerts
- [ ] **MOB-04**: Mobile app delivers push notifications for RED triage alerts
- [ ] **MOB-05**: Mobile app allows clinician to acknowledge and resolve alerts

## v2 Requirements (Deferred)

### Lab Integration
- **LAB-01**: HL7/FHIR integration to auto-import lab results (BNP, troponin) from hospital systems
- **LAB-02**: Automatic GRACE score update when new lab values arrive

### Advanced Analytics
- **ANAL-01**: 30-day readmission risk prediction model (ML)
- **ANAL-02**: Population-level dashboard for NHS trust management

### Patient Portal
- **PAT-01**: Patient self-service portal to view own vitals and upcoming appointments
- **PAT-02**: Patient can message clinical team via secure in-app messaging

## Out of Scope

| Feature | Reason |
|---------|--------|
| Native iOS (Swift) / Android (Kotlin) apps | React Native covers mobile need with existing TS expertise |
| Video consultation | Not core to remote monitoring workflow |
| Billing/payments | NHS context — not applicable |
| HL7/FHIR direct integration | v2 — manual cardiac entry sufficient for pilot expansion |
| Real-time ECG streaming | Hardware complexity out of scope |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| WEAR-01 | Phase 1 | Complete (01-01) |
| WEAR-02 | Phase 1 | Pending |
| WEAR-03 | Phase 1 | Complete |
| WEAR-04 | Phase 1 | Pending |
| WEAR-05 | Phase 1 | Pending |
| DASH-01 | Phase 2 | Pending |
| DASH-02 | Phase 2 | Pending |
| DASH-03 | Phase 2 | Pending |
| CARD-01 | Phase 2 | Pending |
| CARD-02 | Phase 2 | Pending |
| CARD-03 | Phase 2 | Pending |
| NOTIF-01 | Phase 3 | Pending |
| NOTIF-02 | Phase 3 | Pending |
| NOTIF-03 | Phase 3 | Pending |
| NOTIF-04 | Phase 3 | Pending |
| SEC-01 | Phase 4 | Pending |
| SEC-02 | Phase 4 | Pending |
| SEC-03 | Phase 4 | Pending |
| APPT-01 | Phase 4 | Pending |
| APPT-02 | Phase 4 | Pending |
| APPT-03 | Phase 4 | Pending |
| AUDIT-01 | Phase 5 | Pending |
| AUDIT-02 | Phase 5 | Pending |
| AUDIT-03 | Phase 5 | Pending |
| ORG-01 | Phase 6 | Pending |
| ORG-02 | Phase 6 | Pending |
| ORG-03 | Phase 6 | Pending |
| MOB-01 | Phase 7 | Pending |
| MOB-02 | Phase 7 | Pending |
| MOB-03 | Phase 7 | Pending |
| MOB-04 | Phase 7 | Pending |
| MOB-05 | Phase 7 | Pending |

**Coverage:**
- v1.1 requirements: 31 total
- Mapped to phases: 31
- Unmapped: 0 ✓

---
*Requirements defined: 2026-03-14*
*Last updated: 2026-03-14 after initial definition*
