/**
 * Webhook Route Integration-Style Tests
 * Verifies signature checks and patient ownership enforcement.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Request, Response } from 'express';

const mocks = vi.hoisted(() => ({
  prisma: {
    wearableDevice: {
      findFirst: vi.fn(),
      update: vi.fn(),
    },
    wearableReading: {
      upsert: vi.fn(),
    },
  },
  whatsappPilotService: {
    verifyWebhookSignature: vi.fn(),
    processWebhook: vi.fn(),
  },
  appleHealthKitProvider: {
    validateWebhook: vi.fn(),
    processHeartRateSamples: vi.fn(),
    processSleepSamples: vi.fn(),
    processBloodOxygenSamples: vi.fn(),
    processHRVSamples: vi.fn(),
  },
  healthConnectProvider: {
    validateWebhook: vi.fn(),
    processHealthConnectPush: vi.fn(),
  },
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock('../src/config/database', () => ({
  prisma: mocks.prisma,
}));

vi.mock('../src/services/whatsappPilotService', () => ({
  whatsappPilotService: mocks.whatsappPilotService,
}));

vi.mock('../src/services/wearables/appleHealthKit', () => ({
  appleHealthKitProvider: mocks.appleHealthKitProvider,
}));

vi.mock('../src/services/wearables/healthConnect', () => ({
  healthConnectProvider: mocks.healthConnectProvider,
}));

vi.mock('../src/utils/logger', () => ({
  logger: mocks.logger,
}));

vi.mock('../src/config/env', () => ({
  env: {
    WHATSAPP_WEBHOOK_VERIFY_TOKEN: 'verify-token',
    WHATSAPP_WEBHOOK_SECRET: 'whatsapp-test-secret',
    ENCRYPTION_KEY: 'test_encryption_key_32_characters_long!',
  },
}));

import webhookRouter from '../src/routes/webhooks';

type RouteMethod = 'get' | 'post';
type RouteHandler = (req: Request, res: Response) => void | Promise<void>;
type RouterLayer = {
  route?: {
    path: string;
    methods: Record<string, boolean>;
    stack: Array<{ method: string; handle: RouteHandler }>;
  };
};

type MockResponse = Response & {
  statusCode: number;
  jsonBody?: unknown;
  sentBody?: unknown;
};

const getRouteHandler = (path: string, method: RouteMethod): RouteHandler => {
  const routerStack = (webhookRouter as unknown as { stack: RouterLayer[] }).stack;
  const layer = routerStack.find(
    (item) => item.route?.path === path && item.route.methods[method]
  );

  if (!layer?.route) {
    throw new Error(`Route not found: ${method.toUpperCase()} ${path}`);
  }

  const routeStackItem = layer.route.stack.find((item) => item.method === method);
  if (!routeStackItem) {
    throw new Error(`Handler not found for: ${method.toUpperCase()} ${path}`);
  }

  return routeStackItem.handle;
};

const createMockReq = (overrides: Record<string, unknown> = {}): Request => {
  return {
    headers: {},
    body: {},
    query: {},
    params: {},
    ...overrides,
  } as unknown as Request;
};

const createMockRes = (): MockResponse => {
  const res = {} as MockResponse;

  res.statusCode = 200;
  res.status = vi.fn((code: number) => {
    res.statusCode = code;
    return res;
  }) as unknown as Response['status'];
  res.sendStatus = vi.fn((code: number) => {
    res.statusCode = code;
    return res;
  }) as unknown as Response['sendStatus'];
  res.json = vi.fn((payload: unknown) => {
    res.jsonBody = payload;
    return res;
  }) as unknown as Response['json'];
  res.send = vi.fn((payload: unknown) => {
    res.sentBody = payload;
    return res;
  }) as unknown as Response['send'];

  return res;
};

describe('Webhook Routes', () => {
  const whatsappPost = getRouteHandler('/whatsapp', 'post');
  const applePost = getRouteHandler('/apple-health', 'post');
  const healthConnectPost = getRouteHandler('/health-connect', 'post');

  beforeEach(() => {
    vi.clearAllMocks();

    mocks.whatsappPilotService.processWebhook.mockResolvedValue({
      processed: 1,
      unknownPhone: 0,
    });
    mocks.appleHealthKitProvider.validateWebhook.mockReturnValue(true);
    mocks.healthConnectProvider.validateWebhook.mockReturnValue(true);
    mocks.healthConnectProvider.processHealthConnectPush.mockReturnValue({
      heartRate: [],
      sleep: [],
      activity: [],
      bloodOxygen: [],
      hrv: [],
    });
    mocks.prisma.wearableDevice.update.mockResolvedValue({ id: 'device-1' });
  });

  it('rejects WhatsApp webhook when signature is invalid', async () => {
    mocks.whatsappPilotService.verifyWebhookSignature.mockReturnValue(false);
    const req = createMockReq({
      headers: { 'x-hub-signature-256': 'sha256=bad-signature' },
      body: { entry: [] },
      rawBody: '{"entry":[]}',
    });
    const res = createMockRes();

    await whatsappPost(req, res);

    expect(mocks.whatsappPilotService.verifyWebhookSignature).toHaveBeenCalledWith(
      'sha256=bad-signature',
      '{"entry":[]}'
    );
    expect(res.sendStatus).toHaveBeenCalledWith(401);
    expect(mocks.whatsappPilotService.processWebhook).not.toHaveBeenCalled();
  });

  it('accepts WhatsApp webhook and processes payload when signature is valid', async () => {
    mocks.whatsappPilotService.verifyWebhookSignature.mockReturnValue(true);
    const req = createMockReq({
      headers: { 'x-hub-signature-256': 'sha256=good-signature' },
      body: { entry: [{ changes: [] }] },
      rawBody: '{"entry":[{"changes":[]}]}',
    });
    const res = createMockRes();

    await whatsappPost(req, res);

    expect(mocks.whatsappPilotService.verifyWebhookSignature).toHaveBeenCalledWith(
      'sha256=good-signature',
      '{"entry":[{"changes":[]}]}'
    );
    expect(res.sendStatus).toHaveBeenCalledWith(200);
    expect(mocks.whatsappPilotService.processWebhook).toHaveBeenCalledWith(req.body);
  });

  it('rejects Apple webhook when signature is invalid', async () => {
    mocks.appleHealthKitProvider.validateWebhook.mockReturnValue(false);
    const req = createMockReq({
      headers: { 'x-apple-signature': 'invalid' },
      body: {
        userId: 'user-1',
        deviceId: 'apple-serial',
        dataType: 'heart_rate',
        samples: [],
      },
      rawBody: '{"userId":"user-1","deviceId":"apple-serial","dataType":"heart_rate","samples":[]}',
    });
    const res = createMockRes();

    await applePost(req, res);

    expect(res.sendStatus).toHaveBeenCalledWith(401);
    expect(mocks.prisma.wearableDevice.findFirst).not.toHaveBeenCalled();
  });

  it('rejects Apple webhook when payload user does not match registered device owner', async () => {
    mocks.prisma.wearableDevice.findFirst.mockResolvedValue({
      id: 'wearable-1',
      patientId: 'patient-1',
      patient: {
        id: 'patient-1',
        userId: 'user-1',
      },
    });

    const req = createMockReq({
      headers: { 'x-apple-signature': 'valid' },
      body: {
        userId: 'user-other',
        deviceId: 'apple-serial',
        dataType: 'heart_rate',
        samples: [],
      },
      rawBody: '{"userId":"user-other","deviceId":"apple-serial","dataType":"heart_rate","samples":[]}',
    });
    const res = createMockRes();

    await applePost(req, res);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(mocks.prisma.wearableReading.upsert).not.toHaveBeenCalled();
    expect(mocks.prisma.wearableDevice.update).not.toHaveBeenCalled();
  });

  it('rejects Health Connect webhook when signature is invalid', async () => {
    mocks.healthConnectProvider.validateWebhook.mockReturnValue(false);
    const req = createMockReq({
      headers: { 'x-health-connect-signature': 'invalid' },
      body: {
        patientId: 'patient-1',
        deviceId: 'android-serial',
        records: [],
      },
      rawBody: '{"patientId":"patient-1","deviceId":"android-serial","records":[]}',
    });
    const res = createMockRes();

    await healthConnectPost(req, res);

    expect(res.sendStatus).toHaveBeenCalledWith(401);
    expect(mocks.prisma.wearableDevice.findFirst).not.toHaveBeenCalled();
  });

  it('rejects Health Connect webhook when payload patient does not match registered owner', async () => {
    mocks.prisma.wearableDevice.findFirst.mockResolvedValue({
      id: 'wearable-2',
      patientId: 'patient-1',
      patient: {
        id: 'patient-1',
        userId: 'user-1',
      },
    });

    const req = createMockReq({
      headers: { 'x-health-connect-signature': 'valid' },
      body: {
        patientId: 'patient-other',
        deviceId: 'android-serial',
        deviceInfo: {},
        records: [],
      },
      rawBody: '{"patientId":"patient-other","deviceId":"android-serial","deviceInfo":{},"records":[]}',
    });
    const res = createMockRes();

    await healthConnectPost(req, res);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(mocks.healthConnectProvider.processHealthConnectPush).not.toHaveBeenCalled();
    expect(mocks.prisma.wearableReading.upsert).not.toHaveBeenCalled();
  });

  it('accepts Health Connect webhook when payload patient matches registered owner', async () => {
    mocks.prisma.wearableDevice.findFirst.mockResolvedValue({
      id: 'wearable-3',
      patientId: 'patient-1',
      patient: {
        id: 'patient-1',
        userId: 'user-1',
      },
    });

    const req = createMockReq({
      headers: { 'x-health-connect-signature': 'valid' },
      body: {
        patientId: 'patient-1',
        deviceId: 'android-serial',
        deviceInfo: {},
        records: [],
        changeToken: 'ct-1',
      },
      rawBody:
        '{"patientId":"patient-1","deviceId":"android-serial","deviceInfo":{},"records":[],"changeToken":"ct-1"}',
    });
    const res = createMockRes();

    await healthConnectPost(req, res);

    expect(mocks.healthConnectProvider.processHealthConnectPush).toHaveBeenCalled();
    expect(mocks.prisma.wearableDevice.update).toHaveBeenCalledWith({
      where: { id: 'wearable-3' },
      data: { lastSyncAt: expect.any(Date) },
    });
    expect(res.json).toHaveBeenCalledWith({
      success: true,
      processed: 0,
      nextChangeToken: 'ct-1',
    });
  });
});

