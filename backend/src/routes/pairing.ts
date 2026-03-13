/**
 * Device Pairing Routes
 * Generates time-limited tokens for wearable device linking
 */
import { Router, Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import { z } from 'zod';
import { authenticate, requireRole } from '../middleware/auth';
import { prisma } from '../config/database';
import { WearableType } from '@prisma/client';

const router: Router = Router();
router.use(authenticate);

// Use the WearableType enum values for Zod validation — keeps device type consistent with WearableDevice.
// Do NOT introduce a separate PairingDeviceType enum.
const WEARABLE_TYPE_VALUES = Object.values(WearableType) as [WearableType, ...WearableType[]];

const generateSchema = z.object({
  patientId: z.string().uuid(),
  deviceType: z.enum(WEARABLE_TYPE_VALUES).optional(),
});

const confirmSchema = z.object({
  token: z.string().optional(),
  shortCode: z.string().regex(/^\d{6}$/).optional(),
  deviceType: z.enum(WEARABLE_TYPE_VALUES).optional(),
  deviceName: z.string().optional(),
}).refine(d => d.token || d.shortCode, { message: 'token or shortCode required' });

/**
 * POST /pairing/generate
 * Creates a 15-min pairing token + 6-digit short code; returns QR payload.
 * IDOR guard: patient-role callers may only generate tokens for their own patient record.
 */
router.post('/generate', requireRole('doctor', 'nurse', 'admin', 'patient'), async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { patientId, deviceType } = generateSchema.parse(req.body);

    // IDOR ownership check: patients may only pair their own record
    if (req.user?.role === 'patient') {
      const ownRecord = await prisma.patient.findFirst({
        where: { id: patientId, userId: req.user.userId },
      });
      if (!ownRecord) {
        res.status(403).json({ status: 'error', message: 'Forbidden: patient ID does not belong to this user' });
        return;
      }
    }

    const token = crypto.randomBytes(32).toString('hex');
    const shortCode = String(Math.floor(100000 + Math.random() * 900000));
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000);

    await prisma.pairingToken.create({
      data: { patientId, token, shortCode, expiresAt, deviceType: deviceType ?? null },
    });

    const qrPayload = `cardiowatch://pair?token=${token}&pid=${patientId}`;

    res.status(201).json({
      status: 'success',
      data: { token, shortCode, qrPayload, expiresAt },
    });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /pairing/confirm
 * Validates token OR shortCode, creates WearableDevice, marks token used.
 * Returns 400 if token is expired or already used.
 */
router.post('/confirm', requireRole('doctor', 'nurse', 'admin', 'patient'), async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const body = confirmSchema.parse(req.body);
    const now = new Date();

    const pairingToken = await prisma.pairingToken.findFirst({
      where: {
        usedAt: null,
        expiresAt: { gt: now },
        ...(body.token ? { token: body.token } : { shortCode: body.shortCode }),
      },
    });

    if (!pairingToken) {
      res.status(400).json({ status: 'error', message: 'Invalid or expired pairing code' });
      return;
    }

    const deviceType = body.deviceType ?? pairingToken.deviceType ?? WearableType.apple_watch;

    const [device] = await prisma.$transaction([
      prisma.wearableDevice.create({
        data: {
          patientId: pairingToken.patientId,
          deviceType,
          deviceName: body.deviceName ?? 'Paired Device',
          isConnected: true,
          connectionStatus: 'connected',
        },
      }),
      prisma.pairingToken.update({
        where: { id: pairingToken.id },
        data: { usedAt: now },
      }),
    ]);

    res.json({ status: 'success', data: { device } });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /pairing/status/:patientId
 * Returns all connected wearable devices for a patient.
 */
router.get('/status/:patientId', requireRole('doctor', 'nurse', 'admin', 'patient'), async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { patientId } = req.params;
    const devices = await prisma.wearableDevice.findMany({
      where: { patientId, isConnected: true },
      orderBy: { createdAt: 'desc' },
    });
    res.json({ status: 'success', data: { devices } });
  } catch (err) {
    next(err);
  }
});

/**
 * DELETE /pairing/device/:deviceId
 * Unpair (soft-disconnect) a wearable device.
 */
router.delete('/device/:deviceId', requireRole('doctor', 'nurse', 'admin'), async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { deviceId } = req.params;
    const device = await prisma.wearableDevice.findUnique({ where: { id: deviceId } });
    if (!device) {
      res.status(404).json({ status: 'error', message: 'Device not found' });
      return;
    }
    await prisma.wearableDevice.update({
      where: { id: deviceId },
      data: { isConnected: false, connectionStatus: 'disconnected' },
    });
    res.json({ status: 'success', message: 'Device unpaired' });
  } catch (err) {
    next(err);
  }
});

export default router;
