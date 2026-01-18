/**
 * Webhook Routes
 * External service callbacks (WhatsApp, Wearables, Health Platforms)
 */

import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import { logger } from '../utils/logger';
import { prisma } from '../config/database';
import { appleHealthKitProvider } from '../services/wearables/appleHealthKit';
import { healthConnectProvider } from '../services/wearables/healthConnect';

const router = Router();

// =============================================================================
// WHATSAPP WEBHOOKS
// =============================================================================

// WhatsApp webhook verification (GET)
router.get('/whatsapp', (req: Request, res: Response) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  if (mode === 'subscribe' && token === process.env.WHATSAPP_WEBHOOK_SECRET) {
    logger.info({ message: 'WhatsApp webhook verified' });
    res.status(200).send(challenge);
  } else {
    res.sendStatus(403);
  }
});

// WhatsApp incoming messages (POST)
router.post('/whatsapp', (req: Request, res: Response) => {
  const signature = req.headers['x-hub-signature-256'] as string;
  if (!signature) {
    res.sendStatus(401);
    return;
  }

  const expectedSignature =
    'sha256=' +
    crypto
      .createHmac('sha256', process.env.WHATSAPP_WEBHOOK_SECRET || '')
      .update(JSON.stringify(req.body))
      .digest('hex');

  if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature))) {
    logger.warn({ message: 'Invalid WhatsApp webhook signature' });
    res.sendStatus(401);
    return;
  }

  // Process message (queue for async processing)
  logger.info({ message: 'WhatsApp message received', body: req.body });

  // Always respond 200 quickly
  res.sendStatus(200);
});

// =============================================================================
// APPLE HEALTHKIT WEBHOOKS
// =============================================================================

/**
 * Apple HealthKit data push from iOS app
 * The iOS companion app pushes HealthKit data to this endpoint
 */
router.post('/apple-health', async (req: Request, res: Response) => {
  try {
    const signature = req.headers['x-apple-signature'] as string;
    const payload = JSON.stringify(req.body);

    // Validate webhook signature
    if (!appleHealthKitProvider.validateWebhook(signature || '', payload)) {
      logger.warn({ message: 'Invalid Apple HealthKit webhook signature' });
      res.sendStatus(401);
      return;
    }

    const { userId, deviceId, dataType, samples, syncToken } = req.body;

    if (!userId || !deviceId || !dataType || !samples) {
      res.status(400).json({ error: 'Missing required fields' });
      return;
    }

    logger.info({
      message: 'Apple HealthKit data received',
      userId,
      deviceId,
      dataType,
      sampleCount: samples?.length || 0,
    });

    // Find the wearable device
    const device = await prisma.wearableDevice.findFirst({
      where: {
        serialNumber: deviceId,
        deviceType: 'apple_watch',
        isConnected: true,
      },
      include: {
        patient: true,
      },
    });

    if (!device) {
      res.status(404).json({ error: 'Device not found' });
      return;
    }

    // Process different data types
    let processedCount = 0;

    switch (dataType) {
      case 'heart_rate':
        const heartRateData = appleHealthKitProvider.processHeartRateSamples(samples);
        // Store in database
        for (const hr of heartRateData) {
          await prisma.wearableReading.upsert({
            where: {
              id: `${device.patientId}-${hr.timestamp.toISOString()}-hr`,
            },
            create: {
              id: `${device.patientId}-${hr.timestamp.toISOString()}-hr`,
              patientId: device.patientId,
              deviceId: device.id,
              readingDate: hr.timestamp,
              restingHeartRate: hr.context === 'resting' ? hr.bpm : null,
              avgHeartRate: hr.bpm,
            },
            update: {
              avgHeartRate: hr.bpm,
              restingHeartRate: hr.context === 'resting' ? hr.bpm : undefined,
            },
          });
          processedCount++;
        }
        break;

      case 'sleep':
        const sleepData = appleHealthKitProvider.processSleepSamples(samples);
        for (const sleep of sleepData) {
          await prisma.wearableReading.upsert({
            where: {
              id: `${device.patientId}-${sleep.startTime.toISOString().split('T')[0]}-sleep`,
            },
            create: {
              id: `${device.patientId}-${sleep.startTime.toISOString().split('T')[0]}-sleep`,
              patientId: device.patientId,
              deviceId: device.id,
              readingDate: sleep.startTime,
              sleepHours: sleep.totalMinutes / 60,
              deepSleepHours: sleep.stages ? sleep.stages.deep / 60 : null,
              lightSleepHours: sleep.stages ? sleep.stages.light / 60 : null,
              remSleepHours: sleep.stages ? sleep.stages.rem / 60 : null,
              sleepScore: sleep.score,
            },
            update: {
              sleepHours: sleep.totalMinutes / 60,
              deepSleepHours: sleep.stages ? sleep.stages.deep / 60 : undefined,
              lightSleepHours: sleep.stages ? sleep.stages.light / 60 : undefined,
              remSleepHours: sleep.stages ? sleep.stages.rem / 60 : undefined,
              sleepScore: sleep.score,
            },
          });
          processedCount++;
        }
        break;

      case 'blood_oxygen':
        const oxygenData = appleHealthKitProvider.processBloodOxygenSamples(samples);
        for (const oxygen of oxygenData) {
          await prisma.wearableReading.upsert({
            where: {
              id: `${device.patientId}-${oxygen.timestamp.toISOString()}-spo2`,
            },
            create: {
              id: `${device.patientId}-${oxygen.timestamp.toISOString()}-spo2`,
              patientId: device.patientId,
              deviceId: device.id,
              readingDate: oxygen.timestamp,
              bloodOxygenPercent: oxygen.percentage,
            },
            update: {
              bloodOxygenPercent: oxygen.percentage,
            },
          });
          processedCount++;
        }
        break;

      case 'hrv':
        const hrvData = appleHealthKitProvider.processHRVSamples(samples);
        for (const hrv of hrvData) {
          await prisma.wearableReading.upsert({
            where: {
              id: `${device.patientId}-${hrv.timestamp.toISOString()}-hrv`,
            },
            create: {
              id: `${device.patientId}-${hrv.timestamp.toISOString()}-hrv`,
              patientId: device.patientId,
              deviceId: device.id,
              readingDate: hrv.timestamp,
              hrvMs: Math.round(hrv.sdnn),
            },
            update: {
              hrvMs: Math.round(hrv.sdnn),
            },
          });
          processedCount++;
        }
        break;

      default:
        logger.info({ message: `Unhandled Apple HealthKit data type: ${dataType}` });
    }

    // Update device last sync time
    await prisma.wearableDevice.update({
      where: { id: device.id },
      data: { lastSyncAt: new Date() },
    });

    res.json({
      success: true,
      processed: processedCount,
      nextSyncToken: syncToken,
    });
  } catch (error) {
    logger.error({ message: 'Apple HealthKit webhook error', error });
    res.status(500).json({ error: 'Internal server error' });
  }
});

// =============================================================================
// ANDROID HEALTH CONNECT WEBHOOKS
// =============================================================================

/**
 * Health Connect / Wear OS data push from Android app
 */
router.post('/health-connect', async (req: Request, res: Response) => {
  try {
    const signature = req.headers['x-health-connect-signature'] as string;
    const payload = JSON.stringify(req.body);

    // Validate webhook signature
    if (!healthConnectProvider.validateWebhook(signature || '', payload)) {
      logger.warn({ message: 'Invalid Health Connect webhook signature' });
      res.sendStatus(401);
      return;
    }

    const { patientId, deviceId, deviceInfo, records, changeToken } = req.body;

    if (!patientId || !deviceId || !records) {
      res.status(400).json({ error: 'Missing required fields' });
      return;
    }

    logger.info({
      message: 'Health Connect data received',
      patientId,
      deviceId,
      recordCount: records?.length || 0,
    });

    // Find the wearable device
    const device = await prisma.wearableDevice.findFirst({
      where: {
        serialNumber: deviceId,
        deviceType: { in: ['wear_os', 'health_connect'] },
        isConnected: true,
      },
    });

    if (!device) {
      res.status(404).json({ error: 'Device not found' });
      return;
    }

    // Process Health Connect records
    const processedData = healthConnectProvider.processHealthConnectPush({
      patientId: device.patientId,
      deviceId: device.id,
      deviceInfo: deviceInfo || {},
      records,
    });

    let totalProcessed = 0;

    // Store heart rate data
    for (const hr of processedData.heartRate) {
      await prisma.wearableReading.upsert({
        where: {
          id: `${device.patientId}-${hr.timestamp.toISOString()}-hr`,
        },
        create: {
          id: `${device.patientId}-${hr.timestamp.toISOString()}-hr`,
          patientId: device.patientId,
          deviceId: device.id,
          readingDate: hr.timestamp,
          avgHeartRate: hr.bpm,
          restingHeartRate: hr.context === 'resting' ? hr.bpm : null,
        },
        update: {
          avgHeartRate: hr.bpm,
        },
      });
      totalProcessed++;
    }

    // Store sleep data
    for (const sleep of processedData.sleep) {
      const dateKey = sleep.startTime.toISOString().split('T')[0];
      await prisma.wearableReading.upsert({
        where: {
          id: `${device.patientId}-${dateKey}-sleep`,
        },
        create: {
          id: `${device.patientId}-${dateKey}-sleep`,
          patientId: device.patientId,
          deviceId: device.id,
          readingDate: sleep.startTime,
          sleepHours: sleep.totalMinutes / 60,
          deepSleepHours: sleep.stages.deep / 60,
          lightSleepHours: sleep.stages.light / 60,
          remSleepHours: sleep.stages.rem / 60,
          sleepScore: sleep.score,
        },
        update: {
          sleepHours: sleep.totalMinutes / 60,
          deepSleepHours: sleep.stages.deep / 60,
          lightSleepHours: sleep.stages.light / 60,
          remSleepHours: sleep.stages.rem / 60,
          sleepScore: sleep.score,
        },
      });
      totalProcessed++;
    }

    // Store activity data
    for (const activity of processedData.activity) {
      const dateKey = activity.date.toISOString().split('T')[0];
      await prisma.wearableReading.upsert({
        where: {
          id: `${device.patientId}-${dateKey}-activity`,
        },
        create: {
          id: `${device.patientId}-${dateKey}-activity`,
          patientId: device.patientId,
          deviceId: device.id,
          readingDate: activity.date,
          steps: activity.steps,
          distanceMeters: activity.distance,
          caloriesBurned: activity.calories,
          floorsClimbed: activity.floorsClimbed,
        },
        update: {
          steps: activity.steps,
          distanceMeters: activity.distance,
          caloriesBurned: activity.calories,
          floorsClimbed: activity.floorsClimbed,
        },
      });
      totalProcessed++;
    }

    // Store blood oxygen data
    for (const oxygen of processedData.bloodOxygen) {
      await prisma.wearableReading.upsert({
        where: {
          id: `${device.patientId}-${oxygen.timestamp.toISOString()}-spo2`,
        },
        create: {
          id: `${device.patientId}-${oxygen.timestamp.toISOString()}-spo2`,
          patientId: device.patientId,
          deviceId: device.id,
          readingDate: oxygen.timestamp,
          bloodOxygenPercent: oxygen.percentage,
        },
        update: {
          bloodOxygenPercent: oxygen.percentage,
        },
      });
      totalProcessed++;
    }

    // Store HRV data
    for (const hrv of processedData.hrv) {
      await prisma.wearableReading.upsert({
        where: {
          id: `${device.patientId}-${hrv.timestamp.toISOString()}-hrv`,
        },
        create: {
          id: `${device.patientId}-${hrv.timestamp.toISOString()}-hrv`,
          patientId: device.patientId,
          deviceId: device.id,
          readingDate: hrv.timestamp,
          hrvMs: Math.round(hrv.sdnn),
        },
        update: {
          hrvMs: Math.round(hrv.sdnn),
        },
      });
      totalProcessed++;
    }

    // Update device last sync time
    await prisma.wearableDevice.update({
      where: { id: device.id },
      data: { lastSyncAt: new Date() },
    });

    res.json({
      success: true,
      processed: totalProcessed,
      nextChangeToken: changeToken,
    });
  } catch (error) {
    logger.error({ message: 'Health Connect webhook error', error });
    res.status(500).json({ error: 'Internal server error' });
  }
});

// =============================================================================
// GOOGLE FIT WEBHOOKS (via Cloud Pub/Sub)
// =============================================================================

/**
 * Google Fit uses Cloud Pub/Sub for notifications
 * This endpoint receives push messages from Pub/Sub
 */
router.post('/google-fit', async (req: Request, res: Response) => {
  try {
    // Verify Pub/Sub token
    const token = req.query.token as string;
    if (token !== process.env.GOOGLE_PUBSUB_TOKEN) {
      res.sendStatus(403);
      return;
    }

    const message = req.body.message;
    if (!message) {
      res.sendStatus(400);
      return;
    }

    // Decode Pub/Sub message
    const data = JSON.parse(Buffer.from(message.data, 'base64').toString());

    logger.info({
      message: 'Google Fit notification received',
      userId: data.userId,
      dataTypes: data.dataTypeName,
    });

    // Queue sync job for this user
    // In production, use a job queue like Bull/BullMQ
    // For now, log and acknowledge
    res.sendStatus(200);
  } catch (error) {
    logger.error({ message: 'Google Fit webhook error', error });
    res.sendStatus(500);
  }
});

// =============================================================================
// FITBIT WEBHOOKS
// =============================================================================

// Fitbit webhook verification
router.get('/fitbit', (req: Request, res: Response) => {
  const verify = req.query.verify as string;
  if (verify === process.env.FITBIT_VERIFY_CODE) {
    res.status(204).send();
  } else {
    res.status(404).send();
  }
});

// Fitbit data updates
router.post('/fitbit', async (req: Request, res: Response) => {
  try {
    // Verify signature
    const signature = req.headers['x-fitbit-signature'] as string;
    const expectedSignature = crypto
      .createHmac('sha256', process.env.FITBIT_CLIENT_SECRET || '')
      .update(JSON.stringify(req.body) + '&')
      .digest('base64');

    if (signature !== expectedSignature) {
      logger.warn({ message: 'Invalid Fitbit webhook signature' });
      res.sendStatus(401);
      return;
    }

    logger.info({
      message: 'Fitbit webhook received',
      updates: req.body,
    });

    // Process each notification
    for (const notification of req.body) {
      // Queue sync for each user/data type
      logger.info({
        message: 'Fitbit update',
        ownerId: notification.ownerId,
        collectionType: notification.collectionType,
        date: notification.date,
      });
    }

    res.sendStatus(204);
  } catch (error) {
    logger.error({ message: 'Fitbit webhook error', error });
    res.sendStatus(500);
  }
});

// =============================================================================
// GARMIN WEBHOOKS
// =============================================================================

// Garmin Push API
router.post('/garmin', async (req: Request, res: Response) => {
  try {
    // Garmin uses OAuth 1.0 signature verification
    // Implementation depends on Garmin Health API setup

    logger.info({
      message: 'Garmin webhook received',
      body: req.body,
    });

    // Process Garmin data
    // Queue for async processing

    res.sendStatus(200);
  } catch (error) {
    logger.error({ message: 'Garmin webhook error', error });
    res.sendStatus(500);
  }
});

// =============================================================================
// WITHINGS WEBHOOKS
// =============================================================================

router.post('/withings', async (req: Request, res: Response) => {
  try {
    const { userid, startdate, enddate, appli } = req.body;

    logger.info({
      message: 'Withings webhook received',
      userId: userid,
      appli, // Data type: 1=weight, 4=BP, 16=activity, 44=sleep
    });

    // Queue data sync for this user

    res.sendStatus(200);
  } catch (error) {
    logger.error({ message: 'Withings webhook error', error });
    res.sendStatus(500);
  }
});

// =============================================================================
// SAMSUNG HEALTH WEBHOOKS
// =============================================================================

router.post('/samsung-health', async (req: Request, res: Response) => {
  try {
    // Samsung Health uses similar push model to Apple HealthKit
    const signature = req.headers['x-samsung-signature'] as string;

    logger.info({
      message: 'Samsung Health webhook received',
      body: req.body,
    });

    // Process Samsung Health data

    res.sendStatus(200);
  } catch (error) {
    logger.error({ message: 'Samsung Health webhook error', error });
    res.sendStatus(500);
  }
});

export default router;
