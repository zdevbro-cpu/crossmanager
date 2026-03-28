const express = require('express');
const router = express.Router();

module.exports = (pool) => {
    // GET /api/swms/analytics/dashboard/kpi
    router.get('/analytics/dashboard/kpi', async (req, res) => {
        const siteId = req.query.siteId ? String(req.query.siteId) : null
        const date = req.query.date ? String(req.query.date) : null

        const baseDate = date || new Date().toISOString().slice(0, 10)

        try {
            const q = `
                SELECT
                    (
                        COALESCE((
                            SELECT SUM(quantity)::numeric
                            FROM swms_inbounds
                            WHERE inbound_date = $1::date
                            AND ($2::text IS NULL OR site_id = $2::text)
                        ), 0)
                        +
                        COALESCE((
                            SELECT SUM(quantity)::numeric
                            FROM swms_outbounds
                            WHERE outbound_date = $1::date
                            AND ($2::text IS NULL OR site_id = $2::text)
                        ), 0)
                    ) AS total_generation,
                    COALESCE((
                        SELECT SUM(total_amount)::numeric
                        FROM swms_outbounds
                        WHERE date_trunc('month', outbound_date) = date_trunc('month', $1::date)
                        AND status IN ('SETTLED')
                        AND ($2::text IS NULL OR site_id = $2::text)
                    ), 0) AS total_sales,
                    COALESCE((
                        SELECT COUNT(*)
                        FROM swms_inventory
                        WHERE ($2::text IS NULL OR site_id = $2::text)
                        AND quantity > 0
                    ), 0) AS total_stock_count
            `

            const { rows } = await pool.query(q, [baseDate, siteId])
            const row = rows[0] || {}

            res.json({
                totalGeneration: Number(row.total_generation || 0),
                totalSales: Number(row.total_sales || 0),
                totalStockCount: Number(row.total_stock_count || 0),
            })
        } catch (e) {
            console.error('[SWMS analytics] KPI error:', e)
            res.status(500).json({ error: e.message })
        }
    });

    // GET /api/swms/analytics/generation/daily
    router.get('/analytics/generation/daily', async (req, res) => {
        const siteId = req.query.siteId ? String(req.query.siteId) : null
        const daysRaw = req.query.days ? Number(req.query.days) : 30
        const days = Number.isFinite(daysRaw) ? Math.max(1, Math.min(365, Math.floor(daysRaw))) : 30

        try {
            const q = `
                WITH series AS (
                    SELECT generate_series(CURRENT_DATE - $1::int, CURRENT_DATE, interval '1 day')::date AS d
                ),
                inbound AS (
                    SELECT inbound_date::date AS d, SUM(quantity)::numeric AS qty
                    FROM swms_inbounds
                    WHERE inbound_date >= CURRENT_DATE - $1::int
                    AND ($2::text IS NULL OR site_id = $2::text)
                    GROUP BY inbound_date::date
                ),
                outbound AS (
                    SELECT outbound_date::date AS d, SUM(quantity)::numeric AS qty
                    FROM swms_outbounds
                    WHERE outbound_date >= CURRENT_DATE - $1::int
                    AND ($2::text IS NULL OR site_id = $2::text)
                    GROUP BY outbound_date::date
                )
                SELECT
                    s.d::text AS date,
                    (COALESCE(i.qty, 0) + COALESCE(o.qty, 0)) AS quantity
                FROM series s
                LEFT JOIN inbound i ON i.d = s.d
                LEFT JOIN outbound o ON o.d = s.d
                ORDER BY s.d
            `

            const { rows } = await pool.query(q, [days, siteId])
            res.json(rows.map(r => ({ date: r.date, quantity: Number(r.quantity || 0) })))
        } catch (e) {
            console.error('[SWMS analytics] daily error:', e)
            res.status(500).json({ error: e.message })
        }
    });

    return router;
};
