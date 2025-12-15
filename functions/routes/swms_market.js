const express = require('express')
const router = express.Router()

function clampInt(value, min, max, fallback) {
    const n = Number(value)
    if (!Number.isFinite(n)) return fallback
    return Math.max(min, Math.min(max, Math.floor(n)))
}

module.exports = (pool) => {
    // Base: /api/swms/market/*

    // GET /api/swms/market/ticker?siteId&date=YYYY-MM-DD
    router.get('/market/ticker', async (req, res) => {
        const date = req.query.date ? String(req.query.date) : new Date().toISOString().slice(0, 10)
        const siteId = req.query.siteId ? String(req.query.siteId) : null

        try {
            const q = `
                WITH mapped AS (
                    SELECT DISTINCT m.symbol, m.source
                    FROM swms_market_symbol_map m
                    WHERE ($2::text IS NULL OR EXISTS (
                        SELECT 1
                        FROM swms_pricing_coefficients c
                        WHERE c.site_id = $2::text
                        AND c.material_type_id = m.material_type_id
                    ))
                ),
                today AS (
                    SELECT p.symbol, p.source, p.price_usd_per_ton, p.fx_usdkrw, p.price_krw_per_ton, p.updated_at
                    FROM swms_market_prices_daily p
                    JOIN mapped m ON m.symbol = p.symbol AND m.source = p.source
                    WHERE p.price_date = $1::date
                ),
                prev AS (
                    SELECT p.symbol, p.source, p.price_krw_per_ton AS prev_krw
                    FROM swms_market_prices_daily p
                    JOIN mapped m ON m.symbol = p.symbol AND m.source = p.source
                    WHERE p.price_date = $1::date - interval '1 day'
                )
                SELECT
                    t.symbol,
                    t.source,
                    t.price_usd_per_ton,
                    t.fx_usdkrw,
                    t.price_krw_per_ton,
                    CASE
                        WHEN COALESCE(p.prev_krw, 0) = 0 THEN NULL
                        ELSE ((t.price_krw_per_ton - p.prev_krw) / p.prev_krw) * 100
                    END AS delta_pct,
                    t.updated_at
                FROM today t
                LEFT JOIN prev p ON p.symbol = t.symbol AND p.source = t.source
                ORDER BY t.symbol
            `
            const { rows } = await pool.query(q, [date, siteId])
            res.json(rows.map(r => ({
                symbol: r.symbol,
                source: r.source,
                usdPerTon: Number(r.price_usd_per_ton || 0),
                fxUsdKrw: Number(r.fx_usdkrw || 0),
                krwPerTon: Number(r.price_krw_per_ton || 0),
                deltaPct: r.delta_pct === null ? null : Number(r.delta_pct),
                updatedAt: r.updated_at,
            })))
        } catch (e) {
            console.error('[SWMS market] ticker error:', e)
            res.status(500).json({ error: e.message })
        }
    })

    // GET /api/swms/market/prices?symbols=CU,AL&days=30
    router.get('/market/prices', async (req, res) => {
        const days = clampInt(req.query.days, 1, 365, 30)
        const symbols = (req.query.symbols ? String(req.query.symbols) : '')
            .split(',')
            .map(s => s.trim())
            .filter(Boolean)

        if (symbols.length === 0) return res.json([])

        try {
            const q = `
                SELECT
                    price_date::text AS date,
                    symbol,
                    source,
                    price_usd_per_ton,
                    fx_usdkrw,
                    price_krw_per_ton
                FROM swms_market_prices_daily
                WHERE price_date >= CURRENT_DATE - $1::int
                AND symbol = ANY($2::text[])
                ORDER BY price_date, symbol
            `
            const { rows } = await pool.query(q, [days, symbols])
            res.json(rows.map(r => ({
                date: r.date,
                symbol: r.symbol,
                source: r.source,
                usdPerTon: Number(r.price_usd_per_ton || 0),
                fxUsdKrw: Number(r.fx_usdkrw || 0),
                krwPerTon: Number(r.price_krw_per_ton || 0),
            })))
        } catch (e) {
            console.error('[SWMS market] prices error:', e)
            res.status(500).json({ error: e.message })
        }
    })

    return router
}

