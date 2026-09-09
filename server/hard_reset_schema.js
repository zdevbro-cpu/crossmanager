const { Pool } = require('pg');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env.local') });

const pool = new Pool({
    user: process.env.DB_USER,
    host: process.env.DB_HOST,
    database: process.env.DB_NAME,
    password: process.env.DB_PASSWORD,
    port: process.env.DB_PORT || 5432,
    ssl: false
});

async function reset() {
    try {
        console.log('--- Hard Resetting Documents Schema ---');
        await pool.query('DROP TABLE IF EXISTS document_shares CASCADE');
        await pool.query('DROP TABLE IF EXISTS document_approvals CASCADE');
        await pool.query('DROP TABLE IF EXISTS document_versions CASCADE');
        await pool.query('DROP TABLE IF EXISTS documents CASCADE');

        await pool.query(`
            CREATE TABLE documents (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                project_id UUID,
                category VARCHAR(100),
                type VARCHAR(100),
                name VARCHAR(255) NOT NULL,
                status VARCHAR(50) DEFAULT 'DRAFT',
                current_version VARCHAR(20) DEFAULT 'v1',
                security_level VARCHAR(50) DEFAULT 'NORMAL',
                metadata JSONB,
                review_status VARCHAR(50),
                created_by UUID,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE document_versions (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                document_id UUID REFERENCES documents(id) ON DELETE CASCADE,
                version VARCHAR(20) NOT NULL,
                file_path TEXT NOT NULL,
                file_size BIGINT,
                file_hash VARCHAR(255),
                change_log TEXT,
                file_content TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `);
        console.log('✅ Schema reset completed.');
    } catch (err) {
        console.error('❌ Error during reset:', err.message);
    } finally {
        await pool.end();
    }
}
reset();
