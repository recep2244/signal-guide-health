#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

echo "[Phase 3] Production-style readiness checks"

npm run build
npm test
npm --prefix backend test

if [[ -f backend/.env ]]; then
  echo "[Phase 3] Checking hardening flags"
  grep -Eq '^ADMIN_LOCAL_ONLY=true' backend/.env || echo "WARN: set ADMIN_LOCAL_ONLY=true for hosted doctor mode"
  grep -Eq '^ENABLE_MFA=true' backend/.env || echo "WARN: set ENABLE_MFA=true"
fi

cat <<MSG
[Phase 3] Ready.
Operational steps:
1) Host doctor UI via Cloudflare workflow (.github/workflows/deploy.yml)
2) Keep backend private/local admin with ADMIN_LOCAL_ONLY=true
3) Run recurring checks:
   npm audit --audit-level=high
   npm --prefix backend audit --audit-level=high
4) Backup local DB daily (example):
   pg_dump "\$DATABASE_URL" > backups/cardiowatch_$(date +%F).sql
MSG
