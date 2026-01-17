import { useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { applyResolvedAlerts, getPatientById, mockPatients } from '@/data/mockPatients';
import { DashboardHeader } from '@/components/DashboardHeader';
import { TriageBadge } from '@/components/TriageBadge';
import { VitalTrends } from '@/components/VitalTrends';
import { ChatHistory } from '@/components/ChatHistory';
import { SBARCard } from '@/components/SBARCard';
import { AlertCard } from '@/components/AlertCard';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  ArrowLeft, 
  Calendar, 
  Phone, 
  MessageSquare, 
  Pill,
  FileText,
  Clock,
  User
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { useAlerts } from '@/context/AlertsContext';

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

  const clinicianName = 'Dr. X';
  const pharmacyName = 'CityCare Pharmacy';

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
              <Button variant="outline" size="sm">
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
          <Card className="p-3">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <Clock size={14} />
              <span className="text-xs font-medium">Discharged</span>
            </div>
            <p className="text-sm font-semibold">{formatDate(patient.dischargeDate)}</p>
          </Card>
          <Card className="p-3">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <Calendar size={14} />
              <span className="text-xs font-medium">Days Post-Discharge</span>
            </div>
            <p className="text-sm font-semibold">
              {Math.floor((new Date().getTime() - new Date(patient.dischargeDate).getTime()) / (1000 * 60 * 60 * 24))}
            </p>
          </Card>
          <Card className="p-3">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <FileText size={14} />
              <span className="text-xs font-medium">Wellbeing Score</span>
            </div>
            <p className="text-sm font-semibold">{patient.wellbeingScore}/10</p>
          </Card>
          <Card className="p-3">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <Pill size={14} />
              <span className="text-xs font-medium">Medications</span>
            </div>
            <p className="text-sm font-semibold">{patient.medications.length} active</p>
          </Card>
        </div>

        <div className="grid gap-3 md:grid-cols-2 mb-6">
          <Card className="p-4">
            <h3 className="text-sm font-semibold">Care Actions</h3>
            <p className="text-xs text-muted-foreground">
              Use these actions to coordinate prescriptions, follow-ups, and support.
            </p>
            <div className="flex flex-wrap gap-2 mt-4">
              <Button variant="outline" size="sm" onClick={handleCallClinician}>
                <Phone size={14} className="mr-1.5" />
                Call {clinicianName}
              </Button>
              <Button variant="outline" size="sm" onClick={handleDraftPrescription}>
                <FileText size={14} className="mr-1.5" />
                Draft Prescription
              </Button>
              <Button variant="outline" size="sm" onClick={handleSendMedication}>
                <Pill size={14} className="mr-1.5" />
                Send Medication
              </Button>
              <Button variant="outline" size="sm" onClick={handleLogComplaint}>
                <MessageSquare size={14} className="mr-1.5" />
                Log Complaint
              </Button>
            </div>
          </Card>
          <Card className="p-4">
            <h3 className="text-sm font-semibold">Care Coordination</h3>
            <div className="mt-3 space-y-2 text-sm text-muted-foreground">
              <p>Primary clinician: {clinicianName}</p>
              <p>Preferred pharmacy: {pharmacyName}</p>
              <p>Last wearable update: {formatDate(patient.lastCheckIn)} at {new Date(patient.lastCheckIn).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}</p>
            </div>
          </Card>
        </div>

        {/* Main content tabs */}
        <Tabs defaultValue="overview" className="space-y-4">
          <TabsList className="bg-secondary/50">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="chat">Chat History</TabsTrigger>
            <TabsTrigger value="vitals">Vital Trends</TabsTrigger>
            <TabsTrigger value="medications">Medications</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-4 mt-4">
            <div className="grid lg:grid-cols-2 gap-4">
              <SBARCard sbar={patient.sbar} />
              <VitalTrends data={patient.wearableData} />
            </div>
          </TabsContent>

          <TabsContent value="chat" className="mt-4">
            <Card className="max-h-[600px] overflow-y-auto scrollbar-thin">
              <div className="sticky top-0 bg-card/95 backdrop-blur-sm px-4 py-3 border-b z-10">
                <h3 className="text-sm font-medium">Today's Conversation</h3>
                <p className="text-xs text-muted-foreground">
                  {patient.chatHistory.length} messages
                </p>
              </div>
              <ChatHistory messages={patient.chatHistory} />
            </Card>
          </TabsContent>

          <TabsContent value="vitals" className="mt-4">
            <VitalTrends data={patient.wearableData} />
          </TabsContent>

          <TabsContent value="medications" className="mt-4">
            <Card className="p-4">
              <h3 className="text-sm font-semibold mb-4">Current Medications</h3>
              <div className="space-y-2">
                {patient.medications.map((med, index) => (
                  <div
                    key={index}
                    className="flex items-center gap-3 p-3 rounded-lg bg-secondary/50"
                  >
                    <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                      <Pill size={16} className="text-primary" />
                    </div>
                    <span className="text-sm font-medium">{med}</span>
                  </div>
                ))}
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
