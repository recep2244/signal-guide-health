import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Slider } from "@/components/ui/slider";
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
} from "lucide-react";

const journeyTabs = [
  {
    value: "patient",
    label: "Patient flow",
    title: "Daily check-ins that feel human",
    description:
      "Patients receive an empathetic, structured check-in with Apple Watch sync and instant reassurance.",
    bullets: ["Symptom screening", "Medication adherence", "Wearable data sync"],
    ctaLabel: "Open patient demo",
    ctaTo: "/demo",
  },
  {
    value: "clinician",
    label: "Clinician flow",
    title: "Triage that reduces noise",
    description:
      "Clinicians get a ranked list of who needs attention, plus SBAR summaries and alert context.",
    bullets: ["Red/amber/green queues", "SBAR summaries", "Actionable alerts"],
    ctaLabel: "Open clinician dashboard",
    ctaTo: "/dashboard",
  },
  {
    value: "operations",
    label: "Operations flow",
    title: "Operational clarity for leadership",
    description:
      "Leaders see trends, throughput, and response times to keep programs funded and effective.",
    bullets: ["Response time tracking", "Escalation volumes", "Coverage confidence"],
    ctaLabel: "View investor summary",
    ctaTo: "/dashboard",
  },
];

const features = [
  {
    title: "Triage at a glance",
    description: "Red, amber, green queues highlight who needs action now.",
    icon: AlertIcon,
  },
  {
    title: "Wearable trend intelligence",
    description: "14-day baselines and deltas expose subtle decline early.",
    icon: LineChart,
  },
  {
    title: "Clinician-ready summaries",
    description: "SBAR summaries and alerts keep handoffs consistent.",
    icon: Stethoscope,
  },
  {
    title: "Live alerting",
    description: "Escalations notify teams fast with clear next steps.",
    icon: Bell,
  },
  {
    title: "Patient engagement",
    description: "Conversational check-ins boost adherence and trust.",
    icon: Users,
  },
  {
    title: "Secure by design",
    description: "Designed for clinical workflows and compliance.",
    icon: ShieldCheck,
  },
];

function AlertIcon({ className }: { className?: string }) {
  return <Activity className={className} />;
}

export default function Landing() {
  const navigate = useNavigate();
  const [patientsMonitored, setPatientsMonitored] = useState([140]);
  const [readmissionRate, setReadmissionRate] = useState([14]);

  const patientCount = patientsMonitored[0];
  const baselineRate = readmissionRate[0] / 100;
  const avoidedReadmissions = Math.max(1, Math.round(patientCount * baselineRate * 0.22));
  const estimatedSavings = avoidedReadmissions * 4200;

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 border-b bg-card/80 backdrop-blur-md">
        <div className="container mx-auto flex h-16 items-center justify-between px-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-primary-foreground">
              <Activity size={20} />
            </div>
            <div>
              <p className="text-sm font-semibold text-foreground">CardioWatch</p>
              <p className="text-xs text-muted-foreground">Signal Guide Health</p>
            </div>
          </div>
          <nav className="hidden items-center gap-6 text-xs text-muted-foreground md:flex">
            <a href="#impact" className="hover:text-foreground">Impact</a>
            <a href="#features" className="hover:text-foreground">Features</a>
            <a href="#journey" className="hover:text-foreground">Journeys</a>
            <a href="#why-now" className="hover:text-foreground">Why now</a>
          </nav>
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={() => navigate("/dashboard")}>
              Open Dashboard
            </Button>
            <Button onClick={() => navigate("/demo")}>View Demo</Button>
          </div>
        </div>
      </header>

      <main>
        <section className="relative overflow-hidden">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(12,148,128,0.18),transparent_55%),radial-gradient(circle_at_bottom_right,rgba(34,197,94,0.14),transparent_60%)]" />
          <div className="absolute -top-24 right-0 h-80 w-80 rounded-full bg-primary/10 blur-3xl" />
          <div className="absolute bottom-0 left-0 h-72 w-72 rounded-full bg-triage-green/10 blur-3xl" />

          <div className="container relative mx-auto grid gap-10 px-4 py-16 lg:grid-cols-[1.2fr_0.8fr] lg:py-24">
            <div className="space-y-6">
              <Badge className="w-fit bg-primary/10 text-primary">Investor presentation</Badge>
              <h1 className="text-4xl font-semibold tracking-tight text-foreground md:text-5xl font-display">
                CardioWatch turns post-discharge cardiac care into a proactive signal business.
              </h1>
              <p className="max-w-xl text-base leading-relaxed text-muted-foreground md:text-lg">
                A clinician-first platform that fuses wearable signals, patient check-ins,
                and triage automation to reduce readmissions and scale cardiac follow-up.
              </p>
              <div className="grid gap-2 text-sm text-muted-foreground">
                <span>Problem: high-cost readmissions in the first 30 days.</span>
                <span>Now: wearables and RPM finally deliver continuous signals.</span>
                <span>Solution: CardioWatch transforms signals into clinical action.</span>
              </div>
              <div className="flex flex-wrap gap-3">
                <Button size="lg" onClick={() => navigate("/demo")}>
                  Launch patient demo
                </Button>
                <Button size="lg" variant="outline" onClick={() => navigate("/dashboard")}>
                  Explore clinician view
                </Button>
              </div>
              <div className="flex flex-wrap gap-2">
                <Badge className="bg-secondary text-secondary-foreground">
                  <MessageCircle size={12} className="mr-1" />
                  WhatsApp outreach
                </Badge>
                <Badge className="bg-secondary text-secondary-foreground">
                  <Smartphone size={12} className="mr-1" />
                  SMS check-ins
                </Badge>
                <Badge className="bg-secondary text-secondary-foreground">
                  <Phone size={12} className="mr-1" />
                  Clinician calls
                </Badge>
              </div>
              <div className="flex flex-wrap gap-3 text-sm text-muted-foreground">
                <Card className="border bg-card/80 px-4 py-2">
                  <span className="flex items-center gap-2">
                    <Zap size={14} className="text-primary" />
                    Faster escalations
                  </span>
                </Card>
                <Card className="border bg-card/80 px-4 py-2">
                  <span className="flex items-center gap-2">
                    <Sparkles size={14} className="text-primary" />
                    Automated summaries
                  </span>
                </Card>
                <Card className="border bg-card/80 px-4 py-2">
                  <span className="flex items-center gap-2">
                    <ShieldCheck size={14} className="text-primary" />
                    Clinical-grade UX
                  </span>
                </Card>
              </div>
            </div>

            <div className="space-y-4">
              <Card className="card-interactive border bg-card/90 p-6 shadow-lg">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Snapshot
                </p>
                <div className="mt-4 grid grid-cols-2 gap-4">
                  <Card className="card-interactive p-4">
                    <p className="text-xs text-muted-foreground">Active alerts</p>
                    <p className="text-2xl font-semibold text-triage-red">2</p>
                  </Card>
                  <Card className="card-interactive p-4">
                    <p className="text-xs text-muted-foreground">Patients monitored</p>
                    <p className="text-2xl font-semibold text-foreground">128</p>
                  </Card>
                  <Card className="card-interactive p-4">
                    <p className="text-xs text-muted-foreground">Avg. response time</p>
                    <p className="text-2xl font-semibold text-foreground">12m</p>
                  </Card>
                  <Card className="card-interactive p-4">
                    <p className="text-xs text-muted-foreground">Readmission risk</p>
                    <p className="text-2xl font-semibold text-triage-amber">-18%</p>
                  </Card>
                </div>
              </Card>
              <Card className="card-interactive border bg-card/90 p-5">
                <div className="flex items-start gap-3">
                  <div className="rounded-lg bg-triage-green-bg p-2">
                    <Activity className="text-triage-green" size={18} />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-foreground">Signal integrity</p>
                    <p className="text-xs text-muted-foreground">
                      Trend baselines keep clinicians confident in the next action.
                    </p>
                  </div>
                </div>
              </Card>
              <Card className="card-interactive border bg-card/90 p-5">
                <div className="flex items-start gap-3">
                  <div className="rounded-lg bg-primary/10 p-2">
                    <MessageCircle className="text-primary" size={18} />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-foreground">Multi-channel engagement</p>
                    <p className="text-xs text-muted-foreground">
                      WhatsApp, SMS, and voice calls keep patients connected between visits.
                    </p>
                  </div>
                </div>
              </Card>
            </div>
          </div>
        </section>

        <section className="container mx-auto px-4 py-12">
          <div className="grid gap-6 rounded-3xl border bg-card/90 p-8 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
            <div className="space-y-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Investor snapshot
              </p>
              <h2 className="text-3xl font-semibold text-foreground font-display">
                A clinically credible wedge with clear ROI.
              </h2>
              <p className="text-sm text-muted-foreground">
                CardioWatch pairs a high-frequency data stream with actionable triage,
                enabling hospitals to reduce penalties and scale follow-up without adding staff.
              </p>
              <div className="flex flex-wrap gap-3">
                <Badge className="bg-secondary text-secondary-foreground">Triage automation</Badge>
                <Badge className="bg-secondary text-secondary-foreground">Wearable signals</Badge>
                <Badge className="bg-secondary text-secondary-foreground">SaaS + per-patient</Badge>
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <Card className="card-interactive p-4">
                <p className="text-xs text-muted-foreground">Target wedge</p>
                <p className="text-sm font-semibold text-foreground">Post-discharge cardiac care</p>
              </Card>
              <Card className="card-interactive p-4">
                <p className="text-xs text-muted-foreground">Primary buyer</p>
                <p className="text-sm font-semibold text-foreground">Hospital systems</p>
              </Card>
              <Card className="card-interactive p-4">
                <p className="text-xs text-muted-foreground">Value drivers</p>
                <p className="text-sm font-semibold text-foreground">Readmission reduction</p>
              </Card>
              <Card className="card-interactive p-4">
                <p className="text-xs text-muted-foreground">Differentiator</p>
                <p className="text-sm font-semibold text-foreground">Clinician-ready signals</p>
              </Card>
            </div>
          </div>
        </section>

        <section className="container mx-auto px-4 pb-12">
          <Card className="border bg-card/90 p-6">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Traction & pilots
                </p>
                <p className="text-sm text-muted-foreground">
                  Placeholder logos until pilot partners are announced.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Badge className="bg-secondary text-secondary-foreground">Pilot Hospital A</Badge>
                <Badge className="bg-secondary text-secondary-foreground">Clinical Partner B</Badge>
                <Badge className="bg-secondary text-secondary-foreground">RPM Network C</Badge>
                <Badge className="bg-secondary text-secondary-foreground">Insurer D</Badge>
              </div>
            </div>
          </Card>
        </section>

        <section id="impact" className="container mx-auto px-4 py-16">
          <div className="grid gap-8 lg:grid-cols-[1fr_1.1fr] lg:items-center">
            <div className="space-y-4">
              <Badge className="w-fit bg-secondary text-secondary-foreground">Impact simulator</Badge>
              <h2 className="text-3xl font-semibold text-foreground font-display">
                See how small signal gains compound into real savings.
              </h2>
              <p className="text-sm leading-relaxed text-muted-foreground">
                Adjust the patient volume and baseline readmission rate to visualize
                how earlier escalation changes outcomes. These figures are illustrative
                and meant for investor discussions.
              </p>
            </div>
            <Card className="border bg-card/90 p-6">
              <div className="space-y-5">
                <div>
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>Patients monitored</span>
                    <span>{patientCount.toLocaleString()}</span>
                  </div>
                  <Slider
                    value={patientsMonitored}
                    onValueChange={setPatientsMonitored}
                    min={50}
                    max={400}
                    step={10}
                    className="mt-3"
                  />
                </div>
                <div>
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>Baseline readmission rate</span>
                    <span>{readmissionRate[0]}%</span>
                  </div>
                  <Slider
                    value={readmissionRate}
                    onValueChange={setReadmissionRate}
                    min={6}
                    max={20}
                    step={1}
                    className="mt-3"
                  />
                </div>
                <div className="grid gap-4 md:grid-cols-3">
                  <Card className="border bg-secondary/70 p-4">
                    <p className="text-xs text-muted-foreground">Avoided readmissions</p>
                    <p className="text-2xl font-semibold text-foreground">{avoidedReadmissions}</p>
                  </Card>
                  <Card className="border bg-secondary/70 p-4">
                    <p className="text-xs text-muted-foreground">Estimated savings</p>
                    <p className="text-2xl font-semibold text-foreground">
                      £{estimatedSavings.toLocaleString()}
                    </p>
                  </Card>
                  <Card className="border bg-secondary/70 p-4">
                    <p className="text-xs text-muted-foreground">Response SLA</p>
                    <p className="text-2xl font-semibold text-foreground">{"<"}15m</p>
                  </Card>
                </div>
                <p className="text-xs text-muted-foreground">
                  Model assumes a 22% reduction in avoidable readmissions based on proactive triage.
                </p>
              </div>
            </Card>
          </div>
        </section>

        <section className="container mx-auto px-4 pb-16">
          <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
            <Card className="border bg-card/90 p-6">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Clinical outcomes
              </p>
              <div className="mt-4 grid gap-3 sm:grid-cols-3">
                <Card className="card-interactive p-4">
                  <p className="text-xs text-muted-foreground">Readmissions</p>
                  <p className="text-2xl font-semibold text-foreground">-22%</p>
                </Card>
                <Card className="card-interactive p-4">
                  <p className="text-xs text-muted-foreground">Response time</p>
                  <p className="text-2xl font-semibold text-foreground">12m</p>
                </Card>
                <Card className="card-interactive p-4">
                  <p className="text-xs text-muted-foreground">Adherence</p>
                  <p className="text-2xl font-semibold text-foreground">+31%</p>
                </Card>
              </div>
              <p className="mt-3 text-xs text-muted-foreground">
                Illustrative metrics for pitch use; replace with pilot results when available.
              </p>
            </Card>
            <Card className="border bg-card/90 p-6">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Unit economics
              </p>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <Card className="card-interactive p-4">
                  <p className="text-xs text-muted-foreground">Per-patient revenue</p>
                  <p className="text-sm font-semibold text-foreground">£28 / month</p>
                </Card>
                <Card className="card-interactive p-4">
                  <p className="text-xs text-muted-foreground">Cost to serve</p>
                  <p className="text-sm font-semibold text-foreground">£8 / month</p>
                </Card>
                <Card className="card-interactive p-4">
                  <p className="text-xs text-muted-foreground">Gross margin</p>
                  <p className="text-sm font-semibold text-foreground">71%</p>
                </Card>
                <Card className="card-interactive p-4">
                  <p className="text-xs text-muted-foreground">Payback</p>
                  <p className="text-sm font-semibold text-foreground">{"<"}2 months</p>
                </Card>
              </div>
            </Card>
          </div>
        </section>

        <section id="features" className="container mx-auto px-4 py-16">
          <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div>
              <h2 className="text-3xl font-semibold text-foreground font-display">Platform features</h2>
              <p className="text-sm text-muted-foreground">
                Built for clinical clarity, operational scale, and investor-ready storytelling.
              </p>
            </div>
            <Button variant="outline" onClick={() => navigate("/demo")}>
              See the flow
            </Button>
          </div>
          <div className="mt-8 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {features.map((feature) => {
              const Icon = feature.icon;
              return (
                <Card key={feature.title} className="card-interactive p-5">
                  <div className="flex items-start gap-3">
                    <div className="rounded-lg bg-primary/10 p-2">
                      <Icon className="text-primary" size={18} />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-foreground">{feature.title}</p>
                      <p className="text-xs text-muted-foreground">{feature.description}</p>
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        </section>

        <section className="container mx-auto px-4 pb-16">
          <div className="grid gap-6 md:grid-cols-3">
            <Card className="card-interactive p-5">
              <p className="text-xs text-muted-foreground">Investment highlights</p>
              <p className="mt-2 text-sm font-semibold text-foreground">High-frequency data moat</p>
              <p className="text-xs text-muted-foreground">
                Continuous signal ingestion builds longitudinal patient profiles.
              </p>
            </Card>
            <Card className="card-interactive p-5">
              <p className="text-xs text-muted-foreground">Operational leverage</p>
              <p className="mt-2 text-sm font-semibold text-foreground">Nurse time saved</p>
              <p className="text-xs text-muted-foreground">
                Triage automation reduces manual follow-up workload.
              </p>
            </Card>
            <Card className="card-interactive p-5">
              <p className="text-xs text-muted-foreground">Clinical credibility</p>
              <p className="mt-2 text-sm font-semibold text-foreground">SBAR-first design</p>
              <p className="text-xs text-muted-foreground">
                Structured summaries match clinical handoff workflows.
              </p>
            </Card>
          </div>
        </section>

        <section className="container mx-auto px-4 pb-16">
          <div className="grid gap-6 lg:grid-cols-[1fr_1.1fr] lg:items-center">
            <Card className="border bg-card/90 p-6">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Product walkthrough
              </p>
              <div className="mt-4 flex h-48 items-center justify-center rounded-2xl border border-dashed border-muted-foreground/30 bg-secondary/40">
                <div className="text-center">
                  <p className="text-sm font-semibold text-foreground">Insert 60-second demo video</p>
                  <p className="text-xs text-muted-foreground">Replace with an embed or hosted video URL.</p>
                  <Button className="mt-3" variant="outline" size="sm">
                    Upload video
                  </Button>
                </div>
              </div>
            </Card>
            <Card className="border bg-card/90 p-6">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Compliance roadmap
              </p>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <Card className="card-interactive p-4">
                  <p className="text-xs text-muted-foreground">GDPR / UK GDPR</p>
                  <p className="text-sm font-semibold text-foreground">Data governance ready</p>
                </Card>
                <Card className="card-interactive p-4">
                  <p className="text-xs text-muted-foreground">NHS DSPT</p>
                  <p className="text-sm font-semibold text-foreground">Targeting DSPT compliance</p>
                </Card>
                <Card className="card-interactive p-4">
                  <p className="text-xs text-muted-foreground">ISO 27001</p>
                  <p className="text-sm font-semibold text-foreground">Roadmap in progress</p>
                </Card>
                <Card className="card-interactive p-4">
                  <p className="text-xs text-muted-foreground">Clinical safety</p>
                  <p className="text-sm font-semibold text-foreground">DCB0129 planned</p>
                </Card>
              </div>
            </Card>
          </div>
        </section>

        <section id="journey" className="container mx-auto px-4 pb-16">
          <Card className="border bg-card/90 p-6">
            <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
              <div>
                <h2 className="text-3xl font-semibold text-foreground font-display">
                  Choose the story you want to tell
                </h2>
                <p className="text-sm text-muted-foreground">
                  Switch between the patient, clinician, and operations narratives.
                </p>
              </div>
              <Badge className="w-fit bg-primary/10 text-primary">Interactive overview</Badge>
            </div>
            <Tabs defaultValue="patient" className="mt-6">
              <TabsList className="bg-secondary/70">
                {journeyTabs.map((tab) => (
                  <TabsTrigger key={tab.value} value={tab.value}>
                    {tab.label}
                  </TabsTrigger>
                ))}
              </TabsList>
              {journeyTabs.map((tab) => (
                <TabsContent key={tab.value} value={tab.value} className="mt-6">
                  <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
                    <div className="space-y-3">
                      <h3 className="text-2xl font-semibold text-foreground">{tab.title}</h3>
                      <p className="text-sm text-muted-foreground">{tab.description}</p>
                      <div className="flex flex-wrap gap-2">
                        {tab.bullets.map((bullet) => (
                          <Badge key={bullet} className="bg-secondary text-secondary-foreground">
                            {bullet}
                          </Badge>
                        ))}
                      </div>
                    </div>
                    <Card className="border bg-secondary/60 p-5">
                      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        Demo entry
                      </p>
                      <p className="mt-2 text-sm text-muted-foreground">
                        Navigate directly to the live demo that supports this narrative.
                      </p>
                      <Button asChild className="mt-4 w-full" variant="outline">
                        <Link to={tab.ctaTo}>{tab.ctaLabel}</Link>
                      </Button>
                    </Card>
                  </div>
                </TabsContent>
              ))}
            </Tabs>
          </Card>
        </section>

        <section id="why-now" className="container mx-auto px-4 pb-16">
          <div className="grid gap-8 lg:grid-cols-[1.1fr_0.9fr]">
            <div className="space-y-4">
              <h2 className="text-3xl font-semibold text-foreground font-display">Why this project, why now</h2>
              <p className="text-sm text-muted-foreground">
                CardioWatch exists to close the gap between discharge and the first critical
                weeks at home. The rise of wearable data, remote patient monitoring, and
                clinician capacity constraints makes proactive triage essential.
              </p>
              <div className="grid gap-3 sm:grid-cols-3">
                <Card className="border bg-card/80 p-4">
                  <p className="text-xs text-muted-foreground">Critical window</p>
                  <p className="text-sm font-semibold text-foreground">First 30 days</p>
                </Card>
                <Card className="border bg-card/80 p-4">
                  <p className="text-xs text-muted-foreground">Signal density</p>
                  <p className="text-sm font-semibold text-foreground">24/7 wearables</p>
                </Card>
                <Card className="border bg-card/80 p-4">
                  <p className="text-xs text-muted-foreground">Resource pressure</p>
                  <p className="text-sm font-semibold text-foreground">Lean teams</p>
                </Card>
              </div>
                <Card className="border bg-card/90 p-5">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Created by
                  </p>
                  <p className="mt-2 text-lg font-semibold text-foreground">Recep Adiyaman, PhD</p>
                  <p className="text-sm text-muted-foreground">
                    Research scientist focused on applied clinical AI and health signal intelligence.
                    CardioWatch reflects deep research in biomedical signals, human-centered design,
                    and evidence-driven triage workflows.
                  </p>
                </Card>
            </div>
            <Card className="border bg-card/90 p-6">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Interactive rationale
              </p>
              <Accordion type="single" collapsible className="mt-3">
                <AccordionItem value="care-gap">
                  <AccordionTrigger>Care gaps are expensive</AccordionTrigger>
                  <AccordionContent>
                    Post-discharge complications are common and costly. CardioWatch surfaces early
                    signals so teams can intervene before avoidable readmissions occur.
                  </AccordionContent>
                </AccordionItem>
                <AccordionItem value="wearables">
                  <AccordionTrigger>Wearables are finally signal-rich</AccordionTrigger>
                  <AccordionContent>
                    Consumer devices now capture reliable heart rate, HRV, sleep, and activity data.
                    We translate those signals into clear clinical decisions.
                  </AccordionContent>
                </AccordionItem>
                <AccordionItem value="capacity">
                  <AccordionTrigger>Clinician capacity is stretched</AccordionTrigger>
                  <AccordionContent>
                    Automated triage prioritizes the most urgent patients while keeping the rest
                    safely monitored, reducing noise without losing oversight.
                  </AccordionContent>
                </AccordionItem>
              </Accordion>
            </Card>
          </div>
        </section>

        <section className="container mx-auto px-4 pb-16">
          <div className="grid gap-6 rounded-3xl bg-secondary/60 p-8 lg:grid-cols-2">
            <div className="space-y-3">
              <h3 className="text-2xl font-semibold text-foreground font-display">Why investors care</h3>
              <p className="text-sm text-muted-foreground">
                CardioWatch targets a high-cost, high-volume segment with clear ROI.
              </p>
              <div className="space-y-2 text-sm text-foreground">
                <p>• Readmission prevention lowers penalties and improves margins.</p>
                <p>• Nurse workload scales with smart triage, not headcount.</p>
                <p>• Wearable data unlocks continuous post-discharge engagement.</p>
              </div>
            </div>
            <div className="space-y-3">
              <h3 className="text-2xl font-semibold text-foreground font-display">Go-to-market ready</h3>
              <p className="text-sm text-muted-foreground">
                Demo-ready workflows let stakeholders experience the patient and clinician journey.
              </p>
              <div className="grid gap-3 sm:grid-cols-2">
                <Card className="p-4">
                  <p className="text-xs text-muted-foreground">Target customers</p>
                  <p className="text-sm font-semibold text-foreground">Hospital systems</p>
                </Card>
                <Card className="p-4">
                  <p className="text-xs text-muted-foreground">Revenue model</p>
                  <p className="text-sm font-semibold text-foreground">SaaS + per-patient</p>
                </Card>
                <Card className="p-4">
                  <p className="text-xs text-muted-foreground">Data sources</p>
                  <p className="text-sm font-semibold text-foreground">Wearables + RPM</p>
                </Card>
                <Card className="p-4">
                  <p className="text-xs text-muted-foreground">Clinical impact</p>
                  <p className="text-sm font-semibold text-foreground">Faster escalations</p>
                </Card>
              </div>
            </div>
          </div>
        </section>

        <section className="container mx-auto px-4 pb-16">
          <Card className="border bg-card/90 p-6">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Roadmap</p>
            <div className="mt-4 grid gap-3 md:grid-cols-3">
              <Card className="card-interactive p-4">
                <p className="text-xs text-muted-foreground">Phase 1</p>
                <p className="text-sm font-semibold text-foreground">Pilot deployments</p>
                <p className="text-xs text-muted-foreground">Clinical validation and feedback loops.</p>
              </Card>
              <Card className="card-interactive p-4">
                <p className="text-xs text-muted-foreground">Phase 2</p>
                <p className="text-sm font-semibold text-foreground">Scale to cohorts</p>
                <p className="text-xs text-muted-foreground">Expand to new cardiac pathways.</p>
              </Card>
              <Card className="card-interactive p-4">
                <p className="text-xs text-muted-foreground">Phase 3</p>
                <p className="text-sm font-semibold text-foreground">Operational platform</p>
                <p className="text-xs text-muted-foreground">Integrate with EHR and RPM networks.</p>
              </Card>
            </div>
          </Card>
        </section>

        <section className="container mx-auto px-4 pb-16">
          <div className="grid gap-4 lg:grid-cols-2">
            <Card className="p-6">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Customer demo
              </p>
              <h3 className="mt-2 text-xl font-semibold text-foreground">
                Patient experience
              </h3>
              <p className="mt-2 text-sm text-muted-foreground">
                Walk through the daily check-in and escalation flow.
              </p>
              <Button asChild className="mt-4">
                <Link to="/demo">Open patient demo</Link>
              </Button>
            </Card>
            <Card className="p-6">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Doctor demo
              </p>
              <h3 className="mt-2 text-xl font-semibold text-foreground">
                Clinician dashboard
              </h3>
              <p className="mt-2 text-sm text-muted-foreground">
                Review triage, alerts, SBAR summaries, and vitals.
              </p>
              <Button asChild variant="outline" className="mt-4">
                <Link to="/dashboard">Open clinician view</Link>
              </Button>
            </Card>
          </div>
        </section>

        <section className="container mx-auto px-4 pb-16">
          <Card className="border bg-card/90 p-6">
            <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
              <div>
                <h3 className="text-2xl font-semibold text-foreground font-display">
                  Wearable data coverage
                </h3>
                <p className="text-sm text-muted-foreground">
                  CardioWatch converts wearable signals into actionable clinical context.
                  Works with Apple Watch today and is extensible to Fitbit, Garmin, and clinical RPM devices.
                </p>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <Card className="border bg-secondary/60 p-4">
                  <p className="text-xs text-muted-foreground">Vitals</p>
                  <p className="text-sm font-semibold text-foreground">Resting HR, HRV, pulse trends</p>
                </Card>
                <Card className="border bg-secondary/60 p-4">
                  <p className="text-xs text-muted-foreground">Recovery</p>
                  <p className="text-sm font-semibold text-foreground">Sleep hours, quality, variability</p>
                </Card>
                <Card className="border bg-secondary/60 p-4">
                  <p className="text-xs text-muted-foreground">Activity</p>
                  <p className="text-sm font-semibold text-foreground">Steps, exertion, mobility</p>
                </Card>
                <Card className="border bg-secondary/60 p-4">
                  <p className="text-xs text-muted-foreground">Trends</p>
                  <p className="text-sm font-semibold text-foreground">14-day baselines</p>
                </Card>
              </div>
            </div>
          </Card>
        </section>

        <section className="container mx-auto px-4 pb-16">
          <Card className="border bg-card/90 p-8">
            <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
              <div className="space-y-2">
                <h3 className="text-2xl font-semibold text-foreground font-display">
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

        <section className="container mx-auto px-4 pb-20">
          <Card className="flex flex-col items-start gap-4 border bg-card/90 p-8 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h3 className="text-2xl font-semibold text-foreground font-display">
                Ready for an investor walkthrough?
              </h3>
              <p className="text-sm text-muted-foreground">
                Run the patient demo and clinician dashboard in under 3 minutes.
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <Button size="lg" onClick={() => navigate("/demo")}>
                Launch demo
              </Button>
              <Button size="lg" variant="outline" onClick={() => navigate("/dashboard")}>
                Open dashboard
              </Button>
            </div>
          </Card>
        </section>
      </main>

      <footer className="border-t bg-card/60">
        <div className="container mx-auto flex flex-col gap-2 px-4 py-6 text-xs text-muted-foreground md:flex-row md:items-center md:justify-between">
          <span>Copyright (c) 2026 Recep Adiyaman. All rights reserved.</span>
          <span>Curated CardioWatch demo for investor presentations.</span>
        </div>
      </footer>
    </div>
  );
}
