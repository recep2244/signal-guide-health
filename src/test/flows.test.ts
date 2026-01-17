import { describe, it, expect } from "vitest";
import {
  QUICK_ACTIONS,
  MAIN_FLOW,
  CONCERN_FLOW,
  URGENT_FLOW,
  FLOW_REGISTRY,
  getFlowByType,
  getFlowTypeForOption,
  isQuickAction,
  isUrgentSymptom,
  isConcernSymptom,
} from "@/config/flows";

describe("Flows", () => {
  describe("QUICK_ACTIONS", () => {
    it("should contain expected actions", () => {
      expect(QUICK_ACTIONS).toContain("Request ambulance");
      expect(QUICK_ACTIONS).toContain("Request appointment");
      expect(QUICK_ACTIONS).toContain("Continue check-in");
    });

    it("should be readonly array", () => {
      expect(Array.isArray(QUICK_ACTIONS)).toBe(true);
    });
  });

  describe("MAIN_FLOW", () => {
    it("should have multiple steps", () => {
      expect(MAIN_FLOW.length).toBeGreaterThan(1);
    });

    it("should have content for each step", () => {
      MAIN_FLOW.forEach((step) => {
        expect(step.content).toBeTruthy();
        expect(typeof step.content).toBe("string");
      });
    });

    it("should have greeting in first step", () => {
      expect(MAIN_FLOW[0].content).toContain("Good morning");
    });
  });

  describe("CONCERN_FLOW", () => {
    it("should have steps for concern path", () => {
      expect(CONCERN_FLOW.length).toBeGreaterThan(0);
    });

    it("should include AMBER triage message", () => {
      const hasAmberMessage = CONCERN_FLOW.some((step) =>
        step.content.includes("AMBER")
      );
      expect(hasAmberMessage).toBe(true);
    });
  });

  describe("URGENT_FLOW", () => {
    it("should have urgent warning content", () => {
      expect(URGENT_FLOW[0].content).toContain("serious");
    });

    it("should mention emergency services", () => {
      expect(URGENT_FLOW[0].content).toContain("999");
    });
  });

  describe("FLOW_REGISTRY", () => {
    it("should have all flow types", () => {
      expect(FLOW_REGISTRY).toHaveProperty("normal");
      expect(FLOW_REGISTRY).toHaveProperty("concern");
      expect(FLOW_REGISTRY).toHaveProperty("urgent");
      expect(FLOW_REGISTRY).toHaveProperty("refill");
      expect(FLOW_REGISTRY).toHaveProperty("call");
      expect(FLOW_REGISTRY).toHaveProperty("complaint");
      expect(FLOW_REGISTRY).toHaveProperty("sideEffect");
      expect(FLOW_REGISTRY).toHaveProperty("appointment");
      expect(FLOW_REGISTRY).toHaveProperty("ambulance");
    });
  });

  describe("getFlowByType", () => {
    it("should return correct flow for type", () => {
      expect(getFlowByType("normal")).toBe(MAIN_FLOW);
      expect(getFlowByType("concern")).toBe(CONCERN_FLOW);
      expect(getFlowByType("urgent")).toBe(URGENT_FLOW);
    });
  });

  describe("getFlowTypeForOption", () => {
    it("should return flow type for mapped options", () => {
      expect(getFlowTypeForOption("Request ambulance")).toBe("ambulance");
      expect(getFlowTypeForOption("Request appointment")).toBe("appointment");
      expect(getFlowTypeForOption("Request medicine")).toBe("refill");
    });

    it("should return null for unmapped options", () => {
      expect(getFlowTypeForOption("Unknown option")).toBeNull();
      expect(getFlowTypeForOption("Continue check-in")).toBeNull();
    });
  });

  describe("isQuickAction", () => {
    it("should return true for quick actions", () => {
      expect(isQuickAction("Request ambulance")).toBe(true);
      expect(isQuickAction("Continue check-in")).toBe(true);
    });

    it("should return false for non-quick actions", () => {
      expect(isQuickAction("Some random option")).toBe(false);
    });
  });

  describe("isUrgentSymptom", () => {
    it("should return true for chest pain", () => {
      expect(isUrgentSymptom("Chest pain or pressure")).toBe(true);
    });

    it("should return false for other symptoms", () => {
      expect(isUrgentSymptom("Shortness of breath at rest")).toBe(false);
      expect(isUrgentSymptom("None of these")).toBe(false);
    });
  });

  describe("isConcernSymptom", () => {
    it("should return true for concern symptoms", () => {
      expect(isConcernSymptom("Shortness of breath at rest")).toBe(true);
      expect(isConcernSymptom("Fainting or near-fainting")).toBe(true);
    });

    it("should return false for other symptoms", () => {
      expect(isConcernSymptom("Chest pain or pressure")).toBe(false);
      expect(isConcernSymptom("None of these")).toBe(false);
    });
  });
});
