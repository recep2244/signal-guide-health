/**
 * Server-side cardiac risk score computation functions.
 *
 * GRACE 2.0 — based on published ESC lookup tables (https://www.gracescore.org/)
 * CHA2DS2-VASc — based on ESC 2023 Atrial Fibrillation Guidelines
 *
 * These functions are pure (no side effects) and must only run server-side.
 * Never ship scoring logic to the frontend.
 */

import { differenceInYears } from 'date-fns';

// =============================================================================
// GRACE 2.0 Risk Score
// =============================================================================

/**
 * Compute a simplified GRACE 2.0 in-hospital death risk score.
 *
 * Uses published age, heart rate, systolic BP, and creatinine lookup tables.
 * Returns null when age is absent or invalid (do NOT return 0 — that implies low risk).
 *
 * @param inputs - Patient vital parameters
 * @returns Integer risk score (0–360) or null if minimum inputs are absent
 */
export function computeGrace(inputs: {
  age: number;
  heartRate?: number | null;
  systolicBP?: number | null;
  creatinine?: number | null;
}): number | null {
  if (!Number.isFinite(inputs.age)) {
    return null;
  }

  let score = 0;

  // --- Age points (GRACE 2.0 published lookup) ---
  const age = inputs.age;
  if (age < 30) score += 0;
  else if (age < 40) score += 8;
  else if (age < 50) score += 25;
  else if (age < 60) score += 41;
  else if (age < 70) score += 58;
  else if (age < 80) score += 75;
  else score += 91;

  // --- Heart rate points ---
  if (inputs.heartRate != null && Number.isFinite(inputs.heartRate)) {
    const hr = inputs.heartRate;
    if (hr < 50) score += 0;
    else if (hr < 70) score += 3;
    else if (hr < 90) score += 9;
    else if (hr < 110) score += 15;
    else if (hr < 150) score += 24;
    else if (hr < 200) score += 38;
    else score += 46;
  }

  // --- Systolic BP points ---
  if (inputs.systolicBP != null && Number.isFinite(inputs.systolicBP)) {
    const sbp = inputs.systolicBP;
    if (sbp < 80) score += 58;
    else if (sbp < 100) score += 53;
    else if (sbp < 120) score += 43;
    else if (sbp < 140) score += 34;
    else if (sbp < 160) score += 24;
    else if (sbp < 200) score += 10;
    else score += 0;
  }

  // --- Creatinine points (mg/dL) ---
  if (inputs.creatinine != null && Number.isFinite(inputs.creatinine)) {
    const cr = inputs.creatinine;
    if (cr < 0.4) score += 1;
    else if (cr < 0.8) score += 4;
    else if (cr < 1.2) score += 7;
    else if (cr < 1.6) score += 10;
    else if (cr < 2.0) score += 13;
    else if (cr < 4.0) score += 21;
    else score += 28;
  }

  return score;
}

// =============================================================================
// CHA2DS2-VASc Score
// =============================================================================

/**
 * Compute the CHA2DS2-VASc score for AF stroke risk stratification.
 *
 * Scoring (ESC 2023 AF Guidelines):
 *   C  — Congestive Heart Failure (+1)
 *   H  — Hypertension (+1)
 *   A2 — Age ≥75 (+2), Age 65-74 (+1)
 *   D  — Diabetes mellitus (+1)
 *   S2 — Stroke/TIA history (+2)
 *   V  — Vascular disease (MI, peripheral arterial, aortic plaque) (+1)
 *   A  — Age 65-74 (included in A2 above)
 *   Sc — Sex category: female (+1)
 *
 * @param patient - Patient demographics and chronic conditions
 * @returns Integer score 0–9
 */
export function computeCha2ds2vasc(patient: {
  dateOfBirth: Date;
  gender: string | null;
  chronicConditions: string[];
}): number {
  let score = 0;

  const age = differenceInYears(new Date(), patient.dateOfBirth);

  // Age score (A2 — 65-74 adds 1; ≥75 adds 2)
  if (age >= 75) score += 2;
  else if (age >= 65) score += 1;

  // Sex category (female +1)
  if (patient.gender === 'female') score += 1;

  const conditions = patient.chronicConditions;

  // C — Congestive Heart Failure / LV dysfunction
  if (conditions.some((c) => /heart failure/i.test(c))) score += 1;

  // H — Hypertension
  if (conditions.some((c) => /hypertension/i.test(c))) score += 1;

  // S2 — Stroke or TIA history (2 points)
  if (conditions.some((c) => /stroke|tia/i.test(c))) score += 2;

  // V — Vascular disease (prior MI, peripheral arterial disease, aortic plaque)
  if (conditions.some((c) => /vascular disease|peripheral arterial|\bmi\b/i.test(c))) score += 1;

  // D — Diabetes mellitus
  if (conditions.some((c) => /diabetes/i.test(c))) score += 1;

  return score;
}
