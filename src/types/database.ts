/**
 * Database Types
 * TypeScript types matching the PostgreSQL schema
 */

// ============================================================================
// ENUMS
// ============================================================================

export type UserRole = 'patient' | 'doctor' | 'nurse' | 'admin' | 'super_admin';

export type UserStatus = 'active' | 'inactive' | 'suspended' | 'pending_verification';

export type TriageLevel = 'red' | 'amber' | 'green';

export type AlertType =
  | 'vital_signs'
  | 'missed_checkin'
  | 'symptom_reported'
  | 'medication_missed'
  | 'wearable_disconnected'
  | 'critical_trend'
  | 'manual';

export type AlertSeverity = 'low' | 'medium' | 'high' | 'critical';

export type CommChannel = 'whatsapp' | 'sms' | 'email' | 'push' | 'in_app';

export type WearableType = 'apple_watch' | 'fitbit' | 'garmin' | 'samsung' | 'other';

export type GenderType = 'male' | 'female' | 'other' | 'prefer_not_to_say';

export type AppointmentStatus = 'scheduled' | 'confirmed' | 'completed' | 'cancelled' | 'no_show';

// ============================================================================
// BASE TYPES
// ============================================================================

export interface Organization {
  id: string;
  name: string;
  type: 'nhs_trust' | 'hospital' | 'gp_practice' | 'clinic';
  address?: string;
  phone?: string;
  email?: string;
  odsCode?: string;
  parentOrgId?: string;
  settings: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

export interface User {
  id: string;
  email: string;
  role: UserRole;
  status: UserStatus;
  firstName: string;
  lastName: string;
  phone?: string;
  avatarUrl?: string;
  organizationId?: string;
  emailVerified: boolean;
  phoneVerified: boolean;
  mfaEnabled: boolean;
  lastLoginAt?: Date;
  failedLoginAttempts: number;
  lockedUntil?: Date;
  preferences: UserPreferences;
  createdAt: Date;
  updatedAt: Date;
}

export interface UserPreferences {
  theme?: 'light' | 'dark' | 'system';
  notifications?: {
    email?: boolean;
    push?: boolean;
    sms?: boolean;
  };
  language?: string;
  timezone?: string;
}

// ============================================================================
// ADMIN TYPES
// ============================================================================

export interface Admin {
  id: string;
  userId: string;
  adminLevel: 'standard' | 'senior' | 'super';
  department?: string;
  permissions: string[];
  canManageDoctors: boolean;
  canManagePatients: boolean;
  canManageAdmins: boolean;
  canViewAnalytics: boolean;
  canManageSettings: boolean;
  canManageBilling: boolean;
  auditLogAccess: boolean;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface AdminWithUser extends Admin {
  user: User;
}

// ============================================================================
// DOCTOR TYPES
// ============================================================================

export interface Doctor {
  id: string;
  userId: string;

  // Professional details
  gmcNumber?: string;
  nmcNumber?: string;
  specialty?: string;
  title?: string;
  qualifications: string[];

  // Work details
  department?: string;
  jobTitle?: string;
  consultationFee?: number;

  // Availability
  workingHours: WorkingHours;
  maxPatients: number;
  acceptingNewPatients: boolean;

  // Contact
  preferredContactMethod: CommChannel;
  notificationSettings: NotificationSettings;

  // Stats
  totalPatients: number;
  averageRating?: number;

  bio?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface WorkingHours {
  monday?: DaySchedule;
  tuesday?: DaySchedule;
  wednesday?: DaySchedule;
  thursday?: DaySchedule;
  friday?: DaySchedule;
  saturday?: DaySchedule;
  sunday?: DaySchedule;
}

export interface DaySchedule {
  start: string; // "09:00"
  end: string; // "17:00"
  breaks?: { start: string; end: string }[];
}

export interface NotificationSettings {
  criticalAlerts?: boolean;
  newPatients?: boolean;
  appointmentReminders?: boolean;
  dailySummary?: boolean;
  weeklyReport?: boolean;
}

export interface DoctorWithUser extends Doctor {
  user: User;
}

export interface DoctorPatientAssignment {
  id: string;
  doctorId: string;
  patientId: string;
  isPrimary: boolean;
  assignedAt: Date;
  assignedBy?: string;
  status: 'active' | 'transferred' | 'discharged';
  notes?: string;
}

// ============================================================================
// PATIENT TYPES
// ============================================================================

export interface Patient {
  id: string;
  userId: string;

  // NHS Details
  nhsNumber?: string;
  hospitalNumber?: string;

  // Demographics
  dateOfBirth: Date;
  gender?: GenderType;
  addressLine1?: string;
  addressLine2?: string;
  city?: string;
  postcode?: string;
  country: string;

  // Emergency contact
  emergencyContactName?: string;
  emergencyContactPhone?: string;
  emergencyContactRelationship?: string;

  // Medical details
  bloodType?: string;
  allergies: string[];
  chronicConditions: string[];
  currentMedications: Medication[];
  primaryDiagnosis?: string;
  secondaryDiagnoses: string[];

  // Cardiac specific
  ejectionFraction?: number;
  nyhaClass?: 1 | 2 | 3 | 4;
  cardiacDevices: string[];

  // Care details
  admissionDate?: Date;
  dischargeDate?: Date;
  dischargeSummary?: string;
  carePlan?: string;

  // Triage and monitoring
  triageLevel: TriageLevel;
  triageUpdatedAt?: Date;
  triageUpdatedBy?: string;
  riskScore?: number;
  wellbeingScore?: number;
  lastCheckIn?: Date;
  checkInFrequency: 'daily' | 'twice_daily' | 'weekly';

  // Communication
  preferredLanguage: string;
  preferredContactMethod: CommChannel;
  whatsappPhone?: string;
  whatsappOptedIn: boolean;
  smsOptedIn: boolean;
  emailNotifications: boolean;

  // Consent
  dataSharingConsent: boolean;
  researchConsent: boolean;
  consentDate?: Date;

  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface Medication {
  name: string;
  dosage: string;
  frequency: string;
  startDate?: string;
  endDate?: string;
  prescribedBy?: string;
  notes?: string;
}

export interface PatientWithUser extends Patient {
  user: User;
}

export interface PatientMedicalHistory {
  id: string;
  patientId: string;
  condition: string;
  diagnosedDate?: Date;
  resolvedDate?: Date;
  severity?: string;
  treatingDoctor?: string;
  notes?: string;
  createdAt: Date;
}

// ============================================================================
// WEARABLE TYPES
// ============================================================================

export interface WearableDevice {
  id: string;
  patientId: string;
  deviceType: WearableType;
  deviceName?: string;
  deviceModel?: string;
  serialNumber?: string;

  isConnected: boolean;
  lastSyncAt?: Date;
  connectionStatus: 'connected' | 'disconnected' | 'syncing' | 'error';
  batteryLevel?: number;
  firmwareVersion?: string;

  tokenExpiresAt?: Date;
  syncFrequencyMinutes: number;
  enabledMetrics: string[];

  createdAt: Date;
  updatedAt: Date;
}

export interface WearableReading {
  id: string;
  patientId: string;
  deviceId?: string;
  readingDate: Date;

  // Heart metrics
  restingHeartRate?: number;
  avgHeartRate?: number;
  maxHeartRate?: number;
  minHeartRate?: number;
  hrvMs?: number;

  // Activity metrics
  steps?: number;
  distanceMeters?: number;
  floorsClimbed?: number;
  activeMinutes?: number;
  caloriesBurned?: number;

  // Sleep metrics
  sleepHours?: number;
  deepSleepHours?: number;
  lightSleepHours?: number;
  remSleepHours?: number;
  sleepScore?: number;
  timesAwoken?: number;

  // Other metrics
  bloodOxygenPercent?: number;
  respiratoryRate?: number;
  bodyTemperature?: number;
  weightKg?: number;
  bloodPressureSystolic?: number;
  bloodPressureDiastolic?: number;

  dataQuality: 'good' | 'partial' | 'poor';
  rawData?: Record<string, unknown>;
  createdAt: Date;
}

// ============================================================================
// ALERT TYPES
// ============================================================================

export interface Alert {
  id: string;
  patientId: string;

  type: AlertType;
  severity: AlertSeverity;
  title: string;
  message: string;

  triggerMetric?: string;
  triggerValue?: number;
  thresholdValue?: number;

  resolved: boolean;
  resolvedAt?: Date;
  resolvedBy?: string;
  resolutionNotes?: string;

  assignedTo?: string;
  acknowledged: boolean;
  acknowledgedAt?: Date;
  acknowledgedBy?: string;

  escalationLevel: number;
  escalatedAt?: Date;
  parentAlertId?: string;

  metadata: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

export interface AlertAction {
  id: string;
  alertId: string;
  userId: string;
  actionType: 'comment' | 'escalate' | 'assign' | 'resolve' | 'acknowledge';
  content?: string;
  metadata: Record<string, unknown>;
  createdAt: Date;
}

export interface Notification {
  id: string;
  userId: string;
  channel: CommChannel;

  title: string;
  body: string;
  data: Record<string, unknown>;

  status: 'pending' | 'sent' | 'delivered' | 'failed' | 'read';
  sentAt?: Date;
  deliveredAt?: Date;
  readAt?: Date;
  errorMessage?: string;
  retryCount: number;

  scheduledFor?: Date;
  expiresAt?: Date;

  createdAt: Date;
}

// ============================================================================
// CHECK-IN AND CHAT TYPES
// ============================================================================

export interface CheckIn {
  id: string;
  patientId: string;

  channel: CommChannel;
  timestamp: Date;

  wellbeingScore?: number;
  painScore?: number;
  energyLevel?: number;
  sleepQuality?: number;
  moodScore?: number;

  symptoms: Symptom[];
  symptomNotes?: string;

  medicationsTaken?: boolean;
  missedMedications: string[];

  triageOutcome?: TriageLevel;
  requiresCallback: boolean;
  callbackPriority?: string;

  aiSummary?: string;
  aiRiskFlags: string[];

  metadata: Record<string, unknown>;
  createdAt: Date;
}

export interface Symptom {
  name: string;
  severity: 'mild' | 'moderate' | 'severe';
  duration?: string;
  notes?: string;
}

export interface ChatMessage {
  id: string;
  patientId: string;

  channel: CommChannel;
  direction: 'inbound' | 'outbound';
  senderType: 'patient' | 'doctor' | 'system' | 'ai';
  senderId?: string;

  messageType: 'text' | 'button' | 'list' | 'template' | 'media';
  content: string;
  mediaUrl?: string;
  mediaType?: string;

  whatsappMessageId?: string;
  whatsappStatus?: 'sent' | 'delivered' | 'read' | 'failed';

  isAutomated: boolean;
  flowStep?: string;
  intentDetected?: string;
  sentiment?: string;

  metadata: Record<string, unknown>;
  createdAt: Date;
}

export interface Conversation {
  id: string;
  patientId: string;
  channel: CommChannel;

  status: 'active' | 'waiting' | 'resolved' | 'escalated';
  startedAt: Date;
  lastMessageAt?: Date;
  resolvedAt?: Date;

  currentFlow?: string;
  flowState: Record<string, unknown>;

  assignedDoctorId?: string;

  metadata: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

// ============================================================================
// APPOINTMENT TYPES
// ============================================================================

export interface Appointment {
  id: string;
  patientId: string;
  doctorId: string;

  type: 'follow_up' | 'consultation' | 'emergency' | 'review';
  status: AppointmentStatus;

  scheduledAt: Date;
  durationMinutes: number;
  actualStartAt?: Date;
  actualEndAt?: Date;

  locationType: 'in_person' | 'video' | 'phone';
  locationDetails?: string;
  videoLink?: string;

  reason?: string;
  preAppointmentNotes?: string;
  clinicalNotes?: string;
  followUpActions: FollowUpAction[];

  reminderSent: boolean;
  reminderSentAt?: Date;

  cancelledAt?: Date;
  cancelledBy?: string;
  cancellationReason?: string;

  createdBy?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface FollowUpAction {
  action: string;
  dueDate?: string;
  assignedTo?: string;
  completed?: boolean;
  completedAt?: string;
}

// ============================================================================
// AUDIT AND ANALYTICS TYPES
// ============================================================================

export interface AuditLog {
  id: string;
  userId?: string;

  action: string;
  entityType: string;
  entityId?: string;

  oldValues?: Record<string, unknown>;
  newValues?: Record<string, unknown>;

  ipAddress?: string;
  userAgent?: string;
  sessionId?: string;

  status: 'success' | 'failure' | 'error';
  errorMessage?: string;

  createdAt: Date;
}

export interface UserSession {
  id: string;
  userId: string;

  ipAddress?: string;
  userAgent?: string;
  deviceInfo?: Record<string, unknown>;

  expiresAt: Date;
  refreshExpiresAt?: Date;

  isActive: boolean;
  revokedAt?: Date;

  createdAt: Date;
  lastActivityAt: Date;
}

export interface PatientDailyStats {
  id: string;
  patientId: string;
  statDate: Date;

  checkInsCompleted: number;
  messagesSent: number;
  messagesReceived: number;

  avgHeartRate?: number;
  avgHrv?: number;
  totalSteps?: number;
  totalSleepHours?: number;
  wellbeingScore?: number;

  alertsGenerated: number;
  alertsResolved: number;

  triageLevel?: TriageLevel;
  riskScore?: number;

  createdAt: Date;
}

export interface SystemDailyStats {
  id: string;
  statDate: Date;

  totalPatients: number;
  activePatients: number;
  newPatients: number;
  totalDoctors: number;
  activeDoctors: number;

  patientsRed: number;
  patientsAmber: number;
  patientsGreen: number;

  totalCheckIns: number;
  totalMessages: number;

  alertsGenerated: number;
  alertsResolved: number;
  avgResolutionTimeMinutes?: number;

  appointmentsScheduled: number;
  appointmentsCompleted: number;
  appointmentsCancelled: number;

  createdAt: Date;
}

// ============================================================================
// API REQUEST/RESPONSE TYPES
// ============================================================================

export interface CreateUserRequest {
  email: string;
  password: string;
  role: UserRole;
  firstName: string;
  lastName: string;
  phone?: string;
  organizationId?: string;
}

export interface CreatePatientRequest extends CreateUserRequest {
  nhsNumber?: string;
  dateOfBirth: string;
  gender?: GenderType;
  primaryDiagnosis?: string;
  admissionDate?: string;
  dischargeDate?: string;
  assignedDoctorId?: string;
}

export interface CreateDoctorRequest extends CreateUserRequest {
  gmcNumber?: string;
  specialty?: string;
  title?: string;
  department?: string;
}

export interface CreateAdminRequest extends CreateUserRequest {
  adminLevel?: 'standard' | 'senior' | 'super';
  permissions?: string[];
}

export interface UpdatePatientTriageRequest {
  triageLevel: TriageLevel;
  notes?: string;
}

export interface CreateAlertRequest {
  patientId: string;
  type: AlertType;
  severity: AlertSeverity;
  title: string;
  message: string;
  triggerMetric?: string;
  triggerValue?: number;
  thresholdValue?: number;
}

export interface ResolveAlertRequest {
  resolutionNotes: string;
}

export interface CreateAppointmentRequest {
  patientId: string;
  doctorId: string;
  type: Appointment['type'];
  scheduledAt: string;
  durationMinutes?: number;
  locationType?: Appointment['locationType'];
  locationDetails?: string;
  reason?: string;
}

// ============================================================================
// PAGINATION AND FILTERING
// ============================================================================

export interface PaginationParams {
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface PatientFilters extends PaginationParams {
  triageLevel?: TriageLevel;
  hasUnresolvedAlerts?: boolean;
  assignedDoctorId?: string;
  search?: string;
  dischargedAfter?: string;
  dischargedBefore?: string;
}

export interface AlertFilters extends PaginationParams {
  patientId?: string;
  type?: AlertType;
  severity?: AlertSeverity;
  resolved?: boolean;
  assignedTo?: string;
  createdAfter?: string;
  createdBefore?: string;
}

export interface AppointmentFilters extends PaginationParams {
  patientId?: string;
  doctorId?: string;
  status?: AppointmentStatus;
  type?: Appointment['type'];
  scheduledAfter?: string;
  scheduledBefore?: string;
}
