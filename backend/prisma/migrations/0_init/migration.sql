-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('patient', 'doctor', 'nurse', 'admin', 'super_admin');

-- CreateEnum
CREATE TYPE "UserStatus" AS ENUM ('active', 'inactive', 'suspended', 'pending_verification');

-- CreateEnum
CREATE TYPE "TriageLevel" AS ENUM ('red', 'amber', 'green');

-- CreateEnum
CREATE TYPE "AlertType" AS ENUM ('vital_signs', 'missed_checkin', 'symptom_reported', 'medication_missed', 'wearable_disconnected', 'critical_trend', 'manual');

-- CreateEnum
CREATE TYPE "AlertSeverity" AS ENUM ('low', 'medium', 'high', 'critical');

-- CreateEnum
CREATE TYPE "CommChannel" AS ENUM ('whatsapp', 'sms', 'email', 'push', 'in_app');

-- CreateEnum
CREATE TYPE "WearableType" AS ENUM ('apple_watch', 'wear_os', 'google_fit', 'health_connect', 'fitbit', 'garmin', 'samsung', 'withings', 'other');

-- CreateEnum
CREATE TYPE "Gender" AS ENUM ('male', 'female', 'other', 'prefer_not_to_say');

-- CreateEnum
CREATE TYPE "AppointmentStatus" AS ENUM ('scheduled', 'confirmed', 'completed', 'cancelled', 'no_show');

-- CreateTable
CREATE TABLE "organizations" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "address" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "ods_code" TEXT,
    "parent_org_id" TEXT,
    "settings" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "organizations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "role" "UserRole" NOT NULL,
    "status" "UserStatus" NOT NULL DEFAULT 'pending_verification',
    "first_name" TEXT NOT NULL,
    "last_name" TEXT NOT NULL,
    "phone" TEXT,
    "avatar_url" TEXT,
    "organization_id" TEXT,
    "email_verified" BOOLEAN NOT NULL DEFAULT false,
    "phone_verified" BOOLEAN NOT NULL DEFAULT false,
    "mfa_enabled" BOOLEAN NOT NULL DEFAULT false,
    "mfa_secret" TEXT,
    "last_login_at" TIMESTAMP(3),
    "failed_login_attempts" INTEGER NOT NULL DEFAULT 0,
    "locked_until" TIMESTAMP(3),
    "preferences" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "admins" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "admin_level" TEXT NOT NULL DEFAULT 'standard',
    "department" TEXT,
    "permissions" JSONB NOT NULL DEFAULT '[]',
    "can_manage_doctors" BOOLEAN NOT NULL DEFAULT false,
    "can_manage_patients" BOOLEAN NOT NULL DEFAULT false,
    "can_manage_admins" BOOLEAN NOT NULL DEFAULT false,
    "can_view_analytics" BOOLEAN NOT NULL DEFAULT true,
    "can_manage_settings" BOOLEAN NOT NULL DEFAULT false,
    "can_manage_billing" BOOLEAN NOT NULL DEFAULT false,
    "audit_log_access" BOOLEAN NOT NULL DEFAULT true,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "admins_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "doctors" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "gmc_number" TEXT,
    "nmc_number" TEXT,
    "specialty" TEXT,
    "title" TEXT,
    "qualifications" TEXT[],
    "department" TEXT,
    "job_title" TEXT,
    "consultation_fee" DECIMAL(10,2),
    "working_hours" JSONB NOT NULL DEFAULT '{}',
    "max_patients" INTEGER NOT NULL DEFAULT 50,
    "accepting_new_patients" BOOLEAN NOT NULL DEFAULT true,
    "preferred_contact_method" "CommChannel" NOT NULL DEFAULT 'email',
    "notification_settings" JSONB NOT NULL DEFAULT '{}',
    "total_patients" INTEGER NOT NULL DEFAULT 0,
    "average_rating" DECIMAL(3,2),
    "bio" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "doctors_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "patients" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "nhs_number" TEXT,
    "hospital_number" TEXT,
    "date_of_birth" DATE NOT NULL,
    "gender" "Gender",
    "address_line1" TEXT,
    "address_line2" TEXT,
    "city" TEXT,
    "postcode" TEXT,
    "country" TEXT NOT NULL DEFAULT 'United Kingdom',
    "emergency_contact_name" TEXT,
    "emergency_contact_phone" TEXT,
    "emergency_contact_relationship" TEXT,
    "blood_type" TEXT,
    "allergies" TEXT[],
    "chronic_conditions" TEXT[],
    "current_medications" JSONB NOT NULL DEFAULT '[]',
    "primary_diagnosis" TEXT,
    "secondary_diagnoses" TEXT[],
    "ejection_fraction" DECIMAL(5,2),
    "nyha_class" INTEGER,
    "cardiac_devices" TEXT[],
    "admission_date" DATE,
    "discharge_date" DATE,
    "discharge_summary" TEXT,
    "care_plan" TEXT,
    "triage_level" "TriageLevel" NOT NULL DEFAULT 'green',
    "triage_updated_at" TIMESTAMP(3),
    "triage_updated_by" TEXT,
    "risk_score" INTEGER,
    "wellbeing_score" INTEGER,
    "last_check_in" TIMESTAMP(3),
    "check_in_frequency" TEXT NOT NULL DEFAULT 'daily',
    "preferred_language" TEXT NOT NULL DEFAULT 'en',
    "preferred_contact_method" "CommChannel" NOT NULL DEFAULT 'whatsapp',
    "whatsapp_phone" TEXT,
    "whatsapp_opted_in" BOOLEAN NOT NULL DEFAULT false,
    "sms_opted_in" BOOLEAN NOT NULL DEFAULT false,
    "email_notifications" BOOLEAN NOT NULL DEFAULT true,
    "data_sharing_consent" BOOLEAN NOT NULL DEFAULT false,
    "research_consent" BOOLEAN NOT NULL DEFAULT false,
    "consent_date" TIMESTAMP(3),
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "patients_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "patient_medical_history" (
    "id" TEXT NOT NULL,
    "patient_id" TEXT NOT NULL,
    "condition" TEXT NOT NULL,
    "diagnosed_date" DATE,
    "resolved_date" DATE,
    "severity" TEXT,
    "treating_doctor" TEXT,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "patient_medical_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "doctor_patient_assignments" (
    "id" TEXT NOT NULL,
    "doctor_id" TEXT NOT NULL,
    "patient_id" TEXT NOT NULL,
    "is_primary" BOOLEAN NOT NULL DEFAULT false,
    "assigned_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "assigned_by" TEXT,
    "status" TEXT NOT NULL DEFAULT 'active',
    "notes" TEXT,

    CONSTRAINT "doctor_patient_assignments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "wearable_devices" (
    "id" TEXT NOT NULL,
    "patient_id" TEXT NOT NULL,
    "device_type" "WearableType" NOT NULL,
    "device_name" TEXT,
    "device_model" TEXT,
    "serial_number" TEXT,
    "is_connected" BOOLEAN NOT NULL DEFAULT false,
    "last_sync_at" TIMESTAMP(3),
    "connection_status" TEXT NOT NULL DEFAULT 'disconnected',
    "battery_level" INTEGER,
    "firmware_version" TEXT,
    "access_token_encrypted" TEXT,
    "refresh_token_encrypted" TEXT,
    "token_expires_at" TIMESTAMP(3),
    "sync_frequency_minutes" INTEGER NOT NULL DEFAULT 15,
    "enabled_metrics" TEXT[] DEFAULT ARRAY['heart_rate', 'steps', 'sleep']::TEXT[],
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "wearable_devices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "wearable_readings" (
    "id" TEXT NOT NULL,
    "patient_id" TEXT NOT NULL,
    "device_id" TEXT,
    "reading_date" DATE NOT NULL,
    "resting_heart_rate" INTEGER,
    "avg_heart_rate" INTEGER,
    "max_heart_rate" INTEGER,
    "min_heart_rate" INTEGER,
    "hrv_ms" INTEGER,
    "steps" INTEGER,
    "distance_meters" DECIMAL(10,2),
    "floors_climbed" INTEGER,
    "active_minutes" INTEGER,
    "calories_burned" INTEGER,
    "sleep_hours" DECIMAL(4,2),
    "deep_sleep_hours" DECIMAL(4,2),
    "light_sleep_hours" DECIMAL(4,2),
    "rem_sleep_hours" DECIMAL(4,2),
    "sleep_score" INTEGER,
    "times_awoken" INTEGER,
    "blood_oxygen_percent" DECIMAL(5,2),
    "respiratory_rate" DECIMAL(5,2),
    "body_temperature" DECIMAL(5,2),
    "weight_kg" DECIMAL(5,2),
    "blood_pressure_systolic" INTEGER,
    "blood_pressure_diastolic" INTEGER,
    "data_quality" TEXT NOT NULL DEFAULT 'good',
    "raw_data" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "wearable_readings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "alerts" (
    "id" TEXT NOT NULL,
    "patient_id" TEXT NOT NULL,
    "type" "AlertType" NOT NULL,
    "severity" "AlertSeverity" NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "trigger_metric" TEXT,
    "trigger_value" DECIMAL(10,2),
    "threshold_value" DECIMAL(10,2),
    "resolved" BOOLEAN NOT NULL DEFAULT false,
    "resolved_at" TIMESTAMP(3),
    "resolved_by" TEXT,
    "resolution_notes" TEXT,
    "assigned_to" TEXT,
    "acknowledged" BOOLEAN NOT NULL DEFAULT false,
    "acknowledged_at" TIMESTAMP(3),
    "acknowledged_by" TEXT,
    "escalation_level" INTEGER NOT NULL DEFAULT 0,
    "escalated_at" TIMESTAMP(3),
    "parent_alert_id" TEXT,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "alerts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "alert_actions" (
    "id" TEXT NOT NULL,
    "alert_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "action_type" TEXT NOT NULL,
    "content" TEXT,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "alert_actions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "check_ins" (
    "id" TEXT NOT NULL,
    "patient_id" TEXT NOT NULL,
    "channel" "CommChannel" NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "wellbeing_score" INTEGER,
    "pain_score" INTEGER,
    "energy_level" INTEGER,
    "sleep_quality" INTEGER,
    "mood_score" INTEGER,
    "symptoms" JSONB NOT NULL DEFAULT '[]',
    "symptom_notes" TEXT,
    "medications_taken" BOOLEAN,
    "missed_medications" JSONB NOT NULL DEFAULT '[]',
    "triage_outcome" "TriageLevel",
    "requires_callback" BOOLEAN NOT NULL DEFAULT false,
    "callback_priority" TEXT,
    "ai_summary" TEXT,
    "ai_risk_flags" JSONB NOT NULL DEFAULT '[]',
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "check_ins_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "chat_messages" (
    "id" TEXT NOT NULL,
    "patient_id" TEXT NOT NULL,
    "channel" "CommChannel" NOT NULL,
    "direction" TEXT NOT NULL,
    "sender_type" TEXT NOT NULL,
    "sender_id" TEXT,
    "message_type" TEXT NOT NULL DEFAULT 'text',
    "content" TEXT NOT NULL,
    "media_url" TEXT,
    "media_type" TEXT,
    "whatsapp_message_id" TEXT,
    "whatsapp_status" TEXT,
    "is_automated" BOOLEAN NOT NULL DEFAULT false,
    "flow_step" TEXT,
    "intent_detected" TEXT,
    "sentiment" TEXT,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "chat_messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "conversations" (
    "id" TEXT NOT NULL,
    "patient_id" TEXT NOT NULL,
    "channel" "CommChannel" NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_message_at" TIMESTAMP(3),
    "resolved_at" TIMESTAMP(3),
    "current_flow" TEXT,
    "flow_state" JSONB NOT NULL DEFAULT '{}',
    "assigned_doctor_id" TEXT,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "conversations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "channel" "CommChannel" NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "data" JSONB NOT NULL DEFAULT '{}',
    "status" TEXT NOT NULL DEFAULT 'pending',
    "sent_at" TIMESTAMP(3),
    "delivered_at" TIMESTAMP(3),
    "read_at" TIMESTAMP(3),
    "error_message" TEXT,
    "retry_count" INTEGER NOT NULL DEFAULT 0,
    "scheduled_for" TIMESTAMP(3),
    "expires_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "appointments" (
    "id" TEXT NOT NULL,
    "patient_id" TEXT NOT NULL,
    "doctor_id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "status" "AppointmentStatus" NOT NULL DEFAULT 'scheduled',
    "scheduled_at" TIMESTAMP(3) NOT NULL,
    "duration_minutes" INTEGER NOT NULL DEFAULT 30,
    "actual_start_at" TIMESTAMP(3),
    "actual_end_at" TIMESTAMP(3),
    "location_type" TEXT NOT NULL DEFAULT 'in_person',
    "location_details" TEXT,
    "video_link" TEXT,
    "reason" TEXT,
    "pre_appointment_notes" TEXT,
    "clinical_notes" TEXT,
    "follow_up_actions" JSONB NOT NULL DEFAULT '[]',
    "reminder_sent" BOOLEAN NOT NULL DEFAULT false,
    "reminder_sent_at" TIMESTAMP(3),
    "cancelled_at" TIMESTAMP(3),
    "cancelled_by" TEXT,
    "cancellation_reason" TEXT,
    "created_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "appointments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" TEXT NOT NULL,
    "user_id" TEXT,
    "action" TEXT NOT NULL,
    "entity_type" TEXT NOT NULL,
    "entity_id" TEXT,
    "old_values" JSONB,
    "new_values" JSONB,
    "ip_address" TEXT,
    "user_agent" TEXT,
    "session_id" TEXT,
    "status" TEXT NOT NULL DEFAULT 'success',
    "error_message" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_sessions" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "token_hash" TEXT NOT NULL,
    "refresh_token_hash" TEXT,
    "ip_address" TEXT,
    "user_agent" TEXT,
    "device_info" JSONB,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "refresh_expires_at" TIMESTAMP(3),
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "revoked_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_activity_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "password_reset_tokens" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "token_hash" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "used_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "password_reset_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "patient_daily_stats" (
    "id" TEXT NOT NULL,
    "patient_id" TEXT NOT NULL,
    "stat_date" DATE NOT NULL,
    "check_ins_completed" INTEGER NOT NULL DEFAULT 0,
    "messages_sent" INTEGER NOT NULL DEFAULT 0,
    "messages_received" INTEGER NOT NULL DEFAULT 0,
    "avg_heart_rate" INTEGER,
    "avg_hrv" INTEGER,
    "total_steps" INTEGER,
    "total_sleep_hours" DECIMAL(4,2),
    "wellbeing_score" INTEGER,
    "alerts_generated" INTEGER NOT NULL DEFAULT 0,
    "alerts_resolved" INTEGER NOT NULL DEFAULT 0,
    "triage_level" "TriageLevel",
    "risk_score" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "patient_daily_stats_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "admin_integration_keys" (
    "id" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "key_name" TEXT NOT NULL,
    "encrypted_value" TEXT NOT NULL,
    "value_fingerprint" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "last_rotated_at" TIMESTAMP(3),
    "last_validated_at" TIMESTAMP(3),
    "last_validation_status" TEXT,
    "last_validation_message" TEXT,
    "created_by" TEXT,
    "updated_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "admin_integration_keys_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "admin_integration_key_versions" (
    "id" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "key_name" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "encrypted_value" TEXT NOT NULL,
    "value_fingerprint" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "rotation_reason" TEXT,
    "rotated_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revoked_at" TIMESTAMP(3),

    CONSTRAINT "admin_integration_key_versions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "system_daily_stats" (
    "id" TEXT NOT NULL,
    "stat_date" DATE NOT NULL,
    "total_patients" INTEGER NOT NULL DEFAULT 0,
    "active_patients" INTEGER NOT NULL DEFAULT 0,
    "new_patients" INTEGER NOT NULL DEFAULT 0,
    "total_doctors" INTEGER NOT NULL DEFAULT 0,
    "active_doctors" INTEGER NOT NULL DEFAULT 0,
    "patients_red" INTEGER NOT NULL DEFAULT 0,
    "patients_amber" INTEGER NOT NULL DEFAULT 0,
    "patients_green" INTEGER NOT NULL DEFAULT 0,
    "total_check_ins" INTEGER NOT NULL DEFAULT 0,
    "total_messages" INTEGER NOT NULL DEFAULT 0,
    "alerts_generated" INTEGER NOT NULL DEFAULT 0,
    "alerts_resolved" INTEGER NOT NULL DEFAULT 0,
    "avg_resolution_time_minutes" INTEGER,
    "appointments_scheduled" INTEGER NOT NULL DEFAULT 0,
    "appointments_completed" INTEGER NOT NULL DEFAULT 0,
    "appointments_cancelled" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "system_daily_stats_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pairing_tokens" (
    "id" TEXT NOT NULL,
    "patient_id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "short_code" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "used_at" TIMESTAMP(3),
    "device_type" "WearableType",
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pairing_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cardiac_metrics" (
    "id" TEXT NOT NULL,
    "patient_id" TEXT NOT NULL,
    "recorded_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "recorded_by" TEXT,
    "ejection_fraction" DECIMAL(5,2),
    "nyha_class" INTEGER,
    "nt_pro_bnp" DECIMAL(10,2),
    "bnp" DECIMAL(10,2),
    "hs_troponin_i" DECIMAL(10,4),
    "hs_troponin_t" DECIMAL(10,4),
    "creatinine" DECIMAL(8,2),
    "killip_class" INTEGER,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cardiac_metrics_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "users_email_idx" ON "users"("email");

-- CreateIndex
CREATE INDEX "users_role_idx" ON "users"("role");

-- CreateIndex
CREATE INDEX "users_organization_id_idx" ON "users"("organization_id");

-- CreateIndex
CREATE UNIQUE INDEX "admins_user_id_key" ON "admins"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "doctors_user_id_key" ON "doctors"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "doctors_gmc_number_key" ON "doctors"("gmc_number");

-- CreateIndex
CREATE UNIQUE INDEX "patients_user_id_key" ON "patients"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "patients_nhs_number_key" ON "patients"("nhs_number");

-- CreateIndex
CREATE INDEX "patients_nhs_number_idx" ON "patients"("nhs_number");

-- CreateIndex
CREATE INDEX "patients_triage_level_idx" ON "patients"("triage_level");

-- CreateIndex
CREATE UNIQUE INDEX "doctor_patient_assignments_doctor_id_patient_id_key" ON "doctor_patient_assignments"("doctor_id", "patient_id");

-- CreateIndex
CREATE INDEX "wearable_readings_patient_id_reading_date_idx" ON "wearable_readings"("patient_id", "reading_date");

-- CreateIndex
CREATE UNIQUE INDEX "wearable_readings_patient_id_device_id_reading_date_key" ON "wearable_readings"("patient_id", "device_id", "reading_date");

-- CreateIndex
CREATE INDEX "alerts_patient_id_idx" ON "alerts"("patient_id");

-- CreateIndex
CREATE INDEX "alerts_resolved_idx" ON "alerts"("resolved");

-- CreateIndex
CREATE INDEX "alerts_severity_idx" ON "alerts"("severity");

-- CreateIndex
CREATE INDEX "check_ins_patient_id_idx" ON "check_ins"("patient_id");

-- CreateIndex
CREATE INDEX "check_ins_timestamp_idx" ON "check_ins"("timestamp");

-- CreateIndex
CREATE INDEX "chat_messages_patient_id_idx" ON "chat_messages"("patient_id");

-- CreateIndex
CREATE INDEX "chat_messages_whatsapp_message_id_idx" ON "chat_messages"("whatsapp_message_id");

-- CreateIndex
CREATE INDEX "notifications_user_id_idx" ON "notifications"("user_id");

-- CreateIndex
CREATE INDEX "notifications_status_idx" ON "notifications"("status");

-- CreateIndex
CREATE INDEX "appointments_patient_id_idx" ON "appointments"("patient_id");

-- CreateIndex
CREATE INDEX "appointments_doctor_id_idx" ON "appointments"("doctor_id");

-- CreateIndex
CREATE INDEX "appointments_scheduled_at_idx" ON "appointments"("scheduled_at");

-- CreateIndex
CREATE INDEX "audit_logs_user_id_idx" ON "audit_logs"("user_id");

-- CreateIndex
CREATE INDEX "audit_logs_action_idx" ON "audit_logs"("action");

-- CreateIndex
CREATE INDEX "audit_logs_entity_type_entity_id_idx" ON "audit_logs"("entity_type", "entity_id");

-- CreateIndex
CREATE INDEX "audit_logs_created_at_idx" ON "audit_logs"("created_at");

-- CreateIndex
CREATE INDEX "user_sessions_user_id_idx" ON "user_sessions"("user_id");

-- CreateIndex
CREATE INDEX "user_sessions_token_hash_idx" ON "user_sessions"("token_hash");

-- CreateIndex
CREATE INDEX "password_reset_tokens_token_hash_idx" ON "password_reset_tokens"("token_hash");

-- CreateIndex
CREATE UNIQUE INDEX "patient_daily_stats_patient_id_stat_date_key" ON "patient_daily_stats"("patient_id", "stat_date");

-- CreateIndex
CREATE UNIQUE INDEX "admin_integration_keys_provider_key_name_key" ON "admin_integration_keys"("provider", "key_name");

-- CreateIndex
CREATE UNIQUE INDEX "admin_integration_key_versions_provider_key_name_version_key" ON "admin_integration_key_versions"("provider", "key_name", "version");

-- CreateIndex
CREATE UNIQUE INDEX "system_daily_stats_stat_date_key" ON "system_daily_stats"("stat_date");

-- CreateIndex
CREATE UNIQUE INDEX "pairing_tokens_token_key" ON "pairing_tokens"("token");

-- CreateIndex
CREATE INDEX "pairing_tokens_token_idx" ON "pairing_tokens"("token");

-- CreateIndex
CREATE INDEX "pairing_tokens_short_code_idx" ON "pairing_tokens"("short_code");

-- CreateIndex
CREATE INDEX "pairing_tokens_patient_id_idx" ON "pairing_tokens"("patient_id");

-- CreateIndex
CREATE INDEX "cardiac_metrics_patient_id_recorded_at_idx" ON "cardiac_metrics"("patient_id", "recorded_at");

-- AddForeignKey
ALTER TABLE "organizations" ADD CONSTRAINT "organizations_parent_org_id_fkey" FOREIGN KEY ("parent_org_id") REFERENCES "organizations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "admins" ADD CONSTRAINT "admins_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "doctors" ADD CONSTRAINT "doctors_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "patients" ADD CONSTRAINT "patients_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "patients" ADD CONSTRAINT "patients_triage_updated_by_fkey" FOREIGN KEY ("triage_updated_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "patient_medical_history" ADD CONSTRAINT "patient_medical_history_patient_id_fkey" FOREIGN KEY ("patient_id") REFERENCES "patients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "doctor_patient_assignments" ADD CONSTRAINT "doctor_patient_assignments_doctor_id_fkey" FOREIGN KEY ("doctor_id") REFERENCES "doctors"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "doctor_patient_assignments" ADD CONSTRAINT "doctor_patient_assignments_patient_id_fkey" FOREIGN KEY ("patient_id") REFERENCES "patients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wearable_devices" ADD CONSTRAINT "wearable_devices_patient_id_fkey" FOREIGN KEY ("patient_id") REFERENCES "patients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wearable_readings" ADD CONSTRAINT "wearable_readings_patient_id_fkey" FOREIGN KEY ("patient_id") REFERENCES "patients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wearable_readings" ADD CONSTRAINT "wearable_readings_device_id_fkey" FOREIGN KEY ("device_id") REFERENCES "wearable_devices"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "alerts" ADD CONSTRAINT "alerts_patient_id_fkey" FOREIGN KEY ("patient_id") REFERENCES "patients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "alerts" ADD CONSTRAINT "alerts_resolved_by_fkey" FOREIGN KEY ("resolved_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "alerts" ADD CONSTRAINT "alerts_assigned_to_fkey" FOREIGN KEY ("assigned_to") REFERENCES "doctors"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "alerts" ADD CONSTRAINT "alerts_acknowledged_by_fkey" FOREIGN KEY ("acknowledged_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "alerts" ADD CONSTRAINT "alerts_parent_alert_id_fkey" FOREIGN KEY ("parent_alert_id") REFERENCES "alerts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "alert_actions" ADD CONSTRAINT "alert_actions_alert_id_fkey" FOREIGN KEY ("alert_id") REFERENCES "alerts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "alert_actions" ADD CONSTRAINT "alert_actions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "check_ins" ADD CONSTRAINT "check_ins_patient_id_fkey" FOREIGN KEY ("patient_id") REFERENCES "patients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chat_messages" ADD CONSTRAINT "chat_messages_patient_id_fkey" FOREIGN KEY ("patient_id") REFERENCES "patients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chat_messages" ADD CONSTRAINT "chat_messages_sender_id_fkey" FOREIGN KEY ("sender_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_patient_id_fkey" FOREIGN KEY ("patient_id") REFERENCES "patients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_assigned_doctor_id_fkey" FOREIGN KEY ("assigned_doctor_id") REFERENCES "doctors"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_patient_id_fkey" FOREIGN KEY ("patient_id") REFERENCES "patients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_doctor_id_fkey" FOREIGN KEY ("doctor_id") REFERENCES "doctors"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_cancelled_by_fkey" FOREIGN KEY ("cancelled_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_sessions" ADD CONSTRAINT "user_sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "password_reset_tokens" ADD CONSTRAINT "password_reset_tokens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "patient_daily_stats" ADD CONSTRAINT "patient_daily_stats_patient_id_fkey" FOREIGN KEY ("patient_id") REFERENCES "patients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "admin_integration_key_versions" ADD CONSTRAINT "admin_integration_key_versions_provider_key_name_fkey" FOREIGN KEY ("provider", "key_name") REFERENCES "admin_integration_keys"("provider", "key_name") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pairing_tokens" ADD CONSTRAINT "pairing_tokens_patient_id_fkey" FOREIGN KEY ("patient_id") REFERENCES "patients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cardiac_metrics" ADD CONSTRAINT "cardiac_metrics_patient_id_fkey" FOREIGN KEY ("patient_id") REFERENCES "patients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cardiac_metrics" ADD CONSTRAINT "cardiac_metrics_recorded_by_fkey" FOREIGN KEY ("recorded_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

