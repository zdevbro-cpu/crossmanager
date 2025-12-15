const express = require('express')
const router = express.Router()

/**
 * Simple merge helper for override patches.
 */
function mergeArray(base, patch) {
    const { add = [], remove = [], replace } = patch || {}
    if (Array.isArray(replace)) return [...replace]
    const set = new Set(base || [])
    add.forEach((v) => set.add(v))
    remove.forEach((v) => set.delete(v))
    return Array.from(set)
}

/**
 * Apply override patches (project -> site -> permit)
 */
function applyOverrides(baseRule, overrides) {
    const rule = { ...baseRule }
    for (const ov of overrides) {
        const p = ov.patch_json || {}
        rule.required_certs_all = mergeArray(rule.required_certs_all, {
            add: p.required_certs_all_add,
            remove: p.required_certs_all_remove,
            replace: p.required_certs_all_replace
        })
        rule.required_certs_any = mergeArray(rule.required_certs_any, {
            add: p.required_certs_any_add,
            remove: p.required_certs_any_remove,
            replace: p.required_certs_any_replace
        })
        rule.required_trainings_all = mergeArray(rule.required_trainings_all, {
            add: p.required_trainings_all_add,
            remove: p.required_trainings_all_remove,
            replace: p.required_trainings_all_replace
        })
        rule.required_trainings_any = mergeArray(rule.required_trainings_any, {
            add: p.required_trainings_any_add,
            remove: p.required_trainings_any_remove,
            replace: p.required_trainings_any_replace
        })

        if (p.enforcement_mode_replace) {
            rule.enforcement = rule.enforcement || {}
            rule.enforcement.mode = p.enforcement_mode_replace
        }
    }
    return rule
}

module.exports = (pool) => {
    // GET /api/pms/resource/work-types
    router.get('/work-types', async (req, res) => {
        try {
            const result = await pool.query(
                `SELECT code, group_code, name, required_certs_all, required_certs_any,
                        required_trainings_all, required_trainings_any, enforcement, active_flag
                 FROM work_type
                 WHERE active_flag = true
                 ORDER BY group_code, code`
            )
            res.json(result.rows)
        } catch (err) {
            console.error('[PMS] work-types fetch error', err)
            res.status(500).json({ error: 'Failed to fetch work types' })
        }
    })

    // POST /api/pms/resource/people
    router.post('/people', async (req, res) => {
        try {
            const { name, contact, status = 'active', role_tags = [] } = req.body
            const result = await pool.query(
                `INSERT INTO person (name, contact, status, role_tags)
                 VALUES ($1, $2, $3, $4)
                 RETURNING *`,
                [name, contact, status, role_tags]
            )
            res.json(result.rows[0])
        } catch (err) {
            console.error('[PMS] create person error', err)
            res.status(500).json({ error: 'Failed to create person' })
        }
    })

    // PATCH /api/pms/resource/people/:id
    router.patch('/people/:id', async (req, res) => {
        try {
            const { id } = req.params
            const { name, contact, status, role_tags } = req.body
            const result = await pool.query(
                `UPDATE person
                 SET name = COALESCE($1, name),
                     contact = COALESCE($2, contact),
                     status = COALESCE($3, status),
                     role_tags = COALESCE($4, role_tags),
                     updated_at = now()
                 WHERE id = $5
                 RETURNING *`,
                [name, contact, status, role_tags, id]
            )
            if (result.rowCount === 0) return res.status(404).json({ error: 'Person not found' })
            res.json(result.rows[0])
        } catch (err) {
            console.error('[PMS] update person error', err)
            res.status(500).json({ error: 'Failed to update person' })
        }
    })

    // POST /api/pms/resource/people/:id/certs
    router.post('/people/:id/certs', async (req, res) => {
        try {
            const { id } = req.params
            const { cert_code, issued_at, expires_at, evidence_uri, status = 'pending' } = req.body
            const result = await pool.query(
                `INSERT INTO person_cert (person_id, cert_code, issued_at, expires_at, evidence_uri, status)
                 VALUES ($1, $2, $3, $4, $5, $6)
                 ON CONFLICT (person_id, cert_code, expires_at) DO UPDATE SET
                    evidence_uri = EXCLUDED.evidence_uri,
                    status = EXCLUDED.status
                 RETURNING *`,
                [id, cert_code, issued_at, expires_at, evidence_uri, status]
            )
            res.json(result.rows[0])
        } catch (err) {
            console.error('[PMS] upsert person_cert error', err)
            res.status(500).json({ error: 'Failed to upsert person cert' })
        }
    })

    // POST /api/pms/resource/people/:id/trainings
    router.post('/people/:id/trainings', async (req, res) => {
        try {
            const { id } = req.params
            const { training_code, taken_at, expires_at, evidence_uri, status = 'pending' } = req.body
            const result = await pool.query(
                `INSERT INTO person_training (person_id, training_code, taken_at, expires_at, evidence_uri, status)
                 VALUES ($1, $2, $3, $4, $5, $6)
                 ON CONFLICT (person_id, training_code, expires_at) DO UPDATE SET
                    evidence_uri = EXCLUDED.evidence_uri,
                    status = EXCLUDED.status
                 RETURNING *`,
                [id, training_code, taken_at, expires_at, evidence_uri, status]
            )
            res.json(result.rows[0])
        } catch (err) {
            console.error('[PMS] upsert person_training error', err)
            res.status(500).json({ error: 'Failed to upsert person training' })
        }
    })

    // POST /api/pms/resource/eligibility/override
    router.post('/eligibility/override', async (req, res) => {
        try {
            const { scope = 'project', scope_ref, work_type_code, patch, approved_by, reason } = req.body
            const result = await pool.query(
                `INSERT INTO override (scope, scope_ref, work_type_code, patch_json, approved_by, approved_at, reason)
                 VALUES ($1, $2, $3, $4, $5, now(), $6)
                 RETURNING *`,
                [scope, scope_ref, work_type_code, patch || {}, approved_by || null, reason || null]
            )
            res.json(result.rows[0])
        } catch (err) {
            console.error('[PMS] create override error', err)
            res.status(500).json({ error: 'Failed to create override' })
        }
    })

    // POST /api/pms/resource/eligibility/check
    router.post('/eligibility/check', async (req, res) => {
        try {
            const { project_id, date, work_type_code, assignees = [] } = req.body
            const refDate = date ? new Date(date) : new Date()

            const wtResult = await pool.query(
                `SELECT code, required_certs_all, required_certs_any,
                        required_trainings_all, required_trainings_any,
                        enforcement
                 FROM work_type
                 WHERE code = $1`,
                [work_type_code]
            )
            if (wtResult.rowCount === 0) return res.status(404).json({ error: 'Work type not found' })
            const baseRule = wtResult.rows[0]

            const ovResult = await pool.query(
                `SELECT patch_json FROM override
                 WHERE work_type_code = $1
                   AND active_flag = true
                   AND scope = 'project'
                   AND scope_ref = $2
                 ORDER BY approved_at ASC NULLS LAST, created_at ASC`,
                [work_type_code, project_id]
            )
            const mergedRule = applyOverrides(baseRule, ovResult.rows)
            const enforcementMode = (mergedRule.enforcement && mergedRule.enforcement.mode) || 'WARN'

            const assigneeResults = []
            for (const userId of assignees) {
                const certs = await pool.query(
                    `SELECT cert_code, status, expires_at FROM person_cert WHERE person_id = $1`,
                    [userId]
                )
                const trainings = await pool.query(
                    `SELECT training_code, status, expires_at FROM person_training WHERE person_id = $1`,
                    [userId]
                )

                const certMap = new Map()
                certs.rows.forEach((c) => certMap.set(c.cert_code, c))
                const trnMap = new Map()
                trainings.rows.forEach((t) => trnMap.set(t.training_code, t))

                const missing_certs = []
                const missing_trainings = []
                const expiring_soon = []

                const checkCert = (code) => {
                    const row = certMap.get(code)
                    if (!row) { missing_certs.push(code); return }
                    if (row.status !== 'verified') { missing_certs.push(code); return }
                    if (row.expires_at && new Date(row.expires_at) < refDate) { missing_certs.push(code); return }
                    // expiring soon
                    if (row.expires_at) {
                        const diff = (new Date(row.expires_at).getTime() - refDate.getTime()) / (1000 * 60 * 60 * 24)
                        if (diff <= 90) expiring_soon.push(`${code}:D-${Math.max(0, Math.floor(diff))}`)
                    }
                }
                const checkTraining = (code) => {
                    const row = trnMap.get(code)
                    if (!row) { missing_trainings.push(code); return }
                    if (row.status !== 'verified') { missing_trainings.push(code); return }
                    if (row.expires_at && new Date(row.expires_at) < refDate) { missing_trainings.push(code); return }
                    if (row.expires_at) {
                        const diff = (new Date(row.expires_at).getTime() - refDate.getTime()) / (1000 * 60 * 60 * 24)
                        if (diff <= 60) expiring_soon.push(`${code}:D-${Math.max(0, Math.floor(diff))}`)
                    }
                }

                // all/any checks
                for (const c of mergedRule.required_certs_all || []) checkCert(c)
                if ((mergedRule.required_certs_any || []).length > 0) {
                    const anyOk = (mergedRule.required_certs_any || []).some((c) => {
                        const row = certMap.get(c)
                        return row && row.status === 'verified' && (!row.expires_at || new Date(row.expires_at) >= refDate)
                    })
                    if (!anyOk) missing_certs.push(`any_of:${(mergedRule.required_certs_any || []).join(',')}`)
                }

                for (const t of mergedRule.required_trainings_all || []) checkTraining(t)
                if ((mergedRule.required_trainings_any || []).length > 0) {
                    const anyOk = (mergedRule.required_trainings_any || []).some((t) => {
                        const row = trnMap.get(t)
                        return row && row.status === 'verified' && (!row.expires_at || new Date(row.expires_at) >= refDate)
                    })
                    if (!anyOk) missing_trainings.push(`any_of:${(mergedRule.required_trainings_any || []).join(',')}`)
                }

                const eligible = missing_certs.length === 0 && missing_trainings.length === 0
                assigneeResults.push({
                    user_id: userId,
                    eligible,
                    missing_certs,
                    missing_trainings,
                    expiring_soon
                })
            }

            const teamEligible = assigneeResults.every((a) => a.eligible)
            const response = {
                work_type_code,
                eligible: enforcementMode === 'BLOCK' ? teamEligible : teamEligible,
                assignee_results: assigneeResults,
                rule_trace: {
                    base_rule: work_type_code,
                    enforcement: enforcementMode,
                    overrides_applied: ovResult.rows.length
                }
            }
            res.json(response)
        } catch (err) {
            console.error('[PMS] eligibility check error', err)
            res.status(500).json({ error: 'Failed to evaluate eligibility' })
        }
    })

    return router
}
