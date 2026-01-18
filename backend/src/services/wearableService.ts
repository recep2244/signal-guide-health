/**
 * Wearable Service
 * Handles wearable device integration and health data processing
 */

import { prisma } from '../config/database';
import { encryptionService } from './encryptionService';
import { alertService } from './alertService';
import type { WearableType, TriageLevel, ReadingType } from '@prisma/client';

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
        type: data.type,
        deviceId: data.deviceId,
        accessToken: encryptedAccessToken,
        refreshToken: encryptedRefreshToken,
        tokenExpiresAt: data.expiresAt,
        isActive: true,
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
        isActive: false,
        accessToken: null,
        refreshToken: null,
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
        isActive: true,
      },
      select: {
        id: true,
        type: true,
        deviceId: true,
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
    // Store the reading
    const record = await prisma.wearableReading.create({
      data: {
        patientId: reading.patientId,
        wearableId: reading.wearableId,
        type: reading.type,
        value: reading.value,
        unit: reading.unit,
        metadata: reading.metadata as any,
        recordedAt: new Date(),
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
    if (analysis.triageLevel !== 'GREEN') {
      // Create alert for abnormal reading
      alertRecord = await alertService.createAlert({
        patientId: reading.patientId,
        type: 'VITALS_ABNORMAL',
        severity: analysis.triageLevel,
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
            wearableId: reading.wearableId,
            type: reading.type,
            value: reading.value,
            unit: reading.unit,
            metadata: reading.metadata as any,
            recordedAt: new Date(),
          },
        });

        const analysis = this.analyzeReading(reading);
        if (analysis.triageLevel !== 'GREEN') {
          alertCount++;
        }
      }
    });

    // Create alerts outside transaction to avoid long locks
    for (const reading of readings) {
      const analysis = this.analyzeReading(reading);
      if (analysis.triageLevel !== 'GREEN') {
        await alertService.createAlert({
          patientId: reading.patientId,
          type: 'VITALS_ABNORMAL',
          severity: analysis.triageLevel,
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
        ...(filter.type && { type: filter.type }),
        ...(filter.startDate || filter.endDate
          ? {
              recordedAt: {
                ...(filter.startDate && { gte: filter.startDate }),
                ...(filter.endDate && { lte: filter.endDate }),
              },
            }
          : {}),
      },
      orderBy: { recordedAt: 'desc' },
      take: filter.limit || 100,
      include: {
        wearable: {
          select: {
            type: true,
            deviceId: true,
          },
        },
      },
    });
  },

  /**
   * Get latest reading of each type for a patient
   */
  async getLatestReadings(patientId: string) {
    const readingTypes: ReadingType[] = [
      'HEART_RATE',
      'BLOOD_PRESSURE_SYSTOLIC',
      'BLOOD_PRESSURE_DIASTOLIC',
      'OXYGEN_SATURATION',
      'TEMPERATURE',
      'STEPS',
      'SLEEP_HOURS',
      'HRV',
    ];

    const readings: Record<string, any> = {};

    await Promise.all(
      readingTypes.map(async (type) => {
        const reading = await prisma.wearableReading.findFirst({
          where: { patientId, type },
          orderBy: { recordedAt: 'desc' },
        });
        if (reading) {
          readings[type] = reading;
        }
      })
    );

    return readings;
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
            triageLevel: 'RED',
            message: `Critical heart rate: ${value} bpm`,
            thresholds: critical,
          };
        }
        if (value < warning.low || value > warning.high) {
          return {
            triageLevel: 'AMBER',
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
            triageLevel: 'RED',
            message: `Critical systolic BP: ${value} mmHg`,
            thresholds: critical,
          };
        }
        if (value < warning.low || value > warning.high) {
          return {
            triageLevel: 'AMBER',
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
            triageLevel: 'RED',
            message: `Critical diastolic BP: ${value} mmHg`,
            thresholds: critical,
          };
        }
        if (value < warning.low || value > warning.high) {
          return {
            triageLevel: 'AMBER',
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
            triageLevel: 'RED',
            message: `Critical oxygen saturation: ${value}%`,
            thresholds: critical,
          };
        }
        if (value < warning.low) {
          return {
            triageLevel: 'AMBER',
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
            triageLevel: 'RED',
            message: `Critical temperature: ${value}°C`,
            thresholds: critical,
          };
        }
        if (value < warning.low || value > warning.high) {
          return {
            triageLevel: 'AMBER',
            message: `Abnormal temperature: ${value}°C`,
            thresholds: warning,
          };
        }
        break;
      }
    }

    return { triageLevel: 'GREEN', message: 'Normal reading' };
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
        recordedAt: { gte: startDate },
      },
      orderBy: { recordedAt: 'asc' },
    });

    const alerts: AnalysisResult['alerts'] = [];
    const trends: AnalysisResult['trends'] = {};

    // Group readings by type
    const grouped = readings.reduce((acc, r) => {
      if (!acc[r.type]) acc[r.type] = [];
      acc[r.type].push(r);
      return acc;
    }, {} as Record<string, typeof readings>);

    // Analyze heart rate trend
    if (grouped['HEART_RATE']?.length >= 2) {
      const hrReadings = grouped['HEART_RATE'];
      const firstHalf = hrReadings.slice(0, Math.floor(hrReadings.length / 2));
      const secondHalf = hrReadings.slice(Math.floor(hrReadings.length / 2));

      const firstAvg = firstHalf.reduce((s, r) => s + r.value, 0) / firstHalf.length;
      const secondAvg = secondHalf.reduce((s, r) => s + r.value, 0) / secondHalf.length;

      const change = ((secondAvg - firstAvg) / firstAvg) * 100;

      if (change > 10) {
        trends.heartRate = 'increasing';
        if (change > 20) {
          alerts.push({
            type: 'TREND',
            message: `Heart rate increasing significantly (${change.toFixed(1)}% over ${days} days)`,
            severity: 'AMBER',
          });
        }
      } else if (change < -10) {
        trends.heartRate = 'decreasing';
      } else {
        trends.heartRate = 'stable';
      }
    }

    // Determine overall triage level
    let triageLevel: TriageLevel = 'GREEN';
    if (alerts.some((a) => a.severity === 'RED')) {
      triageLevel = 'RED';
    } else if (alerts.some((a) => a.severity === 'AMBER')) {
      triageLevel = 'AMBER';
    }

    return { triageLevel, alerts, trends };
  },

  /**
   * Sync data from wearable provider
   */
  async syncFromProvider(wearableId: string): Promise<{ synced: number }> {
    const wearable = await prisma.wearableDevice.findUnique({
      where: { id: wearableId },
    });

    if (!wearable || !wearable.accessToken) {
      throw new Error('Wearable not found or not connected');
    }

    // Decrypt access token
    const accessToken = encryptionService.decrypt(wearable.accessToken);

    // In production, this would call the actual provider API
    // For now, simulate sync
    const syncedCount = await this.simulateProviderSync(wearable, accessToken);

    await prisma.wearableDevice.update({
      where: { id: wearableId },
      data: { lastSyncAt: new Date() },
    });

    return { synced: syncedCount };
  },

  /**
   * Simulate provider sync (placeholder for actual API calls)
   */
  async simulateProviderSync(
    wearable: { id: string; patientId: string; type: WearableType },
    _accessToken: string
  ): Promise<number> {
    // In production, implement actual API calls to:
    // - Apple HealthKit
    // - Fitbit API
    // - Garmin Connect API
    // - Samsung Health API

    // For demo, create sample readings
    const readings: WearableReading[] = [
      {
        patientId: wearable.patientId,
        wearableId: wearable.id,
        type: 'HEART_RATE',
        value: 72 + Math.floor(Math.random() * 10),
        unit: 'bpm',
      },
      {
        patientId: wearable.patientId,
        wearableId: wearable.id,
        type: 'STEPS',
        value: Math.floor(Math.random() * 3000) + 2000,
        unit: 'steps',
      },
    ];

    for (const reading of readings) {
      await this.recordReading(reading);
    }

    return readings.length;
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
        recordedAt: { gte: startDate },
      },
    });

    const stats: Record<string, { avg: number; min: number; max: number; count: number }> = {};

    for (const reading of readings) {
      if (!stats[reading.type]) {
        stats[reading.type] = { avg: 0, min: Infinity, max: -Infinity, count: 0 };
      }
      const s = stats[reading.type];
      s.count++;
      s.min = Math.min(s.min, reading.value);
      s.max = Math.max(s.max, reading.value);
      s.avg = s.avg + (reading.value - s.avg) / s.count;
    }

    // Round averages
    for (const key of Object.keys(stats)) {
      stats[key].avg = Math.round(stats[key].avg * 10) / 10;
      if (stats[key].min === Infinity) stats[key].min = 0;
      if (stats[key].max === -Infinity) stats[key].max = 0;
    }

    return stats;
  },
};
