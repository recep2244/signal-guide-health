/**
 * Wearable Service
 * Handles wearable device integration and health data processing
 */

import { prisma } from '../config/database';
import { encryptionService } from './encryptionService';
import { alertService } from './alertService';
import { getWearableProvider, isOAuthProvider } from './wearables';
import type { WearableProvider } from './wearables/types';
import type { WearableType, TriageLevel, AlertSeverity } from '@prisma/client';

// Local ReadingType definition (not in Prisma schema)
type ReadingType =
  | 'HEART_RATE'
  | 'BLOOD_PRESSURE_SYSTOLIC'
  | 'BLOOD_PRESSURE_DIASTOLIC'
  | 'OXYGEN_SATURATION'
  | 'TEMPERATURE'
  | 'STEPS'
  | 'SLEEP_HOURS'
  | 'HRV';

// Thresholds for health metrics
const THRESHOLDS = {
  heartRate: {
    critical: { low: 40, high: 150 },
    warning: { low: 50, high: 120 },
  },
  bloodPressure: {
    systolic: {
      critical: { low: 80, high: 180 },
      warning: { low: 90, high: 140 },
    },
    diastolic: {
      critical: { low: 50, high: 120 },
      warning: { low: 60, high: 90 },
    },
  },
  oxygenSaturation: {
    critical: { low: 90 },
    warning: { low: 94 },
  },
  temperature: {
    critical: { low: 35, high: 40 },
    warning: { low: 36, high: 38.5 },
  },
};

interface WearableReading {
  patientId: string;
  wearableId: string;
  type: ReadingType;
  value: number;
  unit: string;
  readingDate?: Date;
  metadata?: Record<string, unknown>;
}

interface WearableConnection {
  patientId: string;
  type: WearableType;
  deviceId: string;
  accessToken: string;
  refreshToken?: string;
  expiresAt?: Date;
}

interface ReadingsFilter {
  patientId: string;
  type?: ReadingType;
  startDate?: Date;
  endDate?: Date;
  limit?: number;
}

interface AnalysisResult {
  triageLevel: TriageLevel;
  alerts: Array<{
    type: string;
    message: string;
    severity: TriageLevel;
  }>;
  trends: {
    heartRate?: 'increasing' | 'decreasing' | 'stable';
    bloodPressure?: 'increasing' | 'decreasing' | 'stable';
  };
}

/**
 * Map a ReadingType + value to the correct WearableReading schema column(s)
 */
function mapReadingToColumns(type: ReadingType, value: number): Record<string, number> {
  const map: Record<ReadingType, string> = {
    HEART_RATE: 'avgHeartRate',
    BLOOD_PRESSURE_SYSTOLIC: 'bloodPressureSystolic',
    BLOOD_PRESSURE_DIASTOLIC: 'bloodPressureDiastolic',
    OXYGEN_SATURATION: 'bloodOxygenPercent',
    TEMPERATURE: 'bodyTemperature',
    STEPS: 'steps',
    SLEEP_HOURS: 'sleepHours',
    HRV: 'hrvMs',
  };
  return { [map[type]]: value };
}

/**
 * Map TriageLevel to AlertSeverity for alert creation
 */
function triageLevelToSeverity(level: TriageLevel): AlertSeverity {
  if (level === 'red') return 'critical';
  if (level === 'amber') return 'high';
  return 'medium';
}

export const wearableService = {
  /**
   * Connect a wearable device
   */
  async connectDevice(data: WearableConnection): Promise<{ id: string }> {
    // Encrypt sensitive tokens
    const encryptedAccessToken = encryptionService.encrypt(data.accessToken);
    const encryptedRefreshToken = data.refreshToken
      ? encryptionService.encrypt(data.refreshToken)
      : null;

    const wearable = await prisma.wearableDevice.create({
      data: {
        patientId: data.patientId,
        deviceType: data.type,
        serialNumber: data.deviceId,
        accessTokenEncrypted: encryptedAccessToken,
        refreshTokenEncrypted: encryptedRefreshToken,
        tokenExpiresAt: data.expiresAt,
        isConnected: true,
        lastSyncAt: new Date(),
      },
    });

    return { id: wearable.id };
  },

  /**
   * Disconnect a wearable device
   */
  async disconnectDevice(wearableId: string, patientId: string): Promise<void> {
    await prisma.wearableDevice.updateMany({
      where: {
        id: wearableId,
        patientId,
      },
      data: {
        isConnected: false,
        accessTokenEncrypted: null,
        refreshTokenEncrypted: null,
      },
    });
  },

  /**
   * Get patient's connected wearables
   */
  async getPatientWearables(patientId: string) {
    return prisma.wearableDevice.findMany({
      where: {
        patientId,
        isConnected: true,
      },
      select: {
        id: true,
        deviceType: true,
        lastSyncAt: true,
        batteryLevel: true,
        firmwareVersion: true,
        createdAt: true,
      },
    });
  },

  /**
   * Record a wearable reading
   */
  async recordReading(reading: WearableReading): Promise<{ id: string; alert?: { id: string } }> {
    // Store the reading mapped to the flat schema columns
    const record = await prisma.wearableReading.create({
      data: {
        patientId: reading.patientId,
        deviceId: reading.wearableId,
        readingDate: reading.readingDate ?? new Date(),
        rawData: reading.metadata as any,
        ...mapReadingToColumns(reading.type, reading.value),
      },
    });

    // Update last sync time
    await prisma.wearableDevice.update({
      where: { id: reading.wearableId },
      data: { lastSyncAt: new Date() },
    });

    // Analyze reading for anomalies
    const analysis = this.analyzeReading(reading);

    let alertRecord;
    if (analysis.triageLevel !== 'green') {
      // Create alert for abnormal reading
      alertRecord = await alertService.createAlert({
        patientId: reading.patientId,
        type: 'vital_signs',
        severity: triageLevelToSeverity(analysis.triageLevel),
        title: `Abnormal ${reading.type.toLowerCase()} reading`,
        message: analysis.message,
        metadata: {
          readingId: record.id,
          value: reading.value,
          unit: reading.unit,
          thresholds: analysis.thresholds,
        },
      });
    }

    return {
      id: record.id,
      alert: alertRecord ? { id: alertRecord.id } : undefined,
    };
  },

  /**
   * Batch record multiple readings
   */
  async recordBatchReadings(readings: WearableReading[]): Promise<{ count: number; alerts: number }> {
    let alertCount = 0;

    // Process readings in transaction
    await prisma.$transaction(async (tx) => {
      for (const reading of readings) {
        await tx.wearableReading.create({
          data: {
            patientId: reading.patientId,
            deviceId: reading.wearableId,
            readingDate: new Date(),
            rawData: reading.metadata as any,
            ...mapReadingToColumns(reading.type, reading.value),
          },
        });

        const analysis = this.analyzeReading(reading);
        if (analysis.triageLevel !== 'green') {
          alertCount++;
        }
      }
    });

    // Create alerts outside transaction to avoid long locks
    for (const reading of readings) {
      const analysis = this.analyzeReading(reading);
      if (analysis.triageLevel !== 'green') {
        await alertService.createAlert({
          patientId: reading.patientId,
          type: 'vital_signs',
          severity: triageLevelToSeverity(analysis.triageLevel),
          title: `Abnormal ${reading.type.toLowerCase()} reading`,
          message: analysis.message,
          metadata: { value: reading.value, unit: reading.unit },
        });
      }
    }

    return { count: readings.length, alerts: alertCount };
  },

  /**
   * Get readings for a patient
   */
  async getReadings(filter: ReadingsFilter) {
    return prisma.wearableReading.findMany({
      where: {
        patientId: filter.patientId,
        ...(filter.startDate || filter.endDate
          ? {
              readingDate: {
                ...(filter.startDate && { gte: filter.startDate }),
                ...(filter.endDate && { lte: filter.endDate }),
              },
            }
          : {}),
      },
      orderBy: { readingDate: 'desc' },
      take: filter.limit || 100,
      include: {
        device: {
          select: {
            deviceType: true,
          },
        },
      },
    });
  },

  /**
   * Get latest reading for a patient (flat schema — returns most recent row)
   */
  async getLatestReadings(patientId: string) {
    return prisma.wearableReading.findFirst({
      where: { patientId },
      orderBy: { readingDate: 'desc' },
    });
  },

  /**
   * Analyze a reading for anomalies
   */
  analyzeReading(reading: WearableReading): {
    triageLevel: TriageLevel;
    message: string;
    thresholds?: { low?: number; high?: number };
  } {
    const { type, value } = reading;

    switch (type) {
      case 'HEART_RATE': {
        const { critical, warning } = THRESHOLDS.heartRate;
        if (value < critical.low || value > critical.high) {
          return {
            triageLevel: 'red',
            message: `Critical heart rate: ${value} bpm`,
            thresholds: critical,
          };
        }
        if (value < warning.low || value > warning.high) {
          return {
            triageLevel: 'amber',
            message: `Elevated heart rate: ${value} bpm`,
            thresholds: warning,
          };
        }
        break;
      }

      case 'BLOOD_PRESSURE_SYSTOLIC': {
        const { critical, warning } = THRESHOLDS.bloodPressure.systolic;
        if (value < critical.low || value > critical.high) {
          return {
            triageLevel: 'red',
            message: `Critical systolic BP: ${value} mmHg`,
            thresholds: critical,
          };
        }
        if (value < warning.low || value > warning.high) {
          return {
            triageLevel: 'amber',
            message: `Elevated systolic BP: ${value} mmHg`,
            thresholds: warning,
          };
        }
        break;
      }

      case 'BLOOD_PRESSURE_DIASTOLIC': {
        const { critical, warning } = THRESHOLDS.bloodPressure.diastolic;
        if (value < critical.low || value > critical.high) {
          return {
            triageLevel: 'red',
            message: `Critical diastolic BP: ${value} mmHg`,
            thresholds: critical,
          };
        }
        if (value < warning.low || value > warning.high) {
          return {
            triageLevel: 'amber',
            message: `Elevated diastolic BP: ${value} mmHg`,
            thresholds: warning,
          };
        }
        break;
      }

      case 'OXYGEN_SATURATION': {
        const { critical, warning } = THRESHOLDS.oxygenSaturation;
        if (value < critical.low) {
          return {
            triageLevel: 'red',
            message: `Critical oxygen saturation: ${value}%`,
            thresholds: critical,
          };
        }
        if (value < warning.low) {
          return {
            triageLevel: 'amber',
            message: `Low oxygen saturation: ${value}%`,
            thresholds: warning,
          };
        }
        break;
      }

      case 'TEMPERATURE': {
        const { critical, warning } = THRESHOLDS.temperature;
        if (value < critical.low || value > critical.high) {
          return {
            triageLevel: 'red',
            message: `Critical temperature: ${value}°C`,
            thresholds: critical,
          };
        }
        if (value < warning.low || value > warning.high) {
          return {
            triageLevel: 'amber',
            message: `Abnormal temperature: ${value}°C`,
            thresholds: warning,
          };
        }
        break;
      }
    }

    return { triageLevel: 'green', message: 'Normal reading' };
  },

  /**
   * Analyze patient health trends
   */
  async analyzePatientTrends(patientId: string, days = 7): Promise<AnalysisResult> {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const readings = await prisma.wearableReading.findMany({
      where: {
        patientId,
        readingDate: { gte: startDate },
      },
      orderBy: { readingDate: 'asc' },
    });

    const alerts: AnalysisResult['alerts'] = [];
    const trends: AnalysisResult['trends'] = {};

    // Analyze heart rate trend using avgHeartRate column
    const hrReadings = readings.filter((r) => r.avgHeartRate !== null && r.avgHeartRate !== undefined);
    if (hrReadings.length >= 2) {
      const firstHalf = hrReadings.slice(0, Math.floor(hrReadings.length / 2));
      const secondHalf = hrReadings.slice(Math.floor(hrReadings.length / 2));

      const firstAvg = firstHalf.reduce((s, r) => s + (r.avgHeartRate as number), 0) / firstHalf.length;
      const secondAvg = secondHalf.reduce((s, r) => s + (r.avgHeartRate as number), 0) / secondHalf.length;

      const change = ((secondAvg - firstAvg) / firstAvg) * 100;

      if (change > 10) {
        trends.heartRate = 'increasing';
        if (change > 20) {
          alerts.push({
            type: 'TREND',
            message: `Heart rate increasing significantly (${change.toFixed(1)}% over ${days} days)`,
            severity: 'amber',
          });
        }
      } else if (change < -10) {
        trends.heartRate = 'decreasing';
      } else {
        trends.heartRate = 'stable';
      }
    }

    // Determine overall triage level
    let triageLevel: TriageLevel = 'green';
    if (alerts.some((a) => a.severity === 'red')) {
      triageLevel = 'red';
    } else if (alerts.some((a) => a.severity === 'amber')) {
      triageLevel = 'amber';
    }

    return { triageLevel, alerts, trends };
  },

  /**
   * Sync data from wearable provider using real provider APIs.
   * Garmin and push-based devices are excluded — they use push/webhook flows.
   */
  async syncFromProvider(wearableId: string): Promise<{ synced: number }> {
    const wearable = await prisma.wearableDevice.findUnique({
      where: { id: wearableId },
    });

    if (!wearable || !wearable.accessTokenEncrypted) {
      throw new Error('Wearable not found or not connected');
    }

    // Garmin is push-only via webhook — no on-demand pull sync
    if (wearable.deviceType === 'garmin') {
      return { synced: 0 };
    }

    // Push-based devices (Apple Watch, Wear OS, Health Connect) sync via /push-data route
    if (!isOAuthProvider(wearable.deviceType as WearableProvider)) {
      return { synced: 0 };
    }

    const accessToken = encryptionService.decrypt(wearable.accessTokenEncrypted);
    const provider = getWearableProvider(wearable.deviceType as WearableProvider);
    const since = wearable.lastSyncAt || new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    // Use context-aware sync if available (Fitbit, Withings) — calls recordReading() internally
    const providerAny = provider as any;
    let totalSynced = 0;

    if (typeof providerAny.syncHealthDataWithContext === 'function') {
      const syncResult = await providerAny.syncHealthDataWithContext(
        accessToken,
        since,
        wearable.patientId,
        wearable.id
      );
      totalSynced = Object.values(syncResult.recordsCount as Record<string, number>).reduce(
        (s: number, n: number) => s + n,
        0
      );
    } else {
      // Fallback: call standard syncHealthData (counts only, no DB writes)
      const syncResult = await provider.syncHealthData(accessToken, since);
      totalSynced = Object.values(syncResult.recordsCount).reduce(
        (s: number, n: unknown) => s + (n as number),
        0
      );
    }

    await prisma.wearableDevice.update({
      where: { id: wearableId },
      data: { lastSyncAt: new Date() },
    });

    return { synced: totalSynced };
  },

  /**
   * Get wearable statistics
   */
  async getStatistics(patientId: string, days = 30) {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const readings = await prisma.wearableReading.findMany({
      where: {
        patientId,
        readingDate: { gte: startDate },
      },
    });

    const METRIC_COLUMNS = [
      'avgHeartRate',
      'steps',
      'bloodOxygenPercent',
      'bodyTemperature',
      'bloodPressureSystolic',
      'bloodPressureDiastolic',
    ] as const;
    type MetricColumn = typeof METRIC_COLUMNS[number];

    const stats: Record<string, { avg: number; min: number; max: number; count: number }> = {};

    for (const reading of readings) {
      for (const col of METRIC_COLUMNS) {
        const val = reading[col];
        if (val === null || val === undefined) continue;
        const numVal = typeof val === 'object' ? parseFloat((val as object).toString()) : (val as number);
        if (!stats[col]) {
          stats[col] = { avg: 0, min: Infinity, max: -Infinity, count: 0 };
        }
        const s = stats[col]!;
        s.count++;
        s.min = Math.min(s.min, numVal);
        s.max = Math.max(s.max, numVal);
        s.avg = s.avg + (numVal - s.avg) / s.count;
      }
    }

    // Round averages
    for (const key of Object.keys(stats)) {
      const s = stats[key]!;
      s.avg = Math.round(s.avg * 10) / 10;
      if (s.min === Infinity) s.min = 0;
      if (s.max === -Infinity) s.max = 0;
    }

    return stats;
  },
};
