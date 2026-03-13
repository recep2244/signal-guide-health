#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

start_services=false
skip_db_sync=false
for arg in "$@"; do
  case "$arg" in
    --start)
      start_services=true
      ;;
    --skip-db)
      skip_db_sync=true
      ;;
  esac
done

DOCKER_COMPOSE_CMD=""

resolve_docker_compose() {
  if docker compose version >/dev/null 2>&1; then
    DOCKER_COMPOSE_CMD="docker compose"
    return 0
  fi

  if command -v docker-compose >/dev/null 2>&1; then
    DOCKER_COMPOSE_CMD="docker-compose"
    return 0
  fi

  return 1
}

sync_db_schema() {
  echo "[Phase 1] Syncing DB schema"
  if npm --prefix backend run db:push; then
    return 0
  fi

  echo "[Phase 1] DB sync failed. Attempting to start local Postgres/Redis via Docker."
  if ! resolve_docker_compose; then
    echo "Docker Compose is not available."
    echo "Start PostgreSQL manually and rerun:"
    echo "  npm --prefix backend run db:push"
    exit 1
  fi

  # shellcheck disable=SC2086
  $DOCKER_COMPOSE_CMD -f infrastructure/docker/docker-compose.yml up -d postgres redis
  sleep 4
  npm --prefix backend run db:push
}

echo "[Phase 1] Installing dependencies"
npm install
npm --prefix backend install

if [[ ! -f backend/.env ]]; then
  echo "[Phase 1] backend/.env missing; creating from template"
  cp backend/.env.local-pilot.example backend/.env
  echo "[Phase 1] Fill provider secrets in backend/.env before real webhooks."
fi

if [[ "$skip_db_sync" == true ]]; then
  echo "[Phase 1] Skipping DB sync (--skip-db supplied)"
else
  sync_db_schema
fi

echo "[Phase 1] Running baseline tests"
npm test
npm --prefix backend test

echo "[Phase 1] Frontend build check"
npm run build

if [[ "$start_services" == true ]]; then
  echo "[Phase 1] Starting backend and frontend"
  trap 'kill 0' EXIT
  (cd backend && npm run dev) &
  npm run dev
else
  cat <<MSG
[Phase 1] Ready.
Start services with:
  ./scripts/phase1_ready.sh --start
Skip DB sync when validating UI/tests only:
  ./scripts/phase1_ready.sh --skip-db
MSG
fi
