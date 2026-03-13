import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/services/api/client";

export type IntegrationProvider = "whatsapp" | "apple" | "android";

export interface IntegrationKeyStatus {
  keyName: string;
  label: string;
  required: boolean;
  configured: boolean;
  source: "vault" | "env" | "none";
  fingerprintPreview: string | null;
  updatedAt: string | null;
  lastRotatedAt: string | null;
  version: number | null;
  lastValidatedAt: string | null;
  validationStatus: "valid" | "invalid" | "unknown" | "not_configured";
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

interface IntegrationStatusResponse {
  status: string;
  data: {
    providers: ProviderStatus[];
    generatedAt: string;
  };
}

interface UpdateKeysResponse {
  status: string;
  data: {
    provider: IntegrationProvider;
    configuredCount: number;
    totalKeys: number;
    status: ProviderStatus;
  };
}

interface ValidateResponse {
  status: string;
  data: {
    provider: IntegrationProvider;
    valid: boolean;
    message: string;
    checks: Record<string, boolean>;
    status: ProviderStatus;
  };
}

interface RotateResponse {
  status: string;
  data: {
    provider: IntegrationProvider;
    rotatedCount: number;
    rotatedKeys: Array<{
      keyName: string;
      previousVersion: number;
      newVersion: number;
    }>;
    skippedKeys: Array<{
      keyName: string;
      reason: string;
    }>;
    status: ProviderStatus;
  };
}

interface ProviderHistoryResponse {
  status: string;
  data: {
    provider: IntegrationProvider;
    items: Array<{
      keyName: string;
      version: number;
      status: "active" | "revoked";
      rotationReason: string | null;
      rotatedBy: string | null;
      fingerprintPreview: string | null;
      createdAt: string;
      revokedAt: string | null;
    }>;
  };
}

const USE_MOCK =
  import.meta.env.VITE_ENABLE_PILOT_MOCK_DATA === "true" ||
  (typeof window !== "undefined" &&
    window.location.pathname.startsWith("/demo/") &&
    import.meta.env.VITE_ENABLE_MOCK_DATA !== "false");

const mockProviders: ProviderStatus[] = [
  {
    provider: "whatsapp",
    label: "WhatsApp Business",
    configuredCount: 4,
    totalKeys: 5,
    requiredConfiguredCount: 4,
    requiredTotal: 5,
    isValid: false,
    lastValidatedAt: null,
    keys: [
      { keyName: "WHATSAPP_API_URL", label: "API URL", required: true, configured: true, source: "env", fingerprintPreview: null, updatedAt: null, lastRotatedAt: null, version: null, lastValidatedAt: null, validationStatus: "unknown", validationMessage: null },
      { keyName: "WHATSAPP_ACCESS_TOKEN", label: "Access Token", required: true, configured: true, source: "vault", fingerprintPreview: "...a1c4", updatedAt: new Date().toISOString(), lastRotatedAt: new Date().toISOString(), version: 2, lastValidatedAt: null, validationStatus: "unknown", validationMessage: null },
      { keyName: "WHATSAPP_PHONE_NUMBER_ID", label: "Phone Number ID", required: true, configured: true, source: "vault", fingerprintPreview: "...76bf", updatedAt: new Date().toISOString(), lastRotatedAt: new Date().toISOString(), version: 2, lastValidatedAt: null, validationStatus: "unknown", validationMessage: null },
      { keyName: "WHATSAPP_WEBHOOK_SECRET", label: "Webhook Secret", required: true, configured: true, source: "vault", fingerprintPreview: "...9dd0", updatedAt: new Date().toISOString(), lastRotatedAt: new Date().toISOString(), version: 2, lastValidatedAt: null, validationStatus: "unknown", validationMessage: null },
      { keyName: "WHATSAPP_WEBHOOK_VERIFY_TOKEN", label: "Webhook Verify Token", required: true, configured: false, source: "none", fingerprintPreview: null, updatedAt: null, lastRotatedAt: null, version: null, lastValidatedAt: null, validationStatus: "not_configured", validationMessage: null },
    ],
  },
  {
    provider: "apple",
    label: "Apple Health",
    configuredCount: 1,
    totalKeys: 3,
    requiredConfiguredCount: 1,
    requiredTotal: 1,
    isValid: true,
    lastValidatedAt: new Date().toISOString(),
    keys: [
      { keyName: "APPLE_WEBHOOK_SECRET", label: "Webhook Secret", required: true, configured: true, source: "vault", fingerprintPreview: "...cc40", updatedAt: new Date().toISOString(), lastRotatedAt: new Date().toISOString(), version: 3, lastValidatedAt: new Date().toISOString(), validationStatus: "valid", validationMessage: "Apple configuration validated successfully" },
      { keyName: "APPLE_HEALTHKIT_TEAM_ID", label: "HealthKit Team ID", required: false, configured: false, source: "none", fingerprintPreview: null, updatedAt: null, lastRotatedAt: null, version: null, lastValidatedAt: null, validationStatus: "not_configured", validationMessage: null },
      { keyName: "APPLE_HEALTHKIT_KEY_ID", label: "HealthKit Key ID", required: false, configured: false, source: "none", fingerprintPreview: null, updatedAt: null, lastRotatedAt: null, version: null, lastValidatedAt: null, validationStatus: "not_configured", validationMessage: null },
    ],
  },
  {
    provider: "android",
    label: "Android Health",
    configuredCount: 2,
    totalKeys: 4,
    requiredConfiguredCount: 2,
    requiredTotal: 4,
    isValid: false,
    lastValidatedAt: null,
    keys: [
      { keyName: "HEALTH_CONNECT_WEBHOOK_SECRET", label: "Health Connect Webhook Secret", required: true, configured: true, source: "vault", fingerprintPreview: "...8bf2", updatedAt: new Date().toISOString(), lastRotatedAt: new Date().toISOString(), version: 2, lastValidatedAt: null, validationStatus: "unknown", validationMessage: null },
      { keyName: "GOOGLE_CLIENT_ID", label: "Google Client ID", required: true, configured: true, source: "vault", fingerprintPreview: "...f91a", updatedAt: new Date().toISOString(), lastRotatedAt: new Date().toISOString(), version: 2, lastValidatedAt: null, validationStatus: "unknown", validationMessage: null },
      { keyName: "GOOGLE_CLIENT_SECRET", label: "Google Client Secret", required: true, configured: false, source: "none", fingerprintPreview: null, updatedAt: null, lastRotatedAt: null, version: null, lastValidatedAt: null, validationStatus: "not_configured", validationMessage: null },
      { keyName: "GOOGLE_REDIRECT_URI", label: "Google Redirect URI", required: true, configured: false, source: "none", fingerprintPreview: null, updatedAt: null, lastRotatedAt: null, version: null, lastValidatedAt: null, validationStatus: "not_configured", validationMessage: null },
    ],
  },
];

export function useIntegrationKeyStatus() {
  return useQuery({
    queryKey: ["integrationKeyStatus"],
    queryFn: async () => {
      if (USE_MOCK) {
        return {
          providers: mockProviders,
          generatedAt: new Date().toISOString(),
        };
      }
      const response = await apiClient.get<IntegrationStatusResponse>("/admin/integrations/keys/status");
      return response.data.data;
    },
    refetchInterval: 30000,
  });
}

export function useUpdateIntegrationKeys() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      provider,
      keys,
      mfaCode,
    }: {
      provider: IntegrationProvider;
      keys: Record<string, string>;
      mfaCode?: string;
    }) => {
      if (USE_MOCK) {
        return {
          provider,
          configuredCount: Object.keys(keys).length,
        };
      }
      const response = await apiClient.put<UpdateKeysResponse>(
        `/admin/integrations/keys/${provider}`,
        { keys },
        {
          headers: mfaCode ? { "x-mfa-code": mfaCode } : {},
        }
      );
      return response.data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["integrationKeyStatus"] });
      queryClient.invalidateQueries({ queryKey: ["integrationKeyHistory"] });
    },
  });
}

export function useValidateIntegrationKeys() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (provider: IntegrationProvider) => {
      if (USE_MOCK) {
        return {
          provider,
          valid: true,
          message: "Mock validation completed",
          checks: {},
        };
      }
      const response = await apiClient.post<ValidateResponse>(
        `/admin/integrations/keys/${provider}/validate`
      );
      return response.data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["integrationKeyStatus"] });
      queryClient.invalidateQueries({ queryKey: ["integrationKeyHistory"] });
    },
  });
}

export function useRotateIntegrationKeys() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      provider,
      keyNames,
      reason,
      mfaCode,
    }: {
      provider: IntegrationProvider;
      keyNames?: string[];
      reason?: string;
      mfaCode?: string;
    }) => {
      if (USE_MOCK) {
        const providerMock = mockProviders.find((item) => item.provider === provider);
        const resolvedKeyNames = keyNames?.length
          ? keyNames
          : providerMock?.keys.map((key) => key.keyName) || [];
        return {
          provider,
          rotatedCount: resolvedKeyNames.length,
          rotatedKeys: resolvedKeyNames.map((keyName, idx) => ({
            keyName,
            previousVersion: idx + 1,
            newVersion: idx + 2,
          })),
          skippedKeys: [],
        };
      }
      const response = await apiClient.post<RotateResponse>(
        `/admin/integrations/keys/${provider}/rotate`,
        {
          keyNames,
          reason,
        },
        {
          headers: mfaCode ? { "x-mfa-code": mfaCode } : {},
        }
      );
      return response.data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["integrationKeyStatus"] });
      queryClient.invalidateQueries({ queryKey: ["integrationKeyHistory"] });
    },
  });
}

export function useIntegrationKeyHistory(provider: IntegrationProvider, limit = 20) {
  return useQuery({
    queryKey: ["integrationKeyHistory", provider, limit],
    enabled: !USE_MOCK,
    queryFn: async () => {
      const response = await apiClient.get<ProviderHistoryResponse>(
        `/admin/integrations/keys/${provider}/history?limit=${limit}`
      );
      return response.data.data;
    },
  });
}
