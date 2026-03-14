---
phase: quick-11
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - src/pilot/pages/PatientDetail.tsx
autonomous: true
requirements:
  - QUICK-11
must_haves:
  truths:
    - "Call button initiates a tel: call to patient's whatsappPhone (digits only), or shows info toast if no number"
    - "Call Clinician button shows an info toast directing user to internal directory (no phone on consultant)"
    - "Draft Rx button opens a dialog with medication name, dosage, instructions fields; submit POSTs /alerts type manual"
    - "Send Medication button opens a dialog with pre-filled reminder message; submit POSTs /alerts type manual"
    - "Log Complaint button opens a dialog with category select and description textarea; submit POSTs /alerts type manual severity low"
    - "tsc --noEmit passes 0 errors after all changes"
  artifacts:
    - path: src/pilot/pages/PatientDetail.tsx
      provides: "All 5 wired button handlers + 3 new dialogs + 3 useMutation hooks"
  key_links:
    - from: "Draft Rx / Send Medication / Log Complaint dialogs"
      to: "POST /alerts"
      via: "apiClient.post('/alerts', payload)"
      pattern: "patientId.*type.*manual.*severity.*title.*message"
---

<objective>
Wire all five remaining toast-stub buttons in PatientDetail.tsx with real interactions.

Purpose: Completing these stubs gives clinicians functional quick-action workflows without requiring new backend endpoints.
Output: PatientDetail.tsx with all 5 buttons wired; 3 new dialogs; 3 useMutation hooks calling POST /alerts; 1 tel: link; 1 info toast.
</objective>

<execution_context>
@./.claude/get-shit-done/workflows/execute-plan.md
</execution_context>

<context>
@src/pilot/pages/PatientDetail.tsx
@src/types/patient.ts
</context>

<interfaces>
<!-- POST /alerts schema (from backend/src/routes/alerts.ts) -->
```typescript
// Required fields for POST /alerts
{
  patientId: string;          // UUID
  type: 'vital_signs' | 'missed_checkin' | 'symptom_reported' | 'medication_missed'
      | 'wearable_disconnected' | 'critical_trend' | 'manual';  // use 'manual' for all 3 dialogs
  severity: 'low' | 'medium' | 'high' | 'critical';
  title: string;
  message: string;            // NOT 'description' — field is 'message'
  triggerMetric?: string;
  triggerValue?: number;
  thresholdValue?: number;
}
```

<!-- Patient type relevant fields (from src/types/patient.ts) -->
```typescript
export interface Patient {
  id: string;
  whatsappPhone?: string;   // phone for tel: link (strip non-digits before using)
  consultant?: string;      // clinician name only — no phone available
  // ...
}
```

<!-- Existing patterns in PatientDetail.tsx to follow -->
// useMutation pattern (see createAppointment at line 87):
const createAppointment = useMutation({
  mutationFn: async () => apiClient.post('/appointments', payload),
  onSuccess: () => { toast.success('...'); setDialogOpen(false); /* reset state */ },
  onError: (err: unknown) => { toast.error(err instanceof Error ? err.message : 'Failed...'); },
});

// Dialog pattern (see apptDialog at line 708):
<Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
  <DialogContent className="sm:max-w-md">
    <DialogHeader><DialogTitle>...</DialogTitle></DialogHeader>
    <div className="space-y-4 py-2">...</div>
    <DialogFooter>
      <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={mutation.isPending}>Cancel</Button>
      <Button onClick={() => mutation.mutate()} disabled={mutation.isPending}>...</Button>
    </DialogFooter>
  </DialogContent>
</Dialog>
</interfaces>

<tasks>

<task type="auto">
  <name>Task 1: Wire Call and Call Clinician buttons</name>
  <files>src/pilot/pages/PatientDetail.tsx</files>
  <action>
Replace the two toast-stub handlers:

1. `handleContactPatient` — already wired (WhatsApp). Leave as-is.

2. The inline "Call" button onClick at line 243 (`() => toast.info('Calling...')`):
   Replace with a named handler `handleCallPatient`:
   ```typescript
   const handleCallPatient = () => {
     const phone = patient.whatsappPhone?.replace(/\D/g, '');
     if (phone) {
       window.location.href = `tel:${phone}`;
     } else {
       toast.info('No phone number on file for this patient');
     }
   };
   ```
   Update the button's onClick to `onClick={handleCallPatient}`.

3. `handleCallClinician` (line 163–165 — currently shows generic toast):
   Replace body with:
   ```typescript
   toast.info(`${clinicianName} — contact via internal staff directory`);
   ```
   No dialog needed; consultant has no phone field.
  </action>
  <verify>
    <automated>cd /home/recep/Desktop/Machine_Learning/projects/health_monitor_gp/signal-guide-health && npx tsc --noEmit 2>&1 | grep -E "PatientDetail|error TS" | head -20</automated>
  </verify>
  <done>Call button uses tel: link when whatsappPhone present; falls back to toast. Call Clinician shows directory info toast. 0 TypeScript errors.</done>
</task>

<task type="auto">
  <name>Task 2: Wire Draft Rx and Send Medication dialogs</name>
  <files>src/pilot/pages/PatientDetail.tsx</files>
  <action>
Add state, mutations, and dialogs for Draft Rx and Send Medication. All state declarations must go in the component body BEFORE the hooks-cannot-be-called-conditionally boundary (before the `if (isLoading)` guard — or more precisely, add them alongside the existing `apptDialog*` useState calls at lines 63–67). Mutations must also be declared before the early returns.

**State to add (near existing appt state, lines 63–67):**
```typescript
const [rxDialogOpen, setRxDialogOpen] = useState(false);
const [rxMedName, setRxMedName] = useState('');
const [rxDosage, setRxDosage] = useState('');
const [rxInstructions, setRxInstructions] = useState('');

const [medDialogOpen, setMedDialogOpen] = useState(false);
const [medMessage, setMedMessage] = useState('');
```

**Mutations to add (alongside `createAppointment` mutation, after line 113):**

Note: `patient` is typed as potentially undefined at that point (narrowed only after the early returns). Use `patient!.id` with non-null assertion just as `createAppointment` does at line 93.

```typescript
const submitDraftRx = useMutation({
  mutationFn: async () =>
    apiClient.post('/alerts', {
      patientId: patient!.id,
      type: 'manual',
      severity: 'low',
      title: `Draft Prescription: ${rxMedName}`,
      message: `Medication: ${rxMedName}\nDosage: ${rxDosage}\nInstructions: ${rxInstructions}`,
    }),
  onSuccess: () => {
    toast.success('Prescription draft created for clinician review');
    setRxDialogOpen(false);
    setRxMedName('');
    setRxDosage('');
    setRxInstructions('');
  },
  onError: (err: unknown) => {
    toast.error(err instanceof Error ? err.message : 'Failed to submit prescription draft');
  },
});

const submitMedReminder = useMutation({
  mutationFn: async () =>
    apiClient.post('/alerts', {
      patientId: patient!.id,
      type: 'manual',
      severity: 'low',
      title: 'Medication Reminder Sent',
      message: medMessage,
    }),
  onSuccess: () => {
    toast.success(`Medication reminder sent to ${pharmacyName}`);
    setMedDialogOpen(false);
    setMedMessage('');
  },
  onError: (err: unknown) => {
    toast.error(err instanceof Error ? err.message : 'Failed to send medication reminder');
  },
});
```

**Replace stub handlers:**
```typescript
const handleDraftPrescription = () => { setRxDialogOpen(true); };
const handleSendMedication = () => {
  setMedMessage(`Medication reminder for ${patient.name}: please take your prescribed medications as directed.`);
  setMedDialogOpen(true);
};
```

**Add dialogs** (in JSX alongside the appt Dialog, before closing `</div>`):

Draft Rx dialog:
```tsx
<Dialog open={rxDialogOpen} onOpenChange={setRxDialogOpen}>
  <DialogContent className="sm:max-w-md">
    <DialogHeader>
      <DialogTitle>Draft Prescription</DialogTitle>
    </DialogHeader>
    <div className="space-y-4 py-2">
      <div className="space-y-1.5">
        <Label htmlFor="rx-med-name">Medication Name</Label>
        <Input id="rx-med-name" placeholder="e.g. Bisoprolol" value={rxMedName} onChange={(e) => setRxMedName(e.target.value)} />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="rx-dosage">Dosage</Label>
        <Input id="rx-dosage" placeholder="e.g. 5mg once daily" value={rxDosage} onChange={(e) => setRxDosage(e.target.value)} />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="rx-instructions">Instructions (optional)</Label>
        <Textarea id="rx-instructions" placeholder="Additional instructions..." value={rxInstructions} onChange={(e) => setRxInstructions(e.target.value)} rows={3} />
      </div>
    </div>
    <DialogFooter>
      <Button variant="outline" onClick={() => setRxDialogOpen(false)} disabled={submitDraftRx.isPending}>Cancel</Button>
      <Button onClick={() => { if (!rxMedName.trim()) { toast.error('Medication name is required'); return; } submitDraftRx.mutate(); }} disabled={submitDraftRx.isPending}>
        {submitDraftRx.isPending ? 'Submitting...' : 'Submit Draft'}
      </Button>
    </DialogFooter>
  </DialogContent>
</Dialog>
```

Send Medication dialog:
```tsx
<Dialog open={medDialogOpen} onOpenChange={setMedDialogOpen}>
  <DialogContent className="sm:max-w-md">
    <DialogHeader>
      <DialogTitle>Send Medication Reminder</DialogTitle>
    </DialogHeader>
    <div className="space-y-4 py-2">
      <div className="space-y-1.5">
        <Label htmlFor="med-message">Reminder Message</Label>
        <Textarea id="med-message" value={medMessage} onChange={(e) => setMedMessage(e.target.value)} rows={4} />
      </div>
    </div>
    <DialogFooter>
      <Button variant="outline" onClick={() => setMedDialogOpen(false)} disabled={submitMedReminder.isPending}>Cancel</Button>
      <Button onClick={() => { if (!medMessage.trim()) { toast.error('Message cannot be empty'); return; } submitMedReminder.mutate(); }} disabled={submitMedReminder.isPending}>
        {submitMedReminder.isPending ? 'Sending...' : 'Send Reminder'}
      </Button>
    </DialogFooter>
  </DialogContent>
</Dialog>
```
  </action>
  <verify>
    <automated>cd /home/recep/Desktop/Machine_Learning/projects/health_monitor_gp/signal-guide-health && npx tsc --noEmit 2>&1 | grep -c "error TS"</automated>
  </verify>
  <done>Draft Rx button opens dialog; submit POSTs /alerts with type manual. Send Medication opens dialog with pre-filled message; submit POSTs /alerts. 0 TypeScript errors.</done>
</task>

<task type="auto">
  <name>Task 3: Wire Log Complaint dialog</name>
  <files>src/pilot/pages/PatientDetail.tsx</files>
  <action>
Add state, mutation, and dialog for Log Complaint.

**State to add (alongside other state declarations):**
```typescript
const [complaintDialogOpen, setComplaintDialogOpen] = useState(false);
const [complaintCategory, setComplaintCategory] = useState('Clinical Care');
const [complaintDescription, setComplaintDescription] = useState('');
```

**Mutation to add (alongside other mutations):**
```typescript
const submitComplaint = useMutation({
  mutationFn: async () =>
    apiClient.post('/alerts', {
      patientId: patient!.id,
      type: 'manual',
      severity: 'low',
      title: `Patient Complaint: ${complaintCategory}`,
      message: complaintDescription,
    }),
  onSuccess: () => {
    toast.success('Complaint logged and routed to patient experience');
    setComplaintDialogOpen(false);
    setComplaintCategory('Clinical Care');
    setComplaintDescription('');
  },
  onError: (err: unknown) => {
    toast.error(err instanceof Error ? err.message : 'Failed to log complaint');
  },
});
```

**Replace stub handler:**
```typescript
const handleLogComplaint = () => { setComplaintDialogOpen(true); };
```

**Add dialog** (in JSX alongside the other dialogs):
```tsx
<Dialog open={complaintDialogOpen} onOpenChange={setComplaintDialogOpen}>
  <DialogContent className="sm:max-w-md">
    <DialogHeader>
      <DialogTitle>Log Patient Complaint</DialogTitle>
    </DialogHeader>
    <div className="space-y-4 py-2">
      <div className="space-y-1.5">
        <Label htmlFor="complaint-category">Category</Label>
        <Select value={complaintCategory} onValueChange={setComplaintCategory}>
          <SelectTrigger id="complaint-category">
            <SelectValue placeholder="Select category" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="Clinical Care">Clinical Care</SelectItem>
            <SelectItem value="Communication">Communication</SelectItem>
            <SelectItem value="Waiting Time">Waiting Time</SelectItem>
            <SelectItem value="Staff">Staff</SelectItem>
            <SelectItem value="Other">Other</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="complaint-description">Description</Label>
        <Textarea id="complaint-description" placeholder="Describe the complaint..." value={complaintDescription} onChange={(e) => setComplaintDescription(e.target.value)} rows={4} />
      </div>
    </div>
    <DialogFooter>
      <Button variant="outline" onClick={() => setComplaintDialogOpen(false)} disabled={submitComplaint.isPending}>Cancel</Button>
      <Button onClick={() => { if (!complaintDescription.trim()) { toast.error('Description is required'); return; } submitComplaint.mutate(); }} disabled={submitComplaint.isPending}>
        {submitComplaint.isPending ? 'Logging...' : 'Log Complaint'}
      </Button>
    </DialogFooter>
  </DialogContent>
</Dialog>
```
  </action>
  <verify>
    <automated>cd /home/recep/Desktop/Machine_Learning/projects/health_monitor_gp/signal-guide-health && npx tsc --noEmit 2>&1; echo "Exit: $?"</automated>
  </verify>
  <done>Log Complaint button opens dialog with category select and description textarea. Submit POSTs /alerts type manual severity low. tsc --noEmit exits 0 with no errors.</done>
</task>

</tasks>

<verification>
After all three tasks:
- `npx tsc --noEmit` exits 0
- All 5 button handlers are no longer simple toast stubs
- Draft Rx, Send Medication, Log Complaint dialogs are visible in JSX
- POST /alerts payload uses `message` field (not `description`), `type: 'manual'` (not `'other'`)
- All useState and useMutation calls are declared before the conditional early returns (hooks rules satisfied)
</verification>

<success_criteria>
- tsc --noEmit: 0 errors
- Call: navigates to tel: link or shows "No phone number on file" toast
- Call Clinician: shows directory info toast
- Draft Rx: dialog opens, submit fires POST /alerts
- Send Medication: dialog opens with pre-filled message, submit fires POST /alerts
- Log Complaint: dialog opens with category/description, submit fires POST /alerts with severity low
</success_criteria>

<output>
No SUMMARY.md needed for quick plans. Commit with message:
`feat(quick-11): wire all 5 remaining toast-only buttons in PatientDetail`
</output>
