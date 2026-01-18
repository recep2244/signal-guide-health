/**
 * Wearable Device Integration Types
 * Supports Apple Watch (HealthKit), Wear OS, Google Fit, Fitbit, Garmin, and more
 */

// ============================================================================
// DEVICE TYPES
// ============================================================================

export type WearableProvider =
  | "apple_watch"
  | "wear_os"
  | "health_connect"
  | "google_fit"
  | "fitbit"
  | "garmin"
  | "samsung_health"
  | "withings";

export type DeviceConnectionStatus =
  | "connected"
  | "disconnected"
  | "syncing"
  | "error"
  | "pending_auth";

export interface WearableDevice {
  id: string;
  patientId: string;
  provider: WearableProvider;
  deviceName: string;
  deviceModel?: string;
  firmwareVersion?: string;
  connectionStatus: DeviceConnectionStatus;
  lastSyncAt: string | null;
  batteryLevel?: number;
  isAuthorized: boolean;
  authorizedScopes: HealthDataType[];
  createdAt: string;
  updatedAt: string;
}

// ============================================================================
// HEALTH DATA TYPES
// ============================================================================

export type HealthDataType =
  | "heart_rate"
  | "resting_heart_rate"
  | "heart_rate_variability"
  | "blood_oxygen"
  | "respiratory_rate"
  | "blood_pressure"
  | "steps"
  | "distance"
  | "active_energy"
  | "sleep_analysis"
  | "sleep_stages"
  | "workout"
  | "ecg"
  | "afib_history";

export const CARDIAC_DATA_TYPES: HealthDataType[] = [
  "heart_rate",
  "resting_heart_rate",
  "heart_rate_variability",
  "blood_oxygen",
  "ecg",
  "afib_history",
];

export const ACTIVITY_DATA_TYPES: HealthDataType[] = [
  "steps",
  "distance",
  "active_energy",
  "workout",
];

export const SLEEP_DATA_TYPES: HealthDataType[] = [
  "sleep_analysis",
  "sleep_stages",
];

// ============================================================================
// HEALTH SAMPLES
// ============================================================================

export interface HealthSample {
  id: string;
  patientId: string;
  deviceId: string;
  provider: WearableProvider;
  dataType: HealthDataType;
  value: number;
  unit: string;
  startDate: string;
  endDate: string;
  metadata?: HealthSampleMetadata;
  source: SampleSource;
}

export interface HealthSampleMetadata {
  motionContext?: "active" | "sedentary" | "unknown";
  sleepStage?: "awake" | "rem" | "light" | "deep";
  workoutType?: string;
  heartRateContext?: "rest" | "active" | "recovery";
  confidence?: number;
}

export interface SampleSource {
  name: string;
  bundleId?: string;
  version?: string;
}

// ============================================================================
// AGGREGATED DATA
// ============================================================================

export interface DailyHealthSummary {
  patientId: string;
  date: string;
  metrics: DailyMetrics;
  alerts: MetricAlert[];
  syncStatus: SyncStatus;
}

export interface DailyMetrics {
  restingHeartRate?: MetricValue;
  averageHeartRate?: MetricValue;
  maxHeartRate?: MetricValue;
  minHeartRate?: MetricValue;
  heartRateVariability?: MetricValue;
  bloodOxygen?: MetricValue;
  respiratoryRate?: MetricValue;
  steps?: MetricValue;
  distance?: MetricValue;
  activeEnergy?: MetricValue;
  sleepDuration?: MetricValue;
  sleepEfficiency?: MetricValue;
  deepSleepDuration?: MetricValue;
  remSleepDuration?: MetricValue;
}

export interface MetricValue {
  value: number;
  unit: string;
  sampleCount: number;
  min?: number;
  max?: number;
  standardDeviation?: number;
}

export interface MetricAlert {
  type: HealthDataType;
  severity: "info" | "warning" | "critical";
  message: string;
  threshold?: number;
  actualValue: number;
  detectedAt: string;
}

export interface SyncStatus {
  lastSyncAt: string | null;
  nextSyncAt?: string;
  status: "success" | "partial" | "failed" | "pending";
  errorMessage?: string;
  samplesReceived: number;
}

// ============================================================================
// TREND ANALYSIS
// ============================================================================

export interface HealthTrend {
  dataType: HealthDataType;
  period: TrendPeriod;
  baseline: BaselineStats;
  current: CurrentStats;
  trend: TrendDirection;
  percentChange: number;
  status: TrendStatus;
}

export type TrendPeriod = "7d" | "14d" | "30d" | "90d";

export type TrendDirection = "increasing" | "decreasing" | "stable";

export type TrendStatus = "normal" | "improving" | "concerning" | "critical";

export interface BaselineStats {
  mean: number;
  median: number;
  standardDeviation: number;
  min: number;
  max: number;
  sampleCount: number;
  startDate: string;
  endDate: string;
}

export interface CurrentStats {
  value: number;
  comparisonPeriod: string;
  deltaFromBaseline: number;
  zScore: number;
}

// ============================================================================
// SYNC & AUTHORIZATION
// ============================================================================

export interface AuthorizationRequest {
  patientId: string;
  provider: WearableProvider;
  requestedScopes: HealthDataType[];
  redirectUri: string;
  state?: string;
}

export interface AuthorizationResponse {
  success: boolean;
  deviceId?: string;
  authorizedScopes?: HealthDataType[];
  accessToken?: string;
  refreshToken?: string;
  expiresAt?: string;
  error?: string;
}

export interface SyncRequest {
  deviceId: string;
  dataTypes?: HealthDataType[];
  startDate?: string;
  endDate?: string;
  forceRefresh?: boolean;
}

export interface SyncResponse {
  success: boolean;
  deviceId: string;
  samplesReceived: number;
  samplesProcessed: number;
  errors?: SyncError[];
  nextSyncRecommendedAt?: string;
}

export interface SyncError {
  dataType: HealthDataType;
  errorCode: string;
  message: string;
}

// ============================================================================
// WEBHOOKS
// ============================================================================

export interface WearableWebhookPayload {
  provider: WearableProvider;
  eventType: WearableEventType;
  deviceId: string;
  patientId: string;
  timestamp: string;
  data: WearableEventData;
}

export type WearableEventType =
  | "sync_completed"
  | "sync_failed"
  | "device_connected"
  | "device_disconnected"
  | "authorization_revoked"
  | "alert_triggered"
  | "battery_low";

export interface WearableEventData {
  samples?: HealthSample[];
  summary?: DailyHealthSummary;
  alert?: MetricAlert;
  error?: {
    code: string;
    message: string;
  };
  batteryLevel?: number;
}

// ============================================================================
// REAL-TIME STREAMING
// ============================================================================

export interface RealTimeHeartRate {
  patientId: string;
  deviceId: string;
  timestamp: string;
  heartRate: number;
  heartRateVariability?: number;
  motionContext: "active" | "sedentary" | "unknown";
  confidence: number;
}

export interface RealTimeAlert {
  id: string;
  patientId: string;
  deviceId: string;
  type: "high_heart_rate" | "low_heart_rate" | "irregular_rhythm" | "low_blood_oxygen" | "fall_detected";
  severity: "warning" | "critical";
  value: number;
  threshold: number;
  timestamp: string;
  acknowledged: boolean;
}

// ============================================================================
// CLINICAL THRESHOLDS
// ============================================================================

export interface ClinicalThresholds {
  patientId: string;
  restingHeartRate: {
    low: number;
    high: number;
    criticalLow: number;
    criticalHigh: number;
  };
  heartRateVariability: {
    lowWarning: number;
    lowCritical: number;
  };
  bloodOxygen: {
    lowWarning: number;
    lowCritical: number;
  };
  sleepDuration: {
    lowWarning: number;
    lowCritical: number;
  };
  activityLevel: {
    stepsLowWarning: number;
    inactivityHoursWarning: number;
  };
}

export const DEFAULT_CARDIAC_THRESHOLDS: Omit<ClinicalThresholds, "patientId"> = {
  restingHeartRate: {
    low: 50,
    high: 100,
    criticalLow: 40,
    criticalHigh: 120,
  },
  heartRateVariability: {
    lowWarning: 20,
    lowCritical: 10,
  },
  bloodOxygen: {
    lowWarning: 94,
    lowCritical: 90,
  },
  sleepDuration: {
    lowWarning: 5,
    lowCritical: 3,
  },
  activityLevel: {
    stepsLowWarning: 2000,
    inactivityHoursWarning: 12,
  },
};
