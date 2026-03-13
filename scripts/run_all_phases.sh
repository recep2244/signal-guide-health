#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

phase1_flags=()
for arg in "$@"; do
  case "$arg" in
    --skip-db|--start)
      phase1_flags+=("$arg")
      ;;
  esac
done

echo "[All Phases] Running Phase 1"
./scripts/phase1_ready.sh "${phase1_flags[@]}"

echo "[All Phases] Running Phase 2"
./scripts/phase2_ready.sh true

echo "[All Phases] Running Phase 3"
./scripts/phase3_ready.sh

cat <<MSG
[All Phases] Complete.
If you want to start the app stack now:
  ./scripts/phase1_ready.sh --start
If local Postgres is not available yet:
  ./scripts/run_all_phases.sh --skip-db
MSG
