/**
 * Doctor Routes
 */

import { Router, Request, Response } from 'express';
import { Prisma } from '@prisma/client';
import { authenticate, requireRole } from '../middleware/auth';
import { prisma } from '../config/database';
import { logger } from '../utils/logger';

const router: Router = Router();
router.use(authenticate);

router.get('/', requireRole('admin', 'super_admin'), async (_req: Request, res: Response) => {
  try {
    const doctors = await prisma.doctor.findMany({
      include: {
        user: {
          select: { firstName: true, lastName: true, email: true },
        },
      },
      orderBy: { user: { lastName: 'asc' } },
    });
    res.json({ status: 'success', data: { doctors, total: doctors.length } });
  } catch (error) {
    logger.error({ message: 'Failed to fetch doctors', error: error instanceof Error ? error.message : 'Unknown' });
    res.status(500).json({ status: 'error', message: 'Internal server error' });
  }
});

router.get('/:id', requireRole('admin', 'super_admin', 'doctor'), async (req: Request, res: Response) => {
  try {
    const doctor = await prisma.doctor.findUnique({
      where: { id: req.params['id'] },
      include: {
        user: {
          select: { firstName: true, lastName: true, email: true, phone: true },
        },
        patientAssignments: {
          where: { status: 'active' },
          include: {
            patient: {
              select: { id: true, triageLevel: true },
            },
          },
        },
      },
    });
    if (!doctor) {
      res.status(404).json({ status: 'error', message: 'Doctor not found' });
      return;
    }
    res.json({ status: 'success', data: { doctor } });
  } catch (error) {
    logger.error({ message: 'Failed to fetch doctor', error: error instanceof Error ? error.message : 'Unknown' });
    res.status(500).json({ status: 'error', message: 'Internal server error' });
  }
});

router.get('/:id/patients', requireRole('doctor', 'admin'), async (req: Request, res: Response) => {
  try {
    const assignments = await prisma.doctorPatientAssignment.findMany({
      where: { doctorId: req.params['id'], status: 'active' },
      include: {
        patient: {
          include: {
            user: {
              select: { firstName: true, lastName: true, email: true },
            },
          },
        },
      },
      orderBy: { assignedAt: 'desc' },
    });
    res.json({ status: 'success', data: { patients: assignments, total: assignments.length } });
  } catch (error) {
    logger.error({ message: 'Failed to fetch doctor patients', error: error instanceof Error ? error.message : 'Unknown' });
    res.status(500).json({ status: 'error', message: 'Internal server error' });
  }
});

const VALID_APPOINTMENT_STATUSES = ['scheduled', 'confirmed', 'completed', 'cancelled', 'no_show'] as const;
type AppointmentStatus = typeof VALID_APPOINTMENT_STATUSES[number];

router.get('/:id/schedule', requireRole('doctor', 'admin'), async (req: Request, res: Response) => {
  try {
    const { status } = req.query as { status?: string };

    const where: Prisma.AppointmentWhereInput = { doctorId: req.params['id'] };
    if (status && (VALID_APPOINTMENT_STATUSES as readonly string[]).includes(status)) {
      where.status = status as AppointmentStatus;
    }

    const schedule = await prisma.appointment.findMany({
      where,
      include: {
        patient: {
          include: {
            user: {
              select: { firstName: true, lastName: true },
            },
          },
        },
      },
      orderBy: { scheduledAt: 'asc' },
    });
    res.json({ status: 'success', data: { schedule, total: schedule.length } });
  } catch (error) {
    logger.error({ message: 'Failed to fetch doctor schedule', error: error instanceof Error ? error.message : 'Unknown' });
    res.status(500).json({ status: 'error', message: 'Internal server error' });
  }
});

export default router;
