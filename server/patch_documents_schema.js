const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
    user: process.env.DB_USER,
    host: process.env.DB_HOST,
    database: process.env.DB_NAME,
    password: process.env.DB_PASSWORD,
    port: process.env.DB_PORT || 5432,
    ssl: { rejectUnauthorized: false }
});

async function patchSchema() {
    try {
        console.log('Patching schema to add file_content column...');
        await pool.query('ALTER TABLE document_versions ADD COLUMN IF NOT EXISTS file_content TEXT');
        console.log('✅ Schema patched successfully.');
    } catch (err) {
        console.error('❌ Error patching schema:', err);
    } finally {
        await pool.end();
    }
}

patchSchema();
