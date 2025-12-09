const express = require('express')
const router = express.Router()

module.exports = function (app, pool) {
    const router = express.Router()

    // Middleware to ensure DB connection is alive (Pool is managed by index.js)

    // ==========================================
    // 1. Site Context APIs
    // ==========================================

    // Get My Site Information (Mock Implementation for Single Tenant)
    router.get('/sites/my', async (req, res) => {
        try {
            // Fetch the first company and valid sites
            const companyRes = await pool.query('SELECT * FROM swms_companies LIMIT 1')
            const sitesRes = await pool.query('SELECT * FROM swms_sites WHERE is_active = true ORDER BY name')

            if (companyRes.rows.length === 0) {
                // If clean DB, return empty structure or init data
                return res.json({ company: null, sites: [] })
            }

            res.json({
                company: companyRes.rows[0],
                sites: sitesRes.rows
            })
        } catch (err) {
            console.error(err)
            res.status(500).json({ error: 'Failed to fetch site info' })
        }
    })

    // Get Warehouses for a Site
    router.get('/sites/:siteId/warehouses', async (req, res) => {
        try {
            const { siteId } = req.params
            const { rows } = await pool.query(`
                SELECT * FROM swms_warehouses 
                WHERE site_id = $1 AND is_active = true 
                ORDER BY name
            `, [siteId])
            res.json(rows)
        } catch (err) {
            console.error(err)
            res.status(500).json({ error: 'Failed to fetch warehouses' })
        }
    })

    // Get Material Types
    router.get('/material-types', async (req, res) => {
        try {
            const { rows } = await pool.query('SELECT * FROM swms_material_types WHERE is_active = true ORDER BY category, name')
            res.json(rows)
        } catch (err) {
            console.error(err)
            res.status(500).json({ error: 'Failed to fetch material types' })
        }
    })

    // Get Vendors
    router.get('/vendors', async (req, res) => {
        try {
            const { rows } = await pool.query('SELECT * FROM swms_vendors WHERE is_active = true ORDER BY name')
            res.json(rows)
        } catch (err) {
            console.error(err)
            res.status(500).json({ error: 'Failed to fetch vendors' })
        }
    })


    // ==========================================
    // 2. Transaction APIs
    // ==========================================

    // --- Generations ---
    router.get('/generations', async (req, res) => {
        try {
            const { site_id, project_id, start_date, end_date } = req.query
            let query = `
                SELECT g.*, mt.name as material_name, mt.unit as material_unit
                FROM swms_generations g
                LEFT JOIN swms_material_types mt ON g.material_type_id = mt.id
                WHERE g.site_id = $1
            `
            const params = [site_id]

            if (project_id && project_id !== 'ALL') {
                query += ` AND g.project_id = $${params.length + 1}`
                params.push(project_id)
            }
            if (start_date) {
                query += ` AND g.generation_date >= $${params.length + 1}`
                params.push(start_date)
            }
            if (end_date) {
                query += ` AND g.generation_date <= $${params.length + 1}`
                params.push(end_date)
            }

            query += ` ORDER BY g.generation_date DESC, g.created_at DESC`

            const { rows } = await pool.query(query, params)
            res.json(rows)
        } catch (err) {
            console.error(err)
            res.status(500).json({ error: 'Failed to fetch generations' })
        }
    })

    router.post('/generations', async (req, res) => {
        try {
            const { site_id, project_id, work_order_id, generation_date, material_type_id, quantity, unit, location } = req.body

            const { rows } = await pool.query(`
                INSERT INTO swms_generations 
                (site_id, project_id, work_order_id, generation_date, material_type_id, quantity, unit, location)
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
                RETURNING *
            `, [site_id, project_id || null, work_order_id, generation_date, material_type_id, quantity, unit, location])

            res.status(201).json(rows[0])
        } catch (err) {
            console.error(err)
            res.status(500).json({ error: 'Failed to create generation' })
        }
    })

    // --- Weighings ---
    router.get('/weighings', async (req, res) => {
        try {
            const { site_id, project_id, direction } = req.query
            let query = `
                SELECT w.*, mt.name as material_name, v.name as vendor_name
                FROM swms_weighings w
                LEFT JOIN swms_material_types mt ON w.material_type_id = mt.id
                LEFT JOIN swms_vendors v ON w.vendor_id = v.id
                WHERE w.site_id = $1
            `
            const params = [site_id]

            if (project_id && project_id !== 'ALL') {
                query += ` AND w.project_id = $${params.length + 1}`
                params.push(project_id)
            }
            if (direction) {
                query += ` AND w.direction = $${params.length + 1}`
                params.push(direction)
            }

            query += ` ORDER BY w.weighing_date DESC, w.created_at DESC`

            const { rows } = await pool.query(query, params)
            res.json(rows)
        } catch (err) {
            console.error(err)
            res.status(500).json({ error: 'Failed to fetch weighings' })
        }
    })

    router.post('/weighings', async (req, res) => {
        try {
            const { site_id, project_id, weighing_date, weighing_time, material_type_id, vehicle_number, direction, gross_weight, tare_weight, vendor_id } = req.body

            const net_weight = Number(gross_weight) - Number(tare_weight)

            const { rows } = await pool.query(`
                INSERT INTO swms_weighings 
                (site_id, project_id, weighing_date, weighing_time, material_type_id, vehicle_number, direction, gross_weight, tare_weight, net_weight, vendor_id)
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
                RETURNING *
            `, [site_id, project_id || null, weighing_date, weighing_time || '00:00:00', material_type_id, vehicle_number, direction, gross_weight, tare_weight, net_weight, vendor_id])

            res.status(201).json(rows[0])
        } catch (err) {
            console.error(err)
            res.status(500).json({ error: 'Failed to create weighing' })
        }
    })

    // --- Inbounds (Receipts) ---
    router.get('/inbounds', async (req, res) => {
        try {
            const { site_id, project_id, start_date, end_date } = req.query
            let query = `
                SELECT i.*, mt.name as material_name, w.name as warehouse_name
                FROM swms_inbounds i
                LEFT JOIN swms_material_types mt ON i.material_type_id = mt.id
                LEFT JOIN swms_warehouses w ON i.warehouse_id = w.id
                WHERE i.site_id = $1
            `
            const params = [site_id]

            if (project_id && project_id !== 'ALL') {
                query += ` AND i.project_id = $${params.length + 1}`
                params.push(project_id)
            }
            if (start_date) {
                query += ` AND i.inbound_date >= $${params.length + 1}`
                params.push(start_date)
            }
            if (end_date) {
                query += ` AND i.inbound_date <= $${params.length + 1}`
                params.push(end_date)
            }

            query += ` ORDER BY i.inbound_date DESC, i.created_at DESC`
            const { rows } = await pool.query(query, params)
            res.json(rows)
        } catch (err) {
            console.error(err)
            res.status(500).json({ error: 'Failed to fetch inbounds' })
        }
    })

    router.post('/inbounds', async (req, res) => {
        const client = await pool.connect()
        try {
            await client.query('BEGIN')
            const { site_id, project_id, inbound_date, warehouse_id, material_type_id, quantity, unit_price, vendor_id } = req.body

            const total_amount = unit_price ? Number(quantity) * Number(unit_price) : 0

            // 1. Create Inbound Record
            const { rows } = await client.query(`
                INSERT INTO swms_inbounds 
                (site_id, project_id, inbound_date, warehouse_id, material_type_id, quantity, unit_price, total_amount, vendor_id)
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
                RETURNING *
            `, [site_id, project_id || null, inbound_date, warehouse_id, material_type_id, quantity, unit_price || 0, total_amount, vendor_id || null])

            // 2. Update Inventory
            await applyInventoryDelta(client, site_id, warehouse_id, material_type_id, quantity)

            await client.query('COMMIT')
            res.status(201).json(rows[0])
        } catch (err) {
            await client.query('ROLLBACK')
            console.error(err)
            res.status(500).json({ error: 'Failed to create inbound' })
        } finally {
            client.release()
        }
    })

    // --- Outbounds (Shipments) ---
    router.get('/outbounds', async (req, res) => {
        try {
            const { site_id, project_id, start_date, end_date } = req.query
            let query = `
                SELECT o.*, mt.name as material_name, w.name as warehouse_name
                FROM swms_outbounds o
                LEFT JOIN swms_material_types mt ON o.material_type_id = mt.id
                LEFT JOIN swms_warehouses w ON o.warehouse_id = w.id
                WHERE o.site_id = $1
            `
            const params = [site_id]

            if (project_id && project_id !== 'ALL') {
                query += ` AND o.project_id = $${params.length + 1}`
                params.push(project_id)
            }
            if (start_date) {
                query += ` AND o.outbound_date >= $${params.length + 1}`
                params.push(start_date)
            }
            if (end_date) {
                query += ` AND o.outbound_date <= $${params.length + 1}`
                params.push(end_date)
            }

            query += ` ORDER BY o.outbound_date DESC, o.created_at DESC`
            const { rows } = await pool.query(query, params)
            res.json(rows)
        } catch (err) {
            console.error(err)
            res.status(500).json({ error: 'Failed to fetch outbounds' })
        }
    })

    router.post('/outbounds', async (req, res) => {
        const client = await pool.connect()
        try {
            await client.query('BEGIN')
            const { site_id, project_id, outbound_date, warehouse_id, material_type_id, quantity, unit_price, vendor_id } = req.body

            const total_amount = unit_price ? Number(quantity) * Number(unit_price) : 0

            // 1. Create Outbound Record
            const { rows } = await client.query(`
                INSERT INTO swms_outbounds 
                (site_id, project_id, outbound_date, warehouse_id, material_type_id, quantity, unit_price, total_amount, vendor_id)
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
                RETURNING *
            `, [site_id, project_id || null, outbound_date, warehouse_id, material_type_id, quantity, unit_price || 0, total_amount, vendor_id || null])

            // 2. Update Inventory (Negative quantity)
            await applyInventoryDelta(client, site_id, warehouse_id, material_type_id, -quantity)

            await client.query('COMMIT')
            res.status(201).json(rows[0])
        } catch (err) {
            await client.query('ROLLBACK')
            res.status(500).json({ error: 'Failed to create outbound' })
        } finally {
            client.release()
        }
    })

    router.delete('/outbounds/:id', async (req, res) => {
        const client = await pool.connect()
        try {
            await client.query('BEGIN')
            const { id } = req.params

            // 1. Get record to know quantity
            const { rows } = await client.query('SELECT * FROM swms_outbounds WHERE id = $1', [id])
            if (rows.length === 0) {
                await client.query('ROLLBACK')
                return res.status(404).json({ error: 'Outbound not found' })
            }
            const record = rows[0]

            // 2. Revert Inventory (Add back quantity)
            await applyInventoryDelta(client, record.site_id, record.warehouse_id, record.material_type_id, record.quantity)

            // 3. Delete
            await client.query('DELETE FROM swms_outbounds WHERE id = $1', [id])

            await client.query('COMMIT')
            res.json({ message: 'Deleted successfully' })
        } catch (err) {
            await client.query('ROLLBACK')
            console.error(err)
            res.status(500).json({ error: 'Failed to delete outbound' })
        } finally {
            client.release()
        }
    })

    router.delete('/inbounds/:id', async (req, res) => {
        const client = await pool.connect()
        try {
            await client.query('BEGIN')
            const { id } = req.params

            // 1. Get record
            const { rows } = await client.query('SELECT * FROM swms_inbounds WHERE id = $1', [id])
            if (rows.length === 0) {
                await client.query('ROLLBACK')
                return res.status(404).json({ error: 'Inbound not found' })
            }
            const record = rows[0]

            // 2. Revert Inventory (Subtract quantity)
            await applyInventoryDelta(client, record.site_id, record.warehouse_id, record.material_type_id, -record.quantity)

            // 3. Delete
            await client.query('DELETE FROM swms_inbounds WHERE id = $1', [id])

            await client.query('COMMIT')
            res.json({ message: 'Deleted successfully' })
        } catch (err) {
            await client.query('ROLLBACK')
            console.error(err)
            res.status(500).json({ error: 'Failed to delete inbound' })
        } finally {
            client.release()
        }
    })

    // --- Inventory APIs ---

    // Get Current Inventory (Real-time Snapshot)
    router.get('/inventory', async (req, res) => {
        try {
            const { site_id, warehouse_id, material_type_id } = req.query
            let query = `
                SELECT inv.*, 
                       mt.name as material_name, mt.category as material_category, mt.unit as material_unit,
                       w.name as warehouse_name
                FROM swms_inventory_storage inv
                JOIN swms_material_types mt ON inv.material_type_id = mt.id
                JOIN swms_warehouses w ON inv.warehouse_id = w.id
                WHERE inv.site_id = $1
            `
            const params = [site_id]

            if (warehouse_id && warehouse_id !== 'ALL') {
                query += ` AND inv.warehouse_id = $${params.length + 1}`
                params.push(warehouse_id)
            }
            if (material_type_id && material_type_id !== 'ALL') {
                query += ` AND inv.material_type_id = $${params.length + 1}`
                params.push(material_type_id)
            }

            query += ` ORDER BY mt.category, mt.name`

            const { rows } = await pool.query(query, params)
            res.json(rows)
        } catch (err) {
            console.error(err)
            res.status(500).json({ error: 'Failed to fetch inventory' })
        }
    })

    // Create Inventory Adjustment (Stock Check)
    router.post('/inventory/adjustments', async (req, res) => {
        const client = await pool.connect()
        try {
            await client.query('BEGIN')
            const { site_id, project_id, warehouse_id, adjustment_date, material_type_id, quantity, reason, adjustment_type } = req.body

            // 1. Create Adjustment Record
            const { rows } = await client.query(`
                INSERT INTO swms_inventory_adjustments 
                (site_id, project_id, warehouse_id, adjustment_date, material_type_id, quantity, reason, adjustment_type)
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
                RETURNING *
            `, [site_id, project_id || null, warehouse_id, adjustment_date, material_type_id, quantity, reason, adjustment_type])

            // 2. Update Inventory
            // If adjustment_type is 'SET', we calculate delta? Or assumes 'quantity' is the DELTA.
            // Usually adjustment form sends "Actual Qty" (Stock Take) or "Adjustment Qty" (+/-).
            // Let's assume input 'quantity' is the DELTA (+/-) for simplicity unless specified otherwise.
            // Users usually enter "Missing -5" or "Found +2".
            await applyInventoryDelta(client, site_id, warehouse_id, material_type_id, quantity)

            await client.query('COMMIT')
            res.status(201).json(rows[0])
        } catch (err) {
            await client.query('ROLLBACK')
            console.error(err)
            res.status(500).json({ error: 'Failed to create adjustment' })
        } finally {
            client.release()
        }
    })

    // Helper: Update Real-time Inventory Storage
    async function applyInventoryDelta(client, siteId, warehouseId, materialTypeId, deltaQuantity) {
        if (!siteId || !warehouseId || !materialTypeId || !deltaQuantity) return;

        const delta = Number(deltaQuantity);

        // Upsert into swms_inventory_storage
        await client.query(`
            INSERT INTO swms_inventory_storage (site_id, warehouse_id, material_type_id, quantity)
            VALUES ($1, $2, $3, $4)
            ON CONFLICT (site_id, warehouse_id, material_type_id)
            DO UPDATE SET 
                quantity = swms_inventory_storage.quantity + $4,
                last_updated_at = CURRENT_TIMESTAMP
        `, [siteId, warehouseId, materialTypeId, delta]);
    }

    // Mount the router
    app.use('/api/swms', router)
}
