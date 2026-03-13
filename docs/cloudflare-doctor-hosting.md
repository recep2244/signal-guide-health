# Cloudflare Hosting for Doctor Data Sharing Portal

Use this runbook to host only the doctor-facing UI on Cloudflare Pages while keeping admin controls local/private.

## 1) Frontend deployment target

This repo deploys from `.github/workflows/deploy.yml` to Cloudflare Pages project:

- `signal-guide-health-doctor`

The workflow builds with:

- `VITE_DEPLOY_TARGET=cloudflare`
- `VITE_ENABLE_ADMIN_UI=false`
- `VITE_ENABLE_MOCK_DATA=false`
- `VITE_ENABLE_PILOT_MOCK_DATA=false`

Result: `/doctor-ops` and clinical pages are available, admin pages are not included in the hosted UI routes.

## 2) Required GitHub secrets

In GitHub repo settings, configure:

- `CLOUDFLARE_API_TOKEN`
- `CLOUDFLARE_ACCOUNT_ID`

Token permissions should include Cloudflare Pages deploy access for the target account/project.

## 3) Backend access policy for this model

Set backend env:

- `ADMIN_LOCAL_ONLY=true`
- `ALLOWED_ORIGINS=https://<your-doctor-domain>`

`ADMIN_LOCAL_ONLY=true` blocks `/api/v1/admin/*` for non-local requests while keeping `/api/v1/clinical/*` available for doctor sharing workflows.

## 4) Cloudflare Pages project settings

If you configure the project manually in Cloudflare UI:

- Framework preset: `Vite`
- Build command: `npm run build`
- Build output directory: `dist`
- Node version: `20`

Build environment variables:

- `VITE_DEPLOY_TARGET=cloudflare`
- `VITE_API_BASE_URL=https://<your-api-domain>/api/v1`
- `VITE_ENABLE_ADMIN_UI=false`
- `VITE_ENABLE_MOCK_DATA=false`
- `VITE_ENABLE_PILOT_MOCK_DATA=false`

If deploying from GitHub Actions in this repo, set repository variable:

- `VITE_API_BASE_URL` (GitHub repo Settings -> Secrets and variables -> Actions -> Variables)

## 5) Validation checklist

1. Public site loads and does not expose `/admin` or `/pilot-ops` navigation.
2. Doctor pages can load `/api/v1/clinical/*` data.
3. Non-local call to `/api/v1/admin/*` returns `403` when `ADMIN_LOCAL_ONLY=true`.
4. CORS allows only your doctor portal origin.

## 6) Reliability notes

- Cloudflare Pages hosts static frontend reliably.
- If backend remains local + tunnel, doctor data availability still depends on local machine uptime.
- For continuous uptime, host backend in a stable environment (VM/container) and keep `ADMIN_LOCAL_ONLY=true`.
