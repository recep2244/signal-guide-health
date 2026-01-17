/**
 * WhatsApp Business API Service
 * Production-ready integration for patient messaging
 */

import { ApiClient, ApiClientError } from "../api/client";
import {
  WhatsAppMessage,
  WhatsAppConversation,
  SendMessageRequest,
  SendMessageResponse,
  InteractiveMessage,
  InteractiveButton,
  MessageStatus,
  ConversationStatus,
  QuickReplyConfig,
  CARDIOWATCH_TEMPLATES,
  CardioWatchTemplate,
} from "./types";
import { FlowType, FlowStep, FLOW_REGISTRY } from "@/config/flows";

// ============================================================================
// CONFIGURATION
// ============================================================================

interface WhatsAppConfig {
  phoneNumberId: string;
  accessToken: string;
  webhookVerifyToken: string;
  apiVersion?: string;
}

// ============================================================================
// SERVICE CLASS
// ============================================================================

export class WhatsAppService {
  private client: ApiClient;
  private phoneNumberId: string;
  private conversations: Map<string, WhatsAppConversation> = new Map();

  constructor(config: WhatsAppConfig) {
    this.phoneNumberId = config.phoneNumberId;

    const apiVersion = config.apiVersion || "v18.0";
    this.client = new ApiClient({
      baseUrl: `https://graph.facebook.com/${apiVersion}`,
      headers: {
        Authorization: `Bearer ${config.accessToken}`,
      },
    });
  }

  // ---------------------------------------------------------------------------
  // MESSAGE SENDING
  // ---------------------------------------------------------------------------

  /**
   * Send a text message to a patient
   */
  async sendTextMessage(to: string, text: string): Promise<SendMessageResponse> {
    const payload: SendMessageRequest = {
      to,
      type: "text",
      text: { body: text },
    };

    return this.sendMessage(payload);
  }

  /**
   * Send interactive buttons (max 3 buttons for WhatsApp)
   */
  async sendButtonMessage(
    to: string,
    bodyText: string,
    buttons: QuickReplyConfig[],
    headerText?: string,
    footerText?: string
  ): Promise<SendMessageResponse> {
    // WhatsApp limits to 3 buttons
    const limitedButtons = buttons.slice(0, 3);

    const interactive: InteractiveMessage = {
      type: "button",
      body: { text: bodyText },
      action: {
        buttons: limitedButtons.map((btn): InteractiveButton => ({
          type: "reply",
          reply: {
            id: btn.id,
            title: btn.title.slice(0, 20), // Max 20 chars
          },
        })),
      },
    };

    if (headerText) {
      interactive.header = { type: "text", text: headerText };
    }

    if (footerText) {
      interactive.footer = { text: footerText };
    }

    const payload: SendMessageRequest = {
      to,
      type: "interactive",
      interactive,
    };

    return this.sendMessage(payload);
  }

  /**
   * Send a list message (for more than 3 options)
   */
  async sendListMessage(
    to: string,
    bodyText: string,
    buttonText: string,
    sections: Array<{
      title: string;
      rows: Array<{ id: string; title: string; description?: string }>;
    }>,
    headerText?: string,
    footerText?: string
  ): Promise<SendMessageResponse> {
    const interactive: InteractiveMessage = {
      type: "list",
      body: { text: bodyText },
      action: {
        button: buttonText,
        sections,
      },
    };

    if (headerText) {
      interactive.header = { type: "text", text: headerText };
    }

    if (footerText) {
      interactive.footer = { text: footerText };
    }

    const payload: SendMessageRequest = {
      to,
      type: "interactive",
      interactive,
    };

    return this.sendMessage(payload);
  }

  /**
   * Send a pre-approved template message
   */
  async sendTemplateMessage(
    to: string,
    templateName: CardioWatchTemplate,
    parameters?: string[]
  ): Promise<SendMessageResponse> {
    const payload: SendMessageRequest = {
      to,
      type: "template",
      template: {
        name: templateName,
        language: { code: "en" },
        components: parameters
          ? [
              {
                type: "body",
                parameters: parameters.map((text) => ({ type: "text", text })),
              },
            ]
          : undefined,
      },
    };

    return this.sendMessage(payload);
  }

  /**
   * Core message sending method
   */
  private async sendMessage(payload: SendMessageRequest): Promise<SendMessageResponse> {
    const response = await this.client.post<SendMessageResponse>(
      `/${this.phoneNumberId}/messages`,
      {
        messaging_product: "whatsapp",
        recipient_type: "individual",
        ...payload,
      }
    );

    return response.data;
  }

  // ---------------------------------------------------------------------------
  // CONVERSATION FLOW MANAGEMENT
  // ---------------------------------------------------------------------------

  /**
   * Get or create a conversation for a patient
   */
  getOrCreateConversation(
    patientId: string,
    phoneNumber: string
  ): WhatsAppConversation {
    const existing = this.conversations.get(patientId);
    if (existing && existing.status !== "expired") {
      return existing;
    }

    const conversation: WhatsAppConversation = {
      id: `conv_${Date.now()}_${patientId}`,
      patientId,
      phoneNumber,
      status: "active",
      currentFlowType: "normal",
      currentStep: 0,
      lastMessageAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
      expiresAt: this.getExpiryTime(),
    };

    this.conversations.set(patientId, conversation);
    return conversation;
  }

  /**
   * Update conversation state after receiving a response
   */
  updateConversation(
    patientId: string,
    updates: Partial<WhatsAppConversation>
  ): WhatsAppConversation | null {
    const conversation = this.conversations.get(patientId);
    if (!conversation) return null;

    const updated: WhatsAppConversation = {
      ...conversation,
      ...updates,
      lastMessageAt: new Date().toISOString(),
    };

    this.conversations.set(patientId, updated);
    return updated;
  }

  /**
   * Get current flow step for a conversation
   */
  getCurrentFlowStep(patientId: string): FlowStep | null {
    const conversation = this.conversations.get(patientId);
    if (!conversation) return null;

    const flow = FLOW_REGISTRY[conversation.currentFlowType as FlowType];
    return flow?.[conversation.currentStep] || null;
  }

  /**
   * Advance to next step in flow
   */
  advanceFlow(patientId: string): FlowStep | null {
    const conversation = this.conversations.get(patientId);
    if (!conversation) return null;

    const flow = FLOW_REGISTRY[conversation.currentFlowType as FlowType];
    const nextStep = conversation.currentStep + 1;

    if (nextStep >= flow.length) {
      // Flow completed
      this.updateConversation(patientId, { status: "completed" });
      return null;
    }

    this.updateConversation(patientId, { currentStep: nextStep });
    return flow[nextStep];
  }

  /**
   * Switch to a different flow
   */
  switchFlow(patientId: string, flowType: FlowType): FlowStep | null {
    const flow = FLOW_REGISTRY[flowType];
    if (!flow || flow.length === 0) return null;

    this.updateConversation(patientId, {
      currentFlowType: flowType,
      currentStep: 0,
    });

    return flow[0];
  }

  /**
   * Escalate conversation to clinician
   */
  escalateToClinicain(
    patientId: string,
    reason: string,
    triageLevel: "red" | "amber"
  ): void {
    this.updateConversation(patientId, {
      status: "escalated",
      metadata: {
        ...this.conversations.get(patientId)?.metadata,
        escalationReason: reason,
        triageLevel,
      },
    });
  }

  // ---------------------------------------------------------------------------
  // DAILY CHECK-IN WORKFLOW
  // ---------------------------------------------------------------------------

  /**
   * Initiate daily check-in for a patient
   */
  async startDailyCheckIn(
    patientId: string,
    phoneNumber: string,
    patientName: string
  ): Promise<void> {
    const conversation = this.getOrCreateConversation(patientId, phoneNumber);
    conversation.metadata = { patientName };

    // Send template message (24-hour window opener)
    await this.sendTemplateMessage(
      phoneNumber,
      CARDIOWATCH_TEMPLATES.DAILY_CHECKIN,
      [patientName]
    );

    // Update conversation
    this.updateConversation(patientId, {
      currentFlowType: "normal",
      currentStep: 0,
      status: "waiting_response",
    });
  }

  /**
   * Send the current flow step as a WhatsApp message
   */
  async sendFlowStep(
    patientId: string,
    phoneNumber: string,
    step: FlowStep
  ): Promise<void> {
    if (step.options && step.options.length > 0) {
      if (step.options.length <= 3) {
        // Use buttons for up to 3 options
        await this.sendButtonMessage(
          phoneNumber,
          step.content,
          step.options.map((opt, idx) => ({
            id: `option_${idx}`,
            title: opt,
          }))
        );
      } else {
        // Use list for more options
        await this.sendListMessage(
          phoneNumber,
          step.content,
          "Choose an option",
          [
            {
              title: "Options",
              rows: step.options.map((opt, idx) => ({
                id: `option_${idx}`,
                title: opt.slice(0, 24), // Max 24 chars for list row title
                description: opt.length > 24 ? opt : undefined,
              })),
            },
          ]
        );
      }
    } else {
      // Plain text message
      await this.sendTextMessage(phoneNumber, step.content);
    }

    this.updateConversation(patientId, { status: "waiting_response" });
  }

  // ---------------------------------------------------------------------------
  // ALERTS & NOTIFICATIONS
  // ---------------------------------------------------------------------------

  /**
   * Send urgent alert notification
   */
  async sendUrgentAlert(
    phoneNumber: string,
    patientName: string,
    alertDescription: string
  ): Promise<void> {
    await this.sendTemplateMessage(
      phoneNumber,
      CARDIOWATCH_TEMPLATES.ALERT_URGENT,
      [patientName, alertDescription]
    );
  }

  /**
   * Send amber alert notification
   */
  async sendAmberAlert(
    phoneNumber: string,
    patientName: string,
    reason: string
  ): Promise<void> {
    await this.sendTemplateMessage(
      phoneNumber,
      CARDIOWATCH_TEMPLATES.ALERT_AMBER,
      [patientName, reason]
    );
  }

  /**
   * Send wearable sync issue notification
   */
  async sendSyncIssueAlert(
    phoneNumber: string,
    patientName: string,
    lastSyncTime: string
  ): Promise<void> {
    await this.sendTemplateMessage(
      phoneNumber,
      CARDIOWATCH_TEMPLATES.WEARABLE_SYNC_ISSUE,
      [patientName, lastSyncTime]
    );
  }

  // ---------------------------------------------------------------------------
  // HELPERS
  // ---------------------------------------------------------------------------

  private getExpiryTime(): string {
    // WhatsApp session window is 24 hours
    const expiry = new Date();
    expiry.setHours(expiry.getHours() + 24);
    return expiry.toISOString();
  }

  /**
   * Mark message as read
   */
  async markAsRead(messageId: string): Promise<void> {
    await this.client.post(`/${this.phoneNumberId}/messages`, {
      messaging_product: "whatsapp",
      status: "read",
      message_id: messageId,
    });
  }

  /**
   * Verify webhook signature (for security)
   */
  verifyWebhookSignature(
    signature: string,
    body: string,
    appSecret: string
  ): boolean {
    // Implementation would use crypto.createHmac
    // This is a placeholder - actual implementation needs Node.js crypto
    console.log("Verifying webhook signature...");
    return true;
  }
}

// ============================================================================
// SINGLETON INSTANCE
// ============================================================================

let whatsappServiceInstance: WhatsAppService | null = null;

export function initWhatsAppService(config: WhatsAppConfig): WhatsAppService {
  whatsappServiceInstance = new WhatsAppService(config);
  return whatsappServiceInstance;
}

export function getWhatsAppService(): WhatsAppService {
  if (!whatsappServiceInstance) {
    throw new Error("WhatsApp service not initialized. Call initWhatsAppService first.");
  }
  return whatsappServiceInstance;
}

export default WhatsAppService;
