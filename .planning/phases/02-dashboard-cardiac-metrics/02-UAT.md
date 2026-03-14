---
status: complete
phase: 02-dashboard-cardiac-metrics
source: [02-01-SUMMARY.md, 02-02-SUMMARY.md, 02-04-SUMMARY.md]
started: 2026-03-14T05:50:00Z
updated: 2026-03-14T05:50:00Z
---

## Current Test

[testing complete]

## Tests

### 1. Cold Start Smoke Test
expected: Kill any running backend server. Run `cd backend && npx prisma migrate deploy` (or confirm the migration SQL has been applied). Start the backend with `npm run dev` from the backend directory. Server boots without errors. `GET /health` or `GET /ready` returns 200 (no crash, no unhandled exception).
result: pass

### 2. Dashboard Vitals — "Not Recorded" Fallback
expected: Open the pilot dashboard at /pilot. With no wearable data for a patient (VITE_ENABLE_MOCK_DATA=false or a patient without wearable readings), the Clinical Summary Metrics panel shows "Not recorded" for Avg Resting HR, Avg HRV, and Avg Sleep — it does NOT crash or show NaN/undefined.
result: pass

### 3. Dashboard Ejection Fraction Panel
expected: In the Cardiac Clinical Overview section, the "Ejection Fraction" card shows patients with recorded EF values (from latestCardiacMetric), colour-coded as HFrEF (<40%), Mildly reduced (40-49%), or Preserved (≥50%). With no EF data available, shows "No EF data available" italic text — no crash.
result: pass

### 4. Dashboard Biomarker Alerts Panel
expected: The "Biomarker Alerts" card shows patients with NT-proBNP or hs-TnI data from latestCardiacMetric. Elevated BNP (>300) or TnI (>14) triggers a red alert triangle icon. With no biomarker data, shows "No biomarker data available" — no crash.
result: pass

### 5. Dashboard Risk Scores Panel
expected: The "Risk Scores" card displays highest GRACE score, patients with CHA₂DS₂-VASc ≥2, and patients with HAS-BLED ≥3. Data sourced from computedRiskScores (real API) or riskScores (mock). "No risk score data" shown when neither is available — no crash.
result: pass

### 6. Patient Detail — Cardiac Clinical Panel
expected: Open a patient detail page. If the patient has a latestCardiacMetric, the "Cardiac Clinical Summary" card appears showing EF%, NYHA class, ECG status, BP, NT-proBNP, and hs-TnI with colour-coded severity. Fields with null values show "Not recorded" or are absent from the panel — no undefined/NaN rendered.
result: pass

### 7. Patient Detail — Risk Score Badges
expected: In the Cardiac Clinical Summary card's footer row, GRACE score badge shows a numeric value with risk level (Low/Intermediate/High) OR is absent (not shown as "undefined"). CHA₂DS₂-VASc badge shown if score exists. GRACE shows "Insufficient data" label when score is null/absent — not NaN or a crash.
result: pass

### 8. Record Cardiac Metrics Form
expected: On any patient detail page, there is a "Record Cardiac Metrics" card (always visible, not conditional on existing data). Clicking "Record Metrics" button reveals a form with EF (%), NT-proBNP (pg/mL), hs-TnI (ng/L), and NYHA Class fields. Entering values and clicking Save shows "Saving..." momentarily, then the form closes. In mock mode, no error toast appears. In real API mode, a 201 response is returned.
result: pass

### 9. API — POST Cardiac Metric Validation
expected: Sending a POST to /patients/:id/cardiac-metrics with an invalid ejection fraction (e.g., 150 — above 100) returns HTTP 400 with a validation error message. Valid data (EF=45, nyhaClass=2) returns 201.
result: pass

## Summary

total: 9
passed: 9
issues: 0
pending: 0
skipped: 0

## Gaps

[none yet]
