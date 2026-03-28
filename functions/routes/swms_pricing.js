const express = require('express')
const router = express.Router()

module.exports = (pool) => {
    // Base: /api/swms/pricing/*

    // GET /api/swms/pricing/materials?siteId
    router.get('/pricing/materials', async (req, res) => {
        const siteId = req.query.siteId ? String(req.query.siteId) : null
        try {
            const q = `
                SELECT
                    mt.id AS material_type_id,
                    mt.name AS material_name,
                    mt.category AS material_category,
                    mt.unit AS material_unit,
                    map.symbol,
                    map.source,
                    COALESCE(c.coefficient_pct, 60)::numeric AS coefficient_pct,
                    COALESCE(c.fixed_cost_krw_per_ton, 0)::numeric AS fixed_cost_krw_per_ton
                FROM swms_market_symbol_map map
                JOIN swms_material_types mt ON mt.id = map.material_type_id
                LEFT JOIN swms_pricing_coefficients c
                    ON c.material_type_id = mt.id
                    AND (($1::text IS NULL AND c.site_id IS NULL) OR c.site_id = $1::text)
                ORDER BY mt.name
            `
            const { rows } = await pool.query(q, [siteId])
            res.json(rows.map(r => ({
                materialTypeId: r.material_type_id,
                materialName: r.material_name,
                unit: r.material_unit,
                symbol: r.symbol,
                source: r.source,
                coefficientPct: Number(r.coefficient_pct || 60),
                fixedCostKrwPerTon: Number(r.fixed_cost_krw_per_ton || 0),
            })))
        } catch (e) {
            console.error('[SWMS pricing] materials error:', e)
            res.status(500).json({ error: e.message })
        }
    })

    // GET /api/swms/pricing/recommendation?siteId&materialTypeId&date=YYYY-MM-DD
    router.get('/pricing/recommendation', async (req, res) => {
        const siteId = req.query.siteId ? String(req.query.siteId) : null
        const materialTypeId = req.query.materialTypeId ? String(req.query.materialTypeId) : null
        const date = req.query.date ? String(req.query.date) : new Date().toISOString().slice(0, 10)

        if (!materialTypeId) return res.status(400).json({ error: 'materialTypeId required' })

        try {
            const q = `
                WITH map AS (
                    SELECT symbol, source
                    FROM swms_market_symbol_map
                    WHERE material_type_id = $1::text
                    LIMIT 1
                ),
                market AS (
                    SELECT
                        p.symbol,
                        p.source,
                        p.price_usd_per_ton,
                        p.fx_usdkrw,
                        p.price_krw_per_ton
                    FROM swms_market_prices_daily p
                    JOIN map m ON m.symbol = p.symbol AND m.source = p.source
                    WHERE p.price_date = $2::date
                    LIMIT 1
                ),
                coeff AS (
                    SELECT
                        COALESCE(c.coefficient_pct, 60)::numeric AS coefficient_pct,
                        COALESCE(c.fixed_cost_krw_per_ton, 0)::numeric AS fixed_cost_krw_per_ton
                    FROM swms_pricing_coefficients c
                    WHERE c.material_type_id = $1::text
                    AND (($3::text IS NULL AND c.site_id IS NULL) OR c.site_id = $3::text)
                    LIMIT 1
                ),
                latest_decision AS (
                    SELECT approved_krw_per_ton, coefficient_pct, fixed_cost_krw_per_ton, approved_at
                    FROM swms_pricing_decisions
                    WHERE material_type_id = $1::text
                    AND (($3::text IS NULL AND site_id IS NULL) OR site_id = $3::text)
                    AND effective_date <= $2::date
                    ORDER BY effective_date DESC
                    LIMIT 1
                )
                SELECT
                    (SELECT symbol FROM market) AS symbol,
                    (SELECT source FROM market) AS source,
                    (SELECT price_usd_per_ton FROM market) AS price_usd_per_ton,
                    (SELECT fx_usdkrw FROM market) AS fx_usdkrw,
                    (SELECT price_krw_per_ton FROM market) AS lme_krw_per_ton,
                    COALESCE((SELECT coefficient_pct FROM coeff), 60) AS coefficient_pct,
                    COALESCE((SELECT fixed_cost_krw_per_ton FROM coeff), 0) AS fixed_cost_krw_per_ton,
                    COALESCE((SELECT approved_krw_per_ton FROM latest_decision), 0) AS last_approved_krw_per_ton,
                    (SELECT approved_at FROM latest_decision) AS last_approved_at
            `
            const { rows } = await pool.query(q, [materialTypeId, date, siteId])
            const r = rows[0] || {}
            const lmeKrw = Number(r.lme_krw_per_ton || 0)
            const coeffPct = Number(r.coefficient_pct || 60)
            const fixedCost = Number(r.fixed_cost_krw_per_ton || 0)
            const suggested = lmeKrw * (coeffPct / 100) - fixedCost

            res.json({
                date,
                siteId,
                materialTypeId,
                symbol: r.symbol || null,
                source: r.source || null,
                market: {
                    usdPerTon: Number(r.price_usd_per_ton || 0),
                    fxUsdKrw: Number(r.fx_usdkrw || 0),
                    krwPerTon: lmeKrw,
                },
                coefficientPct: coeffPct,
                fixedCostKrwPerTon: fixedCost,
                suggestedKrwPerTon: Math.round(suggested),
                lastApprovedKrwPerTon: Number(r.last_approved_krw_per_ton || 0),
                lastApprovedAt: r.last_approved_at || null,
            })
        } catch (e) {
            console.error('[SWMS pricing] recommendation error:', e)
            res.status(500).json({ error: e.message })
        }
    })

    // POST /api/swms/pricing/approve
    // body: { siteId, materialTypeId, effectiveDate, coefficientPct?, fixedCostKrwPerTon?, approvedKrwPerTon?, note?, approvedBy? }
    router.post('/pricing/approve', async (req, res) => {
        const {
            siteId = null,
            materialTypeId,
            effectiveDate,
            coefficientPct,
            fixedCostKrwPerTon,
            approvedKrwPerTon,
            note,
            approvedBy,
        } = req.body || {}

        if (!materialTypeId) return res.status(400).json({ error: 'materialTypeId required' })
        if (!effectiveDate) return res.status(400).json({ error: 'effectiveDate required' })

        const date = String(effectiveDate)

        const client = await pool.connect()
        try {
            await client.query('BEGIN')

            // resolve mapping + market price
            const mapRes = await client.query(
                `SELECT symbol, source FROM swms_market_symbol_map WHERE material_type_id=$1 LIMIT 1`,
                [materialTypeId]
            )
            const symbol = mapRes.rows[0]?.symbol || null
            const source = mapRes.rows[0]?.source || 'AGGREGATOR'

            const marketRes = await client.query(
                `SELECT price_usd_per_ton, fx_usdkrw, price_krw_per_ton
                 FROM swms_market_prices_daily
                 WHERE price_date=$1::date AND symbol=$2 AND source=$3
                 LIMIT 1`,
                [date, symbol, source]
            )
            const market = marketRes.rows[0] || { price_usd_per_ton: 0, fx_usdkrw: 0, price_krw_per_ton: 0 }

            // coefficient upsert (optional)
            const coeffPct = Number.isFinite(Number(coefficientPct)) ? Number(coefficientPct) : null
            const fixedCost = Number.isFinite(Number(fixedCostKrwPerTon)) ? Number(fixedCostKrwPerTon) : null
            if (coeffPct !== null || fixedCost !== null) {
                const current = await client.query(
                    `SELECT coefficient_pct, fixed_cost_krw_per_ton
                     FROM swms_pricing_coefficients
                     WHERE material_type_id=$1 AND (($2::text IS NULL AND site_id IS NULL) OR site_id=$2::text)
                     LIMIT 1`,
                    [materialTypeId, siteId]
                )
                const prev = current.rows[0] || {}
                const nextCoeff = coeffPct !== null ? coeffPct : Number(prev.coefficient_pct || 60)
                const nextFixed = fixedCost !== null ? fixedCost : Number(prev.fixed_cost_krw_per_ton || 0)

                await client.query(
                    `INSERT INTO swms_pricing_coefficients (site_id, material_type_id, coefficient_pct, fixed_cost_krw_per_ton, updated_at)
                     VALUES ($1,$2,$3,$4,NOW())
                     ON CONFLICT (site_id, material_type_id) DO UPDATE SET
                        coefficient_pct=EXCLUDED.coefficient_pct,
                        fixed_cost_krw_per_ton=EXCLUDED.fixed_cost_krw_per_ton,
                        updated_at=NOW()`,
                    [siteId, materialTypeId, nextCoeff, nextFixed]
                )
            }

            // compute suggested/approved
            const coeffRes = await client.query(
                `SELECT coefficient_pct, fixed_cost_krw_per_ton
                 FROM swms_pricing_coefficients
                 WHERE material_type_id=$1 AND (($2::text IS NULL AND site_id IS NULL) OR site_id=$2::text)
                 LIMIT 1`,
                [materialTypeId, siteId]
            )
            const coeff = coeffRes.rows[0] || { coefficient_pct: 60, fixed_cost_krw_per_ton: 0 }
            const cPct = Number(coeff.coefficient_pct || 60)
            const fCost = Number(coeff.fixed_cost_krw_per_ton || 0)
            const lmeKrw = Number(market.price_krw_per_ton || 0)
            const suggested = lmeKrw * (cPct / 100) - fCost
            const approved = Number.isFinite(Number(approvedKrwPerTon))
                ? Math.round(Number(approvedKrwPerTon))
                : Math.round(suggested)

            await client.query(
                `INSERT INTO swms_pricing_decisions (
                    site_id, material_type_id, effective_date, reference_date, source, symbol,
                    lme_krw_per_ton, fx_usdkrw, coefficient_pct, fixed_cost_krw_per_ton,
                    suggested_krw_per_ton, approved_krw_per_ton, status, approved_by, approved_at, note
                 ) VALUES (
                    $1,$2,$3::date,$4::date,$5,$6,
                    $7,$8,$9,$10,
                    $11,$12,'APPROVED',$13,NOW(),$14
                 )
                 ON CONFLICT (site_id, material_type_id, effective_date) DO UPDATE SET
                    reference_date=EXCLUDED.reference_date,
                    source=EXCLUDED.source,
                    symbol=EXCLUDED.symbol,
                    lme_krw_per_ton=EXCLUDED.lme_krw_per_ton,
                    fx_usdkrw=EXCLUDED.fx_usdkrw,
                    coefficient_pct=EXCLUDED.coefficient_pct,
                    fixed_cost_krw_per_ton=EXCLUDED.fixed_cost_krw_per_ton,
                    suggested_krw_per_ton=EXCLUDED.suggested_krw_per_ton,
                    approved_krw_per_ton=EXCLUDED.approved_krw_per_ton,
                    approved_by=EXCLUDED.approved_by,
                    approved_at=NOW(),
                    note=EXCLUDED.note,
                    updated_at=NOW()`,
                [
                    siteId,
                    materialTypeId,
                    date,
                    date,
                    source,
                    symbol,
                    lmeKrw,
                    Number(market.fx_usdkrw || 0),
                    cPct,
                    fCost,
                    Math.round(suggested),
                    approved,
                    approvedBy || null,
                    note || null,
                ]
            )

            await client.query('COMMIT')
            res.json({ ok: true, approvedKrwPerTon: approved })
        } catch (e) {
            await client.query('ROLLBACK')
            console.error('[SWMS pricing] approve error:', e)
            res.status(500).json({ error: e.message })
        } finally {
            client.release()
        }
    })

    // GET /api/swms/pricing/trend?siteId&materialTypeId&days=30
    router.get('/pricing/trend', async (req, res) => {
        const siteId = req.query.siteId ? String(req.query.siteId) : null
        const materialTypeId = req.query.materialTypeId ? String(req.query.materialTypeId) : null
        const days = Math.max(1, Math.min(365, Math.floor(Number(req.query.days || 30))))

        if (!materialTypeId) return res.status(400).json({ error: 'materialTypeId required' })

        try {
            const q = `
                WITH map AS (
                    SELECT symbol, source
                    FROM swms_market_symbol_map
                    WHERE material_type_id = $1::text
                    LIMIT 1
                ),
                market AS (
                    SELECT price_date, price_krw_per_ton
                    FROM swms_market_prices_daily p
                    JOIN map m ON m.symbol=p.symbol AND m.source=p.source
                    WHERE p.price_date >= CURRENT_DATE - $3::int
                ),
                decision AS (
                    SELECT effective_date AS price_date, approved_krw_per_ton
                    FROM swms_pricing_decisions
                    WHERE material_type_id=$1::text
                    AND (($2::text IS NULL AND site_id IS NULL) OR site_id=$2::text)
                    AND effective_date >= CURRENT_DATE - $3::int
                ),
                series AS (
                    SELECT generate_series(CURRENT_DATE - $3::int, CURRENT_DATE, interval '1 day')::date AS d
                )
                SELECT
                    s.d::text AS date,
                    COALESCE(m.price_krw_per_ton, 0)::numeric AS market_krw_per_ton,
                    COALESCE(d.approved_krw_per_ton, 0)::numeric AS approved_krw_per_ton
                FROM series s
                LEFT JOIN market m ON m.price_date = s.d
                LEFT JOIN decision d ON d.price_date = s.d
                ORDER BY s.d
            `
            const { rows } = await pool.query(q, [materialTypeId, siteId, days])
            res.json(rows.map(r => ({
                date: r.date,
                marketKrwPerTon: Number(r.market_krw_per_ton || 0),
                approvedKrwPerTon: Number(r.approved_krw_per_ton || 0),
            })))
        } catch (e) {
            console.error('[SWMS pricing] trend error:', e)
            res.status(500).json({ error: e.message })
        }
    })

    return router
}

