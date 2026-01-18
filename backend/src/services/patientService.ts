/**
 * Patient Service
 * CRUD operations and business logic for patients
 */

import { Prisma, TriageLevel } from '@prisma/client';
import { prisma } from '../config/database';
import { logger } from '../utils/logger';
import { ApiError } from '../middleware/errorHandler';
import { logAuditEvent } from '../middleware/audit';
import { encryptionService } from './encryptionService';

// Types
interface PatientFilters {
  triageLevel?: TriageLevel | 'all';
  search?: string;
  hasUnresolvedAlerts?: boolean;
  assignedDoctorId?: string;
  page?: number;
  limit?: number;
  sortBy?: 'name' | 'triageLevel' | 'lastCheckIn' | 'wellbeingScore';
  sortOrder?: 'asc' | 'desc';
}

interface PatientListResult {
  patients: any[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

interface CreatePatientData {
  email: string;
  firstName: string;
  lastName: string;
  dateOfBirth: Date;
  nhsNumber?: string;
  gender?: 'male' | 'female' | 'other' | 'prefer_not_to_say';
  phone?: string;
  address?: {
    line1?: string;
    line2?: string;
    city?: string;
    postcode?: string;
  };
  primaryDiagnosis?: string;
  assignedDoctorId?: string;
  organizationId?: string;
}

interface UpdatePatientData {
  firstName?: string;
  lastName?: string;
  phone?: string;
  address?: {
    line1?: string;
    line2?: string;
    city?: string;
    postcode?: string;
  };
  primaryDiagnosis?: string;
  triageLevel?: TriageLevel;
  wellbeingScore?: number;
  carePlan?: string;
  notes?: string;
}

class PatientService {
  /**
   * Get paginated patient list with filters
   */
  async getPatients(
    filters: PatientFilters,
    requestingUserId: string,
    requestingUserRole: string
  ): Promise<PatientListResult> {
    const {
      triageLevel,
      search,
      hasUnresolvedAlerts,
      assignedDoctorId,
      page = 1,
      limit = 10,
      sortBy = 'triageLevel',
      sortOrder = 'asc',
    } = filters;

    // Build where clause
    const where: Prisma.PatientWhereInput = {};

    // Triage level filter
    if (triageLevel && triageLevel !== 'all') {
      where.triageLevel = triageLevel;
    }

    // Search filter
    if (search && search.length >= 2) {
      where.OR = [
        { user: { firstName: { contains: search, mode: 'insensitive' } } },
        { user: { lastName: { contains: search, mode: 'insensitive' } } },
        { nhsNumber: { contains: search } },
      ];
    }

    // Unresolved alerts filter
    if (hasUnresolvedAlerts) {
      where.alerts = {
        some: { resolved: false },
      };
    }

    // Doctor assignment filter (for RBAC)
    if (requestingUserRole === 'doctor') {
      where.doctorAssignments = {
        some: {
          doctor: { userId: requestingUserId },
          status: 'active',
        },
      };
    } else if (assignedDoctorId) {
      where.doctorAssignments = {
        some: { doctorId: assignedDoctorId, status: 'active' },
      };
    }

    // Build order by
    let orderBy: Prisma.PatientOrderByWithRelationInput = {};
    switch (sortBy) {
      case 'name':
        orderBy = { user: { lastName: sortOrder } };
        break;
      case 'triageLevel':
        // Custom ordering: red=0, amber=1, green=2
        orderBy = { triageLevel: sortOrder };
        break;
      case 'lastCheckIn':
        orderBy = { lastCheckIn: sortOrder };
        break;
      case 'wellbeingScore':
        orderBy = { wellbeingScore: sortOrder };
        break;
      default:
        orderBy = { triageLevel: 'asc' };
    }

    // Execute queries
    const [patients, total] = await Promise.all([
      prisma.patient.findMany({
        where,
        include: {
          user: {
            select: {
              id: true,
              email: true,
              firstName: true,
              lastName: true,
              phone: true,
              avatarUrl: true,
            },
          },
          alerts: {
            where: { resolved: false },
            take: 5,
            orderBy: { createdAt: 'desc' },
          },
          wearableDevices: {
            where: { isConnected: true },
            take: 1,
          },
          _count: {
            select: {
              alerts: { where: { resolved: false } },
            },
          },
        },
        orderBy,
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.patient.count({ where }),
    ]);

    // Transform results
    const transformedPatients = patients.map((patient) => ({
      id: patient.id,
      userId: patient.userId,
      name: `${patient.user.firstName} ${patient.user.lastName}`,
      email: patient.user.email,
      nhsNumber: patient.nhsNumber,
      triageLevel: patient.triageLevel,
      wellbeingScore: patient.wellbeingScore,
      lastCheckIn: patient.lastCheckIn,
      primaryDiagnosis: patient.primaryDiagnosis,
      unresolvedAlertCount: patient._count.alerts,
      alerts: patient.alerts,
      hasConnectedWearable: patient.wearableDevices.length > 0,
    }));

    return {
      patients: transformedPatients,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  /**
   * Get single patient by ID
   */
  async getPatientById(
    patientId: string,
    requestingUserId: string,
    requestingUserRole: string
  ): Promise<any> {
    const patient = await prisma.patient.findUnique({
      where: { id: patientId },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            phone: true,
            avatarUrl: true,
            createdAt: true,
          },
        },
        doctorAssignments: {
          where: { status: 'active' },
          include: {
            doctor: {
              include: {
                user: {
                  select: { firstName: true, lastName: true },
                },
              },
            },
          },
        },
        wearableDevices: true,
        alerts: {
          where: { resolved: false },
          orderBy: { createdAt: 'desc' },
          take: 10,
        },
        checkIns: {
          orderBy: { timestamp: 'desc' },
          take: 10,
        },
      },
    });

    if (!patient) {
      throw ApiError.notFound('Patient not found');
    }

    // Check access
    if (requestingUserRole === 'doctor') {
      const hasAccess = patient.doctorAssignments.some(
        (a) => a.doctor.userId === requestingUserId
      );
      if (!hasAccess) {
        throw ApiError.forbidden('You are not assigned to this patient');
      }
    }

    return {
      ...patient,
      name: `${patient.user.firstName} ${patient.user.lastName}`,
      assignedDoctors: patient.doctorAssignments.map((a) => ({
        id: a.doctorId,
        name: `${a.doctor.user.firstName} ${a.doctor.user.lastName}`,
        isPrimary: a.isPrimary,
      })),
    };
  }

  /**
   * Create new patient
   */
  async createPatient(
    data: CreatePatientData,
    createdByUserId: string
  ): Promise<any> {
    // Check if NHS number already exists
    if (data.nhsNumber) {
      const existing = await prisma.patient.findUnique({
        where: { nhsNumber: data.nhsNumber },
      });
      if (existing) {
        throw ApiError.conflict('Patient with this NHS number already exists');
      }
    }

    // Create user and patient in transaction
    const result = await prisma.$transaction(async (tx) => {
      // Create user
      const user = await tx.user.create({
        data: {
          email: data.email.toLowerCase(),
          passwordHash: '', // Will be set on first login
          role: 'patient',
          firstName: data.firstName,
          lastName: data.lastName,
          phone: data.phone,
          organizationId: data.organizationId,
          status: 'pending_verification',
        },
      });

      // Create patient
      const patient = await tx.patient.create({
        data: {
          userId: user.id,
          nhsNumber: data.nhsNumber,
          dateOfBirth: data.dateOfBirth,
          gender: data.gender,
          addressLine1: data.address?.line1,
          addressLine2: data.address?.line2,
          city: data.address?.city,
          postcode: data.address?.postcode,
          primaryDiagnosis: data.primaryDiagnosis,
        },
      });

      // Assign to doctor if specified
      if (data.assignedDoctorId) {
        await tx.doctorPatientAssignment.create({
          data: {
            doctorId: data.assignedDoctorId,
            patientId: user.id,
            isPrimary: true,
            assignedBy: createdByUserId,
          },
        });
      }

      return patient;
    });

    await logAuditEvent('PATIENT_CREATE', {
      userId: createdByUserId,
      entityType: 'patient',
      entityId: result.id,
      newValues: { email: data.email, nhsNumber: data.nhsNumber },
    });

    logger.info({
      message: 'Patient created',
      patientId: result.id,
      createdBy: createdByUserId,
    });

    return result;
  }

  /**
   * Update patient
   */
  async updatePatient(
    patientId: string,
    data: UpdatePatientData,
    updatedByUserId: string
  ): Promise<any> {
    const existing = await prisma.patient.findUnique({
      where: { id: patientId },
      include: { user: true },
    });

    if (!existing) {
      throw ApiError.notFound('Patient not found');
    }

    const updateData: Prisma.PatientUpdateInput = {};

    if (data.firstName || data.lastName) {
      updateData.user = {
        update: {
          firstName: data.firstName,
          lastName: data.lastName,
        },
      };
    }

    if (data.address) {
      updateData.addressLine1 = data.address.line1;
      updateData.addressLine2 = data.address.line2;
      updateData.city = data.address.city;
      updateData.postcode = data.address.postcode;
    }

    if (data.primaryDiagnosis !== undefined) {
      updateData.primaryDiagnosis = data.primaryDiagnosis;
    }

    if (data.wellbeingScore !== undefined) {
      updateData.wellbeingScore = data.wellbeingScore;
    }

    if (data.carePlan !== undefined) {
      updateData.carePlan = data.carePlan;
    }

    if (data.notes !== undefined) {
      updateData.notes = data.notes;
    }

    const updated = await prisma.patient.update({
      where: { id: patientId },
      data: updateData,
      include: { user: true },
    });

    await logAuditEvent('PATIENT_UPDATE', {
      userId: updatedByUserId,
      entityType: 'patient',
      entityId: patientId,
      oldValues: { triageLevel: existing.triageLevel },
      newValues: data,
    });

    return updated;
  }

  /**
   * Update patient triage level
   */
  async updateTriageLevel(
    patientId: string,
    triageLevel: TriageLevel,
    notes: string | undefined,
    updatedByUserId: string
  ): Promise<any> {
    const existing = await prisma.patient.findUnique({
      where: { id: patientId },
    });

    if (!existing) {
      throw ApiError.notFound('Patient not found');
    }

    const oldLevel = existing.triageLevel;

    const updated = await prisma.patient.update({
      where: { id: patientId },
      data: {
        triageLevel,
        triageUpdatedAt: new Date(),
        triageUpdatedById: updatedByUserId,
        notes: notes ? `${existing.notes || ''}\n[Triage Change] ${notes}` : existing.notes,
      },
    });

    await logAuditEvent('TRIAGE_CHANGE', {
      userId: updatedByUserId,
      entityType: 'patient',
      entityId: patientId,
      oldValues: { triageLevel: oldLevel },
      newValues: { triageLevel, notes },
    });

    logger.info({
      message: 'Triage level updated',
      patientId,
      oldLevel,
      newLevel: triageLevel,
      updatedBy: updatedByUserId,
    });

    return updated;
  }

  /**
   * Get triage statistics
   */
  async getTriageStats(
    requestingUserId: string,
    requestingUserRole: string
  ): Promise<{
    total: number;
    red: number;
    amber: number;
    green: number;
    withUnresolvedAlerts: number;
  }> {
    const where: Prisma.PatientWhereInput = {};

    // Filter by doctor assignment if not admin
    if (requestingUserRole === 'doctor') {
      where.doctorAssignments = {
        some: {
          doctor: { userId: requestingUserId },
          status: 'active',
        },
      };
    }

    const [total, red, amber, green, withAlerts] = await Promise.all([
      prisma.patient.count({ where }),
      prisma.patient.count({ where: { ...where, triageLevel: 'red' } }),
      prisma.patient.count({ where: { ...where, triageLevel: 'amber' } }),
      prisma.patient.count({ where: { ...where, triageLevel: 'green' } }),
      prisma.patient.count({
        where: {
          ...where,
          alerts: { some: { resolved: false } },
        },
      }),
    ]);

    return {
      total,
      red,
      amber,
      green,
      withUnresolvedAlerts: withAlerts,
    };
  }

  /**
   * Search patients
   */
  async searchPatients(
    query: string,
    requestingUserId: string,
    requestingUserRole: string,
    limit = 10
  ): Promise<any[]> {
    if (query.length < 2) {
      return [];
    }

    const where: Prisma.PatientWhereInput = {
      OR: [
        { user: { firstName: { contains: query, mode: 'insensitive' } } },
        { user: { lastName: { contains: query, mode: 'insensitive' } } },
        { nhsNumber: { contains: query } },
      ],
    };

    // Filter by doctor assignment if not admin
    if (requestingUserRole === 'doctor') {
      where.doctorAssignments = {
        some: {
          doctor: { userId: requestingUserId },
          status: 'active',
        },
      };
    }

    const patients = await prisma.patient.findMany({
      where,
      include: {
        user: {
          select: {
            firstName: true,
            lastName: true,
            email: true,
          },
        },
      },
      take: limit,
    });

    return patients.map((p) => ({
      id: p.id,
      name: `${p.user.firstName} ${p.user.lastName}`,
      nhsNumber: p.nhsNumber,
      triageLevel: p.triageLevel,
    }));
  }

  /**
   * Delete patient (soft delete for GDPR)
   */
  async deletePatient(patientId: string, deletedByUserId: string): Promise<void> {
    const patient = await prisma.patient.findUnique({
      where: { id: patientId },
      include: { user: true },
    });

    if (!patient) {
      throw ApiError.notFound('Patient not found');
    }

    // Soft delete - anonymize PII
    await prisma.$transaction([
      prisma.user.update({
        where: { id: patient.userId },
        data: {
          email: `deleted_${patient.userId}@anonymized.local`,
          firstName: 'Deleted',
          lastName: 'User',
          phone: null,
          status: 'inactive',
        },
      }),
      prisma.patient.update({
        where: { id: patientId },
        data: {
          nhsNumber: null,
          addressLine1: null,
          addressLine2: null,
          postcode: null,
          emergencyContactName: null,
          emergencyContactPhone: null,
          notes: '[DELETED]',
        },
      }),
    ]);

    await logAuditEvent('PATIENT_DELETE', {
      userId: deletedByUserId,
      entityType: 'patient',
      entityId: patientId,
    });

    logger.info({
      message: 'Patient deleted (anonymized)',
      patientId,
      deletedBy: deletedByUserId,
    });
  }
}

export const patientService = new PatientService();
export default patientService;
