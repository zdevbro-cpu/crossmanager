const { Pool } = require('pg');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env.local') });

const pool = new Pool({
    connectionString: process.env.DATABASE_URL || `postgresql://${process.env.DB_USER}:${process.env.DB_PASSWORD}@${process.env.DB_HOST}:${process.env.DB_PORT}/${process.env.DB_NAME}`,
    ssl: false
});

async function remap() {
    try {
        console.log('[Remap] PRJ-2401 프로젝트 ID 조회 중...');
        const projRes = await pool.query("SELECT id FROM projects WHERE code='PRJ-2401' LIMIT 1");
        if (projRes.rows.length === 0) {
            throw new Error('PRJ-2401 프로젝트를 찾을 수 없습니다.');
        }
        const targetId = projRes.rows[0].id;
        console.log(`[Remap] 타겟 UUID: ${targetId}`);

        const updateRes = await pool.query("UPDATE documents SET project_id = $1", [targetId]);
        console.log(`[Remap] 성공! 총 ${updateRes.rowCount}개의 문서를 PRJ-2401로 이주시켰습니다.`);
        
    } catch (err) {
        console.error('[Remap] 오류:', err.message);
    } finally {
        await pool.end();
    }
}

remap();
