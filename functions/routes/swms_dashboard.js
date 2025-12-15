const express = require('express')
const router = express.Router()

function clampInt(value, min, max, fallback) {
    const n = Number(value)
    if (!Number.isFinite(n)) return fallback
    return Math.max(min, Math.min(max, Math.floor(n)))
}

module.exports = (pool) => {
    // Phase 1: "노멀 정의" 기반의 대시보드 API
    // Base path: /api/swms/dashboard/*

    // GET /api/swms/dashboard/kpi?siteId&date=YYYY-MM-DD
    router.get('/dashboard/kpi', async (req, res) => {
        const siteId = req.query.siteId ? String(req.query.siteId) : null
        const date = req.query.date ? String(req.query.date) : new Date().toISOString().slice(0, 10)

        try {
            const q = `
                WITH base AS (
                    SELECT $1::date AS d
                ),
                in_today AS (
                    SELECT COALESCE(SUM(quantity),0)::numeric AS qty
                    FROM swms_inbounds
                    WHERE inbound_date = (SELECT d FROM base)
                    AND ($2::text IS NULL OR site_id = $2::text)
                ),
                out_today AS (
                    SELECT COALESCE(SUM(quantity),0)::numeric AS qty
                    FROM swms_outbounds
                    WHERE outbound_date = (SELECT d FROM base)
                    AND ($2::text IS NULL OR site_id = $2::text)
                ),
                in_yesterday AS (
                    SELECT COALESCE(SUM(quantity),0)::numeric AS qty
                    FROM swms_inbounds
                    WHERE inbound_date = (SELECT d FROM base) - interval '1 day'
                    AND ($2::text IS NULL OR site_id = $2::text)
                ),
                out_yesterday AS (
                    SELECT COALESCE(SUM(quantity),0)::numeric AS qty
                    FROM swms_outbounds
                    WHERE outbound_date = (SELECT d FROM base) - interval '1 day'
                    AND ($2::text IS NULL OR site_id = $2::text)
                ),
                inv AS (
                    SELECT
                        COALESCE(SUM(quantity),0)::numeric AS total_qty,
                        COALESCE(COUNT(*) FILTER (WHERE quantity > 0),0)::int AS item_count
                    FROM swms_inventory
                    WHERE ($2::text IS NULL OR site_id = $2::text)
                ),
                month_out_confirmed AS (
                    SELECT COALESCE(SUM(total_amount),0)::numeric AS amount
                    FROM swms_outbounds
                    WHERE date_trunc('month', outbound_date) = date_trunc('month', (SELECT d FROM base))
                    AND status IN ('SETTLED')
                    AND ($2::text IS NULL OR site_id = $2::text)
                ),
                month_out_expected AS (
                    SELECT COALESCE(SUM(total_amount),0)::numeric AS amount
                    FROM swms_outbounds
                    WHERE date_trunc('month', outbound_date) = date_trunc('month', (SELECT d FROM base))
                    AND status IN ('APPROVED','PENDING')
                    AND ($2::text IS NULL OR site_id = $2::text)
                ),
                settlement_pending AS (
                    SELECT
                        COALESCE(COUNT(*),0)::int AS cnt,
                        COALESCE(SUM(total_amount),0)::numeric AS amount
                    FROM swms_outbounds
                    WHERE status IN ('APPROVED')
                    AND ($2::text IS NULL OR site_id = $2::text)
                ),
                anomalies_open AS (
                    SELECT
                        COALESCE(COUNT(*),0)::int AS total,
                        COALESCE(COUNT(*) FILTER (WHERE severity='critical'),0)::int AS critical
                    FROM swms_anomalies
                    WHERE status='OPEN'
                    AND ($2::text IS NULL OR site_id = $2::text)
                    AND detected_at >= (SELECT d FROM base) - interval '7 day'
                )
                SELECT
                    (SELECT qty FROM in_today) AS inbound_qty,
                    (SELECT qty FROM out_today) AS outbound_qty,
                    (SELECT qty FROM in_yesterday) AS inbound_yesterday_qty,
                    (SELECT qty FROM out_yesterday) AS outbound_yesterday_qty,
                    (SELECT total_qty FROM inv) AS inventory_total_qty,
                    (SELECT item_count FROM inv) AS inventory_item_count,
                    (SELECT amount FROM month_out_expected) AS month_sales_expected,
                    (SELECT amount FROM month_out_confirmed) AS month_sales_confirmed,
                    (SELECT cnt FROM settlement_pending) AS settlement_pending_count,
                    (SELECT amount FROM settlement_pending) AS settlement_pending_amount,
                    (SELECT total FROM anomalies_open) AS anomalies_open_total,
                    (SELECT critical FROM anomalies_open) AS anomalies_open_critical
            `

            const { rows } = await pool.query(q, [date, siteId])
            const r = rows[0] || {}

            const inboundToday = Number(r.inbound_qty || 0)
            const outboundToday = Number(r.outbound_qty || 0)
            const inboundYesterday = Number(r.inbound_yesterday_qty || 0)
            const outboundYesterday = Number(r.outbound_yesterday_qty || 0)

            const pct = (today, yesterday) => {
                if (!yesterday) return null
                return ((today - yesterday) / yesterday) * 100
            }

            res.json({
                date,
                siteId,
                flow: {
                    inboundQty: inboundToday,
                    outboundQty: outboundToday,
                    inboundDeltaPct: pct(inboundToday, inboundYesterday),
                    outboundDeltaPct: pct(outboundToday, outboundYesterday),
                },
                inventory: {
                    totalQty: Number(r.inventory_total_qty || 0),
                    itemCount: Number(r.inventory_item_count || 0),
                    targetPct: null,
                    status: 'ok',
                },
                month: {
                    processedQty: null,
                    targetPct: null,
                    status: 'todo',
                },
                dispatch: {
                    planned: null,
                    done: null,
                    ratePct: null,
                    status: 'todo',
                },
                sales: {
                    expected: Number(r.month_sales_expected || 0),
                    confirmed: Number(r.month_sales_confirmed || 0),
                },
                profit: {
                    scrapRevenue: null,
                    wasteCost: null,
                    net: null,
                    status: 'todo',
                },
                settlement: {
                    pendingCount: Number(r.settlement_pending_count || 0),
                    pendingAmount: Number(r.settlement_pending_amount || 0),
                    stageBreakdown: null,
                    status: 'partial',
                },
                anomalies: {
                    openTotal: Number(r.anomalies_open_total || 0),
                    openCritical: Number(r.anomalies_open_critical || 0),
                },
            })
        } catch (e) {
            console.error('[SWMS dashboard] kpi error:', e)
            res.status(500).json({ error: e.message })
        }
    })

    // GET /api/swms/dashboard/charts/outbound-by-hour?siteId&date=YYYY-MM-DD
    router.get('/dashboard/charts/outbound-by-hour', async (req, res) => {
        const siteId = req.query.siteId ? String(req.query.siteId) : null
        const date = req.query.date ? String(req.query.date) : new Date().toISOString().slice(0, 10)

        try {
            const q = `
                WITH hours AS (
                    SELECT generate_series(0, 23) AS h
                ),
                outbound AS (
                    SELECT
                        EXTRACT(HOUR FROM weighing_time)::int AS h,
                        SUM(net_weight)::numeric AS qty
                    FROM swms_weighings
                    WHERE weighing_date = $1::date
                    AND direction = 'OUT'
                    AND ($2::text IS NULL OR site_id = $2::text)
                    GROUP BY EXTRACT(HOUR FROM weighing_time)::int
                )
                SELECT
                    LPAD(h.h::text, 2, '0') AS hour,
                    COALESCE(o.qty, 0)::numeric AS quantity
                FROM hours h
                LEFT JOIN outbound o ON o.h = h.h
                ORDER BY h.h
            `
            const { rows } = await pool.query(q, [date, siteId])
            res.json(rows.map(r => ({ hour: r.hour, quantity: Number(r.quantity || 0) })))
        } catch (e) {
            console.error('[SWMS dashboard] outbound-by-hour error:', e)
            res.status(500).json({ error: e.message })
        }
    })

    // GET /api/swms/dashboard/charts/portfolio?siteId&periodDays=30
    router.get('/dashboard/charts/portfolio', async (req, res) => {
        const siteId = req.query.siteId ? String(req.query.siteId) : null
        const periodDays = clampInt(req.query.periodDays, 1, 365, 30)

        try {
            const q = `
                WITH data AS (
                    SELECT
                        COALESCE(m.is_scrap, CASE
                            WHEN m.category ILIKE '%폐기%' OR m.category ILIKE '%waste%' THEN FALSE
                            ELSE TRUE
                        END) AS is_scrap,
                        SUM(o.quantity)::numeric AS qty
                    FROM swms_outbounds o
                    LEFT JOIN swms_material_types m ON m.id = o.material_type_id
                    WHERE o.outbound_date >= CURRENT_DATE - $1::int
                    AND ($2::text IS NULL OR o.site_id = $2::text)
                    GROUP BY COALESCE(m.is_scrap, CASE
                        WHEN m.category ILIKE '%폐기%' OR m.category ILIKE '%waste%' THEN FALSE
                        ELSE TRUE
                    END)
                )
                SELECT
                    CASE WHEN is_scrap THEN 'SCRAP' ELSE 'WASTE' END AS type,
                    COALESCE(qty,0)::numeric AS quantity
                FROM data
            `
            const { rows } = await pool.query(q, [periodDays, siteId])
            const result = [
                { type: 'SCRAP', quantity: 0 },
                { type: 'WASTE', quantity: 0 },
            ]
            for (const r of rows) {
                const idx = result.findIndex(x => x.type === r.type)
                if (idx >= 0) result[idx].quantity = Number(r.quantity || 0)
            }
            res.json(result)
        } catch (e) {
            console.error('[SWMS dashboard] portfolio error:', e)
            res.status(500).json({ error: e.message })
        }
    })

    // GET /api/swms/dashboard/charts/price-margin?siteId&periodDays=30
    router.get('/dashboard/charts/price-margin', async (req, res) => {
        const siteId = req.query.siteId ? String(req.query.siteId) : null
        const periodDays = clampInt(req.query.periodDays, 1, 365, 30)

        try {
            const q = `
                WITH series AS (
                    SELECT generate_series(CURRENT_DATE - $1::int, CURRENT_DATE, interval '1 day')::date AS d
                ),
                out_agg AS (
                    SELECT
                        o.outbound_date::date AS d,
                        AVG(o.unit_price)::numeric AS avg_price,
                        AVG((o.unit_price - COALESCE(m.unit_price, 0)))::numeric AS avg_margin
                    FROM swms_outbounds o
                    LEFT JOIN swms_material_types m ON m.id = o.material_type_id
                    WHERE o.outbound_date >= CURRENT_DATE - $1::int
                    AND ($2::text IS NULL OR o.site_id = $2::text)
                    GROUP BY o.outbound_date::date
                )
                SELECT
                    s.d::text AS date,
                    COALESCE(a.avg_price, 0)::numeric AS avg_price,
                    COALESCE(a.avg_margin, 0)::numeric AS avg_margin
                FROM series s
                LEFT JOIN out_agg a ON a.d = s.d
                ORDER BY s.d
            `
            const { rows } = await pool.query(q, [periodDays, siteId])
            res.json(rows.map(r => ({
                date: r.date,
                avgPrice: Number(r.avg_price || 0),
                avgMargin: Number(r.avg_margin || 0),
            })))
        } catch (e) {
            console.error('[SWMS dashboard] price-margin error:', e)
            res.status(500).json({ error: e.message })
        }
    })

    // GET /api/swms/dashboard/charts/flow?siteId&periodDays=30
    // Phase 1: Sankey 대신 "단계 축약" 막대 데이터 제공
    router.get('/dashboard/charts/flow', async (req, res) => {
        const siteId = req.query.siteId ? String(req.query.siteId) : null
        const periodDays = clampInt(req.query.periodDays, 1, 365, 30)

        try {
            const q = `
                WITH inbound AS (
                    SELECT COALESCE(SUM(quantity),0)::numeric AS qty
                    FROM swms_inbounds
                    WHERE inbound_date >= CURRENT_DATE - $1::int
                    AND ($2::text IS NULL OR site_id = $2::text)
                ),
                inventory AS (
                    SELECT COALESCE(SUM(quantity),0)::numeric AS qty
                    FROM swms_inventory
                    WHERE ($2::text IS NULL OR site_id = $2::text)
                ),
                outbound AS (
                    SELECT COALESCE(SUM(quantity),0)::numeric AS qty
                    FROM swms_outbounds
                    WHERE outbound_date >= CURRENT_DATE - $1::int
                    AND ($2::text IS NULL OR site_id = $2::text)
                ),
                settled AS (
                    SELECT COALESCE(SUM(quantity),0)::numeric AS qty
                    FROM swms_outbounds
                    WHERE outbound_date >= CURRENT_DATE - $1::int
                    AND status IN ('SETTLED')
                    AND ($2::text IS NULL OR site_id = $2::text)
                )
                SELECT
                    (SELECT qty FROM inbound) AS inbound_qty,
                    (SELECT qty FROM inventory) AS inventory_qty,
                    (SELECT qty FROM outbound) AS outbound_qty,
                    (SELECT qty FROM settled) AS settled_qty
            `
            const { rows } = await pool.query(q, [periodDays, siteId])
            const r = rows[0] || {}
            res.json([
                { stage: '입고', quantity: Number(r.inbound_qty || 0) },
                { stage: '보관(재고)', quantity: Number(r.inventory_qty || 0) },
                { stage: '출고', quantity: Number(r.outbound_qty || 0) },
                { stage: '정산(완료)', quantity: Number(r.settled_qty || 0) },
            ])
        } catch (e) {
            console.error('[SWMS dashboard] flow error:', e)
            res.status(500).json({ error: e.message })
        }
    })

    // GET /api/swms/dashboard/charts/inventory-heatmap?siteId&limit=50
    // Phase 1: 등급 미정 → material 단위 리스트 반환 (프론트에서 Heatmap 유사 표현)
    router.get('/dashboard/charts/inventory-heatmap', async (req, res) => {
        const siteId = req.query.siteId ? String(req.query.siteId) : null
        const limit = clampInt(req.query.limit, 1, 200, 50)

        try {
            const q = `
                SELECT
                    m.name AS material,
                    SUM(COALESCE(i.quantity,0))::numeric AS quantity
                FROM swms_inventory i
                LEFT JOIN swms_material_types m ON m.id = i.material_type_id
                WHERE ($1::text IS NULL OR i.site_id = $1::text)
                GROUP BY m.id, m.name
                ORDER BY SUM(COALESCE(i.quantity,0)) DESC
                LIMIT $2::int
            `
            const { rows } = await pool.query(q, [siteId, limit])
            res.json(rows.map(r => ({
                material: r.material || 'Unknown',
                grade: 'N/A',
                quantity: Number(r.quantity || 0),
            })))
        } catch (e) {
            console.error('[SWMS dashboard] inventory-heatmap error:', e)
            res.status(500).json({ error: e.message })
        }
    })

    // GET /api/swms/dashboard/work-queue?siteId&date=YYYY-MM-DD
    router.get('/dashboard/work-queue', async (req, res) => {
        const siteId = req.query.siteId ? String(req.query.siteId) : null
        const date = req.query.date ? String(req.query.date) : new Date().toISOString().slice(0, 10)

        try {
            const qOut = `
                SELECT
                    o.id,
                    o.outbound_date,
                    o.quantity,
                    o.status,
                    o.unit_price,
                    o.total_amount,
                    o.vendor_id,
                    v.name AS vendor_name,
                    m.name AS material_name
                FROM swms_outbounds o
                LEFT JOIN swms_vendors v ON v.id = o.vendor_id
                LEFT JOIN swms_material_types m ON m.id = o.material_type_id
                WHERE o.outbound_date = $1::date
                AND o.status IN ('PENDING')
                AND ($2::text IS NULL OR o.site_id = $2::text)
                ORDER BY o.created_at DESC
                LIMIT 50
            `
            const qIn = `
                SELECT
                    i.id,
                    i.inbound_date,
                    i.quantity,
                    i.status,
                    i.vendor_id,
                    v.name AS vendor_name,
                    m.name AS material_name
                FROM swms_inbounds i
                LEFT JOIN swms_vendors v ON v.id = i.vendor_id
                LEFT JOIN swms_material_types m ON m.id = i.material_type_id
                WHERE i.inbound_date = $1::date
                AND (i.inspection_status IS NULL OR i.inspection_status = '')
                AND ($2::text IS NULL OR i.site_id = $2::text)
                ORDER BY i.created_at DESC
                LIMIT 50
            `
            const qSettle = `
                SELECT
                    s.id,
                    s.start_date,
                    s.end_date,
                    s.status,
                    s.total_amount,
                    s.tax_invoice_no,
                    s.vendor_id,
                    v.name AS vendor_name
                FROM swms_settlements s
                LEFT JOIN swms_vendors v ON v.id = s.vendor_id
                WHERE s.status IN ('DRAFT')
                AND ($1::text IS NULL OR s.site_id = $1::text)
                ORDER BY s.created_at DESC
                LIMIT 50
            `

            const [outRes, inRes, settleRes] = await Promise.all([
                pool.query(qOut, [date, siteId]),
                pool.query(qIn, [date, siteId]),
                pool.query(qSettle, [siteId]),
            ])

            res.json({
                date,
                siteId,
                outboundPlanned: outRes.rows,
                inspectionWaiting: inRes.rows,
                settlementWaiting: settleRes.rows,
            })
        } catch (e) {
            console.error('[SWMS dashboard] work-queue error:', e)
            res.status(500).json({ error: e.message })
        }
    })

    // GET /api/swms/dashboard/risk?siteId&periodDays=30
    router.get('/dashboard/risk', async (req, res) => {
        const siteId = req.query.siteId ? String(req.query.siteId) : null
        const periodDays = clampInt(req.query.periodDays, 1, 365, 30)

        try {
            const q = `
                WITH anomalies AS (
                    SELECT
                        COUNT(*)::int AS total,
                        COUNT(*) FILTER (WHERE severity='critical')::int AS critical,
                        COUNT(*) FILTER (WHERE severity='warn')::int AS warn
                    FROM swms_anomalies
                    WHERE detected_at >= NOW() - ($1::int || ' days')::interval
                    AND ($2::text IS NULL OR site_id = $2::text)
                ),
                negative_inventory AS (
                    SELECT COUNT(*)::int AS cnt
                    FROM swms_inventory
                    WHERE quantity < 0
                    AND ($2::text IS NULL OR site_id = $2::text)
                ),
                allbaro AS (
                    SELECT
                        COUNT(*) FILTER (WHERE sync_status='FAILED')::int AS failed,
                        COUNT(*) FILTER (WHERE sync_status='PENDING')::int AS pending
                    FROM swms_allbaro_sync
                    WHERE ($2::text IS NULL OR site_id = $2::text)
                )
                SELECT
                    (SELECT total FROM anomalies) AS anomalies_total,
                    (SELECT critical FROM anomalies) AS anomalies_critical,
                    (SELECT warn FROM anomalies) AS anomalies_warn,
                    (SELECT cnt FROM negative_inventory) AS negative_inventory_count,
                    (SELECT failed FROM allbaro) AS allbaro_failed,
                    (SELECT pending FROM allbaro) AS allbaro_pending
            `
            const { rows } = await pool.query(q, [periodDays, siteId])
            const r = rows[0] || {}
            res.json({
                siteId,
                periodDays,
                anomalies: {
                    total: Number(r.anomalies_total || 0),
                    critical: Number(r.anomalies_critical || 0),
                    warn: Number(r.anomalies_warn || 0),
                },
                negativeInventoryCount: Number(r.negative_inventory_count || 0),
                allbaro: {
                    failed: Number(r.allbaro_failed || 0),
                    pending: Number(r.allbaro_pending || 0),
                },
                sla: {
                    status: 'todo',
                },
            })
        } catch (e) {
            console.error('[SWMS dashboard] risk error:', e)
            res.status(500).json({ error: e.message })
        }
    })

    return router
}
