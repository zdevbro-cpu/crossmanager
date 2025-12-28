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
    // 3. Add new standard items (Learn capability) - Optimized Bulk Insert
    router.post('/risk-standards', async (req, res) => {
        const { construction_type, items } = req.body
        if (!construction_type || !Array.isArray(items)) {
            return res.status(400).json({ error: 'Invalid input' })
        }

        const client = await pool.connect()
        try {
            await client.query('BEGIN')

            // 1. Efficient Deduplication: Fetch existing signatures for this construction type
            const existingRes = await client.query(`
                SELECT step, risk_factor, measure_detail
                FROM sms_risk_standard_items
                WHERE construction_type = $1
            `, [construction_type])

            const existingSet = new Set(
                existingRes.rows.map(r =>
                    `${r.step}||${r.risk_factor}||${r.measure_detail}`.toLowerCase()
                )
            )

            // 2. Filter new items
            const newItems = []
            let skippedCount = 0

            for (const item of items) {
                const sig = `${item.step}||${item.risk_factor}||${item.measure_detail}`.toLowerCase()
                if (existingSet.has(sig)) {
                    skippedCount++
                } else {
                    newItems.push(item)
                    existingSet.add(sig) // Add to set to prevent duplicates within the batch itself
                }
            }

            // 3. Bulk Insert
            if (newItems.length > 0) {
                // Construct parameterized query dynamically
                // ($1, $2, ...), ($9, $10, ...)
                const values = []
                const placeholders = []
                let pIndex = 1

                for (const item of newItems) {
                    placeholders.push(`($${pIndex++}, $${pIndex++}, $${pIndex++}, $${pIndex++}, $${pIndex++}, $${pIndex++}, $${pIndex++}, $${pIndex++}, $${pIndex++})`)
                    values.push(
                        crypto.randomUUID(),     // id (Assuming native crypto or uuid logic, but let's use pg gen_random_uuid() in query if possible. 
                        // Wait, earlier code used gen_random_uuid() in SQL. Let's stick to SQL gen_random_uuid() to reduce params)
                    )
                    // Reset values strategy: pass params? Too many params for large files (pg limit 65535 placeholders).
                    // If 3000 items * 9 cols = 27000 params. 1 minute load might imply > 5000 items.
                    // Safer to batch in chunks of 1000 items.
                }

                // Re-strategy: Chunked Insert with SQL-level ID generation
                const CHUNK_SIZE = 500
                for (let i = 0; i < newItems.length; i += CHUNK_SIZE) {
                    const chunk = newItems.slice(i, i + CHUNK_SIZE)
                    const chunkValues = []
                    const chunkPlaceholders = []
                    let chunkPIndex = 1

                    for (const item of chunk) {
                        chunkPlaceholders.push(`(gen_random_uuid(), $${chunkPIndex}, $${chunkPIndex + 1}, $${chunkPIndex + 2}, $${chunkPIndex + 3}, $${chunkPIndex + 4}, $${chunkPIndex + 5}, $${chunkPIndex + 6}, $${chunkPIndex + 7}, NOW())`)
                        chunkValues.push(
                            construction_type,          // $1
                            item.step,                  // $2
                            item.risk_factor,           // $3
                            item.risk_factor_detail || '', // $4
                            item.risk_level || '중',      // $5
                            item.measure || '',         // $6
                            item.measure_detail || '',  // $7
                            item.residual_risk || '하'    // $8
                        )
                        chunkPIndex += 8
                    }

                    const query = `
                        INSERT INTO sms_risk_standard_items (
                            id, construction_type, step, risk_factor, risk_factor_detail,
                            risk_level, measure, measure_detail, residual_risk, created_at
                        ) VALUES ${chunkPlaceholders.join(', ')}
                    `
                    await client.query(query, chunkValues)
                }
            }

            await client.query('COMMIT')
            res.json({ addedCount: newItems.length, skippedCount })
        } catch (err) {
            await client.query('ROLLBACK')
            console.error('[SMS Standards] Learn Error:', err)
            res.status(500).json({ error: 'Failed to add standards' })
        } finally {
            client.release()
        }
    })

    // 4. Delete standard items by construction_type (Admin only)
    router.delete('/risk-standards', async (req, res) => {
        const { construction_type } = req.query
        if (!construction_type) {
            return res.status(400).json({ error: 'construction_type is required' })
        }

        const client = await pool.connect()
        try {
            const result = await client.query(`
                DELETE FROM sms_risk_standard_items
                WHERE construction_type = $1
            `, [construction_type])

            res.json({ deletedCount: result.rowCount })
        } catch (err) {
            console.error('[SMS Standards] Delete Error:', err)
            res.status(500).json({ error: 'Failed to delete standards' })
        } finally {
            client.release()
        }
    })

    return router
}
