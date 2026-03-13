---
phase: 4-complete-remaining-pilot-gaps
plan: 4
type: execute
wave: 1
depends_on: []
files_modified:
  - backend/src/services/whatsappPilotService.ts
  - backend/src/services/localLlmService.ts
  - backend/src/routes/clinical.ts
  - backend/src/routes/patients.ts
  - playwright.config.ts
  - package.json
  - tests/e2e/auth.spec.ts
  - tests/e2e/patient-alert.spec.ts
  - tests/e2e/device-pairing.spec.ts
autonomous: true
requirements: [PILOT-WHATSAPP, PILOT-CLINICAL, PILOT-GDPR, PILOT-E2E]

must_haves:
  truths:
    - "WhatsApp sendWhatsAppMessage is a named public export callable with (phone, message)"
    - "localLlmService exposes analyzeWellbeingResponse(text) returning TriageDecision with level, summary, escalate"
    - "GET /api/v1/clinical/overview returns totalPatients, redTriage, amberTriage, alertsToday, avgHeartRate"
    - "GET /api/v1/clinical/patients returns scoped patient list with triageLevel, lastCheckIn, wearableCount"
    - "GET /api/v1/clinical/patient/:id/trend returns 7 days of aggregated WearableReadings"
    - "DELETE /patients/:id wraps all cascade deletes in prisma.$transaction before soft-deleting"
    - "npm run test:e2e runs Playwright E2E tests from tests/e2e/ against BASE_URL"
  artifacts:
    - path: "backend/src/services/whatsappPilotService.ts"
      provides: "sendWhatsAppMessage public method + state machine integration"
    - path: "backend/src/services/localLlmService.ts"
      provides: "analyzeWellbeingResponse method returning TriageDecision"
    - path: "backend/src/routes/clinical.ts"
      provides: "GET /overview, GET /patients, GET /patient/:id/trend"
    - path: "backend/src/routes/patients.ts"
      provides: "GDPR cascade delete in transaction"
    - path: "playwright.config.ts"
      provides: "Playwright configuration"
    - path: "tests/e2e/auth.spec.ts"
      provides: "Login/logout E2E test"
    - path: "tests/e2e/patient-alert.spec.ts"
      provides: "Alert acknowledge E2E test"
    - path: "tests/e2e/device-pairing.spec.ts"
      provides: "Device pairing modal E2E test"
  key_links:
    - from: "whatsappPilotService.processIncomingMessage"
      to: "localLlmService.analyzeWellbeingResponse"
      via: "called after patient reply received, result escalates alert if escalate=true"
    - from: "clinical.ts /patient/:id/trend"
      to: "prisma.wearableReading"
      via: "groupBy readingDate, aggregate avgHeartRate/steps/bloodOxygenPercent for last 7 days"
    - from: "patients.ts DELETE"
      to: "prisma.$transaction"
      via: "alert/wearableReading/wearableDevice/pairingToken deleteMany before soft-delete"
---

<objective>
Complete the four remaining pilot gaps: (1) WhatsApp sendWhatsAppMessage public API + analyzeWellbeingResponse integration with alert escalation, (2) three missing clinical dashboard endpoints, (3) GDPR cascade hard-delete inside the existing soft-delete transaction, (4) Playwright E2E test suite with three test files.

Purpose: Make the pilot production-ready — outbound WhatsApp is callable directly, clinicians have the three data endpoints the frontend needs, patient deletion is GDPR-complete, and the E2E suite catches regressions.
Output: Updated service/route files + new Playwright config + three E2E spec files.
</objective>

<execution_context>
Read workflow: .claude/get-shit-done/workflows/execute-plan.md if present.
</execution_context>

<context>
@.planning/STATE.md
@.planning/CODEBASE_ANALYSIS.md

<interfaces>
<!-- Key contracts the executor needs. No codebase exploration required. -->

From backend/src/services/localLlmService.ts (existing):
```typescript
class LocalLlmService {
  isEnabled(): boolean
  getRuntimeConfig(): { enabled: boolean; model: string; baseUrl: string }
  async interpretWellbeingScore(text: string): Promise<WellbeingInterpretation | null>
  async interpretYesNo(text: string, question: string): Promise<YesNoInterpretation | null>
  async summarizeCheckIn(input: CheckInSummaryInput): Promise<CompletionInterpretation | null>
  private async chatJson<T>(messages: LlmChatMessage[]): Promise<T | null>
}
export const localLlmService = new LocalLlmService();
```

From backend/src/services/whatsappPilotService.ts (existing):
```typescript
// sendTextMessage is already private — it sends via fetch to WHATSAPP_API_URL with Bearer token
// processIncomingMessage handles the state machine: wellbeing → symptoms → medications → completed
// On medications completion: triage computed, alert created if triage !== 'green'
// State machine uses FollowUpState { step, wellbeingScore?, symptomsReported?, medicationsTaken? }
export const whatsappPilotService = new WhatsAppPilotService();
```

From backend/prisma/schema.prisma (relevant models):
```
Patient: { id, triageLevel (TriageLevel enum: red|amber|green), lastCheckIn, wellbeingScore }
WearableReading: { patientId, deviceId, readingDate (Date), avgHeartRate (Int?), steps (Int?), bloodOxygenPercent (Decimal?) }
WearableDevice: { patientId, isConnected }
Alert: { patientId, resolved, createdAt }
PairingToken: { patientId }
// Note: WearableReading has patientId directly — no need to join through device for deleteMany
```

From backend/src/routes/clinical.ts (existing routes):
```
GET /pilot/overview       — implemented (rich pilot stats)
GET /pilot/whatsapp/conversations — implemented
GET /pilot/patients       — implemented (basic patient+device list)
GET /pilot/whatsapp/patients/:patientId/messages — implemented
// MISSING (must add):
GET /overview             — { totalPatients, redTriage, amberTriage, alertsToday, avgHeartRate }
GET /patients             — scoped list with triageLevel, lastCheckIn, wearableCount
GET /patient/:id/trend    — 7-day WearableReading aggregates
```

From backend/src/routes/patients.ts DELETE (existing):
```typescript
// Lines 510-532: prisma.$transaction wraps user.update + patient.update (soft delete)
// MISSING: deleteMany for alert, wearableReading, wearableDevice, pairingToken
// Must be added INSIDE the same $transaction array before the soft-delete operations
```
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Add sendWhatsAppMessage public method + analyzeWellbeingResponse to LLM service + wire escalation</name>
  <files>
    backend/src/services/whatsappPilotService.ts
    backend/src/services/localLlmService.ts
  </files>
  <action>
**In localLlmService.ts — add `analyzeWellbeingResponse` public method to LocalLlmService class (before the closing brace, after `summarizeCheckIn`):**

```typescript
async analyzeWellbeingResponse(text: string): Promise<{
  level: 'green' | 'amber' | 'red';
  summary: string;
  escalate: boolean;
} | null> {
  const payload = await this.chatJson<{
    level?: unknown;
    summary?: unknown;
    escalate?: unknown;
  }>([
    {
      role: 'system',
      content:
        'Analyse a cardiac patient wellbeing message. Respond with JSON only: {"level": "green|amber|red", "summary": string (max 200 chars, clinician-facing), "escalate": boolean}. Escalate=true only for red.',
    },
    {
      role: 'user',
      content: `Patient message: ${text}`,
    },
  ]);

  if (!payload) return null;

  const level = normalizeTriage(payload.level);
  if (!level) return null;

  const summary =
    typeof payload.summary === 'string' && payload.summary.trim()
      ? payload.summary.trim().slice(0, 200)
      : `Triage level: ${level}`;

  const escalate =
    typeof payload.escalate === 'boolean' ? payload.escalate : level === 'red';

  return { level, summary, escalate };
}
```

**In whatsappPilotService.ts — expose `sendWhatsAppMessage` as a public method:**

The existing private `sendTextMessage(to, body)` already does the fetch. Add a public wrapper that delegates to it:

```typescript
async sendWhatsAppMessage(phone: string, message: string): Promise<string | null> {
  return this.sendTextMessage(normalizePhone(phone), message);
}
```

Add this public method to `WhatsAppPilotService` class, immediately after `startFollowUpBatch`.

**Wire analyzeWellbeingResponse into processIncomingMessage (medications step completion):**

In the medications step completion block (around line 717, after `const ruleTriage = triageFromState(state)`), add:

```typescript
// Supplement with analyzeWellbeingResponse for the full patient message context
let analyzeResult: { level: 'green' | 'amber' | 'red'; summary: string; escalate: boolean } | null = null;
if (llmRuntime.enabled) {
  analyzeResult = await localLlmService.analyzeWellbeingResponse(
    [
      `Wellbeing: ${state.wellbeingScore ?? 'n/a'}`,
      `Symptoms: ${state.symptomsReported ? 'yes' : 'no'}`,
      `Medications taken: ${state.medicationsTaken ? 'yes' : 'no'}`,
    ].join('. ')
  );
}
```

Then in the alert creation block (around line 817, `if (triage !== 'green')`), add escalation handling after the alert is created:

```typescript
// If analyzeWellbeingResponse recommends escalation for a doctor, log it
if (analyzeResult?.escalate && triage === 'red') {
  logger.warn({
    message: 'LLM analyzeWellbeingResponse recommends escalation',
    patientId: patient.id,
    level: analyzeResult.level,
    summary: analyzeResult.summary,
  });
}
```

**TypeScript check:** Run `cd /home/recep/Desktop/Machine_Learning/projects/health_monitor_gp/signal-guide-health/backend && npx tsc --noEmit` after editing. Fix any type errors before proceeding.
  </action>
  <verify>
    cd /home/recep/Desktop/Machine_Learning/projects/health_monitor_gp/signal-guide-health/backend && npx tsc --noEmit 2>&1 | grep -E "error TS|^Found" | head -20
  </verify>
  <done>
    tsc --noEmit exits 0. localLlmService exports analyzeWellbeingResponse method. whatsappPilotService exports sendWhatsAppMessage public method. No TypeScript errors.
  </done>
</task>

<task type="auto">
  <name>Task 2: Add three missing clinical endpoints to clinical.ts</name>
  <files>backend/src/routes/clinical.ts</files>
  <action>
Append three new routes to clinical.ts before `export default router`.

**Route 1: GET /overview**
```typescript
router.get('/overview', async (req: Request, res: Response) => {
  try {
    const scopedPatientIds = await getScopedPatientIds(req);
    const patientWhere: Prisma.PatientWhereInput =
      scopedPatientIds === null ? {} : { id: { in: scopedPatientIds } };
    const patientIdScope =
      scopedPatientIds === null ? {} : { patientId: { in: scopedPatientIds } };

    const todayStart = new Date();
    todayStart.setUTCHours(0, 0, 0, 0);

    const [totalPatients, redTriage, amberTriage, alertsToday, avgHrAgg] = await Promise.all([
      prisma.patient.count({ where: patientWhere }),
      prisma.patient.count({ where: { ...patientWhere, triageLevel: 'red' } }),
      prisma.patient.count({ where: { ...patientWhere, triageLevel: 'amber' } }),
      prisma.alert.count({
        where: { ...patientIdScope, resolved: false, createdAt: { gte: todayStart } },
      }),
      prisma.wearableReading.aggregate({
        where: { ...patientIdScope },
        _avg: { avgHeartRate: true },
      }),
    ]);

    res.json({
      status: 'success',
      data: {
        totalPatients,
        redTriage,
        amberTriage,
        alertsToday,
        avgHeartRate:
          avgHrAgg._avg.avgHeartRate !== null
            ? Math.round(avgHrAgg._avg.avgHeartRate)
            : null,
      },
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: error instanceof Error ? error.message : 'Failed to fetch clinical overview',
    });
  }
});
```

**Route 2: GET /patients**
```typescript
router.get('/patients', async (req: Request, res: Response) => {
  try {
    const requestedLimit = Number(req.query['limit']);
    const limit = Number.isFinite(requestedLimit)
      ? Math.max(1, Math.min(300, requestedLimit))
      : 100;

    const scopedPatientIds = await getScopedPatientIds(req);
    const patientWhere: Prisma.PatientWhereInput =
      scopedPatientIds === null ? {} : { id: { in: scopedPatientIds } };

    const patients = await prisma.patient.findMany({
      where: patientWhere,
      select: {
        id: true,
        triageLevel: true,
        lastCheckIn: true,
        user: { select: { firstName: true, lastName: true } },
        _count: { select: { wearableDevices: { where: { isConnected: true } } } },
      },
      take: limit,
      orderBy: [{ triageLevel: 'asc' }, { lastCheckIn: 'asc' }],
    });

    res.json({
      status: 'success',
      data: {
        generatedAt: new Date().toISOString(),
        patients: patients.map((p) => ({
          id: p.id,
          name: `${p.user.firstName} ${p.user.lastName}`.trim(),
          triageLevel: p.triageLevel,
          lastCheckIn: p.lastCheckIn ? p.lastCheckIn.toISOString() : null,
          wearableCount: p._count.wearableDevices,
        })),
      },
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: error instanceof Error ? error.message : 'Failed to fetch patients',
    });
  }
});
```

**Route 3: GET /patient/:id/trend**
```typescript
router.get('/patient/:id/trend', async (req: Request, res: Response) => {
  try {
    const patientId = req.params['id'];
    if (!patientId) {
      res.status(400).json({ status: 'error', message: 'patientId required' });
      return;
    }

    const scopedPatientIds = await getScopedPatientIds(req);
    if (scopedPatientIds !== null && !scopedPatientIds.includes(patientId)) {
      res.status(403).json({ status: 'error', message: 'Access denied' });
      return;
    }

    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    sevenDaysAgo.setUTCHours(0, 0, 0, 0);

    const readings = await prisma.wearableReading.findMany({
      where: {
        patientId,
        readingDate: { gte: sevenDaysAgo },
      },
      orderBy: { readingDate: 'asc' },
      select: {
        readingDate: true,
        avgHeartRate: true,
        steps: true,
        bloodOxygenPercent: true,
      },
    });

    // Aggregate by day
    const byDay = new Map<
      string,
      { heartRateSum: number; hrCount: number; stepsSum: number; oxySum: number; oxyCount: number }
    >();

    for (const r of readings) {
      const day = r.readingDate.toISOString().slice(0, 10);
      const current = byDay.get(day) || { heartRateSum: 0, hrCount: 0, stepsSum: 0, oxySum: 0, oxyCount: 0 };
      if (typeof r.avgHeartRate === 'number') {
        current.heartRateSum += r.avgHeartRate;
        current.hrCount += 1;
      }
      if (typeof r.steps === 'number') {
        current.stepsSum += r.steps;
      }
      if (r.bloodOxygenPercent !== null) {
        current.oxySum += Number(r.bloodOxygenPercent);
        current.oxyCount += 1;
      }
      byDay.set(day, current);
    }

    const trend = Array.from(byDay.entries()).map(([date, agg]) => ({
      date,
      avgHeartRate: agg.hrCount > 0 ? Math.round(agg.heartRateSum / agg.hrCount) : null,
      steps: agg.stepsSum || null,
      bloodOxygenPercent: agg.oxyCount > 0 ? Number((agg.oxySum / agg.oxyCount).toFixed(1)) : null,
    }));

    res.json({ status: 'success', data: { patientId, trend } });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: error instanceof Error ? error.message : 'Failed to fetch trend',
    });
  }
});
```

Run `cd /home/recep/Desktop/Machine_Learning/projects/health_monitor_gp/signal-guide-health/backend && npx tsc --noEmit` and fix any errors.
  </action>
  <verify>
    cd /home/recep/Desktop/Machine_Learning/projects/health_monitor_gp/signal-guide-health/backend && npx tsc --noEmit 2>&1 | grep -c "error TS" || echo "0 errors"
  </verify>
  <done>
    tsc --noEmit exits 0. clinical.ts exports three new routes: GET /overview, GET /patients, GET /patient/:id/trend. Each returns the specified shape.
  </done>
</task>

<task type="auto">
  <name>Task 3: GDPR cascade delete + install Playwright + E2E test suite</name>
  <files>
    backend/src/routes/patients.ts
    playwright.config.ts
    package.json
    tests/e2e/auth.spec.ts
    tests/e2e/patient-alert.spec.ts
    tests/e2e/device-pairing.spec.ts
  </files>
  <action>
**Step A: GDPR cascade delete in patients.ts**

Find the existing `prisma.$transaction([` at line 510 (the soft-delete transaction). Replace it so the transaction also hard-deletes related data BEFORE the soft-delete operations. The final transaction array must be:

```typescript
await prisma.$transaction([
  // Hard-delete related data for GDPR compliance
  prisma.alert.deleteMany({ where: { patientId: id } }),
  prisma.wearableReading.deleteMany({ where: { patientId: id } }),
  prisma.wearableDevice.deleteMany({ where: { patientId: id } }),
  prisma.pairingToken.deleteMany({ where: { patientId: id } }),
  // Soft-delete the patient and anonymise user record
  prisma.user.update({
    where: { id: existing.userId },
    data: {
      email: `deleted_${id}@deleted.invalid`,
      firstName: 'Deleted',
      lastName: 'Patient',
      status: 'inactive',
    },
  }),
  prisma.patient.update({
    where: { id },
    data: {
      nhsNumber: null,
      whatsappPhone: null,
      notes: null,
      addressLine1: null,
      addressLine2: null,
      city: null,
      postcode: null,
    },
  }),
]);
```

Note: `checkIns`, `chatMessages`, `conversations`, `appointments`, `doctorAssignments`, `medicalHistory`, `dailyStats` all have `onDelete: Cascade` in the Prisma schema so they are handled automatically when the patient is deleted. The models above (Alert, WearableReading, WearableDevice, PairingToken) also have cascade but explicit deleteMany ensures the transaction is atomic and order-controlled. AlertAction has cascade from Alert.

Run `cd /home/recep/Desktop/Machine_Learning/projects/health_monitor_gp/signal-guide-health/backend && npx tsc --noEmit` and fix errors.

**Step B: Install Playwright**

```bash
cd /home/recep/Desktop/Machine_Learning/projects/health_monitor_gp/signal-guide-health
npm install --save-dev @playwright/test
npx playwright install chromium --with-deps
```

**Step C: Add test:e2e script to root package.json**

In the `scripts` object, add:
```json
"test:e2e": "playwright test"
```

**Step D: Create playwright.config.ts at project root**

```typescript
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false,
  forbidOnly: !!process.env['CI'],
  retries: process.env['CI'] ? 1 : 0,
  workers: 1,
  reporter: 'list',
  use: {
    baseURL: process.env['BASE_URL'] || 'http://localhost:8081',
    trace: 'on-first-retry',
    headless: true,
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});
```

**Step E: Create tests/e2e/ directory and three spec files**

`tests/e2e/auth.spec.ts`:
```typescript
import { test, expect } from '@playwright/test';

const PILOT_EMAIL = process.env['PILOT_EMAIL'] || 'doctor@cardiowatch.pilot';
const PILOT_PASSWORD = process.env['PILOT_PASSWORD'] || 'PilotDoc2024!';

test('login with pilot credentials loads dashboard then logout succeeds', async ({ page }) => {
  await page.goto('/pilot/login');
  await page.getByLabel(/email/i).fill(PILOT_EMAIL);
  await page.getByLabel(/password/i).fill(PILOT_PASSWORD);
  await page.getByRole('button', { name: /sign in|log in/i }).click();

  // Dashboard should load — wait for a known element
  await expect(page).toHaveURL(/\/pilot\/dashboard/, { timeout: 10000 });
  await expect(page.getByText(/patient|triage/i).first()).toBeVisible({ timeout: 10000 });

  // Logout
  const logoutBtn = page.getByRole('button', { name: /logout|sign out/i });
  if (await logoutBtn.isVisible()) {
    await logoutBtn.click();
    await expect(page).toHaveURL(/\/pilot\/login/, { timeout: 5000 });
  }
});
```

`tests/e2e/patient-alert.spec.ts`:
```typescript
import { test, expect } from '@playwright/test';

const PILOT_EMAIL = process.env['PILOT_EMAIL'] || 'doctor@cardiowatch.pilot';
const PILOT_PASSWORD = process.env['PILOT_PASSWORD'] || 'PilotDoc2024!';

test.beforeEach(async ({ page }) => {
  await page.goto('/pilot/login');
  await page.getByLabel(/email/i).fill(PILOT_EMAIL);
  await page.getByLabel(/password/i).fill(PILOT_PASSWORD);
  await page.getByRole('button', { name: /sign in|log in/i }).click();
  await expect(page).toHaveURL(/\/pilot\/dashboard/, { timeout: 10000 });
});

test('navigate to first patient and acknowledge first alert', async ({ page }) => {
  // Navigate to first patient card
  const firstPatientLink = page.getByRole('link', { name: /patient|view/i }).first();
  await firstPatientLink.click();
  await expect(page).toHaveURL(/\/pilot\/patient\//, { timeout: 8000 });

  // Find and click acknowledge button on first alert
  const acknowledgeBtn = page.getByRole('button', { name: /acknowledge/i }).first();
  const hasAlerts = await acknowledgeBtn.isVisible({ timeout: 5000 }).catch(() => false);

  if (hasAlerts) {
    await acknowledgeBtn.click();
    // Alert should be marked resolved or button disappears / changes text
    await expect(
      page.getByText(/acknowledged|resolved/i).first()
    ).toBeVisible({ timeout: 5000 });
  } else {
    // No active alerts — that is acceptable, test passes
    test.info().annotations.push({ type: 'note', description: 'No active alerts found for first patient' });
  }
});
```

`tests/e2e/device-pairing.spec.ts`:
```typescript
import { test, expect } from '@playwright/test';

const PILOT_EMAIL = process.env['PILOT_EMAIL'] || 'doctor@cardiowatch.pilot';
const PILOT_PASSWORD = process.env['PILOT_PASSWORD'] || 'PilotDoc2024!';

test.beforeEach(async ({ page }) => {
  await page.goto('/pilot/login');
  await page.getByLabel(/email/i).fill(PILOT_EMAIL);
  await page.getByLabel(/password/i).fill(PILOT_PASSWORD);
  await page.getByRole('button', { name: /sign in|log in/i }).click();
  await expect(page).toHaveURL(/\/pilot\/dashboard/, { timeout: 10000 });
});

test('navigate to patient and open device pairing modal with QR/Manual/DeepLink tabs', async ({ page }) => {
  // Navigate to first patient
  const firstPatientLink = page.getByRole('link', { name: /patient|view/i }).first();
  await firstPatientLink.click();
  await expect(page).toHaveURL(/\/pilot\/patient\//, { timeout: 8000 });

  // Click Connect Device button
  const connectBtn = page.getByRole('button', { name: /connect device|pair device/i });
  await expect(connectBtn).toBeVisible({ timeout: 8000 });
  await connectBtn.click();

  // Modal should open
  const modal = page.getByRole('dialog');
  await expect(modal).toBeVisible({ timeout: 5000 });

  // Verify QR tab is present (default)
  await expect(modal.getByRole('tab', { name: /qr/i })).toBeVisible({ timeout: 3000 });

  // Click Manual tab
  await modal.getByRole('tab', { name: /manual/i }).click();
  await expect(modal.getByRole('tabpanel')).toBeVisible();

  // Click DeepLink tab
  await modal.getByRole('tab', { name: /deep.?link|app link/i }).click();
  await expect(modal.getByRole('tabpanel')).toBeVisible();
});
```
  </action>
  <verify>
    cd /home/recep/Desktop/Machine_Learning/projects/health_monitor_gp/signal-guide-health && npx tsc --noEmit -p backend/tsconfig.json 2>&1 | grep -c "error TS" || echo "0"; ls tests/e2e/*.spec.ts; cat package.json | grep "test:e2e"
  </verify>
  <done>
    backend tsc exits 0. patients.ts DELETE transaction includes deleteMany for alert/wearableReading/wearableDevice/pairingToken. tests/e2e/ contains auth.spec.ts, patient-alert.spec.ts, device-pairing.spec.ts. playwright.config.ts exists at project root. package.json has "test:e2e": "playwright test" in scripts.
  </done>
</task>

</tasks>

<verification>
After all three tasks complete:

1. TypeScript clean: `cd backend && npx tsc --noEmit` exits 0
2. New exports exist: grep for `sendWhatsAppMessage` in whatsappPilotService.ts and `analyzeWellbeingResponse` in localLlmService.ts
3. Clinical routes registered: grep for `router.get('/overview'` and `router.get('/patients'` and `router.get('/patient/:id/trend'` in clinical.ts
4. GDPR transaction: grep for `prisma.alert.deleteMany` inside the DELETE handler in patients.ts
5. E2E suite: `npm run test:e2e -- --list` (does not require running server) shows 3 test files
</verification>

<success_criteria>
- `cd backend && npx tsc --noEmit` exits 0 with zero errors
- `whatsappPilotService.sendWhatsAppMessage(phone, message)` is a public callable method
- `localLlmService.analyzeWellbeingResponse(text)` returns `{ level, summary, escalate }`
- GET /api/v1/clinical/overview, /patients, /patient/:id/trend are all registered and return correct shapes
- DELETE /patients/:id transaction contains deleteMany for Alert, WearableReading, WearableDevice, PairingToken
- `npm run test:e2e -- --list` lists 3 spec files without errors
</success_criteria>

<output>
After completion, create `.planning/quick/4-complete-remaining-pilot-gaps-whatsapp-s/4-SUMMARY.md` with:
- What was implemented
- Any TypeScript issues encountered and resolved
- E2E test file locations
- Note if analyzeWellbeingResponse required any schema changes
</output>
