#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

ENABLE_SCHEDULER="${1:-true}"

if [[ ! -f backend/.env ]]; then
  echo "backend/.env is required. Run ./scripts/phase1_ready.sh first."
  exit 1
fi

if [[ "$ENABLE_SCHEDULER" == "true" ]]; then
  echo "[Phase 2] Enabling pilot scheduler defaults in backend/.env"
  grep -q '^PILOT_FOLLOWUP_SCHEDULER_ENABLED=' backend/.env \
    && sed -i 's/^PILOT_FOLLOWUP_SCHEDULER_ENABLED=.*/PILOT_FOLLOWUP_SCHEDULER_ENABLED=true/' backend/.env \
    || echo 'PILOT_FOLLOWUP_SCHEDULER_ENABLED=true' >> backend/.env

  grep -q '^PILOT_FOLLOWUP_INTERVAL_MINUTES=' backend/.env \
    && sed -i 's/^PILOT_FOLLOWUP_INTERVAL_MINUTES=.*/PILOT_FOLLOWUP_INTERVAL_MINUTES=1440/' backend/.env \
    || echo 'PILOT_FOLLOWUP_INTERVAL_MINUTES=1440' >> backend/.env

  grep -q '^PILOT_FOLLOWUP_BATCH_LIMIT=' backend/.env \
    && sed -i 's/^PILOT_FOLLOWUP_BATCH_LIMIT=.*/PILOT_FOLLOWUP_BATCH_LIMIT=25/' backend/.env \
    || echo 'PILOT_FOLLOWUP_BATCH_LIMIT=25' >> backend/.env
fi

echo "[Phase 2] Running backend webhook/integration tests"
npm --prefix backend test

echo "[Phase 2] Running security audits"
npm audit --audit-level=high
npm --prefix backend audit --audit-level=high

cat <<MSG
[Phase 2] Ready.
Next:
1) Start backend: cd backend && npm run dev
2) Start tunnel: ./scripts/start_pilot_tunnel.sh cloudflare 8080
3) Run smoke test with token:
   ./scripts/pilot_smoke_test.sh http://localhost:8080 <BEARER_TOKEN>
MSG
