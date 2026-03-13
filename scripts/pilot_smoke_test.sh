#!/usr/bin/env bash
set -euo pipefail

BASE_URL="${1:-http://localhost:8080}"
AUTH_TOKEN="${2:-}"

if [[ -z "$AUTH_TOKEN" ]]; then
  echo "Usage: $0 <base_url> <admin_or_doctor_bearer_token>"
  exit 1
fi

echo "[Smoke] health"
curl -fsS "$BASE_URL/health" >/dev/null

echo "[Smoke] admin pilot overview"
curl -fsS -H "Authorization: Bearer $AUTH_TOKEN" "$BASE_URL/api/v1/admin/pilot/overview?hours=24" >/dev/null

echo "[Smoke] clinical pilot overview"
curl -fsS -H "Authorization: Bearer $AUTH_TOKEN" "$BASE_URL/api/v1/clinical/pilot/overview?hours=24" >/dev/null

echo "[Smoke] webhook reachability"
curl -s -o /dev/null -w "%{http_code}\n" "$BASE_URL/webhooks/whatsapp" | grep -Eq '^(200|403)$'

echo "[Smoke] passed"
