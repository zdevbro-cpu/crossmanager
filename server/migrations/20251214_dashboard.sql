-- Dashboard schema for executive/operations dashboards
-- Safe to run multiple times (idempotent create schema/table if not exists)

CREATE SCHEMA IF NOT EXISTS dashboard;

-- Health score per project per day
CREATE TABLE IF NOT EXISTS dashboard.health_daily (
    id               BIGSERIAL PRIMARY KEY,
    project_id       UUID NOT NULL,
    calc_date        DATE NOT NULL,
    score_total      NUMERIC(5,2) NOT NULL,
    score_schedule   NUMERIC(5,2) NOT NULL,
    score_safety     NUMERIC(5,2) NOT NULL,
    score_cost       NUMERIC(5,2) NOT NULL,
    score_resource   NUMERIC(5,2) NOT NULL,
    score_quality    NUMERIC(5,2) NOT NULL,
    grade            TEXT NOT NULL,           -- GREEN/YELLOW/ORANGE/RED
    forced_red       BOOLEAN DEFAULT FALSE,
    top_reasons      JSONB DEFAULT '[]',      -- [{type,value,weight}]
    data_quality_flag JSONB DEFAULT '{}' ,    -- {schedule:'ok',safety:'missing',...}
    created_at       TIMESTAMPTZ DEFAULT NOW(),
    updated_at       TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT uq_health_daily UNIQUE (project_id, calc_date)
);

-- Risk items per project/date (for cards/lists)
CREATE TABLE IF NOT EXISTS dashboard.risks (
    id          BIGSERIAL PRIMARY KEY,
    project_id  UUID NOT NULL,
    calc_date   DATE NOT NULL,
    risk_type   TEXT NOT NULL,        -- safety/schedule/cost/resource/scrap
    title       TEXT NOT NULL,
    severity    TEXT NOT NULL,        -- info/warn/critical
    metrics     JSONB DEFAULT '{}',   -- related numbers
    created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- Executive decision/alert cards
CREATE TABLE IF NOT EXISTS dashboard.alerts (
    id          BIGSERIAL PRIMARY KEY,
    project_id  UUID NOT NULL,
    alert_type  TEXT NOT NULL,        -- approval_pending/safety_nc/loss_risk/equipment_fault/scrap_issue/...
    title       TEXT NOT NULL,
    detail      TEXT,
    status      TEXT DEFAULT 'open',  -- open/ack/closed
    severity    TEXT DEFAULT 'warn',  -- warn/critical
    action_url  TEXT,
    created_at  TIMESTAMPTZ DEFAULT NOW(),
    updated_at  TIMESTAMPTZ DEFAULT NOW()
);

-- Data quality flags per domain
CREATE TABLE IF NOT EXISTS dashboard.data_quality (
    id              BIGSERIAL PRIMARY KEY,
    project_id      UUID NOT NULL,
    calc_date       DATE NOT NULL,
    domain          TEXT NOT NULL,        -- schedule/safety/cost/resource/quality/scrap
    status          TEXT NOT NULL,        -- ok/partial/missing
    missing_fields  JSONB DEFAULT '[]',
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- Weight/penalty configuration (operational tuning)
CREATE TABLE IF NOT EXISTS dashboard.weights (
    id            BIGSERIAL PRIMARY KEY,
    effective_from DATE NOT NULL,
    w_schedule    NUMERIC(4,3) DEFAULT 0.25,
    w_safety      NUMERIC(4,3) DEFAULT 0.30,
    w_cost        NUMERIC(4,3) DEFAULT 0.20,
    w_resource    NUMERIC(4,3) DEFAULT 0.15,
    w_quality     NUMERIC(4,3) DEFAULT 0.10,
    penalty_rules JSONB DEFAULT '{}',   -- e.g., critical_delay:-15, accident:-50
    created_at    TIMESTAMPTZ DEFAULT NOW(),
    updated_at    TIMESTAMPTZ DEFAULT NOW()
);

-- Optional: scoring run log for audit/debug
CREATE TABLE IF NOT EXISTS dashboard.scores_log (
    id          BIGSERIAL PRIMARY KEY,
    project_id  UUID NOT NULL,
    calc_time   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    inputs      JSONB DEFAULT '{}',    -- snapshot of input metrics
    outputs     JSONB DEFAULT '{}',    -- scores/grade/forced_red
    duration_ms INT,
    created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_health_daily_project_date ON dashboard.health_daily (project_id, calc_date DESC);
CREATE INDEX IF NOT EXISTS idx_risks_project_date ON dashboard.risks (project_id, calc_date DESC);
CREATE INDEX IF NOT EXISTS idx_alerts_project ON dashboard.alerts (project_id, status);
CREATE INDEX IF NOT EXISTS idx_data_quality_project_date ON dashboard.data_quality (project_id, calc_date DESC);
