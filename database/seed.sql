-- CardioWatch Seed Data
-- Sample data for development and testing

-- ============================================================================
-- ORGANIZATIONS
-- ============================================================================

INSERT INTO organizations (id, name, type, address, phone, email, ods_code) VALUES
    ('org-001', 'St. Thomas'' Hospital', 'hospital', 'Westminster Bridge Road, London SE1 7EH', '+44 20 7188 7188', 'admin@stthomas.nhs.uk', 'RJ1'),
    ('org-002', 'Guy''s Hospital', 'hospital', 'Great Maze Pond, London SE1 9RT', '+44 20 7188 7188', 'admin@guys.nhs.uk', 'RJ2'),
    ('org-003', 'Lambeth GP Practice', 'gp_practice', '123 Lambeth Road, London SE1 7HA', '+44 20 7555 1234', 'reception@lambethgp.nhs.uk', 'F84001');

-- ============================================================================
-- ADMIN USERS
-- ============================================================================

-- Password: admin123 (hashed with bcrypt)
INSERT INTO users (id, email, password_hash, role, status, first_name, last_name, phone, organization_id, email_verified) VALUES
    ('user-admin-001', 'admin@cardiowatch.nhs.uk', '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/X4.xfXxl0KFYzXPfW', 'super_admin', 'active', 'Sarah', 'Mitchell', '+44 7700 900001', 'org-001', TRUE),
    ('user-admin-002', 'ops@cardiowatch.nhs.uk', '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/X4.xfXxl0KFYzXPfW', 'admin', 'active', 'James', 'Wilson', '+44 7700 900002', 'org-001', TRUE);

INSERT INTO admins (id, user_id, admin_level, department, can_manage_doctors, can_manage_patients, can_manage_admins, can_view_analytics, can_manage_settings) VALUES
    ('admin-001', 'user-admin-001', 'super', 'IT Operations', TRUE, TRUE, TRUE, TRUE, TRUE),
    ('admin-002', 'user-admin-002', 'standard', 'Clinical Operations', TRUE, TRUE, FALSE, TRUE, FALSE);

-- ============================================================================
-- DOCTOR USERS
-- ============================================================================

-- Password: doctor123 (hashed with bcrypt)
INSERT INTO users (id, email, password_hash, role, status, first_name, last_name, phone, organization_id, email_verified) VALUES
    ('user-doc-001', 'dr.patel@nhs.uk', '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/X4.xfXxl0KFYzXPfW', 'doctor', 'active', 'Raj', 'Patel', '+44 7700 900101', 'org-001', TRUE),
    ('user-doc-002', 'dr.chen@nhs.uk', '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/X4.xfXxl0KFYzXPfW', 'doctor', 'active', 'Emily', 'Chen', '+44 7700 900102', 'org-001', TRUE),
    ('user-doc-003', 'dr.okonkwo@nhs.uk', '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/X4.xfXxl0KFYzXPfW', 'doctor', 'active', 'Chidi', 'Okonkwo', '+44 7700 900103', 'org-002', TRUE),
    ('user-nurse-001', 'nurse.smith@nhs.uk', '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/X4.xfXxl0KFYzXPfW', 'nurse', 'active', 'Lisa', 'Smith', '+44 7700 900104', 'org-001', TRUE);

INSERT INTO doctors (id, user_id, gmc_number, specialty, title, qualifications, department, job_title, working_hours, max_patients, accepting_new_patients, bio) VALUES
    ('doc-001', 'user-doc-001', 'GMC7654321', 'cardiology', 'Dr', ARRAY['MBBS', 'MRCP', 'MD'], 'Cardiology', 'Consultant Cardiologist',
     '{"monday": {"start": "09:00", "end": "17:00"}, "tuesday": {"start": "09:00", "end": "17:00"}, "wednesday": {"start": "09:00", "end": "13:00"}, "thursday": {"start": "09:00", "end": "17:00"}, "friday": {"start": "09:00", "end": "15:00"}}',
     50, TRUE, 'Specializing in heart failure and cardiac rehabilitation with 15 years experience.'),
    ('doc-002', 'user-doc-002', 'GMC8765432', 'cardiology', 'Dr', ARRAY['MBBS', 'MRCP'], 'Cardiology', 'Registrar',
     '{"monday": {"start": "08:00", "end": "18:00"}, "tuesday": {"start": "08:00", "end": "18:00"}, "wednesday": {"start": "08:00", "end": "18:00"}, "thursday": {"start": "08:00", "end": "18:00"}, "friday": {"start": "08:00", "end": "16:00"}}',
     40, TRUE, 'Focused on interventional cardiology and patient monitoring.'),
    ('doc-003', 'user-doc-003', 'GMC9876543', 'general_practice', 'Dr', ARRAY['MBBS', 'MRCGP'], 'General Practice', 'GP Partner',
     '{"monday": {"start": "08:30", "end": "18:30"}, "tuesday": {"start": "08:30", "end": "18:30"}, "wednesday": {"start": "08:30", "end": "12:30"}, "thursday": {"start": "08:30", "end": "18:30"}, "friday": {"start": "08:30", "end": "17:00"}}',
     60, TRUE, 'GP with special interest in cardiovascular disease prevention.');

INSERT INTO doctors (id, user_id, nmc_number, specialty, title, qualifications, department, job_title, working_hours, max_patients, accepting_new_patients, bio) VALUES
    ('nurse-001', 'user-nurse-001', 'NMC12345678', 'cardiac_nursing', 'Sister', ARRAY['RN', 'BSc Nursing'], 'Cardiology', 'Heart Failure Specialist Nurse',
     '{"monday": {"start": "07:00", "end": "19:00"}, "tuesday": {"start": "07:00", "end": "19:00"}, "wednesday": {"start": "07:00", "end": "19:00"}}',
     80, TRUE, 'Dedicated cardiac nurse with expertise in remote patient monitoring.');

-- ============================================================================
-- PATIENT USERS
-- ============================================================================

-- Password: patient123 (hashed with bcrypt)
INSERT INTO users (id, email, password_hash, role, status, first_name, last_name, phone, organization_id, email_verified) VALUES
    ('user-pat-001', 'margaret.thompson@email.com', '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/X4.xfXxl0KFYzXPfW', 'patient', 'active', 'Margaret', 'Thompson', '+44 7700 901001', 'org-001', TRUE),
    ('user-pat-002', 'robert.jenkins@email.com', '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/X4.xfXxl0KFYzXPfW', 'patient', 'active', 'Robert', 'Jenkins', '+44 7700 901002', 'org-001', TRUE),
    ('user-pat-003', 'sarah.o''brien@email.com', '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/X4.xfXxl0KFYzXPfW', 'patient', 'active', 'Sarah', 'O''Brien', '+44 7700 901003', 'org-001', TRUE),
    ('user-pat-004', 'james.morrison@email.com', '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/X4.xfXxl0KFYzXPfW', 'patient', 'active', 'James', 'Morrison', '+44 7700 901004', 'org-002', TRUE),
    ('user-pat-005', 'patricia.williams@email.com', '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/X4.xfXxl0KFYzXPfW', 'patient', 'active', 'Patricia', 'Williams', '+44 7700 901005', 'org-001', TRUE);

INSERT INTO patients (id, user_id, nhs_number, date_of_birth, gender, address_line1, city, postcode, emergency_contact_name, emergency_contact_phone, emergency_contact_relationship,
                      blood_type, allergies, chronic_conditions, primary_diagnosis, ejection_fraction, nyha_class, cardiac_devices,
                      admission_date, discharge_date, triage_level, wellbeing_score, last_check_in, whatsapp_phone, whatsapp_opted_in,
                      current_medications) VALUES
    ('pat-001', 'user-pat-001', '9876543210', '1952-03-15', 'female', '45 Victoria Gardens', 'London', 'SE1 7RH', 'John Thompson', '+44 7700 902001', 'Husband',
     'A+', ARRAY['Penicillin'], ARRAY['Hypertension', 'Type 2 Diabetes'], 'Heart Failure (HFrEF)', 35.0, 2, ARRAY['ICD'],
     '2024-01-10', '2024-01-18', 'amber', 6, NOW() - INTERVAL '2 hours', '+44 7700 901001', TRUE,
     '[{"name": "Bisoprolol", "dosage": "5mg", "frequency": "once daily"}, {"name": "Ramipril", "dosage": "10mg", "frequency": "once daily"}, {"name": "Furosemide", "dosage": "40mg", "frequency": "twice daily"}]'),

    ('pat-002', 'user-pat-002', '1234567890', '1958-07-22', 'male', '12 Churchill Road', 'London', 'SE11 5NG', 'Mary Jenkins', '+44 7700 902002', 'Wife',
     'O+', ARRAY[]::TEXT[], ARRAY['COPD'], 'Acute Myocardial Infarction', 45.0, 2, ARRAY[]::TEXT[],
     '2024-01-12', '2024-01-20', 'red', 4, NOW() - INTERVAL '1 day', '+44 7700 901002', TRUE,
     '[{"name": "Aspirin", "dosage": "75mg", "frequency": "once daily"}, {"name": "Atorvastatin", "dosage": "80mg", "frequency": "once daily"}, {"name": "Clopidogrel", "dosage": "75mg", "frequency": "once daily"}]'),

    ('pat-003', 'user-pat-003', '5678901234', '1965-11-08', 'female', '88 Kennington Lane', 'London', 'SE11 4LT', 'Michael O''Brien', '+44 7700 902003', 'Son',
     'B+', ARRAY['Sulfonamides'], ARRAY['Atrial Fibrillation'], 'Atrial Fibrillation with RVR', 55.0, 1, ARRAY['Pacemaker'],
     '2024-01-14', '2024-01-19', 'green', 8, NOW() - INTERVAL '30 minutes', '+44 7700 901003', TRUE,
     '[{"name": "Apixaban", "dosage": "5mg", "frequency": "twice daily"}, {"name": "Bisoprolol", "dosage": "2.5mg", "frequency": "once daily"}]'),

    ('pat-004', 'user-pat-004', '2345678901', '1948-05-30', 'male', '23 Borough High Street', 'London', 'SE1 1HR', 'Susan Morrison', '+44 7700 902004', 'Daughter',
     'AB-', ARRAY['NSAIDs', 'Codeine'], ARRAY['Chronic Kidney Disease Stage 3', 'Heart Failure'], 'Cardiomyopathy', 25.0, 3, ARRAY['CRT-D'],
     '2024-01-08', '2024-01-17', 'red', 3, NOW() - INTERVAL '36 hours', '+44 7700 901004', TRUE,
     '[{"name": "Sacubitril/Valsartan", "dosage": "49/51mg", "frequency": "twice daily"}, {"name": "Spironolactone", "dosage": "25mg", "frequency": "once daily"}, {"name": "Bumetanide", "dosage": "1mg", "frequency": "twice daily"}]'),

    ('pat-005', 'user-pat-005', '3456789012', '1970-09-12', 'female', '156 Walworth Road', 'London', 'SE17 1JL', 'David Williams', '+44 7700 902005', 'Partner',
     'O-', ARRAY[]::TEXT[], ARRAY[]::TEXT[], 'STEMI (anterior)', 50.0, 1, ARRAY[]::TEXT[],
     '2024-01-16', '2024-01-21', 'green', 9, NOW() - INTERVAL '4 hours', '+44 7700 901005', TRUE,
     '[{"name": "Aspirin", "dosage": "75mg", "frequency": "once daily"}, {"name": "Ticagrelor", "dosage": "90mg", "frequency": "twice daily"}, {"name": "Atorvastatin", "dosage": "40mg", "frequency": "once daily"}]');

-- ============================================================================
-- DOCTOR-PATIENT ASSIGNMENTS
-- ============================================================================

INSERT INTO doctor_patient_assignments (doctor_id, patient_id, is_primary, status) VALUES
    ('doc-001', 'user-pat-001', TRUE, 'active'),
    ('doc-001', 'user-pat-002', TRUE, 'active'),
    ('doc-002', 'user-pat-003', TRUE, 'active'),
    ('doc-001', 'user-pat-004', TRUE, 'active'),
    ('doc-002', 'user-pat-005', TRUE, 'active'),
    ('nurse-001', 'user-pat-001', FALSE, 'active'),
    ('nurse-001', 'user-pat-002', FALSE, 'active'),
    ('nurse-001', 'user-pat-004', FALSE, 'active');

-- ============================================================================
-- WEARABLE DEVICES
-- ============================================================================

INSERT INTO wearable_devices (id, patient_id, device_type, device_name, device_model, is_connected, last_sync_at, connection_status, battery_level, enabled_metrics) VALUES
    ('device-001', 'pat-001', 'apple_watch', 'Margaret''s Apple Watch', 'Apple Watch Series 9', TRUE, NOW() - INTERVAL '15 minutes', 'connected', 78, ARRAY['heart_rate', 'hrv', 'steps', 'sleep', 'blood_oxygen']),
    ('device-002', 'pat-002', 'fitbit', 'Robert''s Fitbit', 'Fitbit Sense 2', FALSE, NOW() - INTERVAL '2 days', 'disconnected', 12, ARRAY['heart_rate', 'steps', 'sleep']),
    ('device-003', 'pat-003', 'apple_watch', 'Sarah''s Watch', 'Apple Watch SE', TRUE, NOW() - INTERVAL '30 minutes', 'connected', 92, ARRAY['heart_rate', 'hrv', 'steps', 'sleep']),
    ('device-004', 'pat-005', 'garmin', 'Patricia''s Garmin', 'Garmin Venu 3', TRUE, NOW() - INTERVAL '1 hour', 'connected', 65, ARRAY['heart_rate', 'steps', 'sleep', 'stress']);

-- ============================================================================
-- WEARABLE READINGS (Last 7 days for each patient)
-- ============================================================================

-- Patient 1 (Margaret) - Amber triage, concerning trends
INSERT INTO wearable_readings (patient_id, device_id, reading_date, resting_heart_rate, avg_heart_rate, hrv_ms, steps, sleep_hours, deep_sleep_hours, blood_oxygen_percent) VALUES
    ('pat-001', 'device-001', CURRENT_DATE - 6, 72, 78, 32, 4200, 6.5, 1.2, 96),
    ('pat-001', 'device-001', CURRENT_DATE - 5, 74, 80, 30, 3800, 6.0, 1.0, 95),
    ('pat-001', 'device-001', CURRENT_DATE - 4, 76, 82, 28, 3500, 5.5, 0.9, 95),
    ('pat-001', 'device-001', CURRENT_DATE - 3, 78, 85, 26, 3200, 5.8, 1.0, 94),
    ('pat-001', 'device-001', CURRENT_DATE - 2, 80, 88, 24, 2900, 5.2, 0.8, 94),
    ('pat-001', 'device-001', CURRENT_DATE - 1, 82, 90, 22, 2600, 5.0, 0.7, 93),
    ('pat-001', 'device-001', CURRENT_DATE, 84, 92, 20, 2400, 4.8, 0.6, 92);

-- Patient 3 (Sarah) - Green triage, stable
INSERT INTO wearable_readings (patient_id, device_id, reading_date, resting_heart_rate, avg_heart_rate, hrv_ms, steps, sleep_hours, deep_sleep_hours, blood_oxygen_percent) VALUES
    ('pat-003', 'device-003', CURRENT_DATE - 6, 68, 72, 45, 7500, 7.5, 1.8, 98),
    ('pat-003', 'device-003', CURRENT_DATE - 5, 67, 71, 46, 8200, 7.8, 1.9, 98),
    ('pat-003', 'device-003', CURRENT_DATE - 4, 68, 73, 44, 7800, 7.2, 1.7, 97),
    ('pat-003', 'device-003', CURRENT_DATE - 3, 66, 70, 48, 8500, 8.0, 2.0, 98),
    ('pat-003', 'device-003', CURRENT_DATE - 2, 67, 71, 47, 7900, 7.6, 1.8, 98),
    ('pat-003', 'device-003', CURRENT_DATE - 1, 68, 72, 45, 8100, 7.4, 1.8, 97),
    ('pat-003', 'device-003', CURRENT_DATE, 67, 71, 46, 8300, 7.7, 1.9, 98);

-- Patient 5 (Patricia) - Green triage, recovering well
INSERT INTO wearable_readings (patient_id, device_id, reading_date, resting_heart_rate, avg_heart_rate, hrv_ms, steps, sleep_hours, deep_sleep_hours, blood_oxygen_percent) VALUES
    ('pat-005', 'device-004', CURRENT_DATE - 6, 75, 80, 35, 5000, 6.8, 1.3, 97),
    ('pat-005', 'device-004', CURRENT_DATE - 5, 73, 78, 37, 5500, 7.0, 1.4, 97),
    ('pat-005', 'device-004', CURRENT_DATE - 4, 72, 77, 38, 6000, 7.2, 1.5, 98),
    ('pat-005', 'device-004', CURRENT_DATE - 3, 70, 75, 40, 6500, 7.5, 1.6, 98),
    ('pat-005', 'device-004', CURRENT_DATE - 2, 69, 74, 41, 7000, 7.6, 1.7, 98),
    ('pat-005', 'device-004', CURRENT_DATE - 1, 68, 73, 42, 7200, 7.8, 1.8, 98),
    ('pat-005', 'device-004', CURRENT_DATE, 67, 72, 44, 7500, 8.0, 1.9, 99);

-- ============================================================================
-- ALERTS
-- ============================================================================

INSERT INTO alerts (id, patient_id, type, severity, title, message, trigger_metric, trigger_value, threshold_value, resolved, assigned_to, acknowledged, created_at) VALUES
    ('alert-001', 'pat-001', 'vital_signs', 'medium', 'Elevated Resting Heart Rate', 'Resting heart rate has increased from 72 to 84 bpm over the past week', 'resting_heart_rate', 84, 80, FALSE, 'doc-001', TRUE, NOW() - INTERVAL '2 hours'),
    ('alert-002', 'pat-001', 'critical_trend', 'high', 'Declining HRV Trend', 'Heart rate variability has decreased by 37% over 7 days', 'hrv', 20, 25, FALSE, 'doc-001', FALSE, NOW() - INTERVAL '1 hour'),
    ('alert-003', 'pat-002', 'missed_checkin', 'high', 'Missed Daily Check-in', 'Patient has not completed check-in for 24+ hours', NULL, NULL, NULL, FALSE, 'nurse-001', TRUE, NOW() - INTERVAL '12 hours'),
    ('alert-004', 'pat-002', 'wearable_disconnected', 'medium', 'Wearable Device Offline', 'Fitbit has not synced for 48 hours', NULL, NULL, NULL, FALSE, 'nurse-001', FALSE, NOW() - INTERVAL '2 days'),
    ('alert-005', 'pat-004', 'symptom_reported', 'critical', 'Severe Symptoms Reported', 'Patient reported severe shortness of breath and chest discomfort', NULL, NULL, NULL, FALSE, 'doc-001', TRUE, NOW() - INTERVAL '4 hours'),
    ('alert-006', 'pat-004', 'vital_signs', 'high', 'Weight Increase Alert', 'Weight increased by 2.3kg in 3 days (possible fluid retention)', 'weight', 78.5, 76.2, FALSE, 'doc-001', FALSE, NOW() - INTERVAL '1 day');

-- ============================================================================
-- CHECK-INS
-- ============================================================================

INSERT INTO check_ins (id, patient_id, channel, timestamp, wellbeing_score, pain_score, energy_level, symptoms, medications_taken, triage_outcome, requires_callback) VALUES
    ('checkin-001', 'pat-001', 'whatsapp', NOW() - INTERVAL '2 hours', 6, 2, 3, '[{"name": "shortness_of_breath", "severity": "mild"}, {"name": "fatigue", "severity": "moderate"}]', TRUE, 'amber', FALSE),
    ('checkin-002', 'pat-001', 'whatsapp', NOW() - INTERVAL '1 day 2 hours', 7, 1, 3, '[{"name": "fatigue", "severity": "mild"}]', TRUE, 'green', FALSE),
    ('checkin-003', 'pat-003', 'whatsapp', NOW() - INTERVAL '30 minutes', 8, 0, 4, '[]', TRUE, 'green', FALSE),
    ('checkin-004', 'pat-003', 'whatsapp', NOW() - INTERVAL '1 day', 8, 0, 4, '[]', TRUE, 'green', FALSE),
    ('checkin-005', 'pat-005', 'whatsapp', NOW() - INTERVAL '4 hours', 9, 0, 4, '[]', TRUE, 'green', FALSE);

-- ============================================================================
-- CHAT MESSAGES
-- ============================================================================

INSERT INTO chat_messages (patient_id, channel, direction, sender_type, message_type, content, is_automated, flow_step, created_at) VALUES
    ('pat-001', 'whatsapp', 'outbound', 'system', 'text', 'Good morning Margaret! Time for your daily check-in. How are you feeling today? Reply with a number 1-10 (1=very unwell, 10=excellent)', TRUE, 'wellbeing_score', NOW() - INTERVAL '2 hours 5 minutes'),
    ('pat-001', 'whatsapp', 'inbound', 'patient', 'text', '6', FALSE, 'wellbeing_score', NOW() - INTERVAL '2 hours 3 minutes'),
    ('pat-001', 'whatsapp', 'outbound', 'system', 'text', 'Thank you. Are you experiencing any of these symptoms? Reply with the numbers that apply: 1) Shortness of breath 2) Chest pain 3) Swelling in legs 4) Dizziness 5) None', TRUE, 'symptoms', NOW() - INTERVAL '2 hours 2 minutes'),
    ('pat-001', 'whatsapp', 'inbound', 'patient', 'text', '1', FALSE, 'symptoms', NOW() - INTERVAL '2 hours'),
    ('pat-003', 'whatsapp', 'outbound', 'system', 'text', 'Good morning Sarah! Time for your daily check-in. How are you feeling today?', TRUE, 'wellbeing_score', NOW() - INTERVAL '35 minutes'),
    ('pat-003', 'whatsapp', 'inbound', 'patient', 'text', '8', FALSE, 'wellbeing_score', NOW() - INTERVAL '32 minutes'),
    ('pat-003', 'whatsapp', 'outbound', 'system', 'text', 'Great to hear! Have you taken all your medications today?', TRUE, 'medications', NOW() - INTERVAL '31 minutes'),
    ('pat-003', 'whatsapp', 'inbound', 'patient', 'text', 'Yes all taken', FALSE, 'medications', NOW() - INTERVAL '30 minutes');

-- ============================================================================
-- APPOINTMENTS
-- ============================================================================

INSERT INTO appointments (id, patient_id, doctor_id, type, status, scheduled_at, duration_minutes, location_type, reason) VALUES
    ('appt-001', 'pat-001', 'doc-001', 'follow_up', 'scheduled', NOW() + INTERVAL '3 days', 30, 'in_person', 'Post-discharge follow-up - review symptoms and medication'),
    ('appt-002', 'pat-002', 'doc-001', 'consultation', 'scheduled', NOW() + INTERVAL '1 day', 45, 'video', 'Urgent review - missed check-ins and device offline'),
    ('appt-003', 'pat-003', 'doc-002', 'follow_up', 'scheduled', NOW() + INTERVAL '2 weeks', 20, 'phone', 'Routine 4-week post-discharge review'),
    ('appt-004', 'pat-004', 'doc-001', 'emergency', 'scheduled', NOW() + INTERVAL '4 hours', 60, 'in_person', 'Urgent assessment - severe symptoms'),
    ('appt-005', 'pat-005', 'doc-002', 'follow_up', 'completed', NOW() - INTERVAL '2 days', 30, 'in_person', 'Post-PCI follow-up'),
    ('appt-006', 'pat-001', 'nurse-001', 'review', 'completed', NOW() - INTERVAL '5 days', 20, 'phone', 'Medication adherence check');

-- ============================================================================
-- SYSTEM STATS (Last 7 days)
-- ============================================================================

INSERT INTO system_daily_stats (stat_date, total_patients, active_patients, new_patients, total_doctors, active_doctors,
                                 patients_red, patients_amber, patients_green, total_check_ins, total_messages,
                                 alerts_generated, alerts_resolved, appointments_scheduled, appointments_completed, appointments_cancelled) VALUES
    (CURRENT_DATE - 6, 48, 45, 2, 8, 6, 5, 12, 31, 42, 156, 8, 6, 12, 10, 1),
    (CURRENT_DATE - 5, 49, 46, 1, 8, 7, 4, 13, 32, 44, 162, 7, 5, 11, 9, 0),
    (CURRENT_DATE - 4, 50, 47, 1, 8, 6, 5, 12, 33, 45, 170, 9, 7, 14, 11, 2),
    (CURRENT_DATE - 3, 51, 48, 1, 8, 7, 6, 11, 34, 46, 168, 10, 8, 13, 12, 1),
    (CURRENT_DATE - 2, 52, 49, 1, 8, 7, 5, 13, 34, 47, 175, 8, 6, 15, 13, 0),
    (CURRENT_DATE - 1, 53, 50, 1, 8, 8, 6, 12, 35, 48, 180, 11, 9, 12, 11, 1),
    (CURRENT_DATE, 55, 52, 2, 8, 8, 6, 13, 36, 50, 188, 12, 8, 16, 14, 0);
