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

    // GET /api/swms/dashboard/debug/summary?siteId
    // 배포 환경에서 "0" 또는 "Market data is empty" 원인(사이트ID/샘플데이터/매핑)을 빠르게 확인하기 위한 진단용.
    router.get('/dashboard/debug/summary', async (req, res) => {
        const siteId = req.query.siteId ? String(req.query.siteId) : null
        const today = new Date().toISOString().slice(0, 10)

        try {
            const q = `
                SELECT
                    (SELECT COUNT(*)::int FROM swms_inbounds  WHERE ($1::text IS NULL OR site_id::text = $1::text)) AS inbounds_total,
                    (SELECT COUNT(*)::int FROM swms_outbounds WHERE ($1::text IS NULL OR site_id::text = $1::text)) AS outbounds_total,
                    (SELECT COUNT(*)::int FROM swms_weighings WHERE ($1::text IS NULL OR site_id::text = $1::text)) AS weighings_total,
                    (SELECT COUNT(*)::int FROM swms_inventory WHERE ($1::text IS NULL OR site_id::text = $1::text)) AS inventory_rows,
                    (SELECT COUNT(*)::int FROM swms_process_events WHERE ($1::text IS NULL OR site_id::text = $1::text)) AS process_events_total,
                    (SELECT COUNT(*)::int FROM swms_market_symbol_map) AS market_symbol_map_rows,
                    (SELECT COUNT(*)::int FROM swms_market_prices_daily WHERE price_date = $2::date) AS market_prices_today_rows,
                    (SELECT COUNT(*)::int FROM swms_pricing_coefficients WHERE ($1::text IS NULL AND site_id IS NULL) OR site_id::text = $1::text) AS pricing_coeff_rows,
                    (SELECT COUNT(*)::int FROM swms_pricing_decisions WHERE ($1::text IS NULL OR site_id::text = $1::text)) AS pricing_decisions_rows
            `
            const r = (await pool.query(q, [siteId, today])).rows?.[0] || {}

            const distinct = async (table) => {
                try {
                    const { rows } = await pool.query(`SELECT DISTINCT site_id::text AS site_id FROM ${table} ORDER BY site_id::text LIMIT 20`)
                    return rows.map(x => x.site_id)
                } catch {
                    return []
                }
            }

            res.json({
                siteId,
                today,
                counts: {
                    inboundsTotal: Number(r.inbounds_total || 0),
                    outboundsTotal: Number(r.outbounds_total || 0),
                    weighingsTotal: Number(r.weighings_total || 0),
                    inventoryRows: Number(r.inventory_rows || 0),
                    processEventsTotal: Number(r.process_events_total || 0),
                    marketSymbolMapRows: Number(r.market_symbol_map_rows || 0),
                    marketPricesTodayRows: Number(r.market_prices_today_rows || 0),
                    pricingCoeffRows: Number(r.pricing_coeff_rows || 0),
                    pricingDecisionsRows: Number(r.pricing_decisions_rows || 0),
                },
                distinctSiteIds: {
                    inbounds: await distinct('swms_inbounds'),
                    outbounds: await distinct('swms_outbounds'),
                    inventory: await distinct('swms_inventory'),
                    weighings: await distinct('swms_weighings'),
                    processEvents: await distinct('swms_process_events'),
                    pricingCoefficients: (() => null)(),
                },
                hint:
                    'counts가 0이면 해당 siteId로 데이터가 없거나(siteId 불일치) 샘플 시드가 실행되지 않은 상태일 수 있습니다. /api/swms/sites/my로 내려오는 siteId와 DB site_id가 일치하는지 확인하세요.',
            })
        } catch (e) {
            console.error('[SWMS dashboard] debug summary error:', e)
            res.status(500).json({ error: e.message })
        }
    })

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

    // GET /api/swms/dashboard/charts/sankey?siteId&periodDays=30&mode=status|category|material
    // Phase 1+: swms_process_events 기반 (입고→선별→보관(Zone)→출고→정산)
    router.get('/dashboard/charts/sankey', async (req, res) => {
        const siteId = req.query.siteId ? String(req.query.siteId) : null
        const periodDays = clampInt(req.query.periodDays, 1, 365, 30)
        const mode = req.query.mode ? String(req.query.mode) : 'status'
        const maxZones = clampInt(req.query.maxZones, 1, 50, 9)
        const sortThresholdHours = clampInt(req.query.sortThresholdHours, 1, 240, 24)

        try {
            const q = `
                SELECT
                    e.from_stage,
                    e.to_stage,
                    COALESCE(e.quantity,0)::numeric AS quantity,
                    e.grade,
                    e.warehouse_id,
                    w.name AS warehouse_name,
                    m.name AS material_name,
                    m.category AS material_category
                FROM swms_process_events e
                LEFT JOIN swms_warehouses w ON w.id = e.warehouse_id
                LEFT JOIN swms_material_types m ON m.id = e.material_type_id
                WHERE e.occurred_at >= NOW() - ($1::int || ' days')::interval
                AND ($2::text IS NULL OR e.site_id = $2::text)
                AND (e.warehouse_id IS NULL OR w.id IS NOT NULL)
            `
            const { rows } = await pool.query(q, [periodDays, siteId])

            const stageLabel = (stage, row) => {
                if (stage === 'INBOUND') return '입고'
                if (stage === 'SORT') return '선별'
                if (stage === 'STORAGE') {
                    const wh = row.warehouse_name || row.warehouse_id || 'Zone'
                    return `보관:${wh}`
                }
                if (stage === 'OUTBOUND') return '출고'
                if (stage === 'SETTLEMENT_CONFIRMED') return '정산(확정)'
                if (stage === 'SETTLEMENT_PENDING') return '정산(대기)'
                if (stage === 'SETTLEMENT') return '정산'
                return String(stage || 'Unknown')
            }

            const dimensionSuffix = (row) => {
                const grade = row.grade ? String(row.grade) : 'A'
                if (mode === 'category') {
                    const cat = row.material_category ? String(row.material_category) : '미분류'
                    return `(${cat}/${grade})`
                }
                if (mode === 'material') {
                    const mat = row.material_name ? String(row.material_name) : 'Unknown'
                    return `(${mat}/${grade})`
                }
                return ''
            }

            const linkMap = new Map()
            for (const r of rows) {
                const src = stageLabel(r.from_stage, r) + dimensionSuffix(r)
                const dst = stageLabel(r.to_stage, r) + dimensionSuffix(r)
                const key = `${src}→${dst}`
                const prev = linkMap.get(key) || 0
                linkMap.set(key, prev + Number(r.quantity || 0))
            }

            const linkPairs = Array.from(linkMap.entries())
                .filter(([, v]) => Number(v) > 0)
                .map(([k, v]) => {
                    const [src, dst] = k.split('→')
                    return { sourceName: src, targetName: dst, value: Number(v) }
                })

            // Readability: if there are too many storage(Zone) nodes, keep top-N and group the rest into "보관:기타"
            const storageTotals = new Map()
            for (const l of linkPairs) {
                if (l.sourceName.startsWith('보관:')) {
                    storageTotals.set(l.sourceName, (storageTotals.get(l.sourceName) || 0) + l.value)
                }
                if (l.targetName.startsWith('보관:')) {
                    storageTotals.set(l.targetName, (storageTotals.get(l.targetName) || 0) + l.value)
                }
            }
            const storageNames = Array.from(storageTotals.entries())
                .sort((a, b) => b[1] - a[1])
                .map(([name]) => name)
            const keepStorage = new Set(storageNames.slice(0, maxZones))
            const shouldGroup = storageNames.length > maxZones

            const normalizedLinks = shouldGroup
                ? linkPairs.map((l) => ({
                    sourceName: l.sourceName.startsWith('보관:') && !keepStorage.has(l.sourceName) ? '보관:기타' : l.sourceName,
                    targetName: l.targetName.startsWith('보관:') && !keepStorage.has(l.targetName) ? '보관:기타' : l.targetName,
                    value: l.value,
                }))
                : linkPairs

            const mergedMap = new Map()
            for (const l of normalizedLinks) {
                const k = `${l.sourceName}→${l.targetName}`
                mergedMap.set(k, (mergedMap.get(k) || 0) + l.value)
            }
            const finalLinks = Array.from(mergedMap.entries()).map(([k, v]) => {
                const [sourceName, targetName] = k.split('→')
                return { sourceName, targetName, value: v }
            })

            const nodeIndex = new Map()
            const nodes = []
            const ensureNode = (name) => {
                if (nodeIndex.has(name)) return nodeIndex.get(name)
                const idx = nodes.length
                nodes.push({ name })
                nodeIndex.set(name, idx)
                return idx
            }

            const links = finalLinks.map((l) => ({
                source: ensureNode(l.sourceName),
                target: ensureNode(l.targetName),
                value: l.value,
            }))

            // Bottleneck signal (Phase 2-ish): Sort average dwell time (hours)
            // Requires meta.flowId pairing between INBOUND→SORT and SORT→STORAGE events.
            let sortAvgHours = null
            let sortP90Hours = null
            let sortSamples = 0
            try {
                const qDwell = `
                    WITH sort_in AS (
                        SELECT
                            (e.meta->>'flowId') AS flow_id,
                            e.occurred_at AS t_in
                        FROM swms_process_events e
                        WHERE e.occurred_at >= NOW() - ($1::int || ' days')::interval
                        AND ($2::text IS NULL OR e.site_id = $2::text)
                        AND e.from_stage = 'INBOUND'
                        AND e.to_stage = 'SORT'
                        AND e.meta ? 'flowId'
                    ),
                    sort_out AS (
                        SELECT
                            (e.meta->>'flowId') AS flow_id,
                            e.occurred_at AS t_out
                        FROM swms_process_events e
                        WHERE e.occurred_at >= NOW() - ($1::int || ' days')::interval
                        AND ($2::text IS NULL OR e.site_id = $2::text)
                        AND e.from_stage = 'SORT'
                        AND e.to_stage = 'STORAGE'
                        AND e.meta ? 'flowId'
                    ),
                    pairs AS (
                        SELECT
                            i.flow_id,
                            EXTRACT(EPOCH FROM (o.t_out - i.t_in)) / 3600.0 AS hours
                        FROM sort_in i
                        JOIN sort_out o USING (flow_id)
                        WHERE o.t_out >= i.t_in
                    )
                    SELECT
                        COUNT(*)::int AS samples,
                        AVG(hours)::numeric AS avg_hours,
                        percentile_disc(0.9) WITHIN GROUP (ORDER BY hours) AS p90_hours
                    FROM pairs
                    WHERE hours IS NOT NULL
                    AND hours >= 0
                `
                const r2 = (await pool.query(qDwell, [periodDays, siteId])).rows?.[0] || {}
                sortSamples = Number(r2.samples || 0)
                sortAvgHours = r2.avg_hours === null || r2.avg_hours === undefined ? null : Number(r2.avg_hours)
                sortP90Hours = r2.p90_hours === null || r2.p90_hours === undefined ? null : Number(r2.p90_hours)
            } catch (e2) {
                // non-fatal: keep sankey working even if dwell cannot be computed
                console.warn('[SWMS dashboard] sankey sort dwell compute skipped:', e2?.message || e2)
            }

            const sortBottleneck =
                sortAvgHours === null
                    ? { avgHours: null, p90Hours: sortP90Hours, samples: sortSamples, thresholdHours: sortThresholdHours, isBottleneck: false }
                    : { avgHours: sortAvgHours, p90Hours: sortP90Hours, samples: sortSamples, thresholdHours: sortThresholdHours, isBottleneck: sortAvgHours >= sortThresholdHours }

            res.json({ siteId, periodDays, mode, maxZones, nodes, links, signals: { sortBottleneck } })
        } catch (e) {
            console.error('[SWMS dashboard] sankey error:', e)
            res.status(500).json({ error: e.message })
        }
    })

    // GET /api/swms/dashboard/charts/inventory-heatmap?siteId&limit=50
    // Phase 1+: 품목×등급(A/B/C) 기반 (grade 컬럼이 없거나 비어있으면 A로 수렴)
    router.get('/dashboard/charts/inventory-heatmap', async (req, res) => {
        const siteId = req.query.siteId ? String(req.query.siteId) : null
        const limit = clampInt(req.query.limit, 1, 200, 50)

        try {
            const q = `
                SELECT
                    m.name AS material,
                    COALESCE(NULLIF(i.grade,''),'A') AS grade,
                    SUM(COALESCE(i.quantity,0))::numeric AS quantity
                FROM swms_inventory i
                LEFT JOIN swms_material_types m ON m.id = i.material_type_id
                WHERE ($1::text IS NULL OR i.site_id = $1::text)
                GROUP BY m.id, m.name, COALESCE(NULLIF(i.grade,''),'A')
                ORDER BY SUM(COALESCE(i.quantity,0)) DESC, m.name ASC
                LIMIT $2::int
            `
            const { rows } = await pool.query(q, [siteId, limit])
            res.json(rows.map(r => ({
                material: r.material || 'Unknown',
                grade: r.grade || 'A',
                quantity: Number(r.quantity || 0),
            })))
        } catch (e) {
            console.error('[SWMS dashboard] inventory-heatmap error:', e)
            res.status(500).json({ error: e.message })
        }
    })

    // GET /api/swms/dashboard/charts/inventory-zone-heatmap?siteId&view=capacity|aging
    router.get('/dashboard/charts/inventory-zone-heatmap', async (req, res) => {
        const siteId = req.query.siteId ? String(req.query.siteId) : null
        const view = req.query.view ? String(req.query.view) : 'capacity'

        try {
            const q = `
                WITH inv AS (
                    SELECT warehouse_id, COALESCE(SUM(quantity),0)::numeric AS qty
                    FROM swms_inventory
                    WHERE ($1::text IS NULL OR site_id = $1::text)
                    GROUP BY warehouse_id
                ),
                aging AS (
                    -- MVP proxy: warehouse별 최소 입고일(최근 180일 내 발생한 입고 기준)
                    SELECT
                        warehouse_id,
                        MIN(inbound_date)::date AS min_inbound_date
                    FROM swms_inbounds
                    WHERE inbound_date >= CURRENT_DATE - 180
                    AND ($1::text IS NULL OR site_id = $1::text)
                    GROUP BY warehouse_id
                )
                SELECT
                    w.id AS warehouse_id,
                    w.name AS warehouse_name,
                    w.type AS warehouse_type,
                    w.capacity::numeric AS capacity,
                    COALESCE(w.unit,'톤') AS unit,
                    COALESCE(i.qty,0)::numeric AS quantity,
                    CASE
                        WHEN w.capacity IS NULL OR w.capacity = 0 THEN NULL
                        ELSE (COALESCE(i.qty,0) / w.capacity) * 100
                    END AS fill_rate_pct,
                    CASE
                        WHEN a.min_inbound_date IS NULL THEN NULL
                        ELSE (CURRENT_DATE - a.min_inbound_date)::int
                    END AS max_age_days
                FROM swms_warehouses w
                LEFT JOIN inv i ON i.warehouse_id = w.id
                LEFT JOIN aging a ON a.warehouse_id = w.id
                WHERE ($1::text IS NULL OR w.site_id = $1::text)
                ORDER BY w.name ASC
            `
            const { rows } = await pool.query(q, [siteId])
            res.json({
                siteId,
                view,
                zones: rows.map((r) => ({
                    warehouseId: r.warehouse_id,
                    warehouseName: r.warehouse_name || 'Zone',
                    type: r.warehouse_type || null,
                    unit: r.unit || '톤',
                    capacity: r.capacity === null ? null : Number(r.capacity),
                    quantity: Number(r.quantity || 0),
                    fillRatePct: r.fill_rate_pct === null ? null : Number(r.fill_rate_pct),
                    maxAgeDays: r.max_age_days === null ? null : Number(r.max_age_days),
                })),
            })
        } catch (e) {
            console.error('[SWMS dashboard] inventory-zone-heatmap error:', e)
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
