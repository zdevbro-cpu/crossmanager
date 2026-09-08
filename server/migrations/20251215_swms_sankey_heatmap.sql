-- SWMS Sankey + Zone Heatmap schema additions
-- Safe to run multiple times (idempotent)

-- 1) Ensure warehouse capacity columns exist (Zone heatmap)
DO $$
BEGIN
    IF to_regclass('public.swms_warehouses') IS NOT NULL THEN
        EXECUTE 'ALTER TABLE swms_warehouses ADD COLUMN IF NOT EXISTS capacity NUMERIC(15,2)';
        EXECUTE 'ALTER TABLE swms_warehouses ADD COLUMN IF NOT EXISTS unit VARCHAR(20) DEFAULT ''톤''';
    END IF;
END $$;

-- 2) Ensure grade is usable (A/B/C) across domain tables
DO $$
BEGIN
    IF to_regclass('public.swms_inbounds') IS NOT NULL THEN
        EXECUTE 'ALTER TABLE swms_inbounds ADD COLUMN IF NOT EXISTS grade TEXT';
        EXECUTE 'UPDATE swms_inbounds SET grade = COALESCE(grade, ''A'')';
        EXECUTE 'ALTER TABLE swms_inbounds ALTER COLUMN grade SET DEFAULT ''A''';
    END IF;

    IF to_regclass('public.swms_outbounds') IS NOT NULL THEN
        EXECUTE 'ALTER TABLE swms_outbounds ADD COLUMN IF NOT EXISTS grade TEXT';
        EXECUTE 'UPDATE swms_outbounds SET grade = COALESCE(grade, ''A'')';
        EXECUTE 'ALTER TABLE swms_outbounds ALTER COLUMN grade SET DEFAULT ''A''';
    END IF;

    IF to_regclass('public.swms_inventory') IS NOT NULL THEN
        EXECUTE 'ALTER TABLE swms_inventory ADD COLUMN IF NOT EXISTS grade TEXT';
        EXECUTE 'UPDATE swms_inventory SET grade = COALESCE(grade, ''A'')';
        EXECUTE 'ALTER TABLE swms_inventory ALTER COLUMN grade SET DEFAULT ''A''';
        -- Re-key inventory by grade (drop old implicit unique, add new)
        EXECUTE 'ALTER TABLE swms_inventory DROP CONSTRAINT IF EXISTS swms_inventory_site_id_warehouse_id_material_type_id_key';
        IF NOT EXISTS (
            SELECT 1
            FROM pg_constraint
            WHERE conname = 'swms_inventory_site_warehouse_material_grade_key'
        ) THEN
            EXECUTE 'ALTER TABLE swms_inventory ADD CONSTRAINT swms_inventory_site_warehouse_material_grade_key UNIQUE (site_id, warehouse_id, material_type_id, grade)';
        END IF;
    END IF;
END $$;

-- 3) Process events for Sankey (inbound -> sort -> storage(zone) -> outbound -> settlement)
CREATE TABLE IF NOT EXISTS swms_process_events (
    id              VARCHAR(100) PRIMARY KEY DEFAULT gen_random_uuid()::text,
    site_id          VARCHAR(100),
    warehouse_id     VARCHAR(100),
    material_type_id VARCHAR(100),
    grade            TEXT DEFAULT 'A',
    from_stage       VARCHAR(30) NOT NULL, -- INBOUND/SORT/STORAGE/OUTBOUND/SETTLEMENT
    to_stage         VARCHAR(30) NOT NULL,
    quantity         NUMERIC(12,2) DEFAULT 0,
    unit             VARCHAR(20) DEFAULT '톤',
    occurred_at      TIMESTAMPTZ DEFAULT NOW(),
    meta             JSONB DEFAULT '{}'::jsonb,
    created_at       TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_swms_process_events_site_time ON swms_process_events (site_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_swms_process_events_site_stage ON swms_process_events (site_id, from_stage, to_stage);
CREATE INDEX IF NOT EXISTS idx_swms_process_events_site_wh ON swms_process_events (site_id, warehouse_id);
