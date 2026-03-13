import { useEffect, useMemo, useState, type ComponentType } from "react";
import { formatDistanceToNow } from "date-fns";
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  CheckCircle,
  Copy,
  HeartPulse,
  Link2,
  Loader2,
  MessageSquareText,
  RefreshCw,
  ShieldCheck,
  Smartphone,
  Target,
  UserCheck2,
  Watch,
  Wifi,
  XCircle,
} from "lucide-react";
import { PilotOpsHeader } from "@/pilot/components/PilotOpsHeader";
import { IntegrationKeysPanel } from "@/pilot/components/IntegrationKeysPanel";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  usePilotConversations,
  usePilotDisconnectDevice,
  usePilotMarkDeviceSync,
  usePilotOverview,
  usePilotPatients,
  usePilotPatientMessages,
  usePilotRuntimeStatus,
  usePilotStartFollowUp,
  usePilotStartFollowUpBatch,
  usePilotConnectDevice,
  usePilotUpdatePatientContact,
} from "@/hooks/usePilotOps";
import { useIntegrationKeyStatus } from "@/hooks/useIntegrationKeys";
import { toast } from "sonner";

const windowOptions = [
  { label: "24h", value: "24" },
  { label: "72h", value: "72" },
  { label: "7d", value: "168" },
];
const PILOT_TUNNEL_URL_STORAGE_KEY = "pilotOps.publicTunnelBaseUrl";

type StageCheck = {
  label: string;
  detail: string;
  passed: boolean;
};

type PilotStage = {
  id: string;
  title: string;
  description: string;
  progress: number;
  detail: string;
  nextAction: string;
  icon: ComponentType<{ className?: string }>;
  checks: StageCheck[];
};

const normalizePublicBaseUrl = (value: string): string | null => {
  const trimmed = value.trim();
  if (!trimmed) return null;

  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return null;
    }
    return parsed.origin;
  } catch {
    return null;
  }
};

export default function PilotOps() {
  const [windowHours, setWindowHours] = useState("24");
  const [selectedPatientId, setSelectedPatientId] = useState<string | null>(null);
  const [selectedRosterPatientId, setSelectedRosterPatientId] = useState<string | null>(null);
  const [tunnelUrlInput, setTunnelUrlInput] = useState("");
  const [savedTunnelBaseUrl, setSavedTunnelBaseUrl] = useState("");
  const [patientSearch, setPatientSearch] = useState("");
  const [batchLimit, setBatchLimit] = useState("25");
  const [newDeviceType, setNewDeviceType] = useState("apple_watch");
  const [newDeviceSerial, setNewDeviceSerial] = useState("");
  const [newDeviceName, setNewDeviceName] = useState("");
  const [newDeviceModel, setNewDeviceModel] = useState("");
  const [newDeviceBattery, setNewDeviceBattery] = useState("");
  const [whatsappContactInput, setWhatsappContactInput] = useState("");
  const [whatsappOptedInInput, setWhatsappOptedInInput] = useState(false);
  const hours = Number(windowHours);
  const { data, isLoading, isError, error, refetch, isFetching } = usePilotOverview(hours);
  const {
    data: runtimeStatus,
    isLoading: runtimeLoading,
    refetch: refetchRuntimeStatus,
    isFetching: runtimeFetching,
  } = usePilotRuntimeStatus(savedTunnelBaseUrl || undefined);
  const {
    data: conversationsData,
    isLoading: conversationsLoading,
    refetch: refetchConversations,
    isFetching: conversationsFetching,
  } = usePilotConversations(hours, 25);
  const {
    data: rosterData,
    isLoading: rosterLoading,
    refetch: refetchRoster,
    isFetching: rosterFetching,
  } = usePilotPatients(150, patientSearch);
  const {
    data: patientMessagesData,
    isLoading: patientMessagesLoading,
    refetch: refetchPatientMessages,
    isFetching: patientMessagesFetching,
  } = usePilotPatientMessages(selectedPatientId || undefined, 100);
  const { data: integrationKeysData } = useIntegrationKeyStatus();
  const connectDeviceMutation = usePilotConnectDevice();
  const disconnectDeviceMutation = usePilotDisconnectDevice();
  const markSyncMutation = usePilotMarkDeviceSync();
  const startFollowUpMutation = usePilotStartFollowUp();
  const startFollowUpBatchMutation = usePilotStartFollowUpBatch();
  const updateContactMutation = usePilotUpdatePatientContact();

  const conversations = useMemo(
    () => conversationsData?.conversations || [],
    [conversationsData]
  );
  const rosterPatients = useMemo(
    () => rosterData?.patients || [],
    [rosterData]
  );
  const selectedRosterPatient = useMemo(
    () =>
      selectedRosterPatientId
        ? rosterPatients.find((patient) => patient.id === selectedRosterPatientId) || null
        : null,
    [rosterPatients, selectedRosterPatientId]
  );

  useEffect(() => {
    if (conversations.length === 0) {
      setSelectedPatientId(null);
      return;
    }

    const selectedExists = selectedPatientId
      ? conversations.some((conversation) => conversation.patientId === selectedPatientId)
      : false;
    if (!selectedExists) {
      setSelectedPatientId(conversations[0].patientId);
    }
  }, [conversations, selectedPatientId]);

  useEffect(() => {
    if (rosterPatients.length === 0) {
      setSelectedRosterPatientId(null);
      return;
    }

    const selectedExists = selectedRosterPatientId
      ? rosterPatients.some((patient) => patient.id === selectedRosterPatientId)
      : false;
    if (!selectedExists) {
      setSelectedRosterPatientId(rosterPatients[0].id);
    }
  }, [rosterPatients, selectedRosterPatientId]);

  useEffect(() => {
    if (!selectedRosterPatientId) return;
    setSelectedPatientId((current) => (current === selectedRosterPatientId ? current : selectedRosterPatientId));
  }, [selectedRosterPatientId]);

  useEffect(() => {
    if (!selectedRosterPatient) {
      setWhatsappContactInput("");
      setWhatsappOptedInInput(false);
      return;
    }

    setWhatsappContactInput(selectedRosterPatient.whatsappPhone || "");
    setWhatsappOptedInInput(Boolean(selectedRosterPatient.whatsappOptedIn));
  }, [selectedRosterPatient]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const stored = window.localStorage.getItem(PILOT_TUNNEL_URL_STORAGE_KEY) || "";
    setSavedTunnelBaseUrl(stored);
    setTunnelUrlInput(stored);
  }, []);

  const saveTunnelBaseUrl = () => {
    const normalized = normalizePublicBaseUrl(tunnelUrlInput);
    if (!normalized) {
      toast.error("Enter a valid tunnel URL", {
        description: "Use an http/https public URL such as trycloudflare.com",
      });
      return;
    }

    if (typeof window !== "undefined") {
      window.localStorage.setItem(PILOT_TUNNEL_URL_STORAGE_KEY, normalized);
    }
    setSavedTunnelBaseUrl(normalized);
    setTunnelUrlInput(normalized);
    toast.success("Tunnel URL saved");
    void refetchRuntimeStatus();
  };

  const clearTunnelBaseUrl = () => {
    if (typeof window !== "undefined") {
      window.localStorage.removeItem(PILOT_TUNNEL_URL_STORAGE_KEY);
    }
    setSavedTunnelBaseUrl("");
    setTunnelUrlInput("");
    toast.success("Tunnel URL cleared");
    void refetchRuntimeStatus();
  };

  const copyText = async (value: string, label: string) => {
    try {
      if (typeof navigator === "undefined" || !navigator.clipboard) {
        throw new Error("Clipboard API unavailable");
      }
      await navigator.clipboard.writeText(value);
      toast.success(`${label} copied`);
    } catch {
      toast.error(`Failed to copy ${label.toLowerCase()}`);
    }
  };

  const handleConnectDevice = async () => {
    if (!selectedRosterPatientId) {
      toast.error("Select a patient first");
      return;
    }
    if (newDeviceSerial.trim().length < 3) {
      toast.error("Enter a valid device serial/identifier");
      return;
    }

    const batteryValue = newDeviceBattery.trim() ? Number(newDeviceBattery) : undefined;
    if (batteryValue !== undefined && (!Number.isFinite(batteryValue) || batteryValue < 0 || batteryValue > 100)) {
      toast.error("Battery must be between 0 and 100");
      return;
    }

    try {
      await connectDeviceMutation.mutateAsync({
        patientId: selectedRosterPatientId,
        deviceType: newDeviceType as "apple_watch" | "wear_os" | "health_connect" | "samsung",
        serialNumber: newDeviceSerial.trim(),
        deviceName: newDeviceName.trim() || undefined,
        deviceModel: newDeviceModel.trim() || undefined,
        batteryLevel: batteryValue,
      });
      setNewDeviceSerial("");
      setNewDeviceName("");
      setNewDeviceModel("");
      setNewDeviceBattery("");
      toast.success("Device connected");
      void Promise.all([refetchRoster(), refetchConversations(), refetch()]);
    } catch (connectError) {
      toast.error("Failed to connect device", {
        description: connectError instanceof Error ? connectError.message : "Unknown error",
      });
    }
  };

  const handleDisconnectDevice = async (deviceId: string) => {
    try {
      await disconnectDeviceMutation.mutateAsync(deviceId);
      toast.success("Device disconnected");
      void Promise.all([refetchRoster(), refetchConversations(), refetch()]);
    } catch (disconnectError) {
      toast.error("Failed to disconnect device", {
        description: disconnectError instanceof Error ? disconnectError.message : "Unknown error",
      });
    }
  };

  const handleMarkDeviceSync = async (deviceId: string) => {
    try {
      await markSyncMutation.mutateAsync({ deviceId });
      toast.success("Device sync timestamp updated");
      void Promise.all([refetchRoster(), refetchConversations(), refetch()]);
    } catch (syncError) {
      toast.error("Failed to mark sync", {
        description: syncError instanceof Error ? syncError.message : "Unknown error",
      });
    }
  };

  const handleStartFollowUpForPatient = async () => {
    if (!selectedRosterPatientId) {
      toast.error("Select a patient first");
      return;
    }

    try {
      const result = await startFollowUpMutation.mutateAsync(selectedRosterPatientId);
      if (result.started) {
        toast.success("WhatsApp follow-up started");
      } else {
        toast.error("Follow-up not started", { description: result.reason || "No reason provided" });
      }
      void Promise.all([refetch(), refetchConversations(), refetchPatientMessages()]);
    } catch (followUpError) {
      toast.error("Failed to start follow-up", {
        description: followUpError instanceof Error ? followUpError.message : "Unknown error",
      });
    }
  };

  const handleStartFollowUpBatch = async () => {
    const parsedLimit = Number(batchLimit);
    if (!Number.isFinite(parsedLimit) || parsedLimit < 1 || parsedLimit > 100) {
      toast.error("Batch limit must be between 1 and 100");
      return;
    }

    try {
      const result = await startFollowUpBatchMutation.mutateAsync(parsedLimit);
      toast.success("Batch follow-up executed", {
        description: `${result.started}/${result.requested} started`,
      });
      void Promise.all([refetch(), refetchConversations(), refetchPatientMessages()]);
    } catch (batchError) {
      toast.error("Failed to start batch follow-up", {
        description: batchError instanceof Error ? batchError.message : "Unknown error",
      });
    }
  };

  const handleSaveWhatsappContact = async () => {
    if (!selectedRosterPatientId) {
      toast.error("Select a patient first");
      return;
    }

    const normalizedPhone = whatsappContactInput.trim();
    const phoneValue = normalizedPhone === "" ? null : normalizedPhone;
    if (phoneValue && !/^\+[1-9]\d{6,14}$/.test(phoneValue)) {
      toast.error("WhatsApp phone must use E.164 format", {
        description: "Example: +14155552671",
      });
      return;
    }

    if (whatsappOptedInInput && !phoneValue) {
      toast.error("Phone is required when WhatsApp opt-in is enabled");
      return;
    }

    try {
      await updateContactMutation.mutateAsync({
        patientId: selectedRosterPatientId,
        whatsappPhone: phoneValue,
        whatsappOptedIn: whatsappOptedInInput,
      });
      toast.success("WhatsApp contact updated");
      void Promise.all([refetchRoster(), refetchConversations(), refetch(), refetchPatientMessages()]);
    } catch (contactError) {
      toast.error("Failed to update WhatsApp contact", {
        description: contactError instanceof Error ? contactError.message : "Unknown error",
      });
    }
  };

  const deliveryRate = useMemo(() => {
    if (!data) return 0;
    const deliveredLike =
      data.whatsapp.deliveryStatus.delivered + data.whatsapp.deliveryStatus.read;
    const outbound = data.whatsapp.messagesOutbound || 1;
    return Math.round((deliveredLike / outbound) * 100);
  }, [data]);

  const runtimeWebhookBaseUrl = runtimeStatus?.tunnel?.baseUrl || savedTunnelBaseUrl;

  const runtimeEndpoints = useMemo(() => {
    if (!runtimeStatus || !runtimeWebhookBaseUrl) {
      return [];
    }

    return [
      {
        key: "whatsapp",
        label: "WhatsApp",
        url: `${runtimeWebhookBaseUrl}${runtimeStatus.webhookPaths.whatsapp}`,
        check: runtimeStatus.tunnel?.checks.whatsapp || null,
      },
      {
        key: "apple",
        label: "Apple Health",
        url: `${runtimeWebhookBaseUrl}${runtimeStatus.webhookPaths.apple}`,
        check: runtimeStatus.tunnel?.checks.apple || null,
      },
      {
        key: "android",
        label: "Android Health",
        url: `${runtimeWebhookBaseUrl}${runtimeStatus.webhookPaths.android}`,
        check: runtimeStatus.tunnel?.checks.android || null,
      },
      {
        key: "health",
        label: "Tunnel Health",
        url: `${runtimeWebhookBaseUrl}/health`,
        check: runtimeStatus.tunnel?.checks.health || null,
      },
    ];
  }, [runtimeStatus, runtimeWebhookBaseUrl]);

  const pilotStages = useMemo<PilotStage[]>(() => {
    if (!data) {
      return [];
    }

    const providerStatuses = integrationKeysData?.providers || [];
    const providerCount = providerStatuses.length || 3;
    const providerById = new Map(providerStatuses.map((provider) => [provider.provider, provider]));
    const whatsappProvider = providerById.get("whatsapp");
    const appleProvider = providerById.get("apple");
    const androidProvider = providerById.get("android");

    const configuredProviders = providerStatuses.filter(
      (provider) => provider.requiredConfiguredCount >= provider.requiredTotal
    ).length;
    const stage1Progress = Math.round((configuredProviders / providerCount) * 100);
    const stage1Checks: StageCheck[] = [
      {
        label: "WhatsApp keys and phone setup",
        detail: whatsappProvider
          ? `${whatsappProvider.requiredConfiguredCount}/${whatsappProvider.requiredTotal} required keys`
          : "Awaiting provider status",
        passed: Boolean(
          whatsappProvider &&
            whatsappProvider.requiredConfiguredCount >= whatsappProvider.requiredTotal &&
            whatsappProvider.isValid
        ),
      },
      {
        label: "Apple API/webhook key set",
        detail: appleProvider
          ? `${appleProvider.requiredConfiguredCount}/${appleProvider.requiredTotal} required keys`
          : "Awaiting provider status",
        passed: Boolean(
          appleProvider &&
            appleProvider.requiredConfiguredCount >= appleProvider.requiredTotal &&
            appleProvider.isValid
        ),
      },
      {
        label: "Android API/OAuth key set",
        detail: androidProvider
          ? `${androidProvider.requiredConfiguredCount}/${androidProvider.requiredTotal} required keys`
          : "Awaiting provider status",
        passed: Boolean(
          androidProvider &&
            androidProvider.requiredConfiguredCount >= androidProvider.requiredTotal &&
            androidProvider.isValid
        ),
      },
    ];

    const mappedPatients = new Set(
      conversations
        .filter((conversation) => conversation.whatsappPhone)
        .map((conversation) => conversation.patientId)
    ).size;
    const wearableMatchedPatients = new Set(
      conversations
        .filter((conversation) => conversation.appleWatchLastSyncAt || conversation.androidLastSyncAt)
        .map((conversation) => conversation.patientId)
    ).size;
    const cohortSize = data.whatsapp.optedInPatients;
    const whatsappMatchCoverage =
      cohortSize > 0 ? Math.min(1, mappedPatients / cohortSize) : 0;
    const deviceMatchCoverage =
      cohortSize > 0 ? Math.min(1, wearableMatchedPatients / cohortSize) : 0;
    const stage2Progress = Math.round(((whatsappMatchCoverage + deviceMatchCoverage) / 2) * 100);
    const stage2Checks: StageCheck[] = [
      {
        label: "WhatsApp contact mapped",
        detail: `${mappedPatients}/${cohortSize} opted-in patients`,
        passed: cohortSize > 0 && whatsappMatchCoverage >= 0.8,
      },
      {
        label: "Device identity matched",
        detail: `${wearableMatchedPatients}/${cohortSize} with Apple/Android sync`,
        passed: cohortSize > 0 && deviceMatchCoverage >= 0.7,
      },
      {
        label: "Active outreach running",
        detail: `${data.whatsapp.conversationsActive} active conversations`,
        passed: data.whatsapp.conversationsActive > 0,
      },
    ];

    const flowStarted = data.whatsapp.flowSteps.wellbeing;
    const symptomsRatio =
      flowStarted > 0 ? Math.min(1, data.whatsapp.flowSteps.symptoms / flowStarted) : 0;
    const medsRatio =
      flowStarted > 0 ? Math.min(1, data.whatsapp.flowSteps.medications / flowStarted) : 0;
    const flowCompleted = data.whatsapp.flowSteps.completed;
    const completedRatio = flowStarted > 0 ? Math.min(1, flowCompleted / flowStarted) : 0;
    const stage3Progress = Math.round(((symptomsRatio + medsRatio + completedRatio) / 3) * 100);
    const stage3Checks: StageCheck[] = [
      {
        label: "Wellbeing step started",
        detail: `${flowStarted} conversations started`,
        passed: flowStarted > 0,
      },
      {
        label: "Symptoms + medication captured",
        detail: `${data.whatsapp.flowSteps.symptoms} symptoms, ${data.whatsapp.flowSteps.medications} medication responses`,
        passed: flowStarted > 0 && symptomsRatio >= 0.7 && medsRatio >= 0.7,
      },
      {
        label: "Flow completion rate",
        detail: `${flowCompleted}/${flowStarted} complete`,
        passed: flowStarted > 0 && completedRatio >= 0.6,
      },
    ];

    const appleCoverage = data.appleWatch.connectedAppleWatches
      ? Math.min(1, data.appleWatch.syncedInWindow / data.appleWatch.connectedAppleWatches)
      : 0;
    const androidSynced = conversations.filter((conversation) => conversation.androidLastSyncAt).length;
    const androidCoverage = conversations.length ? Math.min(1, androidSynced / conversations.length) : 0;
    const lagHours = data.appleWatch.averageSyncLagHours ?? Number.POSITIVE_INFINITY;
    const lagScore = lagHours <= 3 ? 1 : lagHours <= 6 ? 0.7 : lagHours <= 12 ? 0.4 : 0;
    const stage4Progress = Math.round(((appleCoverage + androidCoverage + lagScore) / 3) * 100);
    const stage4Checks: StageCheck[] = [
      {
        label: "Apple Watch recent sync",
        detail: `${data.appleWatch.syncedInWindow}/${data.appleWatch.connectedAppleWatches} devices`,
        passed: data.appleWatch.connectedAppleWatches > 0 && appleCoverage >= 0.75,
      },
      {
        label: "Android recent sync",
        detail: `${androidSynced}/${conversations.length || 0} patient threads`,
        passed: conversations.length > 0 && androidCoverage >= 0.6,
      },
      {
        label: "Sync lag within target",
        detail:
          data.appleWatch.averageSyncLagHours === null
            ? "No lag telemetry yet"
            : `${data.appleWatch.averageSyncLagHours}h average lag`,
        passed: data.appleWatch.averageSyncLagHours !== null && data.appleWatch.averageSyncLagHours <= 6,
      },
    ];

    const outbound = data.whatsapp.messagesOutbound;
    const failed = data.whatsapp.deliveryStatus.failed;
    const unknown = data.whatsapp.deliveryStatus.unknown;
    const failureRate = outbound > 0 ? failed / outbound : 0;
    const providerSecurityReady = providerStatuses.every((provider) => provider.isValid);
    const stage5Checks: StageCheck[] = [
      {
        label: "Provider validation clean",
        detail: `${providerStatuses.filter((provider) => provider.isValid).length}/${providerCount} providers valid`,
        passed: providerStatuses.length > 0 && providerSecurityReady,
      },
      {
        label: "Delivery failure threshold",
        detail: `${Math.round(failureRate * 100)}% failed`,
        passed: failureRate <= 0.05,
      },
      {
        label: "Unknown WhatsApp status",
        detail: `${unknown} messages with unknown status`,
        passed: unknown === 0,
      },
    ];
    const stage5Progress = Math.round(
      (stage5Checks.filter((check) => check.passed).length / stage5Checks.length) * 100
    );

    return [
      {
        id: "stage-1",
        title: "Stage 1 - Integration Setup",
        description: "Configure provider keys, webhook credentials, and WhatsApp phone identity",
        progress: stage1Progress,
        detail: `${configuredProviders}/${providerCount} providers ready`,
        nextAction: "Use Admin > Integrations to complete missing required keys and run provider validation.",
        icon: ShieldCheck,
        checks: stage1Checks,
      },
      {
        id: "stage-2",
        title: "Stage 2 - Cohort Enrollment",
        description: "Match pilot patients to WhatsApp contacts and wearable device identities",
        progress: stage2Progress,
        detail: `${mappedPatients}/${cohortSize} WhatsApp contacts mapped`,
        nextAction: "Resolve patients with no WhatsApp number or no wearable sync before full launch.",
        icon: UserCheck2,
        checks: stage2Checks,
      },
      {
        id: "stage-3",
        title: "Stage 3 - Follow-up Execution",
        description: "Run WhatsApp follow-up flow from wellbeing to symptom and medication completion",
        progress: stage3Progress,
        detail: `${flowCompleted}/${flowStarted} completed flow loops`,
        nextAction: "Tune prompt sequence for patients dropping off before symptom/medication steps.",
        icon: MessageSquareText,
        checks: stage3Checks,
      },
      {
        id: "stage-4",
        title: "Stage 4 - Device Sync Coverage",
        description: "Track Apple Watch and Android reliability with low sync lag",
        progress: stage4Progress,
        detail: `${data.appleWatch.syncedInWindow}/${data.appleWatch.connectedAppleWatches} Apple sync in window`,
        nextAction: "Follow up on devices with stale sync timestamps and low battery.",
        icon: Watch,
        checks: stage4Checks,
      },
      {
        id: "stage-5",
        title: "Stage 5 - Security Controls",
        description: "Enforce delivery health and provider-validation guardrails",
        progress: stage5Progress,
        detail: `${Math.round(failureRate * 100)}% failure rate, ${unknown} unknown status`,
        nextAction: "Investigate failed/unknown deliveries and rotate credentials when validation degrades.",
        icon: Target,
        checks: stage5Checks,
      },
    ];
  }, [conversations, data, integrationKeysData?.providers]);

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white">
      <PilotOpsHeader />

      <main className="container mx-auto px-4 lg:px-8 py-8 space-y-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Pilot Operations</h1>
            <p className="text-sm text-slate-500">
              Real tracking for WhatsApp follow-up and Apple Watch sync
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Select value={windowHours} onValueChange={setWindowHours}>
              <SelectTrigger className="w-28 border-slate-200">
                <SelectValue placeholder="Window" />
              </SelectTrigger>
              <SelectContent>
                {windowOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              variant="outline"
              className="border-slate-200"
              onClick={() => {
                void Promise.all([
                  refetch(),
                  refetchRuntimeStatus(),
                  refetchRoster(),
                  refetchConversations(),
                  refetchPatientMessages(),
                ]);
              }}
              disabled={
                isFetching ||
                runtimeFetching ||
                rosterFetching ||
                conversationsFetching ||
                patientMessagesFetching
              }
            >
              {isFetching || runtimeFetching || rosterFetching || conversationsFetching || patientMessagesFetching ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="mr-2 h-4 w-4" />
              )}
              Refresh
            </Button>
          </div>
        </div>

        {isLoading && (
          <Card>
            <CardContent className="py-10 text-center text-slate-600">
              <Loader2 className="h-5 w-5 animate-spin mx-auto mb-2" />
              Loading pilot metrics...
            </CardContent>
          </Card>
        )}

        {isError && (
          <Card className="border-red-200">
            <CardContent className="py-8 text-center">
              <p className="text-sm text-red-700">
                {error instanceof Error ? error.message : "Failed to load pilot overview"}
              </p>
            </CardContent>
          </Card>
        )}

        {data && (
          <>
            <div className="grid gap-4 lg:grid-cols-2">
              <Card className="border-slate-200">
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <MessageSquareText className="h-4 w-4 text-slate-700" />
                    WhatsApp Follow-up Control
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <p className="text-xs text-slate-500">
                    Trigger single-patient or batch WhatsApp follow-ups directly from the pilot UI.
                  </p>
                  <div className="rounded-lg border border-slate-200 p-3 space-y-2">
                    <p className="text-xs font-medium text-slate-700">Contact Mapping</p>
                    <Input
                      value={whatsappContactInput}
                      onChange={(event) => setWhatsappContactInput(event.target.value)}
                      placeholder="+14155552671"
                      className="border-slate-200"
                    />
                    <div className="flex items-center justify-between rounded-md border border-slate-200 px-2.5 py-2">
                      <div>
                        <p className="text-xs font-medium text-slate-700">WhatsApp opt-in</p>
                        <p className="text-[11px] text-slate-500">Enable outreach for this patient</p>
                      </div>
                      <Switch
                        checked={whatsappOptedInInput}
                        onCheckedChange={setWhatsappOptedInInput}
                        disabled={!selectedRosterPatientId}
                      />
                    </div>
                    <Button
                      variant="outline"
                      className="border-slate-200"
                      onClick={handleSaveWhatsappContact}
                      disabled={updateContactMutation.isPending || !selectedRosterPatientId}
                    >
                      {updateContactMutation.isPending ? (
                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      ) : (
                        <CheckCircle className="h-4 w-4 mr-2" />
                      )}
                      Save Contact
                    </Button>
                  </div>
                  <div className="rounded-lg border border-slate-200 p-3">
                    <p className="text-xs text-slate-500">Selected patient</p>
                    <p className="text-sm font-medium text-slate-900 mt-0.5">
                      {selectedRosterPatient?.name || "No patient selected"}
                    </p>
                    <p className="text-xs text-slate-500">
                      {selectedRosterPatient?.whatsappPhone || "No WhatsApp number"}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Button
                      className="bg-teal-600 hover:bg-teal-700 text-white"
                      onClick={handleStartFollowUpForPatient}
                      disabled={startFollowUpMutation.isPending || !selectedRosterPatientId}
                    >
                      {startFollowUpMutation.isPending ? (
                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      ) : (
                        <MessageSquareText className="h-4 w-4 mr-2" />
                      )}
                      Start Selected Follow-up
                    </Button>
                    <div className="flex items-center gap-2">
                      <Input
                        value={batchLimit}
                        onChange={(event) => setBatchLimit(event.target.value)}
                        className="w-24 border-slate-200"
                        inputMode="numeric"
                        placeholder="25"
                      />
                      <Button
                        variant="outline"
                        className="border-slate-200"
                        onClick={handleStartFollowUpBatch}
                        disabled={startFollowUpBatchMutation.isPending}
                      >
                        {startFollowUpBatchMutation.isPending ? (
                          <Loader2 className="h-4 w-4 animate-spin mr-2" />
                        ) : (
                          <Activity className="h-4 w-4 mr-2" />
                        )}
                        Start Batch
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-slate-200">
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <Smartphone className="h-4 w-4 text-slate-700" />
                    Device Connection Control
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex items-center gap-2">
                    <Input
                      value={patientSearch}
                      onChange={(event) => setPatientSearch(event.target.value)}
                      placeholder="Search patient or phone"
                      className="border-slate-200"
                    />
                    <Button
                      variant="outline"
                      className="border-slate-200"
                      onClick={() => {
                        void refetchRoster();
                      }}
                      disabled={rosterFetching}
                    >
                      {rosterFetching ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <RefreshCw className="h-4 w-4" />
                      )}
                    </Button>
                  </div>

                  <div className="max-h-44 overflow-y-auto rounded-lg border border-slate-200 divide-y divide-slate-100">
                    {rosterLoading ? (
                      <div className="px-3 py-6 text-center text-xs text-slate-500">
                        Loading patients...
                      </div>
                    ) : rosterPatients.length === 0 ? (
                      <div className="px-3 py-6 text-center text-xs text-slate-500">
                        No pilot patients found.
                      </div>
                    ) : (
                      rosterPatients.map((patient) => (
                        <button
                          key={patient.id}
                          type="button"
                          onClick={() => setSelectedRosterPatientId(patient.id)}
                          className={`w-full text-left px-3 py-2.5 ${
                            selectedRosterPatientId === patient.id ? "bg-indigo-50" : "hover:bg-slate-50"
                          }`}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <p className="text-sm font-medium text-slate-900">{patient.name}</p>
                            <p className="text-xs text-slate-500">
                              A:{patient.appleConnectedDevices} | D:{patient.androidConnectedDevices}
                            </p>
                          </div>
                          <p className="text-xs text-slate-500">
                            {patient.whatsappPhone || "No WhatsApp number"}
                          </p>
                        </button>
                      ))
                    )}
                  </div>

                  <div className="grid gap-2 md:grid-cols-2">
                    <Select value={newDeviceType} onValueChange={setNewDeviceType}>
                      <SelectTrigger className="border-slate-200">
                        <SelectValue placeholder="Device type" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="apple_watch">Apple Watch</SelectItem>
                        <SelectItem value="health_connect">Android Health Connect</SelectItem>
                        <SelectItem value="wear_os">Wear OS</SelectItem>
                        <SelectItem value="samsung">Samsung Health</SelectItem>
                      </SelectContent>
                    </Select>
                    <Input
                      value={newDeviceSerial}
                      onChange={(event) => setNewDeviceSerial(event.target.value)}
                      placeholder="Device serial / phone device ID"
                      className="border-slate-200"
                    />
                    <Input
                      value={newDeviceName}
                      onChange={(event) => setNewDeviceName(event.target.value)}
                      placeholder="Device name (optional)"
                      className="border-slate-200"
                    />
                    <Input
                      value={newDeviceModel}
                      onChange={(event) => setNewDeviceModel(event.target.value)}
                      placeholder="Model (optional)"
                      className="border-slate-200"
                    />
                    <Input
                      value={newDeviceBattery}
                      onChange={(event) => setNewDeviceBattery(event.target.value)}
                      placeholder="Battery % (optional)"
                      className="border-slate-200"
                      inputMode="numeric"
                    />
                    <Button
                      className="bg-indigo-600 hover:bg-indigo-700 text-white"
                      onClick={handleConnectDevice}
                      disabled={connectDeviceMutation.isPending || !selectedRosterPatientId}
                    >
                      {connectDeviceMutation.isPending ? (
                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      ) : (
                        <Watch className="h-4 w-4 mr-2" />
                      )}
                      Connect Device
                    </Button>
                  </div>

                  <div className="rounded-lg border border-slate-200 divide-y divide-slate-100 max-h-48 overflow-y-auto">
                    {(selectedRosterPatient?.devices || []).map((device) => (
                      <div
                        key={device.id}
                        className="px-3 py-2.5 flex flex-col md:flex-row md:items-center md:justify-between gap-2"
                      >
                        <div>
                          <p className="text-sm font-medium text-slate-900">
                            {device.deviceName || device.deviceType}
                          </p>
                          <p className="text-xs text-slate-500">
                            {device.serialNumber || "No serial"} •{" "}
                            {device.lastSyncAt
                              ? formatDistanceToNow(new Date(device.lastSyncAt), { addSuffix: true })
                              : "no sync"}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge
                            className={
                              device.isConnected
                                ? "bg-green-50 text-green-700 border-green-200"
                                : "bg-slate-100 text-slate-700 border-slate-200"
                            }
                          >
                            {device.connectionStatus}
                          </Badge>
                          <Button
                            size="sm"
                            variant="outline"
                            className="border-slate-200"
                            onClick={() => {
                              void handleMarkDeviceSync(device.id);
                            }}
                            disabled={markSyncMutation.isPending}
                          >
                            Sync
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="border-red-200 text-red-700 hover:bg-red-50"
                            onClick={() => {
                              void handleDisconnectDevice(device.id);
                            }}
                            disabled={disconnectDeviceMutation.isPending}
                          >
                            Disconnect
                          </Button>
                        </div>
                      </div>
                    ))}
                    {selectedRosterPatient && selectedRosterPatient.devices.length === 0 && (
                      <div className="px-3 py-3 text-xs text-slate-500">
                        No devices mapped for this patient yet.
                      </div>
                    )}
                    {!selectedRosterPatient && (
                      <div className="px-3 py-3 text-xs text-slate-500">
                        Select a patient to view and control device mappings.
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>

            <IntegrationKeysPanel />

            <Card className="border-slate-200">
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Link2 className="h-4 w-4 text-slate-700" />
                  Runtime + Webhook Control
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                  <RuntimeStateBadge
                    label="Local API"
                    ready={runtimeStatus?.local.apiHealthy || false}
                    detail={
                      runtimeStatus
                        ? `port ${runtimeStatus.local.port} • ${runtimeStatus.local.nodeEnv}`
                        : "Loading runtime"
                    }
                  />
                  <RuntimeStateBadge
                    label="Database"
                    ready={runtimeStatus?.local.databaseReachable || false}
                    detail={
                      runtimeStatus
                        ? runtimeStatus.local.databaseReachable
                          ? "Connection OK"
                          : "Connection failed"
                        : "Loading runtime"
                    }
                  />
                  <RuntimeStateBadge
                    label="Providers Ready"
                    ready={Boolean(
                      runtimeStatus && runtimeStatus.providers.every((provider) => provider.ready)
                    )}
                    detail={
                      runtimeStatus
                        ? `${runtimeStatus.providers.filter((provider) => provider.ready).length}/${runtimeStatus.providers.length} providers`
                        : "Loading runtime"
                    }
                  />
                  <RuntimeStateBadge
                    label="Tunnel Reachable"
                    ready={runtimeStatus?.tunnel?.reachable || false}
                    detail={
                      runtimeStatus?.tunnel
                        ? runtimeStatus.tunnel.baseUrl
                        : "Save tunnel URL to enable checks"
                    }
                  />
                </div>

                <div className="grid gap-2 md:grid-cols-[1fr_auto_auto_auto]">
                  <Input
                    value={tunnelUrlInput}
                    onChange={(event) => setTunnelUrlInput(event.target.value)}
                    placeholder="https://your-domain.trycloudflare.com"
                    className="border-slate-200"
                  />
                  <Button variant="outline" onClick={saveTunnelBaseUrl} className="border-slate-200">
                    Save URL
                  </Button>
                  <Button
                    variant="outline"
                    className="border-slate-200"
                    onClick={() => {
                      void refetchRuntimeStatus();
                    }}
                    disabled={runtimeFetching}
                  >
                    {runtimeFetching ? (
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    ) : (
                      <RefreshCw className="h-4 w-4 mr-2" />
                    )}
                    Check Now
                  </Button>
                  <Button variant="ghost" onClick={clearTunnelBaseUrl} className="text-slate-600">
                    Clear
                  </Button>
                </div>

                <div className="grid gap-2">
                  {runtimeStatus?.providers.map((provider) => (
                    <RuntimeProviderRow
                      key={provider.provider}
                      label={provider.label}
                      ready={provider.ready}
                      detail={`${provider.requiredConfiguredCount}/${provider.requiredTotal} required keys`}
                      missingKeys={provider.missingRequiredKeys}
                    />
                  ))}
                  {!runtimeLoading && runtimeStatus?.providers.length === 0 && (
                    <p className="text-xs text-slate-500">No provider metadata available.</p>
                  )}
                </div>

                <div className="rounded-lg border border-slate-200 divide-y divide-slate-100">
                  {runtimeEndpoints.map((endpoint) => (
                    <div
                      key={endpoint.key}
                      className="flex flex-col md:flex-row md:items-center md:justify-between gap-2 px-3 py-2.5"
                    >
                      <div className="min-w-0">
                        <p className="text-xs font-medium text-slate-800">{endpoint.label}</p>
                        <p className="text-xs text-slate-500 truncate">{endpoint.url}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <RuntimeCheckBadge check={endpoint.check} />
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          className="border-slate-200"
                          onClick={() => {
                            void copyText(endpoint.url, `${endpoint.label} endpoint`);
                          }}
                        >
                          <Copy className="h-3.5 w-3.5 mr-1" />
                          Copy
                        </Button>
                      </div>
                    </div>
                  ))}
                  {runtimeEndpoints.length === 0 && (
                    <div className="px-3 py-3 text-xs text-slate-500">
                      Save a public tunnel URL to generate provider webhook endpoints.
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            <Card className="border-slate-200">
              <CardHeader>
                <CardTitle className="text-base">Pilot Stages</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-3 lg:grid-cols-2">
                {pilotStages.map((stage) => (
                  <div key={stage.id} className="rounded-xl border border-slate-200 p-4">
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <div className="flex items-center gap-2">
                        <stage.icon className="h-4 w-4 text-slate-700" />
                        <p className="text-sm font-semibold text-slate-900">{stage.title}</p>
                      </div>
                      <StageStatusBadge progress={stage.progress} />
                    </div>
                    <p className="text-xs text-slate-500 mb-3">{stage.description}</p>
                    <Progress value={stage.progress} className="h-2 mb-2" />
                    <div className="flex items-center justify-between text-xs text-slate-500">
                      <span>{stage.detail}</span>
                      <span>{stage.progress}%</span>
                    </div>
                    <div className="mt-3 pt-3 border-t border-slate-100 space-y-2">
                      {stage.checks.map((check) => (
                        <StageCheckRow
                          key={`${stage.id}-${check.label}`}
                          label={check.label}
                          detail={check.detail}
                          passed={check.passed}
                        />
                      ))}
                    </div>
                    <p className="text-xs text-slate-500 mt-3">{stage.nextAction}</p>
                  </div>
                ))}
              </CardContent>
            </Card>

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <MetricCard
                label="WhatsApp Completed"
                value={String(data.whatsapp.followUpsCompleted)}
                detail={`${data.whatsapp.conversationsActive} active conversations`}
                icon={MessageSquareText}
                color="text-teal-700 bg-teal-50 border-teal-100"
              />
              <MetricCard
                label="Delivery Rate"
                value={`${deliveryRate}%`}
                detail={`${data.whatsapp.deliveryStatus.failed} failed`}
                icon={CheckCircle2}
                color="text-blue-700 bg-blue-50 border-blue-100"
              />
              <MetricCard
                label="Apple Watch Sync"
                value={`${data.appleWatch.syncedInWindow}/${data.appleWatch.connectedAppleWatches}`}
                detail={`${data.appleWatch.averageSyncLagHours ?? "n/a"}h avg lag`}
                icon={Watch}
                color="text-indigo-700 bg-indigo-50 border-indigo-100"
              />
              <MetricCard
                label="Avg Wellbeing"
                value={
                  data.whatsapp.averageWellbeingScore === null
                    ? "n/a"
                    : `${data.whatsapp.averageWellbeingScore}/10`
                }
                detail={`Window: ${data.windowHours}h`}
                icon={HeartPulse}
                color="text-rose-700 bg-rose-50 border-rose-100"
              />
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
              <Card className="border-slate-200">
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4 text-amber-600" />
                    Triage Outcomes
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <TriageRow label="RED" value={data.whatsapp.triageBreakdown.red} className="bg-red-50 text-red-700 border-red-200" />
                  <TriageRow label="AMBER" value={data.whatsapp.triageBreakdown.amber} className="bg-amber-50 text-amber-700 border-amber-200" />
                  <TriageRow label="GREEN" value={data.whatsapp.triageBreakdown.green} className="bg-green-50 text-green-700 border-green-200" />
                  <TriageRow label="UNKNOWN" value={data.whatsapp.triageBreakdown.unknown} className="bg-slate-100 text-slate-700 border-slate-200" />
                </CardContent>
              </Card>

              <Card className="border-slate-200">
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <Wifi className="h-4 w-4 text-slate-700" />
                    Message Delivery
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <StatusRow label="Sent" value={data.whatsapp.deliveryStatus.sent} icon={MessageSquareText} />
                  <StatusRow label="Delivered" value={data.whatsapp.deliveryStatus.delivered} icon={CheckCircle2} />
                  <StatusRow label="Read" value={data.whatsapp.deliveryStatus.read} icon={Activity} />
                  <StatusRow label="Failed" value={data.whatsapp.deliveryStatus.failed} icon={XCircle} />
                </CardContent>
              </Card>
            </div>

            <Card className="border-slate-200">
              <CardHeader>
                <CardTitle className="text-base">WhatsApp Flow Stages</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-3 md:grid-cols-2">
                <FlowStageRow
                  label="Wellbeing"
                  value={data.whatsapp.flowSteps.wellbeing}
                  total={data.whatsapp.flowSteps.wellbeing}
                />
                <FlowStageRow
                  label="Symptoms"
                  value={data.whatsapp.flowSteps.symptoms}
                  total={data.whatsapp.flowSteps.wellbeing}
                />
                <FlowStageRow
                  label="Medications"
                  value={data.whatsapp.flowSteps.medications}
                  total={data.whatsapp.flowSteps.wellbeing}
                />
                <FlowStageRow
                  label="Completed"
                  value={data.whatsapp.flowSteps.completed}
                  total={data.whatsapp.flowSteps.wellbeing}
                />
                <FlowStageRow
                  label="Unknown Step"
                  value={data.whatsapp.flowSteps.unknown}
                  total={data.whatsapp.flowSteps.wellbeing}
                />
              </CardContent>
            </Card>

            <Card className="border-slate-200">
              <CardHeader>
                <CardTitle className="text-base">Recent Events</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Type</TableHead>
                      <TableHead>Patient</TableHead>
                      <TableHead>Detail</TableHead>
                      <TableHead className="text-right">When</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.recentEvents.map((event, index) => (
                      <TableRow key={`${event.type}-${event.patientId}-${index}`}>
                        <TableCell>
                          <Badge
                            className={
                              event.type === "check_in"
                                ? "bg-teal-50 text-teal-700 border-teal-200"
                                : "bg-indigo-50 text-indigo-700 border-indigo-200"
                            }
                          >
                            {event.type === "check_in" ? "Check-in" : "Apple Sync"}
                          </Badge>
                        </TableCell>
                        <TableCell className="font-medium text-slate-900">{event.patientName}</TableCell>
                        <TableCell className="text-slate-600">
                          {event.type === "check_in"
                            ? `Triage ${String(event.triageOutcome || "unknown").toUpperCase()} | Wellbeing ${event.wellbeingScore ?? "n/a"}`
                            : `${event.deviceName || "Apple Watch"} | Battery ${event.batteryLevel ?? "n/a"}%`}
                        </TableCell>
                        <TableCell className="text-right text-slate-500">
                          {formatDistanceToNow(new Date(event.timestamp), { addSuffix: true })}
                        </TableCell>
                      </TableRow>
                    ))}
                    {data.recentEvents.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={4} className="text-center text-slate-500 py-6">
                          No recent events in this window.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>

            <div className="grid gap-4 lg:grid-cols-2">
              <Card className="border-slate-200">
                <CardHeader>
                  <CardTitle className="text-base">Patient WhatsApp Threads</CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  {conversationsLoading ? (
                    <div className="py-8 text-center text-slate-500">
                      <Loader2 className="h-4 w-4 animate-spin mx-auto mb-2" />
                      Loading conversations...
                    </div>
                  ) : conversations.length === 0 ? (
                    <div className="py-8 text-center text-slate-500">
                      No conversation data in this window.
                    </div>
                  ) : (
                    <div className="divide-y divide-slate-100">
                      {conversations.map((conversation) => {
                        const active = conversation.patientId === selectedPatientId;
                        return (
                          <button
                            key={conversation.patientId}
                            type="button"
                            onClick={() => setSelectedPatientId(conversation.patientId)}
                            className={`w-full text-left px-4 py-3 transition-colors ${
                              active ? "bg-indigo-50" : "hover:bg-slate-50"
                            }`}
                          >
                            <div className="flex items-center justify-between gap-2">
                              <p className="text-sm font-semibold text-slate-900">
                                {conversation.patientName}
                              </p>
                              <span className="text-xs text-slate-500">
                                {formatDistanceToNow(new Date(conversation.latestMessageAt), {
                                  addSuffix: true,
                                })}
                              </span>
                            </div>
                            <p className="text-xs text-slate-500 mt-0.5">
                              {conversation.whatsappPhone || "No WhatsApp number"}
                            </p>
                            <p className="text-sm text-slate-700 mt-2 line-clamp-2">
                              {conversation.latestMessagePreview}
                            </p>
                            <div className="flex items-center gap-2 mt-2 text-xs text-slate-500">
                              <span>In: {conversation.inboundCount}</span>
                              <span>Out: {conversation.outboundCount}</span>
                              <span className="inline-flex items-center gap-1">
                                <Watch className="h-3 w-3" />
                                {conversation.appleWatchLastSyncAt
                                  ? formatDistanceToNow(new Date(conversation.appleWatchLastSyncAt), {
                                      addSuffix: true,
                                    })
                                  : "n/a"}
                              </span>
                              <span className="inline-flex items-center gap-1">
                                <Smartphone className="h-3 w-3" />
                                {conversation.androidLastSyncAt
                                  ? formatDistanceToNow(new Date(conversation.androidLastSyncAt), {
                                      addSuffix: true,
                                    })
                                  : "n/a"}
                              </span>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card className="border-slate-200">
                <CardHeader>
                  <CardTitle className="text-base">Selected Patient Chat History</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {patientMessagesLoading && (
                    <div className="py-8 text-center text-slate-500">
                      <Loader2 className="h-4 w-4 animate-spin mx-auto mb-2" />
                      Loading messages...
                    </div>
                  )}

                  {!patientMessagesLoading && !patientMessagesData && (
                    <div className="py-8 text-center text-slate-500">
                      Select a conversation to inspect patient message history.
                    </div>
                  )}

                  {!patientMessagesLoading && patientMessagesData && (
                    <>
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-sm font-semibold text-slate-900">
                            {patientMessagesData.patient.name}
                          </p>
                          <p className="text-xs text-slate-500">
                            {patientMessagesData.patient.whatsappPhone || "No WhatsApp number"}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          {patientMessagesData.devices.map((device) => (
                            <Badge
                              key={device.id}
                              className="bg-slate-100 text-slate-700 border-slate-200"
                            >
                              {device.deviceType}{" "}
                              {device.lastSyncAt
                                ? `(${formatDistanceToNow(new Date(device.lastSyncAt), {
                                    addSuffix: true,
                                  })})`
                                : "(no sync)"}
                            </Badge>
                          ))}
                        </div>
                      </div>

                      <div className="max-h-[420px] overflow-y-auto space-y-2 pr-1">
                        {patientMessagesData.messages.map((message) => (
                          <div
                            key={message.id}
                            className={`flex ${
                              message.direction === "inbound" ? "justify-start" : "justify-end"
                            }`}
                          >
                            <div
                              className={`max-w-[85%] rounded-xl px-3 py-2 border ${
                                message.direction === "inbound"
                                  ? "bg-slate-50 border-slate-200 text-slate-900"
                                  : "bg-teal-50 border-teal-200 text-teal-900"
                              }`}
                            >
                              <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                              <p className="text-[11px] mt-1 opacity-70">
                                {message.senderType} •{" "}
                                {formatDistanceToNow(new Date(message.createdAt), {
                                  addSuffix: true,
                                })}
                                {message.whatsappStatus
                                  ? ` • status: ${message.whatsappStatus}`
                                  : ""}
                              </p>
                            </div>
                          </div>
                        ))}
                        {patientMessagesData.messages.length === 0 && (
                          <p className="text-sm text-slate-500 py-6 text-center">
                            No WhatsApp chat history for this patient.
                          </p>
                        )}
                      </div>
                    </>
                  )}
                </CardContent>
              </Card>
            </div>
          </>
        )}
      </main>
    </div>
  );
}

function MetricCard({
  label,
  value,
  detail,
  color,
  icon: Icon,
}: {
  label: string;
  value: string;
  detail: string;
  color: string;
  icon: ComponentType<{ className?: string }>;
}) {
  return (
    <Card className={`border ${color}`}>
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide">{label}</p>
            <p className="text-2xl font-bold mt-1">{value}</p>
          </div>
          <Icon className="h-5 w-5" />
        </div>
        <p className="text-xs mt-2 opacity-80">{detail}</p>
      </CardContent>
    </Card>
  );
}

function TriageRow({
  label,
  value,
  className,
}: {
  label: string;
  value: number;
  className: string;
}) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-sm font-medium text-slate-700">{label}</span>
      <Badge className={className}>{value}</Badge>
    </div>
  );
}

function StatusRow({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: number;
  icon: ComponentType<{ className?: string }>;
}) {
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-2 text-sm text-slate-700">
        <Icon className="h-4 w-4 text-slate-500" />
        <span>{label}</span>
      </div>
      <span className="text-sm font-semibold text-slate-900">{value}</span>
    </div>
  );
}

function RuntimeStateBadge({
  label,
  ready,
  detail,
}: {
  label: string;
  ready: boolean;
  detail: string;
}) {
  return (
    <div className="rounded-lg border border-slate-200 p-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-medium uppercase tracking-wide text-slate-700">{label}</p>
        <Badge
          className={
            ready
              ? "bg-green-50 text-green-700 border-green-200"
              : "bg-amber-50 text-amber-700 border-amber-200"
          }
        >
          {ready ? "Ready" : "Pending"}
        </Badge>
      </div>
      <p className="text-xs text-slate-500 mt-1">{detail}</p>
    </div>
  );
}

function RuntimeProviderRow({
  label,
  ready,
  detail,
  missingKeys,
}: {
  label: string;
  ready: boolean;
  detail: string;
  missingKeys: string[];
}) {
  return (
    <div className="rounded-lg border border-slate-200 px-3 py-2.5">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-medium text-slate-800">{label}</p>
        <Badge
          className={
            ready
              ? "bg-green-50 text-green-700 border-green-200"
              : "bg-amber-50 text-amber-700 border-amber-200"
          }
        >
          {ready ? "Valid" : "Missing Keys"}
        </Badge>
      </div>
      <p className="text-xs text-slate-500 mt-1">{detail}</p>
      {missingKeys.length > 0 && (
        <p className="text-[11px] text-amber-700 mt-1">
          Missing: {missingKeys.join(", ")}
        </p>
      )}
    </div>
  );
}

function RuntimeCheckBadge({
  check,
}: {
  check:
    | {
        ok: boolean;
        status: number | null;
        error: string | null;
      }
    | null;
}) {
  if (!check) {
    return (
      <Badge className="bg-slate-100 text-slate-700 border-slate-200">Not Checked</Badge>
    );
  }

  if (check.ok) {
    return (
      <Badge className="bg-green-50 text-green-700 border-green-200">
        OK{check.status ? ` (${check.status})` : ""}
      </Badge>
    );
  }

  return (
    <Badge className="bg-red-50 text-red-700 border-red-200">
      Failed{check.status ? ` (${check.status})` : ""}
    </Badge>
  );
}

function StageCheckRow({
  label,
  detail,
  passed,
}: {
  label: string;
  detail: string;
  passed: boolean;
}) {
  return (
    <div className="flex items-start justify-between gap-3">
      <div>
        <p className="text-xs font-medium text-slate-800">{label}</p>
        <p className="text-[11px] text-slate-500">{detail}</p>
      </div>
      {passed ? (
        <Badge className="bg-green-50 text-green-700 border-green-200">Pass</Badge>
      ) : (
        <Badge className="bg-amber-50 text-amber-700 border-amber-200">Pending</Badge>
      )}
    </div>
  );
}

function StageStatusBadge({ progress }: { progress: number }) {
  if (progress >= 90) {
    return (
      <Badge className="bg-green-50 text-green-700 border-green-200">
        <CheckCircle className="h-3.5 w-3.5 mr-1" />
        Ready
      </Badge>
    );
  }

  if (progress >= 50) {
    return (
      <Badge className="bg-amber-50 text-amber-700 border-amber-200">
        <Activity className="h-3.5 w-3.5 mr-1" />
        In Progress
      </Badge>
    );
  }

  return (
    <Badge className="bg-slate-100 text-slate-700 border-slate-200">
      <AlertTriangle className="h-3.5 w-3.5 mr-1" />
      Needs Action
    </Badge>
  );
}

function FlowStageRow({
  label,
  value,
  total,
}: {
  label: string;
  value: number;
  total: number;
}) {
  const ratio = total > 0 ? Math.min(100, Math.round((value / total) * 100)) : 0;

  return (
    <div className="rounded-lg border border-slate-200 p-3">
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-sm font-medium text-slate-800">{label}</span>
        <span className="text-sm font-semibold text-slate-900">{value}</span>
      </div>
      <Progress value={ratio} className="h-2 mb-1.5" />
      <p className="text-xs text-slate-500">{ratio}% of started conversations</p>
    </div>
  );
}
