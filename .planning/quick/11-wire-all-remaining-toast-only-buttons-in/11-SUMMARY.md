---
phase: quick-11
plan: 01
subsystem: frontend
tags: [ui, dialogs, mutations, alerts, patient-detail]
dependency_graph:
  requires: []
  provides: [wired-call-button, wired-call-clinician-button, draft-rx-dialog, send-medication-dialog, log-complaint-dialog]
  affects: [src/pilot/pages/PatientDetail.tsx]
tech_stack:
  added: []
  patterns: [useMutation, Dialog, Select, Textarea, tel-link]
key_files:
  modified:
    - src/pilot/pages/PatientDetail.tsx
decisions:
  - "All useMutation hooks placed after early returns (same pattern as existing createAppointment) with patient! non-null assertion"
  - "handleCallPatient uses window.location.href for tel: link (navigates in same tab)"
  - "handleCallClinician uses directory info toast (consultant has no phone field)"
  - "All 3 POST /alerts payloads use type: 'manual', severity: 'low', message field (not description)"
metrics:
  duration: ~10m
  completed: 2026-03-14
  tasks_completed: 3
  files_modified: 1
---

# Phase quick-11 Plan 01: Wire All Remaining Toast-Only Buttons Summary

**One-liner:** Wired all 5 remaining toast-stub buttons in PatientDetail — tel: call link, directory toast, and 3 POST /alerts dialogs (Draft Rx, Send Medication, Log Complaint).

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Wire Call and Call Clinician buttons | 10d282c | src/pilot/pages/PatientDetail.tsx |
| 2 | Wire Draft Rx and Send Medication dialogs | a081d4c | src/pilot/pages/PatientDetail.tsx |
| 3 | Wire Log Complaint dialog | b58b47c | src/pilot/pages/PatientDetail.tsx |

## What Was Built

**Task 1 — Call and Call Clinician:**
- `handleCallPatient`: strips non-digits from `patient.whatsappPhone`, navigates to `tel:${phone}`, or shows "No phone number on file" info toast
- `handleCallClinician`: shows `${clinicianName} — contact via internal staff directory` info toast
- Call button onClick updated from inline lambda to `handleCallPatient`

**Task 2 — Draft Rx and Send Medication:**
- State: `rxDialogOpen`, `rxMedName`, `rxDosage`, `rxInstructions`, `medDialogOpen`, `medMessage`
- `submitDraftRx` mutation: POSTs `/alerts` with `type: 'manual'`, `severity: 'low'`, `title: Draft Prescription: ${rxMedName}`, `message` combining med/dosage/instructions
- `submitMedReminder` mutation: POSTs `/alerts` with pre-filled reminder message for pharmacyName
- Draft Rx dialog: medication name + dosage + instructions fields, validates med name required
- Send Medication dialog: pre-filled textarea with patient name and reminder text

**Task 3 — Log Complaint:**
- State: `complaintDialogOpen`, `complaintCategory` (default: 'Clinical Care'), `complaintDescription`
- `submitComplaint` mutation: POSTs `/alerts` with `type: 'manual'`, `severity: 'low'`, `title: Patient Complaint: ${complaintCategory}`
- Log Complaint dialog: Select with 5 categories + description Textarea, validates description required

## Verification

- `npx tsc --noEmit` exits 0 — zero TypeScript errors
- All 5 button handlers are no longer simple toast stubs
- Draft Rx, Send Medication, Log Complaint dialogs present in JSX
- All POST /alerts payloads use `message` field, `type: 'manual'`
- useState and useMutation calls placed correctly (hooks rules maintained)

## Deviations from Plan

None — plan executed exactly as written.
