#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BIN_DIR="${SCRIPT_DIR}/bin"
BIN_PATH="${BIN_DIR}/cloudflared"

OS="$(uname -s)"
ARCH="$(uname -m)"

resolve_asset_url() {
  case "${OS}:${ARCH}" in
    Linux:x86_64|Linux:amd64)
      echo "https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64"
      ;;
    Linux:aarch64|Linux:arm64)
      echo "https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-arm64"
      ;;
    Darwin:x86_64|Darwin:amd64)
      echo "https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-darwin-amd64.tgz"
      ;;
    Darwin:arm64)
      echo "https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-darwin-arm64.tgz"
      ;;
    *)
      echo ""
      ;;
  esac
}

ASSET_URL="$(resolve_asset_url)"
if [[ -z "${ASSET_URL}" ]]; then
  echo "Unsupported platform for auto-install: ${OS} ${ARCH}"
  echo "Install cloudflared manually: https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/downloads/"
  exit 1
fi

mkdir -p "${BIN_DIR}"

if [[ "${ASSET_URL}" == *.tgz ]]; then
  TMP_TGZ="$(mktemp)"
  trap 'rm -f "${TMP_TGZ}"' EXIT
  curl -fL "${ASSET_URL}" -o "${TMP_TGZ}"
  tar -xzf "${TMP_TGZ}" -C "${BIN_DIR}" cloudflared
else
  curl -fL "${ASSET_URL}" -o "${BIN_PATH}"
fi

chmod +x "${BIN_PATH}"

echo "Installed cloudflared at: ${BIN_PATH}"
"${BIN_PATH}" --version || true

echo ""
echo "Next:"
echo "1) cp backend/.env.local-pilot.example backend/.env"
echo "2) Fill provider keys in backend/.env"
echo "3) cd backend && npm run dev"
echo "4) ./scripts/start_pilot_tunnel.sh cloudflare 8080"

