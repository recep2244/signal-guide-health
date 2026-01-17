/**
 * Mock Patient Service
 * Provides mock data for development and demo mode
 * Mirrors the real PatientService API
 */

import {
  mockPatients,
  applyResolvedAlerts,
  getPatientById,
  getTriageStats,
  filterPatientsByTriage,
} from "@/data/mockPatients";
import { Patient, TriageLevel, TriageStats, Alert } from "@/types/patient";
import { PatientListParams, PatientListResponse, CheckInRecord } from "./patientService";
import { HealthTrend } from "../wearables/types";

// Simulated network delay
const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const MOCK_DELAY = 300;

/**
 * Mock Patient Service - mirrors PatientService API
 */
export class MockPatientService {
  private resolvedAlerts: Set<string> = new Set();

  constructor() {
    // Load resolved alerts from localStorage
    const stored = localStorage.getItem("cardiowatch_resolved_alerts");
    if (stored) {
      try {
        const arr = JSON.parse(stored);
        this.resolvedAlerts = new Set(arr);
      } catch {
        // Ignore
      }
    }
  }

  private getPatients(): Patient[] {
    return applyResolvedAlerts(mockPatients, this.resolvedAlerts);
  }

  async getPatientList(params: PatientListParams = {}): Promise<PatientListResponse> {
    await delay(MOCK_DELAY);

    let patients = this.getPatients();

    // Filter by triage level
    if (params.triageLevel && params.triageLevel !== "all") {
      patients = filterPatientsByTriage(patients, params.triageLevel);
    }

    // Filter by unresolved alerts
    if (params.hasUnresolvedAlerts) {
      patients = patients.filter((p) => p.alerts.some((a) => !a.resolved));
    }

    // Search
    if (params.search) {
      const search = params.search.toLowerCase();
      patients = patients.filter(
        (p) =>
          p.name.toLowerCase().includes(search) ||
          p.nhsNumber.includes(search) ||
          p.condition.toLowerCase().includes(search)
      );
    }

    // Sort
    if (params.sortBy) {
      const triageLevelOrder = { red: 0, amber: 1, green: 2 } as const;
      patients = [...patients].sort((a, b) => {
        let comparison = 0;
        switch (params.sortBy) {
          case "name":
            comparison = a.name.localeCompare(b.name);
            break;
          case "triageLevel":
            comparison = triageLevelOrder[a.triageLevel] - triageLevelOrder[b.triageLevel];
            break;
          case "lastCheckIn":
            comparison = new Date(b.lastCheckIn).getTime() - new Date(a.lastCheckIn).getTime();
            break;
          case "wellbeingScore":
            comparison = a.wellbeingScore - b.wellbeingScore;
            break;
        }
        return params.sortOrder === "desc" ? -comparison : comparison;
      });
    }

    // Pagination
    const page = params.page || 1;
    const limit = params.limit || 10;
    const start = (page - 1) * limit;
    const paginatedPatients = patients.slice(start, start + limit);

    return {
      patients: paginatedPatients,
      total: patients.length,
      page,
      limit,
      stats: getTriageStats(this.getPatients()),
    };
  }

  async getPatient(patientId: string): Promise<Patient | null> {
    await delay(MOCK_DELAY);
    const patients = this.getPatients();
    return getPatientById(patientId, patients) || null;
  }

  async getTriageStats(): Promise<TriageStats> {
    await delay(MOCK_DELAY / 2);
    return getTriageStats(this.getPatients());
  }

  async getPatientAlerts(patientId: string, includeResolved = false): Promise<Alert[]> {
    await delay(MOCK_DELAY);
    const patient = await this.getPatient(patientId);
    if (!patient) return [];

    if (includeResolved) {
      return patient.alerts;
    }
    return patient.alerts.filter((a) => !a.resolved);
  }

  async resolveAlert(
    patientId: string,
    alertId: string,
    _resolvedBy: string,
    _resolution: string
  ): Promise<Alert | null> {
    await delay(MOCK_DELAY);

    this.resolvedAlerts.add(alertId);
    localStorage.setItem(
      "cardiowatch_resolved_alerts",
      JSON.stringify([...this.resolvedAlerts])
    );

    const patient = await this.getPatient(patientId);
    const alert = patient?.alerts.find((a) => a.id === alertId);

    if (alert) {
      return { ...alert, resolved: true };
    }
    return null;
  }

  async searchPatients(query: string): Promise<Patient[]> {
    await delay(MOCK_DELAY);

    if (query.length < 2) return [];

    const search = query.toLowerCase();
    return this.getPatients().filter(
      (p) =>
        p.name.toLowerCase().includes(search) ||
        p.nhsNumber.includes(search)
    );
  }

  async getCheckIns(patientId: string, _limit = 30): Promise<CheckInRecord[]> {
    await delay(MOCK_DELAY);

    const patient = await this.getPatient(patientId);
    if (!patient) return [];

    // Generate mock check-ins from chat history
    return patient.chatHistory
      .filter((msg) => msg.role === "patient")
      .map((msg, idx) => ({
        id: `checkin-${patientId}-${idx}`,
        patientId,
        timestamp: msg.timestamp,
        channel: "whatsapp" as const,
        wellbeingScore: patient.wellbeingScore,
        symptoms: [],
        triageOutcome: patient.triageLevel,
      }));
  }

  async getHealthTrends(patientId: string): Promise<HealthTrend[]> {
    await delay(MOCK_DELAY);

    const patient = await this.getPatient(patientId);
    if (!patient || patient.wearableData.length < 7) return [];

    // Calculate simple trends from wearable data
    const baseline = patient.wearableData.slice(0, 7);
    const recent = patient.wearableData.slice(-3);

    const avgBaseline = {
      hr: baseline.reduce((s, r) => s + r.restingHR, 0) / baseline.length,
      hrv: baseline.reduce((s, r) => s + r.hrv, 0) / baseline.length,
      sleep: baseline.reduce((s, r) => s + r.sleepHours, 0) / baseline.length,
      steps: baseline.reduce((s, r) => s + r.steps, 0) / baseline.length,
    };

    const avgRecent = {
      hr: recent.reduce((s, r) => s + r.restingHR, 0) / recent.length,
      hrv: recent.reduce((s, r) => s + r.hrv, 0) / recent.length,
      sleep: recent.reduce((s, r) => s + r.sleepHours, 0) / recent.length,
      steps: recent.reduce((s, r) => s + r.steps, 0) / recent.length,
    };

    return [
      {
        dataType: "resting_heart_rate",
        period: "14d",
        baseline: {
          mean: avgBaseline.hr,
          median: avgBaseline.hr,
          standardDeviation: 5,
          min: Math.min(...baseline.map((r) => r.restingHR)),
          max: Math.max(...baseline.map((r) => r.restingHR)),
          sampleCount: baseline.length,
          startDate: baseline[0].date,
          endDate: baseline[baseline.length - 1].date,
        },
        current: {
          value: avgRecent.hr,
          comparisonPeriod: recent[recent.length - 1].date,
          deltaFromBaseline: avgRecent.hr - avgBaseline.hr,
          zScore: (avgRecent.hr - avgBaseline.hr) / 5,
        },
        trend: avgRecent.hr > avgBaseline.hr + 5 ? "increasing" : avgRecent.hr < avgBaseline.hr - 5 ? "decreasing" : "stable",
        percentChange: ((avgRecent.hr - avgBaseline.hr) / avgBaseline.hr) * 100,
        status: avgRecent.hr > avgBaseline.hr + 15 ? "critical" : avgRecent.hr > avgBaseline.hr + 10 ? "concerning" : "normal",
      },
    ];
  }
}

// Singleton
let mockServiceInstance: MockPatientService | null = null;

export function getMockPatientService(): MockPatientService {
  if (!mockServiceInstance) {
    mockServiceInstance = new MockPatientService();
  }
  return mockServiceInstance;
}

export default MockPatientService;
