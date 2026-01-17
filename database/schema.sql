-- CardioWatch Database Schema
-- PostgreSQL 15+
-- Healthcare monitoring system for post-discharge cardiac patients

-- ============================================================================
-- EXTENSIONS
-- ============================================================================
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================================
-- ENUMS
-- ============================================================================

-- User roles
CREATE TYPE user_role AS ENUM ('patient', 'doctor', 'nurse', 'admin', 'super_admin');

-- User status
CREATE TYPE user_status AS ENUM ('active', 'inactive', 'suspended', 'pending_verification');

-- Triage levels
CREATE TYPE triage_level AS ENUM ('red', 'amber', 'green');

-- Alert types
CREATE TYPE alert_type AS ENUM (
    'vital_signs',
    'missed_checkin',
    'symptom_reported',
    'medication_missed',
    'wearable_disconnected',
    'critical_trend',
    'manual'
);

-- Alert severity
CREATE TYPE alert_severity AS ENUM ('low', 'medium', 'high', 'critical');

-- Communication channels
CREATE TYPE comm_channel AS ENUM ('whatsapp', 'sms', 'email', 'push', 'in_app');

-- Wearable device types
CREATE TYPE wearable_type AS ENUM ('apple_watch', 'fitbit', 'garmin', 'samsung', 'other');

-- Gender
CREATE TYPE gender_type AS ENUM ('male', 'female', 'other', 'prefer_not_to_say');

-- Appointment status
CREATE TYPE appointment_status AS ENUM ('scheduled', 'confirmed', 'completed', 'cancelled', 'no_show');

-- ============================================================================
-- BASE TABLES
-- ============================================================================

-- Organizations (NHS Trusts, Hospitals, GP Practices)
CREATE TABLE organizations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    type VARCHAR(50) NOT NULL, -- 'nhs_trust', 'hospital', 'gp_practice', 'clinic'
    address TEXT,
    phone VARCHAR(20),
    email VARCHAR(255),
    ods_code VARCHAR(10), -- NHS Organisation Data Service code
    parent_org_id UUID REFERENCES organizations(id),
    settings JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_organizations_settings ON organizations USING gin(settings);

-- Base users table (shared by all user types)
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role user_role NOT NULL,
    status user_status DEFAULT 'pending_verification',
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    phone VARCHAR(20),
    avatar_url VARCHAR(500),
    organization_id UUID REFERENCES organizations(id),
    email_verified BOOLEAN DEFAULT FALSE,
    phone_verified BOOLEAN DEFAULT FALSE,
    mfa_enabled BOOLEAN DEFAULT FALSE,
    mfa_secret VARCHAR(100),
    last_login_at TIMESTAMPTZ,
    failed_login_attempts INTEGER DEFAULT 0,
    locked_until TIMESTAMPTZ,
    preferences JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_role ON users(role);
CREATE INDEX idx_users_organization ON users(organization_id);
CREATE INDEX idx_users_status ON users(status);

-- ============================================================================
-- ADMIN TABLES
-- ============================================================================

CREATE TABLE admins (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    admin_level VARCHAR(20) DEFAULT 'standard', -- 'standard', 'senior', 'super'
    department VARCHAR(100),
    permissions JSONB DEFAULT '[]', -- Array of permission strings
    can_manage_doctors BOOLEAN DEFAULT FALSE,
    can_manage_patients BOOLEAN DEFAULT FALSE,
    can_manage_admins BOOLEAN DEFAULT FALSE,
    can_view_analytics BOOLEAN DEFAULT TRUE,
    can_manage_settings BOOLEAN DEFAULT FALSE,
    can_manage_billing BOOLEAN DEFAULT FALSE,
    audit_log_access BOOLEAN DEFAULT TRUE,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_admins_user_id ON admins(user_id);

-- ============================================================================
-- DOCTOR/CLINICIAN TABLES
-- ============================================================================

CREATE TABLE doctors (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,

    -- Professional details
    gmc_number VARCHAR(20) UNIQUE, -- General Medical Council number (UK)
    nmc_number VARCHAR(20), -- Nursing and Midwifery Council (for nurses)
    specialty VARCHAR(100), -- 'cardiology', 'general_practice', 'nursing', etc.
    title VARCHAR(20), -- 'Dr', 'Mr', 'Mrs', 'Prof', etc.
    qualifications TEXT[], -- Array of qualifications

    -- Work details
    department VARCHAR(100),
    job_title VARCHAR(100),
    consultation_fee DECIMAL(10, 2),

    -- Availability
    working_hours JSONB DEFAULT '{}', -- {"monday": {"start": "09:00", "end": "17:00"}, ...}
    max_patients INTEGER DEFAULT 50,
    accepting_new_patients BOOLEAN DEFAULT TRUE,

    -- Contact preferences
    preferred_contact_method comm_channel DEFAULT 'email',
    notification_settings JSONB DEFAULT '{}',

    -- Stats
    total_patients INTEGER DEFAULT 0,
    average_rating DECIMAL(3, 2),

    bio TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_doctors_user_id ON doctors(user_id);
CREATE INDEX idx_doctors_gmc ON doctors(gmc_number);
CREATE INDEX idx_doctors_specialty ON doctors(specialty);
CREATE INDEX idx_doctors_working_hours ON doctors USING gin(working_hours);
CREATE INDEX idx_doctors_notifications ON doctors USING gin(notification_settings);

-- Doctor-Patient assignments (many-to-many with metadata)
CREATE TABLE doctor_patient_assignments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    doctor_id UUID NOT NULL REFERENCES doctors(id) ON DELETE CASCADE,
    patient_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    is_primary BOOLEAN DEFAULT FALSE,
    assigned_at TIMESTAMPTZ DEFAULT NOW(),
    assigned_by UUID REFERENCES users(id),
    status VARCHAR(20) DEFAULT 'active', -- 'active', 'transferred', 'discharged'
    notes TEXT,
    UNIQUE(doctor_id, patient_id)
);

CREATE INDEX idx_assignments_doctor ON doctor_patient_assignments(doctor_id);
CREATE INDEX idx_assignments_patient ON doctor_patient_assignments(patient_id);
CREATE INDEX idx_assignments_status ON doctor_patient_assignments(status) WHERE status = 'active';

-- PERFORMANCE NOTE: When fetching patients with their doctors, use JOINs to avoid N+1 queries:
-- Example: SELECT p.*, d.* FROM patients p
--          LEFT JOIN doctor_patient_assignments dpa ON dpa.patient_id = p.id AND dpa.status = 'active'
--          LEFT JOIN doctors d ON d.id = dpa.doctor_id;

-- ============================================================================
-- PATIENT TABLES
-- ============================================================================

CREATE TABLE patients (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,

    -- NHS Details
    nhs_number VARCHAR(10) UNIQUE, -- 10-digit NHS number
    hospital_number VARCHAR(50),

    -- Demographics
    date_of_birth DATE NOT NULL,
    gender gender_type,
    address_line1 VARCHAR(255),
    address_line2 VARCHAR(255),
    city VARCHAR(100),
    postcode VARCHAR(10),
    country VARCHAR(50) DEFAULT 'United Kingdom',

    -- Emergency contact
    emergency_contact_name VARCHAR(200),
    emergency_contact_phone VARCHAR(20),
    emergency_contact_relationship VARCHAR(50),

    -- Medical details
    blood_type VARCHAR(5),
    allergies TEXT[],
    chronic_conditions TEXT[],
    current_medications JSONB DEFAULT '[]',
    primary_diagnosis VARCHAR(255),
    secondary_diagnoses TEXT[],

    -- Cardiac specific
    ejection_fraction DECIMAL(5, 2), -- Heart's pumping efficiency %
    nyha_class INTEGER CHECK (nyha_class BETWEEN 1 AND 4), -- Heart failure classification
    cardiac_devices TEXT[], -- 'pacemaker', 'icd', 'crt', etc.

    -- Care details
    admission_date DATE,
    discharge_date DATE,
    discharge_summary TEXT,
    care_plan TEXT,

    -- Triage and monitoring
    triage_level triage_level DEFAULT 'green',
    triage_updated_at TIMESTAMPTZ,
    triage_updated_by UUID REFERENCES users(id),
    risk_score INTEGER CHECK (risk_score BETWEEN 0 AND 100),
    wellbeing_score INTEGER CHECK (wellbeing_score BETWEEN 0 AND 100),
    last_check_in TIMESTAMPTZ,
    check_in_frequency VARCHAR(20) DEFAULT 'daily', -- 'daily', 'twice_daily', 'weekly'

    -- Communication preferences
    preferred_language VARCHAR(10) DEFAULT 'en',
    preferred_contact_method comm_channel DEFAULT 'whatsapp',
    whatsapp_phone VARCHAR(20),
    whatsapp_opted_in BOOLEAN DEFAULT FALSE,
    sms_opted_in BOOLEAN DEFAULT FALSE,
    email_notifications BOOLEAN DEFAULT TRUE,

    -- Consent
    data_sharing_consent BOOLEAN DEFAULT FALSE,
    research_consent BOOLEAN DEFAULT FALSE,
    consent_date TIMESTAMPTZ,

    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_patients_user_id ON patients(user_id);
CREATE INDEX idx_patients_nhs ON patients(nhs_number);
CREATE INDEX idx_patients_triage ON patients(triage_level);
CREATE INDEX idx_patients_discharge ON patients(discharge_date);
CREATE INDEX idx_patients_medications ON patients USING gin(current_medications);

-- Patient medical history
CREATE TABLE patient_medical_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
    condition VARCHAR(255) NOT NULL,
    diagnosed_date DATE,
    resolved_date DATE,
    severity VARCHAR(20),
    treating_doctor VARCHAR(255),
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_medical_history_patient ON patient_medical_history(patient_id);

-- ============================================================================
-- WEARABLE DEVICE TABLES
-- ============================================================================

CREATE TABLE wearable_devices (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
    device_type wearable_type NOT NULL,
    device_name VARCHAR(100),
    device_model VARCHAR(100),
    serial_number VARCHAR(100),

    -- Connection details
    is_connected BOOLEAN DEFAULT FALSE,
    last_sync_at TIMESTAMPTZ,
    connection_status VARCHAR(20) DEFAULT 'disconnected',
    battery_level INTEGER,
    firmware_version VARCHAR(50),

    -- OAuth tokens (encrypted)
    access_token_encrypted TEXT,
    refresh_token_encrypted TEXT,
    token_expires_at TIMESTAMPTZ,

    -- Settings
    sync_frequency_minutes INTEGER DEFAULT 15,
    enabled_metrics TEXT[] DEFAULT ARRAY['heart_rate', 'steps', 'sleep'],

    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_wearables_patient ON wearable_devices(patient_id);
CREATE INDEX idx_wearables_connected ON wearable_devices(is_connected);

-- Wearable data readings
CREATE TABLE wearable_readings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
    device_id UUID REFERENCES wearable_devices(id) ON DELETE SET NULL,
    reading_date DATE NOT NULL,

    -- Heart metrics
    resting_heart_rate INTEGER,
    avg_heart_rate INTEGER,
    max_heart_rate INTEGER,
    min_heart_rate INTEGER,
    hrv_ms INTEGER, -- Heart rate variability in milliseconds

    -- Activity metrics
    steps INTEGER,
    distance_meters DECIMAL(10, 2),
    floors_climbed INTEGER,
    active_minutes INTEGER,
    calories_burned INTEGER,

    -- Sleep metrics
    sleep_hours DECIMAL(4, 2),
    deep_sleep_hours DECIMAL(4, 2),
    light_sleep_hours DECIMAL(4, 2),
    rem_sleep_hours DECIMAL(4, 2),
    sleep_score INTEGER,
    times_awoken INTEGER,

    -- Other metrics
    blood_oxygen_percent DECIMAL(5, 2),
    respiratory_rate DECIMAL(5, 2),
    body_temperature DECIMAL(5, 2),
    weight_kg DECIMAL(5, 2),
    blood_pressure_systolic INTEGER,
    blood_pressure_diastolic INTEGER,

    -- Metadata
    data_quality VARCHAR(20) DEFAULT 'good', -- 'good', 'partial', 'poor'
    raw_data JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_readings_patient ON wearable_readings(patient_id);
CREATE INDEX idx_readings_date ON wearable_readings(reading_date);
CREATE INDEX idx_readings_patient_date ON wearable_readings(patient_id, reading_date DESC);
CREATE INDEX idx_readings_raw_data ON wearable_readings USING gin(raw_data) WHERE raw_data IS NOT NULL;

-- PERFORMANCE NOTE: Always filter wearable readings by date range to avoid large result sets
-- Example: WHERE patient_id = ? AND reading_date >= NOW() - INTERVAL '14 days'

-- ============================================================================
-- ALERTS AND NOTIFICATIONS
-- ============================================================================

CREATE TABLE alerts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,

    -- Alert details
    type alert_type NOT NULL,
    severity alert_severity NOT NULL,
    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,

    -- Trigger details
    trigger_metric VARCHAR(50),
    trigger_value DECIMAL(10, 2),
    threshold_value DECIMAL(10, 2),

    -- Status
    resolved BOOLEAN DEFAULT FALSE,
    resolved_at TIMESTAMPTZ,
    resolved_by UUID REFERENCES users(id),
    resolution_notes TEXT,

    -- Assignment
    assigned_to UUID REFERENCES doctors(id),
    acknowledged BOOLEAN DEFAULT FALSE,
    acknowledged_at TIMESTAMPTZ,
    acknowledged_by UUID REFERENCES users(id),

    -- Escalation
    escalation_level INTEGER DEFAULT 0,
    escalated_at TIMESTAMPTZ,
    parent_alert_id UUID REFERENCES alerts(id),

    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_alerts_patient ON alerts(patient_id);
CREATE INDEX idx_alerts_resolved ON alerts(resolved);
CREATE INDEX idx_alerts_severity ON alerts(severity);
CREATE INDEX idx_alerts_type ON alerts(type);
CREATE INDEX idx_alerts_assigned ON alerts(assigned_to);
CREATE INDEX idx_alerts_created ON alerts(created_at);

-- Alert actions/comments
CREATE TABLE alert_actions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    alert_id UUID NOT NULL REFERENCES alerts(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id),
    action_type VARCHAR(50) NOT NULL, -- 'comment', 'escalate', 'assign', 'resolve', 'acknowledge'
    content TEXT,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_alert_actions_alert ON alert_actions(alert_id);

-- Notification queue
CREATE TABLE notifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    channel comm_channel NOT NULL,

    title VARCHAR(255) NOT NULL,
    body TEXT NOT NULL,
    data JSONB DEFAULT '{}',

    -- Delivery status
    status VARCHAR(20) DEFAULT 'pending', -- 'pending', 'sent', 'delivered', 'failed', 'read'
    sent_at TIMESTAMPTZ,
    delivered_at TIMESTAMPTZ,
    read_at TIMESTAMPTZ,
    error_message TEXT,
    retry_count INTEGER DEFAULT 0,

    -- Scheduling
    scheduled_for TIMESTAMPTZ,
    expires_at TIMESTAMPTZ,

    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_notifications_user ON notifications(user_id);
CREATE INDEX idx_notifications_status ON notifications(status);
CREATE INDEX idx_notifications_scheduled ON notifications(scheduled_for);

-- ============================================================================
-- CHECK-INS AND CHAT
-- ============================================================================

CREATE TABLE check_ins (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,

    -- Check-in details
    channel comm_channel NOT NULL,
    timestamp TIMESTAMPTZ DEFAULT NOW(),

    -- Scores
    wellbeing_score INTEGER CHECK (wellbeing_score BETWEEN 1 AND 10),
    pain_score INTEGER CHECK (pain_score BETWEEN 0 AND 10),
    energy_level INTEGER CHECK (energy_level BETWEEN 1 AND 5),
    sleep_quality INTEGER CHECK (sleep_quality BETWEEN 1 AND 5),
    mood_score INTEGER CHECK (mood_score BETWEEN 1 AND 5),

    -- Symptoms reported
    symptoms JSONB DEFAULT '[]', -- [{name: 'shortness_of_breath', severity: 'moderate'}]
    symptom_notes TEXT,

    -- Medication adherence
    medications_taken BOOLEAN,
    missed_medications JSONB DEFAULT '[]',

    -- Triage outcome
    triage_outcome triage_level,
    requires_callback BOOLEAN DEFAULT FALSE,
    callback_priority VARCHAR(20),

    -- AI analysis
    ai_summary TEXT,
    ai_risk_flags JSONB DEFAULT '[]',

    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_checkins_patient ON check_ins(patient_id);
CREATE INDEX idx_checkins_timestamp ON check_ins(timestamp);
CREATE INDEX idx_checkins_triage ON check_ins(triage_outcome);

-- Chat messages (WhatsApp, SMS, in-app)
CREATE TABLE chat_messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,

    -- Message details
    channel comm_channel NOT NULL,
    direction VARCHAR(10) NOT NULL, -- 'inbound', 'outbound'
    sender_type VARCHAR(20) NOT NULL, -- 'patient', 'doctor', 'system', 'ai'
    sender_id UUID REFERENCES users(id),

    -- Content
    message_type VARCHAR(20) DEFAULT 'text', -- 'text', 'button', 'list', 'template', 'media'
    content TEXT NOT NULL,
    media_url VARCHAR(500),
    media_type VARCHAR(50),

    -- WhatsApp specific
    whatsapp_message_id VARCHAR(100),
    whatsapp_status VARCHAR(20), -- 'sent', 'delivered', 'read', 'failed'

    -- Metadata
    is_automated BOOLEAN DEFAULT FALSE,
    flow_step VARCHAR(50),
    intent_detected VARCHAR(100),
    sentiment VARCHAR(20),

    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_chat_patient ON chat_messages(patient_id);
CREATE INDEX idx_chat_channel ON chat_messages(channel);
CREATE INDEX idx_chat_created ON chat_messages(created_at);
CREATE INDEX idx_chat_whatsapp_id ON chat_messages(whatsapp_message_id);

-- Conversation threads
CREATE TABLE conversations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
    channel comm_channel NOT NULL,

    status VARCHAR(20) DEFAULT 'active', -- 'active', 'waiting', 'resolved', 'escalated'
    started_at TIMESTAMPTZ DEFAULT NOW(),
    last_message_at TIMESTAMPTZ,
    resolved_at TIMESTAMPTZ,

    -- Current flow state
    current_flow VARCHAR(50),
    flow_state JSONB DEFAULT '{}',

    -- Assignment
    assigned_doctor_id UUID REFERENCES doctors(id),

    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_conversations_patient ON conversations(patient_id);
CREATE INDEX idx_conversations_status ON conversations(status);

-- ============================================================================
-- APPOINTMENTS
-- ============================================================================

CREATE TABLE appointments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
    doctor_id UUID NOT NULL REFERENCES doctors(id) ON DELETE CASCADE,

    -- Appointment details
    type VARCHAR(50) NOT NULL, -- 'follow_up', 'consultation', 'emergency', 'review'
    status appointment_status DEFAULT 'scheduled',

    -- Timing
    scheduled_at TIMESTAMPTZ NOT NULL,
    duration_minutes INTEGER DEFAULT 30,
    actual_start_at TIMESTAMPTZ,
    actual_end_at TIMESTAMPTZ,

    -- Location
    location_type VARCHAR(20) DEFAULT 'in_person', -- 'in_person', 'video', 'phone'
    location_details TEXT,
    video_link VARCHAR(500),

    -- Notes
    reason TEXT,
    pre_appointment_notes TEXT,
    clinical_notes TEXT,
    follow_up_actions JSONB DEFAULT '[]',

    -- Reminders
    reminder_sent BOOLEAN DEFAULT FALSE,
    reminder_sent_at TIMESTAMPTZ,

    cancelled_at TIMESTAMPTZ,
    cancelled_by UUID REFERENCES users(id),
    cancellation_reason TEXT,

    created_by UUID REFERENCES users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_appointments_patient ON appointments(patient_id);
CREATE INDEX idx_appointments_doctor ON appointments(doctor_id);
CREATE INDEX idx_appointments_scheduled ON appointments(scheduled_at);
CREATE INDEX idx_appointments_status ON appointments(status);

-- ============================================================================
-- AUDIT AND SECURITY
-- ============================================================================

-- Audit log for all sensitive operations
CREATE TABLE audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id),

    -- Action details
    action VARCHAR(100) NOT NULL,
    entity_type VARCHAR(50) NOT NULL,
    entity_id UUID,

    -- Change tracking
    old_values JSONB,
    new_values JSONB,

    -- Context
    ip_address INET,
    user_agent TEXT,
    session_id VARCHAR(100),

    -- Status
    status VARCHAR(20) DEFAULT 'success', -- 'success', 'failure', 'error'
    error_message TEXT,

    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_audit_user ON audit_logs(user_id);
CREATE INDEX idx_audit_action ON audit_logs(action);
CREATE INDEX idx_audit_entity ON audit_logs(entity_type, entity_id);
CREATE INDEX idx_audit_created ON audit_logs(created_at);

-- Session management
CREATE TABLE user_sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

    token_hash VARCHAR(64) NOT NULL,
    refresh_token_hash VARCHAR(64),

    ip_address INET,
    user_agent TEXT,
    device_info JSONB,

    expires_at TIMESTAMPTZ NOT NULL,
    refresh_expires_at TIMESTAMPTZ,

    is_active BOOLEAN DEFAULT TRUE,
    revoked_at TIMESTAMPTZ,

    created_at TIMESTAMPTZ DEFAULT NOW(),
    last_activity_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_sessions_user ON user_sessions(user_id);
CREATE INDEX idx_sessions_token ON user_sessions(token_hash);
CREATE INDEX idx_sessions_active ON user_sessions(is_active);

-- Password reset tokens
CREATE TABLE password_reset_tokens (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash VARCHAR(64) NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    used_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_reset_tokens_user ON password_reset_tokens(user_id);
CREATE INDEX idx_reset_tokens_token ON password_reset_tokens(token_hash);

-- ============================================================================
-- ANALYTICS AND REPORTING
-- ============================================================================

-- Daily aggregated stats for patients
CREATE TABLE patient_daily_stats (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
    stat_date DATE NOT NULL,

    -- Engagement
    check_ins_completed INTEGER DEFAULT 0,
    messages_sent INTEGER DEFAULT 0,
    messages_received INTEGER DEFAULT 0,

    -- Health metrics (daily averages/totals)
    avg_heart_rate INTEGER,
    avg_hrv INTEGER,
    total_steps INTEGER,
    total_sleep_hours DECIMAL(4, 2),
    wellbeing_score INTEGER,

    -- Alerts
    alerts_generated INTEGER DEFAULT 0,
    alerts_resolved INTEGER DEFAULT 0,

    -- Triage
    triage_level triage_level,
    risk_score INTEGER,

    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(patient_id, stat_date)
);

CREATE INDEX idx_daily_stats_patient ON patient_daily_stats(patient_id);
CREATE INDEX idx_daily_stats_date ON patient_daily_stats(stat_date);

-- System-wide daily stats
CREATE TABLE system_daily_stats (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    stat_date DATE UNIQUE NOT NULL,

    -- User stats
    total_patients INTEGER,
    active_patients INTEGER,
    new_patients INTEGER,
    total_doctors INTEGER,
    active_doctors INTEGER,

    -- Triage distribution
    patients_red INTEGER,
    patients_amber INTEGER,
    patients_green INTEGER,

    -- Engagement
    total_check_ins INTEGER,
    total_messages INTEGER,

    -- Alerts
    alerts_generated INTEGER,
    alerts_resolved INTEGER,
    avg_resolution_time_minutes INTEGER,

    -- Appointments
    appointments_scheduled INTEGER,
    appointments_completed INTEGER,
    appointments_cancelled INTEGER,

    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_system_stats_date ON system_daily_stats(stat_date);

-- ============================================================================
-- FUNCTIONS AND TRIGGERS
-- ============================================================================

-- Update timestamp trigger
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply to all tables with updated_at
CREATE TRIGGER update_users_timestamp BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER update_organizations_timestamp BEFORE UPDATE ON organizations
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER update_admins_timestamp BEFORE UPDATE ON admins
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER update_doctors_timestamp BEFORE UPDATE ON doctors
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER update_patients_timestamp BEFORE UPDATE ON patients
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER update_wearables_timestamp BEFORE UPDATE ON wearable_devices
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER update_alerts_timestamp BEFORE UPDATE ON alerts
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER update_conversations_timestamp BEFORE UPDATE ON conversations
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER update_appointments_timestamp BEFORE UPDATE ON appointments
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Function to update patient triage level
CREATE OR REPLACE FUNCTION update_patient_triage(
    p_patient_id UUID,
    p_new_level triage_level,
    p_updated_by UUID
)
RETURNS void AS $$
BEGIN
    UPDATE patients
    SET
        triage_level = p_new_level,
        triage_updated_at = NOW(),
        triage_updated_by = p_updated_by
    WHERE id = p_patient_id;

    -- Log the change
    INSERT INTO audit_logs (user_id, action, entity_type, entity_id, new_values)
    VALUES (p_updated_by, 'triage_update', 'patient', p_patient_id,
            jsonb_build_object('triage_level', p_new_level));
END;
$$ LANGUAGE plpgsql;

-- Function to get patient summary
CREATE OR REPLACE FUNCTION get_patient_summary(p_patient_id UUID)
RETURNS TABLE (
    patient_id UUID,
    full_name TEXT,
    nhs_number VARCHAR,
    triage_level triage_level,
    unresolved_alerts BIGINT,
    last_check_in TIMESTAMPTZ,
    primary_doctor_name TEXT
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        p.id,
        (u.first_name || ' ' || u.last_name)::TEXT,
        p.nhs_number,
        p.triage_level,
        (SELECT COUNT(*) FROM alerts a WHERE a.patient_id = p.id AND NOT a.resolved),
        p.last_check_in,
        (SELECT (du.first_name || ' ' || du.last_name)::TEXT
         FROM doctor_patient_assignments dpa
         JOIN doctors d ON d.id = dpa.doctor_id
         JOIN users du ON du.id = d.user_id
         WHERE dpa.patient_id = p.user_id AND dpa.is_primary = TRUE
         LIMIT 1)
    FROM patients p
    JOIN users u ON u.id = p.user_id
    WHERE p.id = p_patient_id;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================================================

ALTER TABLE patients ENABLE ROW LEVEL SECURITY;
ALTER TABLE alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE check_ins ENABLE ROW LEVEL SECURITY;
ALTER TABLE wearable_readings ENABLE ROW LEVEL SECURITY;
ALTER TABLE appointments ENABLE ROW LEVEL SECURITY;

-- Example policies (to be customized based on auth implementation)
-- Patients can only see their own data
CREATE POLICY patient_own_data ON patients
    FOR ALL
    USING (user_id = current_setting('app.current_user_id')::UUID);

-- Doctors can see their assigned patients
CREATE POLICY doctor_assigned_patients ON patients
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM doctor_patient_assignments dpa
            JOIN doctors d ON d.id = dpa.doctor_id
            WHERE dpa.patient_id = patients.user_id
            AND d.user_id = current_setting('app.current_user_id')::UUID
        )
    );

-- Admins can see all
CREATE POLICY admin_all_access ON patients
    FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM users u
            WHERE u.id = current_setting('app.current_user_id')::UUID
            AND u.role IN ('admin', 'super_admin')
        )
    );
