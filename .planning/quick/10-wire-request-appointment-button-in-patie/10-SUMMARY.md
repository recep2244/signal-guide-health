---
phase: quick-10
plan: "01"
subsystem: frontend
tags: [appointments, dialog, useMutation, react-query, pilot-ui]
dependency_graph:
  requires: []
  provides: [RequestAppointmentDialog, POST /appointments wiring]
  affects: [src/pilot/pages/PatientDetail.tsx]
tech_stack:
  added: []
  patterns: [useMutation, Dialog inline component, optimistic toast feedback]
key_files:
  created: []
  modified:
    - src/pilot/pages/PatientDetail.tsx
decisions:
  - useMutation placed above early returns (after isLoading/error guards) so hooks order is stable — patient! non-null assertion safe because mutation only fires after patient loads
  - apptNotes maps to reason field in backend payload (not notes) per backend Zod schema
  - doctorId sent only when non-empty; blank field surfaces 400 API error via toast.error per spec
  - queryKey ['patientData'] invalidated on success (matches existing usePatientDetail query key pattern)
metrics:
  duration: "~5 minutes"
  completed: "2026-03-14"
  tasks_completed: 1
  files_modified: 1
---

# Phase quick-10 Plan 01: Wire Request Appointment Button Summary

**One-liner:** Inline RequestAppointmentDialog with useMutation POSTing to /appointments replaces stub toast in PatientDetail.tsx.

## What Was Built

Replaced the stub `handleRequestAppointment` (which fired `toast.success('Appointment request sent...')`) with a real Dialog-based flow:

- "Request Appointment" button now calls `setApptDialogOpen(true)`
- Dialog contains: `datetime-local` Input, appointment type Select (routine/urgent/follow_up/telemedicine), Doctor ID UUID text Input with helper text, and a Notes Textarea
- Submit path: `createAppointment.mutate()` calls `apiClient.post('/appointments', payload)` with `patientId`, `type`, `scheduledAt` (ISO string), `durationMinutes: 30`, `reason` (if notes filled), `doctorId` (if filled)
- Success path: `toast.success` + dialog close + field reset + `queryClient.invalidateQueries({ queryKey: ['patientData'] })`
- Error path: `toast.error(message)` + dialog stays open
- Submit button shows "Requesting..." while `createAppointment.isPending` is true; both buttons disabled during pending

## Files Modified

- `/home/recep/Desktop/Machine_Learning/projects/health_monitor_gp/signal-guide-health/src/pilot/pages/PatientDetail.tsx`

## Imports Added

```ts
import { useQueryClient, useMutation } from '@tanstack/react-query';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
```

## Decisions Made

- `useMutation` declared after the loading/error guard early returns to maintain stable hook call order; `patient!.id` non-null assertion is safe because the mutation can only be triggered after patient data is loaded.
- `apptNotes` state maps to `reason` in the API payload — per backend Zod schema (`reason` field, not `notes`).
- `doctorId` is conditionally included: if blank, the API returns 400 which surfaces via `toast.error`.
- Query invalidation uses `{ queryKey: ['patientData'] }` to match the existing `usePatientDetail` hook.

## Deviations from Plan

None — plan executed exactly as written.

## Verification

- `npx tsc --noEmit` exits 0 with no errors
- "Request Appointment" button opens Dialog (replaces stub toast)
- Dialog fields: datetime-local, type select, doctor UUID input, notes textarea
- Submit calls POST /appointments with correct payload shape
- Success: dialog closes, toast shown, queries invalidated
- Error: toast.error shown, dialog stays open

## Self-Check: PASSED

- File exists: `src/pilot/pages/PatientDetail.tsx` — FOUND
- Commit `694db28` — FOUND (feat(quick-10): wire Request Appointment button to real Dialog + POST /appointments)
