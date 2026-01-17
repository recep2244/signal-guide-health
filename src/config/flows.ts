/**
 * Patient Demo Flow Definitions
 * Centralized conversation flows for the patient check-in demo
 */

import { DEFAULT_CLINICIAN_NAME, DEMO_WATCH_SNAPSHOT, DEMO_WATCH_SUMMARY } from "./constants";

// ============================================================================
// TYPES
// ============================================================================

export interface FlowStep {
  content: string;
  options?: string[];
}

export type FlowType =
  | "normal"
  | "concern"
  | "urgent"
  | "refill"
  | "call"
  | "complaint"
  | "sideEffect"
  | "appointment"
  | "ambulance";

export interface FlowConfig {
  type: FlowType;
  steps: FlowStep[];
  triggerOptions?: string[];
}

// ============================================================================
// QUICK ACTIONS
// ============================================================================

export const QUICK_ACTIONS = [
  "Request ambulance",
  "Request appointment",
  "Request medicine",
  "Side effects",
  "Call clinician",
  "File a complaint",
  "Continue check-in",
] as const;

export type QuickAction = (typeof QUICK_ACTIONS)[number];

// ============================================================================
// SHARED FLOW STEPS
// ============================================================================

export const FINAL_SUMMARY: FlowStep = {
  content:
    "Thanks for checking in. ✅ **Triage: GREEN (Stable)**\n" +
    "• Wearable update sent to your care team\n" +
    "• No red flag symptoms reported\n" +
    "• Next check-in scheduled for tomorrow\n\n" +
    "If you develop chest pain, shortness of breath at rest, or fainting, seek urgent care.",
};

// ============================================================================
// MAIN CHECK-IN FLOW
// ============================================================================

export const MAIN_FLOW: FlowStep[] = [
  {
    content:
      "Good morning! 👋 I'm your CardioWatch assistant on WhatsApp. I'll be checking in with you daily to help monitor your recovery.\n\n" +
      "If you need urgent or practical help now, pick one of the quick actions below, or continue the check-in.",
    options: [...QUICK_ACTIONS],
  },
  {
    content: "Thanks. How are you feeling today on a scale of 0-10?",
    options: ["8 - Feeling good", "6 - Okay", "4 - Not great", "2 - Struggling"],
  },
  {
    content:
      "Thank you for sharing. Before we continue, I need to ask about any urgent symptoms.\n\nAre you experiencing any of the following right now?",
    options: [
      "Chest pain or pressure",
      "Shortness of breath at rest",
      "Fainting or near-fainting",
      "None of these",
    ],
  },
  {
    content:
      `Apple Watch/Fitbit notification received (${DEMO_WATCH_SNAPSHOT.lastSync}).` +
      `\n• Resting HR: ${DEMO_WATCH_SNAPSHOT.restingHR} bpm` +
      `\n• HRV: ${DEMO_WATCH_SNAPSHOT.hrv} ms` +
      `\n• Sleep: ${DEMO_WATCH_SNAPSHOT.sleepHours} hrs` +
      `\n• Steps: ${DEMO_WATCH_SNAPSHOT.steps.toLocaleString()}` +
      `\n\nSummary: ${DEMO_WATCH_SUMMARY}` +
      `\n\nI've sent this update to ${DEFAULT_CLINICIAN_NAME}'s team. Please keep your wearable on so we can monitor trends. Does this look right?`,
    options: ["Looks correct", "Report sync issue"],
  },
  {
    content: "Thanks. Have you noticed any changes in how you feel during physical activity?",
    options: ["Feeling stronger", "About the same", "More tired than usual", "Getting breathless easier"],
  },
  {
    content:
      "That's wonderful progress! Your wearable data supports this - your activity levels have been increasing steadily. 📈\n\nAre you taking all your medications as prescribed?",
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
      "File a complaint",
      "Nothing else",
    ],
  },
  FINAL_SUMMARY,
];

// ============================================================================
// CONCERN FLOW (AMBER TRIAGE)
// ============================================================================

export const CONCERN_FLOW: FlowStep[] = [
  {
    content:
      "I'm sorry to hear that. Can you tell me more about what you're experiencing?\n\nWhen did this start?",
    options: ["Just now", "A few hours ago", "Since yesterday", "Getting worse over days"],
  },
  {
    content: "I understand. On a scale of 0-10, how severe would you rate this symptom?",
    options: ["Mild (1-3)", "Moderate (4-6)", "Severe (7-8)", "Very severe (9-10)"],
  },
  {
    content:
      "⚠️ Based on what you've shared, I'm flagging this for your care team to review today.\n\n" +
      "**Triage: AMBER (Review Today)**\n\n" +
      "Your symptoms combined with your recent procedure warrant a same-day check. " +
      "A member of your care team will contact you within the next few hours.\n\n" +
      "In the meantime:\n" +
      "• Rest and don't overexert yourself\n" +
      "• Keep your phone nearby\n" +
      "• If symptoms suddenly worsen, seek urgent care\n\n" +
      "Is there anything else you'd like me to note for your care team?",
    options: ["No, that's all", "Yes, I have more to add"],
  },
];

// ============================================================================
// URGENT FLOW (RED TRIAGE)
// ============================================================================

export const URGENT_FLOW: FlowStep[] = [
  {
    content:
      "⚠️ **This could be serious.**\n\n" +
      "Chest pain or pressure after your procedure needs immediate medical attention.\n\n" +
      "**Please seek urgent care NOW or call 999 if:**\n" +
      "• Pain is severe or worsening\n" +
      "• You feel short of breath\n" +
      "• You feel sweaty, nauseous, or dizzy\n\n" +
      "🚨 I'm alerting your care team immediately.\n\n" +
      "Do you have someone with you who can help?",
  },
];

// ============================================================================
// ACTION FLOWS
// ============================================================================

export const REFILL_FLOW: FlowStep[] = [
  {
    content: `I can request a refill and draft a prescription for ${DEFAULT_CLINICIAN_NAME} to sign. Which pharmacy should we use?`,
    options: ["Same pharmacy on file", "Different pharmacy"],
  },
  {
    content: `Refill request created and sent to ${DEFAULT_CLINICIAN_NAME}. We'll notify you when the prescription is issued and medication is ready.`,
    options: ["Continue check-in"],
  },
  FINAL_SUMMARY,
];

export const CALL_FLOW: FlowStep[] = [
  {
    content: `I can contact ${DEFAULT_CLINICIAN_NAME}'s office. When should they call you?`,
    options: ["Call now", "Later today", "Schedule tomorrow"],
  },
  {
    content: `Request sent. ${DEFAULT_CLINICIAN_NAME}'s team will reach you at your preferred time.`,
    options: ["Continue check-in"],
  },
  FINAL_SUMMARY,
];

export const COMPLAINT_FLOW: FlowStep[] = [
  {
    content: "I'm sorry about that. What would you like to report?",
    options: ["Care quality concern", "Communication issue", "Billing or admin issue"],
  },
  {
    content:
      "Complaint logged and routed to patient experience. A coordinator will follow up within 1 business day.",
    options: ["Continue check-in"],
  },
  FINAL_SUMMARY,
];

export const SIDE_EFFECT_FLOW: FlowStep[] = [
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

export const APPOINTMENT_FLOW: FlowStep[] = [
  {
    content: "I can arrange an appointment. When would you like to be seen?",
    options: ["Today", "This week", "Next week"],
  },
  {
    content: `Appointment request sent to ${DEFAULT_CLINICIAN_NAME}'s scheduling team. We'll confirm your slot soon.`,
    options: ["Continue check-in"],
  },
  FINAL_SUMMARY,
];

export const AMBULANCE_FLOW: FlowStep[] = [
  {
    content:
      "If you are experiencing severe chest pain, shortness of breath at rest, or fainting, please call 999 now.\n\n" +
      `I have alerted ${DEFAULT_CLINICIAN_NAME}'s team and flagged this as urgent.`,
    options: ["Continue check-in"],
  },
  FINAL_SUMMARY,
];

// ============================================================================
// FLOW REGISTRY
// ============================================================================

export const FLOW_REGISTRY: Record<FlowType, FlowStep[]> = {
  normal: MAIN_FLOW,
  concern: CONCERN_FLOW,
  urgent: URGENT_FLOW,
  refill: REFILL_FLOW,
  call: CALL_FLOW,
  complaint: COMPLAINT_FLOW,
  sideEffect: SIDE_EFFECT_FLOW,
  appointment: APPOINTMENT_FLOW,
  ambulance: AMBULANCE_FLOW,
};

// ============================================================================
// OPTION TO FLOW MAPPING
// ============================================================================

export const OPTION_FLOW_MAP: Partial<Record<string, FlowType>> = {
  "Request ambulance": "ambulance",
  "Request appointment": "appointment",
  "Request medicine": "refill",
  "Side effects": "sideEffect",
  "Call clinician": "call",
  "File a complaint": "complaint",
  "Need a refill soon": "refill",
  "Having side effects": "sideEffect",
};

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

export function getFlowByType(type: FlowType): FlowStep[] {
  return FLOW_REGISTRY[type];
}

export function getFlowTypeForOption(option: string): FlowType | null {
  return OPTION_FLOW_MAP[option] || null;
}

export function isQuickAction(option: string): boolean {
  return QUICK_ACTIONS.includes(option as QuickAction);
}

export function isUrgentSymptom(option: string): boolean {
  return option === "Chest pain or pressure";
}

export function isConcernSymptom(option: string): boolean {
  return ["Shortness of breath at rest", "Fainting or near-fainting"].includes(option);
}
