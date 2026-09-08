-- SWMS Pricing / Market reference (LME via aggregator) - Phase 1
-- Safe to run multiple times (idempotent)

-- 1) Daily market reference prices (USD + FX + KRW)
CREATE TABLE IF NOT EXISTS swms_market_prices_daily (
    price_date          DATE NOT NULL,
    source              VARCHAR(50) NOT NULL DEFAULT 'AGGREGATOR', -- LMESELECT/AGGREGATOR/MANUAL/...
    symbol              VARCHAR(20) NOT NULL,                      -- CU/AL/NI/...
    price_usd_per_ton   NUMERIC(18, 4) NOT NULL DEFAULT 0,
    fx_usdkrw           NUMERIC(18, 4) NOT NULL DEFAULT 0,
    price_krw_per_ton   NUMERIC(18, 2) NOT NULL DEFAULT 0,
    created_at          TIMESTAMPTZ DEFAULT NOW(),
    updated_at          TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (price_date, source, symbol)
);

CREATE INDEX IF NOT EXISTS idx_swms_market_prices_symbol_date
    ON swms_market_prices_daily (symbol, price_date DESC);

-- 2) Map SWMS material types to market symbols
CREATE TABLE IF NOT EXISTS swms_market_symbol_map (
    id              VARCHAR(100) PRIMARY KEY DEFAULT gen_random_uuid()::text,
    material_type_id VARCHAR(100) NOT NULL REFERENCES swms_material_types(id) ON DELETE CASCADE,
    symbol          VARCHAR(20) NOT NULL, -- CU/AL/NI
    source          VARCHAR(50) NOT NULL DEFAULT 'AGGREGATOR',
    unit            VARCHAR(20) NOT NULL DEFAULT 'TON',
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (material_type_id, symbol, source)
);

CREATE INDEX IF NOT EXISTS idx_swms_market_symbol_map_symbol
    ON swms_market_symbol_map (symbol);

-- 3) Adjustment coefficients per site/material
CREATE TABLE IF NOT EXISTS swms_pricing_coefficients (
    id                  VARCHAR(100) PRIMARY KEY DEFAULT gen_random_uuid()::text,
    site_id              VARCHAR(100),
    material_type_id     VARCHAR(100) NOT NULL REFERENCES swms_material_types(id) ON DELETE CASCADE,
    coefficient_pct      NUMERIC(8, 3) NOT NULL DEFAULT 60,   -- 60 means 60%
    purity_pct           NUMERIC(8, 3) NOT NULL DEFAULT 100,  -- optional
    yield_pct            NUMERIC(8, 3) NOT NULL DEFAULT 100,  -- optional
    fixed_cost_krw_per_ton NUMERIC(18, 2) NOT NULL DEFAULT 0,
    updated_at           TIMESTAMPTZ DEFAULT NOW(),
    created_at           TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (site_id, material_type_id)
);

CREATE INDEX IF NOT EXISTS idx_swms_pricing_coeff_site_material
    ON swms_pricing_coefficients (site_id, material_type_id);

-- 4) Pricing decisions (approve/apply)
CREATE TABLE IF NOT EXISTS swms_pricing_decisions (
    id                  VARCHAR(100) PRIMARY KEY DEFAULT gen_random_uuid()::text,
    site_id              VARCHAR(100),
    material_type_id     VARCHAR(100) NOT NULL REFERENCES swms_material_types(id) ON DELETE CASCADE,
    effective_date       DATE NOT NULL,
    reference_date       DATE NOT NULL,
    source               VARCHAR(50) NOT NULL DEFAULT 'AGGREGATOR',
    symbol               VARCHAR(20),
    lme_krw_per_ton      NUMERIC(18, 2) NOT NULL DEFAULT 0,
    fx_usdkrw            NUMERIC(18, 4) NOT NULL DEFAULT 0,
    coefficient_pct      NUMERIC(8, 3) NOT NULL DEFAULT 60,
    fixed_cost_krw_per_ton NUMERIC(18, 2) NOT NULL DEFAULT 0,
    suggested_krw_per_ton NUMERIC(18, 2) NOT NULL DEFAULT 0,
    approved_krw_per_ton  NUMERIC(18, 2) NOT NULL DEFAULT 0,
    status              VARCHAR(20) NOT NULL DEFAULT 'APPROVED', -- DRAFT/APPROVED
    approved_by         TEXT,
    approved_at         TIMESTAMPTZ DEFAULT NOW(),
    note                TEXT,
    created_at          TIMESTAMPTZ DEFAULT NOW(),
    updated_at          TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (site_id, material_type_id, effective_date)
);

CREATE INDEX IF NOT EXISTS idx_swms_pricing_decisions_site_date
    ON swms_pricing_decisions (site_id, effective_date DESC);

