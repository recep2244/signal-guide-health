import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/services/api/client";
import type {
  PilotOverview,
  PilotConversationsData,
  PilotPatientMessagesData,
  PilotPatientsData,
} from "@/hooks/usePilotOps";

interface PilotOverviewEnvelope {
  status: string;
  data: PilotOverview;
}

interface PilotConversationsEnvelope {
  status: string;
  data: PilotConversationsData;
}

interface PilotPatientMessagesEnvelope {
  status: string;
  data: PilotPatientMessagesData;
}

interface PilotPatientsEnvelope {
  status: string;
  data: PilotPatientsData;
}

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
      connectedAppleWatches: 2,
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

export function useDoctorOverview(hours = 24) {
  return useQuery<PilotOverview>({
    queryKey: ["doctorOps", "overview", hours],
    queryFn: async () => {
      if (USE_PILOT_MOCK) {
        return createMockOverview(hours);
      }

      const response = await apiClient.get<PilotOverviewEnvelope>(
        `/clinical/pilot/overview?hours=${hours}`
      );
      return response.data.data;
    },
    refetchInterval: 30000,
  });
}

export function useDoctorConversations(hours = 24 * 7, limit = 25) {
  return useQuery<PilotConversationsData>({
    queryKey: ["doctorOps", "conversations", hours, limit],
    queryFn: async () => {
      if (USE_PILOT_MOCK) {
        return createMockConversations(hours);
      }

      const response = await apiClient.get<PilotConversationsEnvelope>(
        `/clinical/pilot/whatsapp/conversations?hours=${hours}&limit=${limit}`
      );
      return response.data.data;
    },
    refetchInterval: 30000,
  });
}

export function useDoctorPatients(limit = 120, search = "") {
  return useQuery<PilotPatientsData>({
    queryKey: ["doctorOps", "patients", limit, search],
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
              (conversation.appleWatchLastSyncAt ? 1 : 0) +
              (conversation.androidLastSyncAt ? 1 : 0),
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
        `/clinical/pilot/patients?${query.toString()}`
      );
      return response.data.data;
    },
    refetchInterval: 30000,
  });
}

export function useDoctorPatientMessages(patientId?: string, limit = 100) {
  return useQuery<PilotPatientMessagesData>({
    queryKey: ["doctorOps", "patientMessages", patientId, limit],
    queryFn: async () => {
      if (!patientId) {
        throw new Error("patientId is required");
      }

      if (USE_PILOT_MOCK) {
        return createMockPatientMessages(patientId);
      }

      const response = await apiClient.get<PilotPatientMessagesEnvelope>(
        `/clinical/pilot/whatsapp/patients/${patientId}/messages?limit=${limit}`
      );
      return response.data.data;
    },
    enabled: Boolean(patientId),
    refetchInterval: 30000,
  });
}
