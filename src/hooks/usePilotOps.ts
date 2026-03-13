import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/services/api/client";

export interface PilotOverview {
  windowHours: number;
  generatedAt: string;
  whatsapp: {
    optedInPatients: number;
    followUpsCompleted: number;
    conversationsActive: number;
    messagesInbound: number;
    messagesOutbound: number;
    triageBreakdown: {
      red: number;
      amber: number;
      green: number;
      unknown: number;
    };
    averageWellbeingScore: number | null;
    deliveryStatus: {
      sent: number;
      delivered: number;
      read: number;
      failed: number;
      unknown: number;
    };
    flowSteps: {
      wellbeing: number;
      symptoms: number;
      medications: number;
      completed: number;
      unknown: number;
    };
  };
  appleWatch: {
    connectedDevices: number;
    connectedAppleWatches: number;
    syncedInWindow: number;
    averageSyncLagHours: number | null;
  };
  recentEvents: Array<{
    type: "check_in" | "apple_watch_sync";
    timestamp: string;
    patientId: string;
    patientName: string;
    triageOutcome?: "red" | "amber" | "green" | null;
    wellbeingScore?: number | null;
    deviceId?: string;
    deviceName?: string;
    batteryLevel?: number | null;
  }>;
}

interface PilotOverviewEnvelope {
  status: string;
  data: PilotOverview;
}

export interface PilotConversationSummary {
  patientId: string;
  patientName: string;
  whatsappPhone: string | null;
  latestMessageAt: string;
  latestMessagePreview: string;
  latestDirection: string;
  inboundCount: number;
  outboundCount: number;
  appleWatchLastSyncAt: string | null;
  androidLastSyncAt: string | null;
}

export interface PilotConversationsData {
  windowHours: number;
  generatedAt: string;
  conversations: PilotConversationSummary[];
}

interface PilotConversationsEnvelope {
  status: string;
  data: PilotConversationsData;
}

export interface PilotPatientMessagesData {
  patient: {
    id: string;
    name: string;
    whatsappPhone: string | null;
  };
  messages: Array<{
    id: string;
    direction: string;
    senderType: string;
    content: string;
    flowStep: string | null;
    whatsappStatus: string | null;
    createdAt: string;
  }>;
  devices: Array<{
    id: string;
    deviceType: string;
    deviceName: string | null;
    connectionStatus: string;
    batteryLevel: number | null;
    lastSyncAt: string | null;
  }>;
}

interface PilotPatientMessagesEnvelope {
  status: string;
  data: PilotPatientMessagesData;
}

export interface PilotRuntimeStatus {
  generatedAt: string;
  local: {
    apiHealthy: boolean;
    databaseReachable: boolean;
    nodeEnv: string;
    port: number;
    uptimeSeconds: number;
  };
  providers: Array<{
    provider: "whatsapp" | "apple" | "android";
    label: string;
    isValid: boolean;
    requiredConfiguredCount: number;
    requiredTotal: number;
    ready: boolean;
    missingRequiredKeys: string[];
  }>;
  webhookPaths: {
    whatsapp: string;
    apple: string;
    android: string;
    googleFit: string;
  };
  tunnel: null | {
    baseUrl: string;
    checks: {
      health: {
        ok: boolean;
        status: number | null;
        error: string | null;
      };
      whatsapp: {
        ok: boolean;
        status: number | null;
        error: string | null;
      };
      apple: {
        ok: boolean;
        status: number | null;
        error: string | null;
      };
      android: {
        ok: boolean;
        status: number | null;
        error: string | null;
      };
    };
    reachable: boolean;
  };
}

interface PilotRuntimeStatusEnvelope {
  status: string;
  data: PilotRuntimeStatus;
}

export interface PilotDevice {
  id: string;
  deviceType: "apple_watch" | "wear_os" | "health_connect" | "samsung";
  deviceName: string | null;
  deviceModel?: string | null;
  serialNumber: string | null;
  isConnected: boolean;
  connectionStatus: string;
  batteryLevel: number | null;
  lastSyncAt: string | null;
  updatedAt?: string;
}

export interface PilotRosterPatient {
  id: string;
  name: string;
  whatsappPhone: string | null;
  whatsappOptedIn: boolean;
  connectedDevices: number;
  appleConnectedDevices: number;
  androidConnectedDevices: number;
  devices: PilotDevice[];
}

export interface PilotPatientsData {
  generatedAt: string;
  patients: PilotRosterPatient[];
}

interface PilotPatientsEnvelope {
  status: string;
  data: PilotPatientsData;
}

interface PilotPatientContactMutationEnvelope {
  status: string;
  data: {
    patient: {
      id: string;
      whatsappPhone: string | null;
      whatsappOptedIn: boolean;
    };
  };
}

interface PilotDeviceMutationEnvelope {
  status: string;
  data: {
    device: PilotDevice;
  };
}

interface PilotFollowUpEnvelope {
  status: string;
  data: {
    patientId: string;
    started: boolean;
    reason?: string;
  };
}

interface PilotFollowUpBatchEnvelope {
  status: string;
  data: {
    requested: number;
    started: number;
    skipped: number;
    items: Array<{
      patientId: string;
      started: boolean;
      reason?: string;
    }>;
  };
}

// Keep pilot data mode independent from the general demo dashboard mode.
const USE_PILOT_MOCK = import.meta.env.VITE_ENABLE_PILOT_MOCK_DATA === "true";

const createMockOverview = (hours: number): PilotOverview => {
  const now = new Date().toISOString();
  return {
    windowHours: hours,
    generatedAt: now,
    whatsapp: {
      optedInPatients: 3,
      followUpsCompleted: 2,
      conversationsActive: 1,
      messagesInbound: 8,
      messagesOutbound: 11,
      triageBreakdown: {
        red: 1,
        amber: 1,
        green: 0,
        unknown: 0,
      },
      averageWellbeingScore: 4.5,
      deliveryStatus: {
        sent: 6,
        delivered: 4,
        read: 1,
        failed: 0,
        unknown: 0,
      },
      flowSteps: {
        wellbeing: 3,
        symptoms: 2,
        medications: 2,
        completed: 2,
        unknown: 0,
      },
    },
    appleWatch: {
      connectedDevices: 3,
      connectedAppleWatches: 3,
      syncedInWindow: 2,
      averageSyncLagHours: 1.8,
    },
    recentEvents: [
      {
        type: "check_in",
        timestamp: now,
        patientId: "pt-demo-1",
        patientName: "Margaret Thompson",
        triageOutcome: "red",
        wellbeingScore: 3,
      },
      {
        type: "apple_watch_sync",
        timestamp: now,
        patientId: "pt-demo-2",
        patientName: "David Chen",
        deviceId: "demo-watch-1",
        deviceName: "Apple Watch Series",
        batteryLevel: 61,
      },
    ],
  };
};

const createMockConversations = (hours: number): PilotConversationsData => {
  const now = new Date().toISOString();
  return {
    windowHours: hours,
    generatedAt: now,
    conversations: [
      {
        patientId: "pt-demo-1",
        patientName: "Margaret Thompson",
        whatsappPhone: "+447700900001",
        latestMessageAt: now,
        latestMessagePreview: "Feeling tired today, around 3 out of 10.",
        latestDirection: "inbound",
        inboundCount: 4,
        outboundCount: 5,
        appleWatchLastSyncAt: now,
        androidLastSyncAt: null,
      },
      {
        patientId: "pt-demo-2",
        patientName: "David Chen",
        whatsappPhone: "+447700900002",
        latestMessageAt: now,
        latestMessagePreview: "Medication taken, no chest pain.",
        latestDirection: "inbound",
        inboundCount: 3,
        outboundCount: 4,
        appleWatchLastSyncAt: null,
        androidLastSyncAt: now,
      },
    ],
  };
};

const createMockPatientMessages = (patientId: string): PilotPatientMessagesData => {
  const now = new Date();
  return {
    patient: {
      id: patientId,
      name: patientId === "pt-demo-2" ? "David Chen" : "Margaret Thompson",
      whatsappPhone: patientId === "pt-demo-2" ? "+447700900002" : "+447700900001",
    },
    messages: [
      {
        id: `${patientId}-msg-1`,
        direction: "outbound",
        senderType: "system",
        content:
          "Hi, this is your CardioWatch daily follow-up. On a scale from 0 to 10, how are you feeling today?",
        flowStep: "wellbeing",
        whatsappStatus: "read",
        createdAt: new Date(now.getTime() - 1000 * 60 * 8).toISOString(),
      },
      {
        id: `${patientId}-msg-2`,
        direction: "inbound",
        senderType: "patient",
        content: patientId === "pt-demo-2" ? "7" : "3",
        flowStep: "wellbeing",
        whatsappStatus: "received",
        createdAt: new Date(now.getTime() - 1000 * 60 * 7).toISOString(),
      },
    ],
    devices: [
      {
        id: `${patientId}-device-1`,
        deviceType: patientId === "pt-demo-2" ? "health_connect" : "apple_watch",
        deviceName: patientId === "pt-demo-2" ? "Pixel Watch" : "Apple Watch Series 9",
        connectionStatus: "connected",
        batteryLevel: patientId === "pt-demo-2" ? 58 : 74,
        lastSyncAt: new Date(now.getTime() - 1000 * 60 * 20).toISOString(),
      },
    ],
  };
};

const createMockRuntimeStatus = (baseUrl?: string): PilotRuntimeStatus => ({
  generatedAt: new Date().toISOString(),
  local: {
    apiHealthy: true,
    databaseReachable: true,
    nodeEnv: "development",
    port: 8080,
    uptimeSeconds: 3600,
  },
  providers: [
    {
      provider: "whatsapp",
      label: "WhatsApp Business",
      isValid: true,
      requiredConfiguredCount: 5,
      requiredTotal: 5,
      ready: true,
      missingRequiredKeys: [],
    },
    {
      provider: "apple",
      label: "Apple Health",
      isValid: true,
      requiredConfiguredCount: 1,
      requiredTotal: 1,
      ready: true,
      missingRequiredKeys: [],
    },
    {
      provider: "android",
      label: "Android Health",
      isValid: true,
      requiredConfiguredCount: 4,
      requiredTotal: 4,
      ready: true,
      missingRequiredKeys: [],
    },
  ],
  webhookPaths: {
    whatsapp: "/webhooks/whatsapp",
    apple: "/webhooks/apple-health",
    android: "/webhooks/health-connect",
    googleFit: "/webhooks/google-fit",
  },
  tunnel: baseUrl
    ? {
        baseUrl,
        checks: {
          health: { ok: true, status: 200, error: null },
          whatsapp: { ok: true, status: 403, error: null },
          apple: { ok: true, status: 401, error: null },
          android: { ok: true, status: 401, error: null },
        },
        reachable: true,
      }
    : null,
});

export function usePilotOverview(hours = 24) {
  return useQuery<PilotOverview>({
    queryKey: ["pilotOps", "overview", hours],
    queryFn: async () => {
      if (USE_PILOT_MOCK) {
        return createMockOverview(hours);
      }

      const response = await apiClient.get<PilotOverviewEnvelope>(
        `/admin/pilot/overview?hours=${hours}`
      );
      return response.data.data;
    },
    refetchInterval: 30000,
  });
}

export function usePilotConversations(hours = 24 * 7, limit = 25) {
  return useQuery<PilotConversationsData>({
    queryKey: ["pilotOps", "conversations", hours, limit],
    queryFn: async () => {
      if (USE_PILOT_MOCK) {
        return createMockConversations(hours);
      }

      const response = await apiClient.get<PilotConversationsEnvelope>(
        `/admin/pilot/whatsapp/conversations?hours=${hours}&limit=${limit}`
      );
      return response.data.data;
    },
    refetchInterval: 30000,
  });
}

export function usePilotPatientMessages(patientId?: string, limit = 100) {
  return useQuery<PilotPatientMessagesData>({
    queryKey: ["pilotOps", "patientMessages", patientId, limit],
    queryFn: async () => {
      if (!patientId) {
        throw new Error("patientId is required");
      }

      if (USE_PILOT_MOCK) {
        return createMockPatientMessages(patientId);
      }

      const response = await apiClient.get<PilotPatientMessagesEnvelope>(
        `/admin/pilot/whatsapp/patients/${patientId}/messages?limit=${limit}`
      );
      return response.data.data;
    },
    enabled: Boolean(patientId),
    refetchInterval: 30000,
  });
}

export function usePilotRuntimeStatus(baseUrl?: string) {
  return useQuery<PilotRuntimeStatus>({
    queryKey: ["pilotOps", "runtimeStatus", baseUrl || ""],
    queryFn: async () => {
      if (USE_PILOT_MOCK) {
        return createMockRuntimeStatus(baseUrl);
      }

      const query = baseUrl ? `?baseUrl=${encodeURIComponent(baseUrl)}` : "";
      const response = await apiClient.get<PilotRuntimeStatusEnvelope>(
        `/admin/pilot/runtime/status${query}`
      );
      return response.data.data;
    },
    refetchInterval: 30000,
  });
}

export function usePilotPatients(limit = 120, search = "") {
  return useQuery<PilotPatientsData>({
    queryKey: ["pilotOps", "patients", limit, search],
    queryFn: async () => {
      if (USE_PILOT_MOCK) {
        return {
          generatedAt: new Date().toISOString(),
          patients: createMockConversations(24).conversations.map((conversation) => ({
            id: conversation.patientId,
            name: conversation.patientName,
            whatsappPhone: conversation.whatsappPhone,
            whatsappOptedIn: true,
            connectedDevices:
              (conversation.appleWatchLastSyncAt ? 1 : 0) + (conversation.androidLastSyncAt ? 1 : 0),
            appleConnectedDevices: conversation.appleWatchLastSyncAt ? 1 : 0,
            androidConnectedDevices: conversation.androidLastSyncAt ? 1 : 0,
            devices: [
              ...(conversation.appleWatchLastSyncAt
                ? [
                    {
                      id: `${conversation.patientId}-apple`,
                      deviceType: "apple_watch" as const,
                      deviceName: "Apple Watch",
                      deviceModel: "Series 9",
                      serialNumber: "APPLE-DEMO-1",
                      isConnected: true,
                      connectionStatus: "connected",
                      batteryLevel: 71,
                      lastSyncAt: conversation.appleWatchLastSyncAt,
                      updatedAt: conversation.appleWatchLastSyncAt,
                    },
                  ]
                : []),
              ...(conversation.androidLastSyncAt
                ? [
                    {
                      id: `${conversation.patientId}-android`,
                      deviceType: "health_connect" as const,
                      deviceName: "Android Phone",
                      deviceModel: "Pixel",
                      serialNumber: "ANDROID-DEMO-1",
                      isConnected: true,
                      connectionStatus: "connected",
                      batteryLevel: 62,
                      lastSyncAt: conversation.androidLastSyncAt,
                      updatedAt: conversation.androidLastSyncAt,
                    },
                  ]
                : []),
            ],
          })),
        };
      }

      const query = new URLSearchParams();
      query.set("limit", String(limit));
      if (search.trim()) {
        query.set("search", search.trim());
      }

      const response = await apiClient.get<PilotPatientsEnvelope>(
        `/admin/pilot/patients?${query.toString()}`
      );
      return response.data.data;
    },
    refetchInterval: 30000,
  });
}

export function usePilotConnectDevice() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (args: {
      patientId: string;
      deviceType: "apple_watch" | "wear_os" | "health_connect" | "samsung";
      serialNumber: string;
      deviceName?: string;
      deviceModel?: string;
      batteryLevel?: number;
    }) => {
      if (USE_PILOT_MOCK) {
        return {
          id: `mock-device-${Date.now()}`,
          deviceType: args.deviceType,
          deviceName: args.deviceName || null,
          deviceModel: args.deviceModel || null,
          serialNumber: args.serialNumber,
          isConnected: true,
          connectionStatus: "connected",
          batteryLevel: args.batteryLevel ?? null,
          lastSyncAt: new Date().toISOString(),
        };
      }

      const response = await apiClient.post<PilotDeviceMutationEnvelope>(
        `/admin/pilot/patients/${args.patientId}/devices`,
        args
      );
      return response.data.data.device;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pilotOps", "patients"] });
      queryClient.invalidateQueries({ queryKey: ["pilotOps", "conversations"] });
      queryClient.invalidateQueries({ queryKey: ["pilotOps", "overview"] });
    },
  });
}

export function usePilotUpdatePatientContact() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (args: {
      patientId: string;
      whatsappPhone: string | null;
      whatsappOptedIn: boolean;
    }) => {
      if (USE_PILOT_MOCK) {
        return {
          id: args.patientId,
          whatsappPhone: args.whatsappPhone,
          whatsappOptedIn: args.whatsappOptedIn,
        };
      }

      const response = await apiClient.patch<PilotPatientContactMutationEnvelope>(
        `/admin/pilot/patients/${args.patientId}/whatsapp`,
        {
          whatsappPhone: args.whatsappPhone,
          whatsappOptedIn: args.whatsappOptedIn,
        }
      );
      return response.data.data.patient;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pilotOps", "patients"] });
      queryClient.invalidateQueries({ queryKey: ["pilotOps", "conversations"] });
      queryClient.invalidateQueries({ queryKey: ["pilotOps", "overview"] });
      queryClient.invalidateQueries({ queryKey: ["pilotOps", "patientMessages"] });
    },
  });
}

export function usePilotDisconnectDevice() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (deviceId: string) => {
      if (USE_PILOT_MOCK) {
        return { id: deviceId };
      }

      const response = await apiClient.patch<PilotDeviceMutationEnvelope>(
        `/admin/pilot/devices/${deviceId}/disconnect`
      );
      return response.data.data.device;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pilotOps", "patients"] });
      queryClient.invalidateQueries({ queryKey: ["pilotOps", "conversations"] });
      queryClient.invalidateQueries({ queryKey: ["pilotOps", "overview"] });
    },
  });
}

export function usePilotMarkDeviceSync() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (args: { deviceId: string; batteryLevel?: number }) => {
      if (USE_PILOT_MOCK) {
        return { id: args.deviceId, lastSyncAt: new Date().toISOString() };
      }

      const response = await apiClient.patch<PilotDeviceMutationEnvelope>(
        `/admin/pilot/devices/${args.deviceId}/sync`,
        {
          batteryLevel: args.batteryLevel,
        }
      );
      return response.data.data.device;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pilotOps", "patients"] });
      queryClient.invalidateQueries({ queryKey: ["pilotOps", "conversations"] });
      queryClient.invalidateQueries({ queryKey: ["pilotOps", "overview"] });
    },
  });
}

export function usePilotStartFollowUp() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (patientId: string) => {
      if (USE_PILOT_MOCK) {
        return { patientId, started: true };
      }

      const response = await apiClient.post<PilotFollowUpEnvelope>(
        `/admin/pilot/whatsapp/follow-up/${patientId}`
      );
      return response.data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pilotOps", "conversations"] });
      queryClient.invalidateQueries({ queryKey: ["pilotOps", "overview"] });
      queryClient.invalidateQueries({ queryKey: ["pilotOps", "patientMessages"] });
    },
  });
}

export function usePilotStartFollowUpBatch() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (limit: number) => {
      if (USE_PILOT_MOCK) {
        return { requested: limit, started: Math.max(1, Math.min(2, limit)), skipped: 0, items: [] };
      }

      const response = await apiClient.post<PilotFollowUpBatchEnvelope>(
        "/admin/pilot/whatsapp/follow-up-batch",
        { limit }
      );
      return response.data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pilotOps", "conversations"] });
      queryClient.invalidateQueries({ queryKey: ["pilotOps", "overview"] });
    },
  });
}
