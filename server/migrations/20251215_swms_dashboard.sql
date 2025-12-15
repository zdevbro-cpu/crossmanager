-- SWMS Dashboard Phase 1 schema additions
-- Safe to run multiple times (idempotent)

-- Optional: keep everything in public schema with swms_* prefix (consistent with existing SWMS tables)

-- 1) Dispatch plans (Phase 2 feature, created now for forward-compat)
CREATE TABLE IF NOT EXISTS swms_dispatch_plans (
    id              VARCHAR(100) PRIMARY KEY DEFAULT gen_random_uuid()::text,
    site_id          VARCHAR(100),
    project_id       VARCHAR(100),
    plan_date        DATE NOT NULL DEFAULT CURRENT_DATE,
    vehicle_number   VARCHAR(20),
    carrier_name     TEXT,
    planned_quantity NUMERIC(12, 2) DEFAULT 0,
    unit             VARCHAR(20),
    status           VARCHAR(20) DEFAULT 'PLANNED', -- PLANNED/IN_PROGRESS/DONE/CANCELED
    completed_at     TIMESTAMPTZ,
    meta             JSONB DEFAULT '{}'::jsonb,
    created_at       TIMESTAMPTZ DEFAULT NOW(),
    updated_at       TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_swms_dispatch_plans_site_date ON swms_dispatch_plans (site_id, plan_date DESC);
CREATE INDEX IF NOT EXISTS idx_swms_dispatch_plans_status ON swms_dispatch_plans (status);

-- 2) Work queue items (Phase 2 feature, created now for forward-compat)
CREATE TABLE IF NOT EXISTS swms_work_items (
    id          VARCHAR(100) PRIMARY KEY DEFAULT gen_random_uuid()::text,
    site_id      VARCHAR(100),
    work_date    DATE NOT NULL DEFAULT CURRENT_DATE,
    work_type    VARCHAR(30) NOT NULL,           -- OUTBOUND/INSPECTION/SETTLEMENT/...
    ref_table    TEXT,                           -- e.g., swms_outbounds
    ref_id       VARCHAR(100),
    title        TEXT,
    priority     INT DEFAULT 3,                  -- 1(high)~5(low)
    status       VARCHAR(20) DEFAULT 'OPEN',     -- OPEN/IN_PROGRESS/DONE/CANCELED
    due_at       TIMESTAMPTZ,
    assignee     TEXT,
    meta         JSONB DEFAULT '{}'::jsonb,
    created_at   TIMESTAMPTZ DEFAULT NOW(),
    updated_at   TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_swms_work_items_site_date ON swms_work_items (site_id, work_date DESC);
CREATE INDEX IF NOT EXISTS idx_swms_work_items_status ON swms_work_items (status);
CREATE INDEX IF NOT EXISTS idx_swms_work_items_ref ON swms_work_items (ref_table, ref_id);

-- 3) Attachments (Phase 2 feature, created now for forward-compat)
CREATE TABLE IF NOT EXISTS swms_attachments (
    id           VARCHAR(100) PRIMARY KEY DEFAULT gen_random_uuid()::text,
    site_id       VARCHAR(100),
    entity_type   VARCHAR(50) NOT NULL,          -- WEIGHING/SETTLEMENT/OUTBOUND/...
    entity_id     VARCHAR(100) NOT NULL,
    file_name     TEXT NOT NULL,
    file_path     TEXT,
    mime_type     TEXT,
    size          BIGINT,
    meta          JSONB DEFAULT '{}'::jsonb,
    created_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_swms_attachments_entity ON swms_attachments (entity_type, entity_id);

-- 4) Anomalies (Phase 1/2 feature; Phase 1 can populate simple ones)
CREATE TABLE IF NOT EXISTS swms_anomalies (
    id            VARCHAR(100) PRIMARY KEY DEFAULT gen_random_uuid()::text,
    site_id        VARCHAR(100),
    anomaly_type   VARCHAR(50) NOT NULL,         -- WEIGHING_DEVIATION/NEGATIVE_INVENTORY/...
    severity       VARCHAR(20) DEFAULT 'warn',   -- info/warn/critical
    title          TEXT NOT NULL,
    description    TEXT,
    entity_type    VARCHAR(50),
    entity_id      VARCHAR(100),
    baseline       JSONB DEFAULT '{}'::jsonb,
    observation    JSONB DEFAULT '{}'::jsonb,
    status         VARCHAR(20) DEFAULT 'OPEN',   -- OPEN/ACK/CLOSED
    detected_at    TIMESTAMPTZ DEFAULT NOW(),
    resolved_at    TIMESTAMPTZ,
    resolved_by    TEXT,
    created_at     TIMESTAMPTZ DEFAULT NOW(),
    updated_at     TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_swms_anomalies_site_time ON swms_anomalies (site_id, detected_at DESC);
CREATE INDEX IF NOT EXISTS idx_swms_anomalies_status ON swms_anomalies (status);

-- 5) Allbaro sync status (Phase 2 feature)
CREATE TABLE IF NOT EXISTS swms_allbaro_sync (
    id              VARCHAR(100) PRIMARY KEY DEFAULT gen_random_uuid()::text,
    site_id          VARCHAR(100),
    doc_type         VARCHAR(50),                -- TRANSFER/...
    entity_type      VARCHAR(50),
    entity_id        VARCHAR(100),
    external_key     TEXT,
    sync_status      VARCHAR(20) DEFAULT 'PENDING', -- PENDING/SUCCESS/FAILED
    last_synced_at   TIMESTAMPTZ,
    error_message    TEXT,
    error_detail     JSONB DEFAULT '{}'::jsonb,
    retry_count      INT DEFAULT 0,
    next_retry_at    TIMESTAMPTZ,
    created_at       TIMESTAMPTZ DEFAULT NOW(),
    updated_at       TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_swms_allbaro_site_status ON swms_allbaro_sync (site_id, sync_status);
CREATE INDEX IF NOT EXISTS idx_swms_allbaro_retry ON swms_allbaro_sync (next_retry_at);

-- 6) Claims / grade change / renegotiation tracking (Phase 2 feature)
CREATE TABLE IF NOT EXISTS swms_claims (
    id              VARCHAR(100) PRIMARY KEY DEFAULT gen_random_uuid()::text,
    site_id          VARCHAR(100),
    vendor_id        VARCHAR(100),
    material_type_id VARCHAR(100),
    claim_date       DATE NOT NULL DEFAULT CURRENT_DATE,
    claim_type       VARCHAR(50),                -- RETURN/PRICE_RENEGOTIATION/GRADE_CHANGE/...
    amount           NUMERIC(15, 2) DEFAULT 0,
    status           VARCHAR(20) DEFAULT 'OPEN', -- OPEN/IN_PROGRESS/CLOSED
    notes            TEXT,
    meta             JSONB DEFAULT '{}'::jsonb,
    created_at       TIMESTAMPTZ DEFAULT NOW(),
    updated_at       TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_swms_claims_site_date ON swms_claims (site_id, claim_date DESC);
CREATE INDEX IF NOT EXISTS idx_swms_claims_vendor ON swms_claims (vendor_id);

-- 7) Minimal column extensions for Phase 2 readiness (only when tables exist)
DO $$
BEGIN
    IF to_regclass('public.swms_inbounds') IS NOT NULL THEN
        EXECUTE 'ALTER TABLE swms_inbounds ADD COLUMN IF NOT EXISTS grade TEXT';
        EXECUTE 'ALTER TABLE swms_inbounds ADD COLUMN IF NOT EXISTS inspection_status TEXT';
        EXECUTE 'ALTER TABLE swms_inbounds ADD COLUMN IF NOT EXISTS required_docs_status JSONB DEFAULT ''{}''::jsonb';
    END IF;

    IF to_regclass('public.swms_outbounds') IS NOT NULL THEN
        EXECUTE 'ALTER TABLE swms_outbounds ADD COLUMN IF NOT EXISTS grade TEXT';
        EXECUTE 'ALTER TABLE swms_outbounds ADD COLUMN IF NOT EXISTS inspection_status TEXT';
        EXECUTE 'ALTER TABLE swms_outbounds ADD COLUMN IF NOT EXISTS required_docs_status JSONB DEFAULT ''{}''::jsonb';
    END IF;

    IF to_regclass('public.swms_settlements') IS NOT NULL THEN
        EXECUTE 'ALTER TABLE swms_settlements ADD COLUMN IF NOT EXISTS invoice_issued_at TIMESTAMPTZ';
        EXECUTE 'ALTER TABLE swms_settlements ADD COLUMN IF NOT EXISTS paid_at TIMESTAMPTZ';
        EXECUTE 'ALTER TABLE swms_settlements ADD COLUMN IF NOT EXISTS paid_amount NUMERIC(15,2) DEFAULT 0';
    END IF;

    IF to_regclass('public.swms_material_types') IS NOT NULL THEN
        EXECUTE 'ALTER TABLE swms_material_types ADD COLUMN IF NOT EXISTS is_scrap BOOLEAN';
    END IF;
END $$;

-- 8) Performance indexes for dashboard aggregates (safe no-ops if tables don't exist)
DO $$
BEGIN
    IF to_regclass('public.swms_inbounds') IS NOT NULL THEN
        EXECUTE 'CREATE INDEX IF NOT EXISTS idx_swms_inbounds_site_date ON swms_inbounds (site_id, inbound_date DESC)';
        EXECUTE 'CREATE INDEX IF NOT EXISTS idx_swms_inbounds_project_date ON swms_inbounds (project_id, inbound_date DESC)';
        EXECUTE 'CREATE INDEX IF NOT EXISTS idx_swms_inbounds_vendor_date ON swms_inbounds (vendor_id, inbound_date DESC)';
    END IF;

    IF to_regclass('public.swms_outbounds') IS NOT NULL THEN
        EXECUTE 'CREATE INDEX IF NOT EXISTS idx_swms_outbounds_site_date ON swms_outbounds (site_id, outbound_date DESC)';
        EXECUTE 'CREATE INDEX IF NOT EXISTS idx_swms_outbounds_project_date ON swms_outbounds (project_id, outbound_date DESC)';
        EXECUTE 'CREATE INDEX IF NOT EXISTS idx_swms_outbounds_vendor_date ON swms_outbounds (vendor_id, outbound_date DESC)';
        EXECUTE 'CREATE INDEX IF NOT EXISTS idx_swms_outbounds_status ON swms_outbounds (status)';
    END IF;

    IF to_regclass('public.swms_inventory') IS NOT NULL THEN
        EXECUTE 'CREATE INDEX IF NOT EXISTS idx_swms_inventory_site ON swms_inventory (site_id)';
        EXECUTE 'CREATE INDEX IF NOT EXISTS idx_swms_inventory_site_material ON swms_inventory (site_id, material_type_id)';
    END IF;

    IF to_regclass('public.swms_weighings') IS NOT NULL THEN
        EXECUTE 'CREATE INDEX IF NOT EXISTS idx_swms_weighings_site_date_time ON swms_weighings (site_id, weighing_date DESC, weighing_time DESC)';
        EXECUTE 'CREATE INDEX IF NOT EXISTS idx_swms_weighings_vehicle_date ON swms_weighings (vehicle_number, weighing_date DESC)';
        EXECUTE 'CREATE INDEX IF NOT EXISTS idx_swms_weighings_direction ON swms_weighings (direction)';
    END IF;
END $$;
