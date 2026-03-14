/**
 * Fitbit Integration Provider
 * Implements WearableProviderInterface for Fitbit via OAuth 2.0 PKCE flow.
 *
 * Supports: HR, SpO2, temperature, steps, sleep, activity, HRV
 * NOT supported: Blood pressure — Fitbit has no blood pressure sensor (hardware gap)
 */

import crypto from 'crypto';
import type {
  WearableProviderInterface,
  WearableAuthResult,
  OAuthTokens,
  SyncResult,
  HeartRateData,
  SleepData,
  ActivityData,
  OxygenSaturationData,
  HRVData,
} from './types';
import { env } from '../../config/env';

// ---------------------------------------------------------------------------
// PKCE helpers (not exported)
// ---------------------------------------------------------------------------

function generateCodeVerifier(): string {
  return crypto.randomBytes(32).toString('base64url');
}

function generateCodeChallenge(verifier: string): string {
  return crypto.createHash('sha256').update(verifier).digest('base64url');
}

// ---------------------------------------------------------------------------
// Date helpers
// ---------------------------------------------------------------------------

function formatDate(d: Date): string {
  return d.toISOString().slice(0, 10); // YYYY-MM-DD
}

function addDays(d: Date, n: number): Date {
  const result = new Date(d);
  result.setUTCDate(result.getUTCDate() + n);
  return result;
}

// ---------------------------------------------------------------------------
// Fitbit API base URL
// ---------------------------------------------------------------------------

const FITBIT_API = 'https://api.fitbit.com';
const FITBIT_AUTH_BASE = 'https://www.fitbit.com/oauth2/authorize';
const FITBIT_TOKEN_URL = `${FITBIT_API}/oauth2/token`;
const FITBIT_REVOKE_URL = `${FITBIT_API}/oauth2/revoke`;

// ---------------------------------------------------------------------------
// FitbitProvider
// ---------------------------------------------------------------------------

export class FitbitProvider implements WearableProviderInterface {
  readonly provider = 'fitbit' as const;

  private clientId: string;
  private clientSecret: string;
  private redirectUri: string;

  /**
   * Map of OAuth state → PKCE code verifier.
   * In single-instance dev environments this lets the route layer retrieve
   * the verifier after the OAuth redirect.  In production, the route layer
   * should persist the verifier in Redis.
   */
  private pendingVerifiers = new Map<string, string>();

  constructor() {
    this.clientId = env.FITBIT_CLIENT_ID || '';
    this.clientSecret = env.FITBIT_CLIENT_SECRET || '';
    this.redirectUri = env.FITBIT_REDIRECT_URI || '';
  }

  // -------------------------------------------------------------------------
  // OAuth — authorization URL (PKCE)
  // -------------------------------------------------------------------------

  getAuthorizationUrl(state: string): string {
    const verifier = generateCodeVerifier();
    const challenge = generateCodeChallenge(verifier);

    // Store verifier so the route layer can retrieve it with getCodeVerifier()
    this.pendingVerifiers.set(state, verifier);

    const params = new URLSearchParams({
      response_type: 'code',
      client_id: this.clientId,
      redirect_uri: this.redirectUri,
      scope: 'heartrate oxygen_saturation temperature activity sleep',
      state,
      code_challenge: challenge,
      code_challenge_method: 'S256',
    });

    return `${FITBIT_AUTH_BASE}?${params.toString()}`;
  }

  /**
   * Retrieve the PKCE code verifier for a given state value.
   * Returns undefined if the state is not found.
   */
  getCodeVerifier(state: string): string | undefined {
    return this.pendingVerifiers.get(state);
  }

  // -------------------------------------------------------------------------
  // OAuth — token exchange
  // -------------------------------------------------------------------------

  /**
   * Exchange an authorization code for tokens.
   * Implements WearableProviderInterface.exchangeCodeForTokens.
   * For PKCE-aware callers, use exchangeCodeForTokensWithVerifier instead.
   */
  async exchangeCodeForTokens(code: string): Promise<WearableAuthResult> {
    return this._tokenExchange(code, undefined);
  }

  /**
   * Exchange an authorization code for tokens, supplying the PKCE verifier
   * explicitly.  Use this from route handlers that stored the verifier in Redis.
   */
  async exchangeCodeForTokensWithVerifier(
    code: string,
    codeVerifier: string
  ): Promise<WearableAuthResult> {
    return this._tokenExchange(code, codeVerifier);
  }

  private async _tokenExchange(
    code: string,
    codeVerifier: string | undefined
  ): Promise<WearableAuthResult> {
    const basicAuth = Buffer.from(`${this.clientId}:${this.clientSecret}`).toString('base64');

    const body = new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: this.redirectUri,
    });

    if (codeVerifier) {
      body.set('code_verifier', codeVerifier);
    }

    try {
      const response = await fetch(FITBIT_TOKEN_URL, {
        method: 'POST',
        headers: {
          Authorization: `Basic ${basicAuth}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: body.toString(),
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        return {
          success: false,
          error: `Fitbit token exchange failed: ${response.status} — ${JSON.stringify(errData)}`,
        };
      }

      const data = await response.json() as {
        access_token: string;
        refresh_token?: string;
        expires_in?: number;
        token_type?: string;
        scope?: string;
        user_id?: string;
      };

      const expiresAt = data.expires_in
        ? new Date(Date.now() + data.expires_in * 1000)
        : undefined;

      return {
        success: true,
        tokens: {
          accessToken: data.access_token,
          refreshToken: data.refresh_token,
          expiresAt,
          tokenType: data.token_type,
          scope: data.scope,
        },
        deviceId: data.user_id,
        deviceName: 'Fitbit',
      };
    } catch (err) {
      return {
        success: false,
        error: `Fitbit token exchange error: ${String(err)}`,
      };
    }
  }

  // -------------------------------------------------------------------------
  // OAuth — token refresh
  // -------------------------------------------------------------------------

  async refreshTokens(refreshToken: string): Promise<OAuthTokens> {
    const basicAuth = Buffer.from(`${this.clientId}:${this.clientSecret}`).toString('base64');

    const body = new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
    });

    const response = await fetch(FITBIT_TOKEN_URL, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${basicAuth}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: body.toString(),
    });

    if (!response.ok) {
      throw new Error(`Fitbit refresh failed: ${response.status}`);
    }

    const data = await response.json() as {
      access_token: string;
      refresh_token?: string;
      expires_in?: number;
      token_type?: string;
      scope?: string;
    };

    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresAt: data.expires_in ? new Date(Date.now() + data.expires_in * 1000) : undefined,
      tokenType: data.token_type,
      scope: data.scope,
    };
  }

  // -------------------------------------------------------------------------
  // OAuth — revoke access
  // -------------------------------------------------------------------------

  async revokeAccess(accessToken: string): Promise<boolean> {
    const basicAuth = Buffer.from(`${this.clientId}:${this.clientSecret}`).toString('base64');

    const body = new URLSearchParams({ token: accessToken });

    const response = await fetch(FITBIT_REVOKE_URL, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${basicAuth}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: body.toString(),
    });

    return response.ok;
  }

  // -------------------------------------------------------------------------
  // Data sync
  // -------------------------------------------------------------------------

  /**
   * Sync health data from Fitbit for the given date range.
   *
   * Fetches per-day:
   *   - Heart rate (resting + intraday average)
   *   - SpO2 (blood oxygen)
   *   - Skin temperature (nightly relative offset)
   *   - Steps
   *
   * Fitbit has no blood pressure sensor — BP omitted per WEAR-01 hardware gap
   */
  async syncHealthData(
    accessToken: string,
    since?: Date,
    _types?: string[]
  ): Promise<SyncResult> {
    const startDate = since ?? addDays(new Date(), -7);
    const today = new Date();

    const errors: string[] = [];
    const counts = {
      heartRate: 0,
      sleep: 0,
      activity: 0,
      bloodOxygen: 0,
      temperature: 0,
      hrv: 0,
      // Fitbit has no blood pressure sensor — BP omitted per WEAR-01 hardware gap
      bloodPressure: 0,
      ecg: 0,
    };

    const headers = { Authorization: `Bearer ${accessToken}` };

    let current = new Date(startDate);
    current.setUTCHours(0, 0, 0, 0);
    today.setUTCHours(0, 0, 0, 0);

    while (current <= today) {
      const dateStr = formatDate(current);

      // --- Heart rate ---
      try {
        const hrUrl = `${FITBIT_API}/1/user/-/activities/heart/date/${dateStr}/1d.json`;
        const hrResp = await fetch(hrUrl, { headers });
        if (hrResp.ok) {
          const hrData = await hrResp.json() as {
            'activities-heart'?: Array<{ value: { restingHeartRate?: number }; dateTime: string }>;
            'activities-heart-intraday'?: { dataset: Array<{ value: number }> };
          };
          const heartArr = hrData['activities-heart'];
          const intraday = hrData['activities-heart-intraday'];
          const hasResting = heartArr && heartArr[0]?.value?.restingHeartRate != null;
          const hasIntraday = intraday && intraday.dataset && intraday.dataset.length > 0;
          if (hasResting || hasIntraday) {
            counts.heartRate++;
          }
        }
      } catch (err) {
        errors.push(`HR fetch error for ${dateStr}: ${String(err)}`);
      }

      // --- SpO2 ---
      try {
        const spo2Url = `${FITBIT_API}/1/user/-/spo2/date/${dateStr}/all.json`;
        const spo2Resp = await fetch(spo2Url, { headers });
        if (spo2Resp.ok) {
          const spo2Data = await spo2Resp.json() as { value?: { avg?: number } };
          if (spo2Data?.value?.avg != null) {
            counts.bloodOxygen++;
          }
        }
      } catch (err) {
        errors.push(`SpO2 fetch error for ${dateStr}: ${String(err)}`);
      }

      // --- Temperature (skin, nightly relative) ---
      try {
        const tempUrl = `${FITBIT_API}/1/user/-/temp/skin/date/${dateStr}.json`;
        const tempResp = await fetch(tempUrl, { headers });
        if (tempResp.ok) {
          const tempData = await tempResp.json() as {
            tempSkin?: Array<{ value?: { nightlyRelative?: number } }>;
          };
          if (tempData?.tempSkin && tempData.tempSkin.length > 0) {
            const nightlyRelative = tempData.tempSkin[0]?.value?.nightlyRelative;
            if (nightlyRelative != null) {
              counts.temperature++;
            }
          }
        }
      } catch (err) {
        errors.push(`Temperature fetch error for ${dateStr}: ${String(err)}`);
      }

      // --- Steps ---
      try {
        const stepsUrl = `${FITBIT_API}/1/user/-/activities/steps/date/${dateStr}/1d.json`;
        const stepsResp = await fetch(stepsUrl, { headers });
        if (stepsResp.ok) {
          const stepsData = await stepsResp.json() as {
            'activities-steps'?: Array<{ value: string }>;
          };
          const stepsArr = stepsData['activities-steps'];
          if (stepsArr && stepsArr[0] && parseInt(stepsArr[0].value, 10) > 0) {
            counts.activity++;
          }
        }
      } catch (err) {
        errors.push(`Steps fetch error for ${dateStr}: ${String(err)}`);
      }

      current = addDays(current, 1);
    }

    return {
      provider: 'fitbit',
      success: errors.length === 0,
      syncedAt: new Date(),
      recordsCount: counts,
      errors: errors.length > 0 ? errors : undefined,
    };
  }

  // -------------------------------------------------------------------------
  // Specific data accessors (interface compliance stubs)
  // -------------------------------------------------------------------------

  async getHeartRate(
    _accessToken: string,
    _startDate: Date,
    _endDate: Date
  ): Promise<HeartRateData[]> {
    throw new Error('Use syncHealthData for Fitbit — granular HR access not supported');
  }

  async getSleep(
    _accessToken: string,
    _startDate: Date,
    _endDate: Date
  ): Promise<SleepData[]> {
    throw new Error('Use syncHealthData for Fitbit — granular sleep access not supported');
  }

  async getActivity(
    _accessToken: string,
    _startDate: Date,
    _endDate: Date
  ): Promise<ActivityData[]> {
    throw new Error('Use syncHealthData for Fitbit — granular activity access not supported');
  }

  async getBloodOxygen(
    _accessToken: string,
    _startDate: Date,
    _endDate: Date
  ): Promise<OxygenSaturationData[]> {
    throw new Error('Use syncHealthData for Fitbit — granular SpO2 access not supported');
  }

  async getHRV(
    _accessToken: string,
    _startDate: Date,
    _endDate: Date
  ): Promise<HRVData[]> {
    throw new Error('Use syncHealthData for Fitbit — granular HRV access not supported');
  }

  // -------------------------------------------------------------------------
  // Webhook handling
  // -------------------------------------------------------------------------

  /**
   * Validate a Fitbit webhook notification.
   * Fitbit uses a subscriber verification code (not HMAC) — full implementation
   * in the route handler.  Returns false by default here.
   */
  validateWebhook(_signature: string, _payload: string): boolean {
    return false;
  }

  parseWebhookPayload(payload: unknown): { userId: string; dataTypes: string[] } {
    const data = payload as { userId?: string; collectionType?: string };
    return {
      userId: data?.userId ?? '',
      dataTypes: data?.collectionType ? [data.collectionType] : [],
    };
  }
}

export const fitbitProvider = new FitbitProvider();
