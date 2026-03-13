import { useEffect, useMemo, useState } from "react";
import { formatDistanceToNow } from "date-fns";
import {
  AlertTriangle,
  CheckCircle2,
  HeartPulse,
  Loader2,
  MessageSquareText,
  RefreshCw,
  Smartphone,
  Watch,
} from "lucide-react";
import { DemoDashboardHeader } from "@/demo/components/DemoDashboardHeader";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
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
  useDoctorConversations,
  useDoctorOverview,
  useDoctorPatientMessages,
  useDoctorPatients,
} from "@/hooks/useDoctorOps";

const WINDOW_OPTIONS = [
  { label: "24h", value: "24" },
  { label: "72h", value: "72" },
  { label: "7d", value: "168" },
];

export default function DoctorOps() {
  const [windowHours, setWindowHours] = useState("24");
  const [patientSearch, setPatientSearch] = useState("");
  const [selectedPatientId, setSelectedPatientId] = useState<string | null>(null);

  const hours = Number(windowHours);
  const {
    data: overview,
    isLoading: overviewLoading,
    isError: overviewError,
    error: overviewErrorMessage,
    refetch: refetchOverview,
    isFetching: overviewFetching,
  } = useDoctorOverview(hours);

  const {
    data: conversationsData,
    isLoading: conversationsLoading,
    refetch: refetchConversations,
    isFetching: conversationsFetching,
  } = useDoctorConversations(hours, 30);

  const {
    data: rosterData,
    isLoading: rosterLoading,
    refetch: refetchRoster,
    isFetching: rosterFetching,
  } = useDoctorPatients(150, patientSearch);

  const {
    data: patientDetails,
    isLoading: patientDetailsLoading,
    refetch: refetchPatientDetails,
    isFetching: patientDetailsFetching,
  } = useDoctorPatientMessages(selectedPatientId || undefined, 120);

  const conversations = useMemo(
    () => conversationsData?.conversations || [],
    [conversationsData]
  );
  const rosterPatients = useMemo(() => rosterData?.patients || [], [rosterData]);

  useEffect(() => {
    const available = new Set<string>([
      ...conversations.map((item) => item.patientId),
      ...rosterPatients.map((item) => item.id),
    ]);

    if (available.size === 0) {
      setSelectedPatientId(null);
      return;
    }

    if (!selectedPatientId || !available.has(selectedPatientId)) {
      const next = conversations[0]?.patientId || rosterPatients[0]?.id || null;
      setSelectedPatientId(next);
    }
  }, [conversations, rosterPatients, selectedPatientId]);

  const refreshAll = async () => {
    await Promise.all([
      refetchOverview(),
      refetchConversations(),
      refetchRoster(),
      refetchPatientDetails(),
    ]);
  };

  if (overviewError) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white">
        <DemoDashboardHeader unreadAlerts={0} />
        <main className="container mx-auto px-4 lg:px-8 py-8">
          <Card className="border-red-200">
            <CardContent className="flex flex-col items-center justify-center py-12 gap-3 text-center">
              <AlertTriangle className="h-10 w-10 text-red-600" />
              <h2 className="text-lg font-semibold text-slate-900">Failed to load doctor workspace</h2>
              <p className="text-sm text-slate-600">
                {overviewErrorMessage instanceof Error
                  ? overviewErrorMessage.message
                  : "Unexpected error"}
              </p>
              <Button onClick={() => void refreshAll()}>
                <RefreshCw className="mr-2 h-4 w-4" />
                Retry
              </Button>
            </CardContent>
          </Card>
        </main>
      </div>
    );
  }

  const redCount = overview?.whatsapp.triageBreakdown.red || 0;

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white">
      <DemoDashboardHeader unreadAlerts={redCount} />

      <main className="container mx-auto px-4 lg:px-8 py-8 space-y-6">
        <section className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Doctor Workspace</h1>
            <p className="text-sm text-slate-500 mt-1">
              Shared patient, WhatsApp, and wearable sync data. Admin key controls stay separate.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Select value={windowHours} onValueChange={setWindowHours}>
              <SelectTrigger className="w-[110px] bg-white">
                <SelectValue placeholder="Window" />
              </SelectTrigger>
              <SelectContent>
                {WINDOW_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button variant="outline" onClick={() => void refreshAll()}>
              <RefreshCw className={`mr-2 h-4 w-4 ${overviewFetching ? "animate-spin" : ""}`} />
              Refresh
            </Button>
          </div>
        </section>

        <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Card className="border-slate-200">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <p className="text-sm text-slate-500">Active Conversations</p>
                <MessageSquareText className="h-4 w-4 text-slate-500" />
              </div>
              <p className="text-2xl font-bold text-slate-900 mt-2">
                {overviewLoading ? "-" : overview?.whatsapp.conversationsActive ?? 0}
              </p>
            </CardContent>
          </Card>
          <Card className="border-slate-200">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <p className="text-sm text-slate-500">Messages (Inbound / Outbound)</p>
                <HeartPulse className="h-4 w-4 text-slate-500" />
              </div>
              <p className="text-2xl font-bold text-slate-900 mt-2">
                {overviewLoading
                  ? "-"
                  : `${overview?.whatsapp.messagesInbound ?? 0} / ${overview?.whatsapp.messagesOutbound ?? 0}`}
              </p>
            </CardContent>
          </Card>
          <Card className="border-slate-200">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <p className="text-sm text-slate-500">Urgent Triage</p>
                <AlertTriangle className="h-4 w-4 text-red-600" />
              </div>
              <p className="text-2xl font-bold text-slate-900 mt-2">
                {overviewLoading ? "-" : overview?.whatsapp.triageBreakdown.red ?? 0}
              </p>
            </CardContent>
          </Card>
          <Card className="border-slate-200">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <p className="text-sm text-slate-500">Connected Devices</p>
                <Watch className="h-4 w-4 text-slate-500" />
              </div>
              <p className="text-2xl font-bold text-slate-900 mt-2">
                {overviewLoading ? "-" : overview?.appleWatch.connectedDevices ?? 0}
              </p>
            </CardContent>
          </Card>
        </section>

        <section className="grid gap-4 lg:grid-cols-2">
          <Card className="border-slate-200">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Patient Roster</CardTitle>
              <Input
                placeholder="Search patient or WhatsApp"
                value={patientSearch}
                onChange={(event) => setPatientSearch(event.target.value)}
              />
            </CardHeader>
            <CardContent>
              {rosterLoading ? (
                <div className="flex items-center justify-center py-8 text-slate-500 gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Loading roster
                </div>
              ) : rosterPatients.length === 0 ? (
                <p className="text-sm text-slate-500">No patients available for this role scope.</p>
              ) : (
                <div className="max-h-80 overflow-auto border rounded-lg">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Patient</TableHead>
                        <TableHead>WhatsApp</TableHead>
                        <TableHead>Devices</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {rosterPatients.map((patient) => (
                        <TableRow
                          key={patient.id}
                          onClick={() => setSelectedPatientId(patient.id)}
                          className={`cursor-pointer ${
                            selectedPatientId === patient.id ? "bg-indigo-50" : ""
                          }`}
                        >
                          <TableCell className="font-medium">{patient.name}</TableCell>
                          <TableCell>{patient.whatsappPhone || "-"}</TableCell>
                          <TableCell>{patient.connectedDevices}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
              {(rosterFetching || conversationsFetching) && (
                <p className="text-xs text-slate-400 mt-2">Refreshing data...</p>
              )}
            </CardContent>
          </Card>

          <Card className="border-slate-200">
            <CardHeader>
              <CardTitle className="text-base">WhatsApp Conversation Feed</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 max-h-96 overflow-auto">
              {conversationsLoading ? (
                <div className="flex items-center justify-center py-8 text-slate-500 gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Loading conversations
                </div>
              ) : conversations.length === 0 ? (
                <p className="text-sm text-slate-500">No conversation activity in this time window.</p>
              ) : (
                conversations.map((conversation) => (
                  <button
                    key={conversation.patientId}
                    type="button"
                    onClick={() => setSelectedPatientId(conversation.patientId)}
                    className={`w-full text-left border rounded-lg p-3 transition-colors ${
                      selectedPatientId === conversation.patientId
                        ? "border-indigo-300 bg-indigo-50"
                        : "border-slate-200 hover:border-slate-300"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <p className="font-medium text-slate-900">{conversation.patientName}</p>
                      <Badge variant="outline" className="text-xs">
                        {conversation.inboundCount} in / {conversation.outboundCount} out
                      </Badge>
                    </div>
                    <p className="text-sm text-slate-600 mt-1">{conversation.latestMessagePreview}</p>
                    <p className="text-xs text-slate-400 mt-2">
                      {formatDistanceToNow(new Date(conversation.latestMessageAt), {
                        addSuffix: true,
                      })}
                    </p>
                  </button>
                ))
              )}
            </CardContent>
          </Card>
        </section>

        <section>
          <Card className="border-slate-200">
            <CardHeader>
              <CardTitle className="text-base">Selected Patient Detail</CardTitle>
            </CardHeader>
            <CardContent>
              {!selectedPatientId ? (
                <p className="text-sm text-slate-500">Select a patient to view chat history and devices.</p>
              ) : patientDetailsLoading ? (
                <div className="flex items-center gap-2 text-slate-500 py-6">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Loading patient detail
                </div>
              ) : !patientDetails ? (
                <p className="text-sm text-slate-500">No patient data available.</p>
              ) : (
                <div className="space-y-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-lg font-semibold text-slate-900">{patientDetails.patient.name}</h3>
                    <Badge variant="outline">{patientDetails.patient.whatsappPhone || "No WhatsApp"}</Badge>
                    <Badge variant="outline" className="flex items-center gap-1">
                      <CheckCircle2 className="h-3.5 w-3.5 text-green-600" />
                      Shared clinical view
                    </Badge>
                  </div>

                  <div className="grid gap-4 lg:grid-cols-2">
                    <div className="border rounded-lg p-3">
                      <p className="text-sm font-medium text-slate-900 mb-3">Chat History</p>
                      <div className="space-y-2 max-h-80 overflow-auto">
                        {patientDetails.messages.length === 0 ? (
                          <p className="text-sm text-slate-500">No WhatsApp messages yet.</p>
                        ) : (
                          patientDetails.messages.map((message) => (
                            <div
                              key={message.id}
                              className={`rounded-lg px-3 py-2 text-sm ${
                                message.direction === "inbound"
                                  ? "bg-slate-100 text-slate-900"
                                  : "bg-indigo-50 text-indigo-900"
                              }`}
                            >
                              <div className="flex items-center justify-between gap-2 text-xs mb-1">
                                <span className="font-medium">{message.senderType}</span>
                                <span className="text-slate-500">
                                  {formatDistanceToNow(new Date(message.createdAt), {
                                    addSuffix: true,
                                  })}
                                </span>
                              </div>
                              <p>{message.content}</p>
                            </div>
                          ))
                        )}
                      </div>
                    </div>

                    <div className="border rounded-lg p-3">
                      <p className="text-sm font-medium text-slate-900 mb-3">Connected Devices</p>
                      <div className="space-y-2">
                        {patientDetails.devices.length === 0 ? (
                          <p className="text-sm text-slate-500">No connected Apple/Android devices.</p>
                        ) : (
                          patientDetails.devices.map((device) => (
                            <div key={device.id} className="border rounded-lg p-3 bg-white">
                              <div className="flex items-center justify-between gap-2">
                                <p className="font-medium text-slate-900">{device.deviceName || device.deviceType}</p>
                                <Badge variant="outline" className="capitalize">
                                  {device.connectionStatus}
                                </Badge>
                              </div>
                              <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-slate-500">
                                <span className="inline-flex items-center gap-1">
                                  <Watch className="h-3.5 w-3.5" />
                                  {device.deviceType}
                                </span>
                                <span className="inline-flex items-center gap-1">
                                  <Smartphone className="h-3.5 w-3.5" />
                                  Battery {device.batteryLevel ?? "-"}%
                                </span>
                                <span>
                                  Last sync {device.lastSyncAt ? formatDistanceToNow(new Date(device.lastSyncAt), { addSuffix: true }) : "-"}
                                </span>
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  </div>

                  {patientDetailsFetching && (
                    <p className="text-xs text-slate-400">Refreshing patient detail...</p>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </section>
      </main>
    </div>
  );
}
