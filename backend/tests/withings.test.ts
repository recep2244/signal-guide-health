/**
 * WithingsProvider Tests
 * TDD: RED phase — tests written before implementation
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock env config so we don't need real env vars
vi.mock('../src/config/env', () => ({
  env: {
    WITHINGS_CLIENT_ID: 'test-client-id',
    WITHINGS_CLIENT_SECRET: 'test-client-secret',
    WITHINGS_REDIRECT_URI: 'https://example.com/callback/withings',
    WITHINGS_WEBHOOK_SECRET: 'test-webhook-secret',
    ENCRYPTION_KEY: 'test_encryption_key_32_characters_long!',
  },
}));

// Import after mock is set up
const { WithingsProvider } = await import('../src/services/wearables/withings');

describe('WithingsProvider', () => {
  let provider: InstanceType<typeof WithingsProvider>;

  beforeEach(() => {
    provider = new WithingsProvider();
    vi.clearAllMocks();
  });

  describe('provider identity', () => {
    it('has provider set to withings', () => {
      expect(provider.provider).toBe('withings');
    });
  });

  describe('getAuthorizationUrl', () => {
    it('returns URL containing account.withings.com/oauth2_user/authorize2', () => {
      const url = provider.getAuthorizationUrl('test-state');
      expect(url).toContain('account.withings.com/oauth2_user/authorize2');
    });

    it('includes response_type=code', () => {
      const url = provider.getAuthorizationUrl('test-state');
      expect(url).toContain('response_type=code');
    });

    it('includes the client_id', () => {
      const url = provider.getAuthorizationUrl('test-state');
      expect(url).toContain('client_id=test-client-id');
    });

    it('includes scope=user.metrics,user.activity', () => {
      const url = provider.getAuthorizationUrl('test-state');
      const decoded = decodeURIComponent(url);
      expect(decoded).toContain('scope=user.metrics,user.activity');
    });

    it('includes the state parameter', () => {
      const url = provider.getAuthorizationUrl('my-state-xyz');
      expect(url).toContain('state=my-state-xyz');
    });

    it('includes the redirect_uri', () => {
      const url = provider.getAuthorizationUrl('test-state');
      expect(url).toContain('redirect_uri');
    });
  });

  describe('exchangeCodeForTokens', () => {
    it('POSTs to wbsapi.withings.net/v2/oauth2', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          status: 0,
          body: {
            access_token: 'access-123',
            refresh_token: 'refresh-456',
            expires_in: 10800,
            userid: 'user-789',
          },
        }),
      });
      vi.stubGlobal('fetch', mockFetch);

      await provider.exchangeCodeForTokens('auth-code');

      expect(mockFetch).toHaveBeenCalledOnce();
      const [url] = mockFetch.mock.calls[0] as [string, RequestInit];
      expect(url).toBe('https://wbsapi.withings.net/v2/oauth2');
    });

    it('sends action=requesttoken in the POST body', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          status: 0,
          body: {
            access_token: 'access-123',
            refresh_token: 'refresh-456',
            expires_in: 10800,
            userid: 'user-789',
          },
        }),
      });
      vi.stubGlobal('fetch', mockFetch);

      await provider.exchangeCodeForTokens('auth-code');

      const [, options] = mockFetch.mock.calls[0] as [string, RequestInit];
      const bodyStr = options.body?.toString() ?? '';
      expect(bodyStr).toContain('action=requesttoken');
    });

    it('sends grant_type=authorization_code in the POST body', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          status: 0,
          body: {
            access_token: 'access-123',
            refresh_token: 'refresh-456',
            expires_in: 10800,
            userid: 'user-789',
          },
        }),
      });
      vi.stubGlobal('fetch', mockFetch);

      await provider.exchangeCodeForTokens('auth-code');

      const [, options] = mockFetch.mock.calls[0] as [string, RequestInit];
      const bodyStr = options.body?.toString() ?? '';
      expect(bodyStr).toContain('grant_type=authorization_code');
    });

    it('returns success=true with tokens on status 0', async () => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          status: 0,
          body: {
            access_token: 'access-token-abc',
            refresh_token: 'refresh-token-xyz',
            expires_in: 10800,
            userid: '123456',
          },
        }),
      }));

      const result = await provider.exchangeCodeForTokens('auth-code');
      expect(result.success).toBe(true);
      expect(result.tokens?.accessToken).toBe('access-token-abc');
      expect(result.tokens?.refreshToken).toBe('refresh-token-xyz');
      expect(result.tokens?.expiresAt).toBeInstanceOf(Date);
    });

    it('returns success=false on non-zero status', async () => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          status: 293,
          error: 'Missing action parameter',
        }),
      }));

      const result = await provider.exchangeCodeForTokens('bad-code');
      expect(result.success).toBe(false);
      expect(result.error).toBeTruthy();
    });
  });

  describe('refreshTokens', () => {
    it('POSTs to wbsapi.withings.net/v2/oauth2', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          status: 0,
          body: {
            access_token: 'new-access',
            refresh_token: 'new-refresh',
            expires_in: 10800,
          },
        }),
      });
      vi.stubGlobal('fetch', mockFetch);

      await provider.refreshTokens('old-refresh-token');

      const [url] = mockFetch.mock.calls[0] as [string, RequestInit];
      expect(url).toBe('https://wbsapi.withings.net/v2/oauth2');
    });

    it('sends action=requesttoken in the refresh body', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          status: 0,
          body: {
            access_token: 'new-access',
            refresh_token: 'new-refresh',
            expires_in: 10800,
          },
        }),
      });
      vi.stubGlobal('fetch', mockFetch);

      await provider.refreshTokens('old-refresh-token');

      const [, options] = mockFetch.mock.calls[0] as [string, RequestInit];
      const bodyStr = options.body?.toString() ?? '';
      expect(bodyStr).toContain('action=requesttoken');
    });

    it('sends grant_type=refresh_token in the body', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          status: 0,
          body: {
            access_token: 'new-access',
            refresh_token: 'new-refresh',
            expires_in: 10800,
          },
        }),
      });
      vi.stubGlobal('fetch', mockFetch);

      await provider.refreshTokens('old-refresh-token');

      const [, options] = mockFetch.mock.calls[0] as [string, RequestInit];
      const bodyStr = options.body?.toString() ?? '';
      expect(bodyStr).toContain('grant_type=refresh_token');
    });

    it('returns BOTH new access_token AND new refresh_token', async () => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          status: 0,
          body: {
            access_token: 'new-access-xyz',
            refresh_token: 'new-refresh-xyz',
            expires_in: 10800,
          },
        }),
      }));

      const tokens = await provider.refreshTokens('old-refresh-token');
      expect(tokens.accessToken).toBe('new-access-xyz');
      expect(tokens.refreshToken).toBe('new-refresh-xyz');
      expect(tokens.expiresAt).toBeInstanceOf(Date);
    });
  });

  describe('syncHealthData', () => {
    it('returns SyncResult with provider=withings', async () => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          status: 0,
          body: { measuregrps: [] },
        }),
      }));

      const result = await provider.syncHealthData('access-token');
      expect(result.provider).toBe('withings');
      expect(result.success).toBe(true);
      expect(result.syncedAt).toBeInstanceOf(Date);
    });

    it('maps meastype 9 (diastolic) and 10 (systolic) as bloodPressure', async () => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          status: 0,
          body: {
            measuregrps: [
              {
                date: Math.floor(Date.now() / 1000),
                measures: [
                  { type: 9, value: 8000, unit: -2 },  // diastolic 80.00
                  { type: 10, value: 12000, unit: -2 }, // systolic 120.00
                ],
              },
            ],
          },
        }),
      }));

      const result = await provider.syncHealthData('access-token');
      expect(result.recordsCount.bloodPressure).toBeGreaterThan(0);
    });

    it('maps meastype 11 (HR) as heartRate', async () => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          status: 0,
          body: {
            measuregrps: [
              {
                date: Math.floor(Date.now() / 1000),
                measures: [
                  { type: 11, value: 72, unit: 0 }, // HR 72 bpm
                ],
              },
            ],
          },
        }),
      }));

      const result = await provider.syncHealthData('access-token');
      expect(result.recordsCount.heartRate).toBeGreaterThan(0);
    });

    it('maps meastype 54 (SpO2) as bloodOxygen', async () => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          status: 0,
          body: {
            measuregrps: [
              {
                date: Math.floor(Date.now() / 1000),
                measures: [
                  { type: 54, value: 9750, unit: -2 }, // SpO2 97.5%
                ],
              },
            ],
          },
        }),
      }));

      const result = await provider.syncHealthData('access-token');
      expect(result.recordsCount.bloodOxygen).toBeGreaterThan(0);
    });

    it('maps meastype 71 (temperature) as temperature', async () => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          status: 0,
          body: {
            measuregrps: [
              {
                date: Math.floor(Date.now() / 1000),
                measures: [
                  { type: 71, value: 3700, unit: -2 }, // temp 37.00 °C
                ],
              },
            ],
          },
        }),
      }));

      const result = await provider.syncHealthData('access-token');
      expect(result.recordsCount.temperature).toBeGreaterThan(0);
    });
  });

  describe('scaleWithingsValue (via syncHealthData)', () => {
    it('correctly scales value=9750, unit=-2 to 97.5', async () => {
      // We test scaling indirectly through getBloodOxygen
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          status: 0,
          body: {
            measuregrps: [
              {
                date: Math.floor(Date.now() / 1000),
                measures: [
                  { type: 54, value: 9750, unit: -2 },
                ],
              },
            ],
          },
        }),
      }));

      const now = new Date();
      const result = await provider.getBloodOxygen('access-token', now, now);
      expect(result[0]?.percentage).toBeCloseTo(97.5, 1);
    });
  });

  describe('revokeAccess', () => {
    it('returns true (Withings has no standard revocation)', async () => {
      const result = await provider.revokeAccess('any-token');
      expect(result).toBe(true);
    });
  });

  describe('validateWebhook', () => {
    it('returns a boolean', () => {
      const result = provider.validateWebhook('sig', 'payload');
      expect(typeof result).toBe('boolean');
    });
  });

  describe('parseWebhookPayload', () => {
    it('extracts userId from Withings notification payload', () => {
      const payload = { userid: '12345', appli: 1 };
      const result = provider.parseWebhookPayload(payload);
      expect(result.userId).toBe('12345');
      expect(Array.isArray(result.dataTypes)).toBe(true);
    });
  });
});
