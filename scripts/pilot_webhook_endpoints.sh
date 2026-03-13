#!/usr/bin/env bash

set -euo pipefail

if [[ $# -lt 1 ]]; then
  echo "Usage: $0 <public_base_url>"
  echo "Example: $0 https://abc-123-xyz.trycloudflare.com"
  exit 1
fi

BASE_URL="${1%/}"

cat <<EOF
Pilot webhook endpoints
=======================
Base URL: ${BASE_URL}

WhatsApp
  Verify + callback: ${BASE_URL}/webhooks/whatsapp

Apple
  Callback: ${BASE_URL}/webhooks/apple-health

Android Health Connect
  Callback: ${BASE_URL}/webhooks/health-connect

Google Fit (optional)
  Callback: ${BASE_URL}/webhooks/google-fit?token=<GOOGLE_PUBSUB_TOKEN>

Quick checks
============
curl -i "${BASE_URL}/health"
curl -i "${BASE_URL}/webhooks/whatsapp"
EOF

