/**
 * Withings Integration
 * Implements WearableProviderInterface for Withings devices.
 *
 * Key non-standard behaviour:
 * - Token exchange and refresh BOTH require `action=requesttoken` in the POST body
 * - Withings rotates BOTH access_token and refresh_token on every refresh
 * - Measurement values are scaled: actual = value * 10^unit
 * - Blood-pressure data (meastype 9 diastolic / 10 systolic) is only available
 *   from Withings among Phase-1 providers
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
// Withings meastype codes
// ---------------------------------------------------------------------------
const MEASTYPE_DIASTOLIC = 9;
const MEASTYPE_SYSTOLIC = 10;
const MEASTYPE_HEART_RATE = 11;
const MEASTYPE_SPO2 = 54;
const MEASTYPE_TEMPERATURE = 71;

const ALL_MEASTYPES = [
  MEASTYPE_DIASTOLIC,
  MEASTYPE_SYSTOLIC,
  MEASTYPE_HEART_RATE,
  MEASTYPE_SPO2,
  MEASTYPE_TEMPERATURE,
].join(',');

// ---------------------------------------------------------------------------
// Withings API response shapes
// ---------------------------------------------------------------------------
interface WithingsTokenBody {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  userid?: string | number;
}

interface WithingsApiResponse<T> {
  status: number;
  body?: T;
  error?: string;
}

interface WithingsMeasure {
  type: number;
  value: number;
  unit: number;
}

interface WithingsMeasgrp {
  date: number; // Unix timestamp (seconds)
  measures: WithingsMeasure[];
}

interface WithingsMeasureBody {
  measuregrps: WithingsMeasgrp[];
}

// ---------------------------------------------------------------------------
// WithingsProvider
// ---------------------------------------------------------------------------
export class WithingsProvider implements WearableProviderInterface {
  readonly provider = 'withings' as const;

  private clientId: string;
  private clientSecret: string;
  private redirectUri: string;
  private webhookSecret: string;

  private readonly AUTH_URL = 'https://account.withings.com/oauth2_user/authorize2';
  private readonly TOKEN_URL = 'https://wbsapi.withings.net/v2/oauth2';
  private readonly MEASURE_URL = 'https://wbsapi.withings.net/measure';

  constructor() {
    this.clientId = env.WITHINGS_CLIENT_ID || '';
    this.clientSecret = env.WITHINGS_CLIENT_SECRET || '';
    this.redirectUri = env.WITHINGS_REDIRECT_URI || '';
    this.webhookSecret = env.WITHINGS_WEBHOOK_SECRET || '';
  }

  // -------------------------------------------------------------------------
  // OAuth flow
  // -------------------------------------------------------------------------

  /**
   * Build the Withings OAuth2 authorization URL.
   */
  getAuthorizationUrl(state: string): string {
    const params = new URLSearchParams({
      response_type: 'code',
      client_id: this.clientId,
      scope: 'user.metrics,user.activity',
      redirect_uri: this.redirectUri,
      state,
    });
    return `${this.AUTH_URL}?${params.toString()}`;
  }

  /**
   * Exchange an authorization code for tokens.
   *
   * Withings requires `action=requesttoken` in the body — without it the API
   * returns status 293 regardless of other parameters.
   */
  async exchangeCodeForTokens(code: string): Promise<WearableAuthResult> {
    try {
      const body = new URLSearchParams({
        action: 'requesttoken',
        grant_type: 'authorization_code',
        client_id: this.clientId,
        client_secret: this.clientSecret,
        code,
        redirect_uri: this.redirectUri,
      });

      const response = await fetch(this.TOKEN_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body,
      });

      const data = await response.json() as WithingsApiResponse<WithingsTokenBody>;

      if (data.status !== 0 || !data.body) {
        return {
          success: false,
          error: data.error || `Withings token exchange failed with status ${data.status}`,
        };
      }

      return {
        success: true,
        tokens: {
          accessToken: data.body.access_token,
          refreshToken: data.body.refresh_token,
          expiresAt: new Date(Date.now() + data.body.expires_in * 1000),
        },
      };
    } catch (err) {
      return {
        success: false,
        error: `Token exchange error: ${err instanceof Error ? err.message : 'Unknown error'}`,
      };
    }
  }

  /**
   * Refresh tokens.
   *
   * IMPORTANT: Withings rotates BOTH access and refresh tokens on every use.
   * The old refresh token is immediately invalidated.  Callers MUST persist
   * both returned tokens or the user will be permanently de-authenticated
   * after the current access token expires (3 hours).
   */
  async refreshTokens(refreshToken: string): Promise<OAuthTokens> {
    const body = new URLSearchParams({
      action: 'requesttoken',
      grant_type: 'refresh_token',
      client_id: this.clientId,
      client_secret: this.clientSecret,
      refresh_token: refreshToken,
    });

    const response = await fetch(this.TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
    });

    const data = await response.json() as WithingsApiResponse<WithingsTokenBody>;

    if (data.status !== 0 || !data.body) {
      throw new Error(
        data.error || `Withings token refresh failed with status ${data.status}`
      );
    }

    return {
      accessToken: data.body.access_token,
      refreshToken: data.body.refresh_token,
      expiresAt: new Date(Date.now() + data.body.expires_in * 1000),
    };
  }

  /**
   * Revoke access.
   *
   * Withings does not expose a standard token revocation endpoint in the
   * non-premium tier, so we return true to satisfy the interface contract.
   */
  async revokeAccess(_accessToken: string): Promise<boolean> {
    return true;
  }

  // -------------------------------------------------------------------------
  // Data sync
  // -------------------------------------------------------------------------

  /**
   * Sync all supported health data from Withings.
   */
  async syncHealthData(
    accessToken: string,
    since?: Date,
    _types?: string[]
  ): Promise<SyncResult> {
    const errors: string[] = [];
    const startDate = since || new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const endDate = new Date();

    let heartRateCount = 0;
    let bloodPressureCount = 0;
    let bloodOxygenCount = 0;
    let temperatureCount = 0;

    try {
      const measgrps = await this.getMeasurements(accessToken, startDate, endDate);

      // Aggregate by day: track unique dates per reading type
      const bpDates = new Set<number>();
      const hrDates = new Set<number>();
      const spo2Dates = new Set<number>();
      const tempDates = new Set<number>();

      for (const grp of measgrps) {
        let hasBp = false;
        for (const m of grp.measures) {
          switch (m.type) {
            case MEASTYPE_DIASTOLIC:
            case MEASTYPE_SYSTOLIC:
              hasBp = true;
              break;
            case MEASTYPE_HEART_RATE:
              hrDates.add(grp.date);
              break;
            case MEASTYPE_SPO2:
              spo2Dates.add(grp.date);
              break;
            case MEASTYPE_TEMPERATURE:
              tempDates.add(grp.date);
              break;
          }
        }
        if (hasBp) bpDates.add(grp.date);
      }

      heartRateCount = hrDates.size;
      bloodPressureCount = bpDates.size;
      bloodOxygenCount = spo2Dates.size;
      temperatureCount = tempDates.size;
    } catch (err) {
      errors.push(`Measurements: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }

    return {
      provider: 'withings',
      success: errors.length === 0,
      syncedAt: new Date(),
      recordsCount: {
        heartRate: heartRateCount,
        sleep: 0,
        activity: 0,
        bloodOxygen: bloodOxygenCount,
        temperature: temperatureCount,
        hrv: 0,
        bloodPressure: bloodPressureCount,
        ecg: 0,
      },
      errors: errors.length > 0 ? errors : undefined,
    };
  }

  // -------------------------------------------------------------------------
  // Specific data type accessors
  // -------------------------------------------------------------------------

  async getHeartRate(
    accessToken: string,
    startDate: Date,
    endDate: Date
  ): Promise<HeartRateData[]> {
    const measgrps = await this.getMeasurements(accessToken, startDate, endDate);
    const results: HeartRateData[] = [];

    for (const grp of measgrps) {
      for (const m of grp.measures) {
        if (m.type === MEASTYPE_HEART_RATE) {
          results.push({
            timestamp: new Date(grp.date * 1000),
            bpm: this.scaleWithingsValue(m.value, m.unit),
          });
        }
      }
    }

    return results;
  }

  async getSleep(
    _accessToken: string,
    _startDate: Date,
    _endDate: Date
  ): Promise<SleepData[]> {
    // Withings sleep data requires the /v2/sleep endpoint (separate from /measure).
    // Implementing a basic stub that returns an empty array — full sleep sync
    // can be added in a later plan when /v2/sleep is scoped.
    return [];
  }

  async getActivity(
    _accessToken: string,
    _startDate: Date,
    _endDate: Date
  ): Promise<ActivityData[]> {
    // Withings activity data lives at /v2/measure?action=getactivity.
    // Returning empty array — can be expanded in a later plan.
    return [];
  }

  async getBloodOxygen(
    accessToken: string,
    startDate: Date,
    endDate: Date
  ): Promise<OxygenSaturationData[]> {
    const measgrps = await this.getMeasurements(accessToken, startDate, endDate);
    const results: OxygenSaturationData[] = [];

    for (const grp of measgrps) {
      for (const m of grp.measures) {
        if (m.type === MEASTYPE_SPO2) {
          results.push({
            timestamp: new Date(grp.date * 1000),
            percentage: this.scaleWithingsValue(m.value, m.unit),
          });
        }
      }
    }

    return results;
  }

  async getHRV(
    _accessToken: string,
    _startDate: Date,
    _endDate: Date
  ): Promise<HRVData[]> {
    // Withings does not expose HRV in the standard /measure endpoint.
    return [];
  }

  // -------------------------------------------------------------------------
  // Webhook handling
  // -------------------------------------------------------------------------

  /**
   * Validate Withings webhook notification using HMAC-SHA256.
   * Withings signs the raw body with the application's webhook secret.
   */
  validateWebhook(signature: string, payload: string): boolean {
    if (!this.webhookSecret) return false;
    const expected = crypto
      .createHmac('sha256', this.webhookSecret)
      .update(payload)
      .digest('hex');
    const sigBuf = Buffer.from(signature);
    const expBuf = Buffer.from(expected);
    // timingSafeEqual requires equal-length buffers; if lengths differ the
    // signature is invalid — return false without leaking timing information.
    if (sigBuf.length !== expBuf.length) return false;
    return crypto.timingSafeEqual(sigBuf, expBuf);
  }

  /**
   * Parse a Withings webhook notification payload.
   * Withings sends `{ userid: string|number, appli: number, ... }`.
   */
  parseWebhookPayload(payload: unknown): { userId: string; dataTypes: string[] } {
    const data = payload as { userid?: string | number; appli?: number };

    // Map Withings `appli` codes to readable data type strings
    const appliMap: Record<number, string> = {
      1: 'weight',
      4: 'heart_rate',
      16: 'blood_pressure',
      44: 'sleep',
      46: 'activity',
    };

    const userId = data.userid !== undefined ? String(data.userid) : '';
    const dataTypes: string[] = [];

    if (data.appli !== undefined && appliMap[data.appli]) {
      dataTypes.push(appliMap[data.appli]!);
    }

    return { userId, dataTypes };
  }

  // -------------------------------------------------------------------------
  // Private helpers
  // -------------------------------------------------------------------------

  /**
   * Fetch raw measurement groups from the Withings /measure endpoint.
   *
   * Uses POST with `action=getmeas` and requests meastypes 9,10,11,54,71
   * (diastolic BP, systolic BP, heart rate, SpO2, temperature).
   */
  private async getMeasurements(
    accessToken: string,
    startDate: Date,
    endDate: Date
  ): Promise<WithingsMeasgrp[]> {
    const startdate = Math.floor(startDate.getTime() / 1000);
    const enddate = Math.floor(endDate.getTime() / 1000);

    const body = new URLSearchParams({
      action: 'getmeas',
      startdate: String(startdate),
      enddate: String(enddate),
      meastypes: ALL_MEASTYPES,
    });

    const response = await fetch(this.MEASURE_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body,
    });

    const data = await response.json() as WithingsApiResponse<WithingsMeasureBody>;

    if (data.status !== 0 || !data.body) {
      throw new Error(
        data.error || `Withings measurements fetch failed with status ${data.status}`
      );
    }

    return data.body.measuregrps || [];
  }

  /**
   * Scale a Withings raw measure value to its actual value.
   * actual = value * 10^unit
   *
   * Example: { value: 9750, unit: -2 } → 9750 * 10^-2 = 97.5
   */
  private scaleWithingsValue(value: number, unit: number): number {
    return value * Math.pow(10, unit);
  }
}

export const withingsProvider = new WithingsProvider();
