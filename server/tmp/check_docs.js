const { Pool } = require('pg');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env.local') });

const pool = new Pool({
    connectionString: process.env.DATABASE_URL || `postgresql://${process.env.DB_USER}:${process.env.DB_PASSWORD}@${process.env.DB_HOST}:${process.env.DB_PORT}/${process.env.DB_NAME}`,
    ssl: false
});

async function check() {
    try {
        console.log('[Check] DB 연결 중...');
        const res = await pool.query(`
            SELECT p.id as proj_uuid, p.code, p.name as proj_name, d.project_id as doc_proj_id, d.name as doc_name, d.category, d.sub_category
            FROM documents d
            LEFT JOIN projects p ON d.project_id = p.id
            ORDER BY p.code ASC
            LIMIT 50
        `);
        console.log('[Check] 문서별 UUID 매핑 현황:');
        console.table(res.rows.map(r => ({
            proj_uuid: r.proj_uuid,
            doc_proj_id: r.doc_proj_id,
            match: r.proj_uuid === r.doc_proj_id,
            code: r.code,
            doc: r.doc_name,
            cat: r.category,
            sub: r.sub_category
        })));
    } catch (err) {
        console.error('[Check] 오류:', err.message);
    } finally {
        await pool.end();
    }
}

check();
