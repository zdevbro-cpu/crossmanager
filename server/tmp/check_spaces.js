const { Pool } = require('pg');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env.local') });

const pool = new Pool({
    connectionString: process.env.DATABASE_URL || `postgresql://${process.env.DB_USER}:${process.env.DB_PASSWORD}@${process.env.DB_HOST}:${process.env.DB_PORT}/${process.env.DB_NAME}`,
    ssl: false
});

async function check() {
    try {
        console.log('[Check] JSON Raw Data 조사...');
        const res = await pool.query(`
            SELECT id, name, category, LENGTH(category) as clen, 
                   sub_category, LENGTH(sub_category) as slen, project_id
            FROM documents
            WHERE category LIKE '00_공무_행정%'
            LIMIT 5
        `);
        console.log(JSON.stringify(res.rows, null, 2));
    } catch (err) {
        console.error('[Check] 오류:', err.message);
    } finally {
        await pool.end();
    }
}

check();
