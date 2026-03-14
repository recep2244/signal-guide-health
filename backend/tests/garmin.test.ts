/**
 * GarminProvider Unit Tests
 * Verifies OAuth 1.0a handling, webhook validation, push model behavior,
 * and reading extraction.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import crypto from 'crypto';

// Mock env before importing the module under test
vi.mock('../src/config/env', () => ({
  env: {
    GARMIN_CONSUMER_KEY: 'test-consumer-key',
    GARMIN_CONSUMER_SECRET: 'test-consumer-secret',
    GARMIN_WEBHOOK_SECRET: 'test-webhook-secret',
  },
}));

// Mock node-fetch / https calls so tests don't make real network requests
vi.mock('node-fetch', () => ({
  default: vi.fn(),
}));

describe('GarminProvider', () => {
  let GarminProvider: typeof import('../src/services/wearables/garmin').GarminProvider;
  let garminProvider: typeof import('../src/services/wearables/garmin').garminProvider;

  beforeEach(async () => {
    vi.resetModules();
    vi.mock('../src/config/env', () => ({
      env: {
        GARMIN_CONSUMER_KEY: 'test-consumer-key',
        GARMIN_CONSUMER_SECRET: 'test-consumer-secret',
        GARMIN_WEBHOOK_SECRET: 'test-webhook-secret',
      },
    }));
    const module = await import('../src/services/wearables/garmin');
    GarminProvider = module.GarminProvider;
    garminProvider = module.garminProvider;
  });

  describe('constructor', () => {
    it('does not throw when GARMIN_CONSUMER_KEY is absent', async () => {
      vi.resetModules();
      vi.mock('../src/config/env', () => ({
        env: {
          GARMIN_CONSUMER_KEY: '',
          GARMIN_CONSUMER_SECRET: '',
          GARMIN_WEBHOOK_SECRET: '',
        },
      }));
      const { GarminProvider: GP } = await import('../src/services/wearables/garmin');
      expect(() => new GP()).not.toThrow();
    });

    it('logs a warning when GARMIN_CONSUMER_KEY is absent', async () => {
      vi.resetModules();
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      vi.mock('../src/config/env', () => ({
        env: {
          GARMIN_CONSUMER_KEY: '',
          GARMIN_CONSUMER_SECRET: '',
          GARMIN_WEBHOOK_SECRET: '',
        },
      }));
      const { GarminProvider: GP } = await import('../src/services/wearables/garmin');
      new GP();
      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining('GARMIN_CONSUMER_KEY')
      );
      warnSpy.mockRestore();
    });

    it('exports garminProvider as singleton', () => {
      expect(garminProvider).toBeDefined();
      expect(garminProvider.provider).toBe('garmin');
    });
  });

  describe('syncHealthData', () => {
    it('returns immediately without making an outbound HTTP call', async () => {
      const fetchSpy = vi.spyOn(global, 'fetch').mockImplementation(() => {
        throw new Error('Should not make network calls');
      });

      const result = await garminProvider.syncHealthData('token123');

      expect(fetchSpy).not.toHaveBeenCalled();
      fetchSpy.mockRestore();
    });

    it('returns success with push model message', async () => {
      const result = await garminProvider.syncHealthData('token123');

      expect(result.provider).toBe('garmin');
      expect(result.success).toBe(true);
      expect(result.syncedAt).toBeInstanceOf(Date);
      expect(result.recordsCount).toEqual({
        heartRate: 0,
        sleep: 0,
        activity: 0,
        bloodOxygen: 0,
        temperature: 0,
        hrv: 0,
        bloodPressure: 0,
        ecg: 0,
      });
      expect(result.errors).toEqual(
        expect.arrayContaining([
          expect.stringContaining('push model'),
        ])
      );
    });
  });

  describe('validateWebhook', () => {
    it('returns false when webhookSecret is empty', async () => {
      vi.resetModules();
      vi.mock('../src/config/env', () => ({
        env: {
          GARMIN_CONSUMER_KEY: 'key',
          GARMIN_CONSUMER_SECRET: 'secret',
          GARMIN_WEBHOOK_SECRET: '',
        },
      }));
      const { GarminProvider: GP } = await import('../src/services/wearables/garmin');
      const provider = new GP();
      expect(provider.validateWebhook('any-sig', '{"test": true}')).toBe(false);
    });

    it('validates correct HMAC-SHA256 signature', () => {
      const payload = '{"test": "data"}';
      const secret = 'test-webhook-secret';
      const expectedSig = crypto
        .createHmac('sha256', secret)
        .update(payload)
        .digest('hex');

      expect(garminProvider.validateWebhook(expectedSig, payload)).toBe(true);
    });

    it('rejects invalid signature', () => {
      expect(garminProvider.validateWebhook('invalid-sig', '{"test": "data"}')).toBe(false);
    });
  });

  describe('parseWebhookPayload', () => {
    it('extracts userId from summaries array', () => {
      const payload = {
        summaries: [
          { userId: 'garmin-user-123', summaryId: 'sum-1', startTimeInSeconds: 1700000000 },
        ],
      };

      const result = garminProvider.parseWebhookPayload(payload);
      expect(result.userId).toBe('garmin-user-123');
    });

    it('extracts userId from dailies array', () => {
      const payload = {
        dailies: [
          { userId: 'garmin-user-456', summaryId: 'daily-1', startTimeInSeconds: 1700000000 },
        ],
      };

      const result = garminProvider.parseWebhookPayload(payload);
      expect(result.userId).toBe('garmin-user-456');
    });

    it('returns daily_summary dataType when summaries present', () => {
      const payload = {
        summaries: [
          { userId: 'user-1', summaryId: 's1', startTimeInSeconds: 1700000000 },
        ],
      };

      const result = garminProvider.parseWebhookPayload(payload);
      expect(result.dataTypes).toContain('daily_summary');
    });

    it('returns activity dataType when activities present', () => {
      const payload = {
        activities: [
          { userId: 'user-1', summaryId: 'a1', startTimeInSeconds: 1700000000 },
        ],
      };

      const result = garminProvider.parseWebhookPayload(payload);
      expect(result.dataTypes).toContain('activity');
    });
  });

  describe('extractReadingsFromSummary', () => {
    it('extracts HEART_RATE when averageHeartRateInBeatsPerMinute present', () => {
      const summary = {
        userId: 'user-1',
        summaryId: 's1',
        startTimeInSeconds: 1700000000,
        averageHeartRateInBeatsPerMinute: 72,
      };

      const readings = garminProvider.extractReadingsFromSummary(summary, 'patient-1', 'device-1');
      const hrReading = readings.find((r) => r.type === 'HEART_RATE');
      expect(hrReading).toBeDefined();
      expect(hrReading?.value).toBe(72);
      expect(hrReading?.unit).toBe('bpm');
    });

    it('extracts STEPS when steps present', () => {
      const summary = {
        userId: 'user-1',
        summaryId: 's1',
        startTimeInSeconds: 1700000000,
        steps: 8543,
      };

      const readings = garminProvider.extractReadingsFromSummary(summary, 'patient-1', 'device-1');
      const stepsReading = readings.find((r) => r.type === 'STEPS');
      expect(stepsReading).toBeDefined();
      expect(stepsReading?.value).toBe(8543);
      expect(stepsReading?.unit).toBe('steps');
    });

    it('extracts OXYGEN_SATURATION when averageSpO2 present', () => {
      const summary = {
        userId: 'user-1',
        summaryId: 's1',
        startTimeInSeconds: 1700000000,
        averageSpO2: 97,
      };

      const readings = garminProvider.extractReadingsFromSummary(summary, 'patient-1', 'device-1');
      const spo2Reading = readings.find((r) => r.type === 'OXYGEN_SATURATION');
      expect(spo2Reading).toBeDefined();
      expect(spo2Reading?.value).toBe(97);
      expect(spo2Reading?.unit).toBe('%');
    });

    it('returns empty array when no metrics present', () => {
      const summary = {
        userId: 'user-1',
        summaryId: 's1',
        startTimeInSeconds: 1700000000,
      };

      const readings = garminProvider.extractReadingsFromSummary(summary, 'patient-1', 'device-1');
      expect(readings).toHaveLength(0);
    });
  });

  describe('stub methods (on-demand pull not supported)', () => {
    const now = new Date();

    it('getHeartRate throws push-only error', async () => {
      await expect(garminProvider.getHeartRate('token', now, now)).rejects.toThrow(
        expect.objectContaining({ message: expect.stringContaining('push') })
      );
    });

    it('getSleep throws push-only error', async () => {
      await expect(garminProvider.getSleep('token', now, now)).rejects.toThrow();
    });

    it('getActivity throws push-only error', async () => {
      await expect(garminProvider.getActivity('token', now, now)).rejects.toThrow();
    });

    it('getBloodOxygen throws push-only error', async () => {
      await expect(garminProvider.getBloodOxygen('token', now, now)).rejects.toThrow();
    });

    it('getHRV throws push-only error', async () => {
      await expect(garminProvider.getHRV('token', now, now)).rejects.toThrow();
    });
  });

  describe('getAuthorizationUrl', () => {
    it('returns placeholder URL when consumerKey is empty', async () => {
      vi.resetModules();
      vi.mock('../src/config/env', () => ({
        env: {
          GARMIN_CONSUMER_KEY: '',
          GARMIN_CONSUMER_SECRET: '',
          GARMIN_WEBHOOK_SECRET: '',
        },
      }));
      const { GarminProvider: GP } = await import('../src/services/wearables/garmin');
      const provider = new GP();
      const url = await provider.getAuthorizationUrl('mystate');
      expect(url).toContain('error=partner_approval_pending');
    });
  });

  describe('refreshTokens', () => {
    it('returns the same token (no-op for OAuth 1.0a)', async () => {
      const result = await garminProvider.refreshTokens('my-token-secret');
      expect(result.accessToken).toBe('my-token-secret');
    });
  });

  describe('revokeAccess', () => {
    it('returns true (no revocation endpoint)', async () => {
      const result = await garminProvider.revokeAccess('any-token');
      expect(result).toBe(true);
    });
  });
});
