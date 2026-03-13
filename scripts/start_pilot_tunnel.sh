#!/usr/bin/env bash

set -euo pipefail

PROVIDER="${1:-cloudflare}"
TARGET_PORT="${2:-8080}"
TARGET_URL="http://localhost:${TARGET_PORT}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
BACKEND_ENV_FILE="${REPO_DIR}/backend/.env"

require_cmd() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "Missing required command: $1"
    exit 1
  fi
}

resolve_bin() {
  local cmd="$1"
  local fallback="${SCRIPT_DIR}/bin/${cmd}"
  if command -v "$cmd" >/dev/null 2>&1; then
    command -v "$cmd"
    return 0
  fi

  if [[ -x "$fallback" ]]; then
    echo "$fallback"
    return 0
  fi

  return 1
}

assert_backend_env_exists() {
  if [[ ! -f "$BACKEND_ENV_FILE" ]]; then
    echo "Missing backend env file: ${BACKEND_ENV_FILE}"
    echo "Create it from template:"
    echo "  cp backend/.env.local-pilot.example backend/.env"
    exit 1
  fi
}

wait_for_backend() {
  local max_wait_seconds=45
  local sleep_seconds=2
  local elapsed=0

  while (( elapsed < max_wait_seconds )); do
    if curl -fsS --max-time 2 "${TARGET_URL}/health" >/dev/null 2>&1; then
      return 0
    fi
    sleep "${sleep_seconds}"
    elapsed=$((elapsed + sleep_seconds))
  done

  echo "Backend health check failed at ${TARGET_URL}/health"
  echo "Start backend first:"
  echo "  cd backend && npm run dev"
  exit 1
}

print_banner() {
  echo "Starting pilot tunnel"
  echo "====================="
  echo "Provider: ${PROVIDER}"
  echo "Target:   ${TARGET_URL}"
  echo ""
}

parse_and_stream() {
  local regex="$1"
  local seen=""
  while IFS= read -r line; do
    echo "$line"
    if [[ -z "$seen" && "$line" =~ $regex ]]; then
      local public_url="${BASH_REMATCH[0]}"
      echo ""
      "${SCRIPT_DIR}/pilot_webhook_endpoints.sh" "$public_url"
      echo ""
      echo "Keep this process running during pilot webhook testing."
      seen="1"
    fi
  done
}

print_banner
assert_backend_env_exists
wait_for_backend

if [[ "$PROVIDER" == "cloudflare" ]]; then
  if ! CLOUDFLARED_BIN="$(resolve_bin cloudflared)"; then
    echo "cloudflared not found."
    echo "Install helper:"
    echo "  ./scripts/setup_cloudflared.sh"
    exit 1
  fi

  "${CLOUDFLARED_BIN}" tunnel --url "${TARGET_URL}" --no-autoupdate 2>&1 | parse_and_stream 'https://[a-zA-Z0-9.-]+\.trycloudflare\.com'
  exit 0
fi

if [[ "$PROVIDER" == "ngrok" ]]; then
  require_cmd ngrok
  ngrok http "${TARGET_URL}" --log=stdout 2>&1 | parse_and_stream 'https://[a-zA-Z0-9.-]+\.ngrok(-free)?\.app'
  exit 0
fi

echo "Unsupported provider: ${PROVIDER}"
echo "Usage: $0 [cloudflare|ngrok] [backend_port]"
exit 1
