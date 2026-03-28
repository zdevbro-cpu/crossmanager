const express = require('express')
const router = express.Router()
const { Pool } = require('pg')

// DB Connection (Reusing the pool from index.js via module or creating new one? 
// Creating new pool instance for this file usually works if env vars are set, 
// but passing pool is better. For now, assuming env vars are available globally or re-referenced)
// A common pattern in this project seems to be monolithic index.js.
// But to separate, I'll create a router. I need the db pool.
// I will assume `index.js` will pass the pool or I create a new one.
// Let's create a new pool instance here for safety, or better yet, export pool from a db module. 
// Since there is no db module, I'll instantiate Pool again with same config.

const pool = new Pool({
    user: process.env.DB_USER,
    host: process.env.DB_HOST,
    database: process.env.DB_NAME,
    password: process.env.DB_PASSWORD,
    port: process.env.DB_PORT || 5432,
    ssl: { rejectUnauthorized: false }
})

// --- Contracts API ---

// 1. Get All Contracts (Filter by projectId or status)
router.get('/', async (req, res) => {
    try {
        const { projectId, type, status } = req.query
        let query = 'SELECT * FROM contracts'
        let conditions = []
        let params = []

        if (projectId) {
            conditions.push(`project_id = $${params.length + 1}`)
            params.push(projectId)
        }
        if (type) {
            conditions.push(`type = $${params.length + 1}`)
            params.push(type)
        }
        if (status) {
            conditions.push(`status = $${params.length + 1}`)
            params.push(status)
        }

        if (conditions.length > 0) {
            query += ' WHERE ' + conditions.join(' AND ')
        }

        query += ' ORDER BY created_at DESC'

        const { rows } = await pool.query(query, params)

        // Fetch items for each contract
        for (const contract of rows) {
            const itemsRes = await pool.query('SELECT * FROM contract_items WHERE contract_id = $1 ORDER BY created_at ASC', [contract.id])
            contract.items = itemsRes.rows
        }

        res.json(rows)
    } catch (err) {
        console.error(err)
        res.status(500).json({ error: 'Failed to fetch contracts' })
    }
})

// 2. Get Single Contract with Items (Detail View)
router.get('/:id', async (req, res) => {
    try {
        const { id } = req.params

        // Fetch Master
        const contractRes = await pool.query('SELECT * FROM contracts WHERE id = $1', [id])
        if (contractRes.rows.length === 0) {
            return res.status(404).json({ error: 'Contract not found' })
        }
        const contract = contractRes.rows[0]

        // Fetch Items
        const itemsRes = await pool.query('SELECT * FROM contract_items WHERE contract_id = $1 ORDER BY created_at ASC', [id])
        contract.items = itemsRes.rows

        res.json(contract)
    } catch (err) {
        console.error(err)
        res.status(500).json({ error: 'Failed to fetch contract details' })
    }
})

// 3. Create Contract (Master only or with Items)
router.post('/', async (req, res) => {
    const client = await pool.connect()
    try {
        await client.query('BEGIN')

        const {
            projectId, type, category, name,
            totalAmount, costDirect, costIndirect, riskFee, margin,
            indirectRate, riskRate, marginRate, // Added Rates
            regulationConfig, clientManager, ourManager,
            contractDate, startDate, endDate,
            termsPayment, termsPenalty, status, items, attachment
        } = req.body

        // Generate Code
        const dateStr = new Date().toISOString().slice(2, 10).replace(/-/g, '')
        const rand = Math.floor(Math.random() * 1000).toString().padStart(3, '0')
        const code = `${type === 'CONTRACT' ? 'CON' : 'EST'}-${dateStr}-${rand}`

        const insertMaster = `
            INSERT INTO contracts (
                project_id, code, type, category, name, 
                total_amount, cost_direct, cost_indirect, risk_fee, margin,
                indirect_rate, risk_rate, margin_rate,
                regulation_config, client_manager, our_manager,
                contract_date, start_date, end_date,
                terms_payment, terms_penalty, status, attachment
            ) VALUES (
                $1, $2, $3, $4, $5, 
                $6, $7, $8, $9, $10,
                $11, $12, $13,
                $14, $15, $16,
                $17, $18, $19,
                $20, $21, $22, $23
            ) RETURNING *
        `

        const masterParams = [
            projectId, code, type, category, name,
            totalAmount || 0, costDirect || 0, costIndirect || 0, riskFee || 0, margin || 0,
            indirectRate || 0, riskRate || 0, marginRate || 0, // Added Rate Values
            JSON.stringify(regulationConfig || {}), clientManager, ourManager,
            contractDate, startDate, endDate,
            termsPayment, termsPenalty, status || 'DRAFT',
            attachment ? JSON.stringify(attachment) : null
        ]

        const { rows: masterRows } = await client.query(insertMaster, masterParams)
        const contractId = masterRows[0].id

        // Insert Items if any
        if (items && Array.isArray(items) && items.length > 0) {
            const insertItem = `
                INSERT INTO contract_items (
                    contract_id, group_name, name, spec, 
                    quantity, unit, unit_price, amount, note
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
            `

            for (const item of items) {
                await client.query(insertItem, [
                    contractId, item.group, item.name, item.spec,
                    item.quantity || 0, item.unit, item.unitPrice || 0, item.amount || 0, item.note
                ])
            }
        }

        await client.query('COMMIT')
        res.status(201).json({ ...masterRows[0], code })
    } catch (err) {
        await client.query('ROLLBACK')
        console.error(err)
        res.status(500).json({ error: 'Failed to create contract', details: err.message })
    } finally {
        client.release()
    }
})

// 4. Update Contract
router.put('/:id', async (req, res) => {
    const client = await pool.connect()
    try {
        await client.query('BEGIN')
        const { id } = req.params
        const {
            category, name,
            totalAmount, costDirect, costIndirect, riskFee, margin,
            indirectRate, riskRate, marginRate, // Added Rates
            regulationConfig, clientManager, ourManager,
            contractDate, startDate, endDate,
            termsPayment, termsPenalty, status, items, attachment
        } = req.body

        // Update Master
        const updateMaster = `
            UPDATE contracts SET 
                category = COALESCE($2, category),
                name = COALESCE($3, name),
                total_amount = COALESCE($4, total_amount),
                cost_direct = COALESCE($5, cost_direct),
                cost_indirect = COALESCE($6, cost_indirect),
                risk_fee = COALESCE($7, risk_fee),
                margin = COALESCE($8, margin),
                indirect_rate = COALESCE($9, indirect_rate),
                risk_rate = COALESCE($10, risk_rate),
                margin_rate = COALESCE($11, margin_rate),
                regulation_config = COALESCE($12, regulation_config),
                client_manager = COALESCE($13, client_manager),
                our_manager = COALESCE($14, our_manager),
                contract_date = COALESCE($15, contract_date),
                start_date = COALESCE($16, start_date),
                end_date = COALESCE($17, end_date),
                terms_payment = COALESCE($18, terms_payment),
                terms_penalty = COALESCE($19, terms_penalty),
                status = COALESCE($20, status),
                attachment = COALESCE($21, attachment),
                updated_at = CURRENT_TIMESTAMP
            WHERE id = $1
            RETURNING *
        `
        const masterParams = [
            id, category, name,
            totalAmount, costDirect, costIndirect, riskFee, margin,
            indirectRate, riskRate, marginRate, // Params index shifted
            regulationConfig ? JSON.stringify(regulationConfig) : null,
            clientManager, ourManager,
            contractDate, startDate, endDate,
            termsPayment, termsPenalty, status,
            attachment ? JSON.stringify(attachment) : null
        ]

        const { rows: masterRows } = await client.query(updateMaster, masterParams)
        if (masterRows.length === 0) {
            await client.query('ROLLBACK')
            return res.status(404).json({ error: 'Contract not found' })
        }

        // Full Replace Items (Simple Strategy)
        // If items array is provided, delete all existing and re-insert
        if (items && Array.isArray(items)) {
            await client.query('DELETE FROM contract_items WHERE contract_id = $1', [id])

            const insertItem = `
                INSERT INTO contract_items (
                    contract_id, group_name, name, spec, 
                    quantity, unit, unit_price, amount, note
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
            `

            for (const item of items) {
                await client.query(insertItem, [
                    id, item.group, item.name, item.spec,
                    item.quantity || 0, item.unit, item.unitPrice || 0, item.amount || 0, item.note
                ])
            }
        }

        await client.query('COMMIT')
        res.json(masterRows[0])
    } catch (err) {
        await client.query('ROLLBACK')
        console.error(err)
        res.status(500).json({ error: 'Failed to update contract', details: err.message })
    } finally {
        client.release()
    }
})

// 5. Delete Contract
router.delete('/:id', async (req, res) => {
    try {
        const { id } = req.params
        await pool.query('DELETE FROM contracts WHERE id = $1', [id])
        res.json({ message: 'Contract deleted' })
    } catch (err) {
        console.error(err)
        res.status(500).json({ error: 'Failed to delete contract' })
    }
})

module.exports = router
