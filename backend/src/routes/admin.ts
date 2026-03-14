/**
 * Admin Routes
 */

import { Router, Request, Response } from 'express';
import { Prisma } from '@prisma/client';
import { authenticate, requireRole } from '../middleware/auth';
import { requireMfaForSensitiveAction } from '../middleware/mfa';
import { prisma } from '../config/database';
import { env } from '../config/env';
import { integrationKeyService } from '../services/integrationKeyService';
import { whatsappPilotService } from '../services/whatsappPilotService';
import { logger } from '../utils/logger';

const router: Router = Router();
router.use(authenticate);
router.use(requireRole('admin', 'super_admin'));

const writeIntegrationKeyAudit = async (
  req: Request,
  args: {
    operation: string;
    provider?: string;
    keyNames?: string[];
    status: 'success' | 'failure';
    details?: Record<string, unknown>;
    errorMessage?: string;
  }
): Promise<void> => {
  try {
    const userAgentHeader = req.headers['user-agent'];
    const userAgent = typeof userAgentHeader === 'string' ? userAgentHeader : null;
    const newValues: Record<string, unknown> = {
      operation: args.operation,
    };
    if (args.provider) {
      newValues['provider'] = args.provider;
    }
    if (args.keyNames) {
      newValues['keyNames'] = args.keyNames;
    }
    if (args.details) {
      Object.assign(newValues, args.details);
    }

    await prisma.auditLog.create({
      data: {
        userId: req.user?.userId,
        action: 'ADMIN_ACTION',
        entityType: 'integration_key',
        entityId: args.provider || 'integration_keys',
        newValues: newValues as Prisma.InputJsonValue,
        ipAddress: req.ip || req.socket.remoteAddress,
        userAgent,
        status: args.status,
        errorMessage: args.errorMessage || null,
      },
    });
  } catch (error) {
    logger.warn({
      message: 'Failed to persist integration key audit log',
      error: error instanceof Error ? error.message : 'Unknown error',
      operation: args.operation,
      provider: args.provider,
    });
  }
};

type RuntimeProbeResult = {
  ok: boolean;
  status: number | null;
  error: string | null;
};

const normalizeBaseUrl = (value: string): string | null => {
  const trimmed = value.trim();
  if (!trimmed) return null;

  try {
    const url = new URL(trimmed);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
      return null;
    }
    return url.origin;
  } catch {
    return null;
  }
};

const probeEndpoint = async (args: {
  url: string;
  method?: 'GET' | 'POST';
  expectedStatuses: number[];
  body?: string;
}): Promise<RuntimeProbeResult> => {
  const { url, method = 'GET', expectedStatuses, body } = args;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000);

  try {
    const response = await fetch(url, {
      method,
      headers: body ? { 'content-type': 'application/json' } : undefined,
      body,
      signal: controller.signal,
    });

    return {
      ok: expectedStatuses.includes(response.status),
      status: response.status,
      error: null,
    };
  } catch (error) {
    return {
      ok: false,
      status: null,
      error: error instanceof Error ? error.message : 'request_failed',
    };
  } finally {
    clearTimeout(timeout);
  }
};

router.get('/users', async (req: Request, res: Response) => {
  try {
    const page = parseInt(req.query['page'] as string) || 1;
    const limit = parseInt(req.query['limit'] as string) || 20;
    const skip = (page - 1) * limit;

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        skip,
        take: limit,
        select: { id: true, email: true, firstName: true, lastName: true, role: true, createdAt: true },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.user.count(),
    ]);

    res.json({ status: 'success', data: { users, total, page, limit } });
  } catch (error) {
    logger.error({ message: 'Failed to fetch users', error: error instanceof Error ? error.message : 'Unknown' });
    res.status(500).json({ status: 'error', message: 'Failed to fetch users' });
  }
});

router.get('/audit-logs', async (req: Request, res: Response) => {
  try {
    const page = parseInt(req.query['page'] as string) || 1;
    const limit = parseInt(req.query['limit'] as string) || 20;
    const skip = (page - 1) * limit;

    const [logs, total] = await Promise.all([
      prisma.auditLog.findMany({
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.auditLog.count(),
    ]);

    res.json({ status: 'success', data: { logs, total, page, limit } });
  } catch (error) {
    logger.error({ message: 'Failed to fetch audit logs', error: error instanceof Error ? error.message : 'Unknown' });
    res.status(500).json({ status: 'error', message: 'Failed to fetch audit logs' });
  }
});

router.get('/stats', async (_req: Request, res: Response) => {
  try {
    const [
      totalPatients,
      totalDoctors,
      activeAlerts,
      totalAppointments,
      activeUsers,
    ] = await Promise.all([
      prisma.patient.count(),
      prisma.doctor.count(),
      prisma.alert.count({ where: { resolved: false } }),
      prisma.appointment.count(),
      prisma.user.count({ where: { status: 'active' } }),
    ]);

    res.json({
      status: 'success',
      data: {
        stats: {
          totalPatients,
          totalDoctors,
          activeAlerts,
          totalAppointments,
          activeUsers,
        },
      },
    });
  } catch (error) {
    logger.error({
      message: 'Failed to fetch admin stats',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    res.status(500).json({ status: 'error', message: 'Internal server error' });
  }
});

router.put('/settings', requireRole('super_admin'), async (req: Request, res: Response) => {
  res.json({ status: 'success', message: 'Settings updated' });
});

router.get('/integrations/keys/status', async (_req: Request, res: Response) => {
  try {
    const data = await integrationKeyService.getStatus();
    res.json({
      status: 'success',
      data,
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: error instanceof Error ? error.message : 'Failed to load integration key status',
    });
  }
});

router.put(
  '/integrations/keys/:provider',
  requireRole('super_admin'),
  requireMfaForSensitiveAction,
  async (req: Request, res: Response) => {
    const provider = req.params['provider'];
    try {
      if (!provider) {
        res.status(400).json({
          status: 'error',
          message: 'provider is required',
        });
        return;
      }

      const body = req.body as Record<string, unknown>;
      const keysInput = body['keys'];
      if (!keysInput || typeof keysInput !== 'object' || Array.isArray(keysInput)) {
        res.status(400).json({
          status: 'error',
          message: 'keys object is required',
        });
        return;
      }

      const keys = keysInput as Record<string, unknown>;
      const normalized: Record<string, string> = {};
      for (const [key, value] of Object.entries(keys)) {
        if (typeof value === 'string') {
          normalized[key] = value;
        }
      }

      const actorUserId =
        (req as unknown as { user?: { userId?: string } }).user?.userId || 'super-admin';

      const status = await integrationKeyService.updateProviderKeys(
        provider,
        normalized,
        actorUserId
      );

      await writeIntegrationKeyAudit(req, {
        operation: 'keys_update',
        provider,
        keyNames: Object.keys(normalized),
        status: 'success',
        details: {
          configuredCount: status.configuredCount,
          totalKeys: status.totalKeys,
        },
      });

      res.json({
        status: 'success',
        data: {
          provider: status.provider,
          configuredCount: status.configuredCount,
          totalKeys: status.totalKeys,
          status,
        },
      });
    } catch (error) {
      await writeIntegrationKeyAudit(req, {
        operation: 'keys_update',
        provider,
        status: 'failure',
        errorMessage: error instanceof Error ? error.message : 'Failed to update integration keys',
      });

      res.status(400).json({
        status: 'error',
        message: error instanceof Error ? error.message : 'Failed to update integration keys',
      });
    }
  }
);

router.post('/integrations/keys/:provider/validate', async (req: Request, res: Response) => {
  const provider = req.params['provider'];
  try {
    if (!provider) {
      res.status(400).json({
        status: 'error',
        message: 'provider is required',
      });
      return;
    }

    const result = await integrationKeyService.validateProvider(provider);

    await writeIntegrationKeyAudit(req, {
      operation: 'keys_validate',
      provider,
      status: result.valid ? 'success' : 'failure',
      details: {
        valid: result.valid,
        checks: result.checks,
      },
      errorMessage: result.valid ? undefined : result.message,
    });

    res.json({
      status: 'success',
      data: result,
    });
  } catch (error) {
    await writeIntegrationKeyAudit(req, {
      operation: 'keys_validate',
      provider,
      status: 'failure',
      errorMessage: error instanceof Error ? error.message : 'Failed to validate provider keys',
    });

    res.status(400).json({
      status: 'error',
      message: error instanceof Error ? error.message : 'Failed to validate provider keys',
    });
  }
});

router.post(
  '/integrations/keys/:provider/rotate',
  requireRole('super_admin'),
  requireMfaForSensitiveAction,
  async (req: Request, res: Response) => {
    const provider = req.params['provider'];
    try {
      if (!provider) {
        res.status(400).json({
          status: 'error',
          message: 'provider is required',
        });
        return;
      }

      const body = req.body as Record<string, unknown>;
      const keyNamesInput = body['keyNames'];
      const reasonInput = body['reason'];
      const keyNames = Array.isArray(keyNamesInput)
        ? keyNamesInput.filter((value): value is string => typeof value === 'string')
        : undefined;
      const reason = typeof reasonInput === 'string' && reasonInput.trim() !== '' ? reasonInput : undefined;

      const actorUserId =
        (req as unknown as { user?: { userId?: string } }).user?.userId || 'super-admin';
      const result = await integrationKeyService.rotateProviderKeys({
        providerInput: provider,
        keyNames,
        actorUserId,
        reason,
      });

      await writeIntegrationKeyAudit(req, {
        operation: 'keys_rotate',
        provider,
        keyNames: result.rotatedKeys.map((item) => item.keyName),
        status: 'success',
        details: {
          rotatedCount: result.rotatedCount,
          skippedCount: result.skippedKeys.length,
        },
      });

      res.json({
        status: 'success',
        data: result,
      });
    } catch (error) {
      await writeIntegrationKeyAudit(req, {
        operation: 'keys_rotate',
        provider,
        status: 'failure',
        errorMessage: error instanceof Error ? error.message : 'Failed to rotate provider keys',
      });

      res.status(400).json({
        status: 'error',
        message: error instanceof Error ? error.message : 'Failed to rotate provider keys',
      });
    }
  }
);

router.get('/integrations/keys/:provider/history', async (req: Request, res: Response) => {
  try {
    const provider = req.params['provider'];
    if (!provider) {
      res.status(400).json({
        status: 'error',
        message: 'provider is required',
      });
      return;
    }

    const requestedLimit = Number(req.query['limit']);
    const limit = Number.isFinite(requestedLimit) ? requestedLimit : 50;
    const history = await integrationKeyService.getProviderHistory(provider, limit);
    res.json({
      status: 'success',
      data: history,
    });
  } catch (error) {
    res.status(400).json({
      status: 'error',
      message: error instanceof Error ? error.message : 'Failed to load provider history',
    });
  }
});

router.post(
  '/integrations/keys/:provider/rollback',
  requireRole('super_admin'),
  requireMfaForSensitiveAction,
  async (req: Request, res: Response) => {
    const provider = req.params['provider'];
    try {
      if (!provider) {
        res.status(400).json({
          status: 'error',
          message: 'provider is required',
        });
        return;
      }

      const body = req.body as Record<string, unknown>;
      const keyName = body['keyName'];
      const version = Number(body['version']);
      const reason = typeof body['reason'] === 'string' ? body['reason'] : undefined;

      if (typeof keyName !== 'string' || keyName.trim() === '') {
        res.status(400).json({
          status: 'error',
          message: 'keyName is required',
        });
        return;
      }
      if (!Number.isFinite(version) || version <= 0) {
        res.status(400).json({
          status: 'error',
          message: 'version must be a positive number',
        });
        return;
      }

      const actorUserId =
        (req as unknown as { user?: { userId?: string } }).user?.userId || 'super-admin';
      const result = await integrationKeyService.rollbackProviderKey({
        providerInput: provider,
        keyNameInput: keyName.trim(),
        versionInput: version,
        actorUserId,
        reason,
      });

      await writeIntegrationKeyAudit(req, {
        operation: 'keys_rollback',
        provider,
        keyNames: [result.keyName],
        status: 'success',
        details: {
          restoredFromVersion: result.restoredFromVersion,
          newVersion: result.newVersion,
        },
      });

      res.json({
        status: 'success',
        data: result,
      });
    } catch (error) {
      await writeIntegrationKeyAudit(req, {
        operation: 'keys_rollback',
        provider,
        status: 'failure',
        errorMessage: error instanceof Error ? error.message : 'Failed to rollback provider key',
      });

      res.status(400).json({
        status: 'error',
        message: error instanceof Error ? error.message : 'Failed to rollback provider key',
      });
    }
  }
);

router.get('/integrations/keys/audit', async (req: Request, res: Response) => {
  try {
    const providerFilter = req.query['provider'];
    const requestedLimit = Number(req.query['limit']);
    const limit = Number.isFinite(requestedLimit) ? Math.max(1, Math.min(200, requestedLimit)) : 100;

    const logs = await prisma.auditLog.findMany({
      where: {
        entityType: 'integration_key',
        ...(typeof providerFilter === 'string' && providerFilter.trim() !== ''
          ? { entityId: { startsWith: providerFilter.trim() } }
          : {}),
      },
      select: {
        id: true,
        userId: true,
        action: true,
        entityId: true,
        newValues: true,
        status: true,
        errorMessage: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });

    res.json({
      status: 'success',
      data: {
        logs,
      },
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: error instanceof Error ? error.message : 'Failed to load integration key audit logs',
    });
  }
});

router.get('/pilot/runtime/status', async (req: Request, res: Response) => {
  try {
    const keyStatus = await integrationKeyService.getStatus();

    let databaseReachable = false;
    try {
      await prisma.$queryRaw`SELECT 1`;
      databaseReachable = true;
    } catch (error) {
      logger.warn({
        message: 'Pilot runtime status: database health probe failed',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }

    const providers = keyStatus.providers.map((provider) => ({
      provider: provider.provider,
      label: provider.label,
      isValid: provider.isValid,
      requiredConfiguredCount: provider.requiredConfiguredCount,
      requiredTotal: provider.requiredTotal,
      ready:
        provider.requiredConfiguredCount >= provider.requiredTotal && provider.isValid,
      missingRequiredKeys: provider.keys
        .filter((key) => key.required && !key.configured)
        .map((key) => key.keyName),
    }));

    const webhookPaths = {
      whatsapp: '/webhooks/whatsapp',
      apple: '/webhooks/apple-health',
      android: '/webhooks/health-connect',
      googleFit: '/webhooks/google-fit',
    };

    const baseUrlQuery = req.query['baseUrl'];
    const requestedBaseUrl = typeof baseUrlQuery === 'string' ? baseUrlQuery : '';
    const normalizedBaseUrl = requestedBaseUrl ? normalizeBaseUrl(requestedBaseUrl) : null;

    if (requestedBaseUrl && !normalizedBaseUrl) {
      res.status(400).json({
        status: 'error',
        message: 'baseUrl must be a valid http/https URL',
      });
      return;
    }

    const tunnel =
      normalizedBaseUrl &&
      (() => {
        const whatsappUrl = `${normalizedBaseUrl}${webhookPaths.whatsapp}`;
        return {
          baseUrl: normalizedBaseUrl,
          endpoints: {
            health: `${normalizedBaseUrl}/health`,
            whatsapp: whatsappUrl,
            apple: `${normalizedBaseUrl}${webhookPaths.apple}`,
            android: `${normalizedBaseUrl}${webhookPaths.android}`,
          },
        };
      })();

    let tunnelChecks: {
      baseUrl: string;
      checks: {
        health: RuntimeProbeResult;
        whatsapp: RuntimeProbeResult;
        apple: RuntimeProbeResult;
        android: RuntimeProbeResult;
      };
      reachable: boolean;
    } | null = null;

    if (tunnel) {
      const [health, whatsapp, apple, android] = await Promise.all([
        probeEndpoint({
          url: tunnel.endpoints.health,
          method: 'GET',
          expectedStatuses: [200],
        }),
        probeEndpoint({
          url: tunnel.endpoints.whatsapp,
          method: 'GET',
          expectedStatuses: [403, 200],
        }),
        probeEndpoint({
          url: tunnel.endpoints.apple,
          method: 'POST',
          expectedStatuses: [401],
          body: '{}',
        }),
        probeEndpoint({
          url: tunnel.endpoints.android,
          method: 'POST',
          expectedStatuses: [401],
          body: '{}',
        }),
      ]);

      tunnelChecks = {
        baseUrl: tunnel.baseUrl,
        checks: { health, whatsapp, apple, android },
        reachable: health.ok && whatsapp.ok && apple.ok && android.ok,
      };
    }

    res.json({
      status: 'success',
      data: {
        generatedAt: new Date().toISOString(),
        local: {
          apiHealthy: true,
          databaseReachable,
          nodeEnv: env.NODE_ENV,
          port: env.PORT,
          uptimeSeconds: Math.floor(process.uptime()),
        },
        providers,
        webhookPaths,
        tunnel: tunnelChecks,
      },
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: error instanceof Error ? error.message : 'Failed to fetch pilot runtime status',
    });
  }
});

router.get('/pilot/overview', async (req: Request, res: Response) => {
  try {
    const requestedHours = Number(req.query['hours']);
    const hours = Number.isFinite(requestedHours)
      ? Math.max(1, Math.min(24 * 14, requestedHours))
      : 24;
    const since = new Date(Date.now() - hours * 60 * 60 * 1000);

    const [
      whatsappOptedInPatients,
      whatsappFollowUpsCompleted,
      whatsappConversationsActive,
      whatsappMessagesInbound,
      whatsappMessagesOutbound,
      outboundStatusGroups,
      flowStepGroups,
      recentCheckIns,
      connectedDevices,
      appleWatchConnected,
      appleWatchSyncedInWindow,
      recentAppleSyncs,
      triageGroups,
      avgWellbeingAgg,
    ] = await Promise.all([
      prisma.patient.count({
        where: {
          whatsappOptedIn: true,
          whatsappPhone: { not: null },
        },
      }),
      prisma.checkIn.count({
        where: {
          channel: 'whatsapp',
          timestamp: { gte: since },
        },
      }),
      prisma.conversation.count({
        where: {
          channel: 'whatsapp',
          status: 'active',
        },
      }),
      prisma.chatMessage.count({
        where: {
          channel: 'whatsapp',
          direction: 'inbound',
          createdAt: { gte: since },
        },
      }),
      prisma.chatMessage.count({
        where: {
          channel: 'whatsapp',
          direction: 'outbound',
          createdAt: { gte: since },
        },
      }),
      prisma.chatMessage.groupBy({
        by: ['whatsappStatus'],
        where: {
          channel: 'whatsapp',
          direction: 'outbound',
          createdAt: { gte: since },
        },
        _count: { _all: true },
      }),
      prisma.chatMessage.groupBy({
        by: ['flowStep'],
        where: {
          channel: 'whatsapp',
          createdAt: { gte: since },
        },
        _count: { _all: true },
      }),
      prisma.checkIn.findMany({
        where: {
          channel: 'whatsapp',
          timestamp: { gte: since },
        },
        include: {
          patient: {
            include: {
              user: {
                select: {
                  firstName: true,
                  lastName: true,
                },
              },
            },
          },
        },
        orderBy: { timestamp: 'desc' },
        take: 10,
      }),
      prisma.wearableDevice.count({
        where: {
          isConnected: true,
        },
      }),
      prisma.wearableDevice.count({
        where: {
          isConnected: true,
          deviceType: 'apple_watch',
        },
      }),
      prisma.wearableDevice.count({
        where: {
          isConnected: true,
          deviceType: 'apple_watch',
          lastSyncAt: { gte: since },
        },
      }),
      prisma.wearableDevice.findMany({
        where: {
          isConnected: true,
          deviceType: 'apple_watch',
          lastSyncAt: { not: null },
        },
        include: {
          patient: {
            include: {
              user: {
                select: {
                  firstName: true,
                  lastName: true,
                },
              },
            },
          },
        },
        orderBy: { lastSyncAt: 'desc' },
        take: 10,
      }),
      prisma.checkIn.groupBy({
        by: ['triageOutcome'],
        where: {
          channel: 'whatsapp',
          timestamp: { gte: since },
        },
        _count: { _all: true },
      }),
      prisma.checkIn.aggregate({
        where: {
          channel: 'whatsapp',
          timestamp: { gte: since },
        },
        _avg: {
          wellbeingScore: true,
        },
      }),
    ]);

    const triageBreakdown = {
      red: 0,
      amber: 0,
      green: 0,
      unknown: 0,
    };

    const typedTriageGroups = triageGroups as Array<{
      triageOutcome: 'red' | 'amber' | 'green' | null;
      _count: { _all: number };
    }>;

    for (const group of typedTriageGroups) {
      const key: 'red' | 'amber' | 'green' | 'unknown' = group.triageOutcome || 'unknown';
      if (key === 'red' || key === 'amber' || key === 'green') {
        triageBreakdown[key] = group._count._all;
      } else {
        triageBreakdown.unknown += group._count._all;
      }
    }

    const deliveryStatus = {
      sent: 0,
      delivered: 0,
      read: 0,
      failed: 0,
      unknown: 0,
    };

    const typedOutboundStatusGroups = outboundStatusGroups as Array<{
      whatsappStatus: string | null;
      _count: { _all: number };
    }>;

    for (const group of typedOutboundStatusGroups) {
      const status: 'sent' | 'delivered' | 'read' | 'failed' | 'unknown' =
        group.whatsappStatus === 'sent' ||
        group.whatsappStatus === 'delivered' ||
        group.whatsappStatus === 'read' ||
        group.whatsappStatus === 'failed'
          ? group.whatsappStatus
          : 'unknown';
      if (status === 'sent' || status === 'delivered' || status === 'read' || status === 'failed') {
        deliveryStatus[status] = group._count._all;
      } else {
        deliveryStatus.unknown += group._count._all;
      }
    }

    const flowSteps = {
      wellbeing: 0,
      symptoms: 0,
      medications: 0,
      completed: 0,
      unknown: 0,
    };

    const typedFlowStepGroups = flowStepGroups as Array<{
      flowStep: string | null;
      _count: { _all: number };
    }>;

    for (const group of typedFlowStepGroups) {
      const step: 'wellbeing' | 'symptoms' | 'medications' | 'completed' | 'unknown' =
        group.flowStep === 'wellbeing' ||
        group.flowStep === 'symptoms' ||
        group.flowStep === 'medications' ||
        group.flowStep === 'completed'
          ? group.flowStep
          : 'unknown';

      if (
        step === 'wellbeing' ||
        step === 'symptoms' ||
        step === 'medications' ||
        step === 'completed'
      ) {
        flowSteps[step] = group._count._all;
      } else {
        flowSteps.unknown += group._count._all;
      }
    }

    const typedRecentAppleSyncs = recentAppleSyncs as Array<{
      id: string;
      patientId: string;
      deviceName: string | null;
      batteryLevel: number | null;
      lastSyncAt: Date | null;
      updatedAt: Date;
      patient: {
        user: {
          firstName: string;
          lastName: string;
        };
      };
    }>;

    const typedRecentCheckIns = recentCheckIns as Array<{
      timestamp: Date;
      patientId: string;
      triageOutcome: 'red' | 'amber' | 'green' | null;
      wellbeingScore: number | null;
      patient: {
        user: {
          firstName: string;
          lastName: string;
        };
      };
    }>;

    const now = Date.now();
    const averageAppleWatchSyncLagHours = typedRecentAppleSyncs.length
      ? Number(
          (
            typedRecentAppleSyncs.reduce((sum: number, device) => {
              const syncAt = device.lastSyncAt ? device.lastSyncAt.getTime() : now;
              const lagHours = Math.max(0, (now - syncAt) / 3600000);
              return sum + lagHours;
            }, 0) / typedRecentAppleSyncs.length
          ).toFixed(2)
        )
      : null;

    const recentEvents = [
      ...typedRecentCheckIns.map((checkIn) => ({
        type: 'check_in',
        timestamp: checkIn.timestamp.toISOString(),
        patientId: checkIn.patientId,
        patientName: `${checkIn.patient.user.firstName} ${checkIn.patient.user.lastName}`.trim(),
        triageOutcome: checkIn.triageOutcome,
        wellbeingScore: checkIn.wellbeingScore,
      })),
      ...typedRecentAppleSyncs.map((device) => ({
        type: 'apple_watch_sync',
        timestamp: device.lastSyncAt ? device.lastSyncAt.toISOString() : device.updatedAt.toISOString(),
        patientId: device.patientId,
        patientName: `${device.patient.user.firstName} ${device.patient.user.lastName}`.trim(),
        deviceId: device.id,
        deviceName: device.deviceName || 'Apple Watch',
        batteryLevel: device.batteryLevel,
      })),
    ]
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .slice(0, 20);

    res.json({
      status: 'success',
      data: {
        windowHours: hours,
        generatedAt: new Date().toISOString(),
        whatsapp: {
          optedInPatients: whatsappOptedInPatients,
          followUpsCompleted: whatsappFollowUpsCompleted,
          conversationsActive: whatsappConversationsActive,
          messagesInbound: whatsappMessagesInbound,
          messagesOutbound: whatsappMessagesOutbound,
          triageBreakdown,
          averageWellbeingScore:
            avgWellbeingAgg._avg.wellbeingScore !== null
              ? Number(avgWellbeingAgg._avg.wellbeingScore.toFixed(2))
              : null,
          deliveryStatus,
          flowSteps,
        },
        appleWatch: {
          connectedDevices,
          connectedAppleWatches: appleWatchConnected,
          syncedInWindow: appleWatchSyncedInWindow,
          averageSyncLagHours: averageAppleWatchSyncLagHours,
        },
        recentEvents,
      },
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: error instanceof Error ? error.message : 'Failed to fetch pilot overview',
    });
  }
});

router.get('/pilot/whatsapp/conversations', async (req: Request, res: Response) => {
  try {
    const requestedHours = Number(req.query['hours']);
    const hours = Number.isFinite(requestedHours)
      ? Math.max(1, Math.min(24 * 30, requestedHours))
      : 24 * 7;
    const requestedLimit = Number(req.query['limit']);
    const limit = Number.isFinite(requestedLimit)
      ? Math.max(1, Math.min(100, requestedLimit))
      : 25;
    const since = new Date(Date.now() - hours * 60 * 60 * 1000);

    const latestMessages = await prisma.chatMessage.findMany({
      where: {
        channel: 'whatsapp',
        createdAt: { gte: since },
      },
      include: {
        patient: {
          select: {
            id: true,
            whatsappPhone: true,
            user: {
              select: {
                firstName: true,
                lastName: true,
              },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: Math.min(5000, Math.max(limit * 80, 300)),
    });

    const latestByPatient = new Map<
      string,
      {
        patientId: string;
        patientName: string;
        whatsappPhone: string | null;
        latestMessageAt: string;
        latestMessagePreview: string;
        latestDirection: string;
      }
    >();

    for (const message of latestMessages) {
      if (latestByPatient.has(message.patientId)) {
        continue;
      }

      latestByPatient.set(message.patientId, {
        patientId: message.patientId,
        patientName: `${message.patient.user.firstName} ${message.patient.user.lastName}`.trim(),
        whatsappPhone: message.patient.whatsappPhone,
        latestMessageAt: message.createdAt.toISOString(),
        latestMessagePreview:
          message.content.length > 140 ? `${message.content.slice(0, 137)}...` : message.content,
        latestDirection: message.direction,
      });

      if (latestByPatient.size >= limit) {
        break;
      }
    }

    const patientIds = Array.from(latestByPatient.keys());

    const [directionCounts, connectedDevices] = await Promise.all([
      patientIds.length
        ? prisma.chatMessage.groupBy({
            by: ['patientId', 'direction'],
            where: {
              channel: 'whatsapp',
              createdAt: { gte: since },
              patientId: { in: patientIds },
            },
            _count: { _all: true },
          })
        : Promise.resolve([]),
      patientIds.length
        ? prisma.wearableDevice.findMany({
            where: {
              patientId: { in: patientIds },
              isConnected: true,
              deviceType: { in: ['apple_watch', 'wear_os', 'health_connect', 'samsung'] },
            },
            select: {
              patientId: true,
              deviceType: true,
              lastSyncAt: true,
            },
          })
        : Promise.resolve([]),
    ]);

    const countMap = new Map<string, { inbound: number; outbound: number }>();
    for (const row of directionCounts) {
      const current = countMap.get(row.patientId) || { inbound: 0, outbound: 0 };
      if (row.direction === 'inbound') {
        current.inbound = row._count._all;
      } else if (row.direction === 'outbound') {
        current.outbound = row._count._all;
      }
      countMap.set(row.patientId, current);
    }

    const syncMap = new Map<
      string,
      {
        appleWatchLastSyncAt: string | null;
        androidLastSyncAt: string | null;
      }
    >();

    for (const device of connectedDevices) {
      const current = syncMap.get(device.patientId) || {
        appleWatchLastSyncAt: null,
        androidLastSyncAt: null,
      };
      if (device.deviceType === 'apple_watch') {
        const syncAt = device.lastSyncAt ? device.lastSyncAt.toISOString() : null;
        if (!current.appleWatchLastSyncAt || (syncAt && syncAt > current.appleWatchLastSyncAt)) {
          current.appleWatchLastSyncAt = syncAt;
        }
      } else {
        const syncAt = device.lastSyncAt ? device.lastSyncAt.toISOString() : null;
        if (!current.androidLastSyncAt || (syncAt && syncAt > current.androidLastSyncAt)) {
          current.androidLastSyncAt = syncAt;
        }
      }
      syncMap.set(device.patientId, current);
    }

    const conversations = Array.from(latestByPatient.values())
      .map((summary) => {
        const counts = countMap.get(summary.patientId) || { inbound: 0, outbound: 0 };
        const sync = syncMap.get(summary.patientId) || {
          appleWatchLastSyncAt: null,
          androidLastSyncAt: null,
        };

        return {
          ...summary,
          inboundCount: counts.inbound,
          outboundCount: counts.outbound,
          appleWatchLastSyncAt: sync.appleWatchLastSyncAt,
          androidLastSyncAt: sync.androidLastSyncAt,
        };
      })
      .sort((a, b) => new Date(b.latestMessageAt).getTime() - new Date(a.latestMessageAt).getTime())
      .slice(0, limit);

    res.json({
      status: 'success',
      data: {
        windowHours: hours,
        generatedAt: new Date().toISOString(),
        conversations,
      },
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: error instanceof Error ? error.message : 'Failed to fetch pilot conversations',
    });
  }
});

router.get('/pilot/patients', async (req: Request, res: Response) => {
  try {
    const requestedLimit = Number(req.query['limit']);
    const limit = Number.isFinite(requestedLimit)
      ? Math.max(1, Math.min(300, requestedLimit))
      : 120;
    const searchInput = typeof req.query['search'] === 'string' ? req.query['search'].trim() : '';

    const patients = await prisma.patient.findMany({
      where: {
        ...(searchInput
          ? {
              OR: [
                { whatsappPhone: { contains: searchInput, mode: 'insensitive' } },
                { user: { firstName: { contains: searchInput, mode: 'insensitive' } } },
                { user: { lastName: { contains: searchInput, mode: 'insensitive' } } },
              ],
            }
          : {}),
      },
      select: {
        id: true,
        whatsappPhone: true,
        whatsappOptedIn: true,
        user: {
          select: {
            firstName: true,
            lastName: true,
          },
        },
      },
      take: limit,
    });

    const sortedPatients = patients.sort((a, b) => {
      const left = `${a.user.firstName} ${a.user.lastName}`.trim().toLowerCase();
      const right = `${b.user.firstName} ${b.user.lastName}`.trim().toLowerCase();
      return left.localeCompare(right);
    });

    const patientIds = sortedPatients.map((patient) => patient.id);
    const devices = patientIds.length
      ? await prisma.wearableDevice.findMany({
          where: {
            patientId: { in: patientIds },
            deviceType: { in: ['apple_watch', 'wear_os', 'health_connect', 'samsung'] },
          },
          orderBy: [{ isConnected: 'desc' }, { updatedAt: 'desc' }],
          select: {
            id: true,
            patientId: true,
            deviceType: true,
            deviceName: true,
            deviceModel: true,
            serialNumber: true,
            isConnected: true,
            connectionStatus: true,
            batteryLevel: true,
            lastSyncAt: true,
            updatedAt: true,
          },
        })
      : [];

    const devicesByPatient = new Map<
      string,
      Array<{
        id: string;
        deviceType: 'apple_watch' | 'wear_os' | 'health_connect' | 'samsung';
        deviceName: string | null;
        deviceModel: string | null;
        serialNumber: string | null;
        isConnected: boolean;
        connectionStatus: string;
        batteryLevel: number | null;
        lastSyncAt: string | null;
        updatedAt: string;
      }>
    >();

    for (const device of devices) {
      const typedDevice = {
        id: device.id,
        deviceType: device.deviceType as 'apple_watch' | 'wear_os' | 'health_connect' | 'samsung',
        deviceName: device.deviceName,
        deviceModel: device.deviceModel,
        serialNumber: device.serialNumber,
        isConnected: device.isConnected,
        connectionStatus: device.connectionStatus,
        batteryLevel: device.batteryLevel,
        lastSyncAt: device.lastSyncAt ? device.lastSyncAt.toISOString() : null,
        updatedAt: device.updatedAt.toISOString(),
      };
      const current = devicesByPatient.get(device.patientId) || [];
      current.push(typedDevice);
      devicesByPatient.set(device.patientId, current);
    }

    const responsePatients = sortedPatients.map((patient) => {
      const patientDevices = devicesByPatient.get(patient.id) || [];
      const connectedDevices = patientDevices.filter((device) => device.isConnected);
      const appleConnected = connectedDevices.filter((device) => device.deviceType === 'apple_watch').length;
      const androidConnected = connectedDevices.filter((device) =>
        device.deviceType === 'wear_os' ||
        device.deviceType === 'health_connect' ||
        device.deviceType === 'samsung'
      ).length;

      return {
        id: patient.id,
        name: `${patient.user.firstName} ${patient.user.lastName}`.trim(),
        whatsappPhone: patient.whatsappPhone,
        whatsappOptedIn: patient.whatsappOptedIn,
        connectedDevices: connectedDevices.length,
        appleConnectedDevices: appleConnected,
        androidConnectedDevices: androidConnected,
        devices: patientDevices,
      };
    });

    res.json({
      status: 'success',
      data: {
        generatedAt: new Date().toISOString(),
        patients: responsePatients,
      },
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: error instanceof Error ? error.message : 'Failed to fetch pilot patient roster',
    });
  }
});

router.patch('/pilot/patients/:patientId/whatsapp', async (req: Request, res: Response) => {
  try {
    const patientId = req.params['patientId'];
    if (!patientId) {
      res.status(400).json({
        status: 'error',
        message: 'patientId is required',
      });
      return;
    }

    const body = req.body as Record<string, unknown>;
    const whatsappPhoneInput = body['whatsappPhone'];
    const whatsappOptedInInput = body['whatsappOptedIn'];

    const normalizedPhone =
      typeof whatsappPhoneInput === 'string' && whatsappPhoneInput.trim() !== ''
        ? whatsappPhoneInput.trim()
        : null;
    const whatsappOptedIn =
      typeof whatsappOptedInInput === 'boolean' ? whatsappOptedInInput : false;

    if (normalizedPhone && !/^\+[1-9]\d{6,14}$/.test(normalizedPhone)) {
      res.status(400).json({
        status: 'error',
        message: 'whatsappPhone must be E.164 format (example: +14155552671)',
      });
      return;
    }

    if (whatsappOptedIn && !normalizedPhone) {
      res.status(400).json({
        status: 'error',
        message: 'whatsappPhone is required when whatsappOptedIn is true',
      });
      return;
    }

    const patient = await prisma.patient.findUnique({
      where: { id: patientId },
      select: { id: true },
    });
    if (!patient) {
      res.status(404).json({
        status: 'error',
        message: 'Patient not found',
      });
      return;
    }

    const updated = await prisma.patient.update({
      where: { id: patientId },
      data: {
        whatsappPhone: normalizedPhone,
        whatsappOptedIn,
      },
      select: {
        id: true,
        whatsappPhone: true,
        whatsappOptedIn: true,
      },
    });

    res.json({
      status: 'success',
      data: {
        patient: {
          id: updated.id,
          whatsappPhone: updated.whatsappPhone,
          whatsappOptedIn: updated.whatsappOptedIn,
        },
      },
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: error instanceof Error ? error.message : 'Failed to update patient WhatsApp contact',
    });
  }
});

router.post('/pilot/patients/:patientId/devices', async (req: Request, res: Response) => {
  try {
    const patientId = req.params['patientId'];
    if (!patientId) {
      res.status(400).json({
        status: 'error',
        message: 'patientId is required',
      });
      return;
    }

    const patient = await prisma.patient.findUnique({
      where: { id: patientId },
      select: { id: true },
    });
    if (!patient) {
      res.status(404).json({
        status: 'error',
        message: 'Patient not found',
      });
      return;
    }

    const body = req.body as Record<string, unknown>;
    const deviceType = body['deviceType'];
    const serialNumber = body['serialNumber'];
    const deviceName = body['deviceName'];
    const deviceModel = body['deviceModel'];
    const batteryLevel = body['batteryLevel'];

    const allowedTypes = new Set(['apple_watch', 'wear_os', 'health_connect', 'samsung']);
    if (typeof deviceType !== 'string' || !allowedTypes.has(deviceType)) {
      res.status(400).json({
        status: 'error',
        message: 'deviceType must be one of apple_watch, wear_os, health_connect, samsung',
      });
      return;
    }

    if (typeof serialNumber !== 'string' || serialNumber.trim().length < 3) {
      res.status(400).json({
        status: 'error',
        message: 'serialNumber is required and must be at least 3 characters',
      });
      return;
    }

    const normalizedSerial = serialNumber.trim();
    const existing = await prisma.wearableDevice.findFirst({
      where: {
        patientId,
        deviceType: deviceType as 'apple_watch' | 'wear_os' | 'health_connect' | 'samsung',
        serialNumber: normalizedSerial,
      },
      orderBy: { createdAt: 'desc' },
      select: { id: true },
    });

    const payload = {
      patientId,
      deviceType: deviceType as 'apple_watch' | 'wear_os' | 'health_connect' | 'samsung',
      serialNumber: normalizedSerial,
      deviceName: typeof deviceName === 'string' && deviceName.trim() ? deviceName.trim() : null,
      deviceModel: typeof deviceModel === 'string' && deviceModel.trim() ? deviceModel.trim() : null,
      isConnected: true,
      connectionStatus: 'connected',
      batteryLevel:
        typeof batteryLevel === 'number' && Number.isFinite(batteryLevel)
          ? Math.max(0, Math.min(100, Math.round(batteryLevel)))
          : null,
      lastSyncAt: new Date(),
    };

    const saved = existing
      ? await prisma.wearableDevice.update({
          where: { id: existing.id },
          data: payload,
        })
      : await prisma.wearableDevice.create({
          data: payload,
        });

    res.json({
      status: 'success',
      data: {
        device: {
          id: saved.id,
          patientId: saved.patientId,
          deviceType: saved.deviceType,
          deviceName: saved.deviceName,
          deviceModel: saved.deviceModel,
          serialNumber: saved.serialNumber,
          isConnected: saved.isConnected,
          connectionStatus: saved.connectionStatus,
          batteryLevel: saved.batteryLevel,
          lastSyncAt: saved.lastSyncAt ? saved.lastSyncAt.toISOString() : null,
        },
      },
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: error instanceof Error ? error.message : 'Failed to connect pilot device',
    });
  }
});

router.patch('/pilot/devices/:deviceId/disconnect', async (req: Request, res: Response) => {
  try {
    const deviceId = req.params['deviceId'];
    if (!deviceId) {
      res.status(400).json({
        status: 'error',
        message: 'deviceId is required',
      });
      return;
    }

    const existing = await prisma.wearableDevice.findUnique({
      where: { id: deviceId },
      select: { id: true },
    });
    if (!existing) {
      res.status(404).json({
        status: 'error',
        message: 'Device not found',
      });
      return;
    }

    const updated = await prisma.wearableDevice.update({
      where: { id: deviceId },
      data: {
        isConnected: false,
        connectionStatus: 'disconnected',
      },
      select: {
        id: true,
        patientId: true,
        deviceType: true,
        deviceName: true,
        serialNumber: true,
        isConnected: true,
        connectionStatus: true,
        batteryLevel: true,
        lastSyncAt: true,
      },
    });

    res.json({
      status: 'success',
      data: {
        device: {
          ...updated,
          lastSyncAt: updated.lastSyncAt ? updated.lastSyncAt.toISOString() : null,
        },
      },
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: error instanceof Error ? error.message : 'Failed to disconnect pilot device',
    });
  }
});

router.patch('/pilot/devices/:deviceId/sync', async (req: Request, res: Response) => {
  try {
    const deviceId = req.params['deviceId'];
    if (!deviceId) {
      res.status(400).json({
        status: 'error',
        message: 'deviceId is required',
      });
      return;
    }

    const body = req.body as Record<string, unknown>;
    const batteryLevel = body['batteryLevel'];

    const updated = await prisma.wearableDevice.update({
      where: { id: deviceId },
      data: {
        lastSyncAt: new Date(),
        isConnected: true,
        connectionStatus: 'connected',
        ...(typeof batteryLevel === 'number' && Number.isFinite(batteryLevel)
          ? {
              batteryLevel: Math.max(0, Math.min(100, Math.round(batteryLevel))),
            }
          : {}),
      },
      select: {
        id: true,
        patientId: true,
        deviceType: true,
        deviceName: true,
        serialNumber: true,
        isConnected: true,
        connectionStatus: true,
        batteryLevel: true,
        lastSyncAt: true,
      },
    });

    res.json({
      status: 'success',
      data: {
        device: {
          ...updated,
          lastSyncAt: updated.lastSyncAt ? updated.lastSyncAt.toISOString() : null,
        },
      },
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: error instanceof Error ? error.message : 'Failed to update pilot device sync',
    });
  }
});

router.get('/pilot/whatsapp/patients/:patientId/messages', async (req: Request, res: Response) => {
  try {
    const patientId = req.params['patientId'];
    if (!patientId) {
      res.status(400).json({
        status: 'error',
        message: 'patientId is required',
      });
      return;
    }

    const requestedLimit = Number(req.query['limit']);
    const limit = Number.isFinite(requestedLimit)
      ? Math.max(1, Math.min(300, requestedLimit))
      : 100;

    const patient = await prisma.patient.findUnique({
      where: { id: patientId },
      select: {
        id: true,
        whatsappPhone: true,
        user: {
          select: {
            firstName: true,
            lastName: true,
          },
        },
      },
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
        patientId,
        channel: 'whatsapp',
      },
      orderBy: {
        createdAt: 'desc',
      },
      take: limit,
      select: {
        id: true,
        direction: true,
        senderType: true,
        content: true,
        flowStep: true,
        whatsappStatus: true,
        createdAt: true,
      },
    });
    const devices = await prisma.wearableDevice.findMany({
      where: {
        patientId,
        isConnected: true,
        deviceType: { in: ['apple_watch', 'wear_os', 'health_connect', 'samsung'] },
      },
      orderBy: { lastSyncAt: 'desc' },
      select: {
        id: true,
        deviceType: true,
        deviceName: true,
        connectionStatus: true,
        batteryLevel: true,
        lastSyncAt: true,
      },
    });

    res.json({
      status: 'success',
      data: {
        patient: {
          id: patient.id,
          name: `${patient.user.firstName} ${patient.user.lastName}`.trim(),
          whatsappPhone: patient.whatsappPhone,
        },
        messages: messages.reverse().map((message) => ({
          ...message,
          createdAt: message.createdAt.toISOString(),
        })),
        devices: devices.map((device) => ({
          ...device,
          lastSyncAt: device.lastSyncAt ? device.lastSyncAt.toISOString() : null,
        })),
      },
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: error instanceof Error ? error.message : 'Failed to fetch patient messages',
    });
  }
});

router.post('/pilot/whatsapp/follow-up/:patientId', async (req: Request, res: Response) => {
  try {
    const patientId = req.params['patientId'];
    if (!patientId) {
      res.status(400).json({
        status: 'error',
        message: 'patientId is required',
      });
      return;
    }

    const result = await whatsappPilotService.startFollowUpForPatient(patientId);

    res.json({
      status: 'success',
      data: result,
    });
  } catch (error) {
    res.status(400).json({
      status: 'error',
      message: error instanceof Error ? error.message : 'Failed to start follow-up',
    });
  }
});

router.post('/pilot/whatsapp/follow-up-batch', async (req: Request, res: Response) => {
  try {
    const requestedLimit = Number(req.body?.limit);
    const limit = Number.isFinite(requestedLimit)
      ? Math.max(1, Math.min(100, requestedLimit))
      : 25;

    const result = await whatsappPilotService.startFollowUpBatch(limit);

    res.json({
      status: 'success',
      data: result,
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: error instanceof Error ? error.message : 'Failed to start follow-up batch',
    });
  }
});

export default router;
