---
phase: quick-7
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - backend/src/routes/doctors.ts
  - backend/src/routes/appointments.ts
  - backend/src/routes/admin.ts
autonomous: true
requirements: [QUICK-7]

must_haves:
  truths:
    - "GET /api/v1/doctors returns real doctor rows with user name fields"
    - "GET /api/v1/doctors/:id/patients returns DoctorPatientAssignment rows with patient data"
    - "GET /api/v1/doctors/:id/schedule returns Appointment rows for the doctor"
    - "GET /api/v1/appointments returns real appointment rows scoped to the caller"
    - "POST /api/v1/appointments creates a new Appointment row and returns it"
    - "PUT /api/v1/appointments/:id updates an Appointment row"
    - "POST /api/v1/appointments/:id/cancel sets status=cancelled, cancelledAt, cancelledById, cancellationReason"
    - "POST /api/v1/appointments/:id/confirm sets status=confirmed"
    - "GET /api/v1/admin/stats returns totalPatients, totalDoctors, activeAlerts, totalAppointments counts"
    - "backend tsc --noEmit exits 0 after all changes"
  artifacts:
    - path: "backend/src/routes/doctors.ts"
      provides: "Doctors CRUD with Prisma queries"
    - path: "backend/src/routes/appointments.ts"
      provides: "Appointments CRUD with Prisma queries"
    - path: "backend/src/routes/admin.ts"
      provides: "GET /stats with real Prisma counts"
  key_links:
    - from: "backend/src/routes/doctors.ts"
      to: "prisma.doctor"
      via: "import { prisma } from '../config/database'"
      pattern: "prisma\\.doctor\\.(findMany|findUnique)"
    - from: "backend/src/routes/appointments.ts"
      to: "prisma.appointment"
      via: "import { prisma } from '../config/database'"
      pattern: "prisma\\.appointment\\.(findMany|findUnique|create|update)"
    - from: "backend/src/routes/admin.ts"
      to: "prisma.patient.count / prisma.doctor.count / prisma.alert.count / prisma.appointment.count"
      via: "existing prisma import at line 9"
      pattern: "prisma\\.\\w+\\.count"
---

<objective>
Replace all stub responses in doctors.ts, appointments.ts, and the admin /stats handler with real Prisma queries. Each file is one atomic task with its own commit.

Purpose: The front-end and API consumers currently receive empty arrays and nulls from these routes; wiring the Prisma queries makes the API surface functional.
Output: Three modified route files, all TypeScript-clean.
</objective>

<execution_context>
@./.claude/get-shit-done/workflows/execute-plan.md
@./.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@.planning/ROADMAP.md

<!-- Pattern reference — already read, pasted inline so executor needs no extra reads -->
<interfaces>
<!-- From backend/prisma/schema.prisma — relevant models -->

Doctor:
  id, userId, gmcNumber, specialty, title, department, jobTitle,
  acceptingNewPatients, totalPatients, createdAt, updatedAt
  relations: user (User), patientAssignments (DoctorPatientAssignment[]), appointments (Appointment[])

DoctorPatientAssignment:
  id, doctorId, patientId, isPrimary, assignedAt, status
  relations: doctor (Doctor), patient (Patient)

Patient:
  id, userId, nhsNumber, triageLevel, lastCheckIn, riskScore
  relations: user (User)

Appointment:
  id, patientId, doctorId, type, status (AppointmentStatus enum: scheduled|confirmed|completed|cancelled|no_show),
  scheduledAt, durationMinutes, locationType, locationDetails, reason,
  clinicalNotes, cancelledAt, cancelledById, cancellationReason, createdById, createdAt, updatedAt
  relations: patient (Patient), doctor (Doctor), cancelledBy (User?), createdBy (User?)

Alert:
  id, patientId, severity, resolved (Boolean), ...

<!-- From backend/src/routes/patients.ts — established pattern -->
import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { Prisma } from '@prisma/client';
import { authenticate, requireRole } from '../middleware/auth';
import { prisma } from '../config/database';
import { logger } from '../utils/logger';

// Route handler pattern:
try {
  const result = await prisma.model.findMany({ where, include, skip, take, orderBy });
  res.json({ status: 'success', data: { items: result, total, page, limit } });
} catch (error) {
  logger.error({ message: '...', error: error instanceof Error ? error.message : 'Unknown' });
  res.status(500).json({ status: 'error', message: 'Internal server error' });
}

// 404 pattern:
if (!record) {
  return res.status(404).json({ status: 'error', message: 'Not found' });
}
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Implement doctors.ts with real Prisma queries</name>
  <files>backend/src/routes/doctors.ts</files>
  <action>
Rewrite backend/src/routes/doctors.ts. Keep the same route signatures and requireRole guards. Add these imports at the top: `prisma` from `'../config/database'`, `logger` from `'../utils/logger'`, `Prisma` from `'@prisma/client'`.

Implement each route:

GET / — prisma.doctor.findMany including user (select firstName, lastName, email), orderBy user.lastName asc. Return { doctors, total }.

GET /:id — prisma.doctor.findUnique({ where: { id: req.params.id }, include: { user: { select: { firstName, lastName, email, phone } }, patientAssignments: { where: { status: 'active' }, include: { patient: { select: { id, triageLevel } } } } } }). 404 if null.

GET /:id/patients — prisma.doctorPatientAssignment.findMany({ where: { doctorId: req.params.id, status: 'active' }, include: { patient: { include: { user: { select: { firstName, lastName, email } } } } }, orderBy: { assignedAt: 'desc' } }). Return { patients: assignments, total }.

GET /:id/schedule — prisma.appointment.findMany({ where: { doctorId: req.params.id }, include: { patient: { include: { user: { select: { firstName, lastName } } } } }, orderBy: { scheduledAt: 'asc' } }). Support optional query param `status` (filter by AppointmentStatus enum if provided and valid). Return { schedule, total }.

Wrap every handler in try/catch. Use logger.error on catch, return 500. After writing, commit with message: `feat(quick-7): implement doctors.ts Prisma queries`
  </action>
  <verify>
    <automated>cd /home/recep/Desktop/Machine_Learning/projects/health_monitor_gp/signal-guide-health/backend && npx tsc --noEmit 2>&1 | grep -c "error TS" || echo "0 errors"</automated>
  </verify>
  <done>doctors.ts has no stubs (no `[]` or `null` literal returns), tsc --noEmit reports 0 errors, git commit created.</done>
</task>

<task type="auto">
  <name>Task 2: Implement appointments.ts with real Prisma queries</name>
  <files>backend/src/routes/appointments.ts</files>
  <action>
Rewrite backend/src/routes/appointments.ts. Add imports: `Prisma` from `'@prisma/client'`, `z` from `'zod'`, `prisma` from `'../config/database'`, `logger` from `'../utils/logger'`. Keep `authenticate`, `requireRole` imports.

Add validation schemas at the top:

```
const createAppointmentSchema = z.object({
  patientId: z.string().uuid(),
  doctorId: z.string().uuid(),
  type: z.string().min(1),
  scheduledAt: z.string().datetime(),
  durationMinutes: z.number().int().min(5).default(30),
  locationType: z.string().default('in_person'),
  locationDetails: z.string().optional(),
  reason: z.string().optional(),
});

const updateAppointmentSchema = createAppointmentSchema.partial().omit({ patientId: true, doctorId: true });
```

Implement each route:

GET / — scope by role: if req.user.role === 'doctor', add where.doctorId = (lookup Doctor by userId); if req.user.role === 'patient', add where.patientId = (lookup Patient by userId). Support optional query params: `status` (AppointmentStatus), `from` (ISO date), `to` (ISO date). Include patient.user (firstName, lastName) and doctor.user (firstName, lastName). Paginate: page/limit from query, default page=1 limit=20. Return { appointments, total, page, limit }.

GET /:id — findUnique with same includes. 404 if null. Role-gate read: doctor can only see own appointments, patient can only see own, admin/super_admin see all.

POST / — parse body with createAppointmentSchema, create appointment with createdById = req.user.userId. Return 201 with created appointment (include patient.user, doctor.user).

PUT /:id — findUnique first (404 if missing), parse body with updateAppointmentSchema, update. Return updated appointment.

POST /:id/cancel — findUnique (404 if missing), check status is not already cancelled/completed (return 400 if so). Update: status='cancelled', cancelledAt=new Date(), cancelledById=req.user.userId, cancellationReason from req.body.reason (optional string). Return updated appointment.

POST /:id/confirm — findUnique (404 if missing), check status === 'scheduled' (400 if not). Update status='confirmed'. Return updated appointment.

Wrap every handler in try/catch. Use logger.error on catch, return 500. After writing, commit with message: `feat(quick-7): implement appointments.ts Prisma queries`
  </action>
  <verify>
    <automated>cd /home/recep/Desktop/Machine_Learning/projects/health_monitor_gp/signal-guide-health/backend && npx tsc --noEmit 2>&1 | grep -c "error TS" || echo "0 errors"</automated>
  </verify>
  <done>appointments.ts has no stub returns, all 6 routes use real Prisma queries, tsc --noEmit 0 errors, git commit created.</done>
</task>

<task type="auto">
  <name>Task 3: Implement GET /admin/stats with real Prisma counts</name>
  <files>backend/src/routes/admin.ts</files>
  <action>
Locate the GET /stats stub at line ~169 of backend/src/routes/admin.ts:

```ts
router.get('/stats', async (_req: Request, res: Response) => {
  res.json({ status: 'success', data: { stats: {} } });
});
```

Replace it with a real implementation using Promise.all to run counts in parallel:

```ts
router.get('/stats', async (_req: Request, res: Response) => {
  try {
    const [
      totalPatients,
      totalDoctors,
      activeAlerts,
      totalAppointments,
      activeUsers,
    ] = await Promise.all([
      prisma.patient.count(),
      prisma.doctor.count(),
      prisma.alert.count({ where: { resolved: false } }),
      prisma.appointment.count(),
      prisma.user.count({ where: { status: 'active' } }),
    ]);

    res.json({
      status: 'success',
      data: {
        stats: {
          totalPatients,
          totalDoctors,
          activeAlerts,
          totalAppointments,
          activeUsers,
        },
      },
    });
  } catch (error) {
    logger.error({
      message: 'Failed to fetch admin stats',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    res.status(500).json({ status: 'error', message: 'Internal server error' });
  }
});
```

Do NOT touch any other route in admin.ts — only the /stats handler. After writing, commit with message: `feat(quick-7): implement GET /admin/stats with real Prisma counts`
  </action>
  <verify>
    <automated>cd /home/recep/Desktop/Machine_Learning/projects/health_monitor_gp/signal-guide-health/backend && npx tsc --noEmit 2>&1 | grep -c "error TS" || echo "0 errors"</automated>
  </verify>
  <done>GET /admin/stats returns { totalPatients, totalDoctors, activeAlerts, totalAppointments, activeUsers } from real Prisma counts. tsc --noEmit 0 errors. git commit created.</done>
</task>

</tasks>

<verification>
After all 3 tasks:
- `cd backend && npx tsc --noEmit` exits 0 with zero "error TS" lines
- No route in doctors.ts, appointments.ts returns a bare `[]` or `null` literal
- `git log --oneline -3` shows 3 commits, one per task
</verification>

<success_criteria>
All 8 previously-stubbed route handlers return real Prisma query results. tsc --noEmit clean. Three atomic commits in git history.
</success_criteria>

<output>
After completion, create `.planning/quick/7-backend-stubs-implement-doctors-routes-a/7-SUMMARY.md` following the summary template.
</output>
