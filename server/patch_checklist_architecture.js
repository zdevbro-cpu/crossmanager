const { Pool } = require('pg');
require('dotenv').config();

const dbConfig = {
    user: process.env.DB_USER,
    database: process.env.DB_NAME,
    password: process.env.DB_PASSWORD,
    port: process.env.DB_PORT || 5432,
    host: process.env.DB_HOST || 'localhost'
};

if (process.env.DB_HOST && process.env.DB_HOST.startsWith('/cloudsql')) {
    dbConfig.host = process.env.DB_HOST;
} else {
    dbConfig.ssl = { rejectUnauthorized: false };
}

const pool = new Pool(dbConfig);

async function patchSchema() {
    const client = await pool.connect();
    try {
        console.log('Starting Checklist Architecture Patch...');

        await client.query('BEGIN');

        // 1. sms_checklist_templates (Refine existing or create new)
        // We add specific columns for better management
        console.log('Updating sms_checklist_templates...');

        // Check if table exists, if so, we might need to alter it, or just ensure columns
        await client.query(`
            CREATE TABLE IF NOT EXISTS sms_checklist_templates (
                id VARCHAR(50) PRIMARY KEY,
                title VARCHAR(255) NOT NULL,
                items JSONB,
                category VARCHAR(100),
                updated_at DATE DEFAULT CURRENT_DATE
            )
        `);

        // Add version column if not exists
        await client.query(`
            ALTER TABLE sms_checklist_templates 
            ADD COLUMN IF NOT EXISTS version INTEGER DEFAULT 1,
            ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE,
            ADD COLUMN IF NOT EXISTS description TEXT
        `);


        // 2. sms_checklists (The Immutable Evidence Record)
        // We need 'immutable_snapshot' and 'status'
        console.log('Updating sms_checklists...');

        await client.query(`
            CREATE TABLE IF NOT EXISTS sms_checklists (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                project_id UUID,
                template_id VARCHAR(50),
                title VARCHAR(255),
                status VARCHAR(50) DEFAULT 'COMPLETED',
                results JSONB,
                created_by VARCHAR(100),
                created_at TIMESTAMP DEFAULT CURRENT_DATE
            )
        `);

        // Add Immutable Snapshot Column
        await client.query(`
            ALTER TABLE sms_checklists 
            ADD COLUMN IF NOT EXISTS immutable_snapshot JSONB,
            ADD COLUMN IF NOT EXISTS submitted_at TIMESTAMP,
            ADD COLUMN IF NOT EXISTS weather_info JSONB,
            ADD COLUMN IF NOT EXISTS location_info JSONB
        `);

        // Ensure status column standard
        // We want 'DRAFT' and 'SUBMITTED' mainly.
        // Existing data might be 'COMPLETED'.

        await client.query('COMMIT');
        console.log('Checklist Architecture Patch Applied Successfully.');

    } catch (e) {
        await client.query('ROLLBACK');
        console.error('Failed to patch schema:', e);
    } finally {
        client.release();
        pool.end();
    }
}

patchSchema();
