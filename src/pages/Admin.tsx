import { useState } from "react";
import { Link } from "react-router-dom";
import {
  Users,
  Activity,
  Shield,
  Settings,
  FileText,
  AlertTriangle,
  TrendingUp,
  TrendingDown,
  Clock,
  Heart,
  ArrowLeft,
  RefreshCw,
  Search,
  MoreHorizontal,
  UserPlus,
  Download,
  Filter,
  Building2,
  Globe,
  Plug,
  CheckCircle2,
  Circle,
  ArrowRight,
  BarChart3,
  Zap,
  Server,
  Database,
  Smartphone,
  MessageCircle,
  Wifi,
  Copy,
  ExternalLink,
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

// Mock data
const mockUsers = [
  { id: "usr-001", name: "Dr. Sarah Mitchell", email: "s.mitchell@cardiowatch.nhs.uk", role: "clinician", status: "active", lastActive: "2 minutes ago", patientsAssigned: 24 },
  { id: "usr-002", name: "Dr. James Wilson", email: "j.wilson@cardiowatch.nhs.uk", role: "clinician", status: "active", lastActive: "15 minutes ago", patientsAssigned: 18 },
  { id: "usr-003", name: "Nurse Emma Thompson", email: "e.thompson@cardiowatch.nhs.uk", role: "clinician", status: "active", lastActive: "1 hour ago", patientsAssigned: 32 },
  { id: "usr-004", name: "Admin John Smith", email: "j.smith@cardiowatch.nhs.uk", role: "admin", status: "active", lastActive: "Just now", patientsAssigned: 0 },
  { id: "usr-005", name: "Dr. Lisa Chen", email: "l.chen@cardiowatch.nhs.uk", role: "clinician", status: "inactive", lastActive: "3 days ago", patientsAssigned: 12 },
];

const mockAuditLogs = [
  { id: "log-001", timestamp: "2026-01-18 13:45:22", user: "Dr. Sarah Mitchell", action: "PATIENT_VIEW", resource: "Patient: Margaret Thompson", ip: "192.168.1.45", status: "success" },
  { id: "log-002", timestamp: "2026-01-18 13:42:15", user: "Dr. James Wilson", action: "ALERT_RESOLVE", resource: "Alert: pt-002-alert-01", ip: "192.168.1.67", status: "success" },
  { id: "log-003", timestamp: "2026-01-18 13:38:44", user: "Admin John Smith", action: "USER_UPDATE", resource: "User: Dr. Lisa Chen", ip: "192.168.1.12", status: "success" },
  { id: "log-004", timestamp: "2026-01-18 13:35:10", user: "Nurse Emma Thompson", action: "MESSAGE_SEND", resource: "Patient: David Chen", ip: "192.168.1.89", status: "success" },
  { id: "log-005", timestamp: "2026-01-18 13:30:55", user: "Unknown", action: "LOGIN_ATTEMPT", resource: "Auth System", ip: "203.45.67.89", status: "failed" },
  { id: "log-006", timestamp: "2026-01-18 13:28:30", user: "Dr. Sarah Mitchell", action: "WEARABLE_SYNC", resource: "Patient: Sarah Okonkwo", ip: "192.168.1.45", status: "success" },
];

const mockHospitals = [
  { id: "h-001", name: "Midlands Heart Centre", region: "West Midlands", status: "live", patients: 128, clinicians: 12, uptime: 99.9, lastSync: "2 min ago" },
  { id: "h-002", name: "Royal London Cardiac Unit", region: "London", status: "onboarding", patients: 0, clinicians: 8, uptime: 0, lastSync: "Pending" },
  { id: "h-003", name: "Leeds Teaching Hospitals", region: "Yorkshire", status: "pilot", patients: 34, clinicians: 4, uptime: 99.7, lastSync: "5 min ago" },
  { id: "h-004", name: "Edinburgh Royal Infirmary", region: "Scotland", status: "interested", patients: 0, clinicians: 0, uptime: 0, lastSync: "N/A" },
];

const integrationSteps = [
  { step: 1, title: "Sign Data Processing Agreement", description: "GDPR-compliant DPA and data sharing agreement between trust and CardioWatch", status: "complete" as const },
  { step: 2, title: "Technical Environment Setup", description: "Provision cloud instance, configure NHS N3/HSCN connectivity, SSL certificates", status: "complete" as const },
  { step: 3, title: "EHR/EPR Integration", description: "HL7 FHIR API integration with hospital electronic health records system", status: "active" as const },
  { step: 4, title: "Wearable Device Provisioning", description: "Configure Apple Watch fleet, set up HealthKit data pipelines", status: "pending" as const },
  { step: 5, title: "Clinical Workflow Training", description: "Train clinicians on triage dashboard, alert management, and SBAR workflows", status: "pending" as const },
  { step: 6, title: "Go-Live & Monitoring", description: "Phased rollout with real patients, 24/7 monitoring, weekly review cycles", status: "pending" as const },
];

const usageMetrics = {
  dailyActiveUsers: 24,
  dailyCheckIns: 342,
  avgResponseTime: "9 min",
  alertsResolved: 156,
  wearablesSynced: 98,
  messagesExchanged: 1247,
  readmissionReduction: 24,
  patientSatisfaction: 92,
  dataPointsCollected: "2.4M",
  apiCalls24h: "48,291",
  storageUsed: "12.4 GB",
  bandwidthUsed: "3.2 GB",
};

export default function Admin() {
  const [userSearch, setUserSearch] = useState("");
  const [logFilter, setLogFilter] = useState("all");
  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleRefresh = () => {
    setIsRefreshing(true);
    setTimeout(() => setIsRefreshing(false), 1000);
  };

  const filteredUsers = mockUsers.filter(
    (user) =>
      user.name.toLowerCase().includes(userSearch.toLowerCase()) ||
      user.email.toLowerCase().includes(userSearch.toLowerCase())
  );

  const filteredLogs =
    logFilter === "all"
      ? mockAuditLogs
      : mockAuditLogs.filter((log) => log.status === logFilter);

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white">
      {/* Header */}
      <header className="sticky top-0 z-50 w-full border-b bg-white/95 backdrop-blur-lg shadow-sm">
        <div className="container mx-auto px-4 lg:px-8 flex h-16 items-center justify-between">
          <div className="flex items-center gap-4">
            <Link to="/dashboard" className="flex items-center gap-2 text-slate-500 hover:text-teal-600 transition-colors text-sm">
              <ArrowLeft className="h-4 w-4" />
              Dashboard
            </Link>
            <Separator orientation="vertical" className="h-6" />
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500 to-purple-600 flex items-center justify-center shadow-lg shadow-purple-500/20">
                <Shield className="h-5 w-5 text-white" />
              </div>
              <div>
                <h1 className="text-base font-bold text-slate-900">Admin Console</h1>
                <p className="text-xs text-slate-500">Hospital Management & Analytics</p>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={handleRefresh} disabled={isRefreshing} className="border-slate-200">
              <RefreshCw className={`h-4 w-4 mr-2 ${isRefreshing ? "animate-spin" : ""}`} />
              Refresh
            </Button>
            <Button size="sm" className="bg-teal-600 hover:bg-teal-700 text-white shadow-lg shadow-teal-600/20">
              <Download className="h-4 w-4 mr-2" />
              Export Report
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 lg:px-8 py-8 space-y-8">
        {/* Stats Overview - Improved */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="border-2 border-slate-200 hover:border-teal-200 transition-colors">
            <CardContent className="p-5">
              <div className="flex items-center justify-between mb-3">
                <div className="w-10 h-10 rounded-xl bg-teal-100 flex items-center justify-center">
                  <Users className="h-5 w-5 text-teal-600" />
                </div>
                <Badge className="bg-green-50 text-green-700 border-green-200 text-xs">+3 this week</Badge>
              </div>
              <p className="text-2xl font-bold text-slate-900">28</p>
              <p className="text-xs text-slate-500 mt-1">Total Users <span className="text-green-600 font-medium">24 active</span></p>
            </CardContent>
          </Card>
          <Card className="border-2 border-slate-200 hover:border-teal-200 transition-colors">
            <CardContent className="p-5">
              <div className="flex items-center justify-between mb-3">
                <div className="w-10 h-10 rounded-xl bg-red-100 flex items-center justify-center">
                  <Heart className="h-5 w-5 text-red-600" />
                </div>
                <Badge className="bg-amber-50 text-amber-700 border-amber-200 text-xs">7 alerts</Badge>
              </div>
              <p className="text-2xl font-bold text-slate-900">128</p>
              <p className="text-xs text-slate-500 mt-1">Patients Monitored</p>
            </CardContent>
          </Card>
          <Card className="border-2 border-slate-200 hover:border-teal-200 transition-colors">
            <CardContent className="p-5">
              <div className="flex items-center justify-between mb-3">
                <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center">
                  <Clock className="h-5 w-5 text-blue-600" />
                </div>
                <Badge className="bg-green-50 text-green-700 border-green-200 text-xs">
                  <TrendingDown className="h-3 w-3 mr-1" />-2m
                </Badge>
              </div>
              <p className="text-2xl font-bold text-slate-900">9 min</p>
              <p className="text-xs text-slate-500 mt-1">Avg Response Time</p>
            </CardContent>
          </Card>
          <Card className="border-2 border-green-200 bg-green-50/30">
            <CardContent className="p-5">
              <div className="flex items-center justify-between mb-3">
                <div className="w-10 h-10 rounded-xl bg-green-100 flex items-center justify-center">
                  <TrendingDown className="h-5 w-5 text-green-600" />
                </div>
                <Badge className="bg-green-50 text-green-700 border-green-200 text-xs">Target: 20%</Badge>
              </div>
              <p className="text-2xl font-bold text-green-700">-24%</p>
              <p className="text-xs text-slate-500 mt-1">Readmission Reduction</p>
            </CardContent>
          </Card>
        </div>

        {/* Main Content Tabs - Enhanced */}
        <Tabs defaultValue="hospitals" className="space-y-6">
          <TabsList className="bg-white border-2 border-slate-200 p-1.5 rounded-xl shadow-sm w-full lg:w-auto">
            <TabsTrigger value="hospitals" className="rounded-lg data-[state=active]:bg-teal-50 data-[state=active]:text-teal-700 gap-2">
              <Building2 className="h-4 w-4" />
              Hospital Integration
            </TabsTrigger>
            <TabsTrigger value="usage" className="rounded-lg data-[state=active]:bg-teal-50 data-[state=active]:text-teal-700 gap-2">
              <BarChart3 className="h-4 w-4" />
              Usage Analytics
            </TabsTrigger>
            <TabsTrigger value="users" className="rounded-lg data-[state=active]:bg-teal-50 data-[state=active]:text-teal-700 gap-2">
              <Users className="h-4 w-4" />
              Users
            </TabsTrigger>
            <TabsTrigger value="audit" className="rounded-lg data-[state=active]:bg-teal-50 data-[state=active]:text-teal-700 gap-2">
              <FileText className="h-4 w-4" />
              Audit
            </TabsTrigger>
            <TabsTrigger value="settings" className="rounded-lg data-[state=active]:bg-teal-50 data-[state=active]:text-teal-700 gap-2">
              <Settings className="h-4 w-4" />
              Settings
            </TabsTrigger>
          </TabsList>

          {/* Hospital Integration Tab - NEW */}
          <TabsContent value="hospitals" className="space-y-6">
            {/* Connected Hospitals */}
            <Card className="border-2 border-slate-200">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <Globe className="h-5 w-5 text-teal-600" />
                      Connected Hospitals
                    </CardTitle>
                    <CardDescription>NHS Trusts and healthcare organisations using CardioWatch</CardDescription>
                  </div>
                  <Button className="bg-teal-600 hover:bg-teal-700 text-white" onClick={() => toast.success("Onboarding form sent to new hospital")}>
                    <Building2 className="h-4 w-4 mr-2" />
                    Onboard New Hospital
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {mockHospitals.map((hospital) => (
                    <div key={hospital.id} className={cn(
                      "flex items-center justify-between p-4 rounded-xl border-2 transition-colors",
                      hospital.status === "live" ? "border-green-200 bg-green-50/30" :
                      hospital.status === "pilot" ? "border-blue-200 bg-blue-50/30" :
                      hospital.status === "onboarding" ? "border-amber-200 bg-amber-50/30" :
                      "border-slate-200"
                    )}>
                      <div className="flex items-center gap-4">
                        <div className={cn(
                          "w-12 h-12 rounded-xl flex items-center justify-center",
                          hospital.status === "live" ? "bg-green-100" :
                          hospital.status === "pilot" ? "bg-blue-100" :
                          hospital.status === "onboarding" ? "bg-amber-100" : "bg-slate-100"
                        )}>
                          <Building2 className={cn(
                            "h-6 w-6",
                            hospital.status === "live" ? "text-green-600" :
                            hospital.status === "pilot" ? "text-blue-600" :
                            hospital.status === "onboarding" ? "text-amber-600" : "text-slate-500"
                          )} />
                        </div>
                        <div>
                          <h4 className="font-semibold text-slate-900">{hospital.name}</h4>
                          <p className="text-xs text-slate-500">{hospital.region}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-6">
                        {hospital.patients > 0 && (
                          <div className="text-center">
                            <p className="text-lg font-bold text-slate-900">{hospital.patients}</p>
                            <p className="text-[10px] text-slate-500">Patients</p>
                          </div>
                        )}
                        {hospital.clinicians > 0 && (
                          <div className="text-center">
                            <p className="text-lg font-bold text-slate-900">{hospital.clinicians}</p>
                            <p className="text-[10px] text-slate-500">Clinicians</p>
                          </div>
                        )}
                        {hospital.uptime > 0 && (
                          <div className="text-center">
                            <p className="text-lg font-bold text-green-600">{hospital.uptime}%</p>
                            <p className="text-[10px] text-slate-500">Uptime</p>
                          </div>
                        )}
                        <Badge className={cn(
                          "capitalize",
                          hospital.status === "live" ? "bg-green-100 text-green-700 border-green-200" :
                          hospital.status === "pilot" ? "bg-blue-100 text-blue-700 border-blue-200" :
                          hospital.status === "onboarding" ? "bg-amber-100 text-amber-700 border-amber-200" :
                          "bg-slate-100 text-slate-700 border-slate-200"
                        )}>
                          {hospital.status === "live" && <CheckCircle2 className="h-3 w-3 mr-1" />}
                          {hospital.status}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Integration Guide */}
            <Card className="border-2 border-teal-200 bg-teal-50/20">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Plug className="h-5 w-5 text-teal-600" />
                  Hospital Integration Guide
                </CardTitle>
                <CardDescription>Step-by-step process to connect a new NHS Trust to CardioWatch</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {integrationSteps.map((item, idx) => (
                    <div key={item.step} className="flex gap-4">
                      <div className="flex flex-col items-center">
                        <div className={cn(
                          "w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold border-2",
                          item.status === "complete" ? "bg-green-100 border-green-300 text-green-700" :
                          item.status === "active" ? "bg-teal-100 border-teal-300 text-teal-700 animate-pulse" :
                          "bg-slate-100 border-slate-200 text-slate-400"
                        )}>
                          {item.status === "complete" ? <CheckCircle2 className="h-5 w-5" /> : item.step}
                        </div>
                        {idx < integrationSteps.length - 1 && (
                          <div className={cn(
                            "w-0.5 flex-1 mt-2",
                            item.status === "complete" ? "bg-green-300" : "bg-slate-200"
                          )} />
                        )}
                      </div>
                      <div className={cn("pb-6 flex-1", item.status === "pending" && "opacity-60")}>
                        <div className="flex items-center gap-2 mb-1">
                          <h4 className="font-semibold text-slate-900 text-sm">{item.title}</h4>
                          {item.status === "active" && (
                            <Badge className="bg-teal-100 text-teal-700 border-teal-200 text-[10px]">In Progress</Badge>
                          )}
                        </div>
                        <p className="text-xs text-slate-600 leading-relaxed">{item.description}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* API & Technical Integration */}
            <div className="grid md:grid-cols-2 gap-4">
              <Card className="border-2 border-slate-200">
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <Server className="h-4 w-4 text-blue-600" />
                    API Endpoints
                  </CardTitle>
                  <CardDescription>REST API for hospital EHR/EPR integration</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  {[
                    { method: "POST", path: "/api/v1/patients", desc: "Register new patient" },
                    { method: "GET", path: "/api/v1/patients/:id/vitals", desc: "Get patient vitals" },
                    { method: "POST", path: "/api/v1/alerts", desc: "Create clinical alert" },
                    { method: "GET", path: "/api/v1/wearables/sync", desc: "Sync wearable data" },
                    { method: "POST", path: "/api/v1/messages", desc: "Send patient message" },
                  ].map((endpoint) => (
                    <div key={endpoint.path} className="flex items-center gap-3 p-2.5 rounded-lg bg-slate-50 hover:bg-slate-100 transition-colors">
                      <Badge variant="outline" className={cn(
                        "text-[10px] font-mono w-12 justify-center",
                        endpoint.method === "POST" ? "border-green-300 text-green-700 bg-green-50" : "border-blue-300 text-blue-700 bg-blue-50"
                      )}>
                        {endpoint.method}
                      </Badge>
                      <code className="text-xs font-mono text-slate-700 flex-1">{endpoint.path}</code>
                      <span className="text-[10px] text-slate-500 hidden sm:inline">{endpoint.desc}</span>
                    </div>
                  ))}
                  <Button variant="outline" className="w-full mt-2 border-slate-200" onClick={() => toast.info("Opening API documentation...")}>
                    <ExternalLink className="h-4 w-4 mr-2" />
                    View Full API Docs
                  </Button>
                </CardContent>
              </Card>

              <Card className="border-2 border-slate-200">
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <Database className="h-4 w-4 text-purple-600" />
                    Data Standards & Compliance
                  </CardTitle>
                  <CardDescription>Supported standards for NHS integration</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  {[
                    { name: "HL7 FHIR R4", desc: "Healthcare data interchange", status: "Supported" },
                    { name: "NHS Spine / PDS", desc: "Patient Demographics Service", status: "Ready" },
                    { name: "SNOMED CT", desc: "Clinical terminology coding", status: "Supported" },
                    { name: "NHS Number Validation", desc: "Modulus 11 check digit", status: "Supported" },
                    { name: "EMIS Web API", desc: "GP clinical system integration", status: "Supported" },
                    { name: "SystmOne (TPP)", desc: "GP system integration", status: "Ready" },
                    { name: "EPIC FHIR", desc: "Secondary care EHR integration", status: "In Progress" },
                    { name: "NHS MESH", desc: "Secure messaging service", status: "Ready" },
                    { name: "DCB0129 Clinical Safety", desc: "Clinical risk management standard", status: "Certified" },
                    { name: "DCB0160 Clinical Safety", desc: "Manufacturer safety standard", status: "Certified" },
                    { name: "NHS DSPT", desc: "Data Security and Protection Toolkit", status: "Certified" },
                    { name: "DICOM (Future)", desc: "Medical imaging data", status: "Roadmap" },
                  ].map((standard) => (
                    <div key={standard.name} className="flex items-center justify-between p-2.5 rounded-lg bg-slate-50">
                      <div>
                        <p className="text-sm font-medium text-slate-900">{standard.name}</p>
                        <p className="text-[10px] text-slate-500">{standard.desc}</p>
                      </div>
                      <Badge variant="outline" className={cn(
                        "text-[10px]",
                        standard.status === "Supported" ? "border-green-300 text-green-700 bg-green-50" :
                        standard.status === "Ready" ? "border-blue-300 text-blue-700 bg-blue-50" :
                        standard.status === "Certified" ? "border-green-300 text-green-700 bg-green-50" :
                        standard.status === "In Progress" ? "border-amber-300 text-amber-700 bg-amber-50" :
                        "border-slate-300 text-slate-500"
                      )}>
                        {standard.status}
                      </Badge>
                    </div>
                  ))}
                </CardContent>
              </Card>
            </div>

            {/* Clinical Governance */}
            <Card className="border-2 border-green-200 bg-green-50/20">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Shield className="h-5 w-5 text-green-600" />
                  Clinical Governance
                </CardTitle>
                <CardDescription>Regulatory compliance, clinical safety, and governance status</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid md:grid-cols-2 gap-3">
                  {[
                    { item: "DCB0129 Clinical Safety Case", detail: "Clinical risk management for health IT — hazard log maintained and reviewed", done: true },
                    { item: "DCB0160 Manufacturer Standard", detail: "Manufacturer's clinical safety case report submitted to NHS Digital", done: true },
                    { item: "Clinical Safety Officer Appointed", detail: "Dr. A. Patel (GMC 7281943) — responsible for clinical safety governance", done: true },
                    { item: "DTAC Compliance", detail: "Digital Technology Assessment Criteria — clinical safety, data protection, technical security, interoperability, usability & accessibility", done: true },
                    { item: "NHS Digital Certification", detail: "Certification application submitted — awaiting final review panel", done: false },
                    { item: "IG Toolkit (DSPT) Submission", detail: "Data Security and Protection Toolkit — annual submission to NHS Digital", done: true },
                    { item: "MHRA Device Classification", detail: "Class IIa medical device under UK MDR 2002 — UKCA marking obtained", done: true },
                    { item: "IG Training Compliance", detail: "All staff completed annual Information Governance training (100%)", done: false },
                  ].map((row) => (
                    <div key={row.item} className={cn(
                      "flex items-start gap-3 p-3 rounded-xl border-2 transition-colors",
                      row.done ? "border-green-200 bg-white" : "border-amber-200 bg-amber-50/30"
                    )}>
                      <div className={cn(
                        "w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5",
                        row.done ? "bg-green-100" : "bg-amber-100"
                      )}>
                        {row.done ? (
                          <CheckCircle2 className="h-4 w-4 text-green-600" />
                        ) : (
                          <Circle className="h-4 w-4 text-amber-500" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-0.5">
                          <p className="text-sm font-semibold text-slate-900">{row.item}</p>
                          <Badge variant="outline" className={cn(
                            "text-[10px] flex-shrink-0",
                            row.done ? "border-green-300 text-green-700 bg-green-50" : "border-amber-300 text-amber-700 bg-amber-50"
                          )}>
                            {row.done ? "Complete" : "In Progress"}
                          </Badge>
                        </div>
                        <p className="text-[11px] text-slate-500 leading-relaxed">{row.detail}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* International Deployment */}
            <Card className="border-2 border-blue-200 bg-blue-50/20">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Globe className="h-5 w-5 text-blue-600" />
                  International Deployment
                </CardTitle>
                <CardDescription>Global market readiness and regulatory pathway status</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {[
                    {
                      flag: "\uD83C\uDDEC\uD83C\uDDE7",
                      country: "United Kingdom / NHS",
                      status: "Live",
                      statusColor: "green",
                      requirements: "UKCA marked \u2022 NICE compliant \u2022 NHS DSPT certified \u2022 DCB0129/0160 approved",
                    },
                    {
                      flag: "\uD83C\uDDEA\uD83C\uDDFA",
                      country: "European Union",
                      status: "Preparing",
                      statusColor: "amber",
                      requirements: "CE marking under MDR (EU) 2017/745 \u2022 Notified body assessment in progress \u2022 GDPR Art. 9 health data compliance",
                    },
                    {
                      flag: "\uD83C\uDDFA\uD83C\uDDF8",
                      country: "United States",
                      status: "Planning",
                      statusColor: "blue",
                      requirements: "FDA 510(k) pathway identified \u2022 CMS RPM reimbursement codes CPT 99453\u201399458 \u2022 HIPAA BAA template prepared",
                    },
                    {
                      flag: "\uD83C\uDDF8\uD83C\uDDE6",
                      country: "Gulf States (KSA / UAE)",
                      status: "Exploring",
                      statusColor: "slate",
                      requirements: "SFDA medical device registration \u2022 DHA facility approval \u2022 Arabic localisation scoped",
                    },
                    {
                      flag: "\uD83C\uDDE6\uD83C\uDDFA",
                      country: "Australia",
                      status: "Exploring",
                      statusColor: "slate",
                      requirements: "TGA Class IIa device notification pathway \u2022 My Health Record integration assessment",
                    },
                  ].map((market) => (
                    <div key={market.country} className="flex items-center justify-between p-4 rounded-xl border-2 border-slate-200 bg-white hover:border-blue-200 transition-colors">
                      <div className="flex items-center gap-4">
                        <span className="text-2xl">{market.flag}</span>
                        <div>
                          <h4 className="font-semibold text-slate-900 text-sm">{market.country}</h4>
                          <p className="text-[11px] text-slate-500 leading-relaxed max-w-lg">{market.requirements}</p>
                        </div>
                      </div>
                      <Badge variant="outline" className={cn(
                        "text-xs flex-shrink-0 ml-4",
                        market.statusColor === "green" ? "border-green-300 text-green-700 bg-green-50" :
                        market.statusColor === "amber" ? "border-amber-300 text-amber-700 bg-amber-50" :
                        market.statusColor === "blue" ? "border-blue-300 text-blue-700 bg-blue-50" :
                        "border-slate-300 text-slate-600 bg-slate-50"
                      )}>
                        {market.status === "Live" && <CheckCircle2 className="h-3 w-3 mr-1" />}
                        {market.status}
                      </Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Usage Analytics Tab - NEW */}
          <TabsContent value="usage" className="space-y-6">
            {/* Platform Usage */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              {[
                { label: "Daily Check-ins", value: usageMetrics.dailyCheckIns, icon: MessageCircle, color: "teal", change: "+12%" },
                { label: "Wearables Synced", value: usageMetrics.wearablesSynced, icon: Smartphone, color: "blue", change: "+8%" },
                { label: "Alerts Resolved", value: usageMetrics.alertsResolved, icon: CheckCircle2, color: "green", change: "+15%" },
                { label: "Messages Sent", value: usageMetrics.messagesExchanged, icon: MessageCircle, color: "purple", change: "+22%" },
              ].map((metric) => {
                const Icon = metric.icon;
                return (
                  <Card key={metric.label} className="border-2 border-slate-200">
                    <CardContent className="p-5">
                      <div className="flex items-center justify-between mb-2">
                        <Icon className={cn("h-5 w-5", `text-${metric.color}-600`)} />
                        <Badge className="bg-green-50 text-green-700 border-green-200 text-[10px]">{metric.change}</Badge>
                      </div>
                      <p className="text-2xl font-bold text-slate-900">{metric.value.toLocaleString()}</p>
                      <p className="text-xs text-slate-500">{metric.label}</p>
                    </CardContent>
                  </Card>
                );
              })}
            </div>

            {/* Clinical Impact */}
            <Card className="border-2 border-green-200 bg-green-50/20">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="h-5 w-5 text-green-600" />
                  Clinical Impact Metrics
                </CardTitle>
                <CardDescription>Key outcomes demonstrating CardioWatch effectiveness</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid md:grid-cols-4 gap-6">
                  <div className="text-center p-4 rounded-xl bg-white border-2 border-green-200">
                    <p className="text-3xl font-bold text-green-700">-24%</p>
                    <p className="text-sm font-medium text-slate-700 mt-1">Readmission Reduction</p>
                    <p className="text-xs text-slate-500">vs. standard care baseline</p>
                    <Progress value={76} className="mt-3 h-2" />
                  </div>
                  <div className="text-center p-4 rounded-xl bg-white border-2 border-teal-200">
                    <p className="text-3xl font-bold text-teal-700">9 min</p>
                    <p className="text-sm font-medium text-slate-700 mt-1">Avg Escalation Time</p>
                    <p className="text-xs text-slate-500">from alert to clinician action</p>
                    <Progress value={85} className="mt-3 h-2" />
                  </div>
                  <div className="text-center p-4 rounded-xl bg-white border-2 border-blue-200">
                    <p className="text-3xl font-bold text-blue-700">92%</p>
                    <p className="text-sm font-medium text-slate-700 mt-1">Patient Satisfaction</p>
                    <p className="text-xs text-slate-500">survey score (n=128)</p>
                    <Progress value={92} className="mt-3 h-2" />
                  </div>
                  <div className="text-center p-4 rounded-xl bg-white border-2 border-purple-200">
                    <p className="text-3xl font-bold text-purple-700">3.2 hrs</p>
                    <p className="text-sm font-medium text-slate-700 mt-1">Clinician Time Saved</p>
                    <p className="text-xs text-slate-500">per nurse per day</p>
                    <Progress value={70} className="mt-3 h-2" />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* System Health */}
            <div className="grid md:grid-cols-2 gap-4">
              <Card className="border-2 border-slate-200">
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <Zap className="h-4 w-4 text-amber-600" />
                    System Health
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {[
                    { label: "API Response Time", value: "42ms", status: "healthy", percent: 95 },
                    { label: "Database Load", value: "23%", status: "healthy", percent: 23 },
                    { label: "Storage Used", value: "12.4 GB / 100 GB", status: "healthy", percent: 12 },
                    { label: "Bandwidth (24h)", value: "3.2 GB", status: "healthy", percent: 8 },
                  ].map((item) => (
                    <div key={item.label}>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm text-slate-700">{item.label}</span>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-semibold text-slate-900">{item.value}</span>
                          <div className="w-2 h-2 rounded-full bg-green-500" />
                        </div>
                      </div>
                      <Progress value={item.percent} className="h-1.5" />
                    </div>
                  ))}
                </CardContent>
              </Card>

              <Card className="border-2 border-slate-200">
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <Wifi className="h-4 w-4 text-teal-600" />
                    Integration Status
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {[
                    { name: "Apple HealthKit", status: "Connected", icon: Smartphone, color: "green" },
                    { name: "WhatsApp Business", status: "Connected", icon: MessageCircle, color: "green" },
                    { name: "EMIS Web", status: "Connected", icon: Database, color: "green" },
                    { name: "SystmOne / TPP", status: "In Progress", icon: Database, color: "amber" },
                    { name: "EPIC EHR", status: "Planning", icon: Server, color: "blue" },
                    { name: "NHS Spine / MESH", status: "Pending", icon: Globe, color: "amber" },
                    { name: "Fitbit API", status: "Connected", icon: Activity, color: "green" },
                    { name: "Google Fit", status: "Connected", icon: Heart, color: "green" },
                  ].map((integration) => {
                    const Icon = integration.icon;
                    return (
                      <div key={integration.name} className="flex items-center justify-between p-3 rounded-lg bg-slate-50">
                        <div className="flex items-center gap-3">
                          <Icon className="h-4 w-4 text-slate-500" />
                          <span className="text-sm font-medium text-slate-900">{integration.name}</span>
                        </div>
                        <Badge variant="outline" className={cn(
                          "text-xs",
                          integration.color === "green" ? "border-green-300 text-green-700 bg-green-50" :
                          integration.color === "amber" ? "border-amber-300 text-amber-700 bg-amber-50" :
                          "border-blue-300 text-blue-700 bg-blue-50"
                        )}>
                          {integration.status === "Connected" && <CheckCircle2 className="h-3 w-3 mr-1" />}
                          {integration.status}
                        </Badge>
                      </div>
                    );
                  })}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Users Tab */}
          <TabsContent value="users" className="space-y-4">
            <Card className="border-2 border-slate-200">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>User Management</CardTitle>
                    <CardDescription>Manage clinicians, nurses, and admin accounts</CardDescription>
                  </div>
                  <Button className="bg-teal-600 hover:bg-teal-700 text-white">
                    <UserPlus className="h-4 w-4 mr-2" />
                    Add User
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-4 mb-4">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                    <Input
                      placeholder="Search users..."
                      value={userSearch}
                      onChange={(e) => setUserSearch(e.target.value)}
                      className="pl-10 border-2 border-slate-200"
                    />
                  </div>
                </div>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Role</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Patients</TableHead>
                      <TableHead>Last Active</TableHead>
                      <TableHead className="w-[50px]"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredUsers.map((user) => (
                      <TableRow key={user.id}>
                        <TableCell>
                          <div>
                            <p className="font-medium text-slate-900">{user.name}</p>
                            <p className="text-xs text-slate-500">{user.email}</p>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className={cn(
                            user.role === "admin" ? "bg-purple-50 text-purple-700 border-purple-200" : "bg-teal-50 text-teal-700 border-teal-200"
                          )}>
                            {user.role}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className={cn(
                            user.status === "active" ? "bg-green-50 text-green-700 border-green-200" : "bg-red-50 text-red-700 border-red-200"
                          )}>
                            {user.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="font-semibold">{user.patientsAssigned}</TableCell>
                        <TableCell className="text-slate-500 text-sm">{user.lastActive}</TableCell>
                        <TableCell>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon"><MoreHorizontal className="h-4 w-4" /></Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem>View Profile</DropdownMenuItem>
                              <DropdownMenuItem>Edit User</DropdownMenuItem>
                              <DropdownMenuItem>Reset Password</DropdownMenuItem>
                              <DropdownMenuItem className="text-destructive">Deactivate</DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Audit Logs Tab */}
          <TabsContent value="audit" className="space-y-4">
            <Card className="border-2 border-slate-200">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Audit Logs</CardTitle>
                    <CardDescription>System activity and security events</CardDescription>
                  </div>
                  <Select value={logFilter} onValueChange={setLogFilter}>
                    <SelectTrigger className="w-[150px]">
                      <SelectValue placeholder="Filter" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Events</SelectItem>
                      <SelectItem value="success">Success</SelectItem>
                      <SelectItem value="failed">Failed</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Timestamp</TableHead>
                      <TableHead>User</TableHead>
                      <TableHead>Action</TableHead>
                      <TableHead>Resource</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredLogs.map((log) => (
                      <TableRow key={log.id}>
                        <TableCell className="font-mono text-xs">{log.timestamp}</TableCell>
                        <TableCell className="font-medium">{log.user}</TableCell>
                        <TableCell><Badge variant="outline" className="text-[10px]">{log.action}</Badge></TableCell>
                        <TableCell className="text-slate-500 text-sm">{log.resource}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className={cn(
                            log.status === "success" ? "bg-green-50 text-green-700 border-green-200" : "bg-red-50 text-red-700 border-red-200"
                          )}>
                            {log.status}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Settings Tab */}
          <TabsContent value="settings" className="space-y-4">
            <div className="grid md:grid-cols-2 gap-4">
              <Card className="border-2 border-slate-200">
                <CardHeader>
                  <CardTitle className="text-base">System Settings</CardTitle>
                  <CardDescription>General application configuration</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label>Organization Name</Label>
                    <Input defaultValue="Midlands Heart Centre" className="border-2 border-slate-200" />
                  </div>
                  <div className="space-y-2">
                    <Label>Default Timezone</Label>
                    <Select defaultValue="europe-london">
                      <SelectTrigger className="border-2 border-slate-200"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="europe-london">Europe/London (GMT)</SelectItem>
                        <SelectItem value="america-newyork">America/New_York (EST)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <Button className="w-full bg-teal-600 hover:bg-teal-700 text-white">Save Settings</Button>
                </CardContent>
              </Card>

              <Card className="border-2 border-slate-200">
                <CardHeader>
                  <CardTitle className="text-base">Alert Thresholds</CardTitle>
                  <CardDescription>Configure clinical alert parameters</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-2">
                      <Label className="text-xs">HR High (bpm)</Label>
                      <Input type="number" defaultValue="100" className="border-2 border-slate-200" />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs">HR Low (bpm)</Label>
                      <Input type="number" defaultValue="50" className="border-2 border-slate-200" />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs">HRV Critical (ms)</Label>
                      <Input type="number" defaultValue="20" className="border-2 border-slate-200" />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs">Wellbeing Alert</Label>
                      <Input type="number" defaultValue="4" className="border-2 border-slate-200" />
                    </div>
                  </div>
                  <Separator />
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <Label className="text-sm">Auto-escalate urgent alerts</Label>
                      <Switch defaultChecked />
                    </div>
                    <div className="flex items-center justify-between">
                      <Label className="text-sm">SMS for critical alerts</Label>
                      <Switch defaultChecked />
                    </div>
                    <div className="flex items-center justify-between">
                      <Label className="text-sm">Daily digest emails</Label>
                      <Switch defaultChecked />
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="md:col-span-2 border-2 border-slate-200">
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <Shield className="h-4 w-4 text-purple-600" />
                    Security Settings
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid md:grid-cols-2 gap-4">
                    {[
                      { label: "Require MFA", desc: "Two-factor authentication", on: true },
                      { label: "Password complexity", desc: "Min 12 chars, special chars", on: true },
                      { label: "Auto-lock (15 min)", desc: "Lock after inactivity", on: true },
                      { label: "IP Whitelisting", desc: "Restrict by IP range", on: false },
                    ].map((item) => (
                      <div key={item.label} className="flex items-center justify-between p-3 rounded-lg bg-slate-50">
                        <div>
                          <Label className="text-sm">{item.label}</Label>
                          <p className="text-xs text-slate-500">{item.desc}</p>
                        </div>
                        <Switch defaultChecked={item.on} />
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
