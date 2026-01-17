/**
 * Patient Routes
 * CRUD operations for patient management
 */

import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { authenticate, requireRole } from '../middleware/auth';
import { logAuditEvent } from '../middleware/audit';

const router = Router();

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
  const query = patientQuerySchema.parse(req.query);

  // TODO: Implement with Prisma
  // - Apply RLS based on user's assigned patients
  // - Filter by triage level
  // - Search by name/NHS number
  // - Sort and paginate

  await logAuditEvent('PATIENT_VIEW', {
    userId: req.user?.userId,
    requestId: req.requestId,
  });

  res.json({
    status: 'success',
    data: {
      patients: [],
      total: 0,
      page: query.page,
      limit: query.limit,
      totalPages: 0,
    },
  });
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

  // TODO: Search implementation
  res.json({
    status: 'success',
    data: {
      patients: [],
    },
  });
});

/**
 * GET /patients/stats
 * Get triage statistics
 */
router.get('/stats', requireRole('doctor', 'nurse', 'admin', 'super_admin'), async (req: Request, res: Response) => {
  // TODO: Aggregate stats from database
  res.json({
    status: 'success',
    data: {
      total: 0,
      red: 0,
      amber: 0,
      green: 0,
      withUnresolvedAlerts: 0,
    },
  });
});

/**
 * GET /patients/:id
 * Get single patient details
 */
router.get('/:id', requireRole('doctor', 'nurse', 'admin', 'super_admin'), async (req: Request, res: Response) => {
  const { id } = req.params;

  // TODO: Fetch patient with RLS check

  await logAuditEvent('PATIENT_VIEW', {
    userId: req.user?.userId,
    entityType: 'patient',
    entityId: id,
    requestId: req.requestId,
  });

  res.json({
    status: 'success',
    data: {
      patient: null,
    },
  });
});

/**
 * POST /patients
 * Create new patient
 */
router.post('/', requireRole('doctor', 'admin', 'super_admin'), async (req: Request, res: Response) => {
  const data = createPatientSchema.parse(req.body);

  // TODO: Create patient
  // 1. Create user account
  // 2. Create patient record
  // 3. Assign to doctor
  // 4. Send welcome message

  await logAuditEvent('PATIENT_CREATE', {
    userId: req.user?.userId,
    entityType: 'patient',
    newValues: { email: data.email, firstName: data.firstName, lastName: data.lastName },
    requestId: req.requestId,
  });

  res.status(201).json({
    status: 'success',
    data: {
      patient: null,
    },
  });
});

/**
 * PUT /patients/:id
 * Update patient
 */
router.put('/:id', requireRole('doctor', 'admin', 'super_admin'), async (req: Request, res: Response) => {
  const { id } = req.params;
  const data = updatePatientSchema.parse(req.body);

  // TODO: Update patient with RLS check

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
      patient: null,
    },
  });
});

/**
 * PATCH /patients/:id/triage
 * Update patient triage level
 */
router.patch('/:id/triage', requireRole('doctor', 'nurse', 'admin'), async (req: Request, res: Response) => {
  const { id } = req.params;
  const data = updateTriageSchema.parse(req.body);

  // TODO: Update triage with audit trail

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
      patient: null,
    },
  });
});

/**
 * DELETE /patients/:id
 * Soft delete patient (for GDPR compliance)
 */
router.delete('/:id', requireRole('admin', 'super_admin'), async (req: Request, res: Response) => {
  const { id } = req.params;

  // TODO: Soft delete patient, anonymize PII

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
  const { includeResolved } = req.query;

  // TODO: Fetch alerts for patient

  res.json({
    status: 'success',
    data: {
      alerts: [],
    },
  });
});

/**
 * GET /patients/:id/wearables
 * Get patient wearable data
 */
router.get('/:id/wearables', requireRole('doctor', 'nurse', 'admin'), async (req: Request, res: Response) => {
  const { id } = req.params;
  const { days = '14' } = req.query;

  // TODO: Fetch wearable readings

  res.json({
    status: 'success',
    data: {
      devices: [],
      readings: [],
    },
  });
});

/**
 * GET /patients/:id/checkins
 * Get patient check-in history
 */
router.get('/:id/checkins', requireRole('doctor', 'nurse', 'admin'), async (req: Request, res: Response) => {
  const { id } = req.params;
  const { limit = '30' } = req.query;

  // TODO: Fetch check-ins

  res.json({
    status: 'success',
    data: {
      checkins: [],
    },
  });
});

/**
 * GET /patients/:id/chat
 * Get patient chat history
 */
router.get('/:id/chat', requireRole('doctor', 'nurse', 'admin'), async (req: Request, res: Response) => {
  const { id } = req.params;
  const { limit = '50' } = req.query;

  // TODO: Fetch chat messages

  res.json({
    status: 'success',
    data: {
      messages: [],
    },
  });
});

export default router;
