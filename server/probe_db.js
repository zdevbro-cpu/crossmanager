const { Pool } = require('pg');
const pool = new Pool({
    user: 'postgres',
    host: '127.0.0.1',
    database: 'postgres',
    password: 'Cross0371_',
    port: 5432,
    ssl: false
});

async function check() {
    try {
        console.log('--- Probing Cloud SQL ---');
        const res = await pool.query("SELECT column_name FROM information_schema.columns WHERE table_name = 'documents'");
        console.log('COLUMNS:', res.rows.map(r => r.column_name).join(', '));
        
        const docs = await pool.query("SELECT category, COUNT(*) FROM documents GROUP BY category");
        console.log('CURRENT_DATA_SUMMARY:', docs.rows);
        
    } catch (e) {
        console.error('DB_PROBE_ERROR:', e.message);
    } finally {
        await pool.end();
    }
}
check();
