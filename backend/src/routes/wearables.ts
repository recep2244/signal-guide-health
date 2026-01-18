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
import type { WearableProvider } from '../services/wearables/types';
import type { WearableType } from '@prisma/client';

const router = Router();

// All routes require authentication
router.use(authenticate);

/**
 * GET /devices
 * Get all connected wearable devices for the current user's patient
 */
router.get('/devices', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.id;

    // Get patient ID for this user
    const patient = await prisma.patient.findUnique({
      where: { userId },
      select: { id: true },
    });

    if (!patient) {
      return res.status(404).json({
        status: 'error',
        message: 'Patient profile not found',
      });
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
    const providerType = req.params.provider as WearableProvider;
    const userId = req.user!.id;

    // Get patient ID
    const patient = await prisma.patient.findUnique({
      where: { userId },
      select: { id: true },
    });

    if (!patient) {
      return res.status(404).json({
        status: 'error',
        message: 'Patient profile not found',
      });
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
    const providerType = req.params.provider as WearableProvider;
    const { code, state, error: oauthError } = req.body;
    const userId = req.user!.id;

    if (oauthError) {
      return res.status(400).json({
        status: 'error',
        message: `OAuth error: ${oauthError}`,
      });
    }

    if (!code || !state) {
      return res.status(400).json({
        status: 'error',
        message: 'Missing authorization code or state',
      });
    }

    // Get patient ID
    const patient = await prisma.patient.findUnique({
      where: { userId },
      select: { id: true },
    });

    if (!patient) {
      return res.status(404).json({
        status: 'error',
        message: 'Patient profile not found',
      });
    }

    // Exchange code for tokens
    const provider = getWearableProvider(providerType);
    const result = await provider.exchangeCodeForTokens(code);

    if (!result.success || !result.tokens) {
      return res.status(400).json({
        status: 'error',
        message: result.error || 'Failed to exchange authorization code',
      });
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
    const userId = req.user!.id;

    if (!registrationToken || !provider || !deviceId) {
      return res.status(400).json({
        status: 'error',
        message: 'Missing required fields',
      });
    }

    // Get patient ID
    const patient = await prisma.patient.findUnique({
      where: { userId },
      select: { id: true },
    });

    if (!patient) {
      return res.status(404).json({
        status: 'error',
        message: 'Patient profile not found',
      });
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
        syncEndpoint: '/api/wearables/push-data',
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
      return res.status(400).json({
        status: 'error',
        message: 'Missing required fields',
      });
    }

    // Find device and verify push token
    const device = await prisma.wearableDevice.findFirst({
      where: {
        id: deviceId,
        isConnected: true,
      },
    });

    if (!device || !device.accessTokenEncrypted) {
      return res.status(404).json({
        status: 'error',
        message: 'Device not found or not connected',
      });
    }

    // Verify push token
    const storedToken = encryptionService.decrypt(device.accessTokenEncrypted);
    if (!encryptionService.secureCompare(pushToken, storedToken)) {
      return res.status(401).json({
        status: 'error',
        message: 'Invalid push token',
      });
    }

    // Process data based on provider
    let processedData;
    if (provider === 'apple_watch') {
      processedData = appleHealthKitProvider.processHeartRateSamples(data.heartRate || []);
      // Process other data types...
    } else if (provider === 'health_connect' || provider === 'wear_os') {
      processedData = healthConnectProvider.processHealthConnectPush({
        patientId: device.patientId,
        deviceId: device.id,
        deviceInfo: data.deviceInfo || {},
        records: data.records || [],
      });
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
        recordsProcessed: processedData ? Object.values(processedData).flat().length : 0,
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
    const userId = req.user!.id;

    // Get patient ID
    const patient = await prisma.patient.findUnique({
      where: { userId },
      select: { id: true },
    });

    if (!patient) {
      return res.status(404).json({
        status: 'error',
        message: 'Patient profile not found',
      });
    }

    // Find and verify ownership
    const device = await prisma.wearableDevice.findFirst({
      where: {
        id: deviceId,
        patientId: patient.id,
      },
    });

    if (!device) {
      return res.status(404).json({
        status: 'error',
        message: 'Device not found',
      });
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
    const userId = req.user!.id;

    // Get patient ID
    const patient = await prisma.patient.findUnique({
      where: { userId },
      select: { id: true },
    });

    if (!patient) {
      return res.status(404).json({
        status: 'error',
        message: 'Patient profile not found',
      });
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
      return res.status(404).json({
        status: 'error',
        message: 'Device not found or not connected',
      });
    }

    if (!isOAuthProvider(device.deviceType as WearableProvider)) {
      return res.json({
        status: 'success',
        message: 'Push-based devices sync automatically from the mobile app',
        data: { lastSync: device.lastSyncAt },
      });
    }

    // For OAuth providers, pull new data
    if (!device.accessTokenEncrypted) {
      return res.status(400).json({
        status: 'error',
        message: 'Device needs to be reconnected',
      });
    }

    const accessToken = encryptionService.decrypt(device.accessTokenEncrypted);
    const provider = getWearableProvider(device.deviceType as WearableProvider);

    // Sync from last sync time
    const since = device.lastSyncAt || new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const result = await provider.syncHealthData(accessToken, since);

    // Update last sync time
    await prisma.wearableDevice.update({
      where: { id: deviceId },
      data: { lastSyncAt: new Date() },
    });

    res.json({
      status: 'success',
      message: 'Sync completed',
      data: {
        syncedAt: result.syncedAt,
        recordsCount: result.recordsCount,
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
      const userId = req.user!.id;

      // Patients can only view their own data
      if (req.user!.role === 'patient') {
        const patient = await prisma.patient.findUnique({
          where: { userId },
          select: { id: true },
        });
        if (!patient || patient.id !== patientId) {
          return res.status(403).json({
            status: 'error',
            message: 'Access denied',
          });
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
        patientId,
        parseInt(days as string)
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
