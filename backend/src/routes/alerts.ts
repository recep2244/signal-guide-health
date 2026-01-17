/**
 * Alert Routes
 * Clinical alert management
 */

import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { authenticate, requireRole } from '../middleware/auth';
import { logAuditEvent } from '../middleware/audit';

const router = Router();
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
router.get('/', requireRole('doctor', 'nurse', 'admin'), async (req: Request, res: Response) => {
  const { patientId, severity, resolved, page = '1', limit = '20' } = req.query;

  res.json({
    status: 'success',
    data: { alerts: [], total: 0, page: Number(page), limit: Number(limit) },
  });
});

/**
 * GET /alerts/:id
 */
router.get('/:id', requireRole('doctor', 'nurse', 'admin'), async (req: Request, res: Response) => {
  const { id } = req.params;

  await logAuditEvent('ALERT_VIEW', {
    userId: req.user?.userId,
    entityType: 'alert',
    entityId: id,
  });

  res.json({ status: 'success', data: { alert: null } });
});

/**
 * POST /alerts
 */
router.post('/', requireRole('doctor', 'nurse', 'admin'), async (req: Request, res: Response) => {
  const data = createAlertSchema.parse(req.body);

  await logAuditEvent('ALERT_CREATE', {
    userId: req.user?.userId,
    entityType: 'alert',
    newValues: data,
  });

  res.status(201).json({ status: 'success', data: { alert: null } });
});

/**
 * POST /alerts/:id/resolve
 */
router.post('/:id/resolve', requireRole('doctor', 'nurse'), async (req: Request, res: Response) => {
  const { id } = req.params;
  const data = resolveAlertSchema.parse(req.body);

  await logAuditEvent('ALERT_RESOLVE', {
    userId: req.user?.userId,
    entityType: 'alert',
    entityId: id,
    newValues: data,
  });

  res.json({ status: 'success', message: 'Alert resolved' });
});

/**
 * POST /alerts/:id/escalate
 */
router.post('/:id/escalate', requireRole('nurse', 'doctor'), async (req: Request, res: Response) => {
  const { id } = req.params;

  await logAuditEvent('ALERT_ESCALATE', {
    userId: req.user?.userId,
    entityType: 'alert',
    entityId: id,
  });

  res.json({ status: 'success', message: 'Alert escalated' });
});

/**
 * POST /alerts/:id/acknowledge
 */
router.post('/:id/acknowledge', requireRole('doctor', 'nurse'), async (req: Request, res: Response) => {
  const { id } = req.params;
  res.json({ status: 'success', message: 'Alert acknowledged' });
});

export default router;
