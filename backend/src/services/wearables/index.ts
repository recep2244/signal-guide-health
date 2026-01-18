/**
 * Wearable Providers Index
 * Central export for all wearable integrations
 */

export * from './types';
export { appleHealthKitProvider } from './appleHealthKit';
export { googleFitProvider } from './googleFit';
export { healthConnectProvider } from './healthConnect';

import type { WearableProvider } from './types';
import { appleHealthKitProvider } from './appleHealthKit';
import { googleFitProvider } from './googleFit';
import { healthConnectProvider } from './healthConnect';

/**
 * Get the appropriate provider for a wearable type
 */
export function getWearableProvider(type: WearableProvider) {
  switch (type) {
    case 'apple_watch':
      return appleHealthKitProvider;
    case 'wear_os':
    case 'google_fit':
      return googleFitProvider;
    case 'health_connect':
      return healthConnectProvider;
    case 'fitbit':
    case 'garmin':
    case 'samsung':
    case 'withings':
      // These would have their own provider implementations
      throw new Error(`Provider ${type} not yet implemented`);
    default:
      throw new Error(`Unknown provider: ${type}`);
  }
}

/**
 * Check if a provider uses OAuth (pull model) or device push
 */
export function isOAuthProvider(type: WearableProvider): boolean {
  switch (type) {
    case 'google_fit':
    case 'fitbit':
    case 'garmin':
    case 'withings':
      return true;
    case 'apple_watch':
    case 'wear_os':
    case 'health_connect':
    case 'samsung':
      return false;
    default:
      return false;
  }
}

/**
 * Get supported data types for a provider
 */
export function getSupportedDataTypes(type: WearableProvider): string[] {
  const capabilities: Record<WearableProvider, string[]> = {
    apple_watch: [
      'heart_rate',
      'hrv',
      'ecg',
      'blood_oxygen',
      'sleep',
      'activity',
      'respiratory_rate',
    ],
    wear_os: ['heart_rate', 'hrv', 'sleep', 'activity', 'blood_oxygen'],
    google_fit: ['heart_rate', 'sleep', 'activity', 'blood_pressure', 'weight'],
    health_connect: [
      'heart_rate',
      'hrv',
      'sleep',
      'activity',
      'blood_oxygen',
      'blood_pressure',
      'respiratory_rate',
    ],
    fitbit: ['heart_rate', 'hrv', 'sleep', 'activity', 'blood_oxygen', 'temperature'],
    garmin: ['heart_rate', 'hrv', 'sleep', 'activity', 'blood_oxygen', 'stress'],
    samsung: ['heart_rate', 'hrv', 'ecg', 'blood_oxygen', 'blood_pressure', 'sleep', 'activity'],
    withings: ['heart_rate', 'blood_pressure', 'weight', 'sleep', 'activity', 'ecg'],
  };

  return capabilities[type] || [];
}
