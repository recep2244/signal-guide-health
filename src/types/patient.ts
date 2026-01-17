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
  /** 14 days of wearable readings */
  wearableData: WearableReading[];
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
