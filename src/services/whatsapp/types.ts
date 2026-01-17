/**
 * WhatsApp Business API Type Definitions
 * Supports WhatsApp Cloud API and Twilio WhatsApp integration
 */

// ============================================================================
// MESSAGE TYPES
// ============================================================================

export type WhatsAppMessageType =
  | "text"
  | "image"
  | "document"
  | "audio"
  | "video"
  | "sticker"
  | "location"
  | "contacts"
  | "interactive"
  | "template";

export type MessageDirection = "inbound" | "outbound";

export type MessageStatus =
  | "pending"
  | "sent"
  | "delivered"
  | "read"
  | "failed"
  | "deleted";

// ============================================================================
// BASE MESSAGE INTERFACE
// ============================================================================

export interface WhatsAppMessage {
  id: string;
  conversationId: string;
  patientId: string;
  direction: MessageDirection;
  type: WhatsAppMessageType;
  content: MessageContent;
  status: MessageStatus;
  timestamp: string;
  metadata?: MessageMetadata;
}

export interface MessageContent {
  text?: string;
  caption?: string;
  mediaUrl?: string;
  mimeType?: string;
  fileName?: string;
  interactive?: InteractiveMessage;
  template?: TemplateMessage;
  location?: LocationMessage;
}

export interface MessageMetadata {
  waMessageId?: string;
  twilioSid?: string;
  errorCode?: string;
  errorMessage?: string;
  deliveredAt?: string;
  readAt?: string;
}

// ============================================================================
// INTERACTIVE MESSAGES
// ============================================================================

export interface InteractiveMessage {
  type: "button" | "list" | "product" | "product_list";
  header?: InteractiveHeader;
  body: InteractiveBody;
  footer?: InteractiveFooter;
  action: InteractiveAction;
}

export interface InteractiveHeader {
  type: "text" | "image" | "video" | "document";
  text?: string;
  mediaUrl?: string;
}

export interface InteractiveBody {
  text: string;
}

export interface InteractiveFooter {
  text: string;
}

export interface InteractiveAction {
  buttons?: InteractiveButton[];
  sections?: ListSection[];
  button?: string; // For list messages
}

export interface InteractiveButton {
  type: "reply";
  reply: {
    id: string;
    title: string;
  };
}

export interface ListSection {
  title: string;
  rows: ListRow[];
}

export interface ListRow {
  id: string;
  title: string;
  description?: string;
}

// ============================================================================
// TEMPLATE MESSAGES
// ============================================================================

export interface TemplateMessage {
  name: string;
  language: {
    code: string;
  };
  components?: TemplateComponent[];
}

export interface TemplateComponent {
  type: "header" | "body" | "button";
  parameters?: TemplateParameter[];
  sub_type?: "quick_reply" | "url";
  index?: number;
}

export interface TemplateParameter {
  type: "text" | "currency" | "date_time" | "image" | "document" | "video";
  text?: string;
  currency?: {
    fallback_value: string;
    code: string;
    amount_1000: number;
  };
  date_time?: {
    fallback_value: string;
  };
  image?: {
    link: string;
  };
}

// ============================================================================
// LOCATION MESSAGE
// ============================================================================

export interface LocationMessage {
  latitude: number;
  longitude: number;
  name?: string;
  address?: string;
}

// ============================================================================
// CONVERSATION & SESSION
// ============================================================================

export interface WhatsAppConversation {
  id: string;
  patientId: string;
  phoneNumber: string;
  status: ConversationStatus;
  currentFlowType: string;
  currentStep: number;
  lastMessageAt: string;
  createdAt: string;
  expiresAt?: string;
  metadata?: ConversationMetadata;
}

export type ConversationStatus =
  | "active"
  | "waiting_response"
  | "escalated"
  | "completed"
  | "expired";

export interface ConversationMetadata {
  patientName?: string;
  clinicianId?: string;
  escalationReason?: string;
  triageLevel?: "red" | "amber" | "green";
  checkInDate?: string;
}

// ============================================================================
// WEBHOOK PAYLOADS
// ============================================================================

export interface WhatsAppWebhookPayload {
  object: "whatsapp_business_account";
  entry: WebhookEntry[];
}

export interface WebhookEntry {
  id: string;
  changes: WebhookChange[];
}

export interface WebhookChange {
  value: WebhookValue;
  field: string;
}

export interface WebhookValue {
  messaging_product: "whatsapp";
  metadata: {
    display_phone_number: string;
    phone_number_id: string;
  };
  contacts?: WebhookContact[];
  messages?: WebhookMessage[];
  statuses?: WebhookStatus[];
}

export interface WebhookContact {
  profile: {
    name: string;
  };
  wa_id: string;
}

export interface WebhookMessage {
  from: string;
  id: string;
  timestamp: string;
  type: WhatsAppMessageType;
  text?: { body: string };
  image?: { id: string; mime_type: string; sha256: string; caption?: string };
  interactive?: {
    type: "button_reply" | "list_reply";
    button_reply?: { id: string; title: string };
    list_reply?: { id: string; title: string; description?: string };
  };
  button?: { text: string; payload: string };
  location?: LocationMessage;
}

export interface WebhookStatus {
  id: string;
  status: "sent" | "delivered" | "read" | "failed";
  timestamp: string;
  recipient_id: string;
  errors?: Array<{
    code: number;
    title: string;
    message: string;
  }>;
}

// ============================================================================
// API REQUEST/RESPONSE
// ============================================================================

export interface SendMessageRequest {
  to: string;
  type: WhatsAppMessageType;
  text?: { body: string };
  interactive?: InteractiveMessage;
  template?: TemplateMessage;
}

export interface SendMessageResponse {
  messaging_product: "whatsapp";
  contacts: Array<{
    input: string;
    wa_id: string;
  }>;
  messages: Array<{
    id: string;
  }>;
}

// ============================================================================
// QUICK REPLY BUTTONS
// ============================================================================

export interface QuickReplyConfig {
  id: string;
  title: string;
  action?: string;
  flowType?: string;
  metadata?: Record<string, unknown>;
}

// ============================================================================
// MESSAGE TEMPLATES (PRE-APPROVED)
// ============================================================================

export interface MessageTemplateConfig {
  name: string;
  category: "UTILITY" | "MARKETING" | "AUTHENTICATION";
  language: string;
  components: {
    header?: string;
    body: string;
    footer?: string;
    buttons?: Array<{
      type: "QUICK_REPLY" | "URL" | "PHONE_NUMBER";
      text: string;
      url?: string;
      phone_number?: string;
    }>;
  };
}

// Pre-defined templates for CardioWatch
export const CARDIOWATCH_TEMPLATES = {
  DAILY_CHECKIN: "cardiowatch_daily_checkin",
  ALERT_URGENT: "cardiowatch_alert_urgent",
  ALERT_AMBER: "cardiowatch_alert_amber",
  APPOINTMENT_REMINDER: "cardiowatch_appointment_reminder",
  MEDICATION_REMINDER: "cardiowatch_medication_reminder",
  WEARABLE_SYNC_ISSUE: "cardiowatch_sync_issue",
} as const;

export type CardioWatchTemplate = (typeof CARDIOWATCH_TEMPLATES)[keyof typeof CARDIOWATCH_TEMPLATES];
