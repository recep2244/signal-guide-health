/**
 * Application-wide constants and configuration values
 * Centralized to avoid magic numbers and enable easy adjustments
 */

// ============================================================================
// TIMING CONSTANTS
// ============================================================================

/** Delay before showing agent typing indicator (ms) */
export const AGENT_TYPING_DELAY_MS = 1100;

/** Delay between flow steps (ms) */
export const FLOW_STEP_DELAY_MS = 500;

/** Animation stagger delay base (ms) */
export const ANIMATION_STAGGER_MS = 50;

// ============================================================================
// CLINICAL THRESHOLDS
// ============================================================================

/** Number of days to use for calculating baseline vitals */
export const BASELINE_DAYS = 7;

/** Total days of wearable data to display */
export const WEARABLE_DATA_DAYS = 14;

/** Days of sparkline data shown on patient cards */
export const SPARKLINE_DAYS = 8;

/** Heart rate delta threshold for amber alert (bpm) */
export const HR_AMBER_THRESHOLD = 10;

/** Heart rate delta threshold for red alert (bpm) */
export const HR_RED_THRESHOLD = 15;

/** HRV delta threshold for amber alert (%) */
export const HRV_AMBER_THRESHOLD = -15;

/** HRV delta threshold for red alert (%) */
export const HRV_RED_THRESHOLD = -25;

/** Sleep hours threshold for concern */
export const SLEEP_CONCERN_HOURS = 5;

/** Minimum wellbeing score for green triage */
export const WELLBEING_GREEN_MIN = 7;

/** Minimum wellbeing score for amber triage */
export const WELLBEING_AMBER_MIN = 4;

// ============================================================================
// DEMO CONFIGURATION
// ============================================================================

/** Default clinician name for demo */
export const DEFAULT_CLINICIAN_NAME = "Dr. X";

/** Demo wearable snapshot data */
export const DEMO_WATCH_SNAPSHOT = {
  restingHR: 71,
  hrv: 44,
  sleepHours: 6.8,
  steps: 3450,
  lastSync: "2 min ago",
} as const;

/** Demo wearable summary text */
export const DEMO_WATCH_SUMMARY =
  "Real-time trends look stable. Resting HR is within baseline and sleep recovery is adequate.";

// ============================================================================
// SEEDED RANDOM GENERATOR SEEDS
// ============================================================================

/** Seeds for deterministic patient data generation */
export const PATIENT_SEEDS = {
  patient1: 12001,
  patient2: 12002,
  patient3: 12003,
} as const;

// ============================================================================
// STORAGE KEYS
// ============================================================================

/** LocalStorage key for resolved alerts */
export const STORAGE_KEY_RESOLVED_ALERTS = "cardiowatch_resolved_alerts";

/** LocalStorage key for user preferences */
export const STORAGE_KEY_USER_PREFS = "cardiowatch_user_prefs";

// ============================================================================
// PAGINATION
// ============================================================================

/** Default page size for patient lists */
export const DEFAULT_PAGE_SIZE = 10;

/** Maximum patients to show without pagination */
export const MAX_PATIENTS_WITHOUT_PAGINATION = 25;

// ============================================================================
// API (FUTURE USE)
// ============================================================================

/** API request timeout (ms) */
export const API_TIMEOUT_MS = 30000;

/** API retry count */
export const API_RETRY_COUNT = 3;

/** Stale time for React Query cache (ms) */
export const QUERY_STALE_TIME_MS = 5 * 60 * 1000; // 5 minutes

// ============================================================================
// TRIAGE COLORS (CSS VARIABLE NAMES)
// ============================================================================

export const TRIAGE_COLORS = {
  red: {
    bg: "var(--triage-red-bg)",
    fg: "var(--triage-red)",
    text: "var(--triage-red-foreground)",
  },
  amber: {
    bg: "var(--triage-amber-bg)",
    fg: "var(--triage-amber)",
    text: "var(--triage-amber-foreground)",
  },
  green: {
    bg: "var(--triage-green-bg)",
    fg: "var(--triage-green)",
    text: "var(--triage-green-foreground)",
  },
} as const;
