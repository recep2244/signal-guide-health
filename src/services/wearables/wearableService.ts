/**
 * Wearable Device Integration Service
 * Handles data sync, analysis, and alerts for Apple Watch, Fitbit, etc.
 */

import { ApiClient } from "../api/client";
import {
  WearableProvider,
  WearableDevice,
  HealthDataType,
  HealthSample,
  DailyHealthSummary,
  DailyMetrics,
  HealthTrend,
  TrendPeriod,
  TrendDirection,
  TrendStatus,
  AuthorizationRequest,
  AuthorizationResponse,
  SyncRequest,
  SyncResponse,
  MetricAlert,
  ClinicalThresholds,
  DEFAULT_CARDIAC_THRESHOLDS,
  CARDIAC_DATA_TYPES,
} from "./types";
import {
  BASELINE_DAYS,
  HR_AMBER_THRESHOLD,
  HR_RED_THRESHOLD,
  HRV_AMBER_THRESHOLD,
  HRV_RED_THRESHOLD,
  SLEEP_CONCERN_HOURS,
} from "@/config/constants";

// ============================================================================
// SERVICE CLASS
// ============================================================================

export class WearableService {
  private client: ApiClient;
  private devices: Map<string, WearableDevice> = new Map();
  private thresholds: Map<string, ClinicalThresholds> = new Map();

  constructor(client: ApiClient) {
    this.client = client;
  }

  // ---------------------------------------------------------------------------
  // DEVICE MANAGEMENT
  // ---------------------------------------------------------------------------

  /**
   * Get all devices for a patient
   */
  async getPatientDevices(patientId: string): Promise<WearableDevice[]> {
    const response = await this.client.get<WearableDevice[]>(
      `/patients/${patientId}/devices`
    );
    return response.data;
  }

  /**
   * Get device by ID
   */
  async getDevice(deviceId: string): Promise<WearableDevice | null> {
    try {
      const response = await this.client.get<WearableDevice>(
        `/devices/${deviceId}`
      );
      return response.data;
    } catch {
      return null;
    }
  }

  /**
   * Initiate device authorization flow
   */
  async authorizeDevice(
    request: AuthorizationRequest
  ): Promise<AuthorizationResponse> {
    const response = await this.client.post<AuthorizationResponse>(
      `/devices/authorize`,
      request
    );
    return response.data;
  }

  /**
   * Revoke device authorization
   */
  async revokeDevice(deviceId: string): Promise<void> {
    await this.client.delete(`/devices/${deviceId}`);
  }

  /**
   * Check device sync status
   */
  async checkSyncStatus(deviceId: string): Promise<{
    lastSyncAt: string | null;
    status: "connected" | "disconnected" | "syncing";
    batteryLevel?: number;
  }> {
    const response = await this.client.get<{
      lastSyncAt: string | null;
      status: "connected" | "disconnected" | "syncing";
      batteryLevel?: number;
    }>(`/devices/${deviceId}/status`);
    return response.data;
  }

  // ---------------------------------------------------------------------------
  // DATA SYNC
  // ---------------------------------------------------------------------------

  /**
   * Trigger manual sync for a device
   */
  async syncDevice(request: SyncRequest): Promise<SyncResponse> {
    const response = await this.client.post<SyncResponse>(
      `/devices/${request.deviceId}/sync`,
      request
    );
    return response.data;
  }

  /**
   * Get raw health samples for a patient
   */
  async getHealthSamples(
    patientId: string,
    dataTypes: HealthDataType[],
    startDate: string,
    endDate: string
  ): Promise<HealthSample[]> {
    const response = await this.client.get<HealthSample[]>(
      `/patients/${patientId}/samples`,
      {
        headers: {
          "X-Data-Types": dataTypes.join(","),
          "X-Start-Date": startDate,
          "X-End-Date": endDate,
        },
      }
    );
    return response.data;
  }

  /**
   * Get daily health summary
   */
  async getDailySummary(
    patientId: string,
    date: string
  ): Promise<DailyHealthSummary> {
    const response = await this.client.get<DailyHealthSummary>(
      `/patients/${patientId}/summary/${date}`
    );
    return response.data;
  }

  /**
   * Get health summaries for a date range
   */
  async getSummaryRange(
    patientId: string,
    startDate: string,
    endDate: string
  ): Promise<DailyHealthSummary[]> {
    const response = await this.client.get<DailyHealthSummary[]>(
      `/patients/${patientId}/summaries?start=${startDate}&end=${endDate}`
    );
    return response.data;
  }

  // ---------------------------------------------------------------------------
  // TREND ANALYSIS
  // ---------------------------------------------------------------------------

  /**
   * Calculate health trends for a patient
   */
  async calculateTrends(
    patientId: string,
    period: TrendPeriod = "14d"
  ): Promise<HealthTrend[]> {
    const response = await this.client.get<HealthTrend[]>(
      `/patients/${patientId}/trends?period=${period}`
    );
    return response.data;
  }

  /**
   * Analyze trends locally from daily summaries
   */
  analyzeTrendsFromSummaries(
    summaries: DailyHealthSummary[],
    baselineDays: number = BASELINE_DAYS
  ): HealthTrend[] {
    const trends: HealthTrend[] = [];

    // Analyze resting heart rate trend
    const hrTrend = this.analyzeMetricTrend(
      summaries,
      (m) => m.restingHeartRate?.value,
      "resting_heart_rate",
      baselineDays
    );
    if (hrTrend) trends.push(hrTrend);

    // Analyze HRV trend
    const hrvTrend = this.analyzeMetricTrend(
      summaries,
      (m) => m.heartRateVariability?.value,
      "heart_rate_variability",
      baselineDays
    );
    if (hrvTrend) trends.push(hrvTrend);

    // Analyze sleep trend
    const sleepTrend = this.analyzeMetricTrend(
      summaries,
      (m) => m.sleepDuration?.value,
      "sleep_analysis",
      baselineDays
    );
    if (sleepTrend) trends.push(sleepTrend);

    // Analyze steps trend
    const stepsTrend = this.analyzeMetricTrend(
      summaries,
      (m) => m.steps?.value,
      "steps",
      baselineDays
    );
    if (stepsTrend) trends.push(stepsTrend);

    return trends;
  }

  private analyzeMetricTrend(
    summaries: DailyHealthSummary[],
    extractor: (metrics: DailyMetrics) => number | undefined,
    dataType: HealthDataType,
    baselineDays: number
  ): HealthTrend | null {
    const values = summaries
      .map((s) => ({
        date: s.date,
        value: extractor(s.metrics),
      }))
      .filter((v) => v.value !== undefined) as Array<{
      date: string;
      value: number;
    }>;

    if (values.length < baselineDays + 1) return null;

    // Calculate baseline from first N days
    const baselineValues = values.slice(0, baselineDays).map((v) => v.value);
    const currentValue = values[values.length - 1].value;

    const baselineMean = this.mean(baselineValues);
    const baselineStd = this.standardDeviation(baselineValues);

    const deltaFromBaseline = currentValue - baselineMean;
    const percentChange = (deltaFromBaseline / baselineMean) * 100;
    const zScore = baselineStd > 0 ? deltaFromBaseline / baselineStd : 0;

    // Determine trend direction
    let trend: TrendDirection = "stable";
    if (Math.abs(percentChange) > 5) {
      trend = percentChange > 0 ? "increasing" : "decreasing";
    }

    // Determine status based on data type
    const status = this.determineTrendStatus(dataType, percentChange, zScore);

    return {
      dataType,
      period: `${summaries.length}d` as TrendPeriod,
      baseline: {
        mean: baselineMean,
        median: this.median(baselineValues),
        standardDeviation: baselineStd,
        min: Math.min(...baselineValues),
        max: Math.max(...baselineValues),
        sampleCount: baselineValues.length,
        startDate: values[0].date,
        endDate: values[baselineDays - 1].date,
      },
      current: {
        value: currentValue,
        comparisonPeriod: values[values.length - 1].date,
        deltaFromBaseline,
        zScore,
      },
      trend,
      percentChange,
      status,
    };
  }

  private determineTrendStatus(
    dataType: HealthDataType,
    percentChange: number,
    zScore: number
  ): TrendStatus {
    const absChange = Math.abs(percentChange);
    const absZ = Math.abs(zScore);

    // Heart rate: increasing is concerning
    if (dataType === "resting_heart_rate") {
      if (percentChange >= HR_RED_THRESHOLD) return "critical";
      if (percentChange >= HR_AMBER_THRESHOLD) return "concerning";
      if (percentChange < -5) return "improving";
      return "normal";
    }

    // HRV: decreasing is concerning
    if (dataType === "heart_rate_variability") {
      if (percentChange <= HRV_RED_THRESHOLD) return "critical";
      if (percentChange <= HRV_AMBER_THRESHOLD) return "concerning";
      if (percentChange > 10) return "improving";
      return "normal";
    }

    // Sleep: decreasing is concerning
    if (dataType === "sleep_analysis") {
      if (absZ > 2 && percentChange < 0) return "critical";
      if (absZ > 1.5 && percentChange < 0) return "concerning";
      if (percentChange > 10) return "improving";
      return "normal";
    }

    // Steps: decreasing may be concerning
    if (dataType === "steps") {
      if (percentChange < -50) return "concerning";
      if (percentChange > 20) return "improving";
      return "normal";
    }

    // Default logic
    if (absZ > 2) return "critical";
    if (absZ > 1.5) return "concerning";
    return "normal";
  }

  // ---------------------------------------------------------------------------
  // ALERT GENERATION
  // ---------------------------------------------------------------------------

  /**
   * Check for alerts based on current data
   */
  async checkForAlerts(
    patientId: string,
    summary: DailyHealthSummary
  ): Promise<MetricAlert[]> {
    const thresholds = this.getThresholds(patientId);
    const alerts: MetricAlert[] = [];

    const { metrics } = summary;

    // Check resting heart rate
    if (metrics.restingHeartRate) {
      const hr = metrics.restingHeartRate.value;
      if (hr >= thresholds.restingHeartRate.criticalHigh) {
        alerts.push({
          type: "resting_heart_rate",
          severity: "critical",
          message: `Critical high resting heart rate: ${hr} bpm`,
          threshold: thresholds.restingHeartRate.criticalHigh,
          actualValue: hr,
          detectedAt: new Date().toISOString(),
        });
      } else if (hr >= thresholds.restingHeartRate.high) {
        alerts.push({
          type: "resting_heart_rate",
          severity: "warning",
          message: `Elevated resting heart rate: ${hr} bpm`,
          threshold: thresholds.restingHeartRate.high,
          actualValue: hr,
          detectedAt: new Date().toISOString(),
        });
      } else if (hr <= thresholds.restingHeartRate.criticalLow) {
        alerts.push({
          type: "resting_heart_rate",
          severity: "critical",
          message: `Critical low resting heart rate: ${hr} bpm`,
          threshold: thresholds.restingHeartRate.criticalLow,
          actualValue: hr,
          detectedAt: new Date().toISOString(),
        });
      }
    }

    // Check HRV
    if (metrics.heartRateVariability) {
      const hrv = metrics.heartRateVariability.value;
      if (hrv <= thresholds.heartRateVariability.lowCritical) {
        alerts.push({
          type: "heart_rate_variability",
          severity: "critical",
          message: `Critical low HRV: ${hrv} ms`,
          threshold: thresholds.heartRateVariability.lowCritical,
          actualValue: hrv,
          detectedAt: new Date().toISOString(),
        });
      } else if (hrv <= thresholds.heartRateVariability.lowWarning) {
        alerts.push({
          type: "heart_rate_variability",
          severity: "warning",
          message: `Low HRV: ${hrv} ms`,
          threshold: thresholds.heartRateVariability.lowWarning,
          actualValue: hrv,
          detectedAt: new Date().toISOString(),
        });
      }
    }

    // Check blood oxygen
    if (metrics.bloodOxygen) {
      const spo2 = metrics.bloodOxygen.value;
      if (spo2 <= thresholds.bloodOxygen.lowCritical) {
        alerts.push({
          type: "blood_oxygen",
          severity: "critical",
          message: `Critical low blood oxygen: ${spo2}%`,
          threshold: thresholds.bloodOxygen.lowCritical,
          actualValue: spo2,
          detectedAt: new Date().toISOString(),
        });
      } else if (spo2 <= thresholds.bloodOxygen.lowWarning) {
        alerts.push({
          type: "blood_oxygen",
          severity: "warning",
          message: `Low blood oxygen: ${spo2}%`,
          threshold: thresholds.bloodOxygen.lowWarning,
          actualValue: spo2,
          detectedAt: new Date().toISOString(),
        });
      }
    }

    // Check sleep duration
    if (metrics.sleepDuration) {
      const sleep = metrics.sleepDuration.value;
      if (sleep <= thresholds.sleepDuration.lowCritical) {
        alerts.push({
          type: "sleep_analysis",
          severity: "critical",
          message: `Critical low sleep: ${sleep.toFixed(1)} hours`,
          threshold: thresholds.sleepDuration.lowCritical,
          actualValue: sleep,
          detectedAt: new Date().toISOString(),
        });
      } else if (sleep <= thresholds.sleepDuration.lowWarning) {
        alerts.push({
          type: "sleep_analysis",
          severity: "warning",
          message: `Low sleep: ${sleep.toFixed(1)} hours`,
          threshold: thresholds.sleepDuration.lowWarning,
          actualValue: sleep,
          detectedAt: new Date().toISOString(),
        });
      }
    }

    return alerts;
  }

  /**
   * Get clinical thresholds for a patient
   */
  getThresholds(patientId: string): ClinicalThresholds {
    return (
      this.thresholds.get(patientId) || {
        patientId,
        ...DEFAULT_CARDIAC_THRESHOLDS,
      }
    );
  }

  /**
   * Set custom thresholds for a patient
   */
  setThresholds(patientId: string, thresholds: ClinicalThresholds): void {
    this.thresholds.set(patientId, thresholds);
  }

  // ---------------------------------------------------------------------------
  // HELPER METHODS
  // ---------------------------------------------------------------------------

  private mean(values: number[]): number {
    if (values.length === 0) return 0;
    return values.reduce((sum, v) => sum + v, 0) / values.length;
  }

  private median(values: number[]): number {
    if (values.length === 0) return 0;
    const sorted = [...values].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 !== 0
      ? sorted[mid]
      : (sorted[mid - 1] + sorted[mid]) / 2;
  }

  private standardDeviation(values: number[]): number {
    if (values.length < 2) return 0;
    const avg = this.mean(values);
    const squareDiffs = values.map((value) => Math.pow(value - avg, 2));
    return Math.sqrt(this.mean(squareDiffs));
  }

  /**
   * Format sync time as relative string
   */
  formatLastSync(lastSyncAt: string | null): string {
    if (!lastSyncAt) return "Never synced";

    const now = new Date();
    const syncTime = new Date(lastSyncAt);
    const diffMs = now.getTime() - syncTime.getTime();
    const diffMins = Math.floor(diffMs / 60000);

    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins} min ago`;

    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? "s" : ""} ago`;

    const diffDays = Math.floor(diffHours / 24);
    return `${diffDays} day${diffDays > 1 ? "s" : ""} ago`;
  }
}

// ============================================================================
// SINGLETON INSTANCE
// ============================================================================

let wearableServiceInstance: WearableService | null = null;

export function initWearableService(client: ApiClient): WearableService {
  wearableServiceInstance = new WearableService(client);
  return wearableServiceInstance;
}

export function getWearableService(): WearableService {
  if (!wearableServiceInstance) {
    throw new Error("Wearable service not initialized. Call initWearableService first.");
  }
  return wearableServiceInstance;
}

export default WearableService;
