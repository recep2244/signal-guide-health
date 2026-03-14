/**
 * GarminProvider
 * OAuth 1.0a (HMAC-SHA1) integration for Garmin Health API.
 *
 * Garmin is a push-not-pull provider: the server registers a callback URL
 * and Garmin pushes daily summaries to /api/v1/wearables/garmin/webhook.
 * On-demand data pull is not supported; syncHealthData returns immediately.
 *
 * Partner program approval is required before credentials are issued.
 * The code deploys safely before credentials arrive via env var guards.
 */

import OAuth from 'oauth-1.0a';
import crypto from 'crypto';
import { env } from '../../config/env';
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

// ---------------------------------------------------------------------------
// Internal Garmin payload types
// ---------------------------------------------------------------------------

interface GarminDailySummary {
  userId: string;
  summaryId: string;
  startTimeInSeconds: number;
  durationInSeconds?: number;
  steps?: number;
  averageHeartRateInBeatsPerMinute?: number;
  maxHeartRateInBeatsPerMinute?: number;
  restingHeartRateInBeatsPerMinute?: number;
  averageSpO2?: number;
  averageStressLevel?: number;
  activeKilocalories?: number;
}

interface GarminWebhookPayload {
  summaries?: GarminDailySummary[];
  dailies?: GarminDailySummary[];
  activities?: GarminDailySummary[];
}

// ---------------------------------------------------------------------------
// Garmin OAuth 1.0a endpoints
// ---------------------------------------------------------------------------

const GARMIN_REQUEST_TOKEN_URL =
  'https://connectapi.garmin.com/oauth-service/oauth/request_token';
const GARMIN_AUTHORIZE_URL = 'https://connect.garmin.com/oauthConfirm';
const GARMIN_ACCESS_TOKEN_URL =
  'https://connectapi.garmin.com/oauth-service/oauth/access_token';

// ---------------------------------------------------------------------------
// GarminProvider
// ---------------------------------------------------------------------------

export class GarminProvider implements WearableProviderInterface {
  readonly provider = 'garmin' as const;

  private consumerKey: string;
  private consumerSecret: string;
  private webhookSecret: string;
  private oauth: OAuth;

  constructor() {
    this.consumerKey = env.GARMIN_CONSUMER_KEY || '';
    this.consumerSecret = env.GARMIN_CONSUMER_SECRET || '';
    this.webhookSecret = env.GARMIN_WEBHOOK_SECRET || '';

    if (!this.consumerKey) {
      console.warn(
        '[GarminProvider] GARMIN_CONSUMER_KEY not set — Garmin integration requires partner program approval'
      );
    }

    this.oauth = new OAuth({
      consumer: { key: this.consumerKey, secret: this.consumerSecret },
      signature_method: 'HMAC-SHA1',
      hash_function(base_string: string, key: string) {
        return crypto.createHmac('sha1', key).update(base_string).digest('base64');
      },
    });
  }

  // -------------------------------------------------------------------------
  // OAuth flow
  // -------------------------------------------------------------------------

  /**
   * Return a URL that initiates the Garmin OAuth 1.0a flow.
   *
   * OAuth 1.0a requires a server-side request-token round-trip before
   * the authorization URL can be constructed. Rather than making an async
   * outbound call here (which the synchronous WearableProviderInterface
   * does not support), we return a backend endpoint that performs the
   * request-token exchange and then redirects to Garmin.
   *
   * If GARMIN_CONSUMER_KEY is absent, returns a placeholder URL that
   * communicates the partner-approval-pending status.
   */
  getAuthorizationUrl(state: string): string {
    if (!this.consumerKey) {
      return `${GARMIN_AUTHORIZE_URL}?error=partner_approval_pending&state=${state}`;
    }
    // The backend /garmin/oauth-start endpoint performs the async request-token
    // exchange and issues the final Garmin redirect.
    return `/api/v1/wearables/garmin/oauth-start?state=${encodeURIComponent(state)}`;
  }

  /**
   * Obtain a Garmin request token and return the full authorization URL.
   * Called by the /garmin/oauth-start route handler (async step).
   */
  async fetchRequestTokenUrl(state: string): Promise<string> {
    if (!this.consumerKey) {
      return `${GARMIN_AUTHORIZE_URL}?error=partner_approval_pending&state=${state}`;
    }

    try {
      const requestData = { url: GARMIN_REQUEST_TOKEN_URL, method: 'POST' as const };
      const authHeader = this.oauth.toHeader(
        this.oauth.authorize(requestData)
      );

      const response = await fetch(GARMIN_REQUEST_TOKEN_URL, {
        method: 'POST',
        headers: {
          ...authHeader,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
      });

      if (!response.ok) {
        throw new Error(`Request token fetch failed: ${response.status}`);
      }

      const body = await response.text();
      const params = new URLSearchParams(body);
      const oauthToken = params.get('oauth_token') || '';

      return `${GARMIN_AUTHORIZE_URL}?oauth_token=${oauthToken}&state=${state}`;
    } catch (err) {
      console.error('[GarminProvider] fetchRequestTokenUrl error:', err);
      return `${GARMIN_AUTHORIZE_URL}?error=request_token_failed&state=${state}`;
    }
  }

  /**
   * Step 2: Exchange oauth_verifier (passed as `code`) for an access token.
   * In Garmin OAuth 1.0a the "refresh token" is actually the token secret used
   * for subsequent request signing.
   */
  async exchangeCodeForTokens(code: string): Promise<WearableAuthResult> {
    try {
      const requestData = { url: GARMIN_ACCESS_TOKEN_URL, method: 'POST' as const };
      const authHeader = this.oauth.toHeader(
        this.oauth.authorize(requestData, { key: '', secret: '' })
      );

      const response = await fetch(GARMIN_ACCESS_TOKEN_URL, {
        method: 'POST',
        headers: {
          ...authHeader,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: `oauth_verifier=${encodeURIComponent(code)}`,
      });

      if (!response.ok) {
        throw new Error(`Access token exchange failed: ${response.status}`);
      }

      const body = await response.text();
      const params = new URLSearchParams(body);
      const oauthToken = params.get('oauth_token') || '';
      const oauthTokenSecret = params.get('oauth_token_secret') || '';

      return {
        success: true,
        tokens: {
          accessToken: oauthToken,
          // Store token secret as refreshToken for subsequent signing
          refreshToken: oauthTokenSecret,
        },
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      return { success: false, error: message };
    }
  }

  /**
   * OAuth 1.0a tokens do not expire in the same way as OAuth 2.0 tokens.
   * Return the same token — this is intentionally a no-op.
   */
  async refreshTokens(refreshToken: string): Promise<OAuthTokens> {
    return { accessToken: refreshToken };
  }

  /**
   * Garmin has no standard revocation endpoint in the basic partner tier.
   */
  async revokeAccess(_accessToken: string): Promise<boolean> {
    return true;
  }

  // -------------------------------------------------------------------------
  // Data sync (push model — no outbound pull)
  // -------------------------------------------------------------------------

  /**
   * Garmin uses a push model: data arrives via webhook, not on-demand pull.
   * Returns immediately without making any outbound HTTP call.
   */
  async syncHealthData(
    _accessToken: string,
    _since?: Date,
    _types?: string[]
  ): Promise<SyncResult> {
    return {
      provider: 'garmin',
      success: true,
      syncedAt: new Date(),
      recordsCount: {
        heartRate: 0,
        sleep: 0,
        activity: 0,
        bloodOxygen: 0,
        temperature: 0,
        hrv: 0,
        bloodPressure: 0,
        ecg: 0,
      },
      errors: [
        'Garmin uses push model — data arrives via webhook, not on-demand pull',
      ],
    };
  }

  // -------------------------------------------------------------------------
  // Specific data type stubs (on-demand pull not supported by Garmin)
  // -------------------------------------------------------------------------

  async getHeartRate(
    _accessToken: string,
    _startDate: Date,
    _endDate: Date
  ): Promise<HeartRateData[]> {
    throw new Error('Garmin data arrives via webhook push, not on-demand pull');
  }

  async getSleep(
    _accessToken: string,
    _startDate: Date,
    _endDate: Date
  ): Promise<SleepData[]> {
    throw new Error('Garmin data arrives via webhook push, not on-demand pull');
  }

  async getActivity(
    _accessToken: string,
    _startDate: Date,
    _endDate: Date
  ): Promise<ActivityData[]> {
    throw new Error('Garmin data arrives via webhook push, not on-demand pull');
  }

  async getBloodOxygen(
    _accessToken: string,
    _startDate: Date,
    _endDate: Date
  ): Promise<OxygenSaturationData[]> {
    throw new Error('Garmin data arrives via webhook push, not on-demand pull');
  }

  async getHRV(
    _accessToken: string,
    _startDate: Date,
    _endDate: Date
  ): Promise<HRVData[]> {
    throw new Error('Garmin data arrives via webhook push, not on-demand pull');
  }

  // -------------------------------------------------------------------------
  // Webhook handling
  // -------------------------------------------------------------------------

  /**
   * Validate a Garmin webhook request using HMAC-SHA256.
   * Returns false if webhookSecret is not configured.
   */
  validateWebhook(signature: string, payload: string): boolean {
    if (!this.webhookSecret) {
      return false;
    }

    try {
      const expected = crypto
        .createHmac('sha256', this.webhookSecret)
        .update(payload)
        .digest('hex');

      const expectedBuf = Buffer.from(expected, 'utf8');
      const signatureBuf = Buffer.from(signature, 'utf8');

      if (expectedBuf.length !== signatureBuf.length) {
        return false;
      }

      return crypto.timingSafeEqual(expectedBuf, signatureBuf);
    } catch {
      return false;
    }
  }

  /**
   * Parse a Garmin Health API webhook payload.
   * Extracts the Garmin userId and derives data type labels.
   */
  parseWebhookPayload(payload: unknown): { userId: string; dataTypes: string[] } {
    const body = payload as GarminWebhookPayload;
    const summaries = body.summaries || [];
    const dailies = body.dailies || [];
    const activities = body.activities || [];

    const userId =
      summaries[0]?.userId ||
      dailies[0]?.userId ||
      activities[0]?.userId ||
      '';

    const dataTypes: string[] = [];
    if (summaries.length > 0 || dailies.length > 0) {
      dataTypes.push('daily_summary');
    }
    if (activities.length > 0) {
      dataTypes.push('activity');
    }

    return { userId, dataTypes };
  }

  // -------------------------------------------------------------------------
  // Reading extraction
  // -------------------------------------------------------------------------

  /**
   * Map a Garmin daily summary to an array of typed readings for persistence.
   * patientId and wearableId are accepted for caller context but not embedded
   * in the returned objects — the route handler attaches them to recordReading().
   */
  extractReadingsFromSummary(
    summary: GarminDailySummary,
    _patientId: string,
    _wearableId: string
  ): Array<{ type: string; value: number; unit: string }> {
    const readings: Array<{ type: string; value: number; unit: string }> = [];

    if (summary.averageHeartRateInBeatsPerMinute != null) {
      readings.push({
        type: 'HEART_RATE',
        value: summary.averageHeartRateInBeatsPerMinute,
        unit: 'bpm',
      });
    }

    if (summary.steps != null) {
      readings.push({
        type: 'STEPS',
        value: summary.steps,
        unit: 'steps',
      });
    }

    if (summary.averageSpO2 != null) {
      readings.push({
        type: 'OXYGEN_SATURATION',
        value: summary.averageSpO2,
        unit: '%',
      });
    }

    return readings;
  }
}

// Singleton instance
export const garminProvider = new GarminProvider();
