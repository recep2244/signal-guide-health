import { describe, it, expect } from "vitest";
import {
  AGENT_TYPING_DELAY_MS,
  FLOW_STEP_DELAY_MS,
  BASELINE_DAYS,
  WEARABLE_DATA_DAYS,
  HR_AMBER_THRESHOLD,
  HR_RED_THRESHOLD,
  PATIENT_SEEDS,
  STORAGE_KEY_RESOLVED_ALERTS,
  TRIAGE_COLORS,
} from "@/config/constants";

describe("Constants", () => {
  describe("Timing constants", () => {
    it("should have positive typing delay", () => {
      expect(AGENT_TYPING_DELAY_MS).toBeGreaterThan(0);
    });

    it("should have positive flow step delay", () => {
      expect(FLOW_STEP_DELAY_MS).toBeGreaterThan(0);
    });
  });

  describe("Clinical thresholds", () => {
    it("should have baseline days less than wearable data days", () => {
      expect(BASELINE_DAYS).toBeLessThan(WEARABLE_DATA_DAYS);
    });

    it("should have amber threshold less than red threshold", () => {
      expect(HR_AMBER_THRESHOLD).toBeLessThan(HR_RED_THRESHOLD);
    });
  });

  describe("Patient seeds", () => {
    it("should have unique seeds for each patient", () => {
      const seeds = Object.values(PATIENT_SEEDS);
      const uniqueSeeds = new Set(seeds);
      expect(uniqueSeeds.size).toBe(seeds.length);
    });
  });

  describe("Storage keys", () => {
    it("should have non-empty storage key for resolved alerts", () => {
      expect(STORAGE_KEY_RESOLVED_ALERTS).toBeTruthy();
      expect(typeof STORAGE_KEY_RESOLVED_ALERTS).toBe("string");
    });
  });

  describe("Triage colors", () => {
    it("should have all triage levels defined", () => {
      expect(TRIAGE_COLORS).toHaveProperty("red");
      expect(TRIAGE_COLORS).toHaveProperty("amber");
      expect(TRIAGE_COLORS).toHaveProperty("green");
    });

    it("should have bg, fg, and text for each level", () => {
      const levels = ["red", "amber", "green"] as const;
      levels.forEach((level) => {
        expect(TRIAGE_COLORS[level]).toHaveProperty("bg");
        expect(TRIAGE_COLORS[level]).toHaveProperty("fg");
        expect(TRIAGE_COLORS[level]).toHaveProperty("text");
      });
    });
  });
});
