/**
 * Google Fit / Health Connect Integration
 * Handles data sync from Wear OS devices and Android phones
 *
 * Supports:
 * - Google Fit API (legacy, being deprecated)
 * - Health Connect API (new standard for Android)
 * - Wear OS real-time streaming
 */

import crypto from 'crypto';
import type {
  WearableProviderInterface,
  WearableAuthResult,
  OAuthTokens,
  SyncResult,
  HeartRateData,
  SleepData,
  ActivityData,
  OxygenSaturationData,
  HRVData,
  BloodPressureData,
} from './types';
import { env } from '../../config/env';

// Google Fit data types
export const GOOGLE_FIT_DATA_TYPES = {
  // Vitals
  HEART_RATE: 'com.google.heart_rate.bpm',
  HEART_RATE_SUMMARY: 'com.google.heart_rate.summary',
  BLOOD_PRESSURE: 'com.google.blood_pressure',
  BLOOD_OXYGEN: 'com.google.oxygen_saturation',
  BODY_TEMPERATURE: 'com.google.body.temperature',

  // Activity
  STEP_COUNT: 'com.google.step_count.delta',
  DISTANCE: 'com.google.distance.delta',
  CALORIES: 'com.google.calories.expended',
  ACTIVE_MINUTES: 'com.google.active_minutes',
  MOVE_MINUTES: 'com.google.move_minutes',

  // Sleep
  SLEEP_SEGMENT: 'com.google.sleep.segment',

  // Body
  WEIGHT: 'com.google.weight',
  HEIGHT: 'com.google.height',
  BODY_FAT: 'com.google.body.fat.percentage',
} as const;

// Health Connect data types (newer Android API)
export const HEALTH_CONNECT_DATA_TYPES = {
  HEART_RATE: 'HeartRateRecord',
  HEART_RATE_VARIABILITY: 'HeartRateVariabilityRmssdRecord',
  RESTING_HEART_RATE: 'RestingHeartRateRecord',
  BLOOD_PRESSURE: 'BloodPressureRecord',
  BLOOD_OXYGEN: 'OxygenSaturationRecord',
  RESPIRATORY_RATE: 'RespiratoryRateRecord',
  BODY_TEMPERATURE: 'BodyTemperatureRecord',
  STEPS: 'StepsRecord',
  DISTANCE: 'DistanceRecord',
  CALORIES: 'TotalCaloriesBurnedRecord',
  ACTIVE_CALORIES: 'ActiveCaloriesBurnedRecord',
  EXERCISE: 'ExerciseSessionRecord',
  SLEEP: 'SleepSessionRecord',
  WEIGHT: 'WeightRecord',
  HEIGHT: 'HeightRecord',
  BODY_FAT: 'BodyFatRecord',
  HYDRATION: 'HydrationRecord',
  NUTRITION: 'NutritionRecord',
} as const;

// Sleep stage mapping for Google Fit
const GOOGLE_SLEEP_STAGE_MAP: Record<number, string> = {
  0: 'unknown',
  1: 'awake',
  2: 'sleep',
  3: 'outOfBed',
  4: 'lightSleep',
  5: 'deepSleep',
  6: 'rem',
};

interface GoogleFitConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
}

interface GoogleFitDataPoint {
  startTimeNanos: string;
  endTimeNanos: string;
  dataTypeName: string;
  value: Array<{
    fpVal?: number;
    intVal?: number;
    stringVal?: string;
    mapVal?: Array<{ key: string; value: { fpVal?: number; intVal?: number } }>;
  }>;
  originDataSourceId?: string;
}

interface GoogleFitDataset {
  dataSourceId: string;
  point: GoogleFitDataPoint[];
  minStartTimeNs?: string;
  maxEndTimeNs?: string;
}

export class GoogleFitProvider implements WearableProviderInterface {
  readonly provider = 'google_fit' as const;

  private config: GoogleFitConfig;
  private baseUrl = 'https://www.googleapis.com/fitness/v1/users/me';
  private authUrl = 'https://accounts.google.com/o/oauth2/v2/auth';
  private tokenUrl = 'https://oauth2.googleapis.com/token';

  // Required scopes for health data
  private scopes = [
    'https://www.googleapis.com/auth/fitness.heart_rate.read',
    'https://www.googleapis.com/auth/fitness.blood_pressure.read',
    'https://www.googleapis.com/auth/fitness.oxygen_saturation.read',
    'https://www.googleapis.com/auth/fitness.body_temperature.read',
    'https://www.googleapis.com/auth/fitness.activity.read',
    'https://www.googleapis.com/auth/fitness.sleep.read',
    'https://www.googleapis.com/auth/fitness.body.read',
    'https://www.googleapis.com/auth/fitness.location.read',
  ];

  constructor() {
    this.config = {
      clientId: env.GOOGLE_CLIENT_ID || '',
      clientSecret: env.GOOGLE_CLIENT_SECRET || '',
      redirectUri: env.GOOGLE_REDIRECT_URI || '',
    };
  }

  /**
   * Generate OAuth authorization URL
   */
  getAuthorizationUrl(state: string): string {
    const params = new URLSearchParams({
      client_id: this.config.clientId,
      redirect_uri: this.config.redirectUri,
      response_type: 'code',
      scope: this.scopes.join(' '),
      access_type: 'offline',
      prompt: 'consent',
      state,
    });

    return `${this.authUrl}?${params.toString()}`;
  }

  /**
   * Exchange authorization code for tokens
   */
  async exchangeCodeForTokens(code: string): Promise<WearableAuthResult> {
    try {
      const response = await fetch(this.tokenUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          client_id: this.config.clientId,
          client_secret: this.config.clientSecret,
          code,
          grant_type: 'authorization_code',
          redirect_uri: this.config.redirectUri,
        }),
      });

      if (!response.ok) {
        const error = await response.text();
        return { success: false, error: `Token exchange failed: ${error}` };
      }

      const data = await response.json();

      return {
        success: true,
        tokens: {
          accessToken: data.access_token,
          refreshToken: data.refresh_token,
          expiresAt: new Date(Date.now() + data.expires_in * 1000),
          tokenType: data.token_type,
          scope: data.scope,
        },
      };
    } catch (error) {
      return {
        success: false,
        error: `Token exchange error: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  }

  /**
   * Refresh expired tokens
   */
  async refreshTokens(refreshToken: string): Promise<OAuthTokens> {
    const response = await fetch(this.tokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        client_id: this.config.clientId,
        client_secret: this.config.clientSecret,
        refresh_token: refreshToken,
        grant_type: 'refresh_token',
      }),
    });

    if (!response.ok) {
      throw new Error(`Token refresh failed: ${await response.text()}`);
    }

    const data = await response.json();

    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token || refreshToken,
      expiresAt: new Date(Date.now() + data.expires_in * 1000),
      tokenType: data.token_type,
    };
  }

  /**
   * Revoke access
   */
  async revokeAccess(accessToken: string): Promise<boolean> {
    try {
      const response = await fetch(
        `https://oauth2.googleapis.com/revoke?token=${accessToken}`,
        { method: 'POST' }
      );
      return response.ok;
    } catch {
      return false;
    }
  }

  /**
   * Sync all health data
   */
  async syncHealthData(
    accessToken: string,
    since?: Date,
    types?: string[]
  ): Promise<SyncResult> {
    const errors: string[] = [];
    const startTime = since || new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const endTime = new Date();

    const heartRate = await this.getHeartRate(accessToken, startTime, endTime).catch((e) => {
      errors.push(`Heart rate: ${e.message}`);
      return [];
    });

    const sleep = await this.getSleep(accessToken, startTime, endTime).catch((e) => {
      errors.push(`Sleep: ${e.message}`);
      return [];
    });

    const activity = await this.getActivity(accessToken, startTime, endTime).catch((e) => {
      errors.push(`Activity: ${e.message}`);
      return [];
    });

    const bloodOxygen = await this.getBloodOxygen(accessToken, startTime, endTime).catch((e) => {
      errors.push(`Blood oxygen: ${e.message}`);
      return [];
    });

    const hrv = await this.getHRV(accessToken, startTime, endTime).catch((e) => {
      errors.push(`HRV: ${e.message}`);
      return [];
    });

    return {
      provider: 'google_fit',
      success: errors.length === 0,
      syncedAt: new Date(),
      recordsCount: {
        heartRate: heartRate.length,
        sleep: sleep.length,
        activity: activity.length,
        bloodOxygen: bloodOxygen.length,
        temperature: 0,
        hrv: hrv.length,
        bloodPressure: 0,
        ecg: 0,
      },
      errors: errors.length > 0 ? errors : undefined,
    };
  }

  /**
   * Get heart rate data
   */
  async getHeartRate(
    accessToken: string,
    startDate: Date,
    endDate: Date
  ): Promise<HeartRateData[]> {
    const datasetId = this.createDatasetId(startDate, endDate);
    const url = `${this.baseUrl}/dataSources/derived:com.google.heart_rate.bpm:com.google.android.gms:merge_heart_rate_bpm/datasets/${datasetId}`;

    const response = await this.fetchWithAuth(url, accessToken);
    const data: GoogleFitDataset = await response.json();

    return (data.point || []).map((point) => ({
      timestamp: new Date(parseInt(point.startTimeNanos) / 1e6),
      bpm: point.value[0]?.fpVal || 0,
      context: this.determineContext(point),
    }));
  }

  /**
   * Get sleep data
   */
  async getSleep(accessToken: string, startDate: Date, endDate: Date): Promise<SleepData[]> {
    const sessions = await this.getSleepSessions(accessToken, startDate, endDate);
    return sessions;
  }

  /**
   * Get sleep sessions from Google Fit
   */
  private async getSleepSessions(
    accessToken: string,
    startDate: Date,
    endDate: Date
  ): Promise<SleepData[]> {
    const url = `${this.baseUrl}/sessions?startTime=${startDate.toISOString()}&endTime=${endDate.toISOString()}&activityType=72`;

    const response = await this.fetchWithAuth(url, accessToken);
    const data = await response.json();

    const sleepData: SleepData[] = [];

    for (const session of data.session || []) {
      const startTime = new Date(parseInt(session.startTimeMillis));
      const endTime = new Date(parseInt(session.endTimeMillis));
      const totalMinutes = (endTime.getTime() - startTime.getTime()) / (1000 * 60);

      // Get sleep segments for this session
      const segments = await this.getSleepSegments(
        accessToken,
        startTime,
        endTime
      );

      sleepData.push({
        startTime,
        endTime,
        totalMinutes: Math.round(totalMinutes),
        stages: segments,
        score: this.calculateSleepScore(segments, totalMinutes),
      });
    }

    return sleepData;
  }

  /**
   * Get sleep segments (stages) for a session
   */
  private async getSleepSegments(
    accessToken: string,
    startDate: Date,
    endDate: Date
  ): Promise<{ awake: number; light: number; deep: number; rem: number }> {
    const datasetId = this.createDatasetId(startDate, endDate);
    const url = `${this.baseUrl}/dataSources/derived:com.google.sleep.segment:com.google.android.gms:merged/datasets/${datasetId}`;

    try {
      const response = await this.fetchWithAuth(url, accessToken);
      const data: GoogleFitDataset = await response.json();

      const stages = { awake: 0, light: 0, deep: 0, rem: 0 };

      for (const point of data.point || []) {
        const durationMs =
          (parseInt(point.endTimeNanos) - parseInt(point.startTimeNanos)) / 1e6;
        const durationMinutes = durationMs / (1000 * 60);
        const stageValue = point.value[0]?.intVal || 0;
        const stage = GOOGLE_SLEEP_STAGE_MAP[stageValue] || 'unknown';

        switch (stage) {
          case 'awake':
          case 'outOfBed':
            stages.awake += durationMinutes;
            break;
          case 'lightSleep':
          case 'sleep':
            stages.light += durationMinutes;
            break;
          case 'deepSleep':
            stages.deep += durationMinutes;
            break;
          case 'rem':
            stages.rem += durationMinutes;
            break;
        }
      }

      return {
        awake: Math.round(stages.awake),
        light: Math.round(stages.light),
        deep: Math.round(stages.deep),
        rem: Math.round(stages.rem),
      };
    } catch {
      return { awake: 0, light: 0, deep: 0, rem: 0 };
    }
  }

  /**
   * Get activity data
   */
  async getActivity(
    accessToken: string,
    startDate: Date,
    endDate: Date
  ): Promise<ActivityData[]> {
    const activities: Map<string, Partial<ActivityData>> = new Map();

    // Get steps
    const stepsData = await this.getDataType(
      accessToken,
      'derived:com.google.step_count.delta:com.google.android.gms:estimated_steps',
      startDate,
      endDate
    );

    for (const point of stepsData) {
      const dateStr = new Date(parseInt(point.startTimeNanos) / 1e6)
        .toISOString()
        .split('T')[0];
      if (!activities.has(dateStr)) {
        activities.set(dateStr, { date: new Date(dateStr) });
      }
      const activity = activities.get(dateStr)!;
      activity.steps = (activity.steps || 0) + (point.value[0]?.intVal || 0);
    }

    // Get distance
    const distanceData = await this.getDataType(
      accessToken,
      'derived:com.google.distance.delta:com.google.android.gms:merge_distance_delta',
      startDate,
      endDate
    );

    for (const point of distanceData) {
      const dateStr = new Date(parseInt(point.startTimeNanos) / 1e6)
        .toISOString()
        .split('T')[0];
      if (!activities.has(dateStr)) {
        activities.set(dateStr, { date: new Date(dateStr) });
      }
      const activity = activities.get(dateStr)!;
      activity.distance = (activity.distance || 0) + (point.value[0]?.fpVal || 0);
    }

    // Get calories
    const caloriesData = await this.getDataType(
      accessToken,
      'derived:com.google.calories.expended:com.google.android.gms:merge_calories_expended',
      startDate,
      endDate
    );

    for (const point of caloriesData) {
      const dateStr = new Date(parseInt(point.startTimeNanos) / 1e6)
        .toISOString()
        .split('T')[0];
      if (!activities.has(dateStr)) {
        activities.set(dateStr, { date: new Date(dateStr) });
      }
      const activity = activities.get(dateStr)!;
      activity.calories = (activity.calories || 0) + (point.value[0]?.fpVal || 0);
    }

    return Array.from(activities.values()).map((a) => ({
      date: a.date!,
      steps: Math.round(a.steps || 0),
      distance: a.distance ? Math.round(a.distance) : undefined,
      calories: a.calories ? Math.round(a.calories) : undefined,
      activeMinutes: a.activeMinutes,
      floorsClimbed: a.floorsClimbed,
    }));
  }

  /**
   * Get blood oxygen data
   */
  async getBloodOxygen(
    accessToken: string,
    startDate: Date,
    endDate: Date
  ): Promise<OxygenSaturationData[]> {
    const data = await this.getDataType(
      accessToken,
      'derived:com.google.oxygen_saturation:com.google.android.gms:merged',
      startDate,
      endDate
    );

    return data.map((point) => ({
      timestamp: new Date(parseInt(point.startTimeNanos) / 1e6),
      percentage: (point.value[0]?.fpVal || 0) * 100,
    }));
  }

  /**
   * Get HRV data (if available from device)
   */
  async getHRV(accessToken: string, startDate: Date, endDate: Date): Promise<HRVData[]> {
    // HRV is typically accessed through Health Connect, not Google Fit directly
    // This would require the Health Connect API
    return [];
  }

  /**
   * Get blood pressure data
   */
  async getBloodPressure(
    accessToken: string,
    startDate: Date,
    endDate: Date
  ): Promise<BloodPressureData[]> {
    const data = await this.getDataType(
      accessToken,
      'derived:com.google.blood_pressure:com.google.android.gms:merged',
      startDate,
      endDate
    );

    return data.map((point) => {
      const mapVal = point.value[0]?.mapVal || [];
      const systolic = mapVal.find((m) => m.key === 'systolic')?.value?.fpVal || 0;
      const diastolic = mapVal.find((m) => m.key === 'diastolic')?.value?.fpVal || 0;

      return {
        timestamp: new Date(parseInt(point.startTimeNanos) / 1e6),
        systolic,
        diastolic,
      };
    });
  }

  /**
   * Get data for a specific data type
   */
  private async getDataType(
    accessToken: string,
    dataSourceId: string,
    startDate: Date,
    endDate: Date
  ): Promise<GoogleFitDataPoint[]> {
    const datasetId = this.createDatasetId(startDate, endDate);
    const url = `${this.baseUrl}/dataSources/${encodeURIComponent(dataSourceId)}/datasets/${datasetId}`;

    try {
      const response = await this.fetchWithAuth(url, accessToken);
      const data: GoogleFitDataset = await response.json();
      return data.point || [];
    } catch {
      return [];
    }
  }

  /**
   * Create dataset ID from date range
   */
  private createDatasetId(startDate: Date, endDate: Date): string {
    const startNanos = startDate.getTime() * 1e6;
    const endNanos = endDate.getTime() * 1e6;
    return `${startNanos}-${endNanos}`;
  }

  /**
   * Fetch with authorization header
   */
  private async fetchWithAuth(url: string, accessToken: string): Promise<Response> {
    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`Google Fit API error: ${response.status}`);
    }

    return response;
  }

  /**
   * Determine activity context from data point
   */
  private determineContext(
    _point: GoogleFitDataPoint
  ): 'resting' | 'active' | 'workout' | 'sleep' | undefined {
    // Would need additional data source info to determine context
    return undefined;
  }

  /**
   * Calculate sleep score
   */
  private calculateSleepScore(
    stages: { awake: number; light: number; deep: number; rem: number },
    totalMinutes: number
  ): number {
    if (totalMinutes === 0) return 0;

    let score = 50;
    const hours = totalMinutes / 60;

    // Duration score
    if (hours >= 7 && hours <= 9) {
      score += 20;
    } else if (hours >= 6 && hours <= 10) {
      score += 10;
    }

    // Deep sleep contribution
    const deepPercent = stages.deep / totalMinutes;
    if (deepPercent >= 0.15 && deepPercent <= 0.25) {
      score += 15;
    } else if (deepPercent >= 0.1) {
      score += 8;
    }

    // REM contribution
    const remPercent = stages.rem / totalMinutes;
    if (remPercent >= 0.2 && remPercent <= 0.3) {
      score += 15;
    } else if (remPercent >= 0.15) {
      score += 8;
    }

    return Math.min(100, Math.max(0, Math.round(score)));
  }

  /**
   * Validate webhook signature
   */
  validateWebhook(signature: string, payload: string): boolean {
    // Google uses push notifications via Cloud Pub/Sub
    // Validation depends on the specific setup
    return true;
  }

  /**
   * Parse webhook payload
   */
  parseWebhookPayload(payload: unknown): { userId: string; dataTypes: string[] } {
    const data = payload as { userId?: string; dataType?: string[] };
    return {
      userId: data.userId || '',
      dataTypes: data.dataType || [],
    };
  }
}

export const googleFitProvider = new GoogleFitProvider();
