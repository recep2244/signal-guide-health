---
phase: quick-6
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - backend/src/services/alertService.ts
  - src/components/DashboardHeader.tsx   # deleted
  - src/components/ProtectedRoute.tsx    # deleted
  - src/pages/Admin.tsx                  # deleted
  - src/pages/Dashboard.tsx             # deleted
  - src/pages/Login.tsx                 # deleted
  - src/pages/PatientDemo.tsx           # deleted
  - src/pages/PatientDetail.tsx         # deleted
  - .env
autonomous: true
requirements: [QUICK-6]

must_haves:
  truths:
    - "createAlert sends an email to the assigned doctor when SMTP is configured"
    - "escalateAlert sends an email to the assigned doctor when SMTP is configured"
    - "Email failures never throw — they are logged and swallowed"
    - "Old src/pages/ and src/components/ stubs are removed from git tracking"
    - "VITE_API_BASE_URL=/api/v1 is committed"
    - "tsc --noEmit passes clean after changes"
  artifacts:
    - path: "backend/src/services/alertService.ts"
      provides: "Alert notification emails (createAlert + escalateAlert)"
      contains: "nodemailer"
  key_links:
    - from: "alertService.createAlert"
      to: "prisma.doctor.findUnique (include user.email)"
      via: "assignedToId lookup before sendMail"
    - from: "alertService.escalateAlert"
      to: "prisma.doctor.findUnique (include user.email)"
      via: "alert.assignedToId lookup before sendMail"
---

<objective>
Implement the two alert email notification stubs in alertService.ts (lines 223 and 394)
and commit the pending housekeeping changes (old src/pages/ deletions + .env API URL fix).

Purpose: Doctors receive an email when a new alert is created for their patient and again when
that alert is escalated, closing the last open TODO in the alert pipeline. The git cleanup
removes dead code files and records the already-tested API URL change.

Output:
- alertService.ts with working nodemailer email calls (fire-and-forget, SMTP-gated)
- Committed deletion of 7 obsolete frontend files
- Committed .env VITE_API_BASE_URL change
</objective>

<execution_context>
@./.claude/get-shit-done/workflows/execute-plan.md
@./.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@.planning/ROADMAP.md

Key interfaces extracted from the codebase:

From backend/src/config/env.ts — available SMTP env vars:
```typescript
env.SMTP_HOST     // string | undefined
env.SMTP_PORT     // number | undefined
env.SMTP_USER     // string | undefined
env.SMTP_PASSWORD // string | undefined
env.SMTP_FROM     // string (email) | undefined
```

From backend/src/services/authService.ts — createMailTransport pattern to replicate:
```typescript
private createMailTransport(): nodemailer.Transporter | null {
  if (!env.SMTP_HOST || !env.SMTP_USER || !env.SMTP_PASSWORD || !env.SMTP_FROM) {
    return null;
  }
  return nodemailer.createTransport({
    host: env.SMTP_HOST,
    port: env.SMTP_PORT ?? 587,
    secure: (env.SMTP_PORT ?? 587) === 465,
    auth: { user: env.SMTP_USER, pass: env.SMTP_PASSWORD },
  });
}
```
Fire-and-forget error handling pattern (from requestPasswordReset):
```typescript
try {
  await transport.sendMail({ ... });
  logger.info({ message: '...email sent', ... });
} catch (emailError) {
  logger.error({ message: '...email failed', error: emailError instanceof Error ? emailError.message : 'Unknown error' });
  // Do not throw
}
```

From backend/src/services/alertService.ts — relevant context at stub sites:

createAlert (line 223 stub):
- `alert.id`, `alert.severity`, `alert.title`, `alert.message` are available
- `primaryDoctorId` is the Doctor record ID (NOT user ID) — must join to get email
- `data.patientId` available for context

escalateAlert (line 394 stub):
- `alert.assignedToId` is the Doctor record ID (may be null)
- `updated[0]` has the new severity
- `newSeverity`, `alert.severity` (old), `alertId` available

Prisma query to get doctor email (use in both stubs):
```typescript
const doctor = await prisma.doctor.findUnique({
  where: { id: doctorId },
  include: { user: { select: { email: true, firstName: true } } },
});
// doctor?.user.email
// doctor?.user.firstName
```
</context>

<tasks>

<task type="auto">
  <name>Task 1: Implement alert notification emails in alertService.ts</name>
  <files>backend/src/services/alertService.ts</files>
  <action>
Add `import nodemailer from 'nodemailer';` to the existing import block at the top of alertService.ts
(nodemailer is already installed — no package.json change needed).

Add a private helper method `createMailTransport()` to the AlertService class, identical in structure
to the one in authService.ts (copy the 10-line pattern — no cross-service import, keeps alertService
self-contained):

```typescript
private createMailTransport(): nodemailer.Transporter | null {
  if (!env.SMTP_HOST || !env.SMTP_USER || !env.SMTP_PASSWORD || !env.SMTP_FROM) {
    return null;
  }
  return nodemailer.createTransport({
    host: env.SMTP_HOST,
    port: env.SMTP_PORT ?? 587,
    secure: (env.SMTP_PORT ?? 587) === 465,
    auth: { user: env.SMTP_USER, pass: env.SMTP_PASSWORD },
  });
}
```

Also add `import { env } from '../config/env';` to the imports (it is not currently imported in
alertService.ts — confirm by checking the top of the file before editing).

**Replace the line 223 stub** (`// TODO: Send notification to assigned doctor`) with:

```typescript
// Notify assigned doctor by email (fire-and-forget)
if (primaryDoctorId) {
  const transport = this.createMailTransport();
  if (transport) {
    const doctor = await prisma.doctor.findUnique({
      where: { id: primaryDoctorId },
      include: { user: { select: { email: true, firstName: true } } },
    });
    if (doctor?.user.email) {
      try {
        await transport.sendMail({
          from: env.SMTP_FROM,
          to: doctor.user.email,
          subject: `CardioWatch Alert — ${data.severity.toUpperCase()}: ${data.title}`,
          text: [
            `Hi ${doctor.user.firstName},`,
            '',
            `A new ${data.severity} alert has been created for patient ${data.patientId}.`,
            '',
            `Alert: ${data.title}`,
            `Details: ${data.message}`,
            '',
            'Please log in to CardioWatch to review and respond.',
          ].join('\n'),
          html: `<p>Hi ${doctor.user.firstName},</p>
<p>A new <strong>${data.severity}</strong> alert has been created for your patient.</p>
<p><strong>${data.title}</strong><br>${data.message}</p>
<p>Please log in to CardioWatch to review and respond.</p>`,
        });
        logger.info({ message: 'Alert notification email sent', alertId: alert.id, doctorId: primaryDoctorId });
      } catch (emailError) {
        logger.error({
          message: 'Failed to send alert notification email',
          alertId: alert.id,
          error: emailError instanceof Error ? emailError.message : 'Unknown error',
        });
      }
    }
  }
}
```

**Replace the line 394 stub** (`// TODO: Notify relevant staff about escalation`) with:

```typescript
// Notify assigned doctor about escalation (fire-and-forget)
if (alert.assignedToId) {
  const transport = this.createMailTransport();
  if (transport) {
    const doctor = await prisma.doctor.findUnique({
      where: { id: alert.assignedToId },
      include: { user: { select: { email: true, firstName: true } } },
    });
    if (doctor?.user.email) {
      try {
        await transport.sendMail({
          from: env.SMTP_FROM,
          to: doctor.user.email,
          subject: `CardioWatch Alert Escalated — now ${newSeverity.toUpperCase()} (Alert ${alertId})`,
          text: [
            `Hi ${doctor.user.firstName},`,
            '',
            `An alert assigned to you has been escalated.`,
            `Previous severity: ${alert.severity}`,
            `New severity: ${newSeverity}`,
            reason ? `Reason: ${reason}` : '',
            '',
            'Please log in to CardioWatch to review urgently.',
          ].filter(Boolean).join('\n'),
          html: `<p>Hi ${doctor.user.firstName},</p>
<p>An alert assigned to you has been <strong>escalated</strong>.</p>
<p>Severity: <strong>${alert.severity}</strong> → <strong>${newSeverity}</strong>${reason ? `<br>Reason: ${reason}` : ''}</p>
<p>Please log in to CardioWatch to review urgently.</p>`,
        });
        logger.info({ message: 'Escalation notification email sent', alertId, doctorId: alert.assignedToId });
      } catch (emailError) {
        logger.error({
          message: 'Failed to send escalation notification email',
          alertId,
          error: emailError instanceof Error ? emailError.message : 'Unknown error',
        });
      }
    }
  }
}
```

After editing, run `cd /home/recep/Desktop/Machine_Learning/projects/health_monitor_gp/signal-guide-health/backend && npx tsc --noEmit` to confirm zero TypeScript errors.
  </action>
  <verify>
    <automated>cd /home/recep/Desktop/Machine_Learning/projects/health_monitor_gp/signal-guide-health/backend && npx tsc --noEmit && echo "TS OK"</automated>
  </verify>
  <done>
    alertService.ts compiles clean; both TODO stubs replaced with nodemailer email calls that
    check SMTP config, query doctor email via Prisma join, send mail, and log errors without
    throwing. `tsc --noEmit` exits 0.
  </done>
</task>

<task type="auto">
  <name>Task 2: Commit git housekeeping (deleted old src/pages files + .env API URL fix)</name>
  <files>
    src/components/DashboardHeader.tsx,
    src/components/ProtectedRoute.tsx,
    src/pages/Admin.tsx,
    src/pages/Dashboard.tsx,
    src/pages/Login.tsx,
    src/pages/PatientDemo.tsx,
    src/pages/PatientDetail.tsx,
    .env
  </files>
  <action>
Stage and commit the two sets of pending changes in a single commit:

1. The 7 deleted frontend files (old src/pages/ and src/components/ stubs replaced in earlier
   quick tasks by src/pilot/ and src/demo/ structure) — these show as ` D` in git status.
2. The .env VITE_API_BASE_URL change from `/api` to `/api/v1` — already modified, needs staging.

Run from the repo root:
```bash
git add src/components/DashboardHeader.tsx src/components/ProtectedRoute.tsx \
        src/pages/Admin.tsx src/pages/Dashboard.tsx src/pages/Login.tsx \
        src/pages/PatientDemo.tsx src/pages/PatientDetail.tsx \
        .env
git commit -m "chore(quick-6): remove obsolete src/pages stubs; fix VITE_API_BASE_URL to /api/v1"
```

Do NOT use `git add -A` or `git add .` — stage only the listed files to avoid accidentally
including unintended changes.

After the alert notification task (Task 1) is complete, also stage and commit alertService.ts
as part of this commit or a separate commit — whichever is cleaner given execution order.
If Task 1 completes before Task 2 is run, add `backend/src/services/alertService.ts` to the
staging set and use a combined commit message:
`feat(quick-6): alert notification emails + remove obsolete src/pages + fix API URL`
  </action>
  <verify>
    <automated>git -C /home/recep/Desktop/Machine_Learning/projects/health_monitor_gp/signal-guide-health status --short | grep -E "^( D|M ).*src/(pages|components)" || echo "No stale deletions pending"</automated>
  </verify>
  <done>
    `git status` shows no unstaged deletions for src/pages/ or src/components/ files listed above,
    and the .env modification is committed. All changes are in git history.
  </done>
</task>

</tasks>

<verification>
After both tasks complete:

1. `cd backend && npx tsc --noEmit` — exits 0, zero errors
2. `git log --oneline -3` — shows the housekeeping commit(s)
3. `git status` — clean working tree (or only unrelated untracked files)
4. `grep -n 'TODO' backend/src/services/alertService.ts` — returns no lines (both stubs replaced)
5. `grep 'nodemailer' backend/src/services/alertService.ts` — shows import line
</verification>

<success_criteria>
- Both TODO stubs in alertService.ts replaced with working nodemailer calls
- Email sends are fire-and-forget: errors logged, never rethrown
- Email only attempted when SMTP_HOST/USER/PASSWORD/FROM are all set
- Doctor email fetched via Prisma join (not hardcoded or guessed)
- tsc --noEmit passes clean
- 7 old src/pages/ and src/components/ files removed from git tracking
- .env VITE_API_BASE_URL=/api/v1 committed
</success_criteria>

<output>
After completion, create `.planning/quick/6-alert-notifications-cleanup-old-src-page/6-SUMMARY.md`
following the summary template at @./.claude/get-shit-done/templates/summary.md
</output>
