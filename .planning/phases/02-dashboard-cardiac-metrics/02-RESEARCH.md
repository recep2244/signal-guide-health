# Phase 2: Dashboard & Cardiac Metrics — Research

**Researched:** 2026-03-14
**Domain:** React/TanStack Query frontend data alignment + Express/Prisma cardiac metrics API
**Confidence:** HIGH

## Summary

The dashboard currently crashes on production data because it accesses mock-schema field names (`p.wearableData[last].restingHR`, `p.wellbeingScore`, `p.ejectionFraction`, `p.cardiacBiomarkers`, `p.riskScores`, `p.bloodPressure`) that do not exist in the real Prisma `Patient` model or the API response shape returned by `GET /patients`. The real API returns Prisma `Patient` rows that include `user`, `alerts` relations but no wearable reading sub-objects, no cardiac biomarker objects, and no computed risk scores.

The fix has two layers: (1) align the API response to include the data the frontend needs (latest wearable reading, computed risk scores) by expanding the `GET /patients` and `GET /patients/:id` Prisma includes; and (2) update the frontend `Patient` type and Dashboard/PatientDetail rendering to consume actual API field names with safe null guards. A new `CardiacMetrics` resource (POST/GET per patient) is needed for CARD-01 through CARD-03 — the Prisma schema already has `ejectionFraction` and `nyhaClass` on `Patient` but BNP/troponin and computed risk scores (GRACE, CHA2DS2-VASc) need a new `CardiacMetric` model or a dedicated update endpoint.

**Primary recommendation:** Add a `CardiacMetric` model to Prisma to store timestamped per-patient metric entries. Extend the patients API include to attach the latest wearable reading and latest cardiac metric. Compute GRACE/CHA2DS2-VASc server-side in the GET patient(s) handler and return them in a `computedRiskScores` envelope. Update the frontend Patient type and Dashboard to read the corrected field paths with optional chaining.

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| DASH-01 | Dashboard vitals (HR, SpO2, BP, steps) sourced from real backend API fields — no hardcoded mock schema access | API must include latest WearableReading in patient list response; frontend reads `latestReading.restingHeartRate` not `wearableData[last].restingHR` |
| DASH-02 | Patient list triage badges computed from real alert and wearable data returned by API | `triageLevel` already on Patient model; alerts already included in GET /patients; PatientCard must read from these, not mock fields |
| DASH-03 | Dashboard handles gracefully when cardiac metric fields absent — shows "Not recorded" | Optional chaining + null guards on `patient.cardiacMetric`, `patient.computedRiskScores`; no crash on undefined |
| CARD-01 | Clinician can manually enter ejection fraction, BNP/NT-proBNP, troponin, NYHA class per patient | New POST /patients/:id/cardiac-metrics endpoint + CardiacMetric Prisma model + frontend form |
| CARD-02 | GRACE and CHA2DS2-VASc risk scores computed server-side from patient data | Server-side calculation in GET /patients/:id (and list); use patient age, gender, diagnosis fields already in schema |
| CARD-03 | Patient detail page displays cardiac metrics from API (not hardcoded) | usePatientDetail hook already switches on USE_MOCK; production path calls real API; ensure response includes cardiac metric |
</phase_requirements>

---

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Prisma 5 | 5.x (existing) | DB schema migration + ORM queries | Already used; new CardiacMetric model follows existing patterns |
| TanStack Query v5 | 5.x (existing) | Server state, caching, mutation | Already used in usePatientData.ts; add useMutation for CARD-01 form |
| Express | 4.x (existing) | New POST /cardiac-metrics route | Already used; no new framework needed |
| Zod | existing | Input validation on new endpoint | Already used in patients.ts |
| React Hook Form | existing (check) | Cardiac metric entry form | If not present, use controlled inputs; form is small (4 fields) |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| date-fns | existing | Age calculation for GRACE/CHA2DS2-VASc | Use `differenceInYears(now, dateOfBirth)` |

### Installation
No new packages required — all needed libraries are already in the project.

---

## Architecture Patterns

### Recommended Project Structure for New Code
```
backend/src/routes/
├── patients.ts          # Extend GET / and GET /:id includes
├── clinical.ts          # Add POST /:patientId/cardiac-metrics here, or add to patients.ts
backend/prisma/
├── schema.prisma        # Add CardiacMetric model
├── migrations/          # New migration SQL (created manually — no live DB)
src/
├── hooks/usePatientData.ts        # Add useCardiacMetricMutation hook
├── types/patient.ts               # Update Patient type to match real API shape
├── pilot/pages/PatientDetail.tsx  # Consume cardiac metrics from API
├── pilot/pages/Dashboard.tsx      # Fix field name accesses
```

### Pattern 1: API Response Shape Extension
**What:** Extend `GET /patients` and `GET /patients/:id` Prisma include to attach `latestReading` and `latestCardiacMetric` as computed properties in the response body.
**When to use:** Avoids N+1 by fetching in the same `Promise.all` block that already exists in `patients.ts`.
**Example:**
```typescript
// In patients.ts GET / — add to include block:
wearableReadings: {
  orderBy: { readingDate: 'desc' },
  take: 1,
  select: {
    restingHeartRate: true, avgHeartRate: true,
    bloodOxygenPercent: true, steps: true,
    bloodPressureSystolic: true, bloodPressureDiastolic: true,
    hrvMs: true, sleepHours: true, readingDate: true,
  },
},
cardiacMetrics: {
  orderBy: { recordedAt: 'desc' },
  take: 1,
},
```

### Pattern 2: Server-Side Risk Score Computation
**What:** Compute GRACE/CHA2DS2-VASc in a pure function called within the GET handler before sending the response.
**When to use:** All risk score logic must live on the server (CARD-02). Never ship scoring thresholds to the frontend.
**Example:**
```typescript
// backend/src/lib/riskScores.ts
export function computeCha2ds2vasc(patient: {
  dateOfBirth: Date; gender: string | null;
  chronicConditions: string[]; currentMedications: unknown;
}): number {
  let score = 0;
  const age = differenceInYears(new Date(), patient.dateOfBirth);
  if (age >= 75) score += 2;
  else if (age >= 65) score += 1;
  if (patient.gender === 'female') score += 1;
  // CHF, hypertension, stroke/TIA, vascular disease — check chronicConditions
  if (patient.chronicConditions.some(c => /heart failure/i.test(c))) score += 1;
  if (patient.chronicConditions.some(c => /hypertension/i.test(c))) score += 1;
  // ... etc.
  return score;
}

export function computeGrace(inputs: {
  age: number; heartRate?: number | null;
  systolicBP?: number | null; creatinine?: number | null;
  killipClass?: number; stElevation?: boolean;
  elevatedCardiacMarkers?: boolean; cardiacArrest?: boolean;
}): number {
  // Standard GRACE 2.0 logistic model — return 0-360 integer
  // Use published ESC 2023 coefficient table
  // Source: https://www.gracescore.org/
  let score = 0;
  // Age points (GRACE published lookup table)
  if (inputs.age < 30) score += 0;
  else if (inputs.age < 40) score += 8;
  else if (inputs.age < 50) score += 25;
  else if (inputs.age < 60) score += 41;
  else if (inputs.age < 70) score += 58;
  else if (inputs.age < 80) score += 75;
  else score += 91;
  // HR, BP, creatinine points follow GRACE 2.0 tables
  // ... (full table in implementation)
  return score;
}
```

### Pattern 3: CardiacMetric Prisma Model
**What:** New model to store timestamped per-patient metric entries (replaces flat fields on Patient).
**When to use:** Supports audit trail, trends over time, and avoids nullable columns multiplying on Patient.
```prisma
model CardiacMetric {
  id              String   @id @default(uuid())
  patientId       String   @map("patient_id")
  recordedAt      DateTime @default(now()) @map("recorded_at")
  recordedById    String?  @map("recorded_by")
  ejectionFraction Decimal? @map("ejection_fraction") @db.Decimal(5,2)
  nyhaClass       Int?     @map("nyha_class")
  ntProBnp        Decimal? @map("nt_pro_bnp") @db.Decimal(10,2)
  bnp             Decimal? @db.Decimal(10,2)
  hsTroponinI     Decimal? @map("hs_troponin_i") @db.Decimal(10,4)
  hsTroponinT     Decimal? @map("hs_troponin_t") @db.Decimal(10,4)
  creatinine      Decimal? @db.Decimal(8,2)
  killipClass     Int?     @map("killip_class")
  notes           String?
  createdAt       DateTime @default(now()) @map("created_at")

  patient     Patient @relation(fields: [patientId], references: [id], onDelete: Cascade)
  recordedBy  User?   @relation(fields: [recordedById], references: [id])

  @@index([patientId, recordedAt])
  @@map("cardiac_metrics")
}
```

### Pattern 4: Frontend Patient Type Correction
**What:** Align `src/types/patient.ts` `Patient` interface with the actual API response — use `latestReading` (single object, nullable) not `wearableData` (array).
**When to use:** All Dashboard and PatientDetail reads.
```typescript
// CORRECT — matches API response after fix
export interface Patient {
  // ...existing fields...
  latestReading: {
    restingHeartRate: number | null;
    bloodOxygenPercent: number | null;
    bloodPressureSystolic: number | null;
    bloodPressureDiastolic: number | null;
    steps: number | null;
    hrvMs: number | null;
    sleepHours: number | null;
  } | null;
  latestCardiacMetric: {
    ejectionFraction: number | null;
    nyhaClass: number | null;
    ntProBnp: number | null;
    hsTroponinI: number | null;
  } | null;
  computedRiskScores: {
    grace: number | null;
    cha2ds2vasc: number | null;
  };
}

// Dashboard reads — safe pattern:
const hr = patient.latestReading?.restingHeartRate ?? null;
const display = hr != null ? `${hr} bpm` : 'Not recorded';
```

### Anti-Patterns to Avoid
- **Array index access on wearableData:** `p.wearableData[p.wearableData.length - 1].restingHR` — crashes when array is empty or field name differs. Use `p.latestReading?.restingHeartRate ?? null`.
- **Client-side risk score thresholds:** Never compute GRACE/CHA2DS2-VASc on the frontend. The 140/2/3 thresholds already in Dashboard.tsx are display thresholds only (RED/AMBER coloring), NOT scoring logic — that distinction must be preserved.
- **Mutating Patient model with flat cardiac columns:** Don't add `ntProBnp`, `hsTroponinI` etc. directly to the `patients` table — use the new `CardiacMetric` model for history and clean separation.
- **USE_MOCK bypass:** The `usePatientData.ts` hooks already switch on `VITE_ENABLE_MOCK_DATA`. Do not remove the mock path — set the env var to `false` in `.env` for production. Only fix the real-API code path.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| GRACE score formula | Custom scoring logic from scratch | Published GRACE 2.0 lookup tables (ESC 2023) | Wrong coefficients produce wrong risk stratification — clinical safety issue |
| CHA2DS2-VASc | Custom formula | Published ESC AF guidelines table | Standard 9-point scale; easy to get edge cases wrong |
| Form validation for cardiac entry | Custom validator | Zod on backend + RHF/controlled inputs on frontend | Range validation (EF 0-100, NYHA 1-4) needed |
| Patient type inference | Re-derive type from Prisma | `Prisma.PatientGetPayload<{include: ...}>` utility type | Keeps API types and frontend types in sync automatically |

---

## Common Pitfalls

### Pitfall 1: API Returns Prisma Decimal as String
**What goes wrong:** Prisma serialises `Decimal` fields (ejectionFraction, bloodOxygenPercent) as strings in JSON. Dashboard arithmetic (`acc + p.ejectionFraction`) produces `NaN`.
**Why it happens:** Prisma `Decimal` is not a native JS number.
**How to avoid:** In the API response handler, explicitly coerce: `ejectionFraction: patient.ejectionFraction ? Number(patient.ejectionFraction) : null`.
**Warning signs:** `NaN` in avgHR/avgEF calculations; `typeof value === 'string'` on numeric fields.

### Pitfall 2: GET /patients Does Not Include Wearable Readings Today
**What goes wrong:** `include: { wearableReadings: { take: 1 } }` without `orderBy` returns an arbitrary row, not the latest.
**How to avoid:** Always `orderBy: { readingDate: 'desc' }` alongside `take: 1`.

### Pitfall 3: Dashboard Averages Crash on Empty Patient List
**What goes wrong:** `displayPatients.reduce(...)  / displayPatients.length` produces `NaN` or `Infinity` when length is 0.
**How to avoid:** The existing `displayPatients.length > 0` guard wraps the metrics panel — maintain this guard and ensure it also covers the IIFE metric block.

### Pitfall 4: Migration Required — No Live DB
**What goes wrong:** `prisma migrate dev` requires a live DB connection; CI/CD and dev environments may not have one.
**How to avoid:** Follow the established project pattern (see STATE.md): create the migration SQL file manually in `backend/prisma/migrations/`. Do NOT run `prisma migrate dev`.

### Pitfall 5: GRACE Requires Creatinine — Often Absent
**What goes wrong:** Full GRACE 2.0 needs creatinine, Killip class, ST elevation. These may not be available.
**How to avoid:** Implement simplified GRACE using only age + HR + SBP (available from wearables + Patient model). Return `null` for GRACE if minimum required inputs are absent, and surface this as "Insufficient data" in the UI — do not return 0 which implies low risk.

### Pitfall 6: Frontend Patient Type Drift
**What goes wrong:** Dashboard accesses `p.ejectionFraction` (flat field on Patient from old mock) but new API returns `p.latestCardiacMetric.ejectionFraction`. TypeScript will NOT catch this if the Patient type is wrong.
**How to avoid:** Update `src/types/patient.ts` as the very first task in this phase. Let TypeScript errors guide all subsequent fixes.

---

## Code Examples

### Extending GET /patients to Include Latest Wearable Reading
```typescript
// backend/src/routes/patients.ts — inside prisma.patient.findMany include:
include: {
  user: { select: { firstName: true, lastName: true, email: true } },
  alerts: {
    where: { resolved: false },
    select: { id: true, type: true, severity: true, title: true, resolved: true, createdAt: true },
  },
  wearableReadings: {
    orderBy: { readingDate: 'desc' },
    take: 1,
    select: {
      restingHeartRate: true,
      bloodOxygenPercent: true,
      bloodPressureSystolic: true,
      bloodPressureDiastolic: true,
      steps: true,
      hrvMs: true,
      sleepHours: true,
      readingDate: true,
    },
  },
  cardiacMetrics: {
    orderBy: { recordedAt: 'desc' },
    take: 1,
  },
},
```

### Response Serialisation with Risk Scores
```typescript
// After fetching, map each patient before res.json():
const serialised = patients.map(p => ({
  ...p,
  ejectionFraction: p.ejectionFraction ? Number(p.ejectionFraction) : null,
  latestReading: p.wearableReadings[0]
    ? {
        restingHeartRate: p.wearableReadings[0].restingHeartRate,
        bloodOxygenPercent: p.wearableReadings[0].bloodOxygenPercent
          ? Number(p.wearableReadings[0].bloodOxygenPercent)
          : null,
        bloodPressureSystolic: p.wearableReadings[0].bloodPressureSystolic,
        bloodPressureDiastolic: p.wearableReadings[0].bloodPressureDiastolic,
        steps: p.wearableReadings[0].steps,
        hrvMs: p.wearableReadings[0].hrvMs,
        sleepHours: p.wearableReadings[0].sleepHours
          ? Number(p.wearableReadings[0].sleepHours)
          : null,
      }
    : null,
  latestCardiacMetric: p.cardiacMetrics[0] ?? null,
  computedRiskScores: {
    cha2ds2vasc: computeCha2ds2vasc(p),
    grace: computeGrace({
      age: differenceInYears(new Date(), p.dateOfBirth),
      heartRate: p.wearableReadings[0]?.restingHeartRate,
      systolicBP: p.wearableReadings[0]?.bloodPressureSystolic,
      creatinine: p.cardiacMetrics[0]?.creatinine
        ? Number(p.cardiacMetrics[0].creatinine)
        : null,
    }),
  },
  wearableReadings: undefined, // strip raw array from response
  cardiacMetrics: undefined,
}));
```

### POST /patients/:id/cardiac-metrics Route Skeleton
```typescript
// In patients.ts or clinical.ts
const cardiacMetricSchema = z.object({
  ejectionFraction: z.number().min(0).max(100).optional(),
  nyhaClass: z.number().int().min(1).max(4).optional(),
  ntProBnp: z.number().min(0).optional(),
  bnp: z.number().min(0).optional(),
  hsTroponinI: z.number().min(0).optional(),
  creatinine: z.number().min(0).optional(),
  killipClass: z.number().int().min(1).max(4).optional(),
  notes: z.string().max(1000).optional(),
});

router.post('/:id/cardiac-metrics',
  requireRole('doctor', 'nurse'),
  async (req: Request, res: Response) => {
    const { id } = req.params;
    const body = cardiacMetricSchema.parse(req.body);
    const metric = await prisma.cardiacMetric.create({
      data: { patientId: id, recordedById: req.user?.userId, ...body },
    });
    res.status(201).json({ status: 'success', data: { metric } });
  }
);

router.get('/:id/cardiac-metrics',
  requireRole('doctor', 'nurse', 'admin', 'super_admin'),
  async (req: Request, res: Response) => {
    const metrics = await prisma.cardiacMetric.findMany({
      where: { patientId: req.params.id },
      orderBy: { recordedAt: 'desc' },
      take: 20,
    });
    res.json({ status: 'success', data: { metrics } });
  }
);
```

### TanStack Query Mutation for Cardiac Metric Entry
```typescript
// src/hooks/usePatientData.ts — add:
export function useRecordCardiacMetric(patientId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: CardiacMetricInput) => {
      const res = await fetch(`/api/patients/${patientId}/cardiac-metrics`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error('Failed to save cardiac metric');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: patientDataKeys.detail(patientId) });
    },
  });
}
```

---

## Key Schema Findings (from Codebase Audit)

### What the Prisma Patient Model Already Has
| Field | Type | Notes |
|-------|------|-------|
| `ejectionFraction` | `Decimal?` | Already on Patient — migrate to CardiacMetric for history |
| `nyhaClass` | `Int?` | Already on Patient — migrate to CardiacMetric |
| `wellbeingScore` | `Int?` | Exists on Patient — frontend was reading it correctly via mock; real API returns it |
| `triageLevel` | `TriageLevel` | Already on Patient — triage badges already correct |
| `riskScore` | `Int?` | Generic integer — not GRACE; new `computedRiskScores` envelope replaces this |

### What Does NOT Exist in the Schema
| Missing | Needed For | Solution |
|---------|-----------|----------|
| `ntProBnp` / `bnp` / `hsTroponinI` | CARD-01 | New `CardiacMetric` model |
| `cardiacBiomarkers` (object) | Frontend type | Map to new `CardiacMetric` fields |
| `riskScores.grace` / `.cha2ds2vasc` | CARD-02 | Server-computed, not stored (CARD-02 says returned by API) |
| `bloodPressure` (object) | Frontend type | Map to `latestReading.bloodPressureSystolic/Diastolic` |
| `ecgStatus` | Frontend type | Not in schema — keep optional/absent, show "Not recorded" |

### What the GET /patients API Currently Returns vs What Frontend Expects
| Frontend Reads | API Currently Returns | Fix |
|---------------|----------------------|-----|
| `p.wearableData[last].restingHR` | Nothing (no include) | Add `wearableReadings` include; rename to `latestReading.restingHeartRate` |
| `p.wellbeingScore` | `p.wellbeingScore` (Int?) | No fix needed — field exists; add null guard in Dashboard |
| `p.ejectionFraction` | `p.ejectionFraction` (Decimal?) | Coerce to Number; move to `latestCardiacMetric` long-term |
| `p.cardiacBiomarkers.ntProBNP` | Nothing | New CardiacMetric model + include |
| `p.riskScores.grace` | Nothing | Server-side computation in response mapper |
| `p.bloodPressure.systolic` | Nothing | Map from `latestReading.bloodPressureSystolic` |

---

## State of the Art

| Old Approach | Current Approach | Impact |
|--------------|-----------------|--------|
| Flat nullable columns on Patient for every metric | Dedicated `CardiacMetric` table with timestamped rows | Enables trend history, clean audit trail |
| Client-side GRACE calculation | Server-side with published ESC coefficient tables | Clinical safety; single source of truth |
| Mock data via `VITE_ENABLE_MOCK_DATA` | Same hook, real API code path | Hook architecture already correct — just fix the real-API branch |

---

## Open Questions

1. **Should ejectionFraction/nyhaClass be migrated off Patient onto CardiacMetric?**
   - What we know: Both fields already exist on Patient model as nullable columns.
   - What's unclear: Whether to keep them on Patient for quick access or move entirely to CardiacMetric for history.
   - Recommendation: Keep on Patient as a "latest snapshot" denormalisation AND store history in CardiacMetric. Update the Patient columns via a trigger or via the POST endpoint (write to both). This avoids a breaking migration to existing queries.

2. **GRACE score with minimal inputs**
   - What we know: Full GRACE 2.0 needs creatinine, Killip class, ST elevation — not available from wearables alone.
   - What's unclear: Whether to return a partial GRACE or `null`.
   - Recommendation: Return `null` with a `graceDataSufficient: false` flag when creatinine is absent. Display "Insufficient data" in UI. Do NOT return 0 as it implies low risk.

3. **clinical.ts vs patients.ts for cardiac metric endpoints**
   - What we know: `clinical.ts` is role-guarded read-only pilot data; `patients.ts` is the CRUD router.
   - Recommendation: Add `POST /patients/:id/cardiac-metrics` and `GET /patients/:id/cardiac-metrics` to `patients.ts` — it is already the correct patient resource router.

---

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest (frontend) / check for backend test config |
| Config file | Check for `vitest.config.ts` in root |
| Quick run command | `npx vitest run --reporter=dot` |
| Full suite command | `npx vitest run` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command |
|--------|----------|-----------|-------------------|
| DASH-01 | `latestReading` fields render in Dashboard without crash | unit | `npx vitest run src/pilot/pages/Dashboard.test.tsx` |
| DASH-02 | Triage badge color matches `patient.triageLevel` from API | unit | `npx vitest run src/components/PatientCard.test.tsx` |
| DASH-03 | Dashboard shows "Not recorded" when `latestCardiacMetric` is null | unit | `npx vitest run src/pilot/pages/Dashboard.test.tsx` |
| CARD-01 | POST /patients/:id/cardiac-metrics persists metric | integration | `npx vitest run backend/src/routes/patients.test.ts` |
| CARD-02 | computeCha2ds2vasc / computeGrace return correct values | unit | `npx vitest run backend/src/lib/riskScores.test.ts` |
| CARD-03 | PatientDetail renders `latestCardiacMetric` fields | unit | `npx vitest run src/pilot/pages/PatientDetail.test.tsx` |

### Wave 0 Gaps
- [ ] `backend/src/lib/riskScores.ts` — pure functions; must be created in Wave 0
- [ ] `backend/src/lib/riskScores.test.ts` — unit tests for GRACE/CHA2DS2-VASc edge cases
- [ ] `backend/prisma/migrations/YYYYMMDD_add_cardiac_metric/migration.sql` — manual SQL for CardiacMetric table

---

## Sources

### Primary (HIGH confidence)
- Prisma schema at `backend/prisma/schema.prisma` — definitive field names and types
- `backend/src/routes/patients.ts` — exact API response shape currently returned
- `src/pilot/pages/Dashboard.tsx` — exact field accesses that will crash
- `src/hooks/usePatientData.ts` — hook architecture (mock/real switch)
- `src/types/patient.ts` — frontend Patient interface vs actual API shape

### Secondary (MEDIUM confidence)
- GRACE 2.0 score: https://www.gracescore.org/ — published ESC coefficient lookup tables
- CHA2DS2-VASc: ESC 2023 AF Guidelines — standard 9-point scale

### Tertiary (LOW confidence — verify before implementing)
- Simplified GRACE without creatinine: multiple cardiology papers support age+HR+SBP subset producing a useful approximation; flag as "estimated" in UI

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all libraries already in the codebase
- API/schema gap analysis: HIGH — read actual source files
- Architecture patterns: HIGH — follows existing project patterns exactly
- GRACE/CHA2DS2-VASc formulas: MEDIUM — verify coefficients against published ESC tables before shipping
- Pitfalls: HIGH — observed directly in Dashboard.tsx source

**Research date:** 2026-03-14
**Valid until:** 2026-04-14 (stable stack)
