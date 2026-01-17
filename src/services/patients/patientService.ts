/**
 * Patient API Service
 * CRUD operations and React Query integration for patient data
 */

import { ApiClient } from "../api/client";
import {
  Patient,
  TriageLevel,
  TriageStats,
  Alert,
  WearableReading,
} from "@/types/patient";
import { DailyHealthSummary, HealthTrend } from "../wearables/types";

// ============================================================================
// TYPES
// ============================================================================

export interface PatientListParams {
  triageLevel?: TriageLevel | "all";
  hasUnresolvedAlerts?: boolean;
  search?: string;
  page?: number;
  limit?: number;
  sortBy?: "name" | "triageLevel" | "lastCheckIn" | "wellbeingScore";
  sortOrder?: "asc" | "desc";
}

export interface PatientListResponse {
  patients: Patient[];
  total: number;
  page: number;
  limit: number;
  stats: TriageStats;
}

export interface CreatePatientRequest {
  name: string;
  age: number;
  gender: "Male" | "Female" | "Other";
  condition: string;
  dischargeDate: string;
  nhsNumber: string;
  phoneNumber: string;
  medications: string[];
}

export interface UpdatePatientRequest {
  triageLevel?: TriageLevel;
  wellbeingScore?: number;
  medications?: string[];
  condition?: string;
}

export interface AlertResolutionRequest {
  alertId: string;
  resolvedBy: string;
  resolution: string;
  notes?: string;
}

export interface CheckInRecord {
  id: string;
  patientId: string;
  timestamp: string;
  channel: "whatsapp" | "sms" | "phone" | "in_person";
  wellbeingScore: number;
  symptoms: string[];
  triageOutcome: TriageLevel;
  notes?: string;
}

// ============================================================================
// SERVICE CLASS
// ============================================================================

export class PatientService {
  private client: ApiClient;

  constructor(client: ApiClient) {
    this.client = client;
  }

  // ---------------------------------------------------------------------------
  // PATIENT CRUD
  // ---------------------------------------------------------------------------

  /**
   * Get paginated patient list with filters
   */
  async getPatients(params: PatientListParams = {}): Promise<PatientListResponse> {
    const queryParams = new URLSearchParams();

    if (params.triageLevel && params.triageLevel !== "all") {
      queryParams.set("triageLevel", params.triageLevel);
    }
    if (params.hasUnresolvedAlerts !== undefined) {
      queryParams.set("hasUnresolvedAlerts", String(params.hasUnresolvedAlerts));
    }
    if (params.search) {
      queryParams.set("search", params.search);
    }
    if (params.page !== undefined) {
      queryParams.set("page", String(params.page));
    }
    if (params.limit !== undefined) {
      queryParams.set("limit", String(params.limit));
    }
    if (params.sortBy) {
      queryParams.set("sortBy", params.sortBy);
    }
    if (params.sortOrder) {
      queryParams.set("sortOrder", params.sortOrder);
    }

    const response = await this.client.get<PatientListResponse>(
      `/patients?${queryParams.toString()}`
    );
    return response.data;
  }

  /**
   * Get single patient by ID
   */
  async getPatient(patientId: string): Promise<Patient> {
    const response = await this.client.get<Patient>(`/patients/${patientId}`);
    return response.data;
  }

  /**
   * Create new patient
   */
  async createPatient(request: CreatePatientRequest): Promise<Patient> {
    const response = await this.client.post<Patient>("/patients", request);
    return response.data;
  }

  /**
   * Update patient
   */
  async updatePatient(
    patientId: string,
    request: UpdatePatientRequest
  ): Promise<Patient> {
    const response = await this.client.patch<Patient>(
      `/patients/${patientId}`,
      request
    );
    return response.data;
  }

  /**
   * Delete patient (soft delete)
   */
  async deletePatient(patientId: string): Promise<void> {
    await this.client.delete(`/patients/${patientId}`);
  }

  // ---------------------------------------------------------------------------
  // TRIAGE & ALERTS
  // ---------------------------------------------------------------------------

  /**
   * Get triage statistics
   */
  async getTriageStats(): Promise<TriageStats> {
    const response = await this.client.get<TriageStats>("/patients/stats/triage");
    return response.data;
  }

  /**
   * Get patient alerts
   */
  async getPatientAlerts(
    patientId: string,
    includeResolved: boolean = false
  ): Promise<Alert[]> {
    const response = await this.client.get<Alert[]>(
      `/patients/${patientId}/alerts?includeResolved=${includeResolved}`
    );
    return response.data;
  }

  /**
   * Resolve an alert
   */
  async resolveAlert(
    patientId: string,
    request: AlertResolutionRequest
  ): Promise<Alert> {
    const response = await this.client.post<Alert>(
      `/patients/${patientId}/alerts/${request.alertId}/resolve`,
      request
    );
    return response.data;
  }

  /**
   * Get all unresolved alerts across patients
   */
  async getUnresolvedAlerts(
    triageLevel?: TriageLevel
  ): Promise<Array<Alert & { patientId: string; patientName: string }>> {
    const params = triageLevel ? `?triageLevel=${triageLevel}` : "";
    const response = await this.client.get<
      Array<Alert & { patientId: string; patientName: string }>
    >(`/alerts/unresolved${params}`);
    return response.data;
  }

  // ---------------------------------------------------------------------------
  // WEARABLE DATA
  // ---------------------------------------------------------------------------

  /**
   * Get patient wearable readings
   */
  async getWearableData(
    patientId: string,
    days: number = 14
  ): Promise<WearableReading[]> {
    const response = await this.client.get<WearableReading[]>(
      `/patients/${patientId}/wearables?days=${days}`
    );
    return response.data;
  }

  /**
   * Get patient health summaries
   */
  async getHealthSummaries(
    patientId: string,
    startDate: string,
    endDate: string
  ): Promise<DailyHealthSummary[]> {
    const response = await this.client.get<DailyHealthSummary[]>(
      `/patients/${patientId}/summaries?start=${startDate}&end=${endDate}`
    );
    return response.data;
  }

  /**
   * Get health trends for patient
   */
  async getHealthTrends(patientId: string): Promise<HealthTrend[]> {
    const response = await this.client.get<HealthTrend[]>(
      `/patients/${patientId}/trends`
    );
    return response.data;
  }

  // ---------------------------------------------------------------------------
  // CHECK-INS
  // ---------------------------------------------------------------------------

  /**
   * Get check-in history
   */
  async getCheckIns(
    patientId: string,
    limit: number = 30
  ): Promise<CheckInRecord[]> {
    const response = await this.client.get<CheckInRecord[]>(
      `/patients/${patientId}/checkins?limit=${limit}`
    );
    return response.data;
  }

  /**
   * Record a new check-in
   */
  async recordCheckIn(
    patientId: string,
    checkIn: Omit<CheckInRecord, "id" | "patientId">
  ): Promise<CheckInRecord> {
    const response = await this.client.post<CheckInRecord>(
      `/patients/${patientId}/checkins`,
      checkIn
    );
    return response.data;
  }

  // ---------------------------------------------------------------------------
  // SEARCH
  // ---------------------------------------------------------------------------

  /**
   * Search patients by name or NHS number
   */
  async searchPatients(query: string): Promise<Patient[]> {
    const response = await this.client.get<Patient[]>(
      `/patients/search?q=${encodeURIComponent(query)}`
    );
    return response.data;
  }

  /**
   * Lookup patient by phone number (for WhatsApp)
   */
  async lookupByPhone(
    phoneNumber: string
  ): Promise<{ patientId: string; patientName: string } | null> {
    try {
      const response = await this.client.get<{
        patientId: string;
        patientName: string;
      }>(`/patients/lookup/phone/${encodeURIComponent(phoneNumber)}`);
      return response.data;
    } catch {
      return null;
    }
  }
}

// ============================================================================
// SINGLETON
// ============================================================================

let patientServiceInstance: PatientService | null = null;

export function initPatientService(client: ApiClient): PatientService {
  patientServiceInstance = new PatientService(client);
  return patientServiceInstance;
}

export function getPatientService(): PatientService {
  if (!patientServiceInstance) {
    throw new Error("Patient service not initialized.");
  }
  return patientServiceInstance;
}

export default PatientService;
