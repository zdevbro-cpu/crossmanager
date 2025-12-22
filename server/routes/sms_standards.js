const express = require('express')
const router = express.Router()

module.exports = (pool) => {
    // 1. Fetch available construction types
    router.get('/risk-standards/types', async (req, res) => {
        try {
            const client = await pool.connect()
            // Ensure table exists or handle error gracefully if strictly needed, 
            // but assuming schema is set up.
            const result = await client.query(`
                SELECT DISTINCT construction_type 
                FROM sms_risk_standard_items 
                WHERE construction_type IS NOT NULL AND construction_type != ''
                ORDER BY construction_type
            `)
            client.release()

            const types = result.rows.map(r => r.construction_type)
            res.json(types)
        } catch (err) {
            console.error('[SMS Standards] Error fetching types:', err)
            // If table doesn't exist, return empty array instead of crashing
            if (err.code === '42P01') { // undefined_table
                return res.json([])
            }
            res.status(500).json({ error: 'Failed to fetch construction types' })
        }
    })

    // 2. Fetch standard items for a specific type
    router.get('/risk-standards', async (req, res) => {
        try {
            const { construction_type } = req.query
            if (!construction_type) {
                return res.status(400).json({ error: 'construction_type is required' })
            }

            const client = await pool.connect()
            const result = await client.query(`
                SELECT 
                    step, 
                    risk_factor, 
                    risk_factor_detail, 
                    risk_level, 
                    measure, 
                    measure_detail, 
                    residual_risk
                FROM sms_risk_standard_items
                WHERE construction_type = $1
                ORDER BY step, risk_factor
            `, [construction_type])
            client.release()

            console.log(`[SMS Standards] Fetched ${result.rows.length} items for ${construction_type}`)
            if (result.rows.length > 0) {
                console.log('[SMS Standards] Sample item:', JSON.stringify(result.rows[0], null, 2))
                // Explicitly check measure_detail
                const missingMeasures = result.rows.filter(r => !r.measure_detail).length
                console.log(`[SMS Standards] Items with missing measure_detail: ${missingMeasures}/${result.rows.length}`)
            }

            res.json(result.rows)
        } catch (err) {
            console.error('[SMS Standards] Error fetching items:', err)
            res.status(500).json({ error: 'Failed to fetch standards' })
        }
    })

    // 3. Add new standard items (Learn capability)
    router.post('/risk-standards', async (req, res) => {
        const { construction_type, items } = req.body
        if (!construction_type || !Array.isArray(items)) {
            return res.status(400).json({ error: 'Invalid input' })
        }

        const client = await pool.connect()
        try {
            await client.query('BEGIN')

            let addedCount = 0
            let skippedCount = 0

            for (const item of items) {
                // Deduplication check: Step + Factor + Measure Content
                const checkRes = await client.query(`
                    SELECT 1 FROM sms_risk_standard_items
                    WHERE construction_type = $1
                      AND step = $2
                      AND risk_factor = $3
                      AND measure_detail = $4
                `, [construction_type, item.step, item.risk_factor, item.measure_detail])

                if (checkRes.rowCount > 0) {
                    skippedCount++
                    continue
                }

                await client.query(`
                    INSERT INTO sms_risk_standard_items (
                        id, construction_type, step, risk_factor, risk_factor_detail,
                        risk_level, measure, measure_detail, residual_risk, created_at
                    ) VALUES (
                        gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, $8, NOW()
                    )
                `, [
                    construction_type,
                    item.step,
                    item.risk_factor,
                    item.risk_factor_detail || '',
                    item.risk_level || '중',
                    item.measure || '',
                    item.measure_detail || '',
                    item.residual_risk || '하'
                ])
                addedCount++
            }

            await client.query('COMMIT')
            res.json({ addedCount, skippedCount })
        } catch (err) {
            await client.query('ROLLBACK')
            console.error('[SMS Standards] Learn Error:', err)
            res.status(500).json({ error: 'Failed to add standards' })
        } finally {
            client.release()
        }
    })

    return router
}
