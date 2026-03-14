---
phase: quick
plan: 9
subsystem: infrastructure
tags: [kubernetes, postgres, redis, dockerfile, manifests]
key-files:
  created:
    - infrastructure/kubernetes/postgres-deployment.yaml
    - infrastructure/kubernetes/redis-deployment.yaml
    - .env.production
  modified:
    - infrastructure/kubernetes/secrets.yaml
    - backend/Dockerfile
decisions:
  - "Recreate strategy for postgres Deployment (required for single-replica with PVC)"
  - "No PVC for Redis — cache-only usage; data loss on restart is acceptable"
  - "Shell-form CMD in Dockerfile to chain prisma migrate deploy before node dist/app.js"
  - "postgres-password and redis-password keys added after existing redis-url key in secrets.yaml"
metrics:
  duration: "~10 minutes"
  completed: "2026-03-14"
  tasks: 3
  files: 5
---

# Phase quick Plan 9: Infrastructure Manifests (Postgres + Redis) Summary

**One-liner:** Kubernetes manifests for PostgreSQL 16 (PVC-backed) and Redis 7 (cache-only), plus secrets HOWTO block, Dockerfile migration entrypoint, and frontend .env.production.

## Files Created / Modified

### Created

- `infrastructure/kubernetes/postgres-deployment.yaml` — PVC (20Gi, ReadWriteOnce) + Deployment (postgres:16-alpine, Recreate, password from secret) + ClusterIP Service on 5432
- `infrastructure/kubernetes/redis-deployment.yaml` — Deployment (redis:7-alpine, Recreate, no PVC, password from secret) + ClusterIP Service on 6379
- `.env.production` — Frontend Vite production env: mock flags false, VITE_API_BASE_URL=/api/v1

### Modified

- `infrastructure/kubernetes/secrets.yaml` — Prepended HOWTO comment block with generation commands and deployment instructions; added `postgres-password` and `redis-password` keys to stringData
- `backend/Dockerfile` — Replaced exec-form `CMD ["node", "dist/app.js"]` with shell-form `CMD npx prisma migrate deploy && node dist/app.js`

## Key Decisions

1. **Recreate strategy for postgres** — Single-replica deployment with a PVC requires Recreate (not RollingUpdate) to avoid two pods competing for the same PersistentVolumeClaim.
2. **No PVC for Redis** — Redis is used as a cache and rate-limit store; a fresh empty cache on restart is acceptable and avoids PVC management overhead.
3. **Shell-form Dockerfile CMD** — The `&&` chaining requires a shell; exec-form arrays cannot chain commands. `npx prisma migrate deploy` is idempotent and safe on every startup.
4. **Secrets placement** — `postgres-password` and `redis-password` placed immediately after `redis-url` to keep DB-related credentials grouped together.

## Commits

| Task | Commit | Description |
|------|--------|-------------|
| 1 | 4307d37 | feat(quick-9): Task 1 — postgres-deployment.yaml and redis-deployment.yaml |
| 2 | 6c79a30 | feat(quick-9): Task 2 — secrets.yaml HOWTO block + new keys; .env.production |
| 3 | f9395a2 | feat(quick-9): Task 3 — Dockerfile entrypoint runs prisma migrate deploy |

## Deviations from Plan

None — plan executed exactly as written.

## Self-Check: PASSED

- infrastructure/kubernetes/postgres-deployment.yaml: EXISTS
- infrastructure/kubernetes/redis-deployment.yaml: EXISTS
- infrastructure/kubernetes/secrets.yaml: HOWTO block present, postgres-password + redis-password keys added
- backend/Dockerfile: CMD line ends with `npx prisma migrate deploy && node dist/app.js`
- .env.production: EXISTS, VITE_ENABLE_MOCK_DATA=false, VITE_ENABLE_PILOT_MOCK_DATA=false, VITE_API_BASE_URL=/api/v1
- All YAML files parse without errors (yaml.safe_load_all)
