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

const sql = `
-- Drop tables if they exist (to ensure fresh creation for these specific tables)
DROP TABLE IF EXISTS document_shares CASCADE;
DROP TABLE IF EXISTS document_approvals CASCADE;
DROP TABLE IF EXISTS document_versions CASCADE;
DROP TABLE IF EXISTS documents CASCADE;

-- 1. Documents Master
CREATE TABLE documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID, -- References projects(id) but we won't enforce FK strictly if projects table is empty or different schema
    category VARCHAR(50), 
    type VARCHAR(100),
    name VARCHAR(255) NOT NULL,
    status VARCHAR(20) DEFAULT 'DRAFT',
    current_version VARCHAR(20) DEFAULT 'v1',
    security_level VARCHAR(20) DEFAULT 'NORMAL',
    metadata JSONB,
    review_status VARCHAR(20),
    created_by UUID,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 2. Versions
CREATE TABLE document_versions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    document_id UUID REFERENCES documents(id) ON DELETE CASCADE,
    version VARCHAR(20) NOT NULL,
    file_path TEXT NOT NULL,
    file_size BIGINT,
    file_hash VARCHAR(255),
    change_log TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 3. Approvals
CREATE TABLE document_approvals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    version_id UUID REFERENCES document_versions(id) ON DELETE CASCADE,
    approver_id UUID,
    step_order INT DEFAULT 1,
    status VARCHAR(20) DEFAULT 'WAITING',
    comment TEXT,
    signature_url TEXT,
    action_at TIMESTAMP
);

-- 4. Shares
CREATE TABLE document_shares (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    document_id UUID REFERENCES documents(id) ON DELETE CASCADE,
    token VARCHAR(255) UNIQUE NOT NULL,
    expires_at TIMESTAMP,
    access_count INT DEFAULT 0,
    created_by UUID
);
`;

async function initDocuments() {
    try {
        console.log('Initializing Document Management tables...');
        await pool.query(sql);
        console.log('✅ Document Management tables created successfully.');

        // Add some sample data if needed (Skipped for now)

    } catch (err) {
        console.error('❌ Error initializing tables:', err);
    } finally {
        await pool.end();
    }
}

initDocuments();
