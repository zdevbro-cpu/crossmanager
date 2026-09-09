
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
const http = require('http');
require('dotenv').config();

const pool = new Pool({
    user: process.env.DB_USER,
    host: process.env.DB_HOST,
    database: process.env.DB_NAME,
    password: process.env.DB_PASSWORD,
    port: process.env.DB_PORT,
});

async function verify() {
    try {
        console.log('--- 1. Checking Database ---');
        // Get a document
        const res = await pool.query(`
            SELECT d.id, d.name, d.current_version, v.file_path, v.version
            FROM documents d
            JOIN document_versions v ON d.id = v.document_id
            WHERE d.current_version = v.version
            LIMIT 1
        `);

        if (res.rows.length === 0) {
            console.log('No documents found in DB.');
            return;
        }

        const doc = res.rows[0];
        console.log('Found Document:', doc);

        // Calculate expected Clean URL
        const ext = path.extname(doc.file_path).replace('.', '');
        const safeName = doc.name.replace(/[^a-zA-Z0-9가-힣\s\-_.]/g, '').trim();
        const cleanFilename = encodeURIComponent(`${safeName}.${ext}`);

        const testUrlWithFile = `http://localhost:3007/api/docview/${doc.id}/${cleanFilename}`;
        const testUrlSimple = `http://localhost:3007/api/docview/${doc.id}`;

        console.log('\n--- 2. Testing Simple URL (Old) ---');
        await testUrl(testUrlSimple);

        console.log('\n--- 3. Testing Clean URL (New) ---');
        await testUrl(testUrlWithFile);

    } catch (err) {
        console.error('Verification Failed:', err);
    } finally {
        pool.end();
    }
}

function testUrl(url) {
    return new Promise((resolve) => {
        console.log(`Requesting: ${url}`);
        http.get(url, (res) => {
            console.log(`Status: ${res.statusCode}`);
            console.log(`Headers:`, {
                'content-type': res.headers['content-type'],
                'content-disposition': res.headers['content-disposition']
            });

            // Consume data to clear buffer
            res.on('data', () => { });
            res.on('end', () => resolve());
        }).on('error', (e) => {
            console.error(`Error requesting ${url}:`, e.message);
            resolve();
        });
    });
}

verify();
