import { useState, type ChangeEvent, type FormEvent } from "react";
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
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
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
  Cpu,
  Target,
  FlaskConical,
  Droplets,
  CircuitBoard,
  Microscope,
  Award,
  FileCheck,
  Building2,
  Mail,
  Linkedin,
  GraduationCap,
  BadgeCheck,
  Globe,
  Send,
} from "lucide-react";

const demoVideoSrc = `${import.meta.env.BASE_URL}CardioWatch__A_Lifeline_.mp4`;
const contactEmail = "recepadiyaman2244@gmail.com";
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
  const [contactForm, setContactForm] = useState({
    firstName: "",
    lastName: "",
    email: "",
    organization: "",
    role: "",
    message: "",
  });

  const patientCount = patientsMonitored[0];
  const baselineRate = readmissionRate[0] / 100;
  const avoidedReadmissions = Math.max(1, Math.round(patientCount * baselineRate * 0.22));
  const estimatedSavings = avoidedReadmissions * 4200;
  const contactSubject = contactForm.organization
    ? `CardioWatch demo inquiry - ${contactForm.organization}`
    : "CardioWatch demo inquiry";

  const handleContactChange =
    (field: keyof typeof contactForm) =>
    (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      setContactForm((prev) => ({ ...prev, [field]: event.target.value }));
    };

  const handleContactSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const fullName = `${contactForm.firstName} ${contactForm.lastName}`.trim();
    const body = [
      `Name: ${fullName || "N/A"}`,
      `Email: ${contactForm.email}`,
      `Organization: ${contactForm.organization || "N/A"}`,
      `Role: ${contactForm.role || "N/A"}`,
      "",
      "Message:",
      contactForm.message,
    ].join("\n");
    const mailtoUrl = `mailto:${contactEmail}?subject=${encodeURIComponent(
      contactSubject
    )}&body=${encodeURIComponent(body)}`;
    window.location.href = mailtoUrl;
  };

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
          <nav className="hidden items-center gap-6 text-sm font-medium text-slate-600 lg:flex">
            <a href="#features" className="hover:text-teal-600 transition-colors">Features</a>
            <a href="#demo" className="hover:text-teal-600 transition-colors">Demo</a>
            <a href="#device" className="hover:text-teal-600 transition-colors">R&D</a>
            <a href="#compliance" className="hover:text-teal-600 transition-colors">Compliance</a>
            <a href="#team" className="hover:text-teal-600 transition-colors">Team</a>
            <a href="#contact" className="hover:text-teal-600 transition-colors">Contact</a>
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

        {/* Device Development Vision Section */}
        <section id="device" className="bg-gradient-to-br from-purple-50 via-white to-indigo-50 py-16 lg:py-24">
          <div className="container mx-auto px-4 lg:px-8">
            <div className="mx-auto max-w-4xl text-center">
              <Badge className="mb-4 bg-purple-100 text-purple-700 border-purple-200">Research & Development</Badge>
              <h2 className="text-3xl font-bold text-slate-900 sm:text-4xl">
                From Proof-of-Concept to Purpose-Built Biosensors
              </h2>
              <p className="mt-4 text-lg leading-relaxed text-slate-600 max-w-3xl mx-auto">
                Our current implementation leverages consumer wearables such as Apple Watch to validate the clinical
                feasibility and algorithmic foundations of continuous remote patient monitoring. This serves as a
                technology demonstrator, establishing that real-time physiological signal acquisition and intelligent
                triage are both achievable and clinically meaningful.
              </p>
            </div>

            <div className="mt-12 grid gap-8 lg:grid-cols-2">
              {/* Current State Card */}
              <Card className="border-2 border-slate-200 bg-white p-8 relative overflow-hidden">
                <div className="absolute top-0 right-0 h-24 w-24 translate-x-6 -translate-y-6 rounded-full bg-blue-500/10" />
                <div className="relative">
                  <div className="flex items-center gap-3 mb-6">
                    <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-100 text-blue-600">
                      <Watch size={24} />
                    </div>
                    <div>
                      <h3 className="text-xl font-bold text-slate-900">Current Implementation</h3>
                      <p className="text-sm text-slate-500">Technology Validation Phase</p>
                    </div>
                  </div>
                  <p className="text-slate-600 leading-relaxed mb-6">
                    Consumer-grade wearables provide an accessible platform for demonstrating core capabilities:
                    heart rate variability analysis, activity pattern recognition, and sleep quality assessment.
                    These devices enable rapid prototyping and clinical workflow validation without custom hardware development.
                  </p>
                  <div className="space-y-3">
                    {[
                      { icon: CheckCircle2, text: "Validates algorithmic approaches with real physiological data" },
                      { icon: CheckCircle2, text: "Demonstrates clinical workflow integration feasibility" },
                      { icon: CheckCircle2, text: "Enables iterative refinement of triage logic" },
                    ].map((item, idx) => (
                      <div key={idx} className="flex items-start gap-2 text-sm text-slate-600">
                        <item.icon size={16} className="text-blue-500 mt-0.5 shrink-0" />
                        <span>{item.text}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </Card>

              {/* Future Vision Card */}
              <Card className="border-2 border-purple-200 bg-gradient-to-br from-purple-50 to-white p-8 relative overflow-hidden">
                <div className="absolute top-0 right-0 h-24 w-24 translate-x-6 -translate-y-6 rounded-full bg-purple-500/10" />
                <div className="relative">
                  <div className="flex items-center gap-3 mb-6">
                    <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-purple-100 text-purple-600">
                      <CircuitBoard size={24} />
                    </div>
                    <div>
                      <h3 className="text-xl font-bold text-slate-900">Development Roadmap</h3>
                      <p className="text-sm text-purple-600">Purpose-Built Medical Device</p>
                    </div>
                  </div>
                  <p className="text-slate-600 leading-relaxed mb-6">
                    Our long-term objective is the development of a dedicated biosensor platform capable of
                    multi-modal physiological monitoring. This medical-grade device will integrate specialised
                    sensors for comprehensive chronic disease management across multiple therapeutic areas.
                  </p>
                  <div className="space-y-3">
                    {[
                      { icon: Target, text: "Multi-analyte biosensing for metabolic markers" },
                      { icon: Target, text: "Non-invasive glucose estimation algorithms" },
                      { icon: Target, text: "Advanced cardiac arrhythmia detection" },
                    ].map((item, idx) => (
                      <div key={idx} className="flex items-start gap-2 text-sm text-slate-600">
                        <item.icon size={16} className="text-purple-500 mt-0.5 shrink-0" />
                        <span>{item.text}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </Card>
            </div>

            {/* Target Applications */}
            <div className="mt-12">
              <h3 className="text-center text-lg font-semibold text-slate-700 mb-8">
                Target Therapeutic Applications
              </h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {[
                  {
                    icon: Heart,
                    label: "Cardiovascular",
                    description: "Heart failure, arrhythmia, hypertension monitoring",
                    color: "bg-red-50 text-red-600 border-red-100"
                  },
                  {
                    icon: Droplets,
                    label: "Diabetes",
                    description: "Continuous glucose trends, insulin response tracking",
                    color: "bg-blue-50 text-blue-600 border-blue-100"
                  },
                  {
                    icon: Activity,
                    label: "Respiratory",
                    description: "COPD exacerbation prediction, SpO2 monitoring",
                    color: "bg-teal-50 text-teal-600 border-teal-100"
                  },
                  {
                    icon: FlaskConical,
                    label: "Renal Function",
                    description: "Fluid balance, electrolyte status indicators",
                    color: "bg-amber-50 text-amber-600 border-amber-100"
                  },
                ].map((app) => (
                  <Card key={app.label} className={`p-5 border-2 ${app.color} transition-all hover:shadow-lg`}>
                    <app.icon size={24} className="mb-3" />
                    <h4 className="font-bold text-slate-900">{app.label}</h4>
                    <p className="text-xs text-slate-600 mt-1 leading-relaxed">{app.description}</p>
                  </Card>
                ))}
              </div>
            </div>

            {/* Scientific Note */}
            <div className="mt-12 mx-auto max-w-3xl">
              <Card className="border-2 border-indigo-100 bg-indigo-50/50 p-6">
                <div className="flex gap-4">
                  <div className="shrink-0">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-indigo-100 text-indigo-600">
                      <Microscope size={20} />
                    </div>
                  </div>
                  <div>
                    <h4 className="font-semibold text-slate-900 mb-2">Research Foundation</h4>
                    <p className="text-sm text-slate-600 leading-relaxed">
                      This platform represents the convergence of signal processing, machine learning, and clinical
                      informatics. By establishing robust data pipelines and validated triage algorithms using
                      commercially available hardware, we create a transferable foundation for future medical-grade
                      device development. The insights gained from this proof-of-concept directly inform sensor
                      requirements, sampling frequencies, and clinical decision support thresholds for the
                      purpose-built biosensor system.
                    </p>
                  </div>
                </div>
              </Card>
            </div>
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
              <div className="relative rounded-2xl overflow-hidden bg-slate-800 border-2 border-slate-700 shadow-2xl shadow-black/50">
                {/* Video Player */}
                <video
                  className="w-full aspect-video"
                  controls
                  playsInline
                  preload="metadata"
                  poster={`${import.meta.env.BASE_URL}placeholder.svg`}
                  src={demoVideoSrc}
                >
                  <source src={demoVideoSrc} type="video/mp4" />
                  Your browser does not support the video tag.
                </video>
              </div>

              {/* Video description */}
              <div className="mt-6 text-center">
                <p className="text-slate-400 text-sm">
                  CardioWatch: A Lifeline - Platform demonstration showcasing patient check-ins, wearable data sync, and clinical triage workflows.
                </p>
                <div className="mt-3 flex flex-wrap items-center justify-center gap-2 text-xs text-slate-400">
                  <span>If the video does not play in your browser, download it here.</span>
                  <a
                    href={demoVideoSrc}
                    className="text-teal-300 underline-offset-4 hover:underline"
                    target="_blank"
                    rel="noreferrer"
                  >
                    Download video
                  </a>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Regulatory Compliance Section */}
        <section id="compliance" className="bg-slate-50 py-16 lg:py-24">
          <div className="container mx-auto px-4 lg:px-8">
            <div className="mx-auto max-w-2xl text-center">
              <Badge className="mb-4 bg-green-100 text-green-700 border-green-200">Compliance & Standards</Badge>
              <h2 className="text-3xl font-bold text-slate-900 sm:text-4xl">
                Built for Clinical Governance
              </h2>
              <p className="mt-4 text-lg text-slate-600">
                CardioWatch is designed to meet the rigorous standards required for NHS deployment and medical device regulation.
              </p>
            </div>

            <div className="mt-12 grid gap-6 md:grid-cols-2 lg:grid-cols-4">
              {[
                {
                  icon: Shield,
                  title: "NHS DTAC",
                  description: "Aligned with Digital Technology Assessment Criteria for clinical safety and data protection",
                  status: "Compliant",
                  color: "bg-blue-50 text-blue-600 border-blue-100"
                },
                {
                  icon: FileCheck,
                  title: "GDPR",
                  description: "Full compliance with UK GDPR and Data Protection Act 2018 requirements",
                  status: "Compliant",
                  color: "bg-green-50 text-green-600 border-green-100"
                },
                {
                  icon: Award,
                  title: "CE/UKCA Marking",
                  description: "Medical device classification pathway aligned with MDR 2017/745 requirements",
                  status: "In Progress",
                  color: "bg-amber-50 text-amber-600 border-amber-100"
                },
                {
                  icon: BadgeCheck,
                  title: "Clinical Safety",
                  description: "DCB0129 clinical risk management and hazard analysis documentation",
                  status: "Compliant",
                  color: "bg-purple-50 text-purple-600 border-purple-100"
                },
              ].map((item) => (
                <Card key={item.title} className={`p-6 border-2 ${item.color}`}>
                  <item.icon size={28} className="mb-4" />
                  <div className="flex items-center gap-2 mb-2">
                    <h3 className="font-bold text-slate-900">{item.title}</h3>
                    <Badge variant="outline" className={`text-[10px] ${item.status === 'Compliant' ? 'bg-green-100 text-green-700 border-green-300' : 'bg-amber-100 text-amber-700 border-amber-300'}`}>
                      {item.status}
                    </Badge>
                  </div>
                  <p className="text-sm text-slate-600 leading-relaxed">{item.description}</p>
                </Card>
              ))}
            </div>

            <div className="mt-12 text-center">
              <p className="text-sm text-slate-500">
                Regulatory documentation and compliance reports available upon request for qualified healthcare organisations.
              </p>
            </div>
          </div>
        </section>

        {/* Team Section */}
        <section id="team" className="py-16 lg:py-24">
          <div className="container mx-auto px-4 lg:px-8">
            <div className="mx-auto max-w-2xl text-center">
              <Badge className="mb-4 bg-teal-50 text-teal-700 border-teal-200">Leadership</Badge>
              <h2 className="text-3xl font-bold text-slate-900 sm:text-4xl">
                Built by Scientists, for Clinicians
              </h2>
              <p className="mt-4 text-lg text-slate-600">
                CardioWatch combines deep expertise in computational biology, machine learning, and clinical informatics.
              </p>
            </div>

            <div className="mt-12 max-w-4xl mx-auto">
              <Card className="border-2 border-slate-200 p-8 lg:p-10">
                <div className="grid gap-8 lg:grid-cols-3 lg:items-center">
                  <div className="lg:col-span-1 text-center">
                    <div className="w-32 h-32 mx-auto rounded-full bg-gradient-to-br from-teal-500 to-teal-600 flex items-center justify-center shadow-xl shadow-teal-500/20">
                      <span className="text-4xl font-bold text-white">RA</span>
                    </div>
                    <h3 className="mt-4 text-xl font-bold text-slate-900">Recep Adiyaman, PhD</h3>
                    <p className="text-teal-600 font-medium">Founder & Lead Developer</p>
                    <div className="mt-3 flex justify-center gap-2 flex-wrap">
                      <a href="mailto:recepadiyaman2244@gmail.com" target="_blank" rel="noopener noreferrer">
                        <Button variant="outline" size="sm" className="h-8 w-8 p-0 hover:bg-teal-50 hover:border-teal-300" title="Email">
                          <Mail size={14} />
                        </Button>
                      </a>
                      <a href="https://www.linkedin.com/in/recep-ad%C4%B1yaman/" target="_blank" rel="noopener noreferrer">
                        <Button variant="outline" size="sm" className="h-8 w-8 p-0 hover:bg-blue-50 hover:border-blue-300" title="LinkedIn">
                          <Linkedin size={14} />
                        </Button>
                      </a>
                      <a href="https://x.com/RcpAdymn" target="_blank" rel="noopener noreferrer">
                        <Button variant="outline" size="sm" className="h-8 w-8 p-0 hover:bg-slate-100 hover:border-slate-400" title="X (Twitter)">
                          <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="currentColor">
                            <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
                          </svg>
                        </Button>
                      </a>
                      <a href="https://bsky.app/profile/recep44.bsky.social" target="_blank" rel="noopener noreferrer">
                        <Button variant="outline" size="sm" className="h-8 w-8 p-0 hover:bg-sky-50 hover:border-sky-300" title="Bluesky">
                          <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="currentColor">
                            <path d="M12 10.8c-1.087-2.114-4.046-6.053-6.798-7.995C2.566.944 1.561 1.266.902 1.565.139 1.908 0 3.08 0 3.768c0 .69.378 5.65.624 6.479.815 2.736 3.713 3.66 6.383 3.364.136-.02.275-.039.415-.056-.138.022-.276.04-.415.056-3.912.58-7.387 2.005-2.83 7.078 5.013 5.19 6.87-1.113 7.823-4.308.953 3.195 2.05 9.271 7.733 4.308 4.267-4.308 1.172-6.498-2.74-7.078a8.741 8.741 0 0 1-.415-.056c.14.017.279.036.415.056 2.67.297 5.568-.628 6.383-3.364.246-.828.624-5.79.624-6.478 0-.69-.139-1.861-.902-2.206-.659-.298-1.664-.62-4.3 1.24C16.046 4.748 13.087 8.687 12 10.8Z"/>
                          </svg>
                        </Button>
                      </a>
                      <a href="https://scholar.google.com/citations?user=4UUzdMsAAAAJ&hl=en" target="_blank" rel="noopener noreferrer">
                        <Button variant="outline" size="sm" className="h-8 w-8 p-0 hover:bg-blue-50 hover:border-blue-300" title="Google Scholar">
                          <GraduationCap size={14} />
                        </Button>
                      </a>
                    </div>
                  </div>
                  <div className="lg:col-span-2">
                    <div className="space-y-4 text-slate-600">
                      <p className="leading-relaxed">
                        Dr. Adiyaman brings over a decade of experience in computational biology and bioinformatics,
                        with a focus on translating complex data signals into actionable clinical insights.
                      </p>
                      <p className="leading-relaxed">
                        His research background spans protein structure prediction, molecular dynamics simulation,
                        and the application of machine learning to biomedical data—expertise now applied to
                        physiological signal processing and predictive health monitoring.
                      </p>
                    </div>
                    <div className="mt-6 flex flex-wrap gap-2">
                      {["Computational Biology", "Machine Learning", "Clinical Informatics", "Signal Processing", "Protein Structure"].map((skill) => (
                        <Badge key={skill} variant="secondary" className="bg-slate-100 text-slate-700">{skill}</Badge>
                      ))}
                    </div>
                    <div className="mt-6 grid grid-cols-3 gap-4 pt-6 border-t">
                      <div className="text-center">
                        <GraduationCap size={20} className="mx-auto text-teal-600 mb-1" />
                        <p className="text-xs text-slate-500">PhD Computational Biology</p>
                      </div>
                      <div className="text-center">
                        <Building2 size={20} className="mx-auto text-teal-600 mb-1" />
                        <p className="text-xs text-slate-500">Research partnerships</p>
                      </div>
                      <div className="text-center">
                        <Award size={20} className="mx-auto text-teal-600 mb-1" />
                        <p className="text-xs text-slate-500">20+ publications</p>
                      </div>
                    </div>
                  </div>
                </div>
              </Card>
            </div>
          </div>
        </section>

        {/* Contact Section */}
        <section id="contact" className="bg-slate-50 py-16 lg:py-24">
          <div className="container mx-auto px-4 lg:px-8">
            <div className="grid gap-12 lg:grid-cols-2 lg:items-start">
              <div>
                <Badge className="mb-4 bg-teal-50 text-teal-700 border-teal-200">Get in Touch</Badge>
                <h2 className="text-3xl font-bold text-slate-900 sm:text-4xl">
                  Ready to Transform Post-Discharge Care?
                </h2>
                <p className="mt-4 text-lg text-slate-600 leading-relaxed">
                  Whether you're an NHS Trust exploring remote monitoring solutions, an investor interested in
                  digital health innovation, or a researcher seeking collaboration—we'd love to hear from you.
                </p>

                <div className="mt-8 space-y-4">
                  {[
                    { icon: Building2, label: "For NHS & Healthcare Organisations", description: "Discuss pilot programmes, integration requirements, and clinical workflows" },
                    { icon: LineChart, label: "For Investors", description: "Learn about our roadmap, market opportunity, and partnership models" },
                    { icon: GraduationCap, label: "For Researchers", description: "Explore collaboration on clinical validation studies and publications" },
                  ].map((item) => (
                    <div key={item.label} className="flex gap-4">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-teal-100 text-teal-600">
                        <item.icon size={20} />
                      </div>
                      <div>
                        <h4 className="font-semibold text-slate-900">{item.label}</h4>
                        <p className="text-sm text-slate-600">{item.description}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <Card className="border-2 border-slate-200 p-6 lg:p-8">
                <h3 className="text-xl font-bold text-slate-900 mb-6">Request a Demo</h3>
                <form className="space-y-4" onSubmit={handleContactSubmit}>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="firstName" className="text-slate-700">First Name</Label>
                      <Input
                        id="firstName"
                        required
                        value={contactForm.firstName}
                        onChange={handleContactChange("firstName")}
                        placeholder="John"
                        className="border-slate-300"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="lastName" className="text-slate-700">Last Name</Label>
                      <Input
                        id="lastName"
                        required
                        value={contactForm.lastName}
                        onChange={handleContactChange("lastName")}
                        placeholder="Smith"
                        className="border-slate-300"
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="email" className="text-slate-700">Work Email</Label>
                    <Input
                      id="email"
                      type="email"
                      required
                      value={contactForm.email}
                      onChange={handleContactChange("email")}
                      placeholder="john.smith@nhs.uk"
                      className="border-slate-300"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="organisation" className="text-slate-700">Organisation</Label>
                    <Input
                      id="organisation"
                      value={contactForm.organization}
                      onChange={handleContactChange("organization")}
                      placeholder="NHS Trust / Company Name"
                      className="border-slate-300"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="role" className="text-slate-700">Your Role</Label>
                    <Input
                      id="role"
                      value={contactForm.role}
                      onChange={handleContactChange("role")}
                      placeholder="e.g., Clinical Director, CTO, Investor"
                      className="border-slate-300"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="message" className="text-slate-700">Message (Optional)</Label>
                    <Textarea
                      id="message"
                      placeholder="Tell us about your interest in CardioWatch..."
                      value={contactForm.message}
                      onChange={handleContactChange("message")}
                      className="border-slate-300 min-h-[100px]"
                    />
                  </div>
                  <Button type="submit" className="w-full bg-teal-600 hover:bg-teal-700 text-white h-11">
                    <Send size={16} className="mr-2" />
                    Submit Request
                  </Button>
                  <p className="text-xs text-slate-500 text-center">
                    Submitting opens your email client with a pre-filled message.
                  </p>
                </form>
              </Card>
            </div>
          </div>
        </section>

        <section className="container mx-auto px-4 pb-12 sm:pb-16">
          <Card className="border bg-card/90 p-6 sm:p-8">
            <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
              <div className="space-y-2">
                <h3 className="text-xl font-semibold text-foreground font-display sm:text-2xl">
                  Copyright and attribution
                </h3>
                <p className="text-sm text-muted-foreground">
                  This CardioWatch demo is curated and developed by Recep Adiyaman.
                  The content, flows, and visuals are original work prepared for
                  investor presentations and product discussions.
                </p>
              </div>
              <div className="space-y-3 text-sm text-foreground">
                <p>• Copyright (c) 2026 Recep Adiyaman. All rights reserved.</p>
                <p>• Demo data, patient records, and metrics are synthetic.</p>
                <p>• Distribution or reuse requires permission from the author.</p>
                <p>• Use this demo for evaluation and discussion only.</p>
              </div>
            </div>
          </Card>
        </section>

        <section className="container mx-auto px-4 pb-16 sm:pb-20">
          <Card className="flex flex-col items-start gap-4 border bg-card/90 p-6 sm:p-8 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h3 className="text-xl font-semibold text-foreground font-display sm:text-2xl">
                Ready for an investor walkthrough?
              </h3>
              <p className="text-sm text-muted-foreground">
                Run the patient demo and clinician dashboard in under 3 minutes.
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
          </Card>
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
