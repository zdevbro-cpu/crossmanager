const express = require('express')
const { requireRole } = require('../middleware/auth')
const { computeHealth } = require('../services/dashboard')

function createDashboardRouter(pool) {
    const router = express.Router()

    // Exec Summary: 전체/등급별/강제 Red 현황
    router.get('/executive/summary', requireRole(['executive', 'admin']), async (_req, res) => {
        try {
            const query = `
                WITH latest AS (
                    SELECT DISTINCT ON (project_id)
                        project_id, score_total, grade, forced_red
                    FROM dashboard.health_daily
                    ORDER BY project_id, calc_date DESC, updated_at DESC
                )
                SELECT
                    COUNT(*) AS total,
                    COUNT(*) FILTER (WHERE grade = 'RED' OR forced_red) AS red_count,
                    COUNT(*) FILTER (WHERE grade = 'ORANGE') AS orange_count,
                    COUNT(*) FILTER (WHERE grade = 'YELLOW') AS yellow_count,
                    COUNT(*) FILTER (WHERE grade = 'GREEN') AS green_count
                FROM latest;
            `
            const { rows } = await pool.query(query)
            res.json(rows[0] || {
                total: 0, red_count: 0, orange_count: 0, yellow_count: 0, green_count: 0
            })
        } catch (err) {
            console.error('[dashboard] executive/summary error:', err)
            res.status(500).json({ error: 'Failed to load executive summary' })
        }
    })

    // Exec Top Risk Projects
    router.get('/executive/projects/top-risk', requireRole(['executive', 'admin']), async (req, res) => {
        const limit = Math.min(Number(req.query.limit) || 5, 20)
        try {
            const query = `
                WITH latest AS (
                    SELECT DISTINCT ON (project_id)
                        project_id, score_total, grade, forced_red, top_reasons, calc_date, updated_at
                    FROM dashboard.health_daily
                    ORDER BY project_id, calc_date DESC, updated_at DESC
                )
                SELECT project_id, score_total, grade, forced_red, top_reasons, calc_date, updated_at
                FROM latest
                ORDER BY (grade = 'RED' OR forced_red) DESC, score_total ASC
                LIMIT $1;
            `
            const { rows } = await pool.query(query, [limit])
            res.json(rows)
        } catch (err) {
            console.error('[dashboard] executive/projects/top-risk error:', err)
            res.status(500).json({ error: 'Failed to load top risk projects' })
        }
    })

    // Operations: project health + risks + alerts
    router.get('/operations/project/:id/health', requireRole(['executive', 'admin', 'manager', 'pm']), async (req, res) => {
        const { id } = req.params
        try {
            const healthSql = `
                SELECT *
                FROM dashboard.health_daily
                WHERE project_id = $1
                ORDER BY calc_date DESC, updated_at DESC
                LIMIT 1
            `
            const risksSql = `
                SELECT * FROM dashboard.risks
                WHERE project_id = $1
                ORDER BY calc_date DESC, created_at DESC
                LIMIT 20
            `
            const alertsSql = `
                SELECT * FROM dashboard.alerts
                WHERE project_id = $1 AND status IN ('open','ack')
                ORDER BY created_at DESC
                LIMIT 20
            `
            const [health, risks, alerts] = await Promise.all([
                pool.query(healthSql, [id]),
                pool.query(risksSql, [id]),
                pool.query(alertsSql, [id]),
            ])

            res.json({
                health: health.rows[0] || null,
                risks: risks.rows,
                alerts: alerts.rows,
            })
        } catch (err) {
            console.error('[dashboard] operations project health error:', err)
            res.status(500).json({ error: 'Failed to load project health' })
        }
    })

    // Admin/Batch: upsert health record from incoming metrics
    router.post('/admin/health', requireRole(['admin']), async (req, res) => {
        const {
            project_id,
            calc_date,
            metrics = {},
            weights = {},
            top_reasons = [],
            data_quality_flag = {},
        } = req.body || {}

        if (!project_id || !calc_date) {
            return res.status(400).json({ error: 'project_id and calc_date are required' })
        }

        try {
            const scores = computeHealth(metrics, weights)
            const upsert = `
                INSERT INTO dashboard.health_daily (
                    project_id, calc_date,
                    score_total, score_schedule, score_safety, score_cost, score_resource, score_quality,
                    grade, forced_red, top_reasons, data_quality_flag, created_at, updated_at
                )
                VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,NOW(),NOW())
                ON CONFLICT (project_id, calc_date) DO UPDATE SET
                    score_total = EXCLUDED.score_total,
                    score_schedule = EXCLUDED.score_schedule,
                    score_safety = EXCLUDED.score_safety,
                    score_cost = EXCLUDED.score_cost,
                    score_resource = EXCLUDED.score_resource,
                    score_quality = EXCLUDED.score_quality,
                    grade = EXCLUDED.grade,
                    forced_red = EXCLUDED.forced_red,
                    top_reasons = EXCLUDED.top_reasons,
                    data_quality_flag = EXCLUDED.data_quality_flag,
                    updated_at = NOW()
                RETURNING *
            `
            const params = [
                project_id,
                calc_date,
                scores.score_total,
                scores.score_schedule,
                scores.score_safety,
                scores.score_cost,
                scores.score_resource,
                scores.score_quality,
                scores.grade,
                scores.forced_red,
                JSON.stringify(top_reasons || []),
                JSON.stringify(data_quality_flag || {}),
            ]
            const { rows } = await pool.query(upsert, params)
            res.json(rows[0])
        } catch (err) {
            console.error('[dashboard] admin/health upsert error:', err)
            res.status(500).json({ error: 'Failed to upsert health record' })
        }
    })

    // Admin/Batch: bulk upsert health records [{ project_id, calc_date, metrics, weights, top_reasons, data_quality_flag }]
    router.post('/admin/health/bulk', requireRole(['admin']), async (req, res) => {
        const items = Array.isArray(req.body) ? req.body : []
        if (!items.length) return res.status(400).json({ error: 'array body required' })

        const client = await pool.connect()
        try {
            await client.query('BEGIN')
            const results = []
            for (const item of items) {
                const {
                    project_id,
                    calc_date,
                    metrics = {},
                    weights = {},
                    top_reasons = [],
                    data_quality_flag = {},
                } = item || {}
                if (!project_id || !calc_date) continue
                const scores = computeHealth(metrics, weights)
                const upsert = `
                    INSERT INTO dashboard.health_daily (
                        project_id, calc_date,
                        score_total, score_schedule, score_safety, score_cost, score_resource, score_quality,
                        grade, forced_red, top_reasons, data_quality_flag, created_at, updated_at
                    )
                    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,NOW(),NOW())
                    ON CONFLICT (project_id, calc_date) DO UPDATE SET
                        score_total = EXCLUDED.score_total,
                        score_schedule = EXCLUDED.score_schedule,
                        score_safety = EXCLUDED.score_safety,
                        score_cost = EXCLUDED.score_cost,
                        score_resource = EXCLUDED.score_resource,
                        score_quality = EXCLUDED.score_quality,
                        grade = EXCLUDED.grade,
                        forced_red = EXCLUDED.forced_red,
                        top_reasons = EXCLUDED.top_reasons,
                        data_quality_flag = EXCLUDED.data_quality_flag,
                        updated_at = NOW()
                    RETURNING *
                `
                const params = [
                    project_id,
                    calc_date,
                    scores.score_total,
                    scores.score_schedule,
                    scores.score_safety,
                    scores.score_cost,
                    scores.score_resource,
                    scores.score_quality,
                    scores.grade,
                    scores.forced_red,
                    JSON.stringify(top_reasons || []),
                    JSON.stringify(data_quality_flag || {}),
                ]
                const { rows } = await client.query(upsert, params)
                if (rows[0]) results.push(rows[0])
            }
            await client.query('COMMIT')
            res.json({ inserted: results.length, items: results })
        } catch (err) {
            await client.query('ROLLBACK')
            console.error('[dashboard] admin/health bulk error:', err)
            res.status(500).json({ error: 'Failed bulk upsert' })
        } finally {
            client.release()
        }
    })

    // Admin/Batch: insert risks in bulk
    router.post('/admin/risks/bulk', requireRole(['admin']), async (req, res) => {
        const items = Array.isArray(req.body) ? req.body : []
        if (!items.length) return res.status(400).json({ error: 'array body required' })
        const client = await pool.connect()
        try {
            await client.query('BEGIN')
            const results = []
            for (const item of items) {
                const {
                    project_id,
                    calc_date,
                    risk_type,
                    title,
                    severity = 'warn',
                    metrics = {},
                } = item || {}
                if (!project_id || !calc_date || !risk_type || !title) continue
                const insert = `
                    INSERT INTO dashboard.risks (
                        project_id, calc_date, risk_type, title, severity, metrics, created_at
                    ) VALUES ($1,$2,$3,$4,$5,$6,NOW())
                    RETURNING *
                `
                const { rows } = await client.query(insert, [
                    project_id,
                    calc_date,
                    risk_type,
                    title,
                    severity,
                    JSON.stringify(metrics || {}),
                ])
                if (rows[0]) results.push(rows[0])
            }
            await client.query('COMMIT')
            res.json({ inserted: results.length, items: results })
        } catch (err) {
            await client.query('ROLLBACK')
            console.error('[dashboard] admin/risks bulk error:', err)
            res.status(500).json({ error: 'Failed bulk insert risks' })
        } finally {
            client.release()
        }
    })

    // Admin/Batch: insert alerts in bulk
    router.post('/admin/alerts/bulk', requireRole(['admin']), async (req, res) => {
        const items = Array.isArray(req.body) ? req.body : []
        if (!items.length) return res.status(400).json({ error: 'array body required' })
        const client = await pool.connect()
        try {
            await client.query('BEGIN')
            const results = []
            for (const item of items) {
                const {
                    project_id,
                    alert_type,
                    title,
                    detail = null,
                    status = 'open',
                    severity = 'warn',
                    action_url = null,
                } = item || {}
                if (!project_id || !alert_type || !title) continue
                const insert = `
                    INSERT INTO dashboard.alerts (
                        project_id, alert_type, title, detail, status, severity, action_url, created_at, updated_at
                    ) VALUES ($1,$2,$3,$4,$5,$6,$7,NOW(),NOW())
                    RETURNING *
                `
                const { rows } = await client.query(insert, [
                    project_id,
                    alert_type,
                    title,
                    detail,
                    status,
                    severity,
                    action_url,
                ])
                if (rows[0]) results.push(rows[0])
            }
            await client.query('COMMIT')
            res.json({ inserted: results.length, items: results })
        } catch (err) {
            await client.query('ROLLBACK')
            console.error('[dashboard] admin/alerts bulk error:', err)
            res.status(500).json({ error: 'Failed bulk insert alerts' })
        } finally {
            client.release()
        }
    })

    return router
}

module.exports = { createDashboardRouter }
