const express = require('express');
const router = express.Router();

module.exports = (pool) => {
    // --- DB Initialization for SWMS Detailed Tables ---
    const initSwmsTables = async () => {
        try {
            const shouldResetTables = process.env.SWMS_RESET_TABLES === '1'
            // Drop tables to reset schema for ID type change (UUID -> VARCHAR)
            // This is a DEV environment action to resolve the "Data Loading Fail" due to type mismatch.
            const tableCheck = await pool.query("SELECT to_regclass('public.swms_generations')");
            if (shouldResetTables && tableCheck.rows[0].to_regclass) {
                // Only drop if they exist and we need to fix schema. 
                // For safety in this session, we'll assume we need to align schema.
                // We'll prioritize altering or just dropping. 
                // given the user's issue, a clean slate for SWMS tables is best.
                console.log('[SWMS] Re-initializing tables to fix ID types...');
                await pool.query(`
                    DROP TABLE IF EXISTS swms_settlement_items CASCADE;
                    DROP TABLE IF EXISTS swms_settlements CASCADE;
                    DROP TABLE IF EXISTS swms_outbounds CASCADE;
                    DROP TABLE IF EXISTS swms_inbounds CASCADE;
                    DROP TABLE IF EXISTS swms_inventory_adjustments CASCADE;
                    DROP TABLE IF EXISTS swms_inventory CASCADE;
                    DROP TABLE IF EXISTS swms_generations CASCADE;
                    DROP TABLE IF EXISTS swms_weighings CASCADE;
                    DROP TABLE IF EXISTS swms_warehouses CASCADE;
                    -- swms_material_types and swms_vendors can stay if they are compatible, but let's be safe
                    DROP TABLE IF EXISTS swms_material_types CASCADE;
                    DROP TABLE IF EXISTS swms_vendors CASCADE;
                `);
            } else if (tableCheck.rows[0].to_regclass) {
                console.log('[SWMS] Tables exist; skipping reset (set SWMS_RESET_TABLES=1 to force reset).');
            }

            // Material Types
            await pool.query(`
                CREATE TABLE IF NOT EXISTS swms_material_types (
                    id VARCHAR(100) PRIMARY KEY DEFAULT gen_random_uuid()::text,
                    code VARCHAR(50),
                    name VARCHAR(100) NOT NULL,
                    category VARCHAR(50),
                    unit VARCHAR(20) DEFAULT '톤',
                    unit_price DECIMAL(10, 2) DEFAULT 0,
                    symbol VARCHAR(10)
                )
            `);
            // Seed Material Types (only if empty)
            const mtCountRes = await pool.query('SELECT COUNT(*)::int AS cnt FROM swms_material_types');
            if ((mtCountRes.rows[0]?.cnt || 0) === 0) {
                await pool.query(`
                INSERT INTO swms_material_types (name, category, unit, unit_price, symbol) VALUES
                ('스크랩-구리 A', '스크랩', '톤', 8500000, 'CU'),
                ('스크랩-알루미늄', '스크랩', '톤', 1800000, 'AL'),
                ('스크랩-아연', '스크랩', '톤', 3200000, 'ZN'),
                ('스크랩-주석', '스크랩', '톤', 28000000, 'SN'),
                ('철근스크랩', '스크랩', '톤', 350000, NULL),
                ('혼합폐기물', '폐기물', '톤', -150000, NULL)
            `);
            }

            // Vendors
            await pool.query(`
                CREATE TABLE IF NOT EXISTS swms_vendors (
                    id VARCHAR(100) PRIMARY KEY DEFAULT gen_random_uuid()::text,
                    name VARCHAR(100) NOT NULL,
                    type VARCHAR(50), 
                    contact VARCHAR(100),
                    registration_no VARCHAR(50)
                )
            `);
            // Seed Vendors (only if empty)
            const vendorCountRes = await pool.query('SELECT COUNT(*)::int AS cnt FROM swms_vendors');
            if ((vendorCountRes.rows[0]?.cnt || 0) === 0) {
                await pool.query(`
                INSERT INTO swms_vendors (name, type) VALUES
                ('동부제철', '매입처'),
                ('현대제철', '매입처'),
                ('파주환경', '처리업체'),
                ('대성자원', '운반업체')
            `);
            }

            // Warehouses
            await pool.query(`
                CREATE TABLE IF NOT EXISTS swms_warehouses (
                    id VARCHAR(100) PRIMARY KEY DEFAULT gen_random_uuid()::text,
                    site_id VARCHAR(100), -- Can be 'FAC-001'
                    name VARCHAR(100) NOT NULL,
                    type VARCHAR(50) DEFAULT 'General',
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            `);

            // Generations
            await pool.query(`
                CREATE TABLE IF NOT EXISTS swms_generations (
                    id VARCHAR(100) PRIMARY KEY DEFAULT gen_random_uuid()::text,
                    site_id VARCHAR(100),
                    project_id VARCHAR(100),
                    generation_date DATE DEFAULT CURRENT_DATE,
                    material_type_id VARCHAR(100) REFERENCES swms_material_types(id),
                    process_name VARCHAR(100),
                    quantity DECIMAL(12, 2) DEFAULT 0,
                    unit VARCHAR(20),
                    location VARCHAR(100),
                    notes TEXT,
                    status VARCHAR(20) DEFAULT 'REGISTERED',
                    created_by VARCHAR(50),
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            `);

            // Weighings
            await pool.query(`
                CREATE TABLE IF NOT EXISTS swms_weighings (
                    id VARCHAR(100) PRIMARY KEY DEFAULT gen_random_uuid()::text,
                    site_id VARCHAR(100),
                    project_id VARCHAR(100),
                    weighing_date DATE DEFAULT CURRENT_DATE,
                    weighing_time TIME DEFAULT CURRENT_TIME,
                    vehicle_number VARCHAR(20),
                    driver_name VARCHAR(50),
                    driver_contact VARCHAR(50),
                    material_type_id VARCHAR(100) REFERENCES swms_material_types(id),
                    direction VARCHAR(10) DEFAULT 'IN',
                    gross_weight DECIMAL(12, 2) DEFAULT 0,
                    tare_weight DECIMAL(12, 2) DEFAULT 0,
                    net_weight DECIMAL(12, 2) DEFAULT 0,
                    vendor_id VARCHAR(100) REFERENCES swms_vendors(id),
                    notes TEXT,
                    created_by VARCHAR(50),
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            `);

            // Inventory
            await pool.query(`
                CREATE TABLE IF NOT EXISTS swms_inventory (
                    id VARCHAR(100) PRIMARY KEY DEFAULT gen_random_uuid()::text,
                    site_id VARCHAR(100),
                    warehouse_id VARCHAR(100), 
                    material_type_id VARCHAR(100) REFERENCES swms_material_types(id),
                    quantity DECIMAL(12, 2) DEFAULT 0,
                    last_updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    UNIQUE(site_id, warehouse_id, material_type_id)
                )
            `);

            // Inventory Adjustments
            await pool.query(`
                CREATE TABLE IF NOT EXISTS swms_inventory_adjustments (
                    id VARCHAR(100) PRIMARY KEY DEFAULT gen_random_uuid()::text,
                    site_id VARCHAR(100),
                    warehouse_id VARCHAR(100),
                    material_type_id VARCHAR(100),
                    quantity DECIMAL(12, 2) NOT NULL,
                    reason TEXT,
                    adjustment_type VARCHAR(50),
                    adjustment_date DATE DEFAULT CURRENT_DATE,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            `);

            // Outbounds
            await pool.query(`
                CREATE TABLE IF NOT EXISTS swms_outbounds (
                    id VARCHAR(100) PRIMARY KEY DEFAULT gen_random_uuid()::text,
                    site_id VARCHAR(100),
                    project_id VARCHAR(100),
                    outbound_date DATE DEFAULT CURRENT_DATE,
                    warehouse_id VARCHAR(100),
                    vendor_id VARCHAR(100) REFERENCES swms_vendors(id),
                    material_type_id VARCHAR(100) REFERENCES swms_material_types(id),
                    quantity DECIMAL(12, 2) DEFAULT 0,
                    unit_price DECIMAL(15, 2) DEFAULT 0,
                    total_amount DECIMAL(15, 2) DEFAULT 0,
                    status VARCHAR(20) DEFAULT 'PENDING',
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            `);

            // Inbounds
            await pool.query(`
                CREATE TABLE IF NOT EXISTS swms_inbounds (
                    id VARCHAR(100) PRIMARY KEY DEFAULT gen_random_uuid()::text,
                    site_id VARCHAR(100),
                    project_id VARCHAR(100),
                    inbound_date DATE DEFAULT CURRENT_DATE,
                    warehouse_id VARCHAR(100),
                    vendor_id VARCHAR(100) REFERENCES swms_vendors(id),
                    material_type_id VARCHAR(100) REFERENCES swms_material_types(id),
                    quantity DECIMAL(12, 2) DEFAULT 0,
                    unit_price DECIMAL(15, 2) DEFAULT 0,
                    total_amount DECIMAL(15, 2) DEFAULT 0,
                    status VARCHAR(20) DEFAULT 'CONFIRMED',
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            `);

            // Settlements
            await pool.query(`
                CREATE TABLE IF NOT EXISTS swms_settlements (
                    id VARCHAR(100) PRIMARY KEY DEFAULT gen_random_uuid()::text,
                    site_id VARCHAR(100),
                    vendor_id VARCHAR(100) REFERENCES swms_vendors(id),
                    start_date DATE,
                    end_date DATE,
                    total_supply_price DECIMAL(15, 2),
                    total_vat DECIMAL(15, 2),
                    total_amount DECIMAL(15, 2),
                    status VARCHAR(20) DEFAULT 'DRAFT',
                    tax_invoice_no VARCHAR(50),
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            `);

            // Settlement Items
            await pool.query(`
                CREATE TABLE IF NOT EXISTS swms_settlement_items (
                    id VARCHAR(100) PRIMARY KEY DEFAULT gen_random_uuid()::text,
                    settlement_id VARCHAR(100) REFERENCES swms_settlements(id) ON DELETE CASCADE,
                    outbound_id VARCHAR(100) REFERENCES swms_outbounds(id)
                )
            `);

            if (shouldResetTables) {
                console.log('[SWMS] All tables re-initialized with VARCHAR keys.');
            } else {
                console.log('[SWMS] SWMS tables ensured.');
            }
        } catch (e) {
            console.error('[SWMS] Init tables error:', e);
        }
    };
    initSwmsTables();

    // --- Master Data Routes ---

    router.get('/material-types', async (req, res) => {
        try {
            const { rows } = await pool.query('SELECT * FROM swms_material_types ORDER BY category, name');
            res.json(rows);
        } catch (e) { res.status(500).json({ error: e.message }); }
    });

    router.get('/vendors', async (req, res) => {
        try {
            const { rows } = await pool.query('SELECT * FROM swms_vendors ORDER BY name');
            res.json(rows);
        } catch (e) { res.status(500).json({ error: e.message }); }
    });

    // --- Warehouse Routes ---

    router.get('/sites/:siteId/warehouses', async (req, res) => {
        const { siteId } = req.params;
        try {
            let { rows } = await pool.query('SELECT * FROM swms_warehouses WHERE site_id = $1', [siteId]);
            if (rows.length === 0) {
                res.json([
                    { id: 'wh-default-1', name: '야적장 (Main Yard)', type: 'Open', site_id: siteId },
                    { id: 'wh-default-2', name: '폐기물 임시보관소', type: 'Indoor', site_id: siteId }
                ]);
            } else {
                res.json(rows);
            }
        } catch (e) { res.status(500).json({ error: e.message }); }
    });

    // --- Site (Factory/Yard) Routes ---
    router.get('/sites/my', async (req, res) => {
        // Return fixed list of factories/yards for SWMS context
        // This decouples SWMS "Sites" from PMS "Projects"
        const sites = [
            { id: 'FAC-001', name: '인천 본사 공장', company_name: 'Cross Material Dynamics', address: '인천광역시 서구' },
            { id: 'YARD-001', name: '파주 야적장', company_name: 'Cross Material Dynamics', address: '경기도 파주시' },
            { id: 'FAC-002', name: '부산 제2공장', company_name: 'Cross Material Dynamics', address: '부산광역시 강서구' }
        ];

        res.json({
            company: { id: 'CMD-001', name: 'Cross Material Dynamics' },
            sites: sites
        });
    });

    // --- Generation Routes ---
    router.get('/generations', async (req, res) => {
        try {
            const { site_id } = req.query;
            let query = `
                SELECT g.*, m.name as material_name, m.category as material_category, m.unit as material_unit 
                FROM swms_generations g
                LEFT JOIN swms_material_types m ON g.material_type_id = m.id
            `;
            const params = [];
            if (site_id) {
                query += ' WHERE g.site_id = $1';
                params.push(site_id);
            }
            query += ' ORDER BY g.generation_date DESC, g.created_at DESC';
            const { rows } = await pool.query(query, params);
            res.json(rows);
        } catch (e) { res.status(500).json({ error: e.message }); }
    });

    router.post('/generations', async (req, res) => {
        try {
            const { site_id, project_id, generation_date, material_type_id, process_name, quantity, unit, location, notes, created_by } = req.body;
            const { rows } = await pool.query(`
                INSERT INTO swms_generations (site_id, project_id, generation_date, material_type_id, process_name, quantity, unit, location, notes, created_by)
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
                RETURNING *
            `, [site_id, project_id, generation_date, material_type_id, process_name, quantity, unit, location, notes, created_by]);
            res.status(201).json(rows[0]);
        } catch (e) { res.status(500).json({ error: e.message }); }
    });

    router.put('/generations/:id', async (req, res) => {
        try {
            const { id } = req.params;
            const { generation_date, material_type_id, process_name, quantity, location, notes } = req.body;
            const { rows } = await pool.query(`
                UPDATE swms_generations 
                SET generation_date=$1, material_type_id=$2, process_name=$3, quantity=$4, location=$5, notes=$6
                WHERE id=$7 RETURNING *
            `, [generation_date, material_type_id, process_name, quantity, location, notes, id]);
            res.json(rows[0]);
        } catch (e) { res.status(500).json({ error: e.message }); }
    });

    router.delete('/generations/:id', async (req, res) => {
        try {
            await pool.query('DELETE FROM swms_generations WHERE id = $1', [req.params.id]);
            res.json({ message: 'Deleted' });
        } catch (e) { res.status(500).json({ error: e.message }); }
    });

    // --- Weighing Routes ---
    router.get('/weighings', async (req, res) => {
        try {
            const { site_id, direction } = req.query;
            let query = `
                SELECT w.*, m.name as material_name, m.category as material_category, v.name as vendor_name, v.type as vendor_type
                FROM swms_weighings w
                LEFT JOIN swms_material_types m ON w.material_type_id = m.id
                LEFT JOIN swms_vendors v ON w.vendor_id = v.id
            `;
            const params = [];
            const conditions = [];
            if (site_id) {
                conditions.push(`w.site_id = $${params.length + 1}`);
                params.push(site_id);
            }
            if (direction) {
                conditions.push(`w.direction = $${params.length + 1}`);
                params.push(direction);
            }
            if (conditions.length > 0) {
                query += ' WHERE ' + conditions.join(' AND ');
            }
            query += ' ORDER BY w.weighing_date DESC, w.weighing_time DESC';
            const { rows } = await pool.query(query, params);
            res.json(rows);
        } catch (e) { res.status(500).json({ error: e.message }); }
    });

    router.post('/weighings', async (req, res) => {
        try {
            const { site_id, project_id, weighing_date, weighing_time, vehicle_number, driver_name, driver_contact, material_type_id, direction, gross_weight, tare_weight, vendor_id, notes, created_by } = req.body;
            const net_weight = (parseFloat(gross_weight) || 0) - (parseFloat(tare_weight) || 0);

            const { rows } = await pool.query(`
                INSERT INTO swms_weighings (
                    site_id, project_id, weighing_date, weighing_time, vehicle_number, driver_name, driver_contact, 
                    material_type_id, direction, gross_weight, tare_weight, net_weight, vendor_id, notes, created_by
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
                RETURNING *
            `, [site_id, project_id, weighing_date, weighing_time, vehicle_number, driver_name, driver_contact, material_type_id, direction, gross_weight, tare_weight, net_weight, vendor_id, notes, created_by]);
            res.status(201).json(rows[0]);
        } catch (e) { res.status(500).json({ error: e.message }); }
    });

    router.put('/weighings/:id', async (req, res) => {
        try {
            const { id } = req.params;
            const { weighing_date, weighing_time, vehicle_number, driver_name, material_type_id, direction, gross_weight, tare_weight, vendor_id, notes } = req.body;
            const net_weight = (parseFloat(gross_weight) || 0) - (parseFloat(tare_weight) || 0);

            const { rows } = await pool.query(`
                UPDATE swms_weighings 
                SET weighing_date=$1, weighing_time=$2, vehicle_number=$3, driver_name=$4, material_type_id=$5, direction=$6, gross_weight=$7, tare_weight=$8, net_weight=$9, vendor_id=$10, notes=$11
                WHERE id=$12 RETURNING *
            `, [weighing_date, weighing_time, vehicle_number, driver_name, material_type_id, direction, gross_weight, tare_weight, net_weight, vendor_id, notes, id]);
            res.json(rows[0]);
        } catch (e) { res.status(500).json({ error: e.message }); }
    });

    router.delete('/weighings/:id', async (req, res) => {
        try {
            await pool.query('DELETE FROM swms_weighings WHERE id = $1', [req.params.id]);
            res.json({ message: 'Deleted' });
        } catch (e) { res.status(500).json({ error: e.message }); }
    });

    // --- Inventory Routes ---
    router.get('/inventory', async (req, res) => {
        try {
            const { site_id } = req.query;
            const query = `
                SELECT i.*, m.name as material_name, m.category as material_category, 
                       CASE WHEN w.name IS NULL THEN '기본 창고' ELSE w.name END as warehouse_name
                FROM swms_inventory i
                LEFT JOIN swms_material_types m ON i.material_type_id = m.id
                LEFT JOIN swms_warehouses w ON i.warehouse_id = w.id
                WHERE i.site_id = $1
            `;
            const { rows } = await pool.query(query, [site_id]);
            res.json(rows);
        } catch (e) { res.status(500).json({ error: e.message }); }
    });

    router.post('/inventory/adjustments', async (req, res) => {
        const client = await pool.connect();
        try {
            await client.query('BEGIN');
            const { site_id, warehouse_id, material_type_id, quantity, reason, adjustment_type, adjustment_date } = req.body;

            await client.query(`
                INSERT INTO swms_inventory_adjustments (site_id, warehouse_id, material_type_id, quantity, reason, adjustment_type, adjustment_date)
                VALUES ($1, $2, $3, $4, $5, $6, $7)
            `, [site_id, warehouse_id, material_type_id, quantity, reason, adjustment_type, adjustment_date]);

            // Upsert
            await client.query(`
                INSERT INTO swms_inventory (site_id, warehouse_id, material_type_id, quantity, last_updated_at)
                VALUES ($1, $2, $3, $4, NOW())
                ON CONFLICT (site_id, warehouse_id, material_type_id) 
                DO UPDATE SET quantity = swms_inventory.quantity + EXCLUDED.quantity, last_updated_at = NOW()
            `, [site_id, warehouse_id, material_type_id, quantity]);

            await client.query('COMMIT');
            res.json({ success: true });
        } catch (e) {
            await client.query('ROLLBACK');
            res.status(500).json({ error: e.message });
        } finally {
            client.release();
        }
    });

    // --- Inbound (Purchase) Routes ---
    router.get('/inbounds', async (req, res) => {
        try {
            const { site_id } = req.query;
            let query = `
                SELECT i.*, m.name as material_name, v.name as vendor_name, 
                       CASE WHEN w.name IS NULL THEN '기본 창고' ELSE w.name END as warehouse_name
                FROM swms_inbounds i
                LEFT JOIN swms_material_types m ON i.material_type_id = m.id
                LEFT JOIN swms_vendors v ON i.vendor_id = v.id
                LEFT JOIN swms_warehouses w ON i.warehouse_id = w.id
            `;
            if (site_id) {
                query += ' WHERE i.site_id = $1';
            }
            query += ' ORDER BY i.inbound_date DESC';
            const { rows } = await pool.query(query, site_id ? [site_id] : []);
            res.json(rows);
        } catch (e) { res.status(500).json({ error: e.message }); }
    });

    router.post('/inbounds', async (req, res) => {
        const client = await pool.connect();
        try {
            await client.query('BEGIN');
            const { site_id, project_id, inbound_date, warehouse_id, vendor_id, material_type_id, quantity, unit_price } = req.body;
            const total_amount = parseFloat(quantity) * parseFloat(unit_price || 0);

            const { rows } = await client.query(`
                INSERT INTO swms_inbounds (site_id, project_id, inbound_date, warehouse_id, vendor_id, material_type_id, quantity, unit_price, total_amount, status)
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'CONFIRMED')
                RETURNING *
            `, [site_id, project_id, inbound_date, warehouse_id, vendor_id, material_type_id, quantity, unit_price, total_amount]);

            // Increase Inventory
            await client.query(`
                INSERT INTO swms_inventory (site_id, warehouse_id, material_type_id, quantity, last_updated_at)
                VALUES ($1, $2, $3, $4, NOW())
                ON CONFLICT (site_id, warehouse_id, material_type_id) 
                DO UPDATE SET quantity = swms_inventory.quantity + EXCLUDED.quantity, last_updated_at = NOW()
            `, [site_id, warehouse_id, material_type_id, quantity]);

            await client.query('COMMIT');
            res.status(201).json(rows[0]);
        } catch (e) {
            await client.query('ROLLBACK');
            res.status(500).json({ error: e.message });
        } finally {
            client.release();
        }
    });

    router.delete('/inbounds/:id', async (req, res) => {
        const client = await pool.connect();
        try {
            await client.query('BEGIN');
            const { id } = req.params;

            // Get record to decrease inventory
            const { rows } = await client.query('SELECT * FROM swms_inbounds WHERE id=$1', [id]);
            if (rows.length === 0) throw new Error('Record not found');
            const inbound = rows[0];

            await client.query('DELETE FROM swms_inbounds WHERE id = $1', [id]);

            // Decrease Inventory
            if (inbound.warehouse_id && inbound.material_type_id) {
                // Upsert to handle potential negative if anomaly, but typically update
                // Note: We subtract
                await client.query(`
                    INSERT INTO swms_inventory (site_id, warehouse_id, material_type_id, quantity, last_updated_at)
                    VALUES ($1, $2, $3, $4, NOW())
                    ON CONFLICT (site_id, warehouse_id, material_type_id) 
                    DO UPDATE SET quantity = swms_inventory.quantity - EXCLUDED.quantity, last_updated_at = NOW()
                `, [inbound.site_id, inbound.warehouse_id, inbound.material_type_id, inbound.quantity]); // Pass positive quantity
            }

            await client.query('COMMIT');
            res.json({ message: 'Deleted' });
        } catch (e) {
            await client.query('ROLLBACK');
            res.status(500).json({ error: e.message });
        } finally {
            client.release();
        }
    });

    // --- Outbound (Sales) Routes ---
    router.get('/outbounds', async (req, res) => {
        try {
            const { site_id } = req.query;
            let query = `
                SELECT o.*, m.name as material_name, v.name as vendor_name, 
                       CASE WHEN w.name IS NULL THEN '기본 창고' ELSE w.name END as warehouse_name
                FROM swms_outbounds o
                LEFT JOIN swms_material_types m ON o.material_type_id = m.id
                LEFT JOIN swms_vendors v ON o.vendor_id = v.id
                LEFT JOIN swms_warehouses w ON o.warehouse_id = w.id
            `;
            if (site_id) {
                query += ' WHERE o.site_id = $1';
            }
            query += ' ORDER BY o.outbound_date DESC';
            const { rows } = await pool.query(query, site_id ? [site_id] : []);
            res.json(rows);
        } catch (e) { res.status(500).json({ error: e.message }); }
    });

    router.post('/outbounds', async (req, res) => {
        try {
            const { site_id, project_id, outbound_date, warehouse_id, vendor_id, material_type_id, quantity, unit_price } = req.body;
            const total_amount = parseFloat(quantity) * parseFloat(unit_price);

            const { rows } = await pool.query(`
                INSERT INTO swms_outbounds (site_id, project_id, outbound_date, warehouse_id, vendor_id, material_type_id, quantity, unit_price, total_amount, status)
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'PENDING')
                RETURNING *
            `, [site_id, project_id, outbound_date, warehouse_id, vendor_id, material_type_id, quantity, unit_price, total_amount]);
            res.status(201).json(rows[0]);
        } catch (e) { res.status(500).json({ error: e.message }); }
    });

    router.post('/outbounds/:id/approve', async (req, res) => {
        const client = await pool.connect();
        try {
            await client.query('BEGIN');
            const { id } = req.params;

            const { rows } = await client.query(`UPDATE swms_outbounds SET status='APPROVED' WHERE id=$1 RETURNING *`, [id]);
            if (rows.length === 0) throw new Error('Outbound not found');
            const outbound = rows[0];

            // Update Inventory (Decrease)
            if (outbound.warehouse_id && outbound.material_type_id) {
                await client.query(`
                    INSERT INTO swms_inventory (site_id, warehouse_id, material_type_id, quantity, last_updated_at)
                    VALUES ($1, $2, $3, $4, NOW())
                    ON CONFLICT (site_id, warehouse_id, material_type_id) 
                    DO UPDATE SET quantity = swms_inventory.quantity - EXCLUDED.quantity, last_updated_at = NOW()
                `, [outbound.site_id, outbound.warehouse_id, outbound.material_type_id, Math.abs(outbound.quantity)]); // Stored as positive quantity in Outbound, so we negate in update
            }

            await client.query('COMMIT');
            res.json({ message: 'Approved' });
        } catch (e) {
            await client.query('ROLLBACK');
            res.status(500).json({ error: e.message });
        } finally {
            client.release();
        }
    });

    router.post('/outbounds/:id/reject', async (req, res) => {
        try {
            await pool.query(`UPDATE swms_outbounds SET status='REJECTED' WHERE id=$1`, [req.params.id]);
            res.json({ message: 'Rejected' });
        } catch (e) { res.status(500).json({ error: e.message }); }
    });

    router.delete('/outbounds/:id', async (req, res) => {
        try {
            await pool.query('DELETE FROM swms_outbounds WHERE id = $1', [req.params.id]);
            res.json({ message: 'Deleted' });
        } catch (e) { res.status(500).json({ error: e.message }); }
    });

    // --- Settlement Routes ---
    router.get('/settlements', async (req, res) => {
        try {
            const { site_id } = req.query;
            let query = `
                SELECT s.*, v.name as vendor_name 
                FROM swms_settlements s
                LEFT JOIN swms_vendors v ON s.vendor_id = v.id
            `;
            if (site_id) {
                query += ' WHERE s.site_id = $1';
            }
            query += ' ORDER BY s.created_at DESC';
            const { rows } = await pool.query(query, site_id ? [site_id] : []);
            res.json(rows);
        } catch (e) { res.status(500).json({ error: e.message }); }
    });

    router.get('/settlements/candidates', async (req, res) => {
        try {
            const { site_id, vendor_id, start_date, end_date } = req.query;
            let query = `
                SELECT o.*, m.name as material_name
                FROM swms_outbounds o
                LEFT JOIN swms_material_types m ON o.material_type_id = m.id
                WHERE o.site_id = $1 AND o.vendor_id = $2 AND o.status = 'APPROVED'
                AND o.id NOT IN (SELECT outbound_id FROM swms_settlement_items)
            `;
            const params = [site_id, vendor_id];
            if (start_date) {
                query += ` AND o.outbound_date >= $${params.length + 1}`;
                params.push(start_date);
            }
            if (end_date) {
                query += ` AND o.outbound_date <= $${params.length + 1}`;
                params.push(end_date);
            }
            const { rows } = await pool.query(query, params);
            res.json(rows);
        } catch (e) { res.status(500).json({ error: e.message }); }
    });

    router.post('/settlements', async (req, res) => {
        const client = await pool.connect();
        try {
            await client.query('BEGIN');
            const { site_id, vendor_id, start_date, end_date, outbound_ids } = req.body;

            // Calculate totals
            const { rows: outbounds } = await client.query('SELECT * FROM swms_outbounds WHERE id = ANY($1)', [outbound_ids]);
            const total_supply_price = outbounds.reduce((acc, curr) => acc + parseFloat(curr.total_amount), 0);
            const total_vat = Math.floor(total_supply_price * 0.1);
            const total_amount = total_supply_price + total_vat;

            const { rows: settRows } = await client.query(`
                INSERT INTO swms_settlements (site_id, vendor_id, start_date, end_date, total_supply_price, total_vat, total_amount, status)
                VALUES ($1, $2, $3, $4, $5, $6, $7, 'DRAFT')
                RETURNING *
            `, [site_id, vendor_id, start_date, end_date, total_supply_price, total_vat, total_amount]);
            const settlementId = settRows[0].id;

            for (const oid of outbound_ids) {
                await client.query(`INSERT INTO swms_settlement_items (settlement_id, outbound_id) VALUES ($1, $2)`, [settlementId, oid]);
                await client.query(`UPDATE swms_outbounds SET status='SETTLED' WHERE id=$1`, [oid]);
            }

            await client.query('COMMIT');
            res.status(201).json(settRows[0]);
        } catch (e) {
            await client.query('ROLLBACK');
            res.status(500).json({ error: e.message });
        } finally {
            client.release();
        }
    });

    router.get('/settlements/:id', async (req, res) => {
        try {
            const { id } = req.params;
            const { rows: masters } = await pool.query(`
                SELECT s.*, v.name as vendor_name 
                FROM swms_settlements s
                LEFT JOIN swms_vendors v ON s.vendor_id = v.id
                WHERE s.id = $1
            `, [id]);
            if (masters.length === 0) return res.status(404).send('Not Found');

            const master = masters[0];
            const { rows: items } = await pool.query(`
                SELECT o.*, m.name as material_name, w.name as warehouse_name
                FROM swms_settlement_items si
                JOIN swms_outbounds o ON si.outbound_id = o.id
                LEFT JOIN swms_material_types m ON o.material_type_id = m.id
                LEFT JOIN swms_warehouses w ON o.warehouse_id = w.id
                WHERE si.settlement_id = $1
            `, [id]);
            master.items = items;
            res.json(master);
        } catch (e) { res.status(500).json({ error: e.message }); }
    });

    router.post('/settlements/:id/confirm', async (req, res) => {
        try {
            const taxNo = `TAX-${Date.now()}`;
            await pool.query(`UPDATE swms_settlements SET status='CONFIRMED', tax_invoice_no=$1 WHERE id=$2`, [taxNo, req.params.id]);
            res.json({ message: 'Confirmed' });
        } catch (e) { res.status(500).json({ error: e.message }); }
    });

    router.delete('/settlements/:id', async (req, res) => {
        const client = await pool.connect();
        try {
            await client.query('BEGIN');
            const { id } = req.params;

            // Release outbounds back to APPROVED
            await client.query(`
                UPDATE swms_outbounds SET status='APPROVED' 
                WHERE id IN (SELECT outbound_id FROM swms_settlement_items WHERE settlement_id = $1)
            `, [id]);

            await client.query('DELETE FROM swms_settlements WHERE id = $1', [id]);
            await client.query('COMMIT');
            res.json({ message: 'Deleted' });
        } catch (e) {
            await client.query('ROLLBACK');
            res.status(500).json({ error: e.message });
        } finally {
            client.release();
        }
    });

    // --- Summary Route ---
    router.get('/summary', async (req, res) => {
        // Mock data for SWMS dashboard summary stats
        const summaryBlock = {
            source_module: 'SWMS',
            total_outbound_weight: 145.2,
            revenue_estimated: 52000000,
            item_breakdown: { "iron": 90.0, "copper": 8.5, "waste": 46.7 },
            abnormal_transactions: 0,
            highlights: ["구리 시세 상승으로 수익률 5% 증가", "A구역 폐기물 반출 완료"]
        };
        await new Promise(r => setTimeout(r, 100)); // Sim delay
        res.json(summaryBlock);
    });

    return router;
};
