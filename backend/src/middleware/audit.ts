/**
 * Audit Logging Middleware
 * Comprehensive audit trail for healthcare compliance (HIPAA/GDPR)
 */

import { Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { logger } from '../utils/logger';
import { env } from '../config/env';

// Audit event types
export type AuditAction =
  | 'LOGIN'
  | 'LOGOUT'
  | 'LOGIN_FAILED'
  | 'PASSWORD_CHANGE'
  | 'PASSWORD_RESET'
  | 'MFA_ENABLED'
  | 'MFA_DISABLED'
  | 'USER_CREATE'
  | 'USER_UPDATE'
  | 'USER_DELETE'
  | 'PATIENT_VIEW'
  | 'PATIENT_CREATE'
  | 'PATIENT_UPDATE'
  | 'PATIENT_DELETE'
  | 'PATIENT_SEARCH'
  | 'ALERT_VIEW'
  | 'ALERT_CREATE'
  | 'ALERT_RESOLVE'
  | 'ALERT_ESCALATE'
  | 'TRIAGE_CHANGE'
  | 'APPOINTMENT_CREATE'
  | 'APPOINTMENT_UPDATE'
  | 'APPOINTMENT_CANCEL'
  | 'WEARABLE_CONNECT'
  | 'WEARABLE_DISCONNECT'
  | 'DATA_EXPORT'
  | 'DATA_DELETE'
  | 'ADMIN_ACTION'
  | 'PERMISSION_CHANGE'
  | 'SETTINGS_CHANGE'
  | 'API_ACCESS';

// Audit log entry structure
export interface AuditLogEntry {
  id: string;
  timestamp: string;
  action: AuditAction;
  userId?: string;
  userEmail?: string;
  userRole?: string;
  organizationId?: string;
  entityType?: string;
  entityId?: string;
  oldValues?: Record<string, unknown>;
  newValues?: Record<string, unknown>;
  metadata: {
    ipAddress?: string;
    userAgent?: string;
    requestId: string;
    method: string;
    path: string;
    statusCode?: number;
    duration?: number;
  };
  status: 'success' | 'failure' | 'error';
  errorMessage?: string;
}

// Fields to exclude from audit logs (PII protection)
const EXCLUDED_FIELDS = [
  'password',
  'passwordHash',
  'token',
  'accessToken',
  'refreshToken',
  'secret',
  'apiKey',
  'mfaSecret',
];

// Mask sensitive fields in objects
const maskSensitiveFields = (
  obj: Record<string, unknown>
): Record<string, unknown> => {
  const masked: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(obj)) {
    if (EXCLUDED_FIELDS.some((f) => key.toLowerCase().includes(f.toLowerCase()))) {
      masked[key] = '[REDACTED]';
    } else if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      masked[key] = maskSensitiveFields(value as Record<string, unknown>);
    } else {
      masked[key] = value;
    }
  }

  return masked;
};

// Map HTTP method + path to audit action
const getAuditAction = (method: string, path: string): AuditAction => {
  const pathLower = path.toLowerCase();

  // Auth actions
  if (pathLower.includes('/auth/login')) return 'LOGIN';
  if (pathLower.includes('/auth/logout')) return 'LOGOUT';
  if (pathLower.includes('/auth/password')) return 'PASSWORD_CHANGE';
  if (pathLower.includes('/auth/reset')) return 'PASSWORD_RESET';

  // Patient actions
  if (pathLower.includes('/patients')) {
    if (method === 'GET' && pathLower.includes('/search')) return 'PATIENT_SEARCH';
    if (method === 'GET') return 'PATIENT_VIEW';
    if (method === 'POST') return 'PATIENT_CREATE';
    if (method === 'PUT' || method === 'PATCH') return 'PATIENT_UPDATE';
    if (method === 'DELETE') return 'PATIENT_DELETE';
  }

  // Alert actions
  if (pathLower.includes('/alerts')) {
    if (method === 'GET') return 'ALERT_VIEW';
    if (method === 'POST') return 'ALERT_CREATE';
    if (pathLower.includes('/resolve')) return 'ALERT_RESOLVE';
    if (pathLower.includes('/escalate')) return 'ALERT_ESCALATE';
  }

  // Triage
  if (pathLower.includes('/triage')) return 'TRIAGE_CHANGE';

  // Appointments
  if (pathLower.includes('/appointments')) {
    if (method === 'POST') return 'APPOINTMENT_CREATE';
    if (method === 'PUT' || method === 'PATCH') return 'APPOINTMENT_UPDATE';
    if (method === 'DELETE' || pathLower.includes('/cancel')) return 'APPOINTMENT_CANCEL';
  }

  // Wearables
  if (pathLower.includes('/wearables')) {
    if (pathLower.includes('/connect')) return 'WEARABLE_CONNECT';
    if (pathLower.includes('/disconnect')) return 'WEARABLE_DISCONNECT';
  }

  // Admin
  if (pathLower.includes('/admin')) return 'ADMIN_ACTION';

  // Default
  return 'API_ACCESS';
};

// Extract entity info from request
const extractEntityInfo = (
  req: Request
): { entityType?: string; entityId?: string } => {
  const path = req.path;
  const pathParts = path.split('/').filter(Boolean);

  // Common patterns: /api/v1/patients/:id, /api/v1/alerts/:id
  const entityTypes = ['patients', 'doctors', 'alerts', 'appointments', 'wearables', 'users'];

  for (let i = 0; i < pathParts.length; i++) {
    if (entityTypes.includes(pathParts[i]) && pathParts[i + 1]) {
      // Check if next part looks like an ID (UUID or alphanumeric)
      const potentialId = pathParts[i + 1];
      if (
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(potentialId) ||
        /^[a-z0-9-_]+$/i.test(potentialId)
      ) {
        return {
          entityType: pathParts[i].replace(/s$/, ''), // Remove trailing 's'
          entityId: potentialId,
        };
      }
    }
  }

  return {};
};

/**
 * Audit logger middleware
 * Logs all API requests with relevant metadata
 */
export const auditLogger = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  if (!env.ENABLE_AUDIT_LOGGING) {
    next();
    return;
  }

  const startTime = Date.now();
  const requestId = (req.headers['x-request-id'] as string) || uuidv4();
  req.requestId = requestId;

  // Capture original values for change tracking
  const originalBody = req.body ? maskSensitiveFields({ ...req.body }) : undefined;

  // Override res.json to capture response
  const originalJson = res.json.bind(res);
  let responseBody: unknown;

  res.json = (body: unknown) => {
    responseBody = body;
    return originalJson(body);
  };

  // Log on response finish
  res.on('finish', () => {
    const duration = Date.now() - startTime;
    const action = getAuditAction(req.method, req.path);
    const { entityType, entityId } = extractEntityInfo(req);

    const auditEntry: AuditLogEntry = {
      id: uuidv4(),
      timestamp: new Date().toISOString(),
      action,
      userId: req.user?.userId,
      userEmail: req.user?.email,
      userRole: req.user?.role,
      organizationId: req.user?.organizationId,
      entityType,
      entityId,
      oldValues: undefined, // Would be populated by service layer
      newValues: originalBody,
      metadata: {
        ipAddress: req.ip || req.socket.remoteAddress,
        userAgent: req.headers['user-agent'],
        requestId,
        method: req.method,
        path: req.path,
        statusCode: res.statusCode,
        duration,
      },
      status: res.statusCode < 400 ? 'success' : res.statusCode < 500 ? 'failure' : 'error',
      errorMessage:
        res.statusCode >= 400 && responseBody && typeof responseBody === 'object'
          ? (responseBody as Record<string, unknown>).message as string
          : undefined,
    };

    // Log audit entry
    logger.info({
      type: 'audit',
      ...auditEntry,
    });

    // In production, also write to audit_logs table
    // await prisma.auditLog.create({ data: auditEntry });
  });

  next();
};

/**
 * Manual audit log function for use in services
 */
export const logAuditEvent = async (
  action: AuditAction,
  options: {
    userId?: string;
    userEmail?: string;
    userRole?: string;
    organizationId?: string;
    entityType?: string;
    entityId?: string;
    oldValues?: Record<string, unknown>;
    newValues?: Record<string, unknown>;
    requestId?: string;
    ipAddress?: string;
    status?: 'success' | 'failure' | 'error';
    errorMessage?: string;
  }
): Promise<void> => {
  const auditEntry: AuditLogEntry = {
    id: uuidv4(),
    timestamp: new Date().toISOString(),
    action,
    userId: options.userId,
    userEmail: options.userEmail,
    userRole: options.userRole,
    organizationId: options.organizationId,
    entityType: options.entityType,
    entityId: options.entityId,
    oldValues: options.oldValues ? maskSensitiveFields(options.oldValues) : undefined,
    newValues: options.newValues ? maskSensitiveFields(options.newValues) : undefined,
    metadata: {
      ipAddress: options.ipAddress,
      requestId: options.requestId || uuidv4(),
      method: 'INTERNAL',
      path: 'N/A',
    },
    status: options.status || 'success',
    errorMessage: options.errorMessage,
  };

  logger.info({
    type: 'audit',
    ...auditEntry,
  });

  // In production, persist to database
  // await prisma.auditLog.create({ data: auditEntry });
};
