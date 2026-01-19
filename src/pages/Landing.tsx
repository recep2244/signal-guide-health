import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Slider } from "@/components/ui/slider";
import { useDemoAuth } from "@/context/AuthContext";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Activity,
  Bell,
  LineChart,
  MessageCircle,
  Phone,
  ShieldCheck,
  Smartphone,
  Sparkles,
  Stethoscope,
  Users,
  Zap,
  LogIn,
  Shield,
  LogOut,
  Heart,
  ArrowRight,
  CheckCircle2,
  Clock,
  TrendingDown,
  Watch,
  ChevronRight,
  Play,
} from "lucide-react";

const journeyTabs = [
  {
    value: "patient",
    label: "Patient Journey",
    icon: Users,
    title: "Daily check-ins that feel human",
    description:
      "Patients receive empathetic, structured check-ins via WhatsApp with Apple Watch sync and instant reassurance from their care team.",
    bullets: ["Symptom screening", "Medication adherence", "Wearable data sync", "24/7 support access"],
    ctaLabel: "Try Patient Demo",
    ctaTo: "/demo",
  },
  {
    value: "clinician",
    label: "Clinician View",
    icon: Stethoscope,
    title: "Smart triage that reduces noise",
    description:
      "Clinicians get a prioritized list of patients who need attention, complete with SBAR summaries and actionable alert context.",
    bullets: ["Red/amber/green queues", "SBAR summaries", "Actionable alerts", "Trend baselines"],
    ctaLabel: "Open Dashboard",
    ctaTo: "/dashboard",
  },
  {
    value: "operations",
    label: "Operations",
    icon: LineChart,
    title: "Operational clarity for leadership",
    description:
      "Leaders see real-time trends, throughput metrics, and response times to keep programs funded and clinically effective.",
    bullets: ["Response time tracking", "Escalation volumes", "Coverage confidence", "ROI dashboards"],
    ctaLabel: "View Analytics",
    ctaTo: "/dashboard",
  },
];

const features = [
  {
    title: "Triage at a Glance",
    description: "Red, amber, green queues highlight who needs immediate action versus routine follow-up.",
    icon: Activity,
    color: "bg-red-50 text-red-600",
  },
  {
    title: "Wearable Intelligence",
    description: "14-day baselines and trend deltas expose subtle decline before symptoms appear.",
    icon: Watch,
    color: "bg-blue-50 text-blue-600",
  },
  {
    title: "SBAR Summaries",
    description: "Structured clinical summaries keep handoffs consistent and reduce cognitive load.",
    icon: Stethoscope,
    color: "bg-purple-50 text-purple-600",
  },
  {
    title: "Live Alerting",
    description: "Escalations notify teams fast with clear next steps and patient context.",
    icon: Bell,
    color: "bg-amber-50 text-amber-600",
  },
  {
    title: "Patient Engagement",
    description: "Conversational WhatsApp check-ins boost adherence and build patient trust.",
    icon: MessageCircle,
    color: "bg-green-50 text-green-600",
  },
  {
    title: "Secure by Design",
    description: "Built for NHS compliance with GDPR, DSPT, and clinical safety standards.",
    icon: ShieldCheck,
    color: "bg-slate-50 text-slate-600",
  },
];

const stats = [
  { label: "Readmission Reduction", value: "-24%", description: "vs. standard care" },
  { label: "Response Time", value: "9 min", description: "average escalation" },
  { label: "Patient Adherence", value: "+27%", description: "check-in completion" },
  { label: "Clinician Time Saved", value: "3.2 hrs", description: "per day per nurse" },
];

export default function Landing() {
  const navigate = useNavigate();
  const { user, isAuthenticated, demoLogout } = useDemoAuth();
  const [patientsMonitored, setPatientsMonitored] = useState([140]);
  const [readmissionRate, setReadmissionRate] = useState([14]);

  const patientCount = patientsMonitored[0];
  const baselineRate = readmissionRate[0] / 100;
  const avoidedReadmissions = Math.max(1, Math.round(patientCount * baselineRate * 0.22));
  const estimatedSavings = avoidedReadmissions * 4200;

  const handleLogout = () => {
    demoLogout();
    navigate('/');
  };

  const getUserInitials = () => {
    if (!user?.name) return 'U';
    return user.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white">
      {/* Navigation */}
      <header className="sticky top-0 z-50 border-b bg-white/80 backdrop-blur-lg">
        <div className="container mx-auto flex h-16 items-center justify-between px-4 lg:px-8">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-teal-500 to-teal-600 shadow-lg shadow-teal-500/20">
              <Heart size={20} className="text-white" />
            </div>
            <div>
              <p className="text-base font-bold text-slate-900">CardioWatch</p>
              <p className="text-xs text-slate-500">Signal Guide Health</p>
            </div>
          </div>

          <nav className="hidden items-center gap-8 text-sm font-medium text-slate-600 lg:flex">
            <a href="#features" className="hover:text-teal-600 transition-colors">Features</a>
            <a href="#demo" className="hover:text-teal-600 transition-colors">Demo</a>
            <a href="#video" className="hover:text-teal-600 transition-colors">Video</a>
            <a href="#impact" className="hover:text-teal-600 transition-colors">Impact</a>
            <a href="#journey" className="hover:text-teal-600 transition-colors">Journeys</a>
          </nav>

          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="sm"
              className="hidden text-slate-600 hover:text-teal-600 sm:inline-flex"
              onClick={() => navigate("/dashboard")}
            >
              Dashboard
            </Button>
            <Button
              size="sm"
              className="bg-teal-600 hover:bg-teal-700 text-white shadow-lg shadow-teal-600/20"
              onClick={() => navigate("/demo")}
            >
              <Play size={14} className="mr-1.5" />
              Try Demo
            </Button>

            {isAuthenticated && user ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="relative ml-1">
                    <Avatar className="h-8 w-8 border-2 border-teal-100">
                      <AvatarFallback className="bg-teal-50 text-teal-700 text-xs font-bold">
                        {getUserInitials()}
                      </AvatarFallback>
                    </Avatar>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <DropdownMenuLabel className="font-normal">
                    <div className="flex flex-col space-y-1.5">
                      <p className="text-sm font-semibold text-slate-900">{user.name}</p>
                      <p className="text-xs text-slate-500">{user.email}</p>
                      <Badge variant="outline" className="w-fit text-[10px] bg-teal-50 text-teal-700 border-teal-200">
                        {user.role}
                      </Badge>
                    </div>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => navigate('/dashboard')} className="cursor-pointer">
                    <Heart className="mr-2 h-4 w-4 text-slate-500" />
                    Dashboard
                  </DropdownMenuItem>
                  {user.role === 'admin' && (
                    <DropdownMenuItem onClick={() => navigate('/admin')} className="cursor-pointer">
                      <Shield className="mr-2 h-4 w-4 text-slate-500" />
                      Admin Console
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuItem onClick={() => navigate('/demo')} className="cursor-pointer">
                    <Smartphone className="mr-2 h-4 w-4 text-slate-500" />
                    Patient Demo
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={handleLogout} className="cursor-pointer text-red-600">
                    <LogOut className="mr-2 h-4 w-4" />
                    Sign out
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <Button
                variant="ghost"
                size="sm"
                className="hidden text-slate-600 sm:inline-flex"
                onClick={() => navigate("/login")}
              >
                <LogIn size={16} className="mr-1.5" />
                Sign in
              </Button>
            )}
          </div>
        </div>
      </header>

      <main>
        {/* Hero Section */}
        <section className="relative overflow-hidden py-16 lg:py-24">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(20,184,166,0.08),transparent_50%)]" />
          <div className="absolute top-20 right-10 h-72 w-72 rounded-full bg-teal-500/5 blur-3xl" />
          <div className="absolute bottom-10 left-10 h-64 w-64 rounded-full bg-blue-500/5 blur-3xl" />

          <div className="container relative mx-auto px-4 lg:px-8">
            <div className="mx-auto max-w-4xl text-center">
              <Badge className="mb-6 bg-teal-50 text-teal-700 border-teal-200 px-4 py-1.5 text-sm font-medium">
                Post-Discharge Cardiac Care Platform
              </Badge>

              <h1 className="text-4xl font-bold tracking-tight text-slate-900 sm:text-5xl lg:text-6xl">
                Turn cardiac signals into
                <span className="block text-teal-600">clinical action</span>
              </h1>

              <p className="mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-slate-600 sm:text-xl">
                CardioWatch fuses wearable data, patient check-ins, and smart triage to reduce
                readmissions and scale post-discharge follow-up for cardiac patients.
              </p>

              <div className="mt-10 flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
                <Button
                  size="lg"
                  className="w-full sm:w-auto bg-teal-600 hover:bg-teal-700 text-white shadow-xl shadow-teal-600/20 px-8 h-12 text-base"
                  onClick={() => navigate("/demo")}
                >
                  <Play size={18} className="mr-2" />
                  Launch Patient Demo
                </Button>
                <Button
                  size="lg"
                  variant="outline"
                  className="w-full sm:w-auto border-slate-300 hover:bg-slate-50 px-8 h-12 text-base"
                  onClick={() => navigate("/dashboard")}
                >
                  Explore Dashboard
                  <ArrowRight size={18} className="ml-2" />
                </Button>
              </div>

              <div className="mt-12 flex flex-wrap items-center justify-center gap-6 text-sm text-slate-500">
                <span className="flex items-center gap-2">
                  <CheckCircle2 size={16} className="text-teal-500" />
                  NHS Compliant
                </span>
                <span className="flex items-center gap-2">
                  <CheckCircle2 size={16} className="text-teal-500" />
                  Apple Watch Integration
                </span>
                <span className="flex items-center gap-2">
                  <CheckCircle2 size={16} className="text-teal-500" />
                  WhatsApp Check-ins
                </span>
              </div>
            </div>
          </div>
        </section>

        {/* Stats Section */}
        <section className="border-y bg-white py-12">
          <div className="container mx-auto px-4 lg:px-8">
            <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
              {stats.map((stat) => (
                <div key={stat.label} className="text-center">
                  <p className="text-3xl font-bold text-teal-600 lg:text-4xl">{stat.value}</p>
                  <p className="mt-1 text-base font-semibold text-slate-900">{stat.label}</p>
                  <p className="text-sm text-slate-500">{stat.description}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Demo Cards Section */}
        <section id="demo" className="py-16 lg:py-24">
          <div className="container mx-auto px-4 lg:px-8">
            <div className="mx-auto max-w-2xl text-center">
              <Badge className="mb-4 bg-slate-100 text-slate-700">Interactive Demos</Badge>
              <h2 className="text-3xl font-bold text-slate-900 sm:text-4xl">
                Experience CardioWatch
              </h2>
              <p className="mt-4 text-lg text-slate-600">
                Try our interactive demos to see how patients and clinicians interact with the platform.
              </p>
            </div>

            <div className="mt-12 grid gap-6 lg:grid-cols-2">
              <Card className="group relative overflow-hidden border-2 border-slate-200 bg-gradient-to-br from-white to-teal-50/30 p-8 transition-all hover:border-teal-300 hover:shadow-xl hover:shadow-teal-500/10">
                <div className="absolute top-0 right-0 h-32 w-32 translate-x-8 -translate-y-8 rounded-full bg-teal-500/10 transition-transform group-hover:scale-150" />
                <div className="relative">
                  <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-teal-100 text-teal-600">
                    <Smartphone size={28} />
                  </div>
                  <h3 className="mt-6 text-2xl font-bold text-slate-900">Patient Check-in Demo</h3>
                  <p className="mt-3 text-base leading-relaxed text-slate-600">
                    Experience the WhatsApp-style daily check-in from a patient's perspective.
                    See how symptoms are screened, wearable data is synced, and care teams respond.
                  </p>
                  <ul className="mt-6 space-y-2">
                    {["Symptom screening flow", "Apple Watch data sync", "Medication adherence", "Urgent escalation paths"].map((item) => (
                      <li key={item} className="flex items-center gap-2 text-sm text-slate-600">
                        <CheckCircle2 size={16} className="text-teal-500" />
                        {item}
                      </li>
                    ))}
                  </ul>
                  <Button
                    className="mt-8 bg-teal-600 hover:bg-teal-700 text-white"
                    onClick={() => navigate("/demo")}
                  >
                    <Play size={16} className="mr-2" />
                    Start Patient Demo
                    <ChevronRight size={16} className="ml-1" />
                  </Button>
                </div>
              </Card>

              <Card className="group relative overflow-hidden border-2 border-slate-200 bg-gradient-to-br from-white to-blue-50/30 p-8 transition-all hover:border-blue-300 hover:shadow-xl hover:shadow-blue-500/10">
                <div className="absolute top-0 right-0 h-32 w-32 translate-x-8 -translate-y-8 rounded-full bg-blue-500/10 transition-transform group-hover:scale-150" />
                <div className="relative">
                  <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-100 text-blue-600">
                    <Stethoscope size={28} />
                  </div>
                  <h3 className="mt-6 text-2xl font-bold text-slate-900">Clinician Dashboard</h3>
                  <p className="mt-3 text-base leading-relaxed text-slate-600">
                    Explore the clinical triage dashboard with patient queues, vital trends,
                    SBAR summaries, and alert management designed for busy care teams.
                  </p>
                  <ul className="mt-6 space-y-2">
                    {["Red/Amber/Green triage", "Patient vital trends", "SBAR clinical summaries", "Alert resolution workflow"].map((item) => (
                      <li key={item} className="flex items-center gap-2 text-sm text-slate-600">
                        <CheckCircle2 size={16} className="text-blue-500" />
                        {item}
                      </li>
                    ))}
                  </ul>
                  <Button
                    variant="outline"
                    className="mt-8 border-blue-300 text-blue-700 hover:bg-blue-50"
                    onClick={() => navigate("/dashboard")}
                  >
                    Open Dashboard
                    <ChevronRight size={16} className="ml-1" />
                  </Button>
                </div>
              </Card>
            </div>
          </div>
        </section>

        {/* Features Section */}
        <section id="features" className="bg-slate-50 py-16 lg:py-24">
          <div className="container mx-auto px-4 lg:px-8">
            <div className="mx-auto max-w-2xl text-center">
              <Badge className="mb-4 bg-white text-slate-700">Platform Features</Badge>
              <h2 className="text-3xl font-bold text-slate-900 sm:text-4xl">
                Built for clinical clarity
              </h2>
              <p className="mt-4 text-lg text-slate-600">
                Every feature is designed to reduce noise, surface what matters, and help clinicians act confidently.
              </p>
            </div>

            <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {features.map((feature) => {
                const Icon = feature.icon;
                return (
                  <Card key={feature.title} className="border-0 bg-white p-6 shadow-sm transition-all hover:shadow-lg">
                    <div className={`flex h-12 w-12 items-center justify-center rounded-xl ${feature.color}`}>
                      <Icon size={24} />
                    </div>
                    <h3 className="mt-4 text-lg font-semibold text-slate-900">{feature.title}</h3>
                    <p className="mt-2 text-sm leading-relaxed text-slate-600">{feature.description}</p>
                  </Card>
                );
              })}
            </div>
          </div>
        </section>

        {/* Impact Calculator */}
        <section id="impact" className="py-16 lg:py-24">
          <div className="container mx-auto px-4 lg:px-8">
            <div className="grid gap-12 lg:grid-cols-2 lg:items-center">
              <div>
                <Badge className="mb-4 bg-teal-50 text-teal-700">Impact Calculator</Badge>
                <h2 className="text-3xl font-bold text-slate-900 sm:text-4xl">
                  See how signal gains compound into savings
                </h2>
                <p className="mt-4 text-lg leading-relaxed text-slate-600">
                  Adjust the patient volume and baseline readmission rate to visualize how earlier
                  escalation through continuous monitoring changes outcomes and reduces costs.
                </p>
                <div className="mt-8 space-y-2">
                  <div className="flex items-center gap-2 text-sm text-slate-600">
                    <TrendingDown size={16} className="text-teal-500" />
                    Model assumes 22% reduction in avoidable readmissions
                  </div>
                  <div className="flex items-center gap-2 text-sm text-slate-600">
                    <Clock size={16} className="text-teal-500" />
                    Based on proactive triage and early intervention
                  </div>
                </div>
              </div>

              <Card className="border-2 border-slate-200 bg-white p-8">
                <div className="space-y-8">
                  <div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-medium text-slate-700">Patients monitored</span>
                      <span className="font-bold text-teal-600">{patientCount.toLocaleString()}</span>
                    </div>
                    <Slider
                      value={patientsMonitored}
                      onValueChange={setPatientsMonitored}
                      min={50}
                      max={400}
                      step={10}
                      className="mt-4"
                    />
                  </div>
                  <div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-medium text-slate-700">Baseline readmission rate</span>
                      <span className="font-bold text-teal-600">{readmissionRate[0]}%</span>
                    </div>
                    <Slider
                      value={readmissionRate}
                      onValueChange={setReadmissionRate}
                      min={6}
                      max={20}
                      step={1}
                      className="mt-4"
                    />
                  </div>

                  <div className="grid gap-4 sm:grid-cols-3">
                    <div className="rounded-xl bg-teal-50 p-4 text-center">
                      <p className="text-2xl font-bold text-teal-700">{avoidedReadmissions}</p>
                      <p className="mt-1 text-xs font-medium text-teal-600">Avoided Readmissions</p>
                    </div>
                    <div className="rounded-xl bg-green-50 p-4 text-center">
                      <p className="text-2xl font-bold text-green-700">£{estimatedSavings.toLocaleString()}</p>
                      <p className="mt-1 text-xs font-medium text-green-600">Estimated Savings</p>
                    </div>
                    <div className="rounded-xl bg-blue-50 p-4 text-center">
                      <p className="text-2xl font-bold text-blue-700">{"<"}15m</p>
                      <p className="mt-1 text-xs font-medium text-blue-600">Response SLA</p>
                    </div>
                  </div>
                </div>
              </Card>
            </div>
          </div>
        </section>

        {/* Journey Tabs */}
        <section id="journey" className="bg-slate-50 py-16 lg:py-24">
          <div className="container mx-auto px-4 lg:px-8">
            <div className="mx-auto max-w-2xl text-center">
              <Badge className="mb-4 bg-white text-slate-700">User Journeys</Badge>
              <h2 className="text-3xl font-bold text-slate-900 sm:text-4xl">
                Choose your perspective
              </h2>
              <p className="mt-4 text-lg text-slate-600">
                Explore CardioWatch from the viewpoint of patients, clinicians, or operations leaders.
              </p>
            </div>

            <div className="mt-12">
              <Tabs defaultValue="patient" className="mx-auto max-w-4xl">
                <TabsList className="grid w-full grid-cols-3 bg-white p-1.5 rounded-xl shadow-sm">
                  {journeyTabs.map((tab) => {
                    const Icon = tab.icon;
                    return (
                      <TabsTrigger
                        key={tab.value}
                        value={tab.value}
                        className="flex items-center gap-2 data-[state=active]:bg-teal-50 data-[state=active]:text-teal-700 rounded-lg py-3"
                      >
                        <Icon size={16} />
                        <span className="hidden sm:inline">{tab.label}</span>
                      </TabsTrigger>
                    );
                  })}
                </TabsList>

                {journeyTabs.map((tab) => (
                  <TabsContent key={tab.value} value={tab.value} className="mt-8">
                    <Card className="border-0 bg-white p-8 shadow-lg">
                      <div className="grid gap-8 lg:grid-cols-2">
                        <div>
                          <h3 className="text-2xl font-bold text-slate-900">{tab.title}</h3>
                          <p className="mt-4 text-base leading-relaxed text-slate-600">{tab.description}</p>
                          <div className="mt-6 flex flex-wrap gap-2">
                            {tab.bullets.map((bullet) => (
                              <Badge key={bullet} variant="secondary" className="bg-slate-100 text-slate-700">
                                {bullet}
                              </Badge>
                            ))}
                          </div>
                        </div>
                        <div className="flex items-center justify-center">
                          <div className="text-center">
                            <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-teal-100">
                              <tab.icon size={40} className="text-teal-600" />
                            </div>
                            <Button asChild className="mt-6 bg-teal-600 hover:bg-teal-700">
                              <Link to={tab.ctaTo}>
                                {tab.ctaLabel}
                                <ChevronRight size={16} className="ml-1" />
                              </Link>
                            </Button>
                          </div>
                        </div>
                      </div>
                    </Card>
                  </TabsContent>
                ))}
              </Tabs>
            </div>
          </div>
        </section>

        {/* Wearable Integration */}
        <section className="py-16 lg:py-24">
          <div className="container mx-auto px-4 lg:px-8">
            <Card className="border-2 border-slate-200 bg-gradient-to-br from-white to-slate-50 p-8 lg:p-12">
              <div className="grid gap-8 lg:grid-cols-2 lg:items-center">
                <div>
                  <Badge className="mb-4 bg-blue-50 text-blue-700">Wearable Integration</Badge>
                  <h2 className="text-3xl font-bold text-slate-900">
                    Continuous monitoring from devices patients already own
                  </h2>
                  <p className="mt-4 text-lg leading-relaxed text-slate-600">
                    CardioWatch converts wearable signals into actionable clinical context.
                    Works with Apple Watch today, with Fitbit, Garmin, and clinical RPM devices on the roadmap.
                  </p>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  {[
                    { label: "Vitals", value: "Resting HR, HRV, pulse trends", icon: Heart },
                    { label: "Recovery", value: "Sleep hours, quality, variability", icon: Clock },
                    { label: "Activity", value: "Steps, exertion, mobility", icon: Activity },
                    { label: "Trends", value: "14-day baselines & deltas", icon: LineChart },
                  ].map((item) => (
                    <div key={item.label} className="rounded-xl bg-white p-5 shadow-sm">
                      <item.icon size={20} className="text-teal-600" />
                      <p className="mt-3 text-xs font-medium uppercase tracking-wide text-slate-500">{item.label}</p>
                      <p className="mt-1 text-sm font-semibold text-slate-900">{item.value}</p>
                    </div>
                  ))}
                </div>
              </div>
            </Card>
          </div>
        </section>

        {/* Video Presentation Section */}
        <section id="video" className="py-16 lg:py-24 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
          <div className="container mx-auto px-4 lg:px-8">
            <div className="mx-auto max-w-4xl text-center">
              <Badge className="mb-4 bg-teal-500/20 text-teal-300 border-teal-500/30">Video Walkthrough</Badge>
              <h2 className="text-3xl font-bold text-white sm:text-4xl">
                See CardioWatch in Action
              </h2>
              <p className="mt-4 text-lg text-slate-300">
                Watch how patients and clinicians interact with the platform through daily check-ins and smart triage.
              </p>
            </div>

            <div className="mt-12 mx-auto max-w-4xl">
              <div className="relative aspect-video rounded-2xl overflow-hidden bg-slate-800 border-2 border-slate-700 shadow-2xl shadow-black/50">
                {/* Video Placeholder - Replace with actual video embed */}
                <div className="absolute inset-0 bg-gradient-to-br from-teal-900/40 to-slate-900/60 flex items-center justify-center">
                  <div className="text-center">
                    <div className="w-24 h-24 mx-auto rounded-full bg-teal-500/20 backdrop-blur-sm flex items-center justify-center border-2 border-teal-400/30 cursor-pointer transition-all hover:scale-110 hover:bg-teal-500/30 group">
                      <Play size={40} className="text-teal-300 ml-1 group-hover:text-white transition-colors" />
                    </div>
                    <p className="mt-6 text-lg font-semibold text-white">Platform Demo Video</p>
                    <p className="mt-2 text-sm text-slate-400">Coming soon - Interactive walkthrough</p>
                  </div>
                </div>

                {/* Video overlay decorations */}
                <div className="absolute top-4 left-4 flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-red-500" />
                  <div className="w-3 h-3 rounded-full bg-amber-500" />
                  <div className="w-3 h-3 rounded-full bg-green-500" />
                </div>
                <div className="absolute bottom-4 left-4 right-4">
                  <div className="h-1 bg-slate-700 rounded-full overflow-hidden">
                    <div className="h-full w-1/3 bg-teal-500 rounded-full" />
                  </div>
                  <div className="mt-2 flex items-center justify-between text-xs text-slate-500">
                    <span>0:00</span>
                    <span>3:24</span>
                  </div>
                </div>
              </div>

              {/* Video highlights */}
              <div className="mt-8 grid grid-cols-2 md:grid-cols-4 gap-4">
                {[
                  { time: "0:15", label: "Patient Check-in Flow" },
                  { time: "1:02", label: "Wearable Data Sync" },
                  { time: "1:45", label: "Clinician Dashboard" },
                  { time: "2:30", label: "Alert Management" },
                ].map((chapter) => (
                  <div
                    key={chapter.time}
                    className="flex items-center gap-3 bg-slate-800/50 rounded-xl p-3 border border-slate-700 cursor-pointer hover:bg-slate-800 hover:border-teal-500/50 transition-all"
                  >
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-teal-500/20 text-teal-400 text-xs font-bold">
                      {chapter.time}
                    </div>
                    <span className="text-sm text-slate-300 font-medium">{chapter.label}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* CTA Section */}
        <section className="bg-teal-600 py-16 lg:py-20">
          <div className="container mx-auto px-4 lg:px-8">
            <div className="mx-auto max-w-3xl text-center">
              <h2 className="text-3xl font-bold text-white sm:text-4xl">
                Ready to see CardioWatch in action?
              </h2>
              <p className="mt-4 text-lg text-teal-100">
                Run through the patient demo and clinician dashboard in under 3 minutes.
              </p>
              <div className="mt-8 flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
                <Button
                  size="lg"
                  className="w-full sm:w-auto bg-white text-teal-700 hover:bg-teal-50 px-8 h-12"
                  onClick={() => navigate("/demo")}
                >
                  <Play size={18} className="mr-2" />
                  Launch Demo
                </Button>
                <Button
                  size="lg"
                  variant="outline"
                  className="w-full sm:w-auto border-teal-400 text-white hover:bg-teal-500 px-8 h-12"
                  onClick={() => navigate("/dashboard")}
                >
                  Open Dashboard
                </Button>
              </div>
            </div>
          </div>
        </section>

        {/* Footer */}
        <footer className="border-t bg-white py-12">
          <div className="container mx-auto px-4 lg:px-8">
            <div className="flex flex-col items-center justify-between gap-6 lg:flex-row">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-teal-100">
                  <Heart size={20} className="text-teal-600" />
                </div>
                <div>
                  <p className="font-bold text-slate-900">CardioWatch</p>
                  <p className="text-xs text-slate-500">Signal Guide Health</p>
                </div>
              </div>
              <div className="text-center lg:text-right">
                <p className="text-sm text-slate-600">
                  Created by <span className="font-semibold">Recep Adiyaman, PhD</span>
                </p>
                <p className="text-xs text-slate-500 mt-1">
                  Copyright © 2026. All rights reserved. Demo data is synthetic.
                </p>
              </div>
            </div>
          </div>
        </footer>
      </main>
    </div>
  );
}
