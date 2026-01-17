import { describe, expect, it } from "vitest";
import {
  applyResolvedAlerts,
  getPatientById,
  getTriageStats,
  mockPatients,
} from "@/data/mockPatients";

describe("mockPatients helpers", () => {
  it("returns a patient by id", () => {
    const patient = getPatientById("pt-001");
    expect(patient?.name).toBe("Margaret Thompson");
  });

  it("returns undefined for missing ids", () => {
    const patient = getPatientById("missing-id");
    expect(patient).toBeUndefined();
  });

  it("calculates triage stats from the dataset", () => {
    const stats = getTriageStats();
    expect(stats).toEqual({
      red: 1,
      amber: 1,
      green: 1,
      total: 3,
    });
  });

  it("applies resolved alerts consistently", () => {
    const resolved = new Set<string>(["alert-1"]);
    const [patient] = applyResolvedAlerts(mockPatients, resolved);
    expect(patient.alerts[0].resolved).toBe(true);
  });
});
