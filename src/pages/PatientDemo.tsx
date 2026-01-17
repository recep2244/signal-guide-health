import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Heart, Send, ArrowLeft, Watch, Phone, AlertTriangle, MessageCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Message {
  id: string;
  role: 'patient' | 'agent';
  content: string;
  timestamp: Date;
  options?: string[];
}

type FlowStep = { content: string; options?: string[] };

interface TimelineEvent {
  id: string;
  label: string;
  time: string;
  status?: 'info' | 'success' | 'warning' | 'danger';
}

const CLINICIAN_NAME = "Dr. X";
const WATCH_SNAPSHOT = {
  restingHR: 71,
  hrv: 44,
  sleepHours: 6.8,
  steps: 3450,
  lastSync: "2 min ago",
};

const HR_TREND = [62, 64, 63, 66, 68, 65, 63];
const HR_TREND_MIN = Math.min(...HR_TREND);
const HR_TREND_RANGE = Math.max(...HR_TREND) - HR_TREND_MIN || 1;

const WATCH_SUMMARY =
  "Real-time trends look stable. Resting HR is within baseline and sleep recovery is adequate.";

const NON_URGENT_SYMPTOMS = [
  "Fatigue or low energy",
  "Dizziness when standing",
  "Palpitations (skipped beats)",
  "Swelling in legs or ankles",
  "None of these",
];

const NON_URGENT_SYMPTOM_STEP_INDEX = 3;
const WEARABLE_STEP_INDEX = 4;
const ACTIVITY_STEP_INDEX = 5;
const MEDICATION_STEP_INDEX = 6;

const FINAL_SUMMARY: FlowStep = {
  content:
    "Thanks for checking in. ✅ **Triage: GREEN (Stable)**\n" +
    "• Wearable update sent to your care team\n" +
    "• No red flag symptoms reported\n" +
    "• Next check-in scheduled for tomorrow\n\n" +
    "If you develop chest pain, shortness of breath at rest, or fainting, seek urgent care.",
  options: ["Clinician response", "Continue check-in"],
};

const QUICK_ACTIONS_OPTIONS = [
  "Request ambulance",
  "Request appointment",
  "Request medicine",
  "Side effects",
  "Call clinician",
  "Notify family",
  "File a complaint",
  "Continue check-in",
];

const DEMO_FLOW: FlowStep[] = [
  {
    content:
      "Good morning! 👋 I'm your CardioWatch assistant on WhatsApp. I'll be checking in with you daily to help monitor your recovery.\n\n" +
      "If you need urgent or practical help now, pick one of the quick actions below, or continue the check-in.",
    options: QUICK_ACTIONS_OPTIONS,
  },
  {
    content: "Thanks. How are you feeling today on a scale of 0-10?",
    options: ["8 - Feeling good", "6 - Okay", "4 - Not great", "2 - Struggling"],
  },
  {
    content: "Thank you for sharing. Before we continue, I need to ask about any urgent symptoms.\n\nAre you experiencing any of the following right now?",
    options: ["Chest pain or pressure", "Shortness of breath at rest", "Fainting or near-fainting", "None of these"],
  },
  {
    content: "Thanks. Any non-urgent symptoms today that you want us to track?",
    options: NON_URGENT_SYMPTOMS,
  },
  {
    content:
      `Apple Watch/Fitbit notification received (${WATCH_SNAPSHOT.lastSync}).` +
      `\n• Resting HR: ${WATCH_SNAPSHOT.restingHR} bpm` +
      `\n• HRV: ${WATCH_SNAPSHOT.hrv} ms` +
      `\n• Sleep: ${WATCH_SNAPSHOT.sleepHours} hrs` +
      `\n• Steps: ${WATCH_SNAPSHOT.steps.toLocaleString()}` +
      `\n\nSummary: ${WATCH_SUMMARY}` +
      `\n\nI've sent this update to ${CLINICIAN_NAME}'s team. Please keep your wearable on so we can monitor trends. Does this look right?`,
    options: ["Looks correct", "Report sync issue"],
  },
  {
    content: "Thanks. Have you noticed any changes in how you feel during physical activity?",
    options: ["Feeling stronger", "About the same", "More tired than usual", "Getting breathless easier"],
  },
  {
    content: "That's wonderful progress! Your wearable data supports this - your activity levels have been increasing steadily. 📈\n\nAre you taking all your medications as prescribed?",
    options: ["Yes, all of them", "Missed one dose", "Having side effects", "Need a refill soon"],
  },
  {
    content: "Do you need any additional help today?",
    options: [
      "Request ambulance",
      "Request appointment",
      "Request medicine",
      "Side effects",
      "Call clinician",
      "Notify family",
      "File a complaint",
      "Nothing else",
    ],
  },
  FINAL_SUMMARY,
];

// Alternative flow for concerning symptoms
const CONCERN_FLOW: FlowStep[] = [
  {
    content: "I'm sorry to hear that. Can you tell me more about what you're experiencing?\n\nWhen did this start?",
    options: ["Just now", "A few hours ago", "Since yesterday", "Getting worse over days"],
  },
  {
    content: "I understand. On a scale of 0-10, how severe would you rate this symptom?",
    options: ["Mild (1-3)", "Moderate (4-6)", "Severe (7-8)", "Very severe (9-10)"],
  },
  {
    content: "⚠️ Based on what you've shared, I'm flagging this for your care team to review today.\n\n**Triage: AMBER (Review Today)**\n\nYour symptoms combined with your recent procedure warrant a same-day check. A member of your care team will contact you within the next few hours.\n\nIn the meantime:\n• Rest and don't overexert yourself\n• Keep your phone nearby\n• If symptoms suddenly worsen, seek urgent care\n\nIs there anything else you'd like me to note for your care team?",
    options: ["No, that's all", "Yes, I have more to add"],
  },
];

const buildSymptomFlow = (symptomLabel: string): FlowStep[] => [
  {
    content: `Thanks for letting me know about ${symptomLabel.toLowerCase()}. How severe is it right now?`,
    options: ["Mild", "Moderate", "Severe"],
  },
  {
    content: "When did it start?",
    options: ["Today", "Past few days", "Over a week"],
  },
  {
    content: `Got it. I'll share this with ${CLINICIAN_NAME} and keep monitoring. Ready to continue the check-in?`,
    options: ["Continue check-in"],
  },
];

const SYMPTOM_FLOWS: Record<string, FlowStep[]> = {
  "Fatigue or low energy": buildSymptomFlow("fatigue or low energy"),
  "Dizziness when standing": buildSymptomFlow("dizziness when standing"),
  "Palpitations (skipped beats)": buildSymptomFlow("palpitations or skipped beats"),
  "Swelling in legs or ankles": buildSymptomFlow("swelling in legs or ankles"),
};

const DEFAULT_SYMPTOM_FLOW = buildSymptomFlow("that symptom");

// Urgent flow
const URGENT_FLOW: FlowStep[] = [
  {
    content: "⚠️ **This could be serious.**\n\nChest pain or pressure after your procedure needs immediate medical attention.\n\n**Please seek urgent care NOW or call 999 if:**\n• Pain is severe or worsening\n• You feel short of breath\n• You feel sweaty, nauseous, or dizzy\n\n🚨 I'm alerting your care team immediately.\n\nDo you have someone with you who can help?",
  },
];

const REFILL_FLOW: FlowStep[] = [
  {
    content: `I can request a refill and draft a prescription for ${CLINICIAN_NAME} to sign. Which pharmacy should we use?`,
    options: ["Same pharmacy on file", "Different pharmacy"],
  },
  {
    content: `Refill request created and sent to ${CLINICIAN_NAME}. We'll notify you when the prescription is issued and medication is ready.`,
    options: ["Track delivery", "Continue check-in"],
  },
  FINAL_SUMMARY,
];

const CALL_FLOW: FlowStep[] = [
  {
    content: `I can contact ${CLINICIAN_NAME}'s office. When should they call you?`,
    options: ["Call now", "Later today", "Schedule tomorrow"],
  },
  {
    content: `Request sent. ${CLINICIAN_NAME}'s team will reach you at your preferred time.`,
    options: ["Continue check-in"],
  },
  FINAL_SUMMARY,
];

const COMPLAINT_FLOW: FlowStep[] = [
  {
    content: "I'm sorry about that. What would you like to report?",
    options: ["Care quality concern", "Communication issue", "Billing or admin issue"],
  },
  {
    content: "Complaint logged and routed to patient experience. A coordinator will follow up within 1 business day.",
    options: ["Continue check-in"],
  },
  FINAL_SUMMARY,
];

const SIDE_EFFECT_FLOW: FlowStep[] = [
  {
    content: "Thanks for telling me. How severe are the side effects?",
    options: ["Mild", "Moderate", "Severe"],
  },
  {
    content:
      "I've logged this and alerted your care team. If symptoms worsen, seek urgent care or call 999.",
    options: ["Continue check-in"],
  },
  FINAL_SUMMARY,
];

const DELIVERY_FLOW: FlowStep[] = [
  {
    content: "Medication delivery options:",
    options: ["Home delivery (2 hours)", "Pickup from pharmacy"],
  },
  {
    content: "Delivery scheduled. ETA 2 hours. We'll send a confirmation when it's dispatched.",
    options: ["Continue check-in"],
  },
  FINAL_SUMMARY,
];

const FAMILY_FLOW: FlowStep[] = [
  {
    content: "Who should we notify?",
    options: ["Primary caregiver", "Family contact", "Emergency contact"],
  },
  {
    content: "Notification sent. We'll keep them updated on your status.",
    options: ["Continue check-in"],
  },
  FINAL_SUMMARY,
];

const CLINICIAN_RESPONSE_FLOW: FlowStep[] = [
  {
    content:
      `${CLINICIAN_NAME} responded: "Reviewed the latest Apple Watch trends. No urgent concerns. Continue current meds and hydrate. We'll check in tomorrow."`,
    options: ["Continue check-in"],
  },
  FINAL_SUMMARY,
];

const APPOINTMENT_FLOW: FlowStep[] = [
  {
    content: "I can arrange an appointment. When would you like to be seen?",
    options: ["Today", "This week", "Next week"],
  },
  {
    content: `Appointment request sent to ${CLINICIAN_NAME}'s scheduling team. We'll confirm your slot soon.`,
    options: ["Continue check-in"],
  },
  FINAL_SUMMARY,
];

const AMBULANCE_FLOW: FlowStep[] = [
  {
    content:
      "If you are experiencing severe chest pain, shortness of breath at rest, or fainting, please call 999 now.\n\n" +
      `I have alerted ${CLINICIAN_NAME}'s team and flagged this as urgent.`,
    options: ["Continue check-in"],
  },
  FINAL_SUMMARY,
];

const AGENT_TYPING_DELAY_MS = 1100;

export default function PatientDemo() {
  const navigate = useNavigate();
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [currentStep, setCurrentStep] = useState(0);
  const [flowType, setFlowType] = useState<
    | 'normal'
    | 'concern'
    | 'urgent'
    | 'symptom'
    | 'refill'
    | 'call'
    | 'complaint'
    | 'sideEffect'
    | 'appointment'
    | 'ambulance'
    | 'delivery'
    | 'family'
    | 'clinicianResponse'
  >('normal');
  const [timelineEvents, setTimelineEvents] = useState<TimelineEvent[]>([]);
  const [selectedSymptom, setSelectedSymptom] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [demoStarted, setDemoStarted] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
  };

  const addTimelineEvent = (label: string, status: TimelineEvent['status'] = 'info') => {
    const now = new Date();
    setTimelineEvents(prev => [
      ...prev,
      {
        id: `timeline-${now.getTime()}-${Math.random().toString(36).slice(2, 7)}`,
        label,
        time: formatTime(now),
        status,
      },
    ]);
  };

  const getCurrentFlow = () => {
    switch (flowType) {
      case 'concern':
        return CONCERN_FLOW;
      case 'urgent':
        return URGENT_FLOW;
      case 'symptom':
        return SYMPTOM_FLOWS[selectedSymptom] ?? DEFAULT_SYMPTOM_FLOW;
      case 'refill':
        return REFILL_FLOW;
      case 'call':
        return CALL_FLOW;
      case 'complaint':
        return COMPLAINT_FLOW;
      case 'sideEffect':
        return SIDE_EFFECT_FLOW;
      case 'appointment':
        return APPOINTMENT_FLOW;
      case 'ambulance':
        return AMBULANCE_FLOW;
      case 'delivery':
        return DELIVERY_FLOW;
      case 'family':
        return FAMILY_FLOW;
      case 'clinicianResponse':
        return CLINICIAN_RESPONSE_FLOW;
      default:
        return DEMO_FLOW;
    }
  };

  const addAgentMessage = (content: string, options?: string[]) => {
    setIsTyping(true);
    setTimeout(() => {
      setMessages(prev => [
        ...prev,
        {
          id: `agent-${Date.now()}`,
          role: 'agent',
          content,
          timestamp: new Date(),
          options,
        },
      ]);
      setIsTyping(false);
    }, AGENT_TYPING_DELAY_MS);
  };

  const startDemo = () => {
    setDemoStarted(true);
    setFlowType('normal');
    setCurrentStep(0);
    setTimelineEvents([]);
    setSelectedSymptom('');
    const firstMessage = DEMO_FLOW[0];
    addAgentMessage(firstMessage.content, firstMessage.options);
    addTimelineEvent("Check-in started", "info");
  };

  const handleOptionSelect = (option: string) => {
    // Add patient message
    setMessages(prev => [
      ...prev,
      {
        id: `patient-${Date.now()}`,
        role: 'patient',
        content: option,
        timestamp: new Date(),
      },
    ]);

    // Determine flow based on selection
    if (QUICK_ACTIONS_OPTIONS.includes(option) && option !== "Continue check-in") {
      if (option === "Request ambulance") {
        setFlowType('ambulance');
        setCurrentStep(0);
        addTimelineEvent("Ambulance requested", "danger");
        setTimeout(() => {
          addAgentMessage(AMBULANCE_FLOW[0].content, AMBULANCE_FLOW[0].options);
        }, 500);
        return;
      }
      if (option === "Request appointment") {
        setFlowType('appointment');
        setCurrentStep(0);
        addTimelineEvent("Appointment requested", "info");
        setTimeout(() => {
          addAgentMessage(APPOINTMENT_FLOW[0].content, APPOINTMENT_FLOW[0].options);
        }, 500);
        return;
      }
      if (option === "Request medicine") {
        setFlowType('refill');
        setCurrentStep(0);
        addTimelineEvent("Prescription refill requested", "info");
        setTimeout(() => {
          addAgentMessage(REFILL_FLOW[0].content, REFILL_FLOW[0].options);
        }, 500);
        return;
      }
      if (option === "Side effects") {
        setFlowType('sideEffect');
        setCurrentStep(0);
        addTimelineEvent("Side effects reported", "warning");
        setTimeout(() => {
          addAgentMessage(SIDE_EFFECT_FLOW[0].content, SIDE_EFFECT_FLOW[0].options);
        }, 500);
        return;
      }
      if (option === "Call clinician") {
        setFlowType('call');
        setCurrentStep(0);
        addTimelineEvent("Clinician call requested", "info");
        setTimeout(() => {
          addAgentMessage(CALL_FLOW[0].content, CALL_FLOW[0].options);
        }, 500);
        return;
      }
      if (option === "Notify family") {
        setFlowType('family');
        setCurrentStep(0);
        addTimelineEvent("Family notified", "info");
        setTimeout(() => {
          addAgentMessage(FAMILY_FLOW[0].content, FAMILY_FLOW[0].options);
        }, 500);
        return;
      }
      if (option === "File a complaint") {
        setFlowType('complaint');
        setCurrentStep(0);
        addTimelineEvent("Complaint filed", "warning");
        setTimeout(() => {
          addAgentMessage(COMPLAINT_FLOW[0].content, COMPLAINT_FLOW[0].options);
        }, 500);
        return;
      }
    }

    if (option === "Track delivery") {
      setFlowType('delivery');
      setCurrentStep(0);
      addTimelineEvent("Medication delivery tracking opened", "info");
      setTimeout(() => {
        addAgentMessage(DELIVERY_FLOW[0].content, DELIVERY_FLOW[0].options);
      }, 500);
      return;
    }

    if (option === "Clinician response") {
      setFlowType('clinicianResponse');
      setCurrentStep(0);
      addTimelineEvent("Clinician response received", "success");
      setTimeout(() => {
        addAgentMessage(CLINICIAN_RESPONSE_FLOW[0].content, CLINICIAN_RESPONSE_FLOW[0].options);
      }, 500);
      return;
    }

    if (flowType === 'symptom') {
      const flow = getCurrentFlow();
      const nextStep = currentStep + 1;
      if (option === "Continue check-in" || nextStep >= flow.length) {
        setFlowType('normal');
        setCurrentStep(WEARABLE_STEP_INDEX);
        addTimelineEvent("Wearable sync received", "info");
        setTimeout(() => {
          addAgentMessage(DEMO_FLOW[WEARABLE_STEP_INDEX].content, DEMO_FLOW[WEARABLE_STEP_INDEX].options);
        }, 500);
        return;
      }
      setCurrentStep(nextStep);
      setTimeout(() => {
        const nextMessage = flow[nextStep];
        addAgentMessage(nextMessage.content, nextMessage.options);
      }, 500);
      return;
    }

    if (flowType === 'normal' && currentStep === 0) {
      if (option === "Continue check-in") {
        setCurrentStep(0);
        setTimeout(() => {
          addAgentMessage(DEMO_FLOW[1].content, DEMO_FLOW[1].options);
        }, 500);
        setCurrentStep(1);
        return;
      }
    }

    if (option === "Continue check-in") {
      setFlowType('normal');
      setCurrentStep(1);
      setTimeout(() => {
        addAgentMessage(DEMO_FLOW[1].content, DEMO_FLOW[1].options);
      }, 500);
      return;
    }

    if (flowType === 'normal' && currentStep === 2) {
      if (option === "Chest pain or pressure") {
        setFlowType('urgent');
        addTimelineEvent(`Urgent symptom reported: ${option}`, "danger");
        setTimeout(() => {
          addAgentMessage(URGENT_FLOW[0].content);
        }, 500);
        return;
      } else if (option !== "None of these") {
        setFlowType('concern');
        addTimelineEvent(`Symptom requires review: ${option}`, "warning");
        setTimeout(() => {
          addAgentMessage(CONCERN_FLOW[0].content, CONCERN_FLOW[0].options);
        }, 500);
        setCurrentStep(0);
        return;
      }
    }

    if (
      flowType === 'normal' &&
      currentStep === NON_URGENT_SYMPTOM_STEP_INDEX &&
      option !== "None of these"
    ) {
      const symptomFlow = SYMPTOM_FLOWS[option] ?? DEFAULT_SYMPTOM_FLOW;
      setSelectedSymptom(option);
      setFlowType('symptom');
      setCurrentStep(0);
      addTimelineEvent(`Symptom logged: ${option}`, "warning");
      setTimeout(() => {
        addAgentMessage(symptomFlow[0].content, symptomFlow[0].options);
      }, 500);
      return;
    }

    if (flowType === 'normal' && currentStep === WEARABLE_STEP_INDEX && option === "Report sync issue") {
      addTimelineEvent("Wearable sync issue flagged", "warning");
      setTimeout(() => {
        addAgentMessage(
          "Thanks for flagging that. I've logged a device sync issue and notified support. We'll still continue your check-in."
        );
      }, 400);
      setTimeout(() => {
        addAgentMessage(DEMO_FLOW[ACTIVITY_STEP_INDEX].content, DEMO_FLOW[ACTIVITY_STEP_INDEX].options);
      }, 1200);
      setCurrentStep(ACTIVITY_STEP_INDEX);
      return;
    }

    if (flowType === 'normal' && currentStep === MEDICATION_STEP_INDEX) {
      if (option === "Need a refill soon") {
        setFlowType('refill');
        setCurrentStep(0);
        addTimelineEvent("Prescription refill requested", "info");
        setTimeout(() => {
          addAgentMessage(REFILL_FLOW[0].content, REFILL_FLOW[0].options);
        }, 500);
        return;
      }
      if (option === "Having side effects") {
        setFlowType('sideEffect');
        setCurrentStep(0);
        addTimelineEvent("Side effects reported", "warning");
        setTimeout(() => {
          addAgentMessage(SIDE_EFFECT_FLOW[0].content, SIDE_EFFECT_FLOW[0].options);
        }, 500);
        return;
      }
    }

    // Progress normal flow
    const flow = getCurrentFlow();
    const nextStep = currentStep + 1;

    if (nextStep < flow.length) {
      setCurrentStep(nextStep);
      if (flowType === 'normal' && nextStep === WEARABLE_STEP_INDEX) {
        addTimelineEvent("Wearable sync received", "info");
      }
      setTimeout(() => {
        const nextMessage = flow[nextStep];
        addAgentMessage(nextMessage.content, nextMessage.options);
      }, 500);
    }
  };

  const handleSendMessage = () => {
    if (!inputValue.trim()) return;

    setMessages(prev => [
      ...prev,
      {
        id: `patient-${Date.now()}`,
        role: 'patient',
        content: inputValue,
        timestamp: new Date(),
      },
    ]);
    setInputValue('');

    // Generic response for free-text input
    setTimeout(() => {
      addAgentMessage(
        "Thank you for sharing that. I've noted this for your care team. Is there anything else you'd like to tell me?",
        ["No, that's everything", "Yes, one more thing"]
      );
    }, 500);
  };

  const resetDemo = () => {
    setMessages([]);
    setCurrentStep(0);
    setFlowType('normal');
    setDemoStarted(false);
    setTimelineEvents([]);
    setSelectedSymptom('');
  };

  return (
    <div className="min-h-screen bg-background flex flex-col whatsapp-theme">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-card/95 backdrop-blur-md border-b">
        <div className="container mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate('/')}
              className="shrink-0"
            >
              <ArrowLeft size={20} />
            </Button>
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center">
                <Heart size={16} className="text-primary-foreground" />
              </div>
              <div>
                <h1 className="text-sm font-semibold">CardioWatch</h1>
                <p className="text-[10px] text-muted-foreground">Daily Check-in</p>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="hidden sm:flex items-center gap-1 text-xs text-muted-foreground">
              <MessageCircle size={14} />
              <span>WhatsApp-style check-in</span>
            </div>
            <div className="flex items-center gap-1 text-xs text-triage-green">
              <Watch size={14} />
              <span className="hidden sm:inline">Connected</span>
            </div>
          </div>
        </div>
      </header>

      {/* Main chat area */}
      <main className="flex-1 overflow-hidden flex flex-col">
        {!demoStarted ? (
          <div className="flex-1 flex items-center justify-center p-6">
            <Card className="max-w-md w-full p-8 text-center space-y-6">
              <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
                <Heart size={40} className="text-primary" />
              </div>
              <div>
                <h2 className="text-xl font-semibold mb-2">Patient Demo</h2>
                <p className="text-muted-foreground text-sm">
                  Experience the AI-powered daily check-in from a patient's perspective. 
                  This demo simulates how the CardioWatch agent interacts with post-discharge cardiac patients.
                </p>
              </div>
              <div className="space-y-3 text-left bg-secondary/50 rounded-lg p-4">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Demo scenario</p>
                <p className="text-sm">
                  You are <strong>Sarah Okonkwo</strong>, 58, recently discharged after a cardiac ablation procedure. 
                  Your Apple Watch/Fitbit is connected and sharing health data. Please keep your wearable on for accurate monitoring.
                </p>
              </div>
              <Button onClick={startDemo} className="w-full" size="lg">
                Start Daily Check-in
              </Button>
            </Card>
          </div>
        ) : (
          <>
            <div className="flex-1 overflow-y-auto p-4 space-y-4 scrollbar-thin">
              <div className="grid gap-4 lg:grid-cols-[1.1fr_1fr]">
                <Card className="border bg-card/95 p-4">
                  <div className="flex items-start gap-3">
                    <div className="rounded-lg bg-secondary/70 p-2">
                      <MessageCircle size={16} className="text-primary" />
                    </div>
                    <div className="flex-1">
                      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        Care timeline
                      </p>
                      <p className="text-sm font-semibold text-foreground">
                        Live updates for today's check-in
                      </p>
                      <div className="mt-3 space-y-2">
                        {timelineEvents.length === 0 ? (
                          <p className="text-xs text-muted-foreground">
                            Timeline updates will appear as you respond.
                          </p>
                        ) : (
                          timelineEvents.map((event) => (
                            <div key={event.id} className="flex items-start justify-between gap-3 text-xs">
                              <div className="flex items-start gap-2">
                                <span
                                  className={cn(
                                    "mt-1 h-2 w-2 rounded-full",
                                    event.status === 'danger' && "bg-triage-red",
                                    event.status === 'warning' && "bg-amber-400",
                                    event.status === 'success' && "bg-emerald-400",
                                    (!event.status || event.status === 'info') && "bg-primary"
                                  )}
                                />
                                <span className="text-foreground">{event.label}</span>
                              </div>
                              <span className="text-muted-foreground">{event.time}</span>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  </div>
                </Card>
                <Card className="border bg-card/95 p-4">
                  <div className="flex items-start gap-3">
                    <div className="rounded-lg bg-primary/10 p-2">
                      <Watch size={16} className="text-primary" />
                    </div>
                    <div className="flex-1">
                      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        Apple Watch update
                      </p>
                      <p className="text-sm font-semibold text-foreground">
                        Live sync received {WATCH_SNAPSHOT.lastSync}
                      </p>
                      <div className="mt-2 grid grid-cols-2 gap-3 text-xs text-muted-foreground">
                        <div>
                          <span className="text-foreground font-semibold">{WATCH_SNAPSHOT.restingHR} bpm</span>
                          <span className="ml-1">Resting HR</span>
                        </div>
                        <div>
                          <span className="text-foreground font-semibold">{WATCH_SNAPSHOT.hrv} ms</span>
                          <span className="ml-1">HRV</span>
                        </div>
                        <div>
                          <span className="text-foreground font-semibold">{WATCH_SNAPSHOT.sleepHours} hrs</span>
                          <span className="ml-1">Sleep</span>
                        </div>
                        <div>
                          <span className="text-foreground font-semibold">{WATCH_SNAPSHOT.steps.toLocaleString()}</span>
                          <span className="ml-1">Steps</span>
                        </div>
                      </div>
                      <p className="mt-2 text-xs text-muted-foreground">{WATCH_SUMMARY}</p>
                      <div className="mt-3">
                        <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                          7-day resting HR trend
                        </p>
                        <div className="mt-2 flex h-10 items-end gap-1">
                          {HR_TREND.map((value, index) => {
                            const height = 20 + ((value - HR_TREND_MIN) / HR_TREND_RANGE) * 70;
                            return (
                              <span
                                key={`${value}-${index}`}
                                className={cn(
                                  "w-2 rounded-full",
                                  index === HR_TREND.length - 1 ? "bg-primary" : "bg-primary/30"
                                )}
                                style={{ height: `${height}%` }}
                              />
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  </div>
                </Card>
              </div>
              {messages.map((message) => (
                <div
                  key={message.id}
                  className={cn(
                    'flex gap-3 animate-fade-in',
                    message.role === 'patient' ? 'flex-row-reverse' : 'flex-row'
                  )}
                >
                  {message.role === 'agent' && (
                    <div className="shrink-0 w-8 h-8 rounded-full bg-primary flex items-center justify-center">
                      <Heart size={14} className="text-primary-foreground" />
                    </div>
                  )}
                  <div
                    className={cn(
                      'flex flex-col gap-2',
                      message.role === 'patient' ? 'items-end' : 'items-start'
                    )}
                  >
                    <div
                    className={cn(
                      'chat-bubble whitespace-pre-wrap',
                      message.role === 'patient' ? 'chat-bubble-patient' : 'chat-bubble-agent'
                    )}
                  >
                    {message.content}
                  </div>
                    {message.options && message.role === 'agent' && (
                      <div className="flex flex-wrap gap-2 mt-1 chat-options">
                        {message.options.map((option) => {
                          const isQuickAction = QUICK_ACTIONS_OPTIONS.includes(option);
                          return (
                            <Button
                              key={option}
                              variant="outline"
                              size="sm"
                              className={cn(
                                "text-xs h-auto py-2 px-3",
                                isQuickAction &&
                                  "rounded-full border border-[#25D366] text-[#0b3d22] bg-[#eafff1] hover:bg-[#d7ffe5]"
                              )}
                              onClick={() => handleOptionSelect(option)}
                            >
                              {option}
                            </Button>
                          );
                        })}
                      </div>
                    )}
                    <span className="text-[10px] text-muted-foreground px-1">
                      {formatTime(message.timestamp)}
                    </span>
                  </div>
                </div>
              ))}
              {isTyping && (
                <div className="flex gap-3 animate-fade-in">
                  <div className="shrink-0 w-8 h-8 rounded-full bg-primary flex items-center justify-center">
                    <Heart size={14} className="text-primary-foreground" />
                  </div>
                  <div className="chat-bubble chat-bubble-agent">
                    <div className="flex gap-1">
                      <span className="w-2 h-2 bg-muted-foreground/50 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                      <span className="w-2 h-2 bg-muted-foreground/50 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                      <span className="w-2 h-2 bg-muted-foreground/50 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                    </div>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Quick actions + input area */}
            <div className="border-t bg-card p-4">
              <div className="flex gap-2 max-w-2xl mx-auto mb-3 overflow-x-auto pb-1 sm:flex-wrap sm:overflow-visible">
                {QUICK_ACTIONS_OPTIONS.filter(option => option !== "Continue check-in").map((option) => (
                  <Button
                    key={option}
                    variant="outline"
                    size="sm"
                    className="text-[11px] h-8 px-3 rounded-full border border-[#25D366] text-[#0b3d22] bg-[#eafff1] hover:bg-[#d7ffe5] whitespace-nowrap"
                    onClick={() => handleOptionSelect(option)}
                  >
                    {option}
                  </Button>
                ))}
              </div>
              <div className="flex gap-2 max-w-2xl mx-auto">
                <Input
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  placeholder="Type a message..."
                  className="flex-1"
                  onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
                />
                <Button onClick={handleSendMessage} size="icon">
                  <Send size={18} />
                </Button>
              </div>
              <div className="flex justify-center mt-3">
                <Button variant="ghost" size="sm" onClick={resetDemo} className="text-xs text-muted-foreground">
                  Restart Demo
                </Button>
              </div>
            </div>
          </>
        )}
      </main>

      {/* Urgent alert overlay */}
      {flowType === 'urgent' && messages.length > 0 && (
        <div className="fixed bottom-24 left-4 right-4 z-50 animate-fade-in">
          <Card className="bg-triage-red-bg border-triage-red p-4 flex items-center gap-3">
            <AlertTriangle className="text-triage-red shrink-0" size={24} />
            <div className="flex-1">
              <p className="text-sm font-semibold text-triage-red-foreground">Care team alerted</p>
              <p className="text-xs text-triage-red-foreground/80">Emergency contact will call shortly</p>
            </div>
            <Button variant="outline" size="sm" className="shrink-0 border-triage-red text-triage-red hover:bg-triage-red hover:text-white">
              <Phone size={14} className="mr-1" />
              Call 999
            </Button>
          </Card>
        </div>
      )}
    </div>
  );
}
