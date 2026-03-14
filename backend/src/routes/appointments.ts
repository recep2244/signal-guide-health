/**
 * Appointment Routes
 */

import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { Prisma } from '@prisma/client';
import { authenticate, requireRole } from '../middleware/auth';
import { prisma } from '../config/database';
import { logger } from '../utils/logger';

const router: Router = Router();
router.use(authenticate);

const createAppointmentSchema = z.object({
  patientId: z.string().uuid(),
  doctorId: z.string().uuid(),
  type: z.string().min(1),
  scheduledAt: z.string().datetime(),
  durationMinutes: z.number().int().min(5).default(30),
  locationType: z.string().default('in_person'),
  locationDetails: z.string().optional(),
  reason: z.string().optional(),
});

const updateAppointmentSchema = createAppointmentSchema.partial().omit({ patientId: true, doctorId: true });

const appointmentInclude = {
  patient: { include: { user: { select: { firstName: true, lastName: true } } } },
  doctor: { include: { user: { select: { firstName: true, lastName: true } } } },
} as const;

const VALID_STATUSES = ['scheduled', 'confirmed', 'completed', 'cancelled', 'no_show'] as const;
type AppointmentStatus = typeof VALID_STATUSES[number];

router.get('/', async (req: Request, res: Response) => {
  try {
    const user = req.user!;
    const page = Math.max(1, parseInt(String(req.query['page'] ?? '1'), 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(String(req.query['limit'] ?? '20'), 10) || 20));
    const skip = (page - 1) * limit;

    const where: Prisma.AppointmentWhereInput = {};

    // Scope by role
    if (user.role === 'doctor') {
      const doctor = await prisma.doctor.findUnique({ where: { userId: user.userId }, select: { id: true } });
      if (doctor) where.doctorId = doctor.id;
    } else if (user.role === 'patient') {
      const patient = await prisma.patient.findUnique({ where: { userId: user.userId }, select: { id: true } });
      if (patient) where.patientId = patient.id;
    }

    const { status, from, to } = req.query as { status?: string; from?: string; to?: string };
    if (status && (VALID_STATUSES as readonly string[]).includes(status)) {
      where.status = status as AppointmentStatus;
    }
    if (from || to) {
      where.scheduledAt = {};
      if (from) where.scheduledAt.gte = new Date(from);
      if (to) where.scheduledAt.lte = new Date(to);
    }

    const [appointments, total] = await Promise.all([
      prisma.appointment.findMany({ where, include: appointmentInclude, skip, take: limit, orderBy: { scheduledAt: 'asc' } }),
      prisma.appointment.count({ where }),
    ]);

    res.json({ status: 'success', data: { appointments, total, page, limit } });
  } catch (error) {
    logger.error({ message: 'Failed to fetch appointments', error: error instanceof Error ? error.message : 'Unknown' });
    res.status(500).json({ status: 'error', message: 'Internal server error' });
  }
});

router.get('/:id', async (req: Request, res: Response) => {
  try {
    const user = req.user!;
    const appointment = await prisma.appointment.findUnique({
      where: { id: req.params['id'] },
      include: appointmentInclude,
    });
    if (!appointment) {
      res.status(404).json({ status: 'error', message: 'Appointment not found' });
      return;
    }

    // Role-gate read
    if (user.role === 'doctor') {
      const doctor = await prisma.doctor.findUnique({ where: { userId: user.userId }, select: { id: true } });
      if (!doctor || appointment.doctorId !== doctor.id) {
        res.status(403).json({ status: 'error', message: 'Access denied' });
        return;
      }
    } else if (user.role === 'patient') {
      const patient = await prisma.patient.findUnique({ where: { userId: user.userId }, select: { id: true } });
      if (!patient || appointment.patientId !== patient.id) {
        res.status(403).json({ status: 'error', message: 'Access denied' });
        return;
      }
    }

    res.json({ status: 'success', data: { appointment } });
  } catch (error) {
    logger.error({ message: 'Failed to fetch appointment', error: error instanceof Error ? error.message : 'Unknown' });
    res.status(500).json({ status: 'error', message: 'Internal server error' });
  }
});

router.post('/', requireRole('doctor', 'nurse', 'admin'), async (req: Request, res: Response) => {
  try {
    const parsed = createAppointmentSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ status: 'error', message: 'Invalid request body', details: parsed.error.errors });
      return;
    }
    const data = parsed.data;
    const appointment = await prisma.appointment.create({
      data: {
        patientId: data.patientId,
        doctorId: data.doctorId,
        type: data.type,
        scheduledAt: new Date(data.scheduledAt),
        durationMinutes: data.durationMinutes,
        locationType: data.locationType,
        locationDetails: data.locationDetails,
        reason: data.reason,
        createdById: req.user!.userId,
        status: 'scheduled',
      },
      include: appointmentInclude,
    });
    res.status(201).json({ status: 'success', data: { appointment } });
  } catch (error) {
    logger.error({ message: 'Failed to create appointment', error: error instanceof Error ? error.message : 'Unknown' });
    res.status(500).json({ status: 'error', message: 'Internal server error' });
  }
});

router.put('/:id', requireRole('doctor', 'nurse', 'admin'), async (req: Request, res: Response) => {
  try {
    const existing = await prisma.appointment.findUnique({ where: { id: req.params['id'] } });
    if (!existing) {
      res.status(404).json({ status: 'error', message: 'Appointment not found' });
      return;
    }
    const parsed = updateAppointmentSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ status: 'error', message: 'Invalid request body', details: parsed.error.errors });
      return;
    }
    const data = parsed.data;
    const updateData: Prisma.AppointmentUpdateInput = {};
    if (data.type !== undefined) updateData.type = data.type;
    if (data.scheduledAt !== undefined) updateData.scheduledAt = new Date(data.scheduledAt);
    if (data.durationMinutes !== undefined) updateData.durationMinutes = data.durationMinutes;
    if (data.locationType !== undefined) updateData.locationType = data.locationType;
    if (data.locationDetails !== undefined) updateData.locationDetails = data.locationDetails;
    if (data.reason !== undefined) updateData.reason = data.reason;
    const appointment = await prisma.appointment.update({
      where: { id: req.params['id'] },
      data: updateData,
      include: appointmentInclude,
    });
    res.json({ status: 'success', data: { appointment } });
  } catch (error) {
    logger.error({ message: 'Failed to update appointment', error: error instanceof Error ? error.message : 'Unknown' });
    res.status(500).json({ status: 'error', message: 'Internal server error' });
  }
});

router.post('/:id/cancel', async (req: Request, res: Response) => {
  try {
    const existing = await prisma.appointment.findUnique({ where: { id: req.params['id'] } });
    if (!existing) {
      res.status(404).json({ status: 'error', message: 'Appointment not found' });
      return;
    }
    if (existing.status === 'cancelled' || existing.status === 'completed') {
      res.status(400).json({ status: 'error', message: `Cannot cancel an appointment with status '${existing.status}'` });
      return;
    }
    const appointment = await prisma.appointment.update({
      where: { id: req.params['id'] },
      data: {
        status: 'cancelled',
        cancelledAt: new Date(),
        cancelledById: req.user!.userId,
        cancellationReason: typeof req.body.reason === 'string' ? req.body.reason : undefined,
      },
      include: appointmentInclude,
    });
    res.json({ status: 'success', data: { appointment } });
  } catch (error) {
    logger.error({ message: 'Failed to cancel appointment', error: error instanceof Error ? error.message : 'Unknown' });
    res.status(500).json({ status: 'error', message: 'Internal server error' });
  }
});

router.post('/:id/confirm', async (req: Request, res: Response) => {
  try {
    const existing = await prisma.appointment.findUnique({ where: { id: req.params['id'] } });
    if (!existing) {
      res.status(404).json({ status: 'error', message: 'Appointment not found' });
      return;
    }
    if (existing.status !== 'scheduled') {
      res.status(400).json({ status: 'error', message: `Cannot confirm an appointment with status '${existing.status}'` });
      return;
    }
    const appointment = await prisma.appointment.update({
      where: { id: req.params['id'] },
      data: { status: 'confirmed' },
      include: appointmentInclude,
    });
    res.json({ status: 'success', data: { appointment } });
  } catch (error) {
    logger.error({ message: 'Failed to confirm appointment', error: error instanceof Error ? error.message : 'Unknown' });
    res.status(500).json({ status: 'error', message: 'Internal server error' });
  }
});

export default router;
