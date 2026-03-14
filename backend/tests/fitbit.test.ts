/**
 * FitbitProvider Tests
 * TDD: RED phase — tests written before implementation
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock env config so we don't need real env vars
vi.mock('../src/config/env', () => ({
  env: {
    FITBIT_CLIENT_ID: 'test-client-id',
    FITBIT_CLIENT_SECRET: 'test-client-secret',
    FITBIT_REDIRECT_URI: 'https://example.com/callback/fitbit',
    ENCRYPTION_KEY: 'test_encryption_key_32_characters_long!',
  },
}));

// Import after mock is set up
const { FitbitProvider } = await import('../src/services/wearables/fitbit');

describe('FitbitProvider', () => {
  let provider: InstanceType<typeof FitbitProvider>;

  beforeEach(() => {
    provider = new FitbitProvider();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('provider identity', () => {
    it('has provider set to fitbit', () => {
      expect(provider.provider).toBe('fitbit');
    });
  });

  describe('getAuthorizationUrl', () => {
    it('returns URL containing www.fitbit.com/oauth2/authorize', () => {
      const url = provider.getAuthorizationUrl('test-state');
      expect(url).toContain('www.fitbit.com/oauth2/authorize');
    });

    it('includes client_id', () => {
      const url = provider.getAuthorizationUrl('test-state');
      expect(url).toContain('client_id=test-client-id');
    });

    it('includes code_challenge', () => {
      const url = provider.getAuthorizationUrl('test-state');
      expect(url).toContain('code_challenge=');
    });

    it('includes code_challenge_method=S256', () => {
      const url = provider.getAuthorizationUrl('test-state');
      expect(url).toContain('code_challenge_method=S256');
    });

    it('includes required scopes', () => {
      const url = provider.getAuthorizationUrl('test-state');
      expect(url).toContain('scope=');
      // heartrate and oxygen_saturation must be in the scope
      const decoded = decodeURIComponent(url);
      expect(decoded).toContain('heartrate');
      expect(decoded).toContain('oxygen_saturation');
    });

    it('includes state parameter', () => {
      const url = provider.getAuthorizationUrl('my-state-123');
      expect(url).toContain('state=my-state-123');
    });

    it('stores code verifier retrievable via getCodeVerifier', () => {
      provider.getAuthorizationUrl('state-abc');
      const verifier = provider.getCodeVerifier('state-abc');
      expect(verifier).toBeDefined();
      expect(typeof verifier).toBe('string');
      expect(verifier!.length).toBeGreaterThan(0);
    });
  });

  describe('exchangeCodeForTokens', () => {
    it('calls Fitbit token endpoint', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          access_token: 'test-access-token',
          refresh_token: 'test-refresh-token',
          expires_in: 3600,
          token_type: 'Bearer',
        }),
      });
      vi.stubGlobal('fetch', mockFetch);

      await provider.exchangeCodeForTokens('test-code');

      expect(mockFetch).toHaveBeenCalledOnce();
      const [url] = mockFetch.mock.calls[0];
      expect(url).toContain('api.fitbit.com/oauth2/token');
    });

    it('returns success:true with tokens on HTTP 200', async () => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          access_token: 'at-123',
          refresh_token: 'rt-456',
          expires_in: 3600,
          token_type: 'Bearer',
        }),
      }));

      const result = await provider.exchangeCodeForTokens('code-abc');
      expect(result.success).toBe(true);
      expect(result.tokens?.accessToken).toBe('at-123');
      expect(result.tokens?.refreshToken).toBe('rt-456');
    });

    it('returns success:false on HTTP error', async () => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
        ok: false,
        status: 401,
        json: async () => ({ errors: [{ errorType: 'invalid_grant' }] }),
      }));

      const result = await provider.exchangeCodeForTokens('bad-code');
      expect(result.success).toBe(false);
    });
  });

  describe('exchangeCodeForTokensWithVerifier', () => {
    it('includes code_verifier in request body', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          access_token: 'at-123',
          refresh_token: 'rt-456',
          expires_in: 3600,
        }),
      });
      vi.stubGlobal('fetch', mockFetch);

      await provider.exchangeCodeForTokensWithVerifier('test-code', 'my-verifier');

      const [, options] = mockFetch.mock.calls[0];
      expect(options.body).toContain('code_verifier=my-verifier');
    });
  });

  describe('refreshTokens', () => {
    it('POSTs to api.fitbit.com/oauth2/token with grant_type=refresh_token', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          access_token: 'new-at',
          refresh_token: 'new-rt',
          expires_in: 3600,
        }),
      });
      vi.stubGlobal('fetch', mockFetch);

      const tokens = await provider.refreshTokens('old-refresh-token');

      expect(mockFetch).toHaveBeenCalledOnce();
      const [url, options] = mockFetch.mock.calls[0];
      expect(url).toContain('api.fitbit.com/oauth2/token');
      expect(options.body).toContain('grant_type=refresh_token');
      expect(tokens.accessToken).toBe('new-at');
    });
  });

  describe('revokeAccess', () => {
    it('calls api.fitbit.com/oauth2/revoke', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({}),
      });
      vi.stubGlobal('fetch', mockFetch);

      const result = await provider.revokeAccess('test-access-token');

      expect(mockFetch).toHaveBeenCalledOnce();
      const [url] = mockFetch.mock.calls[0];
      expect(url).toContain('api.fitbit.com/oauth2/revoke');
      expect(result).toBe(true);
    });
  });

  describe('syncHealthData', () => {
    it('returns SyncResult with provider=fitbit', async () => {
      // Mock all Fitbit API calls
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          'activities-heart': [{ value: { restingHeartRate: 65 }, dateTime: '2026-03-07' }],
          'activities-heart-intraday': { dataset: [{ time: '00:00', value: 65 }] },
        }),
      }));

      const result = await provider.syncHealthData('test-token', new Date('2026-03-07'));

      expect(result.provider).toBe('fitbit');
      expect(result.success).toBe(true);
      expect(result.syncedAt).toBeInstanceOf(Date);
    });

    it('never fetches blood pressure (hardware gap)', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          'activities-heart': [],
          'activities-heart-intraday': { dataset: [] },
        }),
      });
      vi.stubGlobal('fetch', mockFetch);

      await provider.syncHealthData('test-token', new Date('2026-03-07'));

      // No call should include blood pressure endpoint
      const calls = mockFetch.mock.calls.map(([url]: [string]) => url);
      const hasBPCall = calls.some((url: string) =>
        url.includes('blood_pressure') || url.includes('bp') || url.includes('blood-pressure')
      );
      expect(hasBPCall).toBe(false);
    });

    it('sets recordsCount.bloodPressure to 0', async () => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          'activities-heart': [],
          'activities-heart-intraday': { dataset: [] },
        }),
      }));

      const result = await provider.syncHealthData('test-token', new Date('2026-03-07'));

      expect(result.recordsCount.bloodPressure).toBe(0);
    });

    it('uses Bearer token in Authorization header', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          'activities-heart': [],
          'activities-heart-intraday': { dataset: [] },
        }),
      });
      vi.stubGlobal('fetch', mockFetch);

      await provider.syncHealthData('my-bearer-token', new Date('2026-03-07'));

      const [, options] = mockFetch.mock.calls[0];
      expect(options.headers?.Authorization).toBe('Bearer my-bearer-token');
    });
  });

  describe('validateWebhook', () => {
    it('returns a boolean', () => {
      const result = provider.validateWebhook('sig', 'payload');
      expect(typeof result).toBe('boolean');
    });
  });

  describe('parseWebhookPayload', () => {
    it('returns object with userId and dataTypes', () => {
      const result = provider.parseWebhookPayload({ userId: 'u1', collectionType: 'activities' });
      expect(result).toHaveProperty('userId');
      expect(result).toHaveProperty('dataTypes');
      expect(Array.isArray(result.dataTypes)).toBe(true);
    });
  });
});
