/**
 * Wearable Integration Types
 * Shared types for all wearable providers
 */

export type WearableProvider =
  | 'apple_watch'
  | 'wear_os'
  | 'google_fit'
  | 'health_connect'
  | 'fitbit'
  | 'garmin'
  | 'samsung'
  | 'withings';

export interface OAuthConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  scopes: string[];
}

export interface OAuthTokens {
  accessToken: string;
  refreshToken?: string;
  expiresAt?: Date;
  tokenType?: string;
  scope?: string;
}

export interface WearableAuthResult {
  success: boolean;
  tokens?: OAuthTokens;
  error?: string;
  deviceId?: string;
  deviceName?: string;
  deviceModel?: string;
}

export interface HealthDataPoint {
  timestamp: Date;
  value: number;
  unit: string;
  source?: string;
  metadata?: Record<string, unknown>;
}

export interface HeartRateData {
  timestamp: Date;
  bpm: number;
  context?: 'resting' | 'active' | 'workout' | 'sleep';
}

export interface BloodPressureData {
  timestamp: Date;
  systolic: number;
  diastolic: number;
  pulse?: number;
}

export interface SleepData {
  startTime: Date;
  endTime: Date;
  totalMinutes: number;
  stages?: {
    awake: number;
    light: number;
    deep: number;
    rem: number;
  };
  score?: number;
}

export interface ActivityData {
  date: Date;
  steps: number;
  distance?: number;
  calories?: number;
  activeMinutes?: number;
  floorsClimbed?: number;
}

export interface OxygenSaturationData {
  timestamp: Date;
  percentage: number;
}

export interface TemperatureData {
  timestamp: Date;
  celsius: number;
  location?: 'wrist' | 'finger' | 'ear' | 'oral';
}

export interface HRVData {
  timestamp: Date;
  sdnn: number; // Standard deviation of NN intervals
  rmssd?: number; // Root mean square of successive differences
}

export interface ECGData {
  timestamp: Date;
  samples: number[];
  sampleRate: number;
  classification?: 'normal' | 'afib' | 'inconclusive';
}

export interface SyncResult {
  provider: WearableProvider;
  success: boolean;
  syncedAt: Date;
  recordsCount: {
    heartRate: number;
    sleep: number;
    activity: number;
    bloodOxygen: number;
    temperature: number;
    hrv: number;
    bloodPressure: number;
    ecg: number;
  };
  errors?: string[];
  nextSyncToken?: string;
}

export interface WearableProviderInterface {
  provider: WearableProvider;

  // OAuth flow
  getAuthorizationUrl(state: string): string;
  exchangeCodeForTokens(code: string): Promise<WearableAuthResult>;
  refreshTokens(refreshToken: string): Promise<OAuthTokens>;
  revokeAccess(accessToken: string): Promise<boolean>;

  // Data sync
  syncHealthData(
    accessToken: string,
    since?: Date,
    types?: string[]
  ): Promise<SyncResult>;

  // Specific data types
  getHeartRate(accessToken: string, startDate: Date, endDate: Date): Promise<HeartRateData[]>;
  getSleep(accessToken: string, startDate: Date, endDate: Date): Promise<SleepData[]>;
  getActivity(accessToken: string, startDate: Date, endDate: Date): Promise<ActivityData[]>;
  getBloodOxygen(accessToken: string, startDate: Date, endDate: Date): Promise<OxygenSaturationData[]>;
  getHRV(accessToken: string, startDate: Date, endDate: Date): Promise<HRVData[]>;

  // Webhook handling
  validateWebhook(signature: string, payload: string): boolean;
  parseWebhookPayload(payload: unknown): { userId: string; dataTypes: string[] };
}

// Device capabilities by provider
export const PROVIDER_CAPABILITIES: Record<WearableProvider, string[]> = {
  apple_watch: [
    'heart_rate',
    'hrv',
    'ecg',
    'blood_oxygen',
    'sleep',
    'activity',
    'temperature',
    'respiratory_rate',
    'atrial_fibrillation',
  ],
  wear_os: [
    'heart_rate',
    'hrv',
    'sleep',
    'activity',
    'blood_oxygen',
    'stress',
  ],
  google_fit: [
    'heart_rate',
    'sleep',
    'activity',
    'blood_pressure',
    'blood_glucose',
    'weight',
    'body_fat',
  ],
  health_connect: [
    'heart_rate',
    'hrv',
    'sleep',
    'activity',
    'blood_oxygen',
    'blood_pressure',
    'respiratory_rate',
    'temperature',
    'nutrition',
  ],
  fitbit: [
    'heart_rate',
    'hrv',
    'sleep',
    'activity',
    'blood_oxygen',
    'temperature',
    'stress',
    'ecg',
  ],
  garmin: [
    'heart_rate',
    'hrv',
    'sleep',
    'activity',
    'blood_oxygen',
    'stress',
    'body_battery',
    'respiration',
  ],
  samsung: [
    'heart_rate',
    'hrv',
    'ecg',
    'blood_oxygen',
    'blood_pressure',
    'sleep',
    'activity',
    'stress',
    'body_composition',
  ],
  withings: [
    'heart_rate',
    'blood_pressure',
    'weight',
    'body_composition',
    'sleep',
    'activity',
    'temperature',
    'ecg',
  ],
};
