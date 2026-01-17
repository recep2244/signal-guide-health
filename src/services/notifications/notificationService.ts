/**
 * Notification Service
 * Multi-channel notification delivery (push, email, SMS, WhatsApp)
 */

import { ApiClient } from "../api/client";
import { TriageLevel } from "@/types/patient";

// ============================================================================
// TYPES
// ============================================================================

export type NotificationChannel = "push" | "email" | "sms" | "whatsapp" | "in_app";

export type NotificationType =
  | "alert_red"
  | "alert_amber"
  | "daily_checkin"
  | "appointment_reminder"
  | "medication_reminder"
  | "wearable_sync_issue"
  | "message_received"
  | "escalation"
  | "shift_handoff"
  | "system";

export type NotificationPriority = "critical" | "high" | "normal" | "low";

export type NotificationStatus =
  | "pending"
  | "sent"
  | "delivered"
  | "read"
  | "failed"
  | "cancelled";

export interface Notification {
  id: string;
  type: NotificationType;
  channel: NotificationChannel;
  priority: NotificationPriority;
  status: NotificationStatus;
  recipientId: string;
  recipientType: "clinician" | "patient";
  title: string;
  body: string;
  data?: NotificationData;
  createdAt: string;
  sentAt?: string;
  deliveredAt?: string;
  readAt?: string;
  expiresAt?: string;
  metadata?: NotificationMetadata;
}

export interface NotificationData {
  patientId?: string;
  patientName?: string;
  alertId?: string;
  triageLevel?: TriageLevel;
  actionUrl?: string;
  actionLabel?: string;
  deepLink?: string;
}

export interface NotificationMetadata {
  messageId?: string;
  errorCode?: string;
  errorMessage?: string;
  retryCount?: number;
  deviceToken?: string;
}

export interface NotificationPreferences {
  userId: string;
  channels: {
    push: boolean;
    email: boolean;
    sms: boolean;
    whatsapp: boolean;
    inApp: boolean;
  };
  quietHours?: {
    enabled: boolean;
    start: string; // HH:mm format
    end: string;
    timezone: string;
    exceptCritical: boolean;
  };
  typePreferences: Record<NotificationType, NotificationChannel[]>;
}

export interface SendNotificationRequest {
  recipientId: string;
  recipientType: "clinician" | "patient";
  type: NotificationType;
  title: string;
  body: string;
  channels?: NotificationChannel[];
  priority?: NotificationPriority;
  data?: NotificationData;
  scheduleAt?: string;
  expiresAt?: string;
}

export interface BulkNotificationRequest {
  recipientIds: string[];
  recipientType: "clinician" | "patient";
  type: NotificationType;
  title: string;
  body: string;
  channels?: NotificationChannel[];
  priority?: NotificationPriority;
  data?: NotificationData;
}

// ============================================================================
// NOTIFICATION TEMPLATES
// ============================================================================

export const NOTIFICATION_TEMPLATES = {
  ALERT_RED: {
    title: "🚨 URGENT: {{patientName}}",
    body: "{{alertDescription}}. Immediate attention required.",
    priority: "critical" as NotificationPriority,
  },
  ALERT_AMBER: {
    title: "⚠️ Review Today: {{patientName}}",
    body: "{{alertDescription}}. Same-day review recommended.",
    priority: "high" as NotificationPriority,
  },
  DAILY_CHECKIN: {
    title: "Daily Check-in",
    body: "Hi {{patientName}}, time for your daily health check-in.",
    priority: "normal" as NotificationPriority,
  },
  WEARABLE_SYNC_ISSUE: {
    title: "Sync Issue Detected",
    body: "{{patientName}}'s wearable hasn't synced in {{hours}} hours.",
    priority: "normal" as NotificationPriority,
  },
  ESCALATION: {
    title: "Patient Escalated",
    body: "{{patientName}} has been escalated to {{triageLevel}}. Reason: {{reason}}",
    priority: "high" as NotificationPriority,
  },
  SHIFT_HANDOFF: {
    title: "Shift Handoff",
    body: "{{count}} patients require attention. {{redCount}} red, {{amberCount}} amber.",
    priority: "normal" as NotificationPriority,
  },
};

// ============================================================================
// SERVICE CLASS
// ============================================================================

export class NotificationService {
  private client: ApiClient;
  private wsConnection: WebSocket | null = null;
  private listeners: Map<string, Set<(notification: Notification) => void>> = new Map();

  constructor(client: ApiClient) {
    this.client = client;
  }

  // ---------------------------------------------------------------------------
  // SEND NOTIFICATIONS
  // ---------------------------------------------------------------------------

  /**
   * Send a notification
   */
  async send(request: SendNotificationRequest): Promise<Notification> {
    const response = await this.client.post<Notification>(
      "/notifications/send",
      request
    );
    return response.data;
  }

  /**
   * Send bulk notifications
   */
  async sendBulk(request: BulkNotificationRequest): Promise<{
    sent: number;
    failed: number;
    notifications: Notification[];
  }> {
    const response = await this.client.post<{
      sent: number;
      failed: number;
      notifications: Notification[];
    }>("/notifications/send-bulk", request);
    return response.data;
  }

  /**
   * Send alert notification to clinicians
   */
  async sendAlertNotification(
    patientId: string,
    patientName: string,
    alertId: string,
    triageLevel: TriageLevel,
    alertDescription: string,
    clinicianIds: string[]
  ): Promise<void> {
    const template =
      triageLevel === "red"
        ? NOTIFICATION_TEMPLATES.ALERT_RED
        : NOTIFICATION_TEMPLATES.ALERT_AMBER;

    const title = template.title.replace("{{patientName}}", patientName);
    const body = template.body.replace("{{alertDescription}}", alertDescription);

    await this.sendBulk({
      recipientIds: clinicianIds,
      recipientType: "clinician",
      type: triageLevel === "red" ? "alert_red" : "alert_amber",
      title,
      body,
      priority: template.priority,
      data: {
        patientId,
        patientName,
        alertId,
        triageLevel,
        actionUrl: `/patient/${patientId}`,
        actionLabel: "View Patient",
      },
    });
  }

  /**
   * Send daily check-in reminder
   */
  async sendCheckInReminder(
    patientId: string,
    patientName: string,
    phoneNumber: string
  ): Promise<Notification> {
    const template = NOTIFICATION_TEMPLATES.DAILY_CHECKIN;
    const body = template.body.replace("{{patientName}}", patientName);

    return this.send({
      recipientId: patientId,
      recipientType: "patient",
      type: "daily_checkin",
      title: template.title,
      body,
      channels: ["whatsapp", "push"],
      priority: template.priority,
      data: {
        patientId,
        patientName,
        deepLink: "cardiowatch://checkin",
      },
    });
  }

  /**
   * Send wearable sync issue notification
   */
  async sendSyncIssueNotification(
    patientId: string,
    patientName: string,
    hoursSinceSync: number,
    clinicianIds: string[]
  ): Promise<void> {
    const template = NOTIFICATION_TEMPLATES.WEARABLE_SYNC_ISSUE;
    const body = template.body
      .replace("{{patientName}}", patientName)
      .replace("{{hours}}", String(hoursSinceSync));

    await this.sendBulk({
      recipientIds: clinicianIds,
      recipientType: "clinician",
      type: "wearable_sync_issue",
      title: template.title,
      body,
      priority: hoursSinceSync > 24 ? "high" : "normal",
      data: {
        patientId,
        patientName,
        actionUrl: `/patient/${patientId}`,
      },
    });
  }

  // ---------------------------------------------------------------------------
  // NOTIFICATION MANAGEMENT
  // ---------------------------------------------------------------------------

  /**
   * Get notifications for current user
   */
  async getNotifications(
    limit: number = 50,
    unreadOnly: boolean = false
  ): Promise<Notification[]> {
    const response = await this.client.get<Notification[]>(
      `/notifications?limit=${limit}&unreadOnly=${unreadOnly}`
    );
    return response.data;
  }

  /**
   * Mark notification as read
   */
  async markAsRead(notificationId: string): Promise<void> {
    await this.client.post(`/notifications/${notificationId}/read`);
  }

  /**
   * Mark all notifications as read
   */
  async markAllAsRead(): Promise<void> {
    await this.client.post("/notifications/read-all");
  }

  /**
   * Get unread count
   */
  async getUnreadCount(): Promise<number> {
    const response = await this.client.get<{ count: number }>(
      "/notifications/unread-count"
    );
    return response.data.count;
  }

  /**
   * Cancel a pending notification
   */
  async cancel(notificationId: string): Promise<void> {
    await this.client.post(`/notifications/${notificationId}/cancel`);
  }

  // ---------------------------------------------------------------------------
  // PREFERENCES
  // ---------------------------------------------------------------------------

  /**
   * Get notification preferences
   */
  async getPreferences(): Promise<NotificationPreferences> {
    const response = await this.client.get<NotificationPreferences>(
      "/notifications/preferences"
    );
    return response.data;
  }

  /**
   * Update notification preferences
   */
  async updatePreferences(
    preferences: Partial<NotificationPreferences>
  ): Promise<NotificationPreferences> {
    const response = await this.client.patch<NotificationPreferences>(
      "/notifications/preferences",
      preferences
    );
    return response.data;
  }

  // ---------------------------------------------------------------------------
  // REAL-TIME NOTIFICATIONS (WebSocket)
  // ---------------------------------------------------------------------------

  /**
   * Connect to real-time notification stream
   */
  connect(userId: string, token: string): void {
    if (this.wsConnection) {
      this.disconnect();
    }

    const wsUrl =
      import.meta.env.VITE_WS_URL || "wss://api.cardiowatch.com/ws";
    this.wsConnection = new WebSocket(`${wsUrl}/notifications?token=${token}`);

    this.wsConnection.onopen = () => {
      console.log("Notification WebSocket connected");
    };

    this.wsConnection.onmessage = (event) => {
      try {
        const notification = JSON.parse(event.data) as Notification;
        this.notifyListeners(notification);
      } catch (error) {
        console.error("Failed to parse notification:", error);
      }
    };

    this.wsConnection.onerror = (error) => {
      console.error("WebSocket error:", error);
    };

    this.wsConnection.onclose = () => {
      console.log("Notification WebSocket disconnected");
      // Auto-reconnect after 5 seconds
      setTimeout(() => this.connect(userId, token), 5000);
    };
  }

  /**
   * Disconnect from real-time stream
   */
  disconnect(): void {
    if (this.wsConnection) {
      this.wsConnection.close();
      this.wsConnection = null;
    }
  }

  /**
   * Subscribe to notifications
   */
  subscribe(
    type: NotificationType | "all",
    callback: (notification: Notification) => void
  ): () => void {
    const key = type;
    if (!this.listeners.has(key)) {
      this.listeners.set(key, new Set());
    }
    this.listeners.get(key)!.add(callback);

    return () => {
      this.listeners.get(key)?.delete(callback);
    };
  }

  private notifyListeners(notification: Notification): void {
    // Notify specific type listeners
    this.listeners.get(notification.type)?.forEach((cb) => cb(notification));
    // Notify "all" listeners
    this.listeners.get("all")?.forEach((cb) => cb(notification));
  }

  // ---------------------------------------------------------------------------
  // PUSH NOTIFICATIONS (Browser)
  // ---------------------------------------------------------------------------

  /**
   * Request push notification permission
   */
  async requestPushPermission(): Promise<NotificationPermission> {
    if (!("Notification" in window)) {
      console.warn("Push notifications not supported");
      return "denied";
    }

    return Notification.requestPermission();
  }

  /**
   * Register push notification token
   */
  async registerPushToken(token: string): Promise<void> {
    await this.client.post("/notifications/push/register", { token });
  }

  /**
   * Show local notification (for in-app display)
   */
  showLocalNotification(notification: Notification): void {
    if (Notification.permission === "granted") {
      new Notification(notification.title, {
        body: notification.body,
        icon: "/icon-192.png",
        tag: notification.id,
        data: notification.data,
      });
    }
  }
}

// ============================================================================
// SINGLETON
// ============================================================================

let notificationServiceInstance: NotificationService | null = null;

export function initNotificationService(
  client: ApiClient
): NotificationService {
  notificationServiceInstance = new NotificationService(client);
  return notificationServiceInstance;
}

export function getNotificationService(): NotificationService {
  if (!notificationServiceInstance) {
    throw new Error("Notification service not initialized.");
  }
  return notificationServiceInstance;
}

export default NotificationService;
