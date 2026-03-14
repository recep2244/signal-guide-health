# CardioWatch — Signal Guide Health

## What This Is

CardioWatch is a clinical-grade remote patient monitoring platform for post-discharge cardiac care, currently in NHS pilot. It connects clinicians to patients via a real-time dashboard, automated WhatsApp follow-up with LLM triage, wearable device ingestion, and a full clinical workflow (alerts, appointments, prescriptions). It runs in two modes: pilot (live auth, real patients) and demo (mock data for investors).

## Core Value

Clinicians see deteriorating cardiac patients before they re-admit — through continuous wearable monitoring, daily WhatsApp check-ins, and automated triage escalation.

## Current Milestone: v1.1 — Pilot Hardening & Clinical Completeness

**Goal:** Close all gaps blocking real clinical use — real wearable data, clinician notifications, cardiac metrics, security hardening, and growth features for multi-clinic expansion.

**Target features:**
- Real wearable provider sync (Fitbit, Apple HealthKit complete, Garmin, Withings)
- Dashboard ↔ API field alignment (no hardcoded mock fields)
- Clinician alert notifications (email/push on RED/AMBER triage)
- Account lockout + 2FA enforcement for clinicians
- Cardiac metrics pipeline (EF, BNP, TnI, GRACE score)
- Appointment reminders (WhatsApp/email 24h before)
- Audit log viewer UI (GDPR compliance)
- Multi-org / multi-clinic support
- Clinician mobile app (React Native)

## Requirements

### Validated (Milestone v1.0 — quick tasks 1–12)

- ✓ Patient API endpoints (CRUD, triage, GDPR soft-delete) — v1.0
- ✓ JWT auth with refresh tokens, password reset — v1.0
- ✓ Redis rate limiting (shared across K8s replicas) — v1.0
- ✓ DB health check (/ready endpoint) — v1.0
- ✓ WhatsApp → LLM triage pipeline (rule + DeepSeek, wearable context) — v1.0
- ✓ Device pairing (TOTP, NFC, BLE, QR, deep link) — v1.0
- ✓ Appointments CRUD (role-scoped) — v1.0
- ✓ Alerts CRUD (create, resolve, escalate, acknowledge) — v1.0
- ✓ PatientDetail fully wired (all action buttons) — v1.0
- ✓ Doctors CRUD (list, detail, patients, schedule) — v1.0
- ✓ Admin real API (users, audit logs, stats) — v1.0
- ✓ K8s infrastructure manifests (Postgres, Redis, secrets, Dockerfile) — v1.0
- ✓ TypeScript clean — zero errors frontend + backend — v1.0

### Active (Milestone v1.1)

See REQUIREMENTS.md

### Out of Scope

- Native iOS/Android apps built with Swift/Kotlin — React Native covers mobile need
- Lab system (HL7/FHIR) direct integration — manual cardiac metric entry for now
- Video consultation — not core to monitoring workflow
- Billing/payments — NHS context, not needed

## Context

- NHS pilot: real clinicians, real patients, live cardiac monitoring
- Investors use /demo portal with mock data (must not break)
- Stack: React 18 + TypeScript + Express + Prisma + PostgreSQL + Redis + WhatsApp Business API + Ollama/DeepSeek
- K8s deployment (3 replicas, HPA to 10)
- GDPR compliance required — patient data must be auditable and deletable
- The wearable sync currently uses `simulateProviderSync()` (random data) — must be replaced

## Constraints

- **Security**: NHS clinical data — all PHI must be encrypted at rest and in transit
- **GDPR**: Audit log, soft delete, data export must work before wider rollout
- **Stack**: No framework rewrites — extend existing React/Express/Prisma stack
- **Mobile**: React Native only (not Swift/Kotlin) — team has TS expertise
- **Wearable APIs**: Fitbit and Apple HealthKit first (most NHS patient coverage)

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| TOTP secret derived from token bytes | No DB column change needed | ✓ Good |
| GDPR soft-delete (anonymise email) | NHS compliance | ✓ Good |
| Redis in-memory fallback | Graceful degradation in dev | ✓ Good |
| simulateProviderSync() for wearables | Unblocked dev, must be replaced | ⚠️ Revisit |
| Draft Rx / complaints POST to /alerts | Pragmatic stub — needs real endpoints | ⚠️ Revisit |
| Cardiac metrics hardcoded in Dashboard | Unblocked demo — must be API-driven | ⚠️ Revisit |

---
*Last updated: 2026-03-14 after Milestone v1.0 completion and audit*
