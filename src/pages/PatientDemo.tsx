import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Heart,
  Send,
  ArrowLeft,
  Watch,
  Phone,
  AlertTriangle,
  MessageCircle,
  Activity,
  Moon,
  Footprints,
  RefreshCw,
  CheckCircle2,
  Clock,
  ChevronRight,
  Sparkles,
  User,
} from 'lucide-react';
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

const CLINICIAN_NAME = "Dr. Sarah Mitchell";
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
  "Your vital signs look stable. Resting heart rate is within your normal baseline, and sleep recovery is adequate.";

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
    "Thank you for completing today's check-in!\n\n" +
    "**Triage Status: GREEN (Stable)**\n\n" +
    "• Your wearable data has been sent to your care team\n" +
    "• No red flag symptoms reported today\n" +
    "• Next check-in scheduled for tomorrow at 9:00 AM\n\n" +
    "If you experience chest pain, shortness of breath at rest, or fainting, please seek urgent care immediately.",
  options: ["View clinician response", "End check-in"],
};

const QUICK_ACTIONS_OPTIONS = [
  "Request ambulance",
  "Request appointment",
  "Request medicine",
  "Report side effects",
  "Call clinician",
  "Notify family",
  "File a complaint",
  "Continue check-in",
];

const DEMO_FLOW: FlowStep[] = [
  {
    content:
      "Good morning! I'm your CardioWatch assistant. I'll be checking in with you daily to help monitor your recovery after your procedure.\n\n" +
      "If you need urgent help right now, select one of the quick actions below. Otherwise, let's continue with your daily check-in.",
    options: QUICK_ACTIONS_OPTIONS,
  },
  {
    content: "How are you feeling today? Please rate your overall wellbeing on a scale of 0-10.",
    options: ["8 - Feeling good", "6 - Okay", "4 - Not great", "2 - Struggling"],
  },
  {
    content: "Thank you for sharing. Before we continue, I need to check for any urgent symptoms.\n\nAre you experiencing any of the following right now?",
    options: ["Chest pain or pressure", "Shortness of breath at rest", "Fainting or near-fainting", "None of these"],
  },
  {
    content: "Great. Are you experiencing any of these non-urgent symptoms today that you'd like us to track?",
    options: NON_URGENT_SYMPTOMS,
  },
  {
    content:
      `Your Apple Watch data has been received (synced ${WATCH_SNAPSHOT.lastSync}).\n\n` +
      `**Today's Vitals:**\n` +
      `• Resting HR: ${WATCH_SNAPSHOT.restingHR} bpm\n` +
      `• HRV: ${WATCH_SNAPSHOT.hrv} ms\n` +
      `• Sleep: ${WATCH_SNAPSHOT.sleepHours} hours\n` +
      `• Steps: ${WATCH_SNAPSHOT.steps.toLocaleString()}\n\n` +
      `**Summary:** ${WATCH_SUMMARY}\n\n` +
      `This update has been sent to ${CLINICIAN_NAME}'s team. Does this look correct?`,
    options: ["Looks correct", "Report sync issue"],
  },
  {
    content: "How have you been feeling during physical activity compared to last week?",
    options: ["Feeling stronger", "About the same", "More tired than usual", "Getting breathless easier"],
  },
  {
    content: "That's encouraging! Your wearable data shows your activity levels have been increasing steadily over the past week.\n\nAre you taking all your medications as prescribed?",
    options: ["Yes, all of them", "Missed one dose", "Having side effects", "Need a refill soon"],
  },
  {
    content: "Is there anything else you need help with today?",
    options: [
      "Request ambulance",
      "Request appointment",
      "Request medicine",
      "Report side effects",
      "Call clinician",
      "Notify family",
      "File a complaint",
      "Nothing else, thanks",
    ],
  },
  FINAL_SUMMARY,
];

const CONCERN_FLOW: FlowStep[] = [
  {
    content: "I'm sorry to hear that. Can you tell me more about what you're experiencing?\n\nWhen did this start?",
    options: ["Just now", "A few hours ago", "Since yesterday", "Getting worse over days"],
  },
  {
    content: "On a scale of 1-10, how severe would you rate this symptom?",
    options: ["Mild (1-3)", "Moderate (4-6)", "Severe (7-8)", "Very severe (9-10)"],
  },
  {
    content: "Based on what you've shared, I'm flagging this for your care team to review today.\n\n**Triage Status: AMBER (Review Today)**\n\nYour symptoms combined with your recent procedure warrant a same-day check. A member of your care team will contact you within the next few hours.\n\n**In the meantime:**\n• Rest and avoid overexertion\n• Keep your phone nearby\n• Seek urgent care if symptoms suddenly worsen\n\nIs there anything else you'd like me to note for your care team?",
    options: ["No, that's all", "Yes, I have more to add"],
  },
];

const buildSymptomFlow = (symptomLabel: string): FlowStep[] => [
  {
    content: `Thank you for letting me know about ${symptomLabel.toLowerCase()}. How severe is it right now?`,
    options: ["Mild", "Moderate", "Severe"],
  },
  {
    content: "When did this symptom start?",
    options: ["Today", "Past few days", "Over a week"],
  },
  {
    content: `Got it. I'll share this with ${CLINICIAN_NAME} and continue monitoring. Ready to continue your check-in?`,
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

const URGENT_FLOW: FlowStep[] = [
  {
    content: "**This could be serious.**\n\nChest pain or pressure after your procedure needs immediate medical attention.\n\n**Please seek urgent care NOW or call 999 if:**\n• Pain is severe or worsening\n• You feel short of breath\n• You feel sweaty, nauseous, or dizzy\n\nI'm alerting your care team immediately.\n\nDo you have someone with you who can help?",
  },
];

const REFILL_FLOW: FlowStep[] = [
  {
    content: `I can request a prescription refill for ${CLINICIAN_NAME} to sign. Which pharmacy should we send it to?`,
    options: ["Same pharmacy on file", "Different pharmacy"],
  },
  {
    content: `Your refill request has been sent to ${CLINICIAN_NAME}. We'll notify you when the prescription is ready for pickup or delivery.`,
    options: ["Track delivery", "Continue check-in"],
  },
  FINAL_SUMMARY,
];

const CALL_FLOW: FlowStep[] = [
  {
    content: `I can arrange a call with ${CLINICIAN_NAME}'s office. When would you like them to call you?`,
    options: ["Call me now", "Later today", "Schedule for tomorrow"],
  },
  {
    content: `Your call request has been sent. ${CLINICIAN_NAME}'s team will reach out at your preferred time.`,
    options: ["Continue check-in"],
  },
  FINAL_SUMMARY,
];

const COMPLAINT_FLOW: FlowStep[] = [
  {
    content: "I'm sorry to hear you have a concern. What would you like to report?",
    options: ["Care quality concern", "Communication issue", "Billing or admin issue"],
  },
  {
    content: "Your feedback has been logged and sent to our patient experience team. A coordinator will follow up within 1 business day.",
    options: ["Continue check-in"],
  },
  FINAL_SUMMARY,
];

const SIDE_EFFECT_FLOW: FlowStep[] = [
  {
    content: "Thank you for reporting this. How severe are the side effects you're experiencing?",
    options: ["Mild - manageable", "Moderate - uncomfortable", "Severe - very concerning"],
  },
  {
    content:
      "I've logged this and alerted your care team. They'll review your medications and may adjust your prescription.\n\nIf symptoms worsen significantly, please seek urgent care.",
    options: ["Continue check-in"],
  },
  FINAL_SUMMARY,
];

const DELIVERY_FLOW: FlowStep[] = [
  {
    content: "How would you like to receive your medication?",
    options: ["Home delivery (2-3 hours)", "Pickup from pharmacy"],
  },
  {
    content: "Your delivery has been scheduled. You'll receive a notification when it's dispatched with an estimated arrival time.",
    options: ["Continue check-in"],
  },
  FINAL_SUMMARY,
];

const FAMILY_FLOW: FlowStep[] = [
  {
    content: "Who should we notify about your status?",
    options: ["Primary caregiver", "Family contact", "Emergency contact"],
  },
  {
    content: "We've sent a notification to your selected contact. They'll be kept updated on your recovery progress.",
    options: ["Continue check-in"],
  },
  FINAL_SUMMARY,
];

const CLINICIAN_RESPONSE_FLOW: FlowStep[] = [
  {
    content:
      `**Message from ${CLINICIAN_NAME}:**\n\n"I've reviewed your latest Apple Watch data. Everything looks stable - your heart rate trends are within normal range and your sleep is improving.\n\nContinue taking your current medications and stay hydrated. We'll check in again tomorrow. Feel free to reach out if anything changes."`,
    options: ["Thank you", "I have a question"],
  },
  FINAL_SUMMARY,
];

const APPOINTMENT_FLOW: FlowStep[] = [
  {
    content: "When would you like to schedule your appointment?",
    options: ["Today if possible", "This week", "Next week"],
  },
  {
    content: `Your appointment request has been sent to ${CLINICIAN_NAME}'s scheduling team. You'll receive a confirmation with available times shortly.`,
    options: ["Continue check-in"],
  },
  FINAL_SUMMARY,
];

const AMBULANCE_FLOW: FlowStep[] = [
  {
    content:
      "**If you are experiencing severe chest pain, shortness of breath at rest, or fainting, please call 999 immediately.**\n\n" +
      `I have alerted ${CLINICIAN_NAME}'s team and marked this as urgent. Emergency services have been notified.`,
    options: ["Continue check-in"],
  },
  FINAL_SUMMARY,
];

const AGENT_TYPING_DELAY_MS = 800;

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
    addTimelineEvent("Daily check-in started", "info");
  };

  const handleOptionSelect = (option: string) => {
    setMessages(prev => [
      ...prev,
      {
        id: `patient-${Date.now()}`,
        role: 'patient',
        content: option,
        timestamp: new Date(),
      },
    ]);

    if (QUICK_ACTIONS_OPTIONS.includes(option) && option !== "Continue check-in") {
      if (option === "Request ambulance") {
        setFlowType('ambulance');
        setCurrentStep(0);
        addTimelineEvent("Emergency ambulance requested", "danger");
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
        addTimelineEvent("Medication refill requested", "info");
        setTimeout(() => {
          addAgentMessage(REFILL_FLOW[0].content, REFILL_FLOW[0].options);
        }, 500);
        return;
      }
      if (option === "Report side effects") {
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
        addTimelineEvent("Call with clinician requested", "info");
        setTimeout(() => {
          addAgentMessage(CALL_FLOW[0].content, CALL_FLOW[0].options);
        }, 500);
        return;
      }
      if (option === "Notify family") {
        setFlowType('family');
        setCurrentStep(0);
        addTimelineEvent("Family notification sent", "info");
        setTimeout(() => {
          addAgentMessage(FAMILY_FLOW[0].content, FAMILY_FLOW[0].options);
        }, 500);
        return;
      }
      if (option === "File a complaint") {
        setFlowType('complaint');
        setCurrentStep(0);
        addTimelineEvent("Feedback submitted", "warning");
        setTimeout(() => {
          addAgentMessage(COMPLAINT_FLOW[0].content, COMPLAINT_FLOW[0].options);
        }, 500);
        return;
      }
    }

    if (option === "Track delivery") {
      setFlowType('delivery');
      setCurrentStep(0);
      addTimelineEvent("Tracking medication delivery", "info");
      setTimeout(() => {
        addAgentMessage(DELIVERY_FLOW[0].content, DELIVERY_FLOW[0].options);
      }, 500);
      return;
    }

    if (option === "View clinician response" || option === "Clinician response") {
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
        addTimelineEvent("Wearable data synced", "info");
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

    if (option === "Continue check-in" || option === "End check-in" || option === "Nothing else, thanks") {
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
        addTimelineEvent(`URGENT: ${option}`, "danger");
        setTimeout(() => {
          addAgentMessage(URGENT_FLOW[0].content);
        }, 500);
        return;
      } else if (option !== "None of these") {
        setFlowType('concern');
        addTimelineEvent(`Symptom flagged: ${option}`, "warning");
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
      addTimelineEvent(`Tracking: ${option}`, "warning");
      setTimeout(() => {
        addAgentMessage(symptomFlow[0].content, symptomFlow[0].options);
      }, 500);
      return;
    }

    if (flowType === 'normal' && currentStep === WEARABLE_STEP_INDEX && option === "Report sync issue") {
      addTimelineEvent("Sync issue reported", "warning");
      setTimeout(() => {
        addAgentMessage(
          "Thank you for letting me know. I've logged a device sync issue and notified our technical team. We'll continue with your check-in."
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
        addTimelineEvent("Medication refill requested", "info");
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

    const flow = getCurrentFlow();
    const nextStep = currentStep + 1;

    if (nextStep < flow.length) {
      setCurrentStep(nextStep);
      if (flowType === 'normal' && nextStep === WEARABLE_STEP_INDEX) {
        addTimelineEvent("Wearable data synced", "info");
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
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white flex flex-col">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-white/95 backdrop-blur-lg border-b shadow-sm">
        <div className="container mx-auto px-4 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate('/')}
              className="shrink-0 hover:bg-slate-100"
            >
              <ArrowLeft size={20} />
            </Button>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-teal-500 to-teal-600 flex items-center justify-center shadow-lg shadow-teal-500/20">
                <Heart size={20} className="text-white" />
              </div>
              <div>
                <h1 className="text-base font-bold text-slate-900">CardioWatch</h1>
                <p className="text-xs text-slate-500">Daily Check-in</p>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Badge variant="outline" className="hidden sm:flex items-center gap-1.5 bg-slate-50 border-slate-200 text-slate-600 px-3 py-1">
              <MessageCircle size={12} />
              WhatsApp-style Demo
            </Badge>
            <Badge className="flex items-center gap-1.5 bg-green-50 text-green-700 border-green-200 px-3 py-1">
              <Watch size={12} />
              <span className="hidden sm:inline">Watch</span> Connected
            </Badge>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="flex-1 overflow-hidden flex flex-col">
        {!demoStarted ? (
          /* Welcome Screen */
          <div className="flex-1 flex items-center justify-center p-6">
            <Card className="max-w-lg w-full border-2 border-slate-200 shadow-xl overflow-hidden">
              <div className="bg-gradient-to-br from-teal-500 to-teal-600 p-8 text-center">
                <div className="w-20 h-20 rounded-full bg-white/20 backdrop-blur flex items-center justify-center mx-auto mb-4">
                  <Heart size={40} className="text-white" />
                </div>
                <h2 className="text-2xl font-bold text-white">Patient Check-in Demo</h2>
                <p className="text-teal-100 mt-2">
                  Experience the AI-powered daily check-in from a patient's perspective
                </p>
              </div>

              <div className="p-6 space-y-6">
                <div className="bg-slate-50 rounded-xl p-4 space-y-3">
                  <div className="flex items-center gap-2 text-sm font-medium text-slate-700">
                    <User size={16} className="text-teal-600" />
                    Demo Scenario
                  </div>
                  <p className="text-sm text-slate-600 leading-relaxed">
                    You are <strong className="text-slate-900">Sarah Okonkwo</strong>, 58 years old,
                    recently discharged after a cardiac ablation procedure. Your Apple Watch is
                    connected and sharing health data with your care team.
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  {[
                    { icon: Activity, label: "Vital Signs", desc: "HR, HRV tracking" },
                    { icon: Moon, label: "Sleep Data", desc: "Recovery analysis" },
                    { icon: MessageCircle, label: "Daily Check-ins", desc: "WhatsApp-style" },
                    { icon: Sparkles, label: "AI Triage", desc: "Smart prioritization" },
                  ].map((item) => (
                    <div key={item.label} className="flex items-start gap-2 p-3 bg-slate-50 rounded-lg">
                      <item.icon size={16} className="text-teal-600 mt-0.5" />
                      <div>
                        <p className="text-xs font-medium text-slate-900">{item.label}</p>
                        <p className="text-xs text-slate-500">{item.desc}</p>
                      </div>
                    </div>
                  ))}
                </div>

                <Button onClick={startDemo} className="w-full h-12 bg-teal-600 hover:bg-teal-700 text-white text-base shadow-lg shadow-teal-600/20">
                  <Sparkles size={18} className="mr-2" />
                  Start Daily Check-in
                </Button>
              </div>
            </Card>
          </div>
        ) : (
          /* Chat Interface */
          <>
            <div className="flex-1 overflow-y-auto">
              <div className="container mx-auto px-4 lg:px-8 py-6 space-y-6">
                {/* Info Cards */}
                <div className="grid gap-4 lg:grid-cols-2">
                  {/* Timeline Card */}
                  <Card className="border-2 border-slate-200 bg-white p-5">
                    <div className="flex items-start gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 text-slate-600">
                        <Clock size={20} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-slate-900">Care Timeline</p>
                        <p className="text-xs text-slate-500 mb-3">Live updates for today's check-in</p>
                        <div className="space-y-2 max-h-32 overflow-y-auto">
                          {timelineEvents.length === 0 ? (
                            <p className="text-xs text-slate-400 italic">
                              Timeline updates will appear as you respond...
                            </p>
                          ) : (
                            timelineEvents.map((event) => (
                              <div key={event.id} className="flex items-start justify-between gap-3">
                                <div className="flex items-start gap-2 min-w-0">
                                  <span
                                    className={cn(
                                      "mt-1.5 h-2 w-2 rounded-full shrink-0",
                                      event.status === 'danger' && "bg-red-500",
                                      event.status === 'warning' && "bg-amber-500",
                                      event.status === 'success' && "bg-green-500",
                                      (!event.status || event.status === 'info') && "bg-teal-500"
                                    )}
                                  />
                                  <span className="text-xs text-slate-700 truncate">{event.label}</span>
                                </div>
                                <span className="text-xs text-slate-400 shrink-0">{event.time}</span>
                              </div>
                            ))
                          )}
                        </div>
                      </div>
                    </div>
                  </Card>

                  {/* Wearable Card */}
                  <Card className="border-2 border-slate-200 bg-white p-5">
                    <div className="flex items-start gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-teal-100 text-teal-600">
                        <Watch size={20} />
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-sm font-semibold text-slate-900">Apple Watch</p>
                            <p className="text-xs text-slate-500">Synced {WATCH_SNAPSHOT.lastSync}</p>
                          </div>
                          <Badge className="bg-green-50 text-green-700 border-green-200 text-xs">
                            <CheckCircle2 size={10} className="mr-1" />
                            Live
                          </Badge>
                        </div>
                        <div className="mt-3 grid grid-cols-2 gap-3">
                          <div className="flex items-center gap-2">
                            <Heart size={14} className="text-red-500" />
                            <span className="text-xs text-slate-600">
                              <strong className="text-slate-900">{WATCH_SNAPSHOT.restingHR}</strong> bpm
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            <Activity size={14} className="text-purple-500" />
                            <span className="text-xs text-slate-600">
                              <strong className="text-slate-900">{WATCH_SNAPSHOT.hrv}</strong> ms HRV
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            <Moon size={14} className="text-blue-500" />
                            <span className="text-xs text-slate-600">
                              <strong className="text-slate-900">{WATCH_SNAPSHOT.sleepHours}</strong> hrs sleep
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            <Footprints size={14} className="text-green-500" />
                            <span className="text-xs text-slate-600">
                              <strong className="text-slate-900">{WATCH_SNAPSHOT.steps.toLocaleString()}</strong> steps
                            </span>
                          </div>
                        </div>

                        {/* Mini HR Trend */}
                        <div className="mt-3 pt-3 border-t border-slate-100">
                          <p className="text-xs text-slate-500 mb-2">7-day HR trend</p>
                          <div className="flex items-end gap-1 h-8">
                            {HR_TREND.map((value, index) => {
                              const height = 30 + ((value - HR_TREND_MIN) / HR_TREND_RANGE) * 70;
                              return (
                                <span
                                  key={`${value}-${index}`}
                                  className={cn(
                                    "flex-1 rounded-sm transition-all",
                                    index === HR_TREND.length - 1 ? "bg-teal-500" : "bg-slate-200"
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

                {/* Messages */}
                <div className="space-y-4">
                  {messages.map((message) => (
                    <div
                      key={message.id}
                      className={cn(
                        'flex gap-3 animate-fade-in',
                        message.role === 'patient' ? 'flex-row-reverse' : 'flex-row'
                      )}
                    >
                      {message.role === 'agent' && (
                        <div className="shrink-0 w-9 h-9 rounded-full bg-gradient-to-br from-teal-500 to-teal-600 flex items-center justify-center shadow-lg shadow-teal-500/20">
                          <Heart size={16} className="text-white" />
                        </div>
                      )}
                      <div
                        className={cn(
                          'flex flex-col gap-2 max-w-[85%] sm:max-w-[75%]',
                          message.role === 'patient' ? 'items-end' : 'items-start'
                        )}
                      >
                        <div
                          className={cn(
                            'rounded-2xl px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap',
                            message.role === 'patient'
                              ? 'bg-teal-600 text-white rounded-br-md'
                              : 'bg-white border-2 border-slate-200 text-slate-700 rounded-bl-md shadow-sm'
                          )}
                        >
                          {message.content}
                        </div>
                        {message.options && message.role === 'agent' && (
                          <div className="flex flex-wrap gap-2 mt-1">
                            {message.options.map((option) => {
                              const isQuickAction = QUICK_ACTIONS_OPTIONS.includes(option) && option !== "Continue check-in";
                              const isUrgent = option === "Request ambulance";
                              return (
                                <Button
                                  key={option}
                                  variant="outline"
                                  size="sm"
                                  className={cn(
                                    "text-xs h-auto py-2 px-4 rounded-full transition-all",
                                    isUrgent
                                      ? "border-red-300 text-red-700 bg-red-50 hover:bg-red-100"
                                      : isQuickAction
                                        ? "border-teal-300 text-teal-700 bg-teal-50 hover:bg-teal-100"
                                        : "border-slate-300 text-slate-700 hover:bg-slate-100 hover:border-slate-400"
                                  )}
                                  onClick={() => handleOptionSelect(option)}
                                >
                                  {option}
                                  <ChevronRight size={14} className="ml-1 opacity-50" />
                                </Button>
                              );
                            })}
                          </div>
                        )}
                        <span className="text-[10px] text-slate-400 px-1">
                          {formatTime(message.timestamp)}
                        </span>
                      </div>
                    </div>
                  ))}

                  {/* Typing indicator */}
                  {isTyping && (
                    <div className="flex gap-3 animate-fade-in">
                      <div className="shrink-0 w-9 h-9 rounded-full bg-gradient-to-br from-teal-500 to-teal-600 flex items-center justify-center">
                        <Heart size={16} className="text-white" />
                      </div>
                      <div className="bg-white border-2 border-slate-200 rounded-2xl rounded-bl-md px-4 py-3 shadow-sm">
                        <div className="flex gap-1.5">
                          <span className="w-2 h-2 bg-slate-300 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                          <span className="w-2 h-2 bg-slate-300 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                          <span className="w-2 h-2 bg-slate-300 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                        </div>
                      </div>
                    </div>
                  )}
                  <div ref={messagesEndRef} />
                </div>
              </div>
            </div>

            {/* Input area */}
            <div className="border-t bg-white/95 backdrop-blur-lg p-4">
              <div className="container mx-auto max-w-3xl">
                {/* Quick Actions */}
                <div className="flex gap-2 mb-3 overflow-x-auto pb-2 scrollbar-thin">
                  {QUICK_ACTIONS_OPTIONS.filter(option => option !== "Continue check-in").map((option) => {
                    const isUrgent = option === "Request ambulance";
                    return (
                      <Button
                        key={option}
                        variant="outline"
                        size="sm"
                        className={cn(
                          "text-xs h-8 px-3 rounded-full whitespace-nowrap shrink-0",
                          isUrgent
                            ? "border-red-200 text-red-600 bg-red-50 hover:bg-red-100"
                            : "border-teal-200 text-teal-700 bg-teal-50 hover:bg-teal-100"
                        )}
                        onClick={() => handleOptionSelect(option)}
                      >
                        {option}
                      </Button>
                    );
                  })}
                </div>

                {/* Text Input */}
                <div className="flex gap-3">
                  <Input
                    value={inputValue}
                    onChange={(e) => setInputValue(e.target.value)}
                    placeholder="Type a message..."
                    className="flex-1 h-11 rounded-full border-2 border-slate-200 px-4 focus:border-teal-500 focus:ring-teal-500"
                    onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
                  />
                  <Button
                    onClick={handleSendMessage}
                    size="icon"
                    className="h-11 w-11 rounded-full bg-teal-600 hover:bg-teal-700 shadow-lg shadow-teal-600/20"
                  >
                    <Send size={18} />
                  </Button>
                </div>

                {/* Restart */}
                <div className="flex justify-center mt-3">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={resetDemo}
                    className="text-xs text-slate-500 hover:text-slate-700"
                  >
                    <RefreshCw size={12} className="mr-1.5" />
                    Restart Demo
                  </Button>
                </div>
              </div>
            </div>
          </>
        )}
      </main>

      {/* Urgent alert overlay */}
      {flowType === 'urgent' && messages.length > 0 && (
        <div className="fixed bottom-28 left-4 right-4 z-50 animate-fade-in">
          <Card className="bg-red-50 border-2 border-red-300 p-4 flex items-center gap-4 shadow-xl">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-red-100 shrink-0">
              <AlertTriangle className="text-red-600" size={24} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-red-800">Care team alerted</p>
              <p className="text-xs text-red-600">Emergency contact will call shortly</p>
            </div>
            <Button className="shrink-0 bg-red-600 hover:bg-red-700 text-white">
              <Phone size={16} className="mr-2" />
              Call 999
            </Button>
          </Card>
        </div>
      )}
    </div>
  );
}
