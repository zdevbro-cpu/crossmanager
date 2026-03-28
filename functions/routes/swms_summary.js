const express = require('express');
const router = express.Router();

module.exports = (pool) => {
    // GET /api/swms/summary
    // Returns waste/scrap outbound info
    router.get('/summary', async (req, res) => {
        // Mock data for SWMS

        const summaryBlock = {
            source_module: 'SWMS',
            total_outbound_weight: 145.2, // Tons
            revenue_estimated: 52000000, // KRW
            item_breakdown: {
                "iron": 90.0,
                "copper": 8.5,
                "waste": 46.7
            },
            abnormal_transactions: 0,
            highlights: [
                "구리 시세 상승으로 수익률 5% 증가",
                "A구역 폐기물 반출 완료"
            ]
        };

        await new Promise(r => setTimeout(r, 100));

        res.json(summaryBlock);
    });

    return router;
};
