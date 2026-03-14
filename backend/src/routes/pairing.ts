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
import rateLimit from 'express-rate-limit';
import { authenticator } from 'otplib';

const router: Router = Router();
router.use(authenticate);

const confirmRateLimit = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { status: 'error', message: 'Too many confirm attempts. Try again in 5 minutes.' },
});

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
  totpCode: z.string().regex(/^\d{6}$/).optional(),
  deviceType: z.enum(WEARABLE_TYPE_VALUES).optional(),
  deviceName: z.string().optional(),
}).refine(d => d.token || d.shortCode || d.totpCode, { message: 'token, shortCode, or totpCode required' });

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

    // Derive a stable base32 TOTP secret from the token's first 20 bytes
    const tokenBytes = Buffer.from(token.substring(0, 40), 'hex'); // 20 bytes
    const totpSecret = tokenBytes.toString('base64url').toUpperCase().replace(/-/g, 'A').replace(/_/g, 'B').substring(0, 32);

    res.status(201).json({
      status: 'success',
      data: { token, shortCode, qrPayload, expiresAt, totpSecret },
    });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /pairing/confirm
 * Validates token OR shortCode OR totpCode, creates WearableDevice, marks token used.
 * Returns 400 if token is expired or already used.
 * Rate-limited to 10 attempts per 5 min per IP.
 */
router.post('/confirm', confirmRateLimit, requireRole('doctor', 'nurse', 'admin', 'patient'), async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const body = confirmSchema.parse(req.body);
    const now = new Date();

    const pairingToken = await prisma.pairingToken.findFirst({
      where: {
        usedAt: null,
        expiresAt: { gt: now },
        ...(body.token ? { token: body.token } : body.shortCode ? { shortCode: body.shortCode } : {}),
      },
    });

    if (!pairingToken) {
      res.status(400).json({ status: 'error', message: 'Invalid or expired pairing code' });
      return;
    }

    // If totpCode provided, verify it against the TOTP secret derived from the token
    if (body.totpCode && pairingToken) {
      const tokenBytes = Buffer.from(pairingToken.token.substring(0, 40), 'hex');
      const derivedSecret = tokenBytes.toString('base64url').toUpperCase().replace(/-/g, 'A').replace(/_/g, 'B').substring(0, 32);
      if (!authenticator.check(body.totpCode, derivedSecret)) {
        res.status(400).json({ status: 'error', message: 'Invalid or expired TOTP code' });
        return;
      }
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
 * Accepts optional ?createdAfter=ISO query param to filter results.
 */
router.get('/status/:patientId', requireRole('doctor', 'nurse', 'admin', 'patient'), async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { patientId } = req.params;
    const createdAfter = req.query['createdAfter'];
    const createdAfterDate = createdAfter ? new Date(createdAfter as string) : undefined;

    const devices = await prisma.wearableDevice.findMany({
      where: {
        patientId,
        isConnected: true,
        ...(createdAfterDate ? { createdAt: { gt: createdAfterDate } } : {}),
      },
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

/**
 * DELETE /pairing/cleanup
 * Admin-only: removes all expired unused PairingTokens.
 */
router.delete('/cleanup', requireRole('admin'), async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const result = await prisma.pairingToken.deleteMany({
      where: { expiresAt: { lt: new Date() }, usedAt: null },
    });
    res.json({ status: 'success', data: { deleted: result.count } });
  } catch (err) {
    next(err);
  }
});

export default router;
