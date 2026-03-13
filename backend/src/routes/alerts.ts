/**
 * Alert Routes
 * Clinical alert management backed by Prisma
 */

import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { authenticate, requireRole } from '../middleware/auth';
import { logAuditEvent } from '../middleware/audit';
import { prisma } from '../config/database';

const router: Router = Router();
router.use(authenticate);

const createAlertSchema = z.object({
  patientId: z.string().uuid(),
  type: z.enum(['vital_signs', 'missed_checkin', 'symptom_reported', 'medication_missed', 'wearable_disconnected', 'critical_trend', 'manual']),
  severity: z.enum(['low', 'medium', 'high', 'critical']),
  title: z.string().min(1),
  message: z.string().min(1),
  triggerMetric: z.string().optional(),
  triggerValue: z.number().optional(),
  thresholdValue: z.number().optional(),
});

const resolveAlertSchema = z.object({
  resolutionNotes: z.string().min(1, 'Resolution notes are required'),
});

/**
 * GET /alerts
 * List alerts with filtering
 */
router.get('/', requireRole('doctor', 'nurse', 'admin'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const page = Math.max(1, Number(req.query['page']) || 1);
    const limit = Math.min(100, Math.max(1, Number(req.query['limit']) || 20));
    const where: Record<string, unknown> = {};
    if (req.query['patientId']) where['patientId'] = req.query['patientId'] as string;
    if (req.query['severity']) where['severity'] = req.query['severity'] as string;
    if (req.query['resolved'] !== undefined) where['resolved'] = req.query['resolved'] === 'true';

    const [alerts, total] = await Promise.all([
      prisma.alert.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        include: { patient: { select: { id: true, nhsNumber: true, user: { select: { firstName: true, lastName: true } } } } },
      }),
      prisma.alert.count({ where }),
    ]);

    res.json({ status: 'success', data: { alerts, total, page, limit } });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /alerts/:id
 */
router.get('/:id', requireRole('doctor', 'nurse', 'admin'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;

    const alert = await prisma.alert.findUnique({ where: { id }, include: { actions: true } });
    if (!alert) {
      res.status(404).json({ status: 'error', message: 'Alert not found' });
      return;
    }

    await logAuditEvent('ALERT_VIEW', {
      userId: req.user?.userId,
      entityType: 'alert',
      entityId: id,
    });

    res.json({ status: 'success', data: { alert } });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /alerts
 */
router.post('/', requireRole('doctor', 'nurse', 'admin'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = createAlertSchema.parse(req.body);

    const alert = await prisma.alert.create({
      data: {
        ...data,
        triggerValue: data.triggerValue ?? undefined,
        thresholdValue: data.thresholdValue ?? undefined,
      },
    });

    await logAuditEvent('ALERT_CREATE', {
      userId: req.user?.userId,
      entityType: 'alert',
      newValues: data,
    });

    res.status(201).json({ status: 'success', data: { alert } });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /alerts/:id/resolve
 */
router.post('/:id/resolve', requireRole('doctor', 'nurse'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const data = resolveAlertSchema.parse(req.body);

    const alert = await prisma.alert.findUnique({ where: { id } });
    if (!alert) {
      res.status(404).json({ status: 'error', message: 'Alert not found' });
      return;
    }

    const updated = await prisma.alert.update({
      where: { id },
      data: {
        resolved: true,
        resolvedAt: new Date(),
        resolvedById: req.user?.userId ?? null,
        resolutionNotes: data.resolutionNotes,
      },
    });

    await logAuditEvent('ALERT_RESOLVE', {
      userId: req.user?.userId,
      entityType: 'alert',
      entityId: id,
      newValues: data,
    });

    res.json({ status: 'success', data: { alert: updated } });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /alerts/:id/escalate
 */
router.post('/:id/escalate', requireRole('nurse', 'doctor'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;

    const alert = await prisma.alert.findUnique({ where: { id } });
    if (!alert) {
      res.status(404).json({ status: 'error', message: 'Alert not found' });
      return;
    }

    const updated = await prisma.alert.update({
      where: { id },
      data: {
        escalationLevel: alert.escalationLevel + 1,
        escalatedAt: new Date(),
      },
    });

    await logAuditEvent('ALERT_ESCALATE', {
      userId: req.user?.userId,
      entityType: 'alert',
      entityId: id,
    });

    res.json({ status: 'success', data: { alert: updated } });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /alerts/:id/acknowledge
 */
router.post('/:id/acknowledge', requireRole('doctor', 'nurse'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;

    const alert = await prisma.alert.findUnique({ where: { id } });
    if (!alert) {
      res.status(404).json({ status: 'error', message: 'Alert not found' });
      return;
    }

    const updated = await prisma.alert.update({
      where: { id },
      data: {
        acknowledged: true,
        acknowledgedAt: new Date(),
        acknowledgedById: req.user?.userId ?? null,
      },
    });

    res.json({ status: 'success', data: { alert: updated } });
  } catch (err) {
    next(err);
  }
});

export default router;
