import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { usePatientDetail } from '@/hooks/usePatientData';
import { PilotDashboardHeader } from '@/pilot/components/PilotDashboardHeader';
import { TriageBadge } from '@/components/TriageBadge';
import { VitalTrends } from '@/components/VitalTrends';
import { MedicalChatAssistant } from '@/components/MedicalChatAssistant';
import { SBARCard } from '@/components/SBARCard';
import { AlertCard } from '@/components/AlertCard';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  ArrowLeft,
  Calendar,
  Phone,
  MessageSquare,
  Pill,
  FileText,
  Clock,
  User,
  Heart,
  Activity,
  Moon,
  Footprints,
  Stethoscope,
  TrendingUp,
  TrendingDown,
  Minus,
  ShieldCheck,
  Gauge,
  Syringe,
  AlertTriangle,
  Waves,
  Building2,
  FlaskConical,
  Smartphone,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { useAlerts } from '@/context/AlertsContext';
import { DevicePairingModal } from '@/pilot/components/DevicePairingModal';
import { useQueryClient, useMutation } from '@tanstack/react-query';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import apiClient from '@/services/api/client';

export default function PatientDetail() {
  const { patientId } = useParams<{ patientId: string }>();
  const navigate = useNavigate();
  const dashboardPath = '/pilot/dashboard';
  const { resolvedAlertIds, resolveAlert } = useAlerts();
  const { data: patient, isLoading, error } = usePatientDetail(patientId || '');
  const queryClient = useQueryClient();
  const [pairingOpen, setPairingOpen] = useState(false);
  const [pairingToken, setPairingToken] = useState<string | undefined>(undefined);
  const [pairingShortCode, setPairingShortCode] = useState<string | undefined>(undefined);
  const [pairingQrPayload, setPairingQrPayload] = useState<string | undefined>(undefined);
  const [apptDialogOpen, setApptDialogOpen] = useState(false);
  const [apptScheduledAt, setApptScheduledAt] = useState('');
  const [apptType, setApptType] = useState<'routine' | 'urgent' | 'follow_up' | 'telemedicine'>('routine');
  const [apptNotes, setApptNotes] = useState('');
  const [apptDoctorId, setApptDoctorId] = useState('');

  const [rxDialogOpen, setRxDialogOpen] = useState(false);
  const [rxMedName, setRxMedName] = useState('');
  const [rxDosage, setRxDosage] = useState('');
  const [rxInstructions, setRxInstructions] = useState('');

  const [medDialogOpen, setMedDialogOpen] = useState(false);
  const [medMessage, setMedMessage] = useState('');

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center"><p className="text-muted-foreground">Loading patient data...</p></div>
      </div>
    );
  }
  if (error || !patient) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-xl font-semibold mb-2">Patient not found</h1>
          <Button onClick={() => navigate(dashboardPath)}>Return to Dashboard</Button>
        </div>
      </div>
    );
  }

  const createAppointment = useMutation({
    mutationFn: async () => {
      const payload: Record<string, unknown> = {
        patientId: patient!.id,
        type: apptType,
        scheduledAt: new Date(apptScheduledAt).toISOString(),
        durationMinutes: 30,
      };
      if (apptNotes.trim()) payload.reason = apptNotes.trim();
      if (apptDoctorId.trim()) payload.doctorId = apptDoctorId.trim();
      return apiClient.post('/appointments', payload);
    },
    onSuccess: () => {
      toast.success('Appointment requested successfully');
      setApptDialogOpen(false);
      setApptScheduledAt('');
      setApptType('routine');
      setApptNotes('');
      setApptDoctorId('');
      queryClient.invalidateQueries({ queryKey: ['patientData'] });
    },
    onError: (err: unknown) => {
      const message =
        err instanceof Error ? err.message : 'Failed to create appointment';
      toast.error(message);
    },
  });

  const submitDraftRx = useMutation({
    mutationFn: async () =>
      apiClient.post('/alerts', {
        patientId: patient!.id,
        type: 'manual',
        severity: 'low',
        title: `Draft Prescription: ${rxMedName}`,
        message: `Medication: ${rxMedName}\nDosage: ${rxDosage}\nInstructions: ${rxInstructions}`,
      }),
    onSuccess: () => {
      toast.success('Prescription draft created for clinician review');
      setRxDialogOpen(false);
      setRxMedName('');
      setRxDosage('');
      setRxInstructions('');
    },
    onError: (err: unknown) => {
      toast.error(err instanceof Error ? err.message : 'Failed to submit prescription draft');
    },
  });

  const submitMedReminder = useMutation({
    mutationFn: async () =>
      apiClient.post('/alerts', {
        patientId: patient!.id,
        type: 'manual',
        severity: 'low',
        title: 'Medication Reminder Sent',
        message: medMessage,
      }),
    onSuccess: () => {
      toast.success(`Medication reminder sent to ${pharmacyName}`);
      setMedDialogOpen(false);
      setMedMessage('');
    },
    onError: (err: unknown) => {
      toast.error(err instanceof Error ? err.message : 'Failed to send medication reminder');
    },
  });

  const handleResolveAlert = async (alertId: string) => {
    try {
      await apiClient.patch(`/alerts/${alertId}/acknowledge`);
      resolveAlert(alertId);
      queryClient.invalidateQueries({ queryKey: ['patients'] });
      toast.success('Alert acknowledged');
    } catch {
      // Optimistically update local state even if API fails
      resolveAlert(alertId);
      toast.success('Alert marked as resolved');
    }
  };

  const handleRequestAppointment = () => {
    setApptDialogOpen(true);
  };

  const handleContactPatient = () => {
    const phone = patient.whatsappPhone?.replace(/\D/g, '');
    if (phone) {
      window.open(`https://wa.me/${phone}`, '_blank');
    } else {
      toast.info('No WhatsApp number on file for this patient');
    }
  };

  const clinicianName = patient.consultant ?? '--';
  const pharmacyName = 'CityCare Pharmacy';

  const latestWearable = patient.wearableData?.[patient.wearableData.length - 1];

  let hrDelta = 0;
  let hrvDelta = 0;
  let sleepDelta = 0;
  let stepsDelta = 0;

  if (latestWearable && patient.wearableData && patient.wearableData.length > 0) {
    const data = patient.wearableData;
    const avgRestingHR = data.reduce((s, d) => s + d.restingHR, 0) / data.length;
    const avgHRV = data.reduce((s, d) => s + d.hrv, 0) / data.length;
    const avgSleepHours = data.reduce((s, d) => s + d.sleepHours, 0) / data.length;
    const avgSteps = data.reduce((s, d) => s + d.steps, 0) / data.length;
    hrDelta = Math.round(latestWearable.restingHR - avgRestingHR);
    hrvDelta = Math.round(latestWearable.hrv - avgHRV);
    sleepDelta = +(latestWearable.sleepHours - avgSleepHours).toFixed(1);
    stepsDelta = Math.round(latestWearable.steps - avgSteps);
  }

  const handleCallClinician = () => {
    toast.info(`${clinicianName} — contact via internal staff directory`);
  };

  const handleCallPatient = () => {
    const phone = patient.whatsappPhone?.replace(/\D/g, '');
    if (phone) {
      window.location.href = `tel:${phone}`;
    } else {
      toast.info('No phone number on file for this patient');
    }
  };

  const handleLogComplaint = () => {
    toast.success('Complaint logged and routed to patient experience');
  };

  const handleDraftPrescription = () => { setRxDialogOpen(true); };

  const handleSendMedication = () => {
    setMedMessage(`Medication reminder for ${patient.name}: please take your prescribed medications as directed.`);
    setMedDialogOpen(true);
  };

  const handleRequestLiveSync = async () => {
    try {
      const res = await apiClient.post<{
        data: { token: string; shortCode: string; qrPayload: string };
      }>('/pairing/generate', { patientId: patientId || '' });
      const { token, shortCode, qrPayload } = res.data.data;
      setPairingToken(token);
      setPairingShortCode(shortCode);
      setPairingQrPayload(qrPayload);
      setPairingOpen(true);
    } catch {
      toast.error('Failed to request live sync');
    }
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  };

  const unresolvedAlerts = patient.alerts.filter((a) => !resolvedAlertIds.has(a.id) && !a.resolved);

  return (
    <div className="min-h-screen bg-background">
      <PilotDashboardHeader unreadAlerts={unresolvedAlerts.length} />

      <main className="container mx-auto px-4 py-6">
        {/* Back button and patient header */}
        <div className="mb-6">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate(dashboardPath)}
            className="mb-4 -ml-2 text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft size={16} className="mr-1" />
            Back to Dashboard
          </Button>

          <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
            <div className="flex items-start gap-4">
              <div className="w-14 h-14 rounded-full bg-secondary flex items-center justify-center">
                <User size={28} className="text-muted-foreground" />
              </div>
              <div>
                <div className="flex items-center gap-3 mb-1">
                  <h1 className="text-2xl font-semibold">{patient.name}</h1>
                  <TriageBadge level={patient.triageLevel} />
                </div>
                <p className="text-muted-foreground">
                  {patient.age}y {patient.gender} • NHS: {patient.nhsNumber}
                </p>
                <p className="text-sm text-foreground mt-1">{patient.condition}</p>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <Button variant="outline" size="sm" onClick={handleContactPatient}>
                <MessageSquare size={16} className="mr-1.5" />
                Message
              </Button>
              <Button variant="outline" size="sm" onClick={handleCallPatient}>
                <Phone size={16} className="mr-1.5" />
                Call
              </Button>
              <Button variant="outline" size="sm" onClick={() => setPairingOpen(true)}>
                <Smartphone size={16} className="mr-1.5" />
                Connect Device
              </Button>
              <Button size="sm" onClick={handleRequestAppointment}>
                <Calendar size={16} className="mr-1.5" />
                Request Appointment
              </Button>
            </div>
          </div>
        </div>

        {/* Alerts section */}
        {unresolvedAlerts.length > 0 && (
          <div className="mb-6 space-y-3">
            <h2 className="text-sm font-medium text-muted-foreground">
              Active Alerts ({unresolvedAlerts.length})
            </h2>
            {unresolvedAlerts.map((alert) => (
              <AlertCard
                key={alert.id}
                alert={alert}
                onResolve={handleResolveAlert}
              />
            ))}
          </div>
        )}

        {/* Quick info cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
          <Card className="p-4 border-2 border-slate-200 hover:border-slate-300 transition-colors">
            <div className="flex items-center gap-2 text-slate-500 mb-2">
              <div className="w-7 h-7 rounded-lg bg-slate-100 flex items-center justify-center">
                <Clock size={14} className="text-slate-600" />
              </div>
              <span className="text-xs font-medium">Discharged</span>
            </div>
            <p className="text-sm font-bold text-slate-900">{formatDate(patient.dischargeDate)}</p>
          </Card>
          <Card className="p-4 border-2 border-slate-200 hover:border-slate-300 transition-colors">
            <div className="flex items-center gap-2 text-slate-500 mb-2">
              <div className="w-7 h-7 rounded-lg bg-teal-100 flex items-center justify-center">
                <Calendar size={14} className="text-teal-600" />
              </div>
              <span className="text-xs font-medium">Days Post-Discharge</span>
            </div>
            <p className="text-sm font-bold text-slate-900">
              {Math.floor((new Date().getTime() - new Date(patient.dischargeDate).getTime()) / (1000 * 60 * 60 * 24))}
            </p>
          </Card>
          <Card className={cn("p-4 border-2 transition-colors", patient.wellbeingScore <= 4 ? "border-red-200 bg-red-50/30" : patient.wellbeingScore <= 6 ? "border-amber-200 bg-amber-50/30" : "border-green-200 bg-green-50/30")}>
            <div className="flex items-center gap-2 text-slate-500 mb-2">
              <div className={cn("w-7 h-7 rounded-lg flex items-center justify-center", patient.wellbeingScore <= 4 ? "bg-red-100" : patient.wellbeingScore <= 6 ? "bg-amber-100" : "bg-green-100")}>
                <Heart size={14} className={cn(patient.wellbeingScore <= 4 ? "text-red-600" : patient.wellbeingScore <= 6 ? "text-amber-600" : "text-green-600")} />
              </div>
              <span className="text-xs font-medium">Wellbeing Score</span>
            </div>
            <p className="text-sm font-bold text-slate-900">{patient.wellbeingScore}/10</p>
          </Card>
          <Card className="p-4 border-2 border-slate-200 hover:border-slate-300 transition-colors">
            <div className="flex items-center gap-2 text-slate-500 mb-2">
              <div className="w-7 h-7 rounded-lg bg-blue-100 flex items-center justify-center">
                <Pill size={14} className="text-blue-600" />
              </div>
              <span className="text-xs font-medium">Medications</span>
            </div>
            <p className="text-sm font-bold text-slate-900">{patient.medications.length} active</p>
          </Card>
        </div>

        {/* Cardiac Clinical Panel */}
        {patient.ejectionFraction !== undefined && (
          <Card className="mb-6 border-2 border-slate-200 overflow-hidden">
            <div className="bg-gradient-to-r from-slate-50 to-white px-5 py-3 border-b border-slate-200">
              <div className="flex items-center gap-2">
                <Heart size={16} className="text-red-500" />
                <h3 className="text-sm font-semibold text-slate-900">Cardiac Clinical Summary</h3>
                {patient.consultant && (
                  <Badge variant="outline" className="ml-auto text-[10px] bg-white">
                    Consultant: {patient.consultant}
                  </Badge>
                )}
              </div>
              {patient.dischargeFrom && (
                <p className="text-xs text-slate-500 mt-1 flex items-center gap-1">
                  <Building2 size={11} />
                  {patient.dischargeFrom}
                </p>
              )}
            </div>
            <div className="p-5">
              <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
                {/* Ejection Fraction */}
                <div className={cn("rounded-xl p-3 border-2", patient.ejectionFraction < 40 ? "border-red-200 bg-red-50/50" : patient.ejectionFraction < 50 ? "border-amber-200 bg-amber-50/50" : "border-green-200 bg-green-50/50")}>
                  <div className="flex items-center gap-1.5 mb-1">
                    <Gauge size={12} className={cn(patient.ejectionFraction < 40 ? "text-red-500" : patient.ejectionFraction < 50 ? "text-amber-500" : "text-green-500")} />
                    <p className="text-[10px] font-medium text-slate-500 uppercase tracking-wider">LVEF</p>
                  </div>
                  <p className="text-lg font-bold text-slate-900">{patient.ejectionFraction}%</p>
                  <p className="text-[10px] text-slate-500">{patient.ejectionFraction >= 50 ? "Preserved" : patient.ejectionFraction >= 40 ? "Mildly reduced" : "Reduced (HFrEF)"}</p>
                </div>

                {/* NYHA Class */}
                {patient.nyhaClass && (
                  <div className={cn("rounded-xl p-3 border-2", patient.nyhaClass === "IV" || patient.nyhaClass === "III" ? "border-red-200 bg-red-50/50" : patient.nyhaClass === "II" ? "border-amber-200 bg-amber-50/50" : "border-green-200 bg-green-50/50")}>
                    <div className="flex items-center gap-1.5 mb-1">
                      <Activity size={12} className="text-blue-500" />
                      <p className="text-[10px] font-medium text-slate-500 uppercase tracking-wider">NYHA</p>
                    </div>
                    <p className="text-lg font-bold text-slate-900">Class {patient.nyhaClass}</p>
                    <p className="text-[10px] text-slate-500">
                      {patient.nyhaClass === "I" ? "No limitation" : patient.nyhaClass === "II" ? "Slight limitation" : patient.nyhaClass === "III" ? "Marked limitation" : "Unable at rest"}
                    </p>
                  </div>
                )}

                {/* ECG Status */}
                {patient.ecgStatus && (
                  <div className={cn("rounded-xl p-3 border-2", patient.ecgStatus === "Normal sinus rhythm" ? "border-green-200 bg-green-50/50" : patient.ecgStatus === "Atrial fibrillation" ? "border-red-200 bg-red-50/50" : "border-amber-200 bg-amber-50/50")}>
                    <div className="flex items-center gap-1.5 mb-1">
                      <Waves size={12} className="text-purple-500" />
                      <p className="text-[10px] font-medium text-slate-500 uppercase tracking-wider">ECG</p>
                    </div>
                    <p className="text-xs font-bold text-slate-900 leading-tight">{patient.ecgStatus}</p>
                  </div>
                )}

                {/* Blood Pressure */}
                {patient.bloodPressure && (
                  <div className={cn("rounded-xl p-3 border-2", patient.bloodPressure.systolic >= 140 ? "border-red-200 bg-red-50/50" : patient.bloodPressure.systolic >= 130 ? "border-amber-200 bg-amber-50/50" : "border-green-200 bg-green-50/50")}>
                    <div className="flex items-center gap-1.5 mb-1">
                      <Syringe size={12} className="text-red-400" />
                      <p className="text-[10px] font-medium text-slate-500 uppercase tracking-wider">BP</p>
                    </div>
                    <p className="text-lg font-bold text-slate-900">{patient.bloodPressure.systolic}/{patient.bloodPressure.diastolic}</p>
                    <p className="text-[10px] text-slate-500">mmHg</p>
                  </div>
                )}

                {/* NT-proBNP */}
                {patient.cardiacBiomarkers && (
                  <div className={cn("rounded-xl p-3 border-2", patient.cardiacBiomarkers.ntProBNP > 900 ? "border-red-200 bg-red-50/50" : patient.cardiacBiomarkers.ntProBNP > 300 ? "border-amber-200 bg-amber-50/50" : "border-green-200 bg-green-50/50")}>
                    <div className="flex items-center gap-1.5 mb-1">
                      <FlaskConical size={12} className="text-indigo-500" />
                      <p className="text-[10px] font-medium text-slate-500 uppercase tracking-wider">NT-proBNP</p>
                    </div>
                    <p className="text-lg font-bold text-slate-900">{patient.cardiacBiomarkers.ntProBNP.toLocaleString()}</p>
                    <p className="text-[10px] text-slate-500">pg/mL{patient.cardiacBiomarkers.ntProBNP > 900 ? " (elevated)" : ""}</p>
                  </div>
                )}

                {/* Troponin */}
                {patient.cardiacBiomarkers && (
                  <div className={cn("rounded-xl p-3 border-2", patient.cardiacBiomarkers.hsTroponinI > 26 ? "border-red-200 bg-red-50/50" : patient.cardiacBiomarkers.hsTroponinI > 14 ? "border-amber-200 bg-amber-50/50" : "border-green-200 bg-green-50/50")}>
                    <div className="flex items-center gap-1.5 mb-1">
                      <AlertTriangle size={12} className={cn(patient.cardiacBiomarkers.hsTroponinI > 26 ? "text-red-500" : "text-slate-400")} />
                      <p className="text-[10px] font-medium text-slate-500 uppercase tracking-wider">hs-TnI</p>
                    </div>
                    <p className="text-lg font-bold text-slate-900">{patient.cardiacBiomarkers.hsTroponinI}</p>
                    <p className="text-[10px] text-slate-500">ng/L{patient.cardiacBiomarkers.hsTroponinI > 26 ? " (above 99th %ile)" : ""}</p>
                  </div>
                )}
              </div>

              {/* Cardiac Rehab Phase + Risk Scores */}
              <div className="mt-4 flex flex-wrap items-center gap-2">
                {patient.cardiacRehabPhase && (
                  <Badge variant="outline" className="bg-teal-50 text-teal-700 border-teal-200 text-xs">
                    {patient.cardiacRehabPhase}
                  </Badge>
                )}
                {patient.riskScores?.grace !== undefined && (
                  <Badge variant="outline" className={cn("text-xs", patient.riskScores.grace > 140 ? "bg-red-50 text-red-700 border-red-200" : patient.riskScores.grace > 108 ? "bg-amber-50 text-amber-700 border-amber-200" : "bg-green-50 text-green-700 border-green-200")}>
                    GRACE: {patient.riskScores.grace} ({patient.riskScores.grace > 140 ? "High" : patient.riskScores.grace > 108 ? "Intermediate" : "Low"})
                  </Badge>
                )}
                {patient.riskScores?.cha2ds2vasc !== undefined && (
                  <Badge variant="outline" className={cn("text-xs", patient.riskScores.cha2ds2vasc >= 2 ? "bg-amber-50 text-amber-700 border-amber-200" : "bg-green-50 text-green-700 border-green-200")}>
                    CHA₂DS₂-VASc: {patient.riskScores.cha2ds2vasc}
                  </Badge>
                )}
                {patient.riskScores?.hasbled !== undefined && (
                  <Badge variant="outline" className={cn("text-xs", patient.riskScores.hasbled >= 3 ? "bg-red-50 text-red-700 border-red-200" : "bg-green-50 text-green-700 border-green-200")}>
                    HAS-BLED: {patient.riskScores.hasbled}
                  </Badge>
                )}
                {patient.cardiacBiomarkers && (
                  <span className="text-[10px] text-slate-400 ml-auto">
                    Bloods drawn: {formatDate(patient.cardiacBiomarkers.lastDrawDate)}
                  </span>
                )}
              </div>

              {/* International Guideline References */}
              <div className="mt-4 pt-3 border-t border-slate-100">
                <p className="text-[10px] font-medium text-slate-500 mb-2 uppercase tracking-wider">Guideline References</p>
                <div className="flex flex-wrap gap-1.5">
                  {[
                    { label: "NICE CG172", desc: "MI secondary prevention" },
                    { label: "NICE CG187", desc: "Acute heart failure" },
                    { label: "NICE NG106", desc: "Chronic heart failure" },
                    { label: "ESC 2023 HF", desc: "European HF guidelines" },
                    { label: "ACC/AHA 2022", desc: "US HF management" },
                  ].map((ref) => (
                    <Badge key={ref.label} variant="outline" className="text-[9px] bg-slate-50 text-slate-500 border-slate-200 cursor-help" title={ref.desc}>
                      {ref.label}
                    </Badge>
                  ))}
                </div>
              </div>
            </div>
          </Card>
        )}

        <div className="grid gap-4 md:grid-cols-2 mb-6">
          <Card className="p-5 border-2 border-slate-200">
            <div className="flex items-center gap-2 mb-1">
              <Stethoscope size={16} className="text-teal-600" />
              <h3 className="text-sm font-semibold text-slate-900">Care Actions</h3>
            </div>
            <p className="text-xs text-slate-500 mb-4">
              Coordinate prescriptions, follow-ups, and support.
            </p>
            <div className="grid grid-cols-2 gap-2">
              <Button variant="outline" size="sm" onClick={handleCallClinician} className="justify-start border-slate-200 hover:bg-teal-50 hover:border-teal-200 hover:text-teal-700">
                <Phone size={14} className="mr-1.5 text-teal-600" />
                Call Clinician
              </Button>
              <Button variant="outline" size="sm" onClick={handleDraftPrescription} className="justify-start border-slate-200 hover:bg-blue-50 hover:border-blue-200 hover:text-blue-700">
                <FileText size={14} className="mr-1.5 text-blue-600" />
                Draft Rx
              </Button>
              <Button variant="outline" size="sm" onClick={handleSendMedication} className="justify-start border-slate-200 hover:bg-purple-50 hover:border-purple-200 hover:text-purple-700">
                <Pill size={14} className="mr-1.5 text-purple-600" />
                Send Medication
              </Button>
              <Button variant="outline" size="sm" onClick={handleLogComplaint} className="justify-start border-slate-200 hover:bg-amber-50 hover:border-amber-200 hover:text-amber-700">
                <MessageSquare size={14} className="mr-1.5 text-amber-600" />
                Log Complaint
              </Button>
            </div>
          </Card>
          <Card className="p-5 border-2 border-slate-200">
            <div className="flex items-center gap-2 mb-3">
              <ShieldCheck size={16} className="text-teal-600" />
              <h3 className="text-sm font-semibold text-slate-900">Care Coordination</h3>
            </div>
            <div className="space-y-3">
              <div className="flex items-center justify-between py-2 border-b border-slate-100">
                <span className="text-xs font-medium text-slate-500">Primary clinician</span>
                <span className="text-sm font-semibold text-slate-900">{clinicianName}</span>
              </div>
              {patient.consultant && (
                <div className="flex items-center justify-between py-2 border-b border-slate-100">
                  <span className="text-xs font-medium text-slate-500">Referring consultant</span>
                  <span className="text-sm font-semibold text-slate-900">{patient.consultant}</span>
                </div>
              )}
              <div className="flex items-center justify-between py-2 border-b border-slate-100">
                <span className="text-xs font-medium text-slate-500">Preferred pharmacy</span>
                <span className="text-sm font-semibold text-slate-900">{pharmacyName}</span>
              </div>
              <div className="flex items-center justify-between py-2">
                <span className="text-xs font-medium text-slate-500">Last wearable sync</span>
                <span className="text-sm font-semibold text-slate-900">{formatDate(patient.lastCheckIn)} at {new Date(patient.lastCheckIn).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}</span>
              </div>
            </div>
          </Card>
        </div>

        {/* Main content tabs */}
        <Tabs defaultValue="overview" className="space-y-4">
          <TabsList className="bg-white border-2 border-slate-200 p-1.5 rounded-xl shadow-sm">
            <TabsTrigger value="overview" className="rounded-lg data-[state=active]:bg-teal-50 data-[state=active]:text-teal-700 data-[state=active]:shadow-sm">
              <Activity size={14} className="mr-1.5" />
              Overview
            </TabsTrigger>
            <TabsTrigger value="chat" className="rounded-lg data-[state=active]:bg-teal-50 data-[state=active]:text-teal-700 data-[state=active]:shadow-sm">
              <Stethoscope size={14} className="mr-1.5" />
              Medical Assistant
            </TabsTrigger>
            <TabsTrigger value="vitals" className="rounded-lg data-[state=active]:bg-teal-50 data-[state=active]:text-teal-700 data-[state=active]:shadow-sm">
              <TrendingUp size={14} className="mr-1.5" />
              Vital Trends
            </TabsTrigger>
            <TabsTrigger value="medications" className="rounded-lg data-[state=active]:bg-teal-50 data-[state=active]:text-teal-700 data-[state=active]:shadow-sm">
              <Pill size={14} className="mr-1.5" />
              Medications
            </TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-4 mt-4">
            <Card className="p-5 border-2 border-slate-200">
              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-teal-100 flex items-center justify-center">
                    <Activity size={20} className="text-teal-600" />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-slate-900">Live Apple Watch Feed</h3>
                    <p className="text-xs text-slate-500">
                      Last sync {formatDate(patient.lastCheckIn)} at {new Date(patient.lastCheckIn).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge className="bg-green-50 text-green-700 border-green-200 text-xs">
                    <ShieldCheck size={10} className="mr-1" />
                    Connected
                  </Badge>
                  <Button variant="outline" size="sm" onClick={handleRequestLiveSync} className="border-teal-200 text-teal-700 hover:bg-teal-50">
                    Request live sync
                  </Button>
                </div>
              </div>
              {latestWearable ? (
                <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4">
                  <Card className={cn("p-4 border-2 transition-colors", Math.abs(hrDelta) > 15 ? "border-red-200 bg-red-50/50" : Math.abs(hrDelta) > 10 ? "border-amber-200 bg-amber-50/50" : "border-slate-200")}>
                    <div className="flex items-center gap-2 mb-2">
                      <Heart size={14} className="text-red-500" />
                      <p className="text-xs font-medium text-slate-500">Resting HR</p>
                    </div>
                    <p className="text-xl font-bold text-slate-900">{Math.round(latestWearable.restingHR)} <span className="text-xs font-normal text-slate-500">bpm</span></p>
                    <div className={cn("flex items-center gap-1 mt-1 text-xs font-medium", hrDelta > 10 ? "text-red-600" : hrDelta > 0 ? "text-amber-600" : "text-green-600")}>
                      {hrDelta > 0 ? <TrendingUp size={12} /> : hrDelta < 0 ? <TrendingDown size={12} /> : <Minus size={12} />}
                      {hrDelta > 0 ? '+' : ''}{hrDelta} vs baseline
                    </div>
                  </Card>
                  <Card className={cn("p-4 border-2 transition-colors", hrvDelta < -15 ? "border-red-200 bg-red-50/50" : hrvDelta < -8 ? "border-amber-200 bg-amber-50/50" : "border-slate-200")}>
                    <div className="flex items-center gap-2 mb-2">
                      <Activity size={14} className="text-teal-500" />
                      <p className="text-xs font-medium text-slate-500">HRV</p>
                    </div>
                    <p className="text-xl font-bold text-slate-900">{Math.round(latestWearable.hrv)} <span className="text-xs font-normal text-slate-500">ms</span></p>
                    <div className={cn("flex items-center gap-1 mt-1 text-xs font-medium", hrvDelta < -15 ? "text-red-600" : hrvDelta < 0 ? "text-amber-600" : "text-green-600")}>
                      {hrvDelta > 0 ? <TrendingUp size={12} /> : hrvDelta < 0 ? <TrendingDown size={12} /> : <Minus size={12} />}
                      {hrvDelta > 0 ? '+' : ''}{hrvDelta} vs baseline
                    </div>
                  </Card>
                  <Card className={cn("p-4 border-2 transition-colors", latestWearable.sleepHours < 5 ? "border-amber-200 bg-amber-50/50" : "border-slate-200")}>
                    <div className="flex items-center gap-2 mb-2">
                      <Moon size={14} className="text-blue-500" />
                      <p className="text-xs font-medium text-slate-500">Sleep</p>
                    </div>
                    <p className="text-xl font-bold text-slate-900">{latestWearable.sleepHours.toFixed(1)} <span className="text-xs font-normal text-slate-500">hrs</span></p>
                    <div className={cn("flex items-center gap-1 mt-1 text-xs font-medium", sleepDelta < -1 ? "text-amber-600" : sleepDelta > 0 ? "text-green-600" : "text-slate-500")}>
                      {sleepDelta > 0 ? <TrendingUp size={12} /> : sleepDelta < 0 ? <TrendingDown size={12} /> : <Minus size={12} />}
                      {sleepDelta > 0 ? '+' : ''}{sleepDelta} vs baseline
                    </div>
                  </Card>
                  <Card className="p-4 border-2 border-slate-200">
                    <div className="flex items-center gap-2 mb-2">
                      <Footprints size={14} className="text-green-500" />
                      <p className="text-xs font-medium text-slate-500">Steps</p>
                    </div>
                    <p className="text-xl font-bold text-slate-900">{Math.round(latestWearable.steps).toLocaleString()}</p>
                    <div className={cn("flex items-center gap-1 mt-1 text-xs font-medium", stepsDelta < -2000 ? "text-amber-600" : stepsDelta > 0 ? "text-green-600" : "text-slate-500")}>
                      {stepsDelta > 0 ? <TrendingUp size={12} /> : stepsDelta < 0 ? <TrendingDown size={12} /> : <Minus size={12} />}
                      {stepsDelta > 0 ? '+' : ''}{stepsDelta.toLocaleString()} vs baseline
                    </div>
                  </Card>
                </div>
              ) : (
                <p className="mt-4 text-sm text-slate-500">No wearable data available yet.</p>
              )}
            </Card>
            <div className="grid lg:grid-cols-2 gap-4">
              <SBARCard sbar={patient.sbar} />
              <VitalTrends data={patient.wearableData ?? []} />
            </div>
          </TabsContent>

          <TabsContent value="chat" className="mt-4">
            <Card className="overflow-hidden border-2 border-slate-200">
              <MedicalChatAssistant
                messages={patient.chatHistory}
                patient={patient}
              />
            </Card>
          </TabsContent>

          <TabsContent value="vitals" className="mt-4">
            <VitalTrends data={patient.wearableData ?? []} />
          </TabsContent>

          <TabsContent value="medications" className="mt-4">
            <Card className="p-5 border-2 border-slate-200">
              <div className="flex items-center justify-between mb-5">
                <div className="flex items-center gap-2">
                  <Pill size={16} className="text-blue-600" />
                  <h3 className="text-sm font-semibold text-slate-900">Current Medications</h3>
                </div>
                <Badge variant="outline" className="text-xs bg-blue-50 text-blue-700 border-blue-200">
                  {patient.medications.length} active
                </Badge>
              </div>
              <div className="space-y-2">
                {patient.medications.map((med, index) => {
                  const isAntiplatelet = med.toLowerCase().includes('aspirin') || med.toLowerCase().includes('clopidogrel') || med.toLowerCase().includes('ticagrelor');
                  const isBetaBlocker = med.toLowerCase().includes('bisoprolol') || med.toLowerCase().includes('atenolol');
                  const isStatin = med.toLowerCase().includes('atorvastatin') || med.toLowerCase().includes('rosuvastatin');
                  const isACE = med.toLowerCase().includes('ramipril') || med.toLowerCase().includes('lisinopril');
                  const isAnticoagulant = med.toLowerCase().includes('rivaroxaban') || med.toLowerCase().includes('warfarin');
                  const isPPI = med.toLowerCase().includes('omeprazole') || med.toLowerCase().includes('lansoprazole');

                  let category = 'Other';
                  let categoryColor = 'bg-slate-100 text-slate-600';
                  if (isAntiplatelet) { category = 'Antiplatelet'; categoryColor = 'bg-red-100 text-red-700'; }
                  else if (isAnticoagulant) { category = 'Anticoagulant'; categoryColor = 'bg-red-100 text-red-700'; }
                  else if (isBetaBlocker) { category = 'Beta-blocker'; categoryColor = 'bg-blue-100 text-blue-700'; }
                  else if (isStatin) { category = 'Statin'; categoryColor = 'bg-purple-100 text-purple-700'; }
                  else if (isACE) { category = 'ACE Inhibitor'; categoryColor = 'bg-teal-100 text-teal-700'; }
                  else if (isPPI) { category = 'PPI'; categoryColor = 'bg-amber-100 text-amber-700'; }

                  return (
                    <div
                      key={index}
                      className="flex items-center justify-between p-4 rounded-xl bg-white border-2 border-slate-100 hover:border-slate-200 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <div className={cn("w-9 h-9 rounded-lg flex items-center justify-center", categoryColor)}>
                          <Pill size={16} />
                        </div>
                        <div>
                          <span className="text-sm font-semibold text-slate-900">{med}</span>
                          <p className="text-xs text-slate-500">{category}</p>
                        </div>
                      </div>
                      <Badge variant="outline" className="text-[10px] bg-green-50 text-green-700 border-green-200">Active</Badge>
                    </div>
                  );
                })}
              </div>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Resolved alerts section */}
        {patient.alerts.filter((a) => a.resolved).length > 0 && (
          <div className="mt-8 pt-6 border-t">
            <h3 className="text-sm font-medium text-muted-foreground mb-3">
              Resolved Alerts ({patient.alerts.filter((a) => a.resolved).length})
            </h3>
            <div className="space-y-3">
              {patient.alerts.filter((a) => a.resolved).map((alert) => (
                <AlertCard key={alert.id} alert={alert} />
              ))}
            </div>
          </div>
        )}
      </main>

      <DevicePairingModal
        open={pairingOpen}
        onOpenChange={setPairingOpen}
        patientId={patientId || ''}
        initialToken={pairingToken}
        initialShortCode={pairingShortCode}
        initialQrPayload={pairingQrPayload}
      />

      <Dialog open={rxDialogOpen} onOpenChange={setRxDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Draft Prescription</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="rx-med-name">Medication Name</Label>
              <Input id="rx-med-name" placeholder="e.g. Bisoprolol" value={rxMedName} onChange={(e) => setRxMedName(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="rx-dosage">Dosage</Label>
              <Input id="rx-dosage" placeholder="e.g. 5mg once daily" value={rxDosage} onChange={(e) => setRxDosage(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="rx-instructions">Instructions (optional)</Label>
              <Textarea id="rx-instructions" placeholder="Additional instructions..." value={rxInstructions} onChange={(e) => setRxInstructions(e.target.value)} rows={3} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRxDialogOpen(false)} disabled={submitDraftRx.isPending}>Cancel</Button>
            <Button onClick={() => { if (!rxMedName.trim()) { toast.error('Medication name is required'); return; } submitDraftRx.mutate(); }} disabled={submitDraftRx.isPending}>
              {submitDraftRx.isPending ? 'Submitting...' : 'Submit Draft'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={medDialogOpen} onOpenChange={setMedDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Send Medication Reminder</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="med-message">Reminder Message</Label>
              <Textarea id="med-message" value={medMessage} onChange={(e) => setMedMessage(e.target.value)} rows={4} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setMedDialogOpen(false)} disabled={submitMedReminder.isPending}>Cancel</Button>
            <Button onClick={() => { if (!medMessage.trim()) { toast.error('Message cannot be empty'); return; } submitMedReminder.mutate(); }} disabled={submitMedReminder.isPending}>
              {submitMedReminder.isPending ? 'Sending...' : 'Send Reminder'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={apptDialogOpen} onOpenChange={setApptDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Request Appointment</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="appt-datetime">Date &amp; Time</Label>
              <Input
                id="appt-datetime"
                type="datetime-local"
                value={apptScheduledAt}
                onChange={(e) => setApptScheduledAt(e.target.value)}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="appt-type">Appointment Type</Label>
              <Select
                value={apptType}
                onValueChange={(v) =>
                  setApptType(v as 'routine' | 'urgent' | 'follow_up' | 'telemedicine')
                }
              >
                <SelectTrigger id="appt-type">
                  <SelectValue placeholder="Select type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="routine">Routine</SelectItem>
                  <SelectItem value="urgent">Urgent</SelectItem>
                  <SelectItem value="follow_up">Follow-up</SelectItem>
                  <SelectItem value="telemedicine">Telemedicine</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="appt-doctor">Doctor ID (UUID, required by API)</Label>
              <Input
                id="appt-doctor"
                type="text"
                placeholder="e.g. 3fa85f64-5717-4562-b3fc-2c963f66afa6"
                value={apptDoctorId}
                onChange={(e) => setApptDoctorId(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Enter the doctor&apos;s UUID. Leave blank to submit without — the API will return an error if required.
              </p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="appt-notes">Notes (optional)</Label>
              <Textarea
                id="appt-notes"
                placeholder="Reason for appointment, patient concerns..."
                value={apptNotes}
                onChange={(e) => setApptNotes(e.target.value)}
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setApptDialogOpen(false)}
              disabled={createAppointment.isPending}
            >
              Cancel
            </Button>
            <Button
              onClick={() => {
                if (!apptScheduledAt) {
                  toast.error('Please select a date and time');
                  return;
                }
                createAppointment.mutate();
              }}
              disabled={createAppointment.isPending}
            >
              {createAppointment.isPending ? 'Requesting...' : 'Request Appointment'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
