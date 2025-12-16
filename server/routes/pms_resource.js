const express = require('express')
const router = express.Router()

function parseDateOnly(value) {
    if (!value) return null
    if (value instanceof Date) return value
    const s = String(value)
    // Treat YYYY-MM-DD as date-only (UTC midnight) to avoid timezone drift.
    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return new Date(`${s}T00:00:00.000Z`)
    const d = new Date(s)
    return Number.isNaN(d.getTime()) ? null : d
}

function maxAlertDays(alertDays, fallback) {
    if (!Array.isArray(alertDays) || alertDays.length === 0) return fallback
    const nums = alertDays.map((n) => Number(n)).filter((n) => Number.isFinite(n))
    return nums.length ? Math.max(...nums) : fallback
}

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
    // GET /api/pms/resource/people
    router.get('/people', async (req, res) => {
        try {
            const { q, status } = req.query
            const params = []
            const where = []
            if (status) {
                params.push(status)
                where.push(`status = $${params.length}`)
            }
            if (q) {
                params.push(`%${q}%`)
                where.push(`(name ILIKE $${params.length} OR contact ILIKE $${params.length})`)
            }

            const result = await pool.query(
                `SELECT id, name, birth_yyyymm, contact, status, role_tags, masked_fields, created_at, updated_at
                 FROM person
                 ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
                 ORDER BY id DESC
                 LIMIT 200`,
                params
            )
            res.json(result.rows)
        } catch (err) {
            console.error('[PMS] people fetch error', err)
            res.status(500).json({ error: 'Failed to fetch people' })
        }
    })

    // GET /api/pms/resource/certs
    router.get('/certs', async (req, res) => {
        try {
            const result = await pool.query(
                `SELECT code, name, validity_months, needs_verification, alert_days, active_flag
                 FROM qualification_cert
                 WHERE active_flag = true
                 ORDER BY code`
            )
            res.json(result.rows)
        } catch (err) {
            console.error('[PMS] certs fetch error', err)
            res.status(500).json({ error: 'Failed to fetch certs' })
        }
    })

    // GET /api/pms/resource/trainings
    router.get('/trainings', async (req, res) => {
        try {
            const result = await pool.query(
                `SELECT code, name, validity_months, alert_days, active_flag
                 FROM qualification_training
                 WHERE active_flag = true
                 ORDER BY code`
            )
            res.json(result.rows)
        } catch (err) {
            console.error('[PMS] trainings fetch error', err)
            res.status(500).json({ error: 'Failed to fetch trainings' })
        }
    })

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
            if (!name) return res.status(400).json({ error: 'name is required' })
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
            const refDate = parseDateOnly(date) || parseDateOnly(new Date().toISOString().slice(0, 10))

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
            const enforcementMode = String((mergedRule.enforcement && mergedRule.enforcement.mode) || 'WARN').toUpperCase()
            const isBlocking = enforcementMode === 'BLOCK'

            if (!Array.isArray(assignees)) return res.status(400).json({ error: 'assignees must be an array' })
            const assigneeIds = assignees.map((v) => Number(v))
            if (assigneeIds.some((n) => !Number.isFinite(n))) {
                return res.status(400).json({ error: 'assignees must be numeric person ids' })
            }

            const certByPerson = new Map()
            const trnByPerson = new Map()
            if (assigneeIds.length > 0) {
                const [certs, trainings] = await Promise.all([
                    pool.query(
                        `SELECT pc.person_id, pc.cert_code, pc.status, pc.expires_at, qc.alert_days
                         FROM person_cert pc
                         LEFT JOIN qualification_cert qc ON qc.code = pc.cert_code
                         WHERE pc.person_id = ANY($1::bigint[])`,
                        [assigneeIds]
                    ),
                    pool.query(
                        `SELECT pt.person_id, pt.training_code, pt.status, pt.expires_at, qt.alert_days
                         FROM person_training pt
                         LEFT JOIN qualification_training qt ON qt.code = pt.training_code
                         WHERE pt.person_id = ANY($1::bigint[])`,
                        [assigneeIds]
                    )
                ])

                const pickBest = (existing, incoming, ref) => {
                    if (!existing) return incoming
                    const rank = (row) => {
                        const statusRank =
                            row.status === 'verified' ? 3 : row.status === 'pending' ? 2 : row.status === 'rejected' ? 1 : 0
                        const exp = parseDateOnly(row.expires_at)
                        const notExpired = !exp || exp.getTime() >= ref.getTime()
                        const expScore = exp ? exp.getTime() : Number.MAX_SAFE_INTEGER
                        return [statusRank, notExpired ? 1 : 0, expScore]
                    }
                    const a = rank(existing)
                    const b = rank(incoming)
                    for (let i = 0; i < a.length; i += 1) {
                        if (b[i] > a[i]) return incoming
                        if (b[i] < a[i]) return existing
                    }
                    return existing
                }

                for (const row of certs.rows) {
                    const personId = Number(row.person_id)
                    if (!certByPerson.has(personId)) certByPerson.set(personId, new Map())
                    const m = certByPerson.get(personId)
                    const code = row.cert_code
                    const prev = m.get(code)
                    m.set(code, pickBest(prev, row, refDate))
                }

                for (const row of trainings.rows) {
                    const personId = Number(row.person_id)
                    if (!trnByPerson.has(personId)) trnByPerson.set(personId, new Map())
                    const m = trnByPerson.get(personId)
                    const code = row.training_code
                    const prev = m.get(code)
                    m.set(code, pickBest(prev, row, refDate))
                }
            }

            const assigneeResults = []
            for (const userId of assigneeIds) {
                const certMap = certByPerson.get(userId) || new Map()
                const trnMap = trnByPerson.get(userId) || new Map()

                const missing_certs = []
                const missing_trainings = []
                const expiring_soon = []

                const checkCert = (code) => {
                    const row = certMap.get(code)
                    if (!row) { missing_certs.push(code); return }
                    if (row.status !== 'verified') { missing_certs.push(code); return }
                    const exp = parseDateOnly(row.expires_at)
                    if (exp && exp.getTime() < refDate.getTime()) { missing_certs.push(code); return }
                    // expiring soon
                    if (exp) {
                        const diffDays = Math.floor((exp.getTime() - refDate.getTime()) / (1000 * 60 * 60 * 24))
                        const threshold = maxAlertDays(row.alert_days, 90)
                        if (diffDays >= 0 && diffDays <= threshold) expiring_soon.push(`${code}:D-${diffDays}`)
                    }
                }
                const checkTraining = (code) => {
                    const row = trnMap.get(code)
                    if (!row) { missing_trainings.push(code); return }
                    if (row.status !== 'verified') { missing_trainings.push(code); return }
                    const exp = parseDateOnly(row.expires_at)
                    if (exp && exp.getTime() < refDate.getTime()) { missing_trainings.push(code); return }
                    if (exp) {
                        const diffDays = Math.floor((exp.getTime() - refDate.getTime()) / (1000 * 60 * 60 * 24))
                        const threshold = maxAlertDays(row.alert_days, 60)
                        if (diffDays >= 0 && diffDays <= threshold) expiring_soon.push(`${code}:D-${diffDays}`)
                    }
                }

                // all/any checks
                for (const c of mergedRule.required_certs_all || []) checkCert(c)
                if ((mergedRule.required_certs_any || []).length > 0) {
                    const anyOk = (mergedRule.required_certs_any || []).some((c) => {
                        const row = certMap.get(c)
                        const exp = row ? parseDateOnly(row.expires_at) : null
                        return row && row.status === 'verified' && (!exp || exp.getTime() >= refDate.getTime())
                    })
                    if (!anyOk) missing_certs.push(`any_of:${(mergedRule.required_certs_any || []).join(',')}`)
                }

                for (const t of mergedRule.required_trainings_all || []) checkTraining(t)
                if ((mergedRule.required_trainings_any || []).length > 0) {
                    const anyOk = (mergedRule.required_trainings_any || []).some((t) => {
                        const row = trnMap.get(t)
                        const exp = row ? parseDateOnly(row.expires_at) : null
                        return row && row.status === 'verified' && (!exp || exp.getTime() >= refDate.getTime())
                    })
                    if (!anyOk) missing_trainings.push(`any_of:${(mergedRule.required_trainings_any || []).join(',')}`)
                }

                const strictEligible = missing_certs.length === 0 && missing_trainings.length === 0
                assigneeResults.push({
                    user_id: userId,
                    eligible: isBlocking ? strictEligible : true,
                    missing_certs,
                    missing_trainings,
                    expiring_soon
                })
            }

            const teamEligible = assigneeResults.every((a) => a.missing_certs.length === 0 && a.missing_trainings.length === 0)
            const response = {
                work_type_code,
                eligible: isBlocking ? teamEligible : true,
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
