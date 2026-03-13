/**
 * Clinical read-only pilot routes (doctor/nurse/admin)
 */

import { Prisma } from '@prisma/client';
import { Router, Request, Response } from 'express';
import { authenticate, requireRole } from '../middleware/auth';
import { prisma } from '../config/database';

const router: Router = Router();
router.use(authenticate);
router.use(requireRole('doctor', 'nurse', 'admin', 'super_admin'));

const getScopedPatientIds = async (req: Request): Promise<string[] | null> => {
  const role = req.user?.role;
  const userId = req.user?.userId;

  if (!role || !userId) {
    return [];
  }

  if (role === 'admin' || role === 'super_admin' || role === 'nurse') {
    return null;
  }

  if (role !== 'doctor') {
    return [];
  }

  const doctor = await prisma.doctor.findUnique({
    where: { userId },
    select: { id: true },
  });

  if (!doctor) {
    return [];
  }

  const assignments = await prisma.doctorPatientAssignment.findMany({
    where: {
      doctorId: doctor.id,
      status: 'active',
    },
    select: {
      patientId: true,
    },
  });

  return assignments.map((assignment) => assignment.patientId);
};

router.get('/pilot/overview', async (req: Request, res: Response) => {
  try {
    const requestedHours = Number(req.query['hours']);
    const hours = Number.isFinite(requestedHours)
      ? Math.max(1, Math.min(24 * 14, requestedHours))
      : 24;
    const since = new Date(Date.now() - hours * 60 * 60 * 1000);

    const scopedPatientIds = await getScopedPatientIds(req);

    const patientScopeWhere: Prisma.PatientWhereInput =
      scopedPatientIds === null ? {} : { id: { in: scopedPatientIds } };
    const patientIdScope =
      scopedPatientIds === null ? {} : { patientId: { in: scopedPatientIds } };

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
          ...patientScopeWhere,
          whatsappOptedIn: true,
          whatsappPhone: { not: null },
        },
      }),
      prisma.checkIn.count({
        where: {
          ...patientIdScope,
          channel: 'whatsapp',
          timestamp: { gte: since },
        },
      }),
      prisma.conversation.count({
        where: {
          ...patientIdScope,
          channel: 'whatsapp',
          status: 'active',
        },
      }),
      prisma.chatMessage.count({
        where: {
          ...patientIdScope,
          channel: 'whatsapp',
          direction: 'inbound',
          createdAt: { gte: since },
        },
      }),
      prisma.chatMessage.count({
        where: {
          ...patientIdScope,
          channel: 'whatsapp',
          direction: 'outbound',
          createdAt: { gte: since },
        },
      }),
      prisma.chatMessage.groupBy({
        by: ['whatsappStatus'],
        where: {
          ...patientIdScope,
          channel: 'whatsapp',
          direction: 'outbound',
          createdAt: { gte: since },
        },
        _count: { _all: true },
      }),
      prisma.chatMessage.groupBy({
        by: ['flowStep'],
        where: {
          ...patientIdScope,
          channel: 'whatsapp',
          createdAt: { gte: since },
        },
        _count: { _all: true },
      }),
      prisma.checkIn.findMany({
        where: {
          ...patientIdScope,
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
          ...patientIdScope,
          isConnected: true,
        },
      }),
      prisma.wearableDevice.count({
        where: {
          ...patientIdScope,
          isConnected: true,
          deviceType: 'apple_watch',
        },
      }),
      prisma.wearableDevice.count({
        where: {
          ...patientIdScope,
          isConnected: true,
          deviceType: 'apple_watch',
          lastSyncAt: { gte: since },
        },
      }),
      prisma.wearableDevice.findMany({
        where: {
          ...patientIdScope,
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
          ...patientIdScope,
          channel: 'whatsapp',
          timestamp: { gte: since },
        },
        _count: { _all: true },
      }),
      prisma.checkIn.aggregate({
        where: {
          ...patientIdScope,
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
      message: error instanceof Error ? error.message : 'Failed to fetch clinical pilot overview',
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

    const scopedPatientIds = await getScopedPatientIds(req);

    const latestMessages = await prisma.chatMessage.findMany({
      where: {
        channel: 'whatsapp',
        createdAt: { gte: since },
        ...(scopedPatientIds === null ? {} : { patientId: { in: scopedPatientIds } }),
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
      message: error instanceof Error ? error.message : 'Failed to fetch clinical conversations',
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

    const scopedPatientIds = await getScopedPatientIds(req);

    const patients = await prisma.patient.findMany({
      where: {
        ...(scopedPatientIds === null ? {} : { id: { in: scopedPatientIds } }),
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
      message: error instanceof Error ? error.message : 'Failed to fetch clinical patient roster',
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

    const scopedPatientIds = await getScopedPatientIds(req);
    if (scopedPatientIds !== null && !scopedPatientIds.includes(patientId)) {
      res.status(403).json({
        status: 'error',
        message: 'You do not have access to this patient',
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
      message: error instanceof Error ? error.message : 'Failed to fetch clinical patient messages',
    });
  }
});

// GET /overview — clinical dashboard summary
router.get('/overview', async (req: Request, res: Response) => {
  try {
    const scopedPatientIds = await getScopedPatientIds(req);
    const patientWhere: Prisma.PatientWhereInput =
      scopedPatientIds === null ? {} : { id: { in: scopedPatientIds } };
    const patientIdScope =
      scopedPatientIds === null ? {} : { patientId: { in: scopedPatientIds } };

    const todayStart = new Date();
    todayStart.setUTCHours(0, 0, 0, 0);

    const [totalPatients, redTriage, amberTriage, alertsToday, avgHrAgg] = await Promise.all([
      prisma.patient.count({ where: patientWhere }),
      prisma.patient.count({ where: { ...patientWhere, triageLevel: 'red' } }),
      prisma.patient.count({ where: { ...patientWhere, triageLevel: 'amber' } }),
      prisma.alert.count({
        where: { ...patientIdScope, resolved: false, createdAt: { gte: todayStart } },
      }),
      prisma.wearableReading.aggregate({
        where: { ...patientIdScope },
        _avg: { avgHeartRate: true },
      }),
    ]);

    res.json({
      status: 'success',
      data: {
        totalPatients,
        redTriage,
        amberTriage,
        alertsToday,
        avgHeartRate:
          avgHrAgg._avg.avgHeartRate !== null
            ? Math.round(avgHrAgg._avg.avgHeartRate)
            : null,
      },
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: error instanceof Error ? error.message : 'Failed to fetch clinical overview',
    });
  }
});

// GET /patients — scoped patient list with triageLevel, lastCheckIn, wearableCount
router.get('/patients', async (req: Request, res: Response) => {
  try {
    const requestedLimit = Number(req.query['limit']);
    const limit = Number.isFinite(requestedLimit)
      ? Math.max(1, Math.min(300, requestedLimit))
      : 100;

    const scopedPatientIds = await getScopedPatientIds(req);
    const patientWhere: Prisma.PatientWhereInput =
      scopedPatientIds === null ? {} : { id: { in: scopedPatientIds } };

    const patients = await prisma.patient.findMany({
      where: patientWhere,
      select: {
        id: true,
        triageLevel: true,
        lastCheckIn: true,
        user: { select: { firstName: true, lastName: true } },
        _count: { select: { wearableDevices: { where: { isConnected: true } } } },
      },
      take: limit,
      orderBy: [{ triageLevel: 'asc' }, { lastCheckIn: 'asc' }],
    });

    res.json({
      status: 'success',
      data: {
        generatedAt: new Date().toISOString(),
        patients: patients.map((p) => ({
          id: p.id,
          name: `${p.user.firstName} ${p.user.lastName}`.trim(),
          triageLevel: p.triageLevel,
          lastCheckIn: p.lastCheckIn ? p.lastCheckIn.toISOString() : null,
          wearableCount: p._count.wearableDevices,
        })),
      },
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: error instanceof Error ? error.message : 'Failed to fetch patients',
    });
  }
});

// GET /patient/:id/trend — 7-day aggregated WearableReadings
router.get('/patient/:id/trend', async (req: Request, res: Response) => {
  try {
    const patientId = req.params['id'];
    if (!patientId) {
      res.status(400).json({ status: 'error', message: 'patientId required' });
      return;
    }

    const scopedPatientIds = await getScopedPatientIds(req);
    if (scopedPatientIds !== null && !scopedPatientIds.includes(patientId)) {
      res.status(403).json({ status: 'error', message: 'Access denied' });
      return;
    }

    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    sevenDaysAgo.setUTCHours(0, 0, 0, 0);

    const readings = await prisma.wearableReading.findMany({
      where: {
        patientId,
        readingDate: { gte: sevenDaysAgo },
      },
      orderBy: { readingDate: 'asc' },
      select: {
        readingDate: true,
        avgHeartRate: true,
        steps: true,
        bloodOxygenPercent: true,
      },
    });

    // Aggregate by day
    const byDay = new Map<
      string,
      { heartRateSum: number; hrCount: number; stepsSum: number; oxySum: number; oxyCount: number }
    >();

    for (const r of readings) {
      const day = r.readingDate.toISOString().slice(0, 10);
      const current = byDay.get(day) || { heartRateSum: 0, hrCount: 0, stepsSum: 0, oxySum: 0, oxyCount: 0 };
      if (typeof r.avgHeartRate === 'number') {
        current.heartRateSum += r.avgHeartRate;
        current.hrCount += 1;
      }
      if (typeof r.steps === 'number') {
        current.stepsSum += r.steps;
      }
      if (r.bloodOxygenPercent !== null) {
        current.oxySum += Number(r.bloodOxygenPercent);
        current.oxyCount += 1;
      }
      byDay.set(day, current);
    }

    const trend = Array.from(byDay.entries()).map(([date, agg]) => ({
      date,
      avgHeartRate: agg.hrCount > 0 ? Math.round(agg.heartRateSum / agg.hrCount) : null,
      steps: agg.stepsSum || null,
      bloodOxygenPercent: agg.oxyCount > 0 ? Number((agg.oxySum / agg.oxyCount).toFixed(1)) : null,
    }));

    res.json({ status: 'success', data: { patientId, trend } });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: error instanceof Error ? error.message : 'Failed to fetch trend',
    });
  }
});

export default router;
