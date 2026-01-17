/**
 * Services Index
 * Central export for all service modules
 */

// API Client
export { ApiClient, apiClient, ApiClientError } from "./api/client";
export type { ApiConfig, ApiResponse, ApiError } from "./api/client";

// WhatsApp Service
export {
  WhatsAppService,
  initWhatsAppService,
  getWhatsAppService,
} from "./whatsapp/whatsappService";
export {
  WhatsAppWebhookHandler,
  createWebhookHandler,
} from "./whatsapp/webhookHandler";
export type {
  WhatsAppMessage,
  WhatsAppConversation,
  SendMessageRequest,
  SendMessageResponse,
  WhatsAppWebhookPayload,
  QuickReplyConfig,
  CardioWatchTemplate,
} from "./whatsapp/types";

// Wearable Service
export {
  WearableService,
  initWearableService,
  getWearableService,
} from "./wearables/wearableService";
export type {
  WearableProvider,
  WearableDevice,
  HealthDataType,
  HealthSample,
  DailyHealthSummary,
  DailyMetrics,
  HealthTrend,
  MetricAlert,
  ClinicalThresholds,
  SyncRequest,
  SyncResponse,
  WearableWebhookPayload,
  RealTimeHeartRate,
  RealTimeAlert,
} from "./wearables/types";

// Patient Service
export {
  PatientService,
  initPatientService,
  getPatientService,
} from "./patients/patientService";
export type {
  PatientListParams,
  PatientListResponse,
  CreatePatientRequest,
  UpdatePatientRequest,
  AlertResolutionRequest,
  CheckInRecord,
} from "./patients/patientService";

// Patient Hooks
export {
  patientKeys,
  usePatients,
  useTriageStats,
  usePatientSearch,
  usePatient,
  usePatientAlerts,
  usePatientWearables,
  usePatientTrends,
  useUpdatePatient,
  useResolveAlert,
  useUpdateTriage,
  usePrefetchPatient,
  usePrefetchPatients,
  useOptimisticResolveAlert,
} from "./patients/usePatients";

// Auth Service
export {
  AuthService,
  initAuthService,
  getAuthService,
} from "./auth/authService";
export type {
  User,
  UserRole,
  Permission,
  AuthTokens,
  LoginRequest,
  LoginResponse,
  RegisterRequest,
  SessionInfo,
} from "./auth/authService";

// Notification Service
export {
  NotificationService,
  initNotificationService,
  getNotificationService,
  NOTIFICATION_TEMPLATES,
} from "./notifications/notificationService";
export type {
  Notification,
  NotificationChannel,
  NotificationType,
  NotificationPriority,
  NotificationStatus,
  NotificationData,
  NotificationPreferences,
  SendNotificationRequest,
  BulkNotificationRequest,
} from "./notifications/notificationService";

// ============================================================================
// SERVICE INITIALIZATION
// ============================================================================

import { apiClient } from "./api/client";
import { initPatientService } from "./patients/patientService";
import { initWearableService } from "./wearables/wearableService";
import { initAuthService } from "./auth/authService";
import { initNotificationService } from "./notifications/notificationService";

/**
 * Initialize all services with API client
 */
export function initializeServices(): void {
  initPatientService(apiClient);
  initWearableService(apiClient);
  initAuthService(apiClient);
  initNotificationService(apiClient);
}

/**
 * Initialize services with custom API client
 */
export function initializeServicesWithClient(client: typeof apiClient): void {
  initPatientService(client);
  initWearableService(client);
  initAuthService(client);
  initNotificationService(client);
}
