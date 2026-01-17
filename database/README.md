# CardioWatch Database

PostgreSQL database schema for the CardioWatch clinical monitoring system.

## Overview

This database supports a healthcare platform for post-discharge cardiac patient monitoring, including:

- **User Management**: Patients, doctors, nurses, and administrators
- **Clinical Data**: Triage levels, alerts, check-ins, and medical history
- **Wearable Integration**: Device management and health metrics from Apple Watch, Fitbit, etc.
- **Communication**: WhatsApp/SMS chat history and conversation flows
- **Appointments**: Scheduling and follow-up management
- **Analytics**: Daily aggregated statistics for patients and system-wide metrics

## Entity Relationship Diagram

```
┌──────────────────┐     ┌──────────────────┐     ┌──────────────────┐
│   organizations  │     │      users       │     │     admins       │
│                  │◄────│                  │────►│                  │
│  - id            │     │  - id            │     │  - user_id       │
│  - name          │     │  - email         │     │  - admin_level   │
│  - type          │     │  - role          │     │  - permissions   │
│  - ods_code      │     │  - first_name    │     └──────────────────┘
└──────────────────┘     │  - last_name     │
                         │  - organization  │     ┌──────────────────┐
                         └────────┬─────────┘     │     doctors      │
                                  │               │                  │
                    ┌─────────────┼─────────────┐ │  - user_id       │
                    │             │             │ │  - gmc_number    │
                    ▼             ▼             ▼ │  - specialty     │
           ┌────────────┐  ┌────────────┐  ┌─────►│  - working_hours │
           │  patients  │  │   doctors  │  │     └──────────────────┘
           │            │  │            │──┘
           │ - user_id  │  │ - user_id  │
           │ - nhs_num  │  │ - gmc_num  │
           │ - triage   │  │ - specialty│
           └─────┬──────┘  └────────────┘
                 │
     ┌───────────┼───────────┬───────────────┐
     │           │           │               │
     ▼           ▼           ▼               ▼
┌─────────┐ ┌─────────┐ ┌─────────┐   ┌─────────────┐
│ alerts  │ │check_ins│ │wearable │   │appointments │
│         │ │         │ │_readings│   │             │
│-patient │ │-patient │ │-patient │   │ - patient   │
│-type    │ │-channel │ │-hr/steps│   │ - doctor    │
│-severity│ │-symptoms│ │-sleep   │   │ - scheduled │
└─────────┘ └─────────┘ └─────────┘   └─────────────┘
```

## Tables Overview

### User Tables
| Table | Description |
|-------|-------------|
| `organizations` | NHS trusts, hospitals, GP practices |
| `users` | Base user table (all user types) |
| `admins` | Admin-specific data and permissions |
| `doctors` | Doctor/nurse professional details |
| `patients` | Patient medical and care information |
| `doctor_patient_assignments` | Doctor-patient relationships |

### Clinical Tables
| Table | Description |
|-------|-------------|
| `alerts` | Clinical alerts and notifications |
| `alert_actions` | Comments and actions on alerts |
| `check_ins` | Daily patient check-in responses |
| `patient_medical_history` | Historical conditions |

### Wearable Tables
| Table | Description |
|-------|-------------|
| `wearable_devices` | Connected devices per patient |
| `wearable_readings` | Daily health metrics |

### Communication Tables
| Table | Description |
|-------|-------------|
| `chat_messages` | WhatsApp/SMS message history |
| `conversations` | Conversation threads and state |
| `notifications` | Push/email notification queue |

### Appointment Tables
| Table | Description |
|-------|-------------|
| `appointments` | Scheduled appointments |

### Analytics Tables
| Table | Description |
|-------|-------------|
| `patient_daily_stats` | Per-patient daily aggregates |
| `system_daily_stats` | System-wide daily metrics |

### Security Tables
| Table | Description |
|-------|-------------|
| `audit_logs` | All sensitive operations |
| `user_sessions` | Active sessions |
| `password_reset_tokens` | Password reset requests |

## Setup

### Prerequisites
- PostgreSQL 15+
- UUID extension (`uuid-ossp`)
- pgcrypto extension

### Create Database

```bash
# Create the database
createdb cardiowatch

# Run the schema
psql -d cardiowatch -f database/schema.sql

# Load seed data (development only)
psql -d cardiowatch -f database/seed.sql
```

### Environment Variables

```env
DATABASE_URL=postgresql://user:password@localhost:5432/cardiowatch
DATABASE_SSL=false
DATABASE_POOL_SIZE=20
```

## Security Features

### Row Level Security (RLS)

The schema includes RLS policies to ensure:
- Patients can only access their own data
- Doctors can only access their assigned patients
- Admins have appropriate access based on permissions

Enable RLS in your connection:
```sql
SET app.current_user_id = 'user-uuid-here';
```

### Audit Logging

All sensitive operations are logged to `audit_logs`:
- User logins/logouts
- Data access and modifications
- Triage level changes
- Alert resolutions

### Password Security

- Passwords are hashed using bcrypt (12 rounds)
- Password reset tokens expire after 1 hour
- Failed login attempts trigger account lockout

## Migrations

Migrations are stored in `/database/migrations/` with timestamps:

```
migrations/
├── 001_initial_schema.sql
├── 002_add_wearable_ecg.sql
└── 003_add_patient_notes.sql
```

Run migrations:
```bash
# Using a migration tool like golang-migrate
migrate -path database/migrations -database $DATABASE_URL up
```

## Indexes

Key indexes for query performance:
- `idx_users_email` - User lookup by email
- `idx_patients_nhs` - Patient lookup by NHS number
- `idx_patients_triage` - Filter by triage level
- `idx_alerts_patient` - Alerts per patient
- `idx_alerts_resolved` - Unresolved alerts
- `idx_readings_patient_date` - Wearable data queries

## Backup & Recovery

### Daily Backups
```bash
pg_dump cardiowatch > backup_$(date +%Y%m%d).sql
```

### Point-in-Time Recovery
Enable WAL archiving for PITR:
```
archive_mode = on
archive_command = 'cp %p /backup/wal/%f'
```

## Demo Credentials

For development/testing:

| Role | Email | Password |
|------|-------|----------|
| Super Admin | admin@cardiowatch.nhs.uk | admin123 |
| Doctor | dr.patel@nhs.uk | doctor123 |
| Patient | margaret.thompson@email.com | patient123 |

## License

Proprietary - CardioWatch Healthcare Ltd.
