const express = require('express');
const router = express.Router();

module.exports = (pool) => {
    // GET /api/ems/summary
    // Returns equipment utilization, maintenance cost, etc.
    router.get('/summary', async (req, res) => {
        // In a real implementation, this would query ems_logs, ems_maintenance tables.
        // For now, return mock data adhering to the defined schema.
        const summaryBlock = {
            source_module: 'EMS',
            utilization_rate: 87.5, // %
            active_equipment_count: 14,
            breakdown_incidents: 1,
            maintenance_cost_summary: 1250000, // KRW
            critical_equipment_status: "NORMAL",
            highlights: [
                "1호기 굴삭기 엔진 오일 교체 완료",
                "지게차 3호기 타이어 마모 주의"
            ]
        };

        // Simulating async db delay
        await new Promise(r => setTimeout(r, 100));

        res.json(summaryBlock);
    });

    // GET /api/ems/equipment
    // Returns a list of equipment
    router.get('/equipment', async (req, res) => {
        try {
            // Check auth header if needed, but for now allow fetching
            const result = await pool.query('SELECT * FROM equipment ORDER BY created_at DESC');
            res.json(result.rows);
        } catch (err) {
            console.error(err);
            res.status(500).json({ error: 'Failed to fetch equipment list' });
        }
    });

    // POST /api/ems/equipment
    // Create new equipment
    router.post('/equipment', async (req, res) => {
        try {
            const {
                equipment_id, name, category, manufacturer,
                manufacture_year, serial_number, acquisition_date,
                equipment_status, supplier, assigned_site
            } = req.body;

            const result = await pool.query(
                `INSERT INTO equipment (
                    id, equipment_id, name, category, manufacturer,
                    manufacture_year, serial_number, acquisition_date,
                    equipment_status, supplier, assigned_site
                ) VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
                RETURNING *`,
                [
                    equipment_id, name, category, manufacturer,
                    manufacture_year, serial_number, acquisition_date,
                    equipment_status, supplier, assigned_site
                ]
            );
            res.json(result.rows[0]);
        } catch (err) {
            console.error(err);
            res.status(500).json({ error: 'Failed to create equipment' });
        }
    });

    // DELETE /api/ems/equipment/:id
    router.delete('/equipment/:id', async (req, res) => {
        try {
            const { id } = req.params;
            const result = await pool.query('DELETE FROM equipment WHERE id = $1 RETURNING id', [id]);
            if (result.rowCount === 0) {
                return res.status(404).json({ error: 'Equipment not found' });
            }
            res.json({ message: 'Deleted successfully' });
        } catch (err) {
            console.error(err);
            res.status(500).json({ error: 'Failed to delete equipment' });
        }
    });

    // GET /api/ems/equipment/:id
    router.get('/equipment/:id', async (req, res) => {
        try {
            const { id } = req.params;
            const result = await pool.query('SELECT * FROM equipment WHERE id = $1', [id]);
            if (result.rows.length === 0) {
                return res.status(404).json({ error: 'Equipment not found' });
            }
            res.json(result.rows[0]);
        } catch (err) {
            console.error(err);
            res.status(500).json({ error: 'Failed to fetch equipment' });
        }
    });

    return router;
};
