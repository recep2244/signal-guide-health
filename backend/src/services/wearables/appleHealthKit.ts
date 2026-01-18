/**
 * Apple HealthKit Integration
 * Handles data sync from Apple Watch via HealthKit
 *
 * Note: Apple HealthKit data is primarily accessed through the iOS app,
 * which pushes data to our backend. This service handles:
 * 1. Receiving data pushed from the iOS companion app
 * 2. Processing and storing HealthKit data
 * 3. Webhook validation for background delivery
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
  ECGData,
} from './types';
import { env } from '../../config/env';

// HealthKit data types we're interested in
export const HEALTHKIT_DATA_TYPES = {
  // Vitals
  HEART_RATE: 'HKQuantityTypeIdentifierHeartRate',
  RESTING_HEART_RATE: 'HKQuantityTypeIdentifierRestingHeartRate',
  WALKING_HEART_RATE_AVG: 'HKQuantityTypeIdentifierWalkingHeartRateAverage',
  HEART_RATE_VARIABILITY: 'HKQuantityTypeIdentifierHeartRateVariabilitySDNN',
  BLOOD_OXYGEN: 'HKQuantityTypeIdentifierOxygenSaturation',
  RESPIRATORY_RATE: 'HKQuantityTypeIdentifierRespiratoryRate',
  BODY_TEMPERATURE: 'HKQuantityTypeIdentifierBodyTemperature',

  // Cardiac
  ECG: 'HKElectrocardiogramType',
  ATRIAL_FIBRILLATION: 'HKCategoryTypeIdentifierHighHeartRateEvent',
  IRREGULAR_RHYTHM: 'HKCategoryTypeIdentifierIrregularHeartRhythmEvent',

  // Activity
  STEP_COUNT: 'HKQuantityTypeIdentifierStepCount',
  DISTANCE_WALKING_RUNNING: 'HKQuantityTypeIdentifierDistanceWalkingRunning',
  FLIGHTS_CLIMBED: 'HKQuantityTypeIdentifierFlightsClimbed',
  ACTIVE_ENERGY_BURNED: 'HKQuantityTypeIdentifierActiveEnergyBurned',
  EXERCISE_TIME: 'HKQuantityTypeIdentifierAppleExerciseTime',
  STAND_TIME: 'HKQuantityTypeIdentifierAppleStandTime',

  // Sleep
  SLEEP_ANALYSIS: 'HKCategoryTypeIdentifierSleepAnalysis',

  // Workouts
  WORKOUT: 'HKWorkoutType',
} as const;

// Sleep stage mapping from HealthKit
const SLEEP_STAGE_MAP: Record<number, string> = {
  0: 'inBed',
  1: 'asleepUnspecified',
  2: 'awake',
  3: 'asleepCore', // Light sleep
  4: 'asleepDeep',
  5: 'asleepREM',
};

interface HealthKitPushData {
  userId: string;
  deviceId: string;
  dataType: string;
  samples: HealthKitSample[];
  syncToken?: string;
}

interface HealthKitSample {
  uuid: string;
  startDate: string;
  endDate: string;
  value: number | string | Record<string, unknown>;
  unit?: string;
  metadata?: Record<string, unknown>;
  device?: {
    name: string;
    model: string;
    manufacturer: string;
    hardwareVersion?: string;
    softwareVersion?: string;
  };
}

interface ECGSample {
  uuid: string;
  startDate: string;
  endDate: string;
  classification: number;
  averageHeartRate: number;
  samplingFrequency: number;
  voltageMeasurements: number[];
  symptoms?: string[];
}

export class AppleHealthKitProvider implements Partial<WearableProviderInterface> {
  readonly provider = 'apple_watch' as const;

  private webhookSecret: string;

  constructor() {
    this.webhookSecret = env.APPLE_WEBHOOK_SECRET || '';
  }

  /**
   * Apple HealthKit doesn't use OAuth - it uses device-based authorization
   * The iOS app handles authorization locally, then pushes data to our server
   */
  getAuthorizationUrl(_state: string): string {
    // Not applicable - authorization happens on device
    throw new Error(
      'Apple HealthKit authorization is handled on the iOS device. ' +
      'Users must grant permission in the CardioWatch iOS app.'
    );
  }

  /**
   * Register a device that will push HealthKit data
   */
  async registerDevice(
    patientId: string,
    deviceInfo: {
      deviceId: string;
      deviceName: string;
      deviceModel: string;
      osVersion: string;
    }
  ): Promise<WearableAuthResult> {
    // Generate a unique push token for this device
    const pushToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(pushToken).digest('hex');

    return {
      success: true,
      tokens: {
        accessToken: pushToken,
        tokenType: 'device_push',
      },
      deviceId: deviceInfo.deviceId,
      deviceName: deviceInfo.deviceName,
      deviceModel: deviceInfo.deviceModel,
    };
  }

  /**
   * Validate incoming webhook from iOS app
   */
  validateWebhook(signature: string, payload: string): boolean {
    if (!this.webhookSecret) {
      console.warn('Apple webhook secret not configured');
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
   * Parse incoming data push from iOS app
   */
  parseHealthKitPush(payload: HealthKitPushData): {
    userId: string;
    deviceId: string;
    dataTypes: string[];
    samples: Map<string, HealthKitSample[]>;
  } {
    const samples = new Map<string, HealthKitSample[]>();
    samples.set(payload.dataType, payload.samples);

    return {
      userId: payload.userId,
      deviceId: payload.deviceId,
      dataTypes: [payload.dataType],
      samples,
    };
  }

  /**
   * Process heart rate samples from HealthKit
   */
  processHeartRateSamples(samples: HealthKitSample[]): HeartRateData[] {
    return samples.map((sample) => ({
      timestamp: new Date(sample.startDate),
      bpm: typeof sample.value === 'number' ? sample.value : parseFloat(sample.value as string),
      context: this.determineHeartRateContext(sample),
    }));
  }

  /**
   * Determine heart rate context from sample metadata
   */
  private determineHeartRateContext(
    sample: HealthKitSample
  ): 'resting' | 'active' | 'workout' | 'sleep' | undefined {
    const metadata = sample.metadata || {};

    if (metadata.HKHeartRateMotionContext === 1) {
      return 'active';
    }
    if (metadata.HKHeartRateMotionContext === 2) {
      return 'resting';
    }
    if (metadata.HKMetadataKeyWasUserEntered) {
      return undefined;
    }

    // Check if during sleep based on time
    const hour = new Date(sample.startDate).getHours();
    if (hour >= 22 || hour <= 6) {
      return 'sleep';
    }

    return undefined;
  }

  /**
   * Process sleep samples from HealthKit
   */
  processSleepSamples(samples: HealthKitSample[]): SleepData[] {
    // Group samples by sleep session
    const sessions: Map<string, HealthKitSample[]> = new Map();

    for (const sample of samples) {
      const sessionDate = new Date(sample.startDate).toDateString();
      if (!sessions.has(sessionDate)) {
        sessions.set(sessionDate, []);
      }
      sessions.get(sessionDate)!.push(sample);
    }

    const sleepData: SleepData[] = [];

    for (const [, sessionSamples] of sessions) {
      // Sort by start time
      sessionSamples.sort(
        (a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime()
      );

      const stages = { awake: 0, light: 0, deep: 0, rem: 0 };
      let totalMinutes = 0;

      for (const sample of sessionSamples) {
        const durationMs =
          new Date(sample.endDate).getTime() - new Date(sample.startDate).getTime();
        const durationMinutes = durationMs / (1000 * 60);

        const stageValue = typeof sample.value === 'number' ? sample.value : parseInt(sample.value as string);
        const stage = SLEEP_STAGE_MAP[stageValue] || 'unknown';

        switch (stage) {
          case 'awake':
            stages.awake += durationMinutes;
            break;
          case 'asleepCore':
            stages.light += durationMinutes;
            totalMinutes += durationMinutes;
            break;
          case 'asleepDeep':
            stages.deep += durationMinutes;
            totalMinutes += durationMinutes;
            break;
          case 'asleepREM':
            stages.rem += durationMinutes;
            totalMinutes += durationMinutes;
            break;
          case 'asleepUnspecified':
          case 'inBed':
            stages.light += durationMinutes;
            totalMinutes += durationMinutes;
            break;
        }
      }

      if (sessionSamples.length > 0) {
        sleepData.push({
          startTime: new Date(sessionSamples[0].startDate),
          endTime: new Date(sessionSamples[sessionSamples.length - 1].endDate),
          totalMinutes: Math.round(totalMinutes),
          stages: {
            awake: Math.round(stages.awake),
            light: Math.round(stages.light),
            deep: Math.round(stages.deep),
            rem: Math.round(stages.rem),
          },
          score: this.calculateSleepScore(stages, totalMinutes),
        });
      }
    }

    return sleepData;
  }

  /**
   * Calculate sleep score based on stages
   */
  private calculateSleepScore(
    stages: { awake: number; light: number; deep: number; rem: number },
    totalMinutes: number
  ): number {
    if (totalMinutes === 0) return 0;

    // Ideal percentages
    const idealDeep = 0.2; // 20%
    const idealRem = 0.25; // 25%
    const idealLight = 0.55; // 55%

    const actualDeep = stages.deep / totalMinutes;
    const actualRem = stages.rem / totalMinutes;
    const actualLight = stages.light / totalMinutes;

    // Score based on how close to ideal
    let score = 50; // Base score

    // Deep sleep contribution (max 20 points)
    score += Math.max(0, 20 - Math.abs(actualDeep - idealDeep) * 100);

    // REM contribution (max 20 points)
    score += Math.max(0, 20 - Math.abs(actualRem - idealRem) * 80);

    // Duration contribution (max 10 points for 7-9 hours)
    const hours = totalMinutes / 60;
    if (hours >= 7 && hours <= 9) {
      score += 10;
    } else if (hours >= 6 && hours <= 10) {
      score += 5;
    }

    return Math.min(100, Math.max(0, Math.round(score)));
  }

  /**
   * Process activity samples from HealthKit
   */
  processActivitySamples(
    samples: HealthKitSample[],
    dataType: string
  ): ActivityData[] {
    // Group by date
    const byDate: Map<string, Partial<ActivityData>> = new Map();

    for (const sample of samples) {
      const dateStr = new Date(sample.startDate).toISOString().split('T')[0];
      if (!byDate.has(dateStr)) {
        byDate.set(dateStr, { date: new Date(dateStr) });
      }

      const activity = byDate.get(dateStr)!;
      const value = typeof sample.value === 'number' ? sample.value : parseFloat(sample.value as string);

      switch (dataType) {
        case HEALTHKIT_DATA_TYPES.STEP_COUNT:
          activity.steps = (activity.steps || 0) + value;
          break;
        case HEALTHKIT_DATA_TYPES.DISTANCE_WALKING_RUNNING:
          activity.distance = (activity.distance || 0) + value;
          break;
        case HEALTHKIT_DATA_TYPES.ACTIVE_ENERGY_BURNED:
          activity.calories = (activity.calories || 0) + value;
          break;
        case HEALTHKIT_DATA_TYPES.EXERCISE_TIME:
          activity.activeMinutes = (activity.activeMinutes || 0) + value;
          break;
        case HEALTHKIT_DATA_TYPES.FLIGHTS_CLIMBED:
          activity.floorsClimbed = (activity.floorsClimbed || 0) + value;
          break;
      }
    }

    return Array.from(byDate.values()).map((a) => ({
      date: a.date!,
      steps: Math.round(a.steps || 0),
      distance: a.distance ? Math.round(a.distance) : undefined,
      calories: a.calories ? Math.round(a.calories) : undefined,
      activeMinutes: a.activeMinutes ? Math.round(a.activeMinutes) : undefined,
      floorsClimbed: a.floorsClimbed,
    }));
  }

  /**
   * Process blood oxygen samples
   */
  processBloodOxygenSamples(samples: HealthKitSample[]): OxygenSaturationData[] {
    return samples.map((sample) => ({
      timestamp: new Date(sample.startDate),
      percentage:
        typeof sample.value === 'number'
          ? sample.value * 100 // HealthKit stores as decimal (0.98 = 98%)
          : parseFloat(sample.value as string) * 100,
    }));
  }

  /**
   * Process HRV samples
   */
  processHRVSamples(samples: HealthKitSample[]): HRVData[] {
    return samples.map((sample) => ({
      timestamp: new Date(sample.startDate),
      sdnn: typeof sample.value === 'number' ? sample.value : parseFloat(sample.value as string),
    }));
  }

  /**
   * Process ECG samples (Apple Watch Series 4+)
   */
  processECGSamples(samples: ECGSample[]): ECGData[] {
    const classificationMap: Record<number, 'normal' | 'afib' | 'inconclusive'> = {
      1: 'normal', // Sinus rhythm
      2: 'afib', // Atrial fibrillation
      3: 'inconclusive', // Low heart rate
      4: 'inconclusive', // High heart rate
      5: 'inconclusive', // Inconclusive
      6: 'inconclusive', // Poor reading
    };

    return samples.map((sample) => ({
      timestamp: new Date(sample.startDate),
      samples: sample.voltageMeasurements,
      sampleRate: sample.samplingFrequency,
      classification: classificationMap[sample.classification] || 'inconclusive',
    }));
  }

  /**
   * Get sync result summary
   */
  createSyncResult(
    processedData: {
      heartRate?: HeartRateData[];
      sleep?: SleepData[];
      activity?: ActivityData[];
      bloodOxygen?: OxygenSaturationData[];
      hrv?: HRVData[];
      ecg?: ECGData[];
    },
    errors: string[] = []
  ): SyncResult {
    return {
      provider: 'apple_watch',
      success: errors.length === 0,
      syncedAt: new Date(),
      recordsCount: {
        heartRate: processedData.heartRate?.length || 0,
        sleep: processedData.sleep?.length || 0,
        activity: processedData.activity?.length || 0,
        bloodOxygen: processedData.bloodOxygen?.length || 0,
        temperature: 0,
        hrv: processedData.hrv?.length || 0,
        bloodPressure: 0,
        ecg: processedData.ecg?.length || 0,
      },
      errors: errors.length > 0 ? errors : undefined,
    };
  }

  // Required interface methods (not applicable for Apple HealthKit push model)
  async exchangeCodeForTokens(_code: string): Promise<WearableAuthResult> {
    throw new Error('Apple HealthKit uses device-based push, not OAuth');
  }

  async refreshTokens(_refreshToken: string): Promise<OAuthTokens> {
    throw new Error('Apple HealthKit uses device-based push, not OAuth');
  }

  async revokeAccess(_accessToken: string): Promise<boolean> {
    // Revocation happens on device
    return true;
  }

  async getHeartRate(
    _accessToken: string,
    _startDate: Date,
    _endDate: Date
  ): Promise<HeartRateData[]> {
    throw new Error('Apple HealthKit data is pushed from device, not pulled');
  }

  async getSleep(_accessToken: string, _startDate: Date, _endDate: Date): Promise<SleepData[]> {
    throw new Error('Apple HealthKit data is pushed from device, not pulled');
  }

  async getActivity(
    _accessToken: string,
    _startDate: Date,
    _endDate: Date
  ): Promise<ActivityData[]> {
    throw new Error('Apple HealthKit data is pushed from device, not pulled');
  }

  async getBloodOxygen(
    _accessToken: string,
    _startDate: Date,
    _endDate: Date
  ): Promise<OxygenSaturationData[]> {
    throw new Error('Apple HealthKit data is pushed from device, not pulled');
  }

  async getHRV(_accessToken: string, _startDate: Date, _endDate: Date): Promise<HRVData[]> {
    throw new Error('Apple HealthKit data is pushed from device, not pulled');
  }

  parseWebhookPayload(payload: unknown): { userId: string; dataTypes: string[] } {
    const data = payload as HealthKitPushData;
    return {
      userId: data.userId,
      dataTypes: [data.dataType],
    };
  }

  async syncHealthData(
    _accessToken: string,
    _since?: Date,
    _types?: string[]
  ): Promise<SyncResult> {
    throw new Error('Apple HealthKit data is pushed from device, not pulled');
  }
}

export const appleHealthKitProvider = new AppleHealthKitProvider();
