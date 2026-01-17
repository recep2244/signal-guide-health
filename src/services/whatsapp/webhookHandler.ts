/**
 * WhatsApp Webhook Handler
 * Processes incoming messages and status updates
 */

import {
  WhatsAppWebhookPayload,
  WebhookMessage,
  WebhookStatus,
  ConversationStatus,
} from "./types";
import { getWhatsAppService } from "./whatsappService";
import {
  FlowType,
  getFlowTypeForOption,
  isQuickAction,
  isUrgentSymptom,
  isConcernSymptom,
  MAIN_FLOW,
} from "@/config/flows";

// ============================================================================
// TYPES
// ============================================================================

export interface WebhookProcessResult {
  success: boolean;
  action?: string;
  flowType?: FlowType;
  escalated?: boolean;
  error?: string;
}

export interface PatientLookupResult {
  patientId: string;
  patientName: string;
  phoneNumber: string;
}

// Patient lookup function type - to be implemented by the backend
export type PatientLookupFn = (phoneNumber: string) => Promise<PatientLookupResult | null>;

// ============================================================================
// WEBHOOK HANDLER CLASS
// ============================================================================

export class WhatsAppWebhookHandler {
  private patientLookup: PatientLookupFn;

  constructor(patientLookup: PatientLookupFn) {
    this.patientLookup = patientLookup;
  }

  // ---------------------------------------------------------------------------
  // MAIN WEBHOOK PROCESSOR
  // ---------------------------------------------------------------------------

  /**
   * Process incoming webhook payload
   */
  async processWebhook(payload: WhatsAppWebhookPayload): Promise<WebhookProcessResult[]> {
    const results: WebhookProcessResult[] = [];

    for (const entry of payload.entry) {
      for (const change of entry.changes) {
        if (change.field !== "messages") continue;

        const { messages, statuses } = change.value;

        // Process incoming messages
        if (messages) {
          for (const message of messages) {
            const result = await this.processIncomingMessage(message);
            results.push(result);
          }
        }

        // Process status updates
        if (statuses) {
          for (const status of statuses) {
            await this.processStatusUpdate(status);
          }
        }
      }
    }

    return results;
  }

  // ---------------------------------------------------------------------------
  // MESSAGE PROCESSING
  // ---------------------------------------------------------------------------

  /**
   * Process an incoming message from a patient
   */
  private async processIncomingMessage(
    message: WebhookMessage
  ): Promise<WebhookProcessResult> {
    const service = getWhatsAppService();
    const phoneNumber = message.from;

    try {
      // Look up patient by phone number
      const patient = await this.patientLookup(phoneNumber);
      if (!patient) {
        // Unknown number - could send opt-in message
        console.log(`Unknown phone number: ${phoneNumber}`);
        return { success: false, error: "Unknown patient" };
      }

      // Mark message as read
      await service.markAsRead(message.id);

      // Extract message content
      const content = this.extractMessageContent(message);
      if (!content) {
        return { success: false, error: "Could not extract message content" };
      }

      // Get or create conversation
      const conversation = service.getOrCreateConversation(
        patient.patientId,
        phoneNumber
      );

      // Process based on current flow state
      const result = await this.handlePatientResponse(
        patient.patientId,
        phoneNumber,
        content,
        conversation.currentFlowType as FlowType,
        conversation.currentStep
      );

      return result;
    } catch (error) {
      console.error("Error processing message:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  /**
   * Extract text content from different message types
   */
  private extractMessageContent(message: WebhookMessage): string | null {
    switch (message.type) {
      case "text":
        return message.text?.body || null;

      case "interactive":
        if (message.interactive?.button_reply) {
          return message.interactive.button_reply.title;
        }
        if (message.interactive?.list_reply) {
          return message.interactive.list_reply.title;
        }
        return null;

      case "button":
        return message.button?.text || null;

      default:
        return null;
    }
  }

  /**
   * Handle patient response and advance flow
   */
  private async handlePatientResponse(
    patientId: string,
    phoneNumber: string,
    response: string,
    currentFlowType: FlowType,
    currentStep: number
  ): Promise<WebhookProcessResult> {
    const service = getWhatsAppService();

    // Check for quick actions that switch flows
    if (isQuickAction(response) && response !== "Continue check-in") {
      const newFlowType = getFlowTypeForOption(response);
      if (newFlowType) {
        const firstStep = service.switchFlow(patientId, newFlowType);
        if (firstStep) {
          await service.sendFlowStep(patientId, phoneNumber, firstStep);
          return { success: true, action: "flow_switch", flowType: newFlowType };
        }
      }
    }

    // Handle "Continue check-in" from first step
    if (currentFlowType === "normal" && currentStep === 0 && response === "Continue check-in") {
      service.updateConversation(patientId, { currentStep: 1 });
      await service.sendFlowStep(patientId, phoneNumber, MAIN_FLOW[1]);
      return { success: true, action: "continue_checkin" };
    }

    // Handle urgent symptoms (step 2 in normal flow)
    if (currentFlowType === "normal" && currentStep === 2) {
      if (isUrgentSymptom(response)) {
        const urgentStep = service.switchFlow(patientId, "urgent");
        if (urgentStep) {
          await service.sendFlowStep(patientId, phoneNumber, urgentStep);
          service.escalateToClinicain(patientId, response, "red");
          return { success: true, action: "urgent_escalation", escalated: true };
        }
      } else if (isConcernSymptom(response)) {
        const concernStep = service.switchFlow(patientId, "concern");
        if (concernStep) {
          await service.sendFlowStep(patientId, phoneNumber, concernStep);
          service.escalateToClinicain(patientId, response, "amber");
          return { success: true, action: "concern_escalation", escalated: true };
        }
      }
    }

    // Handle medication-related options in step 5
    if (currentFlowType === "normal" && currentStep === 5) {
      const specialFlowType = getFlowTypeForOption(response);
      if (specialFlowType) {
        const specialStep = service.switchFlow(patientId, specialFlowType);
        if (specialStep) {
          await service.sendFlowStep(patientId, phoneNumber, specialStep);
          return { success: true, action: "flow_switch", flowType: specialFlowType };
        }
      }
    }

    // Default: advance to next step in current flow
    const nextStep = service.advanceFlow(patientId);
    if (nextStep) {
      await service.sendFlowStep(patientId, phoneNumber, nextStep);
      return { success: true, action: "step_advance" };
    }

    // Flow completed
    return { success: true, action: "flow_completed" };
  }

  // ---------------------------------------------------------------------------
  // STATUS UPDATES
  // ---------------------------------------------------------------------------

  /**
   * Process message status update
   */
  private async processStatusUpdate(status: WebhookStatus): Promise<void> {
    console.log(`Message ${status.id} status: ${status.status}`);

    if (status.status === "failed" && status.errors) {
      console.error("Message delivery failed:", status.errors);
      // Could implement retry logic or alert clinician
    }
  }

  // ---------------------------------------------------------------------------
  // WEBHOOK VERIFICATION
  // ---------------------------------------------------------------------------

  /**
   * Handle webhook verification challenge (GET request)
   */
  static handleVerification(
    mode: string,
    token: string,
    challenge: string,
    verifyToken: string
  ): string | null {
    if (mode === "subscribe" && token === verifyToken) {
      console.log("Webhook verified successfully");
      return challenge;
    }
    console.error("Webhook verification failed");
    return null;
  }
}

// ============================================================================
// FACTORY FUNCTION
// ============================================================================

export function createWebhookHandler(
  patientLookup: PatientLookupFn
): WhatsAppWebhookHandler {
  return new WhatsAppWebhookHandler(patientLookup);
}

export default WhatsAppWebhookHandler;
