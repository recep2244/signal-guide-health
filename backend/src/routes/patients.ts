/**
 * Patient Routes
 * CRUD operations for patient management
 */

import { Router, Request, Response } from 'express';
import { z } from 'zod';
import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import { Prisma } from '@prisma/client';
import { authenticate, requireRole } from '../middleware/auth';
import { logAuditEvent } from '../middleware/audit';
import { prisma } from '../config/database';

const router: Router = Router();

// All patient routes require authentication
router.use(authenticate);

// Validation schemas
const patientQuerySchema = z.object({
  page: z.string().transform(Number).default('1'),
  limit: z.string().transform(Number).default('10'),
  triageLevel: z.enum(['red', 'amber', 'green', 'all']).optional(),
  search: z.string().optional(),
  sortBy: z.enum(['name', 'triageLevel', 'lastCheckIn', 'wellbeingScore']).optional(),
  sortOrder: z.enum(['asc', 'desc']).default('asc'),
  hasUnresolvedAlerts: z.string().transform((v) => v === 'true').optional(),
});

const createPatientSchema = z.object({
  email: z.string().email(),
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  nhsNumber: z.string().length(10).optional(),
  dateOfBirth: z.string().datetime(),
  gender: z.enum(['male', 'female', 'other', 'prefer_not_to_say']).optional(),
  phone: z.string().optional(),
  address: z.object({
    line1: z.string().optional(),
    line2: z.string().optional(),
    city: z.string().optional(),
    postcode: z.string().optional(),
  }).optional(),
  primaryDiagnosis: z.string().optional(),
  assignedDoctorId: z.string().uuid().optional(),
});

const updatePatientSchema = createPatientSchema.partial();

const updateTriageSchema = z.object({
  triageLevel: z.enum(['red', 'amber', 'green']),
  notes: z.string().optional(),
});

/**
 * GET /patients
 * List patients with filtering and pagination
 */
router.get('/', requireRole('doctor', 'nurse', 'admin', 'super_admin'), async (req: Request, res: Response) => {
  try {
    const query = patientQuerySchema.parse(req.query);
    const { page, limit, triageLevel, search, sortBy, sortOrder, hasUnresolvedAlerts } = query;
    const skip = (page - 1) * limit;

    // Build where clause
    const where: Prisma.PatientWhereInput = {};

    if (triageLevel && triageLevel !== 'all') {
      where.triageLevel = triageLevel as 'red' | 'amber' | 'green';
    }

    if (search) {
      where.OR = [
        { user: { firstName: { contains: search, mode: 'insensitive' } } },
        { user: { lastName: { contains: search, mode: 'insensitive' } } },
        { nhsNumber: { contains: search } },
      ];
    }

    if (hasUnresolvedAlerts) {
      where.alerts = { some: { resolved: false } };
    }

    // Build orderBy
    let orderBy: Prisma.PatientOrderByWithRelationInput;
    switch (sortBy) {
      case 'name':
        orderBy = { user: { firstName: 'asc' } };
        break;
      case 'triageLevel':
        orderBy = { triageLevel: sortOrder };
        break;
      case 'lastCheckIn':
        orderBy = { lastCheckIn: sortOrder };
        break;
      case 'wellbeingScore':
        orderBy = { wellbeingScore: sortOrder };
        break;
      default:
        orderBy = { createdAt: 'desc' };
    }

    const [patients, total, triageCounts] = await Promise.all([
      prisma.patient.findMany({
        where,
        skip,
        take: limit,
        orderBy,
        include: {
          user: { select: { firstName: true, lastName: true, email: true } },
          alerts: {
            where: { resolved: false },
            select: { id: true, type: true, severity: true, title: true, resolved: true, createdAt: true },
          },
        },
      }),
      prisma.patient.count({ where }),
      prisma.patient.groupBy({ by: ['triageLevel'], _count: true }),
    ]);

    const statsMap: Record<string, number> = {};
    for (const entry of triageCounts) {
      statsMap[entry.triageLevel] = entry._count;
    }

    await logAuditEvent('PATIENT_VIEW', {
      userId: req.user?.userId,
      requestId: req.requestId,
    });

    res.json({
      status: 'success',
      data: {
        patients,
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
        stats: {
          red: statsMap['red'] ?? 0,
          amber: statsMap['amber'] ?? 0,
          green: statsMap['green'] ?? 0,
          total,
        },
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ status: 'error', code: 'VALIDATION_ERROR', message: error.message });
      return;
    }
    throw error;
  }
});

/**
 * GET /patients/search
 * Search patients by name or NHS number
 */
router.get('/search', requireRole('doctor', 'nurse', 'admin', 'super_admin'), async (req: Request, res: Response) => {
  const { q } = req.query;

  if (!q || typeof q !== 'string' || q.length < 2) {
    res.status(400).json({
      status: 'error',
      code: 'INVALID_QUERY',
      message: 'Search query must be at least 2 characters',
    });
    return;
  }

  await logAuditEvent('PATIENT_SEARCH', {
    userId: req.user?.userId,
    requestId: req.requestId,
    newValues: { query: q },
  });

  const patients = await prisma.patient.findMany({
    where: {
      OR: [
        { user: { firstName: { contains: q, mode: 'insensitive' } } },
        { user: { lastName: { contains: q, mode: 'insensitive' } } },
        { nhsNumber: { contains: q } },
      ],
    },
    include: {
      user: { select: { firstName: true, lastName: true, email: true } },
      alerts: { where: { resolved: false } },
    },
    take: 20,
  });

  res.json({
    status: 'success',
    data: {
      patients,
    },
  });
});

/**
 * GET /patients/stats
 * Get triage statistics
 */
router.get('/stats', requireRole('doctor', 'nurse', 'admin', 'super_admin'), async (req: Request, res: Response) => {
  const [triageCounts, withUnresolvedAlerts] = await Promise.all([
    prisma.patient.groupBy({ by: ['triageLevel'], _count: { _all: true } }),
    prisma.patient.count({ where: { alerts: { some: { resolved: false } } } }),
  ]);

  const statsMap: Record<string, number> = {};
  let total = 0;
  for (const entry of triageCounts) {
    statsMap[entry.triageLevel] = entry._count._all;
    total += entry._count._all;
  }

  res.json({
    status: 'success',
    data: {
      total,
      red: statsMap['red'] ?? 0,
      amber: statsMap['amber'] ?? 0,
      green: statsMap['green'] ?? 0,
      withUnresolvedAlerts,
    },
  });
});

/**
 * GET /patients/:id
 * Get single patient details
 */
router.get('/:id', requireRole('doctor', 'nurse', 'admin', 'super_admin'), async (req: Request, res: Response) => {
  const { id } = req.params;

  const patient = await prisma.patient.findUnique({
    where: { id },
    include: {
      user: true,
      alerts: { orderBy: { createdAt: 'desc' } },
      wearableDevices: true,
      checkIns: { orderBy: { timestamp: 'desc' }, take: 10 },
    },
  });

  if (!patient) {
    res.status(404).json({
      status: 'error',
      code: 'NOT_FOUND',
      message: 'Patient not found',
    });
    return;
  }

  await logAuditEvent('PATIENT_VIEW', {
    userId: req.user?.userId,
    entityType: 'patient',
    entityId: id,
    requestId: req.requestId,
  });

  res.json({
    status: 'success',
    data: {
      patient,
    },
  });
});

/**
 * POST /patients
 * Create new patient
 */
router.post('/', requireRole('doctor', 'admin', 'super_admin'), async (req: Request, res: Response) => {
  try {
    const data = createPatientSchema.parse(req.body);

    // Check if user with that email already exists
    const existing = await prisma.user.findUnique({ where: { email: data.email.toLowerCase() } });
    if (existing) {
      res.status(409).json({
        status: 'error',
        code: 'CONFLICT',
        message: 'A user with that email already exists',
      });
      return;
    }

    const passwordHash = await bcrypt.hash(uuidv4(), 12);

    const patient = await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          email: data.email.toLowerCase(),
          passwordHash,
          role: 'patient',
          status: 'pending_verification',
          firstName: data.firstName,
          lastName: data.lastName,
          phone: data.phone,
        },
      });

      const newPatient = await tx.patient.create({
        data: {
          userId: user.id,
          dateOfBirth: new Date(data.dateOfBirth),
          gender: data.gender,
          nhsNumber: data.nhsNumber,
          primaryDiagnosis: data.primaryDiagnosis,
          addressLine1: data.address?.line1,
          addressLine2: data.address?.line2,
          city: data.address?.city,
          postcode: data.address?.postcode,
        },
        include: {
          user: { select: { firstName: true, lastName: true, email: true } },
        },
      });

      if (data.assignedDoctorId) {
        const doctor = await tx.doctor.findUnique({ where: { id: data.assignedDoctorId } });
        if (doctor) {
          await tx.doctorPatientAssignment.create({
            data: {
              doctorId: data.assignedDoctorId,
              patientId: newPatient.id,
              isPrimary: true,
            },
          });
        }
      }

      return newPatient;
    });

    await logAuditEvent('PATIENT_CREATE', {
      userId: req.user?.userId,
      entityType: 'patient',
      newValues: { email: data.email, firstName: data.firstName, lastName: data.lastName },
      requestId: req.requestId,
    });

    res.status(201).json({
      status: 'success',
      data: {
        patient,
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ status: 'error', code: 'VALIDATION_ERROR', message: error.message });
      return;
    }
    throw error;
  }
});

/**
 * PUT /patients/:id
 * Update patient
 */
router.put('/:id', requireRole('doctor', 'admin', 'super_admin'), async (req: Request, res: Response) => {
  const { id } = req.params;
  try {
    const data = updatePatientSchema.parse(req.body);

    const existing = await prisma.patient.findUnique({ where: { id }, include: { user: true } });
    if (!existing) {
      res.status(404).json({ status: 'error', code: 'NOT_FOUND', message: 'Patient not found' });
      return;
    }

    const patient = await prisma.$transaction(async (tx) => {
      await tx.patient.update({
        where: { id },
        data: {
          nhsNumber: data.nhsNumber,
          primaryDiagnosis: data.primaryDiagnosis,
          gender: data.gender,
          addressLine1: data.address?.line1,
          addressLine2: data.address?.line2,
          city: data.address?.city,
          postcode: data.address?.postcode,
          ...(data.dateOfBirth ? { dateOfBirth: new Date(data.dateOfBirth) } : {}),
        },
      });

      const updatedPatient = await tx.patient.update({
        where: { id },
        data: {},
        include: {
          user: { select: { firstName: true, lastName: true, email: true } },
        },
      });

      if (data.email || data.firstName || data.lastName) {
        await tx.user.update({
          where: { id: existing.userId },
          data: {
            ...(data.email ? { email: data.email.toLowerCase() } : {}),
            ...(data.firstName ? { firstName: data.firstName } : {}),
            ...(data.lastName ? { lastName: data.lastName } : {}),
          },
        });
      }

      return updatedPatient;
    });

    await logAuditEvent('PATIENT_UPDATE', {
      userId: req.user?.userId,
      entityType: 'patient',
      entityId: id,
      newValues: data,
      requestId: req.requestId,
    });

    res.json({
      status: 'success',
      data: {
        patient,
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ status: 'error', code: 'VALIDATION_ERROR', message: error.message });
      return;
    }
    throw error;
  }
});

/**
 * PATCH /patients/:id/triage
 * Update patient triage level
 */
router.patch('/:id/triage', requireRole('doctor', 'nurse', 'admin'), async (req: Request, res: Response) => {
  const { id } = req.params;
  try {
    const data = updateTriageSchema.parse(req.body);

    const existing = await prisma.patient.findUnique({ where: { id } });
    if (!existing) {
      res.status(404).json({ status: 'error', code: 'NOT_FOUND', message: 'Patient not found' });
      return;
    }

    const patient = await prisma.patient.update({
      where: { id },
      data: {
        triageLevel: data.triageLevel,
        triageUpdatedAt: new Date(),
        triageUpdatedById: req.user?.userId,
      },
    });

    if (data.notes) {
      const alertSeverity: 'critical' | 'high' | 'low' =
        data.triageLevel === 'red' ? 'critical' : data.triageLevel === 'amber' ? 'high' : 'low';
      await prisma.alert.create({
        data: {
          patientId: id as string,
          type: 'manual',
          severity: alertSeverity,
          title: `Triage level changed to ${data.triageLevel}`,
          message: data.notes,
        },
      });
    }

    await logAuditEvent('TRIAGE_CHANGE', {
      userId: req.user?.userId,
      entityType: 'patient',
      entityId: id,
      newValues: data,
      requestId: req.requestId,
    });

    res.json({
      status: 'success',
      data: {
        patient,
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ status: 'error', code: 'VALIDATION_ERROR', message: error.message });
      return;
    }
    throw error;
  }
});

/**
 * DELETE /patients/:id
 * Soft delete patient (for GDPR compliance)
 */
router.delete('/:id', requireRole('admin', 'super_admin'), async (req: Request, res: Response) => {
  const { id } = req.params;

  const existing = await prisma.patient.findUnique({ where: { id } });
  if (!existing) {
    res.status(404).json({ status: 'error', code: 'NOT_FOUND', message: 'Patient not found' });
    return;
  }

  await prisma.$transaction([
    // Hard-delete related data for GDPR compliance
    prisma.alert.deleteMany({ where: { patientId: id } }),
    prisma.wearableReading.deleteMany({ where: { patientId: id } }),
    prisma.wearableDevice.deleteMany({ where: { patientId: id } }),
    prisma.pairingToken.deleteMany({ where: { patientId: id } }),
    // Soft-delete the patient and anonymise user record
    prisma.user.update({
      where: { id: existing.userId },
      data: {
        email: `deleted_${id}@deleted.invalid`,
        firstName: 'Deleted',
        lastName: 'Patient',
        status: 'inactive',
      },
    }),
    prisma.patient.update({
      where: { id },
      data: {
        nhsNumber: null,
        whatsappPhone: null,
        notes: null,
        addressLine1: null,
        addressLine2: null,
        city: null,
        postcode: null,
      },
    }),
  ]);

  await logAuditEvent('PATIENT_DELETE', {
    userId: req.user?.userId,
    entityType: 'patient',
    entityId: id,
    requestId: req.requestId,
  });

  res.json({
    status: 'success',
    message: 'Patient record deleted',
  });
});

/**
 * GET /patients/:id/alerts
 * Get patient alerts
 */
router.get('/:id/alerts', requireRole('doctor', 'nurse', 'admin'), async (req: Request, res: Response) => {
  const { id } = req.params;
  const includeResolved = req.query['includeResolved'] === 'true';

  const patient = await prisma.patient.findUnique({ where: { id }, select: { id: true } });
  if (!patient) {
    res.status(404).json({ status: 'error', code: 'NOT_FOUND', message: 'Patient not found' });
    return;
  }

  const alerts = await prisma.alert.findMany({
    where: {
      patientId: id,
      ...(includeResolved ? {} : { resolved: false }),
    },
    orderBy: { createdAt: 'desc' },
    include: {
      actions: { orderBy: { createdAt: 'desc' }, take: 5 },
    },
  });

  res.json({
    status: 'success',
    data: {
      alerts,
    },
  });
});

/**
 * GET /patients/:id/wearables
 * Get patient wearable data
 */
router.get('/:id/wearables', requireRole('doctor', 'nurse', 'admin'), async (req: Request, res: Response) => {
  const { id } = req.params;
  const daysParam = req.query['days'];
  const daysRaw = typeof daysParam === 'string' ? Number(daysParam) : 14;
  const days = Number.isFinite(daysRaw) ? Math.max(1, Math.min(90, daysRaw)) : 14;

  const patient = await prisma.patient.findUnique({ where: { id }, select: { id: true } });
  if (!patient) {
    res.status(404).json({ status: 'error', code: 'NOT_FOUND', message: 'Patient not found' });
    return;
  }

  const since = new Date(Date.now() - days * 86400000);

  const [devices, readings] = await Promise.all([
    prisma.wearableDevice.findMany({ where: { patientId: id } }),
    prisma.wearableReading.findMany({
      where: {
        patientId: id,
        readingDate: { gte: since },
      },
      orderBy: { readingDate: 'desc' },
    }),
  ]);

  res.json({
    status: 'success',
    data: {
      devices,
      readings,
    },
  });
});

/**
 * GET /patients/:id/checkins
 * Get patient check-in history
 */
router.get('/:id/checkins', requireRole('doctor', 'nurse', 'admin'), async (req: Request, res: Response) => {
  const { id } = req.params;
  const limitParam = req.query['limit'];
  const limitRaw = typeof limitParam === 'string' ? Number(limitParam) : 30;
  const limit = Number.isFinite(limitRaw) ? Math.max(1, Math.min(100, limitRaw)) : 30;

  const patient = await prisma.patient.findUnique({ where: { id }, select: { id: true } });
  if (!patient) {
    res.status(404).json({ status: 'error', code: 'NOT_FOUND', message: 'Patient not found' });
    return;
  }

  const checkins = await prisma.checkIn.findMany({
    where: { patientId: id },
    orderBy: { timestamp: 'desc' },
    take: limit,
  });

  res.json({
    status: 'success',
    data: {
      checkins,
    },
  });
});

/**
 * GET /patients/:id/chat
 * Get patient chat history
 */
router.get('/:id/chat', requireRole('doctor', 'nurse', 'admin', 'super_admin'), async (req: Request, res: Response) => {
  const { id } = req.params;
  const validChannels = ['whatsapp', 'sms', 'email', 'push', 'in_app'] as const;
  const requestedLimit = Number(req.query['limit']);
  const limit = Number.isFinite(requestedLimit)
    ? Math.max(1, Math.min(300, requestedLimit))
    : 50;
  const channelQuery = req.query['channel'];
  const channel =
    typeof channelQuery === 'string' &&
    validChannels.includes(channelQuery.trim() as (typeof validChannels)[number])
      ? (channelQuery.trim() as (typeof validChannels)[number])
      : undefined;

  const patient = await prisma.patient.findUnique({
    where: { id },
    select: { id: true },
  });
  if (!patient) {
    res.status(404).json({
      status: 'error',
      message: 'Patient not found',
    });
    return;
  }

  const messages = await prisma.chatMessage.findMany({
    where: {
      patientId: id,
      ...(channel ? { channel } : {}),
    },
    orderBy: { createdAt: 'desc' },
    take: limit,
    select: {
      id: true,
      channel: true,
      direction: true,
      senderType: true,
      messageType: true,
      content: true,
      flowStep: true,
      whatsappStatus: true,
      isAutomated: true,
      createdAt: true,
    },
  });

  await logAuditEvent('PATIENT_VIEW', {
    userId: req.user?.userId,
    entityType: 'patient',
    entityId: id,
    requestId: req.requestId,
    newValues: {
      channel: channel || 'all',
      limit,
      resultCount: messages.length,
    },
  });

  res.json({
    status: 'success',
    data: {
      messages: messages.reverse().map((message: {
        id: string;
        channel: string;
        direction: string;
        senderType: string;
        messageType: string;
        content: string;
        flowStep: string | null;
        whatsappStatus: string | null;
        isAutomated: boolean;
        createdAt: Date;
      }) => ({
        ...message,
        createdAt: message.createdAt.toISOString(),
      })),
      count: messages.length,
    },
  });
});

export default router;
