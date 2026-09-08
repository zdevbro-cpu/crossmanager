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
    ssl: false
});

async function addIndexes() {
    try {
        console.log(`--- Adding Performance Indexes to '${process.env.DB_NAME}' ---`);
        
        await pool.query(`
            -- Index for filtering by Project
            CREATE INDEX IF NOT EXISTS idx_documents_project_id ON documents(project_id);
            
            -- Index for filtering by Category/Type
            CREATE INDEX IF NOT EXISTS idx_documents_category ON documents(category);
            CREATE INDEX IF NOT EXISTS idx_documents_type ON documents(type);
            
            -- Index for sorting by Creation Date (Descending)
            CREATE INDEX IF NOT EXISTS idx_documents_created_at_desc ON documents(created_at DESC);
            
            -- Index for Document Versions (performance for JOIN)
            CREATE INDEX IF NOT EXISTS idx_doc_versions_doc_id ON document_versions(document_id);
        `);
        
        console.log('✅ Performance indexes created successfully.');
    } catch (err) {
        console.error('❌ Error adding indexes:', err.message);
    } finally {
        await pool.end();
    }
}

addIndexes();
