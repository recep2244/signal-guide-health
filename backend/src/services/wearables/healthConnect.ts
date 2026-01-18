/**
 * Android Health Connect Integration
 * The new standard API for health data on Android (replacing Google Fit)
 *
 * Health Connect is the unified health data platform for Android.
 * Data is accessed via the Android app which syncs to our backend.
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
} from './types';
import { env } from '../../config/env';

// Health Connect data types
export const HEALTH_CONNECT_TYPES = {
  // Vitals
  HEART_RATE: 'androidx.health.connect.client.records.HeartRateRecord',
  RESTING_HEART_RATE: 'androidx.health.connect.client.records.RestingHeartRateRecord',
  HRV_RMSSD: 'androidx.health.connect.client.records.HeartRateVariabilityRmssdRecord',
  BLOOD_OXYGEN: 'androidx.health.connect.client.records.OxygenSaturationRecord',
  RESPIRATORY_RATE: 'androidx.health.connect.client.records.RespiratoryRateRecord',
  BLOOD_PRESSURE: 'androidx.health.connect.client.records.BloodPressureRecord',
  BODY_TEMPERATURE: 'androidx.health.connect.client.records.BodyTemperatureRecord',

  // Activity
  STEPS: 'androidx.health.connect.client.records.StepsRecord',
  DISTANCE: 'androidx.health.connect.client.records.DistanceRecord',
  CALORIES_TOTAL: 'androidx.health.connect.client.records.TotalCaloriesBurnedRecord',
  CALORIES_ACTIVE: 'androidx.health.connect.client.records.ActiveCaloriesBurnedRecord',
  EXERCISE: 'androidx.health.connect.client.records.ExerciseSessionRecord',
  FLOORS_CLIMBED: 'androidx.health.connect.client.records.FloorsClimbedRecord',

  // Sleep
  SLEEP_SESSION: 'androidx.health.connect.client.records.SleepSessionRecord',
  SLEEP_STAGE: 'androidx.health.connect.client.records.SleepStageRecord',

  // Body
  WEIGHT: 'androidx.health.connect.client.records.WeightRecord',
  HEIGHT: 'androidx.health.connect.client.records.HeightRecord',
  BODY_FAT: 'androidx.health.connect.client.records.BodyFatRecord',
  LEAN_BODY_MASS: 'androidx.health.connect.client.records.LeanBodyMassRecord',
} as const;

// Sleep stage mapping
const SLEEP_STAGE_MAP: Record<number, string> = {
  0: 'unknown',
  1: 'awake',
  2: 'sleeping', // Generic sleeping
  3: 'outOfBed',
  4: 'light',
  5: 'deep',
  6: 'rem',
  7: 'awakeInBed',
};

interface HealthConnectPushData {
  patientId: string;
  deviceId: string;
  deviceInfo: {
    manufacturer: string;
    model: string;
    osVersion: string;
    appVersion: string;
  };
  records: HealthConnectRecord[];
  changeToken?: string;
}

interface HealthConnectRecord {
  recordType: string;
  id: string;
  startTime: string;
  endTime?: string;
  metadata: {
    clientRecordId?: string;
    clientRecordVersion?: number;
    dataOrigin: string;
    device?: {
      manufacturer?: string;
      model?: string;
      type?: number;
    };
  };
  // Different fields based on record type
  samples?: Array<{ time: string; beatsPerMinute: number }>;
  beatsPerMinute?: number;
  heartRateVariabilityMillis?: number;
  percentage?: number;
  systolic?: { inMillimetersOfMercury: number };
  diastolic?: { inMillimetersOfMercury: number };
  temperature?: { inCelsius: number };
  count?: number;
  distance?: { inMeters: number };
  energy?: { inKilocalories: number };
  floors?: number;
  stages?: Array<{ startTime: string; endTime: string; stage: number }>;
  weight?: { inKilograms: number };
  height?: { inMeters: number };
  bodyFatPercentage?: number;
}

export class HealthConnectProvider implements Partial<WearableProviderInterface> {
  readonly provider = 'health_connect' as const;

  private webhookSecret: string;

  constructor() {
    this.webhookSecret = env.HEALTH_CONNECT_WEBHOOK_SECRET || '';
  }

  /**
   * Health Connect uses on-device authorization
   * The Android app requests permissions and syncs data to our backend
   */
  getAuthorizationUrl(_state: string): string {
    throw new Error(
      'Health Connect authorization is handled on the Android device. ' +
      'Users must grant permission in the CardioWatch Android app.'
    );
  }

  /**
   * Register a device that will push Health Connect data
   */
  async registerDevice(
    patientId: string,
    deviceInfo: {
      deviceId: string;
      manufacturer: string;
      model: string;
      osVersion: string;
    }
  ): Promise<WearableAuthResult> {
    const pushToken = crypto.randomBytes(32).toString('hex');

    return {
      success: true,
      tokens: {
        accessToken: pushToken,
        tokenType: 'device_push',
      },
      deviceId: deviceInfo.deviceId,
      deviceName: `${deviceInfo.manufacturer} ${deviceInfo.model}`,
      deviceModel: deviceInfo.model,
    };
  }

  /**
   * Validate incoming webhook from Android app
   */
  validateWebhook(signature: string, payload: string): boolean {
    if (!this.webhookSecret) {
      console.warn('Health Connect webhook secret not configured');
      return false;
    }

    const expectedSignature = crypto
      .createHmac('sha256', this.webhookSecret)
      .update(payload)
      .digest('hex');

    return crypto.timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(expectedSignature)
    );
  }

  /**
   * Process incoming data push from Android app
   */
  processHealthConnectPush(payload: HealthConnectPushData): {
    heartRate: HeartRateData[];
    sleep: SleepData[];
    activity: ActivityData[];
    bloodOxygen: OxygenSaturationData[];
    hrv: HRVData[];
  } {
    const result = {
      heartRate: [] as HeartRateData[],
      sleep: [] as SleepData[],
      activity: [] as ActivityData[],
      bloodOxygen: [] as OxygenSaturationData[],
      hrv: [] as HRVData[],
    };

    const activityByDate: Map<string, Partial<ActivityData>> = new Map();
    const sleepSessions: Map<string, { start: Date; end: Date; stages: HealthConnectRecord['stages'] }> = new Map();

    for (const record of payload.records) {
      switch (record.recordType) {
        case HEALTH_CONNECT_TYPES.HEART_RATE:
          if (record.samples) {
            for (const sample of record.samples) {
              result.heartRate.push({
                timestamp: new Date(sample.time),
                bpm: sample.beatsPerMinute,
              });
            }
          }
          break;

        case HEALTH_CONNECT_TYPES.RESTING_HEART_RATE:
          if (record.beatsPerMinute) {
            result.heartRate.push({
              timestamp: new Date(record.startTime),
              bpm: record.beatsPerMinute,
              context: 'resting',
            });
          }
          break;

        case HEALTH_CONNECT_TYPES.HRV_RMSSD:
          if (record.heartRateVariabilityMillis) {
            result.hrv.push({
              timestamp: new Date(record.startTime),
              sdnn: record.heartRateVariabilityMillis,
            });
          }
          break;

        case HEALTH_CONNECT_TYPES.BLOOD_OXYGEN:
          if (record.percentage) {
            result.bloodOxygen.push({
              timestamp: new Date(record.startTime),
              percentage: record.percentage,
            });
          }
          break;

        case HEALTH_CONNECT_TYPES.STEPS:
          this.aggregateActivity(activityByDate, record, 'steps');
          break;

        case HEALTH_CONNECT_TYPES.DISTANCE:
          this.aggregateActivity(activityByDate, record, 'distance');
          break;

        case HEALTH_CONNECT_TYPES.CALORIES_TOTAL:
        case HEALTH_CONNECT_TYPES.CALORIES_ACTIVE:
          this.aggregateActivity(activityByDate, record, 'calories');
          break;

        case HEALTH_CONNECT_TYPES.FLOORS_CLIMBED:
          this.aggregateActivity(activityByDate, record, 'floors');
          break;

        case HEALTH_CONNECT_TYPES.SLEEP_SESSION:
          if (record.endTime) {
            sleepSessions.set(record.id, {
              start: new Date(record.startTime),
              end: new Date(record.endTime),
              stages: record.stages,
            });
          }
          break;
      }
    }

    // Convert activity map to array
    result.activity = Array.from(activityByDate.values()).map((a) => ({
      date: a.date!,
      steps: a.steps || 0,
      distance: a.distance,
      calories: a.calories,
      floorsClimbed: a.floorsClimbed,
    }));

    // Convert sleep sessions
    for (const [, session] of sleepSessions) {
      const stages = this.processSleepStages(session.stages || []);
      const totalMinutes = (session.end.getTime() - session.start.getTime()) / (1000 * 60);

      result.sleep.push({
        startTime: session.start,
        endTime: session.end,
        totalMinutes: Math.round(totalMinutes),
        stages,
        score: this.calculateSleepScore(stages, totalMinutes),
      });
    }

    return result;
  }

  /**
   * Aggregate activity data by date
   */
  private aggregateActivity(
    map: Map<string, Partial<ActivityData>>,
    record: HealthConnectRecord,
    type: 'steps' | 'distance' | 'calories' | 'floors'
  ): void {
    const dateStr = new Date(record.startTime).toISOString().split('T')[0];

    if (!map.has(dateStr)) {
      map.set(dateStr, { date: new Date(dateStr) });
    }

    const activity = map.get(dateStr)!;

    switch (type) {
      case 'steps':
        activity.steps = (activity.steps || 0) + (record.count || 0);
        break;
      case 'distance':
        activity.distance = (activity.distance || 0) + (record.distance?.inMeters || 0);
        break;
      case 'calories':
        activity.calories = (activity.calories || 0) + (record.energy?.inKilocalories || 0);
        break;
      case 'floors':
        activity.floorsClimbed = (activity.floorsClimbed || 0) + (record.floors || 0);
        break;
    }
  }

  /**
   * Process sleep stages from Health Connect
   */
  private processSleepStages(
    stages: Array<{ startTime: string; endTime: string; stage: number }>
  ): { awake: number; light: number; deep: number; rem: number } {
    const result = { awake: 0, light: 0, deep: 0, rem: 0 };

    for (const stage of stages) {
      const durationMs = new Date(stage.endTime).getTime() - new Date(stage.startTime).getTime();
      const durationMinutes = durationMs / (1000 * 60);
      const stageType = SLEEP_STAGE_MAP[stage.stage] || 'unknown';

      switch (stageType) {
        case 'awake':
        case 'awakeInBed':
        case 'outOfBed':
          result.awake += durationMinutes;
          break;
        case 'light':
        case 'sleeping':
          result.light += durationMinutes;
          break;
        case 'deep':
          result.deep += durationMinutes;
          break;
        case 'rem':
          result.rem += durationMinutes;
          break;
      }
    }

    return {
      awake: Math.round(result.awake),
      light: Math.round(result.light),
      deep: Math.round(result.deep),
      rem: Math.round(result.rem),
    };
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

    // Duration (max 25 points)
    if (hours >= 7 && hours <= 9) {
      score += 25;
    } else if (hours >= 6 && hours <= 10) {
      score += 15;
    } else if (hours >= 5) {
      score += 5;
    }

    // Deep sleep (max 15 points, ideal 15-25%)
    const deepPercent = stages.deep / totalMinutes;
    if (deepPercent >= 0.15 && deepPercent <= 0.25) {
      score += 15;
    } else if (deepPercent >= 0.1) {
      score += 8;
    }

    // REM (max 10 points, ideal 20-30%)
    const remPercent = stages.rem / totalMinutes;
    if (remPercent >= 0.2 && remPercent <= 0.3) {
      score += 10;
    } else if (remPercent >= 0.15) {
      score += 5;
    }

    return Math.min(100, Math.max(0, Math.round(score)));
  }

  /**
   * Create sync result
   */
  createSyncResult(
    processedData: {
      heartRate: HeartRateData[];
      sleep: SleepData[];
      activity: ActivityData[];
      bloodOxygen: OxygenSaturationData[];
      hrv: HRVData[];
    },
    errors: string[] = []
  ): SyncResult {
    return {
      provider: 'health_connect',
      success: errors.length === 0,
      syncedAt: new Date(),
      recordsCount: {
        heartRate: processedData.heartRate.length,
        sleep: processedData.sleep.length,
        activity: processedData.activity.length,
        bloodOxygen: processedData.bloodOxygen.length,
        temperature: 0,
        hrv: processedData.hrv.length,
        bloodPressure: 0,
        ecg: 0,
      },
      errors: errors.length > 0 ? errors : undefined,
    };
  }

  // Required interface methods (not applicable for push model)
  async exchangeCodeForTokens(_code: string): Promise<WearableAuthResult> {
    throw new Error('Health Connect uses device-based push, not OAuth');
  }

  async refreshTokens(_refreshToken: string): Promise<OAuthTokens> {
    throw new Error('Health Connect uses device-based push, not OAuth');
  }

  async revokeAccess(_accessToken: string): Promise<boolean> {
    return true;
  }

  parseWebhookPayload(payload: unknown): { userId: string; dataTypes: string[] } {
    const data = payload as HealthConnectPushData;
    const dataTypes = [...new Set(data.records.map((r) => r.recordType))];
    return {
      userId: data.patientId,
      dataTypes,
    };
  }

  async syncHealthData(
    _accessToken: string,
    _since?: Date,
    _types?: string[]
  ): Promise<SyncResult> {
    throw new Error('Health Connect data is pushed from device, not pulled');
  }

  async getHeartRate(
    _accessToken: string,
    _startDate: Date,
    _endDate: Date
  ): Promise<HeartRateData[]> {
    throw new Error('Health Connect data is pushed from device, not pulled');
  }

  async getSleep(_accessToken: string, _startDate: Date, _endDate: Date): Promise<SleepData[]> {
    throw new Error('Health Connect data is pushed from device, not pulled');
  }

  async getActivity(
    _accessToken: string,
    _startDate: Date,
    _endDate: Date
  ): Promise<ActivityData[]> {
    throw new Error('Health Connect data is pushed from device, not pulled');
  }

  async getBloodOxygen(
    _accessToken: string,
    _startDate: Date,
    _endDate: Date
  ): Promise<OxygenSaturationData[]> {
    throw new Error('Health Connect data is pushed from device, not pulled');
  }

  async getHRV(_accessToken: string, _startDate: Date, _endDate: Date): Promise<HRVData[]> {
    throw new Error('Health Connect data is pushed from device, not pulled');
  }
}

export const healthConnectProvider = new HealthConnectProvider();
