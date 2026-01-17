import { describe, it, expect, vi, beforeEach } from "vitest";
import { ApiClient, ApiClientError } from "@/services/api/client";
import {
  QUICK_ACTIONS,
  getFlowTypeForOption,
  isQuickAction,
} from "@/config/flows";
import {
  DEFAULT_CARDIAC_THRESHOLDS,
  CARDIAC_DATA_TYPES,
} from "@/services/wearables/types";
import { CARDIOWATCH_TEMPLATES } from "@/services/whatsapp/types";
import { NOTIFICATION_TEMPLATES } from "@/services/notifications/notificationService";

describe("API Client", () => {
  describe("ApiClient", () => {
    it("should create client with base URL", () => {
      const client = new ApiClient({
        baseUrl: "https://api.example.com",
      });
      expect(client).toBeDefined();
    });

    it("should handle auth token", () => {
      const client = new ApiClient({
        baseUrl: "https://api.example.com",
      });
      client.setAuthToken("test-token");
      client.clearAuthToken();
      expect(client).toBeDefined();
    });
  });

  describe("ApiClientError", () => {
    it("should create error with status", () => {
      const error = new ApiClientError("Not Found", 404, "Resource not found");
      expect(error.status).toBe(404);
      expect(error.message).toBe("Not Found");
      expect(error.details).toBe("Resource not found");
      expect(error.name).toBe("ApiClientError");
    });
  });
});

describe("WhatsApp Types", () => {
  describe("CARDIOWATCH_TEMPLATES", () => {
    it("should have all required templates", () => {
      expect(CARDIOWATCH_TEMPLATES.DAILY_CHECKIN).toBe("cardiowatch_daily_checkin");
      expect(CARDIOWATCH_TEMPLATES.ALERT_URGENT).toBe("cardiowatch_alert_urgent");
      expect(CARDIOWATCH_TEMPLATES.ALERT_AMBER).toBe("cardiowatch_alert_amber");
      expect(CARDIOWATCH_TEMPLATES.APPOINTMENT_REMINDER).toBe(
        "cardiowatch_appointment_reminder"
      );
      expect(CARDIOWATCH_TEMPLATES.MEDICATION_REMINDER).toBe(
        "cardiowatch_medication_reminder"
      );
      expect(CARDIOWATCH_TEMPLATES.WEARABLE_SYNC_ISSUE).toBe(
        "cardiowatch_sync_issue"
      );
    });
  });

  describe("Flow Integration", () => {
    it("should map quick actions to flow types", () => {
      expect(getFlowTypeForOption("Request ambulance")).toBe("ambulance");
      expect(getFlowTypeForOption("Request appointment")).toBe("appointment");
      expect(getFlowTypeForOption("Request medicine")).toBe("refill");
      expect(getFlowTypeForOption("Side effects")).toBe("sideEffect");
      expect(getFlowTypeForOption("Call clinician")).toBe("call");
      expect(getFlowTypeForOption("File a complaint")).toBe("complaint");
    });

    it("should identify quick actions", () => {
      QUICK_ACTIONS.forEach((action) => {
        expect(isQuickAction(action)).toBe(true);
      });
      expect(isQuickAction("Random option")).toBe(false);
    });
  });
});

describe("Wearable Types", () => {
  describe("DEFAULT_CARDIAC_THRESHOLDS", () => {
    it("should have valid heart rate thresholds", () => {
      const thresholds = DEFAULT_CARDIAC_THRESHOLDS.restingHeartRate;
      expect(thresholds.criticalLow).toBeLessThan(thresholds.low);
      expect(thresholds.low).toBeLessThan(thresholds.high);
      expect(thresholds.high).toBeLessThan(thresholds.criticalHigh);
    });

    it("should have valid HRV thresholds", () => {
      const thresholds = DEFAULT_CARDIAC_THRESHOLDS.heartRateVariability;
      expect(thresholds.lowCritical).toBeLessThan(thresholds.lowWarning);
    });

    it("should have valid blood oxygen thresholds", () => {
      const thresholds = DEFAULT_CARDIAC_THRESHOLDS.bloodOxygen;
      expect(thresholds.lowCritical).toBeLessThan(thresholds.lowWarning);
      expect(thresholds.lowCritical).toBeGreaterThan(80); // Reasonable minimum
      expect(thresholds.lowWarning).toBeLessThan(100);
    });

    it("should have valid sleep thresholds", () => {
      const thresholds = DEFAULT_CARDIAC_THRESHOLDS.sleepDuration;
      expect(thresholds.lowCritical).toBeLessThan(thresholds.lowWarning);
      expect(thresholds.lowCritical).toBeGreaterThan(0);
    });
  });

  describe("CARDIAC_DATA_TYPES", () => {
    it("should include essential cardiac metrics", () => {
      expect(CARDIAC_DATA_TYPES).toContain("heart_rate");
      expect(CARDIAC_DATA_TYPES).toContain("resting_heart_rate");
      expect(CARDIAC_DATA_TYPES).toContain("heart_rate_variability");
      expect(CARDIAC_DATA_TYPES).toContain("blood_oxygen");
    });
  });
});

describe("Notification Templates", () => {
  describe("NOTIFICATION_TEMPLATES", () => {
    it("should have ALERT_RED template", () => {
      const template = NOTIFICATION_TEMPLATES.ALERT_RED;
      expect(template.title).toContain("URGENT");
      expect(template.priority).toBe("critical");
    });

    it("should have ALERT_AMBER template", () => {
      const template = NOTIFICATION_TEMPLATES.ALERT_AMBER;
      expect(template.title).toContain("Review");
      expect(template.priority).toBe("high");
    });

    it("should have DAILY_CHECKIN template", () => {
      const template = NOTIFICATION_TEMPLATES.DAILY_CHECKIN;
      expect(template.title).toBe("Daily Check-in");
      expect(template.priority).toBe("normal");
    });

    it("should have template variables", () => {
      expect(NOTIFICATION_TEMPLATES.ALERT_RED.title).toContain("{{patientName}}");
      expect(NOTIFICATION_TEMPLATES.DAILY_CHECKIN.body).toContain("{{patientName}}");
    });
  });
});
