/**
 * Integration Key Service
 * Secure storage, status, rotation history, and validation for third-party integration keys.
 */

import crypto from 'crypto';
import { Prisma } from '@prisma/client';
import { env } from '../config/env';
import { prisma } from '../config/database';
import { encryptionService } from './encryptionService';

export type IntegrationProvider = 'whatsapp' | 'apple' | 'android';
type KeyWriteOperation = 'update' | 'rotate' | 'rollback';

interface KeyDefinition {
  keyName: string;
  label: string;
  required: boolean;
}

interface ProviderDefinition {
  provider: IntegrationProvider;
  label: string;
  keys: KeyDefinition[];
}

interface IntegrationKeyRow {
  provider: string;
  key_name: string;
  value_fingerprint: string | null;
  updated_at: Date;
  last_rotated_at: Date | null;
  version: number;
  last_validated_at: Date | null;
  last_validation_status: string | null;
  last_validation_message: string | null;
}

interface StoredIntegrationKeyRow {
  key_name: string;
  encrypted_value: string;
  version: number;
}

interface IntegrationKeyVersionRow {
  provider: string;
  key_name: string;
  version: number;
  value_fingerprint: string;
  status: 'active' | 'revoked';
  rotation_reason: string | null;
  rotated_by: string | null;
  created_at: Date;
  revoked_at: Date | null;
}

interface IntegrationKeyStatus {
  keyName: string;
  label: string;
  required: boolean;
  configured: boolean;
  source: 'vault' | 'env' | 'none';
  fingerprintPreview: string | null;
  updatedAt: string | null;
  lastRotatedAt: string | null;
  version: number | null;
  lastValidatedAt: string | null;
  validationStatus: 'valid' | 'invalid' | 'unknown' | 'not_configured';
  validationMessage: string | null;
}

export interface ProviderStatus {
  provider: IntegrationProvider;
  label: string;
  configuredCount: number;
  totalKeys: number;
  requiredConfiguredCount: number;
  requiredTotal: number;
  isValid: boolean;
  keys: IntegrationKeyStatus[];
  lastValidatedAt: string | null;
}

interface ProviderValidationResult {
  valid: boolean;
  message: string;
  checks: Record<string, boolean>;
}

interface KeyHistoryItem {
  keyName: string;
  version: number;
  status: 'active' | 'revoked';
  rotationReason: string | null;
  rotatedBy: string | null;
  fingerprintPreview: string | null;
  createdAt: string;
  revokedAt: string | null;
}

interface UpsertResult {
  previousVersion: number | null;
  newVersion: number;
}

const PROVIDER_DEFINITIONS: Record<IntegrationProvider, ProviderDefinition> = {
  whatsapp: {
    provider: 'whatsapp',
    label: 'WhatsApp Business',
    keys: [
      { keyName: 'WHATSAPP_API_URL', label: 'API URL', required: true },
      { keyName: 'WHATSAPP_ACCESS_TOKEN', label: 'Access Token', required: true },
      { keyName: 'WHATSAPP_PHONE_NUMBER_ID', label: 'Phone Number ID', required: true },
      { keyName: 'WHATSAPP_WEBHOOK_SECRET', label: 'Webhook Secret', required: true },
      { keyName: 'WHATSAPP_WEBHOOK_VERIFY_TOKEN', label: 'Webhook Verify Token', required: true },
    ],
  },
  apple: {
    provider: 'apple',
    label: 'Apple Health',
    keys: [
      { keyName: 'APPLE_WEBHOOK_SECRET', label: 'Webhook Secret', required: true },
      { keyName: 'APPLE_HEALTHKIT_TEAM_ID', label: 'HealthKit Team ID', required: false },
      { keyName: 'APPLE_HEALTHKIT_KEY_ID', label: 'HealthKit Key ID', required: false },
    ],
  },
  android: {
    provider: 'android',
    label: 'Android Health',
    keys: [
      { keyName: 'HEALTH_CONNECT_WEBHOOK_SECRET', label: 'Health Connect Webhook Secret', required: true },
      { keyName: 'GOOGLE_CLIENT_ID', label: 'Google Client ID', required: true },
      { keyName: 'GOOGLE_CLIENT_SECRET', label: 'Google Client Secret', required: true },
      { keyName: 'GOOGLE_REDIRECT_URI', label: 'Google Redirect URI', required: true },
    ],
  },
};

const isIntegrationProvider = (value: string): value is IntegrationProvider => {
  return value === 'whatsapp' || value === 'apple' || value === 'android';
};

const asEnvRecord = (): Record<string, unknown> => env as unknown as Record<string, unknown>;

const previewFingerprint = (fingerprint: string | null): string | null => {
  if (!fingerprint) return null;
  return `...${fingerprint.slice(-4)}`;
};

class IntegrationKeyService {
  private initPromise: Promise<void> | null = null;

  private async ensureStorage(): Promise<void> {
    if (!this.initPromise) {
      this.initPromise = this.initializeStorage();
    }
    await this.initPromise;
  }

  private async initializeStorage(): Promise<void> {
    // Tables are now managed by Prisma migrations.
    // See prisma/migrations/ for schema DDL.
  }

  private async listRows(): Promise<IntegrationKeyRow[]> {
    await this.ensureStorage();
    return prisma.$queryRaw<IntegrationKeyRow[]>`
      SELECT provider, key_name, value_fingerprint, updated_at, last_rotated_at, version, last_validated_at, last_validation_status, last_validation_message
      FROM admin_integration_keys
    `;
  }

  private async listRowsByProvider(provider: IntegrationProvider): Promise<IntegrationKeyRow[]> {
    await this.ensureStorage();
    return prisma.$queryRaw<IntegrationKeyRow[]>`
      SELECT provider, key_name, value_fingerprint, updated_at, last_rotated_at, version, last_validated_at, last_validation_status, last_validation_message
      FROM admin_integration_keys
      WHERE provider = ${provider}
    `;
  }

  private async listStoredRowsByProvider(provider: IntegrationProvider): Promise<StoredIntegrationKeyRow[]> {
    await this.ensureStorage();
    return prisma.$queryRaw<StoredIntegrationKeyRow[]>`
      SELECT key_name, encrypted_value, version
      FROM admin_integration_keys
      WHERE provider = ${provider}
    `;
  }

  private async readDecryptedValues(provider: IntegrationProvider): Promise<Record<string, string>> {
    const rows = await this.listStoredRowsByProvider(provider);
    const envValues = asEnvRecord();
    const values: Record<string, string> = {};

    for (const definition of PROVIDER_DEFINITIONS[provider].keys) {
      const fromDb = rows.find((row) => row.key_name === definition.keyName);
      if (fromDb) {
        values[definition.keyName] = encryptionService.decrypt(fromDb.encrypted_value);
        continue;
      }

      const fromEnv = envValues[definition.keyName];
      if (typeof fromEnv === 'string' && fromEnv.trim() !== '') {
        values[definition.keyName] = fromEnv;
      }
    }

    return values;
  }

  private async upsertKeyValue(args: {
    provider: IntegrationProvider;
    keyName: string;
    value: string;
    actorUserId: string;
    operation: KeyWriteOperation;
    reason?: string;
  }): Promise<UpsertResult> {
    await this.ensureStorage();
    const { provider, keyName, value, actorUserId, operation, reason } = args;
    const encryptedValue = encryptionService.encrypt(value);
    const fingerprint = encryptionService.hash(value);
    const rotatedAt = operation === 'rotate' || operation === 'rollback' ? new Date() : null;

    return prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const currentRows = await tx.$queryRaw<
        Array<{ version: number }>
      >`SELECT version FROM admin_integration_keys WHERE provider = ${provider} AND key_name = ${keyName} LIMIT 1`;
      const current = currentRows[0];
      const previousVersion = current?.version ?? null;
      const newVersion = (previousVersion ?? 0) + 1;

      if (previousVersion !== null) {
        await tx.$executeRaw`
          UPDATE admin_integration_key_versions
          SET status = 'revoked', revoked_at = NOW()
          WHERE provider = ${provider}
            AND key_name = ${keyName}
            AND version = ${previousVersion}
            AND status = 'active'
        `;
      }

      await tx.$executeRaw`
        INSERT INTO admin_integration_keys (
          id,
          provider,
          key_name,
          encrypted_value,
          value_fingerprint,
          version,
          last_rotated_at,
          created_by,
          updated_by
        )
        VALUES (
          ${crypto.randomUUID()},
          ${provider},
          ${keyName},
          ${encryptedValue},
          ${fingerprint},
          ${newVersion},
          ${rotatedAt},
          ${actorUserId},
          ${actorUserId}
        )
        ON CONFLICT(provider, key_name)
        DO UPDATE SET
          encrypted_value = EXCLUDED.encrypted_value,
          value_fingerprint = EXCLUDED.value_fingerprint,
          version = EXCLUDED.version,
          last_rotated_at = COALESCE(EXCLUDED.last_rotated_at, admin_integration_keys.last_rotated_at),
          updated_by = EXCLUDED.updated_by,
          updated_at = NOW(),
          last_validation_status = 'unknown',
          last_validation_message = NULL
      `;

      await tx.$executeRaw`
        INSERT INTO admin_integration_key_versions (
          id,
          provider,
          key_name,
          version,
          encrypted_value,
          value_fingerprint,
          status,
          rotation_reason,
          rotated_by
        )
        VALUES (
          ${crypto.randomUUID()},
          ${provider},
          ${keyName},
          ${newVersion},
          ${encryptedValue},
          ${fingerprint},
          'active',
          ${reason || null},
          ${actorUserId}
        )
      `;

      return {
        previousVersion,
        newVersion,
      };
    });
  }

  private buildProviderStatus(provider: IntegrationProvider, rows: IntegrationKeyRow[]): ProviderStatus {
    const envValues = asEnvRecord();
    const definition = PROVIDER_DEFINITIONS[provider];
    const rowMap = new Map<string, IntegrationKeyRow>();
    for (const row of rows) {
      rowMap.set(row.key_name, row);
    }

    const keys: IntegrationKeyStatus[] = definition.keys.map((keyDefinition) => {
      const row = rowMap.get(keyDefinition.keyName);
      const envValue = envValues[keyDefinition.keyName];
      const envConfigured = typeof envValue === 'string' && envValue.trim() !== '';
      const configured = Boolean(row) || envConfigured;
      const validationStatus = configured
        ? row?.last_validation_status === 'valid' || row?.last_validation_status === 'invalid'
          ? row.last_validation_status
          : 'unknown'
        : 'not_configured';

      return {
        keyName: keyDefinition.keyName,
        label: keyDefinition.label,
        required: keyDefinition.required,
        configured,
        source: row ? 'vault' : envConfigured ? 'env' : 'none',
        fingerprintPreview: previewFingerprint(row?.value_fingerprint || null),
        updatedAt: row?.updated_at ? row.updated_at.toISOString() : null,
        lastRotatedAt: row?.last_rotated_at ? row.last_rotated_at.toISOString() : null,
        version: row?.version ?? null,
        lastValidatedAt: row?.last_validated_at ? row.last_validated_at.toISOString() : null,
        validationStatus,
        validationMessage: row?.last_validation_message || null,
      };
    });

    const requiredKeys = keys.filter((key) => key.required);
    const requiredConfiguredCount = requiredKeys.filter((key) => key.configured).length;
    const invalidKeyExists = keys.some((key) => key.validationStatus === 'invalid');

    const latestValidation =
      keys
        .map((key) => key.lastValidatedAt)
        .filter((value): value is string => Boolean(value))
        .sort((a, b) => new Date(b).getTime() - new Date(a).getTime())[0] || null;

    return {
      provider,
      label: definition.label,
      configuredCount: keys.filter((key) => key.configured).length,
      totalKeys: keys.length,
      requiredConfiguredCount,
      requiredTotal: requiredKeys.length,
      isValid: requiredConfiguredCount === requiredKeys.length && !invalidKeyExists,
      keys,
      lastValidatedAt: latestValidation,
    };
  }

  private assertProviderKey(provider: IntegrationProvider, keyNameInput: string): string {
    const allowedKeys = new Set(PROVIDER_DEFINITIONS[provider].keys.map((key) => key.keyName));
    if (!allowedKeys.has(keyNameInput)) {
      throw new Error(`Unsupported key name for provider ${provider}`);
    }
    return keyNameInput;
  }

  async getStatus(): Promise<{
    providers: ProviderStatus[];
    generatedAt: string;
  }> {
    const rows = await this.listRows();
    const providers: ProviderStatus[] = (Object.keys(PROVIDER_DEFINITIONS) as IntegrationProvider[]).map(
      (provider) => {
        const providerRows = rows.filter((row) => row.provider === provider);
        return this.buildProviderStatus(provider, providerRows);
      }
    );

    return {
      providers,
      generatedAt: new Date().toISOString(),
    };
  }

  async updateProviderKeys(
    providerInput: string,
    keys: Record<string, string>,
    actorUserId: string
  ): Promise<ProviderStatus> {
    if (!isIntegrationProvider(providerInput)) {
      throw new Error('Unsupported provider');
    }

    const provider = providerInput;
    const allowedKeys = new Set(PROVIDER_DEFINITIONS[provider].keys.map((key) => key.keyName));
    const updates = Object.entries(keys).filter(([key, value]) => {
      return allowedKeys.has(key) && typeof value === 'string' && value.trim() !== '';
    });

    if (updates.length === 0) {
      throw new Error('No valid key values provided');
    }

    for (const [keyName, rawValue] of updates) {
      await this.upsertKeyValue({
        provider,
        keyName,
        value: rawValue.trim(),
        actorUserId,
        operation: 'update',
        reason: 'admin-update',
      });
    }

    const rows = await this.listRowsByProvider(provider);
    return this.buildProviderStatus(provider, rows);
  }

  async rotateProviderKeys(args: {
    providerInput: string;
    keyNames?: string[];
    actorUserId: string;
    reason?: string;
  }): Promise<{
    provider: IntegrationProvider;
    rotatedCount: number;
    rotatedKeys: Array<{ keyName: string; previousVersion: number; newVersion: number }>;
    skippedKeys: Array<{ keyName: string; reason: string }>;
    status: ProviderStatus;
  }> {
    const { providerInput, keyNames, actorUserId, reason } = args;
    if (!isIntegrationProvider(providerInput)) {
      throw new Error('Unsupported provider');
    }

    const provider = providerInput;
    const providerKeys = PROVIDER_DEFINITIONS[provider].keys.map((key) => key.keyName);
    const targetKeys =
      keyNames && keyNames.length > 0
        ? Array.from(
            new Set(
              keyNames
                .map((keyName) => keyName.trim())
                .filter((keyName) => keyName.length > 0)
                .map((keyName) => this.assertProviderKey(provider, keyName))
            )
          )
        : providerKeys;

    const storedRows = await this.listStoredRowsByProvider(provider);
    const storedMap = new Map<string, StoredIntegrationKeyRow>();
    for (const row of storedRows) {
      storedMap.set(row.key_name, row);
    }

    const rotatedKeys: Array<{ keyName: string; previousVersion: number; newVersion: number }> = [];
    const skippedKeys: Array<{ keyName: string; reason: string }> = [];

    for (const keyName of targetKeys) {
      const stored = storedMap.get(keyName);
      if (!stored) {
        skippedKeys.push({
          keyName,
          reason: 'no_vault_value',
        });
        continue;
      }

      const plaintext = encryptionService.decrypt(stored.encrypted_value);
      const rotation = await this.upsertKeyValue({
        provider,
        keyName,
        value: plaintext,
        actorUserId,
        operation: 'rotate',
        reason: reason || 'manual-rotation',
      });
      rotatedKeys.push({
        keyName,
        previousVersion: rotation.previousVersion ?? 0,
        newVersion: rotation.newVersion,
      });
    }

    if (rotatedKeys.length === 0) {
      throw new Error('No vault-managed keys available for rotation');
    }

    const rows = await this.listRowsByProvider(provider);
    const status = this.buildProviderStatus(provider, rows);

    return {
      provider,
      rotatedCount: rotatedKeys.length,
      rotatedKeys,
      skippedKeys,
      status,
    };
  }

  async getProviderHistory(
    providerInput: string,
    limitInput = 50
  ): Promise<{
    provider: IntegrationProvider;
    items: KeyHistoryItem[];
  }> {
    if (!isIntegrationProvider(providerInput)) {
      throw new Error('Unsupported provider');
    }

    const provider = providerInput;
    const limit = Math.max(1, Math.min(200, Math.floor(limitInput)));
    const rows = await prisma.$queryRaw<IntegrationKeyVersionRow[]>`
      SELECT provider, key_name, version, value_fingerprint, status, rotation_reason, rotated_by, created_at, revoked_at
      FROM admin_integration_key_versions
      WHERE provider = ${provider}
      ORDER BY created_at DESC
      LIMIT ${limit}
    `;

    return {
      provider,
      items: rows.map((row: IntegrationKeyVersionRow) => ({
        keyName: row.key_name,
        version: row.version,
        status: row.status,
        rotationReason: row.rotation_reason,
        rotatedBy: row.rotated_by,
        fingerprintPreview: previewFingerprint(row.value_fingerprint),
        createdAt: row.created_at.toISOString(),
        revokedAt: row.revoked_at ? row.revoked_at.toISOString() : null,
      })),
    };
  }

  async rollbackProviderKey(args: {
    providerInput: string;
    keyNameInput: string;
    versionInput: number;
    actorUserId: string;
    reason?: string;
  }): Promise<{
    provider: IntegrationProvider;
    keyName: string;
    restoredFromVersion: number;
    newVersion: number;
    status: ProviderStatus;
  }> {
    const { providerInput, keyNameInput, versionInput, actorUserId, reason } = args;
    if (!isIntegrationProvider(providerInput)) {
      throw new Error('Unsupported provider');
    }

    const provider = providerInput;
    const keyName = this.assertProviderKey(provider, keyNameInput);
    const version = Math.floor(versionInput);
    if (!Number.isFinite(version) || version <= 0) {
      throw new Error('version must be a positive integer');
    }

    await this.ensureStorage();
    const rows = await prisma.$queryRaw<Array<{ encrypted_value: string }>>`
      SELECT encrypted_value
      FROM admin_integration_key_versions
      WHERE provider = ${provider}
        AND key_name = ${keyName}
        AND version = ${version}
      LIMIT 1
    `;
    const fromVersion = rows[0];
    if (!fromVersion) {
      throw new Error('Requested key version was not found');
    }

    const plaintext = encryptionService.decrypt(fromVersion.encrypted_value);
    const result = await this.upsertKeyValue({
      provider,
      keyName,
      value: plaintext,
      actorUserId,
      operation: 'rollback',
      reason: reason ? `rollback:${reason}` : `rollback:version:${version}`,
    });

    const statusRows = await this.listRowsByProvider(provider);
    return {
      provider,
      keyName,
      restoredFromVersion: version,
      newVersion: result.newVersion,
      status: this.buildProviderStatus(provider, statusRows),
    };
  }

  async validateProvider(providerInput: string): Promise<{
    provider: IntegrationProvider;
    valid: boolean;
    message: string;
    checks: Record<string, boolean>;
    status: ProviderStatus;
  }> {
    if (!isIntegrationProvider(providerInput)) {
      throw new Error('Unsupported provider');
    }

    const provider = providerInput;
    const values = await this.readDecryptedValues(provider);

    let result: ProviderValidationResult;
    if (provider === 'whatsapp') {
      result = await this.validateWhatsApp(values);
    } else if (provider === 'apple') {
      result = await this.validateApple(values);
    } else {
      result = await this.validateAndroid(values);
    }

    await this.ensureStorage();
    await prisma.$executeRaw`
      UPDATE admin_integration_keys
      SET
        last_validated_at = NOW(),
        last_validation_status = ${result.valid ? 'valid' : 'invalid'},
        last_validation_message = ${result.message},
        updated_at = NOW()
      WHERE provider = ${provider}
    `;

    const rows = await this.listRowsByProvider(provider);
    const status = this.buildProviderStatus(provider, rows);

    return {
      provider,
      valid: result.valid,
      message: result.message,
      checks: result.checks,
      status,
    };
  }

  private async validateWhatsApp(values: Record<string, string>): Promise<ProviderValidationResult> {
    const accessToken = values['WHATSAPP_ACCESS_TOKEN'] || '';
    const phoneNumberId = values['WHATSAPP_PHONE_NUMBER_ID'] || '';
    const apiUrl = values['WHATSAPP_API_URL'] || 'https://graph.facebook.com/v18.0';
    const webhookSecret = values['WHATSAPP_WEBHOOK_SECRET'] || '';
    const verifyToken = values['WHATSAPP_WEBHOOK_VERIFY_TOKEN'] || '';

    const checks: Record<string, boolean> = {
      accessToken: accessToken.length > 20,
      phoneNumberId: phoneNumberId.length > 3,
      webhookSecret: webhookSecret.length >= 16,
      verifyToken: verifyToken.length >= 8,
      apiReachable: false,
    };

    if (checks['accessToken'] && checks['phoneNumberId']) {
      try {
        const base = apiUrl.replace(/\/$/, '');
        const response = await fetch(
          `${base}/${encodeURIComponent(phoneNumberId)}?fields=id,display_phone_number`,
          {
            method: 'GET',
            headers: {
              Authorization: `Bearer ${accessToken}`,
            },
          }
        );
        checks['apiReachable'] = response.ok;
      } catch {
        checks['apiReachable'] = false;
      }
    }

    const valid = Object.values(checks).every(Boolean);
    return {
      valid,
      message: valid
        ? 'WhatsApp configuration validated successfully'
        : 'WhatsApp validation failed. Check token, phone number id, and webhook secrets.',
      checks,
    };
  }

  private async validateApple(values: Record<string, string>): Promise<ProviderValidationResult> {
    const webhookSecret = values['APPLE_WEBHOOK_SECRET'] || '';
    const teamId = values['APPLE_HEALTHKIT_TEAM_ID'] || '';
    const keyId = values['APPLE_HEALTHKIT_KEY_ID'] || '';

    const checks: Record<string, boolean> = {
      webhookSecret: webhookSecret.length >= 16,
      teamIdPairing:
        (teamId.length > 0 && keyId.length > 0) || (teamId.length === 0 && keyId.length === 0),
    };

    const valid = Object.values(checks).every(Boolean);
    return {
      valid,
      message: valid
        ? 'Apple configuration validated successfully'
        : 'Apple validation failed. Webhook secret is required and Team/Key IDs must be paired.',
      checks,
    };
  }

  private async validateAndroid(values: Record<string, string>): Promise<ProviderValidationResult> {
    const healthConnectSecret = values['HEALTH_CONNECT_WEBHOOK_SECRET'] || '';
    const googleClientId = values['GOOGLE_CLIENT_ID'] || '';
    const googleClientSecret = values['GOOGLE_CLIENT_SECRET'] || '';
    const googleRedirectUri = values['GOOGLE_REDIRECT_URI'] || '';

    const checks: Record<string, boolean> = {
      healthConnectSecret: healthConnectSecret.length >= 16,
      googleClientId: googleClientId.length > 8,
      googleClientSecret: googleClientSecret.length > 12,
      googleRedirectUri: false,
    };

    try {
      const parsed = new URL(googleRedirectUri);
      checks['googleRedirectUri'] = parsed.protocol === 'https:' || parsed.protocol === 'http:';
    } catch {
      checks['googleRedirectUri'] = false;
    }

    const valid = Object.values(checks).every(Boolean);
    return {
      valid,
      message: valid
        ? 'Android configuration validated successfully'
        : 'Android validation failed. Check Health Connect secret and Google OAuth settings.',
      checks,
    };
  }
}

export const integrationKeyService = new IntegrationKeyService();
