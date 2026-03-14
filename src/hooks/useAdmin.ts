import { useQuery } from '@tanstack/react-query';
import apiClient from '@/services/api/client';

interface AdminUser {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  role: string;
  createdAt: string;
}

interface AuditLog {
  id: string;
  userId: string | null;
  action: string;
  entityType: string | null;
  entityId: string | null;
  createdAt: string;
  ipAddress: string | null;
  oldValues: unknown;
  newValues: unknown;
}

interface PaginatedUsersResponse {
  status: string;
  data: { users: AdminUser[]; total: number; page: number; limit: number };
}

interface PaginatedLogsResponse {
  status: string;
  data: { logs: AuditLog[]; total: number; page: number; limit: number };
}

export function useAdminUsers(page = 1, limit = 20) {
  return useQuery({
    queryKey: ['admin', 'users', page, limit],
    queryFn: async () => {
      const res = await apiClient.get<PaginatedUsersResponse>(
        `/admin/users?page=${page}&limit=${limit}`
      );
      return res.data;
    },
  });
}

export function useAdminAuditLogs(page = 1, limit = 20) {
  return useQuery({
    queryKey: ['admin', 'audit-logs', page, limit],
    queryFn: async () => {
      const res = await apiClient.get<PaginatedLogsResponse>(
        `/admin/audit-logs?page=${page}&limit=${limit}`
      );
      return res.data;
    },
  });
}

interface AdminStats {
  dailyActiveUsers?: number;
  dailyCheckIns?: number;
  avgResponseTime?: string;
  alertsResolved?: number;
  wearablesSynced?: number;
  messagesExchanged?: number;
  readmissionReduction?: number;
  patientSatisfaction?: number;
  dataPointsCollected?: string;
  apiCalls24h?: string;
  storageUsed?: string;
  bandwidthUsed?: string;
}

interface AdminStatsResponse {
  status: string;
  data: { stats: AdminStats };
}

export function useAdminStats() {
  return useQuery({
    queryKey: ['admin', 'stats'],
    queryFn: async () => {
      const res = await apiClient.get<AdminStatsResponse>('/admin/stats');
      return res.data;
    },
    staleTime: 60_000,
  });
}
