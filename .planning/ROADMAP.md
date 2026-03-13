# CardioWatch — Signal Guide Health — Roadmap

## Project Overview

CardioWatch is a clinical-grade remote patient monitoring platform for post-discharge cardiac care (NHS pilot). It operates in pilot mode (live, real auth) and demo mode (investor mock data). Core subsystems: React SPA, Express/Prisma API, WhatsApp follow-up pipeline with local LLM triage.

## Milestone 1: Production Readiness

Fix critical bugs, implement missing API layer, wire infrastructure correctly, and harden the system for the live NHS pilot.

### Phase 1: Bug Fixes & Infrastructure Hardening
**Goal:** Resolve all critical and high-severity issues blocking the pilot.

1. Implement patient API endpoints (currently all stubs)
2. Fix broken Dashboard.test.tsx (imports deleted file)
3. Wire Redis for shared rate limiting across K8s replicas
4. Restore DB health check in /ready endpoint
5. Move integration key tables to proper Prisma migrations
6. Implement password reset email (currently silent stub)
7. Add WhatsApp per-patient daily deduplication

**Status:** Not started
