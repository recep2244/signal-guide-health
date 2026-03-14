/**
 * Wearable Routes
 * Device connection, OAuth callbacks, and data sync
 */

import { Router, Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import { authenticate, requireRole } from '../middleware/auth';
import { prisma } from '../config/database';
import { encryptionService } from '../services/encryptionService';
import { wearableService } from '../services/wearableService';
import {
  getWearableProvider,
  isOAuthProvider,
  getSupportedDataTypes,
  appleHealthKitProvider,
  healthConnectProvider,
} from '../services/wearables';
import { HEALTHKIT_DATA_TYPES } from '../services/wearables/appleHealthKit';
import type { WearableProvider, WearableAuthResult } from '../services/wearables/types';
import type { WearableType } from '@prisma/client';
import { redis } from '../config/redis';

const router: Router = Router();

// All routes require authentication
router.use(authenticate);

/**
 * GET /devices
 * Get all connected wearable devices for the current user's patient
 */
router.get('/devices', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.userId;

    // Get patient ID for this user
    const patient = await prisma.patient.findUnique({
      where: { userId },
      select: { id: true },
    });

    if (!patient) {
      res.status(404).json({
        status: 'error',
        message: 'Patient profile not found',
      });
      return;
    }

    const devices = await prisma.wearableDevice.findMany({
      where: {
        patientId: patient.id,
        isConnected: true,
      },
      select: {
        id: true,
        deviceType: true,
        deviceName: true,
        deviceModel: true,
        isConnected: true,
        lastSyncAt: true,
        connectionStatus: true,
        batteryLevel: true,
        enabledMetrics: true,
        createdAt: true,
      },
    });

    res.json({
      status: 'success',
      data: { devices },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /devices/supported
 * Get list of supported wearable providers and their capabilities
 */
router.get('/devices/supported', async (_req: Request, res: Response) => {
  const providers = [
    {
      id: 'apple_watch',
      name: 'Apple Watch',
      type: 'push',
      capabilities: getSupportedDataTypes('apple_watch'),
      requiresApp: true,
      platforms: ['ios'],
    },
    {
      id: 'wear_os',
      name: 'Wear OS',
      type: 'push',
      capabilities: getSupportedDataTypes('wear_os'),
      requiresApp: true,
      platforms: ['android'],
    },
    {
      id: 'health_connect',
      name: 'Health Connect',
      type: 'push',
      capabilities: getSupportedDataTypes('health_connect'),
      requiresApp: true,
      platforms: ['android'],
    },
    {
      id: 'google_fit',
      name: 'Google Fit',
      type: 'oauth',
      capabilities: getSupportedDataTypes('google_fit'),
      requiresApp: false,
      platforms: ['android', 'web'],
    },
    {
      id: 'fitbit',
      name: 'Fitbit',
      type: 'oauth',
      capabilities: getSupportedDataTypes('fitbit'),
      requiresApp: false,
      platforms: ['ios', 'android', 'web'],
    },
    {
      id: 'garmin',
      name: 'Garmin',
      type: 'oauth',
      capabilities: getSupportedDataTypes('garmin'),
      requiresApp: false,
      platforms: ['ios', 'android', 'web'],
    },
    {
      id: 'samsung',
      name: 'Samsung Health',
      type: 'push',
      capabilities: getSupportedDataTypes('samsung'),
      requiresApp: true,
      platforms: ['android'],
    },
    {
      id: 'withings',
      name: 'Withings',
      type: 'oauth',
      capabilities: getSupportedDataTypes('withings'),
      requiresApp: false,
      platforms: ['ios', 'android', 'web'],
    },
  ];

  res.json({
    status: 'success',
    data: { providers },
  });
});

/**
 * POST /connect/:provider
 * Initiate connection to a wearable provider
 * For OAuth providers: returns authorization URL
 * For push providers: returns instructions and registration token
 */
router.post('/connect/:provider', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const providerType = req.params['provider'] as WearableProvider;
    const userId = req.user!.userId;

    // Get patient ID
    const patient = await prisma.patient.findUnique({
      where: { userId },
      select: { id: true },
    });

    if (!patient) {
      res.status(404).json({
        status: 'error',
        message: 'Patient profile not found',
      });
      return;
    }

    // Generate state for OAuth or device registration
    const state = crypto.randomBytes(16).toString('hex');

    // Store state in session/cache for verification
    // In production, use Redis or similar
    const stateData = {
      patientId: patient.id,
      provider: providerType,
      createdAt: new Date().toISOString(),
    };

    if (isOAuthProvider(providerType)) {
      // OAuth-based provider (Google Fit, Fitbit, etc.)
      try {
        const provider = getWearableProvider(providerType);
        const authUrl = provider.getAuthorizationUrl(state);

        // For Fitbit (PKCE), persist the code_verifier in Redis so the callback
        // can retrieve it even if handled by a different process instance
        if (providerType === 'fitbit') {
          const fitbitProv = provider as any;
          const codeVerifier =
            typeof fitbitProv.getCodeVerifier === 'function'
              ? (fitbitProv.getCodeVerifier(state) as string | undefined)
              : undefined;
          if (codeVerifier) {
            if (redis) {
              await redis.set(`pkce:${state}`, codeVerifier, 'EX', 600); // 10-minute TTL
            } else {
              // Redis unavailable — verifier stays in the in-memory Map on FitbitProvider
              console.warn('[OAuth] Redis unavailable — PKCE verifier stored in memory only');
            }
          }
        }

        res.json({
          status: 'success',
          data: {
            type: 'oauth',
            authUrl,
            state,
            expiresIn: 600, // 10 minutes
          },
        });
      } catch (error) {
        res.status(501).json({
          status: 'error',
          message: `Provider ${providerType} is not yet implemented`,
        });
      }
    } else {
      // Push-based provider (Apple Watch, Wear OS, Health Connect)
      const registrationToken = crypto.randomBytes(32).toString('hex');

      res.json({
        status: 'success',
        data: {
          type: 'device_push',
          registrationToken,
          provider: providerType,
          instructions: getDeviceInstructions(providerType),
          expiresIn: 3600, // 1 hour
        },
      });
    }
  } catch (error) {
    next(error);
  }
});

/**
 * POST /callback/:provider
 * Handle OAuth callback from provider
 */
router.post('/callback/:provider', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const providerType = req.params['provider'] as WearableProvider;
    const { code, state, error: oauthError } = req.body;
    const userId = req.user!.userId;

    if (oauthError) {
      res.status(400).json({
        status: 'error',
        message: `OAuth error: ${oauthError}`,
      });
      return;
    }

    if (!code || !state) {
      res.status(400).json({
        status: 'error',
        message: 'Missing authorization code or state',
      });
      return;
    }

    // Get patient ID
    const patient = await prisma.patient.findUnique({
      where: { userId },
      select: { id: true },
    });

    if (!patient) {
      res.status(404).json({
        status: 'error',
        message: 'Patient profile not found',
      });
      return;
    }

    // Exchange code for tokens
    const provider = getWearableProvider(providerType);

    // For Fitbit (PKCE), retrieve the code_verifier stored during /connect
    let result: WearableAuthResult;
    if (providerType === 'fitbit') {
      let codeVerifier: string | undefined;

      // Try Redis first (production multi-instance path)
      if (redis) {
        const stored = await redis.get(`pkce:${state}`);
        codeVerifier = stored ?? undefined;
        if (stored) {
          await redis.del(`pkce:${state}`); // single-use key
        }
      }

      // Fallback: in-memory verifier from FitbitProvider (single-instance dev)
      if (!codeVerifier) {
        const fitbitProv = provider as any;
        if (typeof fitbitProv.getCodeVerifier === 'function') {
          codeVerifier = fitbitProv.getCodeVerifier(state) as string | undefined;
        }
      }

      const fitbitProv = provider as any;
      if (codeVerifier && typeof fitbitProv.exchangeCodeForTokensWithVerifier === 'function') {
        result = await fitbitProv.exchangeCodeForTokensWithVerifier(code, codeVerifier) as WearableAuthResult;
      } else {
        result = await provider.exchangeCodeForTokens(code);
      }
    } else {
      result = await provider.exchangeCodeForTokens(code);
    }

    if (!result.success || !result.tokens) {
      res.status(400).json({
        status: 'error',
        message: result.error || 'Failed to exchange authorization code',
      });
      return;
    }

    // Encrypt tokens before storing
    const encryptedAccessToken = encryptionService.encrypt(result.tokens.accessToken);
    const encryptedRefreshToken = result.tokens.refreshToken
      ? encryptionService.encrypt(result.tokens.refreshToken)
      : null;

    // Create or update wearable device
    const device = await prisma.wearableDevice.upsert({
      where: {
        id: result.deviceId || 'new',
      },
      create: {
        patientId: patient.id,
        deviceType: providerType as WearableType,
        deviceName: result.deviceName || providerType,
        deviceModel: result.deviceModel,
        isConnected: true,
        connectionStatus: 'connected',
        accessTokenEncrypted: encryptedAccessToken,
        refreshTokenEncrypted: encryptedRefreshToken,
        tokenExpiresAt: result.tokens.expiresAt,
        lastSyncAt: new Date(),
      },
      update: {
        isConnected: true,
        connectionStatus: 'connected',
        accessTokenEncrypted: encryptedAccessToken,
        refreshTokenEncrypted: encryptedRefreshToken,
        tokenExpiresAt: result.tokens.expiresAt,
        lastSyncAt: new Date(),
      },
    });

    res.json({
      status: 'success',
      message: 'Device connected successfully',
      data: {
        deviceId: device.id,
        deviceType: device.deviceType,
        deviceName: device.deviceName,
      },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /register-device
 * Register a push-based device (Apple Watch, Wear OS)
 */
router.post('/register-device', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const {
      registrationToken,
      provider,
      deviceId,
      deviceName,
      deviceModel,
      manufacturer,
      osVersion,
    } = req.body;
    const userId = req.user!.userId;

    if (!registrationToken || !provider || !deviceId) {
      res.status(400).json({
        status: 'error',
        message: 'Missing required fields',
      });
      return;
    }

    // Get patient ID
    const patient = await prisma.patient.findUnique({
      where: { userId },
      select: { id: true },
    });

    if (!patient) {
      res.status(404).json({
        status: 'error',
        message: 'Patient profile not found',
      });
      return;
    }

    // Generate device push token
    const pushToken = crypto.randomBytes(32).toString('hex');
    const encryptedPushToken = encryptionService.encrypt(pushToken);

    // Create wearable device
    const device = await prisma.wearableDevice.create({
      data: {
        patientId: patient.id,
        deviceType: provider as WearableType,
        deviceName: deviceName || `${manufacturer} ${deviceModel}`,
        deviceModel,
        serialNumber: deviceId,
        isConnected: true,
        connectionStatus: 'connected',
        accessTokenEncrypted: encryptedPushToken,
        lastSyncAt: new Date(),
        firmwareVersion: osVersion,
      },
    });

    res.json({
      status: 'success',
      message: 'Device registered successfully',
      data: {
        deviceId: device.id,
        pushToken, // Send back unencrypted for device to use
        syncEndpoint: '/api/v1/wearables/push-data',
      },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /push-data
 * Receive health data from push-based devices (Apple Watch, Wear OS)
 */
router.post('/push-data', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { deviceId, pushToken, provider, data } = req.body;

    if (!deviceId || !pushToken || !provider || !data) {
      res.status(400).json({
        status: 'error',
        message: 'Missing required fields',
      });
      return;
    }

    // Find device and verify push token
    const device = await prisma.wearableDevice.findFirst({
      where: {
        id: deviceId,
        isConnected: true,
      },
    });

    if (!device || !device.accessTokenEncrypted) {
      res.status(404).json({
        status: 'error',
        message: 'Device not found or not connected',
      });
      return;
    }

    // Verify push token
    const storedToken = encryptionService.decrypt(device.accessTokenEncrypted);
    if (!encryptionService.secureCompare(pushToken, storedToken)) {
      res.status(401).json({
        status: 'error',
        message: 'Invalid push token',
      });
      return;
    }

    // Process data based on provider and persist each reading via recordReading()
    // recordReading() internally calls analyzeReading() and creates an Alert if a threshold is exceeded
    let recordsStored = 0;

    if (provider === 'apple_watch') {
      const { dataType, samples } = data as { dataType: string; samples: any[] };

      switch (dataType) {
        case HEALTHKIT_DATA_TYPES.HEART_RATE:
        case HEALTHKIT_DATA_TYPES.RESTING_HEART_RATE: {
          const hrSamples = appleHealthKitProvider.processHeartRateSamples(samples);
          // Aggregate to daily average to match WearableReading flat schema
          const avgBpm = hrSamples.length > 0
            ? Math.round(hrSamples.reduce((s, r) => s + r.bpm, 0) / hrSamples.length)
            : 0;
          if (avgBpm > 0) {
            await wearableService.recordReading({
              patientId: device.patientId,
              wearableId: device.id,
              type: 'HEART_RATE',
              value: avgBpm,
              unit: 'bpm',
              metadata: { source: 'apple_watch', dataType, sampleCount: hrSamples.length },
            });
            recordsStored++;
          }
          break;
        }
        case HEALTHKIT_DATA_TYPES.BLOOD_OXYGEN: {
          const spo2Samples = appleHealthKitProvider.processBloodOxygenSamples(samples);
          const avgSpO2 = spo2Samples.length > 0
            ? Math.round(spo2Samples.reduce((s, r) => s + r.percentage, 0) / spo2Samples.length * 10) / 10
            : 0;
          if (avgSpO2 > 0) {
            await wearableService.recordReading({
              patientId: device.patientId,
              wearableId: device.id,
              type: 'OXYGEN_SATURATION',
              value: avgSpO2,
              unit: '%',
              metadata: { source: 'apple_watch', dataType, sampleCount: spo2Samples.length },
            });
            recordsStored++;
          }
          break;
        }
        case HEALTHKIT_DATA_TYPES.BODY_TEMPERATURE: {
          // Apple Watch Series 8+ measures wrist temperature — map to TEMPERATURE type
          // Samples have value in Celsius (HealthKit: HKUnit degreesCelsius)
          const tempValues = samples.map((s: any) =>
            typeof s.value === 'number' ? s.value : parseFloat(s.value)
          ).filter((v: number) => !isNaN(v));
          const avgTemp = tempValues.length > 0
            ? Math.round(tempValues.reduce((s: number, v: number) => s + v, 0) / tempValues.length * 10) / 10
            : 0;
          if (avgTemp > 0) {
            await wearableService.recordReading({
              patientId: device.patientId,
              wearableId: device.id,
              type: 'TEMPERATURE',
              value: avgTemp,
              unit: '°C',
              metadata: { source: 'apple_watch', dataType, sampleCount: tempValues.length },
            });
            recordsStored++;
          }
          break;
        }
        case HEALTHKIT_DATA_TYPES.STEP_COUNT: {
          const activityData = appleHealthKitProvider.processActivitySamples(samples, dataType);
          const totalSteps = activityData.reduce((s, a) => s + a.steps, 0);
          if (totalSteps > 0) {
            await wearableService.recordReading({
              patientId: device.patientId,
              wearableId: device.id,
              type: 'STEPS',
              value: totalSteps,
              unit: 'steps',
              metadata: { source: 'apple_watch', dataType, sampleCount: samples.length },
            });
            recordsStored++;
          }
          break;
        }
        case HEALTHKIT_DATA_TYPES.HEART_RATE_VARIABILITY: {
          const hrvData = appleHealthKitProvider.processHRVSamples(samples);
          const avgHrv = hrvData.length > 0
            ? Math.round(hrvData.reduce((s, r) => s + r.sdnn, 0) / hrvData.length)
            : 0;
          if (avgHrv > 0) {
            await wearableService.recordReading({
              patientId: device.patientId,
              wearableId: device.id,
              type: 'HRV',
              value: avgHrv,
              unit: 'ms',
              metadata: { source: 'apple_watch', dataType, sampleCount: samples.length },
            });
            recordsStored++;
          }
          break;
        }
        // Blood pressure: Apple Watch has NO BP sensor — intentionally omitted
        // See WEAR-02 research note: Apple Watch hardware gap for BP
        default:
          // Unsupported or unmapped data type — ignore silently
          break;
      }
    } else if (provider === 'health_connect' || provider === 'wear_os') {
      const processed = healthConnectProvider.processHealthConnectPush({
        patientId: device.patientId,
        deviceId: device.id,
        deviceInfo: data.deviceInfo || {},
        records: data.records || [],
      });

      // Persist heart rate — average all HR samples to one reading
      if (processed.heartRate.length > 0) {
        const avgBpm = Math.round(
          processed.heartRate.reduce((s, r) => s + r.bpm, 0) / processed.heartRate.length
        );
        await wearableService.recordReading({
          patientId: device.patientId,
          wearableId: device.id,
          type: 'HEART_RATE',
          value: avgBpm,
          unit: 'bpm',
          metadata: { source: provider, sampleCount: processed.heartRate.length },
        });
        recordsStored++;
      }

      // Persist blood oxygen — average SpO2 samples
      if (processed.bloodOxygen.length > 0) {
        const avgSpO2 = Math.round(
          processed.bloodOxygen.reduce((s, r) => s + r.percentage, 0) / processed.bloodOxygen.length * 10
        ) / 10;
        await wearableService.recordReading({
          patientId: device.patientId,
          wearableId: device.id,
          type: 'OXYGEN_SATURATION',
          value: avgSpO2,
          unit: '%',
          metadata: { source: provider, sampleCount: processed.bloodOxygen.length },
        });
        recordsStored++;
      }

      // Persist steps — sum across all activity entries
      const totalSteps = processed.activity.reduce((s, a) => s + a.steps, 0);
      if (totalSteps > 0) {
        await wearableService.recordReading({
          patientId: device.patientId,
          wearableId: device.id,
          type: 'STEPS',
          value: totalSteps,
          unit: 'steps',
          metadata: { source: provider, sampleCount: processed.activity.length },
        });
        recordsStored++;
      }

      // Persist HRV
      if (processed.hrv.length > 0) {
        const avgHrv = Math.round(
          processed.hrv.reduce((s, r) => s + r.sdnn, 0) / processed.hrv.length
        );
        await wearableService.recordReading({
          patientId: device.patientId,
          wearableId: device.id,
          type: 'HRV',
          value: avgHrv,
          unit: 'ms',
          metadata: { source: provider, sampleCount: processed.hrv.length },
        });
        recordsStored++;
      }
    }

    // Update last sync time
    await prisma.wearableDevice.update({
      where: { id: deviceId },
      data: { lastSyncAt: new Date() },
    });

    res.json({
      status: 'success',
      message: 'Data received',
      data: {
        recordsProcessed: recordsStored,
      },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * DELETE /disconnect/:deviceId
 * Disconnect a wearable device
 */
router.delete('/disconnect/:deviceId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { deviceId } = req.params;
    const userId = req.user!.userId;

    // Get patient ID
    const patient = await prisma.patient.findUnique({
      where: { userId },
      select: { id: true },
    });

    if (!patient) {
      res.status(404).json({
        status: 'error',
        message: 'Patient profile not found',
      });
      return;
    }

    // Find and verify ownership
    const device = await prisma.wearableDevice.findFirst({
      where: {
        id: deviceId,
        patientId: patient.id,
      },
    });

    if (!device) {
      res.status(404).json({
        status: 'error',
        message: 'Device not found',
      });
      return;
    }

    // Revoke access if OAuth provider
    if (device.accessTokenEncrypted && isOAuthProvider(device.deviceType as WearableProvider)) {
      try {
        const token = encryptionService.decrypt(device.accessTokenEncrypted);
        const provider = getWearableProvider(device.deviceType as WearableProvider);
        await provider.revokeAccess(token);
      } catch {
        // Continue even if revocation fails
      }
    }

    // Update device status
    await prisma.wearableDevice.update({
      where: { id: deviceId },
      data: {
        isConnected: false,
        connectionStatus: 'disconnected',
        accessTokenEncrypted: null,
        refreshTokenEncrypted: null,
      },
    });

    res.json({
      status: 'success',
      message: 'Device disconnected',
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /sync/:deviceId
 * Trigger manual sync for a device
 */
router.post('/sync/:deviceId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { deviceId } = req.params;
    const userId = req.user!.userId;

    // Get patient ID
    const patient = await prisma.patient.findUnique({
      where: { userId },
      select: { id: true },
    });

    if (!patient) {
      res.status(404).json({
        status: 'error',
        message: 'Patient profile not found',
      });
      return;
    }

    // Find device
    const device = await prisma.wearableDevice.findFirst({
      where: {
        id: deviceId,
        patientId: patient.id,
        isConnected: true,
      },
    });

    if (!device) {
      res.status(404).json({
        status: 'error',
        message: 'Device not found or not connected',
      });
      return;
    }

    if (!isOAuthProvider(device.deviceType as WearableProvider)) {
      res.json({
        status: 'success',
        message: 'Push-based devices sync automatically from the mobile app',
        data: { lastSync: device.lastSyncAt },
      });
      return;
    }

    // For OAuth providers, pull new data
    if (!device.accessTokenEncrypted) {
      res.status(400).json({
        status: 'error',
        message: 'Device needs to be reconnected',
      });
      return;
    }

    // Route through wearableService.syncFromProvider() — calls syncHealthDataWithContext()
    // which persists readings via recordReading() and fires threshold alerts
    const result = await wearableService.syncFromProvider(deviceId as string);

    res.json({
      status: 'success',
      message: 'Sync completed',
      data: {
        syncedAt: new Date(),
        recordsCount: result.synced,
      },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /readings/:patientId
 * Get wearable readings for a patient (doctor/nurse access)
 */
router.get(
  '/readings/:patientId',
  requireRole('doctor', 'nurse', 'admin'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { patientId } = req.params;
      const { type, startDate, endDate, limit = '100' } = req.query;

      const readings = await prisma.wearableReading.findMany({
        where: {
          patientId,
          ...(startDate || endDate
            ? {
                readingDate: {
                  ...(startDate && { gte: new Date(startDate as string) }),
                  ...(endDate && { lte: new Date(endDate as string) }),
                },
              }
            : {}),
        },
        orderBy: { readingDate: 'desc' },
        take: parseInt(limit as string),
        include: {
          device: {
            select: {
              deviceType: true,
              deviceName: true,
            },
          },
        },
      });

      res.json({
        status: 'success',
        data: { readings },
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /readings/:patientId/latest
 * Get latest readings for each metric type
 */
router.get(
  '/readings/:patientId/latest',
  requireRole('doctor', 'nurse', 'admin', 'patient'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { patientId } = req.params;
      const userId = req.user!.userId;

      // Patients can only view their own data
      if (req.user!.role === 'patient') {
        const patient = await prisma.patient.findUnique({
          where: { userId },
          select: { id: true },
        });
        if (!patient || patient.id !== patientId) {
          res.status(403).json({
            status: 'error',
            message: 'Access denied',
          });
          return;
        }
      }

      // Get latest reading for each date
      const latestReading = await prisma.wearableReading.findFirst({
        where: { patientId },
        orderBy: { readingDate: 'desc' },
      });

      res.json({
        status: 'success',
        data: { latest: latestReading },
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /readings/:patientId/trends
 * Get trend analysis for a patient
 */
router.get(
  '/readings/:patientId/trends',
  requireRole('doctor', 'nurse', 'admin'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { patientId } = req.params;
      const { days = '7' } = req.query;

      const trends = await wearableService.analyzePatientTrends(
        patientId!,
        parseInt((days ?? '7') as string)
      );

      res.json({
        status: 'success',
        data: { trends },
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * Get device connection instructions
 */
function getDeviceInstructions(provider: WearableProvider): string {
  switch (provider) {
    case 'apple_watch':
      return `
1. Download the CardioWatch app from the App Store
2. Open the app and sign in with your CardioWatch account
3. Go to Settings > Connect Devices > Apple Watch
4. Follow the prompts to grant HealthKit access
5. Your Apple Watch data will automatically sync
      `.trim();

    case 'wear_os':
    case 'health_connect':
      return `
1. Download the CardioWatch app from the Google Play Store
2. Open the app and sign in with your CardioWatch account
3. Go to Settings > Connect Devices > Wear OS / Health Connect
4. Grant the requested health data permissions
5. Your watch data will automatically sync
      `.trim();

    case 'samsung':
      return `
1. Download the CardioWatch app from the Galaxy Store or Play Store
2. Open the app and sign in with your CardioWatch account
3. Go to Settings > Connect Devices > Samsung Health
4. Grant the requested permissions in Samsung Health
5. Your Galaxy Watch data will automatically sync
      `.trim();

    default:
      return 'Please follow the in-app instructions to connect your device.';
  }
}

export default router;
