const { Pool } = require('pg');
const path = require('path');
const fs = require('fs');

const envPath = path.join(__dirname, '.env.local');
require('dotenv').config({ path: envPath });

const pool = new Pool({
    user: process.env.DB_USER,
    host: process.env.DB_HOST,
    database: process.env.DB_NAME,
    password: process.env.DB_PASSWORD,
    port: process.env.DB_PORT || 5432,
    ssl: false // Force disable SSL for local init
});

async function run() {
    try {
        console.log('--- Initializing All Tables for NEW cross_manager DB ---');

        // 1. Core Tables (Projects, Contracts)
        console.log('Creating Contracts tables...');
        await pool.query(`
            CREATE TABLE IF NOT EXISTS projects (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                code VARCHAR(50) UNIQUE,
                name VARCHAR(255),
                status VARCHAR(20) DEFAULT 'ACTIVE',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS contracts (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
                code VARCHAR(50) UNIQUE,
                name VARCHAR(255),
                total_amount DECIMAL(15, 2) DEFAULT 0,
                status VARCHAR(20) DEFAULT 'DRAFT',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `);

        // 2. Documents 테이블 (DMS 기초)
        console.log('Creating DMS tables...');
        await pool.query(`
            CREATE TABLE IF NOT EXISTS documents (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                project_id UUID,
                category VARCHAR(50),
                type VARCHAR(100),
                name VARCHAR(255) NOT NULL,
                status VARCHAR(20) DEFAULT 'DRAFT',
                current_version VARCHAR(20) DEFAULT 'v1',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
            
            CREATE TABLE IF NOT EXISTS document_versions (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                document_id UUID REFERENCES documents(id) ON DELETE CASCADE,
                version VARCHAR(20) NOT NULL,
                file_path TEXT NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `);

        console.log('✅ Basic database setup completed.');
    } catch (err) {
        console.error('❌ Error during setup:', err.message);
    } finally {
        await pool.end();
    }
}

run();
