---
phase: quick-10
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - src/pilot/pages/PatientDetail.tsx
autonomous: true
requirements:
  - wire-request-appointment-button
must_haves:
  truths:
    - "Clicking 'Request Appointment' opens a dialog instead of a toast"
    - "Dialog has fields: datetime-local, appointment type select, notes textarea, and doctor ID input"
    - "Submitting the form POSTs to /appointments and shows a success toast on 201"
    - "On success, patient queries are invalidated so stale data refreshes"
    - "On API error, an error toast is shown and the dialog stays open"
    - "Frontend tsc --noEmit passes with 0 errors"
  artifacts:
    - path: "src/pilot/pages/PatientDetail.tsx"
      provides: "RequestAppointmentDialog inline component + wired button"
      contains: "Dialog, useMutation, apiClient.post('/appointments')"
  key_links:
    - from: "Button onClick=handleRequestAppointment"
      to: "setApptDialogOpen(true)"
      via: "useState boolean"
    - from: "form onSubmit"
      to: "apiClient.post('/appointments', payload)"
      via: "useMutation mutateAsync"
    - from: "onSuccess"
      to: "queryClient.invalidateQueries(['patientData'])"
      via: "queryClient already in scope"
---

<objective>
Replace the stub `handleRequestAppointment` toast in PatientDetail.tsx with a real Dialog that collects appointment details and POSTs to `/appointments`.

Purpose: Pilot clinicians need to schedule follow-up appointments directly from the patient detail view.
Output: Inline dialog component wired to the existing "Request Appointment" button; useMutation hook calling POST /appointments; success/error toasts; query invalidation.
</objective>

<execution_context>
@./.claude/get-shit-done/workflows/execute-plan.md
@./.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md

Key facts established by reading source files:

BACKEND — POST /appointments (backend/src/routes/appointments.ts lines 15-24):
  Schema (Zod): patientId (uuid, required), doctorId (uuid, REQUIRED — not optional),
  type (string, required), scheduledAt (ISO datetime string, required),
  durationMinutes (int, default 30), locationType (string, default 'in_person'),
  locationDetails (string, optional), reason (string, optional).

  NOTE: doctorId is required by the backend schema. The Patient type
  (src/types/patient.ts) has no primaryDoctorId field. The dialog must include a
  Doctor ID text field. Send doctorId only if the user fills it in; if blank, the
  API will return 400 — surface that via toast.error with the API message.

EXISTING IMPORTS in PatientDetail.tsx already available (no new installs):
  - useState, useQueryClient (already imported)
  - apiClient from '@/services/api/client' (already imported)
  - toast from 'sonner' (already imported)
  - useMutation from '@tanstack/react-query' — NOT yet imported, must add
  - Dialog components NOT yet imported — must add from '@/components/ui/dialog'
  - Select components NOT yet imported — must add from '@/components/ui/select'
  - Label NOT yet imported — must add from '@/components/ui/label'
  - Textarea NOT yet imported — must add from '@/components/ui/textarea'
  - Input NOT yet imported — must add from '@/components/ui/input'
  (all these shadcn components exist in src/components/ui/)

EXISTING STATE in PatientDetail.tsx:
  - queryClient already declared (line 53)
  - patientId from useParams (line 48)
  - patient.id is the Prisma patient record UUID (used for patientId field)
</context>

<tasks>

<task type="auto">
  <name>Task 1: Add RequestAppointmentDialog and wire the button</name>
  <files>src/pilot/pages/PatientDetail.tsx</files>
  <action>
Make the following targeted changes to PatientDetail.tsx:

1. ADD IMPORTS at the top (after the existing '@tanstack/react-query' import line):
   - Add `useMutation` to the existing `{ useQueryClient }` import from '@tanstack/react-query'
     so it becomes: `import { useQueryClient, useMutation } from '@tanstack/react-query';`
   - Add new import: `import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';`
   - Add new import: `import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';`
   - Add new import: `import { Label } from '@/components/ui/label';`
   - Add new import: `import { Textarea } from '@/components/ui/textarea';`
   - Add new import: `import { Input } from '@/components/ui/input';`

2. ADD STATE near the other useState declarations (after pairingQrPayload state, around line 57):
   ```tsx
   const [apptDialogOpen, setApptDialogOpen] = useState(false);
   const [apptScheduledAt, setApptScheduledAt] = useState('');
   const [apptType, setApptType] = useState<'routine' | 'urgent' | 'follow_up' | 'telemedicine'>('routine');
   const [apptNotes, setApptNotes] = useState('');
   const [apptDoctorId, setApptDoctorId] = useState('');
   ```

3. ADD MUTATION below the state declarations (before handleResolveAlert):
   ```tsx
   const createAppointment = useMutation({
     mutationFn: async () => {
       const payload: Record<string, unknown> = {
         patientId: patient!.id,
         type: apptType,
         scheduledAt: new Date(apptScheduledAt).toISOString(),
         durationMinutes: 30,
       };
       if (apptDoctorId.trim()) payload.doctorId = apptDoctorId.trim();
       return apiClient.post('/appointments', payload);
     },
     onSuccess: () => {
       toast.success('Appointment requested successfully');
       setApptDialogOpen(false);
       setApptScheduledAt('');
       setApptType('routine');
       setApptNotes('');
       setApptDoctorId('');
       queryClient.invalidateQueries({ queryKey: ['patientData'] });
     },
     onError: (err: unknown) => {
       const message =
         err instanceof Error ? err.message : 'Failed to create appointment';
       toast.error(message);
     },
   });
   ```

4. REPLACE handleRequestAppointment (currently lines 90-92):
   Replace:
   ```tsx
   const handleRequestAppointment = () => {
     toast.success('Appointment request sent to scheduling team');
   };
   ```
   With:
   ```tsx
   const handleRequestAppointment = () => {
     setApptDialogOpen(true);
   };
   ```

5. ADD DIALOG JSX just before the closing `</div>` of the component's return (before the DevicePairingModal, around line 661):
   ```tsx
   <Dialog open={apptDialogOpen} onOpenChange={setApptDialogOpen}>
     <DialogContent className="sm:max-w-md">
       <DialogHeader>
         <DialogTitle>Request Appointment</DialogTitle>
       </DialogHeader>
       <div className="space-y-4 py-2">
         <div className="space-y-1.5">
           <Label htmlFor="appt-datetime">Date &amp; Time</Label>
           <Input
             id="appt-datetime"
             type="datetime-local"
             value={apptScheduledAt}
             onChange={(e) => setApptScheduledAt(e.target.value)}
             required
           />
         </div>
         <div className="space-y-1.5">
           <Label htmlFor="appt-type">Appointment Type</Label>
           <Select
             value={apptType}
             onValueChange={(v) =>
               setApptType(v as 'routine' | 'urgent' | 'follow_up' | 'telemedicine')
             }
           >
             <SelectTrigger id="appt-type">
               <SelectValue placeholder="Select type" />
             </SelectTrigger>
             <SelectContent>
               <SelectItem value="routine">Routine</SelectItem>
               <SelectItem value="urgent">Urgent</SelectItem>
               <SelectItem value="follow_up">Follow-up</SelectItem>
               <SelectItem value="telemedicine">Telemedicine</SelectItem>
             </SelectContent>
           </Select>
         </div>
         <div className="space-y-1.5">
           <Label htmlFor="appt-doctor">Doctor ID (UUID, required by API)</Label>
           <Input
             id="appt-doctor"
             type="text"
             placeholder="e.g. 3fa85f64-5717-4562-b3fc-2c963f66afa6"
             value={apptDoctorId}
             onChange={(e) => setApptDoctorId(e.target.value)}
           />
           <p className="text-xs text-muted-foreground">
             Enter the doctor&apos;s UUID. Leave blank to submit without — the API will return an error if required.
           </p>
         </div>
         <div className="space-y-1.5">
           <Label htmlFor="appt-notes">Notes (optional)</Label>
           <Textarea
             id="appt-notes"
             placeholder="Reason for appointment, patient concerns..."
             value={apptNotes}
             onChange={(e) => setApptNotes(e.target.value)}
             rows={3}
           />
         </div>
       </div>
       <DialogFooter>
         <Button
           variant="outline"
           onClick={() => setApptDialogOpen(false)}
           disabled={createAppointment.isPending}
         >
           Cancel
         </Button>
         <Button
           onClick={() => {
             if (!apptScheduledAt) {
               toast.error('Please select a date and time');
               return;
             }
             createAppointment.mutate();
           }}
           disabled={createAppointment.isPending}
         >
           {createAppointment.isPending ? 'Requesting...' : 'Request Appointment'}
         </Button>
       </DialogFooter>
     </DialogContent>
   </Dialog>
   ```

IMPORTANT: The `notes` field in the dialog state (`apptNotes`) maps to the `reason` field
in the backend schema. Include it in the payload:
  `if (apptNotes.trim()) payload.reason = apptNotes.trim();`
Add this line inside mutationFn after the `durationMinutes` line.

After all edits, run: `cd /home/recep/Desktop/Machine_Learning/projects/health_monitor_gp/signal-guide-health && npx tsc --noEmit`
Fix any TypeScript errors before committing.
  </action>
  <verify>
    <automated>cd /home/recep/Desktop/Machine_Learning/projects/health_monitor_gp/signal-guide-health && npx tsc --noEmit 2>&amp;1 | tail -5; echo "Exit: $?"</automated>
  </verify>
  <done>
    - tsc --noEmit exits 0 with no errors
    - "Request Appointment" button opens a Dialog (not a toast)
    - Dialog has: datetime-local input, type select (routine/urgent/follow_up/telemedicine), doctor ID text input, notes textarea, Cancel + Request Appointment buttons
    - Submit calls POST /appointments via apiClient with patientId, type, scheduledAt (ISO), durationMinutes=30, reason (if filled), doctorId (if filled)
    - Success: dialog closes, success toast shown, patient queries invalidated
    - Error: toast.error shown, dialog stays open
  </done>
</task>

</tasks>

<verification>
After task completes:
1. `npx tsc --noEmit` in project root — must exit 0
2. Visually confirm: clicking "Request Appointment" opens the dialog
3. Confirm dialog fields render correctly (datetime, select, inputs)
4. Confirm submit button calls the mutation (check network tab for POST /appointments)
</verification>

<success_criteria>
- PatientDetail.tsx compiles with 0 TypeScript errors
- "Request Appointment" button triggers Dialog open (replaces stub toast)
- Dialog submits POST /appointments with correct payload shape
- Success path: toast.success + dialog close + query invalidation
- Error path: toast.error + dialog stays open
</success_criteria>

<output>
After completion, create `.planning/quick/10-wire-request-appointment-button-in-patie/10-SUMMARY.md`
with what was built, files modified, and any decisions made.
</output>
