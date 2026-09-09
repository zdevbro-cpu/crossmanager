
const { Pool } = require('pg');
const path = require('path');
const fs = require('fs');
require('dotenv').config({ path: path.join(__dirname, 'env_customer.env') });

const dbConfig = {
    user: process.env.DB_USER,
    database: process.env.DB_NAME,
    password: process.env.DB_PASSWORD,
    port: process.env.DB_PORT || 5432,
    host: process.env.DB_HOST || 'localhost'
};

const pool = new Pool(dbConfig);
const targetId = 'f235d7fe-5159-4650-bb6f-beccf7ef4616';

async function probe() {
    try {
        console.log('--- Probing Database:', dbConfig.database, '---');
        const docRes = await pool.query('SELECT id, name, current_version FROM documents WHERE id = $1', [targetId]);
        console.log('Document Details:', docRes.rows);
        
        const verRes = await pool.query('SELECT document_id, version, file_path FROM document_versions WHERE document_id = $1', [targetId]);
        console.log('Version Details:', verRes.rows);
        
        if (docRes.rows.length > 0 && verRes.rows.length > 0) {
            const doc = docRes.rows[0];
            const matchingVer = verRes.rows.find(v => v.version === doc.current_version);
            if (!matchingVer) {
                console.log('CRITICAL: Version Mismatch Found! Current version in doc table is', doc.current_version, 'but versions in hist are', verRes.rows.map(v => v.version));
                const firstVer = verRes.rows[0].version;
                console.log('Fixing: Updating documents table current_version to', firstVer);
                await pool.query('UPDATE documents SET current_version = $1 WHERE id = $2', [firstVer, targetId]);
                console.log('SUCCESS: Version Fixed.');
            } else {
                console.log('SUCCESS: Version Match OK (Version:', doc.current_version, 'Path:', matchingVer.file_path, ')');
            }
        } else {
            console.log('ERROR: Document or Version history not found for ID:', targetId);
        }
    } catch (e) {
        console.error('Probe Failed:', e);
    } finally {
        await pool.end();
    }
}

probe();
