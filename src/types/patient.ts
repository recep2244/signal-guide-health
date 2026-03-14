/**
 * Patient and Clinical Data Type Definitions
 * Centralized type definitions for the CardioWatch application
 */

// ============================================================================
// TRIAGE TYPES
// ============================================================================

export type TriageLevel = "green" | "amber" | "red";

export const TRIAGE_PRIORITY: Record<TriageLevel, number> = {
  red: 1,
  amber: 2,
  green: 3,
};

export function sortByTriagePriority<T extends { triageLevel: TriageLevel }>(
  items: T[]
): T[] {
  return [...items].sort(
    (a, b) => TRIAGE_PRIORITY[a.triageLevel] - TRIAGE_PRIORITY[b.triageLevel]
  );
}

// ============================================================================
// WEARABLE DATA TYPES
// ============================================================================

export interface WearableReading {
  /** ISO date string (YYYY-MM-DD) */
  date: string;
  /** Resting heart rate in BPM */
  restingHR: number;
  /** Heart rate variability in milliseconds */
  hrv: number;
  /** Hours of sleep */
  sleepHours: number;
  /** Daily step count */
  steps: number;
}

export interface WearableBaseline {
  avgRestingHR: number;
  avgHRV: number;
  avgSleepHours: number;
  avgSteps: number;
}

export interface WearableTrend {
  restingHR: { current: number; baseline: number; delta: number; status: TriageLevel };
  hrv: { current: number; baseline: number; delta: number; status: TriageLevel };
  sleep: { current: number; baseline: number; delta: number; status: TriageLevel };
  steps: { current: number; baseline: number; delta: number; status: TriageLevel };
}

// ============================================================================
// CHAT TYPES
// ============================================================================

export type MessageRole = "patient" | "agent";

export interface ChatMessage {
  id: string;
  role: MessageRole;
  content: string;
  /** ISO timestamp string */
  timestamp: string;
}

// ============================================================================
// ALERT TYPES
// ============================================================================

export type AlertType = "red" | "amber";

export interface Alert {
  id: string;
  type: AlertType;
  headline: string;
  description: string;
  /** ISO timestamp string */
  timestamp: string;
  resolved: boolean;
}

export interface AlertStats {
  total: number;
  unresolved: number;
  red: number;
  amber: number;
}

// ============================================================================
// SBAR (CLINICAL SUMMARY) TYPES
// ============================================================================

export interface SBARSummary {
  /** Current clinical situation */
  situation: string;
  /** Relevant medical background */
  background: string;
  /** Clinical assessment and risk level */
  assessment: string;
  /** Recommended actions */
  recommendation: string;
}

// ============================================================================
// CARDIAC CLINICAL TYPES
// ============================================================================

export interface CardiacBiomarkers {
  /** NT-proBNP in pg/mL */
  ntProBNP: number;
  /** High-sensitivity Troponin I in ng/L */
  hsTroponinI: number;
  /** Timestamp of last blood draw */
  lastDrawDate: string;
}

export type NYHAClass = "I" | "II" | "III" | "IV";

export type ECGStatus = "Normal sinus rhythm" | "Atrial fibrillation" | "Sinus tachycardia" | "Sinus bradycardia" | "Paced rhythm" | "Awaiting review";

export type CardiacRehabPhase = "Phase I (Inpatient)" | "Phase II (Early post-discharge)" | "Phase III (Supervised outpatient)" | "Phase IV (Long-term maintenance)";

export interface BloodPressure {
  systolic: number;
  diastolic: number;
  timestamp: string;
}

export interface ClinicalRiskScores {
  /** GRACE score for ACS risk (0-372) */
  grace?: number;
  /** CHA₂DS₂-VASc score for AF stroke risk (0-9) */
  cha2ds2vasc?: number;
  /** HAS-BLED score for bleeding risk (0-9) */
  hasbled?: number;
}

/**
 * Latest wearable sensor reading from the database.
 * Matches the WearableReading Prisma model shape returned by the API.
 */
export interface LatestReading {
  id: string;
  patientId: string;
  deviceId?: string | null;
  /** ISO date string of the reading */
  readingDate: string;
  restingHeartRate?: number | null;
  avgHeartRate?: number | null;
  maxHeartRate?: number | null;
  minHeartRate?: number | null;
  /** Heart rate variability in milliseconds */
  hrvMs?: number | null;
  steps?: number | null;
  distanceMeters?: number | null;
  activeMinutes?: number | null;
  caloriesBurned?: number | null;
  sleepHours?: number | null;
  deepSleepHours?: number | null;
  remSleepHours?: number | null;
  sleepScore?: number | null;
  bloodOxygenPercent?: number | null;
  respiratoryRate?: number | null;
  bodyTemperature?: number | null;
  weightKg?: number | null;
  bloodPressureSystolic?: number | null;
  bloodPressureDiastolic?: number | null;
  dataQuality: "good" | "partial" | "poor";
}

/**
 * Structured cardiac metric record stored in the database.
 * Captures clinical measurements recorded by clinicians or imported from labs.
 */
export interface CardiacMetric {
  id: string;
  patientId: string;
  /** ISO timestamp when the metric was recorded */
  recordedAt: string;
  /** Clinician or system that recorded the metric */
  recordedBy?: string | null;
  /** Left ventricular ejection fraction (%) */
  ejectionFraction?: number | null;
  /** NYHA functional classification */
  nyhaClass?: NYHAClass | null;
  /** NT-proBNP in pg/mL */
  ntProBNP?: number | null;
  /** High-sensitivity Troponin I in ng/L */
  hsTroponinI?: number | null;
  /** ISO date of last blood draw for biomarkers */
  lastDrawDate?: string | null;
  /** Last recorded ECG rhythm */
  ecgStatus?: ECGStatus | null;
  /** Systolic blood pressure in mmHg */
  bloodPressureSystolic?: number | null;
  /** Diastolic blood pressure in mmHg */
  bloodPressureDiastolic?: number | null;
  /** ISO timestamp of blood pressure reading */
  bloodPressureTimestamp?: string | null;
  /** Current cardiac rehabilitation phase */
  cardiacRehabPhase?: CardiacRehabPhase | null;
  /** GRACE score (0-372) */
  graceScore?: number | null;
  /** CHA₂DS₂-VASc score (0-9) */
  cha2ds2vascScore?: number | null;
  /** HAS-BLED score (0-9) */
  hasbledScore?: number | null;
  /** Referring consultant */
  consultant?: string | null;
  notes?: string | null;
}

/**
 * Input shape for recording a new cardiac metric via the API.
 */
export interface RecordCardiacMetricRequest {
  ejectionFraction?: number;
  nyhaClass?: NYHAClass;
  ntProBNP?: number;
  hsTroponinI?: number;
  lastDrawDate?: string;
  ecgStatus?: ECGStatus;
  bloodPressureSystolic?: number;
  bloodPressureDiastolic?: number;
  bloodPressureTimestamp?: string;
  cardiacRehabPhase?: CardiacRehabPhase;
  graceScore?: number;
  cha2ds2vascScore?: number;
  hasbledScore?: number;
  consultant?: string;
  notes?: string;
}

// ============================================================================
// PATIENT TYPES
// ============================================================================

export type Gender = "Male" | "Female" | "Other";

export interface Patient {
  id: string;
  name: string;
  age: number;
  gender: Gender;
  /** Primary diagnosis or condition */
  condition: string;
  /** ISO date string of discharge */
  dischargeDate: string;
  triageLevel: TriageLevel;
  /** ISO timestamp of last check-in */
  lastCheckIn: string;
  /** 0-10 self-reported wellbeing */
  wellbeingScore: number;
  /** Optional avatar URL */
  avatar?: string;
  /** Chat conversation history */
  chatHistory: ChatMessage[];
  /** Active and resolved alerts */
  alerts: Alert[];
  /** SBAR clinical summary */
  sbar: SBARSummary;
  /** Current medications */
  medications: string[];
  /** NHS number identifier */
  nhsNumber: string;
  /** NYHA functional classification */
  nyhaClass?: NYHAClass;
  /** Last recorded ECG rhythm */
  ecgStatus?: ECGStatus;
  /** Last recorded blood pressure */
  bloodPressure?: BloodPressure;
  /** Current cardiac rehabilitation phase */
  cardiacRehabPhase?: CardiacRehabPhase;
  /** Clinical risk scores (GRACE, CHA₂DS₂-VASc, HAS-BLED) */
  riskScores?: ClinicalRiskScores;
  /** Referring consultant */
  consultant?: string;
  /** Discharge ward/hospital */
  dischargeFrom?: string;
  /**
   * Most recent wearable sensor reading from the database.
   * Replaces the mock wearableData array — fetched separately via usePatientHealthTrends.
   */
  latestReading?: LatestReading;
  /**
   * Most recent clinician-recorded cardiac metric.
   * Replaces the mock ejectionFraction and cardiacBiomarkers fields.
   */
  latestCardiacMetric?: CardiacMetric;
}

// ============================================================================
// TRIAGE STATS TYPES
// ============================================================================

export interface TriageStats {
  red: number;
  amber: number;
  green: number;
  total: number;
}

// ============================================================================
// FILTER TYPES
// ============================================================================

export type TriageFilter = TriageLevel | "all";

export interface PatientFilters {
  triage: TriageFilter;
  searchQuery?: string;
  hasUnresolvedAlerts?: boolean;
}

// ============================================================================
// HELPER TYPES
// ============================================================================

export type PatientSummary = Pick<
  Patient,
  | "id"
  | "name"
  | "age"
  | "condition"
  | "triageLevel"
  | "lastCheckIn"
  | "wellbeingScore"
>;

export interface DaysSinceDischarge {
  days: number;
  isRecent: boolean; // Within 30 days
  isCritical: boolean; // Within 7 days
}
