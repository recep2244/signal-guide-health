import { describe, it, expect } from "vitest";
import {
  TRIAGE_PRIORITY,
  sortByTriagePriority,
  type TriageLevel,
} from "@/types/patient";

describe("Patient Types", () => {
  describe("TRIAGE_PRIORITY", () => {
    it("should prioritize red over amber and green", () => {
      expect(TRIAGE_PRIORITY.red).toBeLessThan(TRIAGE_PRIORITY.amber);
      expect(TRIAGE_PRIORITY.amber).toBeLessThan(TRIAGE_PRIORITY.green);
    });
  });

  describe("sortByTriagePriority", () => {
    it("should sort items by triage priority", () => {
      const items: { triageLevel: TriageLevel; name: string }[] = [
        { triageLevel: "green", name: "Patient A" },
        { triageLevel: "red", name: "Patient B" },
        { triageLevel: "amber", name: "Patient C" },
      ];

      const sorted = sortByTriagePriority(items);

      expect(sorted[0].triageLevel).toBe("red");
      expect(sorted[1].triageLevel).toBe("amber");
      expect(sorted[2].triageLevel).toBe("green");
    });

    it("should not mutate original array", () => {
      const items: { triageLevel: TriageLevel; name: string }[] = [
        { triageLevel: "green", name: "Patient A" },
        { triageLevel: "red", name: "Patient B" },
      ];

      const sorted = sortByTriagePriority(items);

      expect(items[0].triageLevel).toBe("green");
      expect(sorted).not.toBe(items);
    });

    it("should handle empty array", () => {
      const result = sortByTriagePriority([]);
      expect(result).toEqual([]);
    });

    it("should handle array with same priority", () => {
      const items: { triageLevel: TriageLevel; name: string }[] = [
        { triageLevel: "amber", name: "Patient A" },
        { triageLevel: "amber", name: "Patient B" },
      ];

      const sorted = sortByTriagePriority(items);

      expect(sorted.length).toBe(2);
      expect(sorted[0].triageLevel).toBe("amber");
      expect(sorted[1].triageLevel).toBe("amber");
    });
  });
});
