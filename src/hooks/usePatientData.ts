/**
 * Patient Data Hooks
 * Unified hooks that work with both mock and real data
 * Controlled by VITE_ENABLE_MOCK_DATA environment variable
 */

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getMockPatientService } from "@/services/patients/mockPatientService";
import { Patient, TriageLevel, TriageStats, Alert } from "@/types/patient";
import { PatientListParams, PatientListResponse } from "@/services/patients/patientService";
import { HealthTrend } from "@/services/wearables/types";

// Check if we should use mock data
const USE_MOCK = import.meta.env.VITE_ENABLE_MOCK_DATA !== "false";

// Query keys
export const patientDataKeys = {
  all: ["patientData"] as const,
  list: (params: PatientListParams) => [...patientDataKeys.all, "list", params] as const,
  detail: (id: string) => [...patientDataKeys.all, "detail", id] as const,
  alerts: (id: string) => [...patientDataKeys.all, "alerts", id] as const,
  trends: (id: string) => [...patientDataKeys.all, "trends", id] as const,
  stats: () => [...patientDataKeys.all, "stats"] as const,
  search: (query: string) => [...patientDataKeys.all, "search", query] as const,
};

/**
 * Hook to fetch patient list with filters
 */
export function usePatientList(params: PatientListParams = {}) {
  const mockService = getMockPatientService();

  return useQuery<PatientListResponse>({
    queryKey: patientDataKeys.list(params),
    queryFn: async () => {
      if (USE_MOCK) {
        return mockService.getPatientList(params);
      }
      // In production, use real API
      const { getPatientService } = await import("@/services/patients/patientService");
      return getPatientService().getPatients(params);
    },
  });
}

/**
 * Hook to fetch single patient
 */
export function usePatientDetail(patientId: string) {
  const mockService = getMockPatientService();

  return useQuery<Patient | null>({
    queryKey: patientDataKeys.detail(patientId),
    queryFn: async () => {
      if (USE_MOCK) {
        return mockService.getPatient(patientId);
      }
      const { getPatientService } = await import("@/services/patients/patientService");
      return getPatientService().getPatient(patientId);
    },
    enabled: !!patientId,
  });
}

/**
 * Hook to fetch triage statistics
 */
export function useTriageStatistics() {
  const mockService = getMockPatientService();

  return useQuery<TriageStats>({
    queryKey: patientDataKeys.stats(),
    queryFn: async () => {
      if (USE_MOCK) {
        return mockService.getTriageStats();
      }
      const { getPatientService } = await import("@/services/patients/patientService");
      return getPatientService().getTriageStats();
    },
  });
}

/**
 * Hook to fetch patient alerts
 */
export function usePatientAlertList(patientId: string, includeResolved = false) {
  const mockService = getMockPatientService();

  return useQuery<Alert[]>({
    queryKey: patientDataKeys.alerts(patientId),
    queryFn: async () => {
      if (USE_MOCK) {
        return mockService.getPatientAlerts(patientId, includeResolved);
      }
      const { getPatientService } = await import("@/services/patients/patientService");
      return getPatientService().getPatientAlerts(patientId, includeResolved);
    },
    enabled: !!patientId,
  });
}

/**
 * Hook to fetch patient health trends
 */
export function usePatientHealthTrends(patientId: string) {
  const mockService = getMockPatientService();

  return useQuery<HealthTrend[]>({
    queryKey: patientDataKeys.trends(patientId),
    queryFn: async () => {
      if (USE_MOCK) {
        return mockService.getHealthTrends(patientId);
      }
      const { getPatientService } = await import("@/services/patients/patientService");
      return getPatientService().getHealthTrends(patientId);
    },
    enabled: !!patientId,
  });
}

/**
 * Hook to search patients
 */
export function usePatientSearchQuery(query: string) {
  const mockService = getMockPatientService();

  return useQuery<Patient[]>({
    queryKey: patientDataKeys.search(query),
    queryFn: async () => {
      if (USE_MOCK) {
        return mockService.searchPatients(query);
      }
      const { getPatientService } = await import("@/services/patients/patientService");
      return getPatientService().searchPatients(query);
    },
    enabled: query.length >= 2,
  });
}

/**
 * Hook to resolve an alert
 */
export function useAlertResolution() {
  const queryClient = useQueryClient();
  const mockService = getMockPatientService();

  return useMutation({
    mutationFn: async ({
      patientId,
      alertId,
      resolvedBy,
      resolution,
    }: {
      patientId: string;
      alertId: string;
      resolvedBy: string;
      resolution: string;
    }) => {
      if (USE_MOCK) {
        return mockService.resolveAlert(patientId, alertId, resolvedBy, resolution);
      }
      const { getPatientService } = await import("@/services/patients/patientService");
      return getPatientService().resolveAlert(patientId, {
        alertId,
        resolvedBy,
        resolution,
      });
    },
    onSuccess: (_, variables) => {
      // Invalidate related queries
      queryClient.invalidateQueries({
        queryKey: patientDataKeys.alerts(variables.patientId),
      });
      queryClient.invalidateQueries({
        queryKey: patientDataKeys.detail(variables.patientId),
      });
      queryClient.invalidateQueries({
        queryKey: patientDataKeys.stats(),
      });
      queryClient.invalidateQueries({
        queryKey: patientDataKeys.list({}),
      });
    },
  });
}

/**
 * Hook to update patient triage level
 */
export function useTriageUpdate() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      patientId,
      triageLevel,
    }: {
      patientId: string;
      triageLevel: TriageLevel;
    }) => {
      if (USE_MOCK) {
        // Mock doesn't support triage updates, return current patient
        const patient = await getMockPatientService().getPatient(patientId);
        return patient;
      }
      const { getPatientService } = await import("@/services/patients/patientService");
      return getPatientService().updatePatient(patientId, { triageLevel });
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: patientDataKeys.detail(variables.patientId),
      });
      queryClient.invalidateQueries({
        queryKey: patientDataKeys.stats(),
      });
      queryClient.invalidateQueries({
        queryKey: patientDataKeys.list({}),
      });
    },
  });
}
