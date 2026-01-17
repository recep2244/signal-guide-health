/**
 * React Query Hooks for Patient API
 * Provides data fetching, caching, and mutations for patient data
 */

import {
  useQuery,
  useMutation,
  useQueryClient,
  UseQueryOptions,
  UseMutationOptions,
} from "@tanstack/react-query";
import { getPatientService, PatientListParams, PatientListResponse } from "./patientService";
import { Patient, TriageLevel, TriageStats, Alert, WearableReading } from "@/types/patient";
import { HealthTrend } from "../wearables/types";

// ============================================================================
// QUERY KEYS
// ============================================================================

export const patientKeys = {
  all: ["patients"] as const,
  lists: () => [...patientKeys.all, "list"] as const,
  list: (params: PatientListParams) => [...patientKeys.lists(), params] as const,
  details: () => [...patientKeys.all, "detail"] as const,
  detail: (id: string) => [...patientKeys.details(), id] as const,
  alerts: (id: string) => [...patientKeys.detail(id), "alerts"] as const,
  wearables: (id: string) => [...patientKeys.detail(id), "wearables"] as const,
  trends: (id: string) => [...patientKeys.detail(id), "trends"] as const,
  checkIns: (id: string) => [...patientKeys.detail(id), "checkIns"] as const,
  stats: () => [...patientKeys.all, "stats"] as const,
  search: (query: string) => [...patientKeys.all, "search", query] as const,
};

// ============================================================================
// PATIENT LIST HOOKS
// ============================================================================

/**
 * Hook to fetch paginated patient list
 */
export function usePatients(
  params: PatientListParams = {},
  options?: Omit<UseQueryOptions<PatientListResponse>, "queryKey" | "queryFn">
) {
  return useQuery({
    queryKey: patientKeys.list(params),
    queryFn: () => getPatientService().getPatients(params),
    ...options,
  });
}

/**
 * Hook to fetch triage statistics
 */
export function useTriageStats(
  options?: Omit<UseQueryOptions<TriageStats>, "queryKey" | "queryFn">
) {
  return useQuery({
    queryKey: patientKeys.stats(),
    queryFn: () => getPatientService().getTriageStats(),
    ...options,
  });
}

/**
 * Hook to search patients
 */
export function usePatientSearch(
  query: string,
  options?: Omit<UseQueryOptions<Patient[]>, "queryKey" | "queryFn">
) {
  return useQuery({
    queryKey: patientKeys.search(query),
    queryFn: () => getPatientService().searchPatients(query),
    enabled: query.length >= 2,
    ...options,
  });
}

// ============================================================================
// PATIENT DETAIL HOOKS
// ============================================================================

/**
 * Hook to fetch single patient
 */
export function usePatient(
  patientId: string,
  options?: Omit<UseQueryOptions<Patient>, "queryKey" | "queryFn">
) {
  return useQuery({
    queryKey: patientKeys.detail(patientId),
    queryFn: () => getPatientService().getPatient(patientId),
    enabled: !!patientId,
    ...options,
  });
}

/**
 * Hook to fetch patient alerts
 */
export function usePatientAlerts(
  patientId: string,
  includeResolved: boolean = false,
  options?: Omit<UseQueryOptions<Alert[]>, "queryKey" | "queryFn">
) {
  return useQuery({
    queryKey: patientKeys.alerts(patientId),
    queryFn: () => getPatientService().getPatientAlerts(patientId, includeResolved),
    enabled: !!patientId,
    ...options,
  });
}

/**
 * Hook to fetch patient wearable data
 */
export function usePatientWearables(
  patientId: string,
  days: number = 14,
  options?: Omit<UseQueryOptions<WearableReading[]>, "queryKey" | "queryFn">
) {
  return useQuery({
    queryKey: patientKeys.wearables(patientId),
    queryFn: () => getPatientService().getWearableData(patientId, days),
    enabled: !!patientId,
    ...options,
  });
}

/**
 * Hook to fetch patient health trends
 */
export function usePatientTrends(
  patientId: string,
  options?: Omit<UseQueryOptions<HealthTrend[]>, "queryKey" | "queryFn">
) {
  return useQuery({
    queryKey: patientKeys.trends(patientId),
    queryFn: () => getPatientService().getHealthTrends(patientId),
    enabled: !!patientId,
    ...options,
  });
}

// ============================================================================
// MUTATION HOOKS
// ============================================================================

/**
 * Hook to update patient
 */
export function useUpdatePatient(
  options?: UseMutationOptions<
    Patient,
    Error,
    { patientId: string; data: Partial<Patient> }
  >
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ patientId, data }) =>
      getPatientService().updatePatient(patientId, data),
    onSuccess: (data, variables) => {
      // Update cache
      queryClient.setQueryData(patientKeys.detail(variables.patientId), data);
      // Invalidate list queries
      queryClient.invalidateQueries({ queryKey: patientKeys.lists() });
    },
    ...options,
  });
}

/**
 * Hook to resolve an alert
 */
export function useResolveAlert(
  options?: UseMutationOptions<
    Alert,
    Error,
    { patientId: string; alertId: string; resolvedBy: string; resolution: string; notes?: string }
  >
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ patientId, alertId, resolvedBy, resolution, notes }) =>
      getPatientService().resolveAlert(patientId, {
        alertId,
        resolvedBy,
        resolution,
        notes,
      }),
    onSuccess: (_, variables) => {
      // Invalidate patient alerts
      queryClient.invalidateQueries({
        queryKey: patientKeys.alerts(variables.patientId),
      });
      // Invalidate patient detail (triage might change)
      queryClient.invalidateQueries({
        queryKey: patientKeys.detail(variables.patientId),
      });
      // Invalidate stats
      queryClient.invalidateQueries({ queryKey: patientKeys.stats() });
    },
    ...options,
  });
}

/**
 * Hook to update patient triage level
 */
export function useUpdateTriage(
  options?: UseMutationOptions<
    Patient,
    Error,
    { patientId: string; triageLevel: TriageLevel }
  >
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ patientId, triageLevel }) =>
      getPatientService().updatePatient(patientId, { triageLevel }),
    onSuccess: (data, variables) => {
      queryClient.setQueryData(patientKeys.detail(variables.patientId), data);
      queryClient.invalidateQueries({ queryKey: patientKeys.lists() });
      queryClient.invalidateQueries({ queryKey: patientKeys.stats() });
    },
    ...options,
  });
}

// ============================================================================
// PREFETCH HELPERS
// ============================================================================

/**
 * Prefetch patient data
 */
export function usePrefetchPatient() {
  const queryClient = useQueryClient();

  return (patientId: string) => {
    queryClient.prefetchQuery({
      queryKey: patientKeys.detail(patientId),
      queryFn: () => getPatientService().getPatient(patientId),
    });
  };
}

/**
 * Prefetch patient list
 */
export function usePrefetchPatients() {
  const queryClient = useQueryClient();

  return (params: PatientListParams = {}) => {
    queryClient.prefetchQuery({
      queryKey: patientKeys.list(params),
      queryFn: () => getPatientService().getPatients(params),
    });
  };
}

// ============================================================================
// OPTIMISTIC UPDATE HELPERS
// ============================================================================

/**
 * Hook for optimistic alert resolution
 */
export function useOptimisticResolveAlert() {
  const queryClient = useQueryClient();

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
      return getPatientService().resolveAlert(patientId, {
        alertId,
        resolvedBy,
        resolution,
      });
    },
    onMutate: async ({ patientId, alertId }) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({
        queryKey: patientKeys.alerts(patientId),
      });

      // Snapshot previous value
      const previousAlerts = queryClient.getQueryData<Alert[]>(
        patientKeys.alerts(patientId)
      );

      // Optimistically update
      if (previousAlerts) {
        queryClient.setQueryData<Alert[]>(
          patientKeys.alerts(patientId),
          previousAlerts.map((alert) =>
            alert.id === alertId ? { ...alert, resolved: true } : alert
          )
        );
      }

      return { previousAlerts };
    },
    onError: (err, { patientId }, context) => {
      // Rollback on error
      if (context?.previousAlerts) {
        queryClient.setQueryData(
          patientKeys.alerts(patientId),
          context.previousAlerts
        );
      }
    },
    onSettled: (_, __, { patientId }) => {
      // Refetch after settle
      queryClient.invalidateQueries({
        queryKey: patientKeys.alerts(patientId),
      });
    },
  });
}
