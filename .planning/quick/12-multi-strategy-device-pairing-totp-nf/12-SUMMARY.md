---
phase: quick-12
plan: 12
subsystem: device-pairing
tags: [pairing, totp, nfc, ble, security, rate-limiting]
dependency_graph:
  requires: []
  provides: [PAIR-TOTP, PAIR-NFC, PAIR-BLE, PAIR-SEC]
  affects: [backend/src/routes/pairing.ts, src/pilot/components/DevicePairingModal.tsx]
tech_stack:
  added: [otplib (TOTP validation), express-rate-limit (confirm endpoint), WebCrypto HMAC-SHA1 (frontend TOTP), Web NFC API (NDEFWriter), Web Bluetooth API (GATT)]
  patterns: [derived TOTP secret from token bytes (no DB column), inline useTOTP hook with 1s tick, browser API feature detection guards]
key_files:
  modified:
    - backend/src/routes/pairing.ts
    - src/pilot/components/DevicePairingModal.tsx
decisions:
  - totpSecret derived on-the-fly from token bytes (base64url, uppercase, replace non-base32) — no schema change needed
  - confirmRateLimit applied before requireRole so unauthenticated brute-force is also blocked
  - NDEFWriter feature-detected via 'NDEFWriter' in (window as Record<string,unknown>) to satisfy TypeScript
  - BLE scan uses optionalServices filter to ensure GATT server is accessible
metrics:
  duration: "~15 minutes"
  completed: "2026-03-14"
  tasks_completed: 3
  files_modified: 2
---

# Quick Task 12: Multi-Strategy Device Pairing — TOTP, NFC, BLE + Backend Security Summary

**One-liner:** Backend security hardening (rate-limit, TOTP via otplib, createdAfter filter, cleanup endpoint) + frontend upgrade to 5-tab modal with rotating TOTP display, NFC tag writing, and BLE GATT proximity pairing.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Backend security + TOTP endpoints | 6b17bf3 | backend/src/routes/pairing.ts |
| 2 | Frontend TOTP rotating code + NFC tab + BLE tab | 6b17bf3 | src/pilot/components/DevicePairingModal.tsx |
| 3 | Final TypeScript clean pass (both frontend + backend) | 6b17bf3 | both — tsc exit 0 confirmed |

## What Was Built

### Backend (pairing.ts)

- **Rate limiting:** `confirmRateLimit` middleware (10 req / 5 min / IP via express-rate-limit) applied to `POST /pairing/confirm`
- **TOTP secret derivation:** `POST /pairing/generate` now derives a 32-char base32 TOTP secret from the token's first 20 bytes and returns it as `totpSecret` in the response JSON (no DB column added)
- **TOTP validation:** `POST /pairing/confirm` accepts optional `totpCode` field; validates via `authenticator.check(totpCode, derivedSecret)` from otplib
- **createdAfter filter:** `GET /pairing/status/:patientId` accepts optional `?createdAfter=ISO` query param to filter connected devices
- **Cleanup endpoint:** `DELETE /pairing/cleanup` (admin only) removes all expired unused PairingTokens via `prisma.pairingToken.deleteMany`

### Frontend (DevicePairingModal.tsx)

- **PairingSession interface** extended with `totpSecret?: string`
- **NDEFWriter type declaration** added inline (not in lib.dom.d.ts yet)
- **useTOTP hook:** WebCrypto HMAC-SHA1 implementation — base32 decode, HOTP counter, dynamic OTP, 1s tick interval, cleanup on unmount
- **TabsList** expanded from `grid-cols-3` to `grid-cols-5`
- **Manual Code tab** upgraded: shows rotating TOTP code with conic-gradient countdown ring when `totpSecret` present; falls back to static `shortCode`
- **NFC Tag tab:** `NDEFWriter.write()` with browser-support gate; inline status (idle/writing/written/error)
- **Nearby (BLE) tab:** `navigator.bluetooth.requestDevice` -> GATT connect -> characteristic write; browser-support gate; inline status states
- **Cleanup useEffect** resets `nfcStatus` and `bleStatus` to `'idle'` on modal close

## Deviations from Plan

None — plan executed exactly as written.

## Self-Check

- [x] `backend/src/routes/pairing.ts` exists and modified
- [x] `src/pilot/components/DevicePairingModal.tsx` exists and modified
- [x] Commit 6b17bf3 exists
- [x] Backend `npx tsc --noEmit` exits 0
- [x] Frontend `npx tsc --noEmit` exits 0

## Self-Check: PASSED
