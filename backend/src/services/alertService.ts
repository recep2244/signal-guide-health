/**
 * Alert Service
 * Clinical alert management and escalation
 */

import { Prisma, AlertType, AlertSeverity, TriageLevel } from '@prisma/client';
import { prisma } from '../config/database';
import { logger } from '../utils/logger';
import { ApiError } from '../middleware/errorHandler';
import { logAuditEvent } from '../middleware/audit';

// Types
interface AlertFilters {
  patientId?: string;
  type?: AlertType;
  severity?: AlertSeverity;
  resolved?: boolean;
  assignedToId?: string;
  page?: number;
  limit?: number;
}

interface CreateAlertData {
  patientId: string;
  type: AlertType;
  severity: AlertSeverity;
  title: string;
  message: string;
  triggerMetric?: string;
  triggerValue?: number;
  thresholdValue?: number;
  metadata?: Record<string, any>;
}

// Severity thresholds for auto-triage
const SEVERITY_TRIAGE_MAP: Record<AlertSeverity, TriageLevel> = {
  critical: 'red',
  high: 'red',
  medium: 'amber',
  low: 'green',
};

class AlertService {
  /**
   * Get alerts with filters
   */
  async getAlerts(
    filters: AlertFilters,
    requestingUserId: string,
    requestingUserRole: string
  ): Promise<{ alerts: any[]; total: number; page: number; limit: number }> {
    const { patientId, type, severity, resolved, assignedToId, page = 1, limit = 20 } = filters;

    const where: Prisma.AlertWhereInput = {};

    if (patientId) where.patientId = patientId;
    if (type) where.type = type;
    if (severity) where.severity = severity;
    if (resolved !== undefined) where.resolved = resolved;
    if (assignedToId) where.assignedToId = assignedToId;

    // Filter by doctor assignment if not admin
    if (requestingUserRole === 'doctor') {
      where.patient = {
        doctorAssignments: {
          some: {
            doctor: { userId: requestingUserId },
            status: 'active',
          },
        },
      };
    }

    const [alerts, total] = await Promise.all([
      prisma.alert.findMany({
        where,
        include: {
          patient: {
            include: {
              user: { select: { firstName: true, lastName: true } },
            },
          },
          assignedTo: {
            include: {
              user: { select: { firstName: true, lastName: true } },
            },
          },
          resolvedBy: { select: { firstName: true, lastName: true } },
        },
        orderBy: [{ severity: 'desc' }, { createdAt: 'desc' }],
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.alert.count({ where }),
    ]);

    return {
      alerts: alerts.map((a) => ({
        ...a,
        patientName: `${a.patient.user.firstName} ${a.patient.user.lastName}`,
        assignedToName: a.assignedTo
          ? `${a.assignedTo.user.firstName} ${a.assignedTo.user.lastName}`
          : null,
        resolvedByName: a.resolvedBy
          ? `${a.resolvedBy.firstName} ${a.resolvedBy.lastName}`
          : null,
      })),
      total,
      page,
      limit,
    };
  }

  /**
   * Get single alert by ID
   */
  async getAlertById(alertId: string): Promise<any> {
    const alert = await prisma.alert.findUnique({
      where: { id: alertId },
      include: {
        patient: {
          include: {
            user: { select: { firstName: true, lastName: true, email: true } },
          },
        },
        assignedTo: {
          include: {
            user: { select: { firstName: true, lastName: true } },
          },
        },
        resolvedBy: { select: { firstName: true, lastName: true } },
        actions: {
          include: {
            user: { select: { firstName: true, lastName: true } },
          },
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!alert) {
      throw ApiError.notFound('Alert not found');
    }

    return alert;
  }

  /**
   * Create a new alert
   */
  async createAlert(data: CreateAlertData, createdByUserId?: string): Promise<any> {
    // Verify patient exists
    const patient = await prisma.patient.findUnique({
      where: { id: data.patientId },
      include: {
        doctorAssignments: {
          where: { isPrimary: true, status: 'active' },
          take: 1,
        },
      },
    });

    if (!patient) {
      throw ApiError.notFound('Patient not found');
    }

    // Auto-assign to primary doctor
    const primaryDoctorId = patient.doctorAssignments[0]?.doctorId;

    // Create alert
    const alert = await prisma.alert.create({
      data: {
        patientId: data.patientId,
        type: data.type,
        severity: data.severity,
        title: data.title,
        message: data.message,
        triggerMetric: data.triggerMetric,
        triggerValue: data.triggerValue,
        thresholdValue: data.thresholdValue,
        assignedToId: primaryDoctorId,
        metadata: data.metadata || {},
      },
    });

    // Update patient triage if alert is severe
    const newTriageLevel = SEVERITY_TRIAGE_MAP[data.severity];
    const currentTriagePriority = { red: 0, amber: 1, green: 2 };

    if (currentTriagePriority[newTriageLevel] < currentTriagePriority[patient.triageLevel]) {
      await prisma.patient.update({
        where: { id: data.patientId },
        data: {
          triageLevel: newTriageLevel,
          triageUpdatedAt: new Date(),
        },
      });

      logger.info({
        message: 'Patient triage auto-updated from alert',
        patientId: data.patientId,
        oldLevel: patient.triageLevel,
        newLevel: newTriageLevel,
        alertId: alert.id,
      });
    }

    await logAuditEvent('ALERT_CREATE', {
      userId: createdByUserId,
      entityType: 'alert',
      entityId: alert.id,
      newValues: { type: data.type, severity: data.severity, patientId: data.patientId },
    });

    logger.info({
      message: 'Alert created',
      alertId: alert.id,
      patientId: data.patientId,
      type: data.type,
      severity: data.severity,
    });

    // TODO: Send notification to assigned doctor

    return alert;
  }

  /**
   * Resolve an alert
   */
  async resolveAlert(
    alertId: string,
    resolutionNotes: string,
    resolvedByUserId: string
  ): Promise<any> {
    const alert = await prisma.alert.findUnique({
      where: { id: alertId },
    });

    if (!alert) {
      throw ApiError.notFound('Alert not found');
    }

    if (alert.resolved) {
      throw ApiError.badRequest('Alert is already resolved');
    }

    const updated = await prisma.$transaction([
      prisma.alert.update({
        where: { id: alertId },
        data: {
          resolved: true,
          resolvedAt: new Date(),
          resolvedById: resolvedByUserId,
          resolutionNotes,
        },
      }),
      prisma.alertAction.create({
        data: {
          alertId,
          userId: resolvedByUserId,
          actionType: 'resolve',
          content: resolutionNotes,
        },
      }),
    ]);

    // Re-evaluate patient triage
    await this.reevaluatePatientTriage(alert.patientId);

    await logAuditEvent('ALERT_RESOLVE', {
      userId: resolvedByUserId,
      entityType: 'alert',
      entityId: alertId,
      newValues: { resolutionNotes },
    });

    logger.info({
      message: 'Alert resolved',
      alertId,
      resolvedBy: resolvedByUserId,
    });

    return updated[0];
  }

  /**
   * Acknowledge an alert
   */
  async acknowledgeAlert(alertId: string, acknowledgedByUserId: string): Promise<any> {
    const alert = await prisma.alert.findUnique({
      where: { id: alertId },
    });

    if (!alert) {
      throw ApiError.notFound('Alert not found');
    }

    if (alert.acknowledged) {
      return alert; // Already acknowledged
    }

    const updated = await prisma.$transaction([
      prisma.alert.update({
        where: { id: alertId },
        data: {
          acknowledged: true,
          acknowledgedAt: new Date(),
          acknowledgedById: acknowledgedByUserId,
        },
      }),
      prisma.alertAction.create({
        data: {
          alertId,
          userId: acknowledgedByUserId,
          actionType: 'acknowledge',
        },
      }),
    ]);

    logger.info({
      message: 'Alert acknowledged',
      alertId,
      acknowledgedBy: acknowledgedByUserId,
    });

    return updated[0];
  }

  /**
   * Escalate an alert
   */
  async escalateAlert(
    alertId: string,
    escalatedByUserId: string,
    reason?: string
  ): Promise<any> {
    const alert = await prisma.alert.findUnique({
      where: { id: alertId },
    });

    if (!alert) {
      throw ApiError.notFound('Alert not found');
    }

    if (alert.resolved) {
      throw ApiError.badRequest('Cannot escalate resolved alert');
    }

    // Increase severity if possible
    const severityOrder: AlertSeverity[] = ['low', 'medium', 'high', 'critical'];
    const currentIndex = severityOrder.indexOf(alert.severity);
    const newSeverity = currentIndex < 3 ? severityOrder[currentIndex + 1] : alert.severity;

    const updated = await prisma.$transaction([
      prisma.alert.update({
        where: { id: alertId },
        data: {
          severity: newSeverity,
          escalationLevel: alert.escalationLevel + 1,
          escalatedAt: new Date(),
        },
      }),
      prisma.alertAction.create({
        data: {
          alertId,
          userId: escalatedByUserId,
          actionType: 'escalate',
          content: reason,
          metadata: {
            previousSeverity: alert.severity,
            newSeverity,
          },
        },
      }),
    ]);

    await logAuditEvent('ALERT_ESCALATE', {
      userId: escalatedByUserId,
      entityType: 'alert',
      entityId: alertId,
      oldValues: { severity: alert.severity },
      newValues: { severity: newSeverity, reason },
    });

    logger.info({
      message: 'Alert escalated',
      alertId,
      oldSeverity: alert.severity,
      newSeverity,
      escalatedBy: escalatedByUserId,
    });

    // TODO: Notify relevant staff about escalation

    return updated[0];
  }

  /**
   * Add comment to alert
   */
  async addComment(
    alertId: string,
    userId: string,
    comment: string
  ): Promise<any> {
    const alert = await prisma.alert.findUnique({
      where: { id: alertId },
    });

    if (!alert) {
      throw ApiError.notFound('Alert not found');
    }

    return prisma.alertAction.create({
      data: {
        alertId,
        userId,
        actionType: 'comment',
        content: comment,
      },
    });
  }

  /**
   * Re-evaluate patient triage based on remaining alerts
   */
  private async reevaluatePatientTriage(patientId: string): Promise<void> {
    const unresolvedAlerts = await prisma.alert.findMany({
      where: {
        patientId,
        resolved: false,
      },
      orderBy: { severity: 'desc' },
      take: 1,
    });

    let newTriageLevel: TriageLevel = 'green';

    if (unresolvedAlerts.length > 0) {
      newTriageLevel = SEVERITY_TRIAGE_MAP[unresolvedAlerts[0].severity];
    }

    await prisma.patient.update({
      where: { id: patientId },
      data: {
        triageLevel: newTriageLevel,
        triageUpdatedAt: new Date(),
      },
    });

    logger.info({
      message: 'Patient triage re-evaluated',
      patientId,
      newLevel: newTriageLevel,
      unresolvedAlertCount: unresolvedAlerts.length,
    });
  }

  /**
   * Get alert statistics
   */
  async getAlertStats(): Promise<{
    total: number;
    unresolved: number;
    critical: number;
    high: number;
    avgResolutionTimeMinutes: number;
  }> {
    const [total, unresolved, critical, high, resolvedAlerts] = await Promise.all([
      prisma.alert.count(),
      prisma.alert.count({ where: { resolved: false } }),
      prisma.alert.count({ where: { severity: 'critical', resolved: false } }),
      prisma.alert.count({ where: { severity: 'high', resolved: false } }),
      prisma.alert.findMany({
        where: {
          resolved: true,
          resolvedAt: { not: null },
        },
        select: {
          createdAt: true,
          resolvedAt: true,
        },
        take: 100,
        orderBy: { resolvedAt: 'desc' },
      }),
    ]);

    // Calculate average resolution time
    let avgResolutionTimeMinutes = 0;
    if (resolvedAlerts.length > 0) {
      const totalMinutes = resolvedAlerts.reduce((sum, alert) => {
        const diff = alert.resolvedAt!.getTime() - alert.createdAt.getTime();
        return sum + diff / 60000;
      }, 0);
      avgResolutionTimeMinutes = Math.round(totalMinutes / resolvedAlerts.length);
    }

    return {
      total,
      unresolved,
      critical,
      high,
      avgResolutionTimeMinutes,
    };
  }
}

export const alertService = new AlertService();
export default alertService;
