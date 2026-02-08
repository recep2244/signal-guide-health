import { useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { applyResolvedAlerts, getPatientById, mockPatients } from '@/data/mockPatients';
import { DashboardHeader } from '@/components/DashboardHeader';
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
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { useAlerts } from '@/context/AlertsContext';
import { calculateBaseline } from '@/data/mockPatients';

export default function PatientDetail() {
  const { patientId } = useParams<{ patientId: string }>();
  const navigate = useNavigate();
  const { resolvedAlertIds, resolveAlert } = useAlerts();
  const patient = useMemo(() => {
    const patients = applyResolvedAlerts(mockPatients, resolvedAlertIds);
    return getPatientById(patientId || '', patients);
  }, [patientId, resolvedAlertIds]);

  if (!patient) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-xl font-semibold mb-2">Patient not found</h1>
          <Button onClick={() => navigate('/dashboard')}>Return to Dashboard</Button>
        </div>
      </div>
    );
  }

  const handleResolveAlert = (alertId: string) => {
    resolveAlert(alertId);
    toast.success('Alert marked as resolved');
  };

  const handleRequestAppointment = () => {
    toast.success('Appointment request sent to scheduling team');
  };

  const handleContactPatient = () => {
    toast.info('Opening secure messaging...');
  };

  const clinicianName = 'Dr. Sarah Mitchell';
  const pharmacyName = 'CityCare Pharmacy';
  const latestWearable = patient.wearableData[patient.wearableData.length - 1];
  const baseline = calculateBaseline(patient.wearableData);
  const hrDelta = Math.round(latestWearable.restingHR - baseline.avgRestingHR);
  const hrvDelta = Math.round(latestWearable.hrv - baseline.avgHRV);
  const sleepDelta = +(latestWearable.sleepHours - baseline.avgSleepHours).toFixed(1);
  const stepsDelta = Math.round(latestWearable.steps - baseline.avgSteps);

  const handleCallClinician = () => {
    toast.info(`Calling ${clinicianName}...`);
  };

  const handleLogComplaint = () => {
    toast.success('Complaint logged and routed to patient experience');
  };

  const handleDraftPrescription = () => {
    toast.success('Prescription draft created for clinician review');
  };

  const handleSendMedication = () => {
    toast.success(`Medication order sent to ${pharmacyName}`);
  };

  const handleRequestLiveSync = () => {
    toast.success('Live wearable sync requested');
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  };

  const unresolvedAlerts = patient.alerts.filter((a) => !a.resolved);

  return (
    <div className="min-h-screen bg-background">
      <DashboardHeader unreadAlerts={unresolvedAlerts.length} />

      <main className="container mx-auto px-4 py-6">
        {/* Back button and patient header */}
        <div className="mb-6">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate('/dashboard')}
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
              <Button variant="outline" size="sm" onClick={() => toast.info(`Calling ${patient.name}...`)}>
                <Phone size={16} className="mr-1.5" />
                Call
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
              <div className="flex items-center justify-between py-2 border-b border-slate-100">
                <span className="text-xs font-medium text-slate-500">Preferred pharmacy</span>
                <span className="text-sm font-semibold text-slate-900">{pharmacyName}</span>
              </div>
              <div className="flex items-center justify-between py-2">
                <span className="text-xs font-medium text-slate-500">Last wearable update</span>
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
            </Card>
            <div className="grid lg:grid-cols-2 gap-4">
              <SBARCard sbar={patient.sbar} />
              <VitalTrends data={patient.wearableData} />
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
            <VitalTrends data={patient.wearableData} />
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
    </div>
  );
}
