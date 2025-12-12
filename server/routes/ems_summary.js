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

    return router;
};
