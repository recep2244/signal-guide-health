-- CreateTable: cardiac_metrics
-- Migration: 20260314_add_cardiac_metric
-- Phase 2: Dashboard & Cardiac Metrics

CREATE TABLE cardiac_metrics (
    id               TEXT        NOT NULL PRIMARY KEY DEFAULT gen_random_uuid()::text,
    patient_id       TEXT        NOT NULL,
    recorded_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    recorded_by      TEXT,
    ejection_fraction NUMERIC(5,2),
    nyha_class       INTEGER,
    nt_pro_bnp       NUMERIC(10,2),
    bnp              NUMERIC(10,2),
    hs_troponin_i    NUMERIC(10,4),
    hs_troponin_t    NUMERIC(10,4),
    creatinine       NUMERIC(8,2),
    killip_class     INTEGER,
    notes            TEXT,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT cardiac_metrics_patient_id_fkey
        FOREIGN KEY (patient_id)
        REFERENCES patients(id)
        ON DELETE CASCADE,

    CONSTRAINT cardiac_metrics_recorded_by_fkey
        FOREIGN KEY (recorded_by)
        REFERENCES users(id)
        ON DELETE SET NULL
);

-- CreateIndex: cardiac_metrics(patient_id, recorded_at)
CREATE INDEX cardiac_metrics_patient_id_recorded_at_idx
    ON cardiac_metrics(patient_id, recorded_at);
