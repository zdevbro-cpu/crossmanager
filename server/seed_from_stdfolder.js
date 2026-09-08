const { Pool } = require('pg');
const path = require('path');
const fs = require('fs');

const envPath = path.join(__dirname, '.env.local');
require('dotenv').config({ path: envPath });

const pool = new Pool({
    user: process.env.DB_USER, host: process.env.DB_HOST, database: process.env.DB_NAME,
    password: process.env.DB_PASSWORD, port: process.env.DB_PORT || 5432, ssl: false
});

const STD_FOLDER_ROOT = 'C:\\ProjectCode\\Cross\\Data\\CrossDoc\\StdFolder';

function parseFilename(filename) {
    const nameWithoutExt = path.parse(filename).name;
    const parts = nameWithoutExt.split('_');
    let date = null;
    let type = 'ETC';
    let title = nameWithoutExt;
    
    if (parts[0] && /^\d{8}$/.test(parts[0])) {
        date = parts[0];
        if (parts[1]) {
            type = parts[1];
            title = parts.slice(2).join('_') || type;
        }
    } else if (parts[0]) {
        type = parts[0];
        title = parts.slice(1).join('_') || type;
    }

    let isoDate = null;
    if (date) {
        const y = date.substring(0,4);
        const m = date.substring(4,6);
        const d = date.substring(6,8);
        const year = parseInt(y);
        const month = parseInt(m) - 1;
        const day = parseInt(d);
        const testDate = new Date(year, month, day);
        if (testDate.getFullYear() === year && testDate.getMonth() === month && testDate.getDate() === day) {
            isoDate = `${y}-${m}-${d}`;
        }
    }

    return { date: isoDate, type: type.substring(0, 100), title: title.substring(0, 255) };
}

async function seed() {
    const client = await pool.connect();
    try {
        console.log('--- Clearing existing document data ---');
        await client.query('TRUNCATE documents, document_versions CASCADE');
        
        const categories = fs.readdirSync(STD_FOLDER_ROOT).filter(f => fs.statSync(path.join(STD_FOLDER_ROOT, f)).isDirectory());
        
        // Find default project
        const projRes = await client.query('SELECT id FROM projects LIMIT 1');
        const defaultProjectId = projRes.rows[0]?.id || null;
        console.log(`Using default project ID: ${defaultProjectId}`);
        
        for (const catName of categories) {
            if (catName === '99_미분류') continue;
            console.log(`Processing category: ${catName}...`);
            const catPath = path.join(STD_FOLDER_ROOT, catName);
            
            const allFiles = [];
            function walk(dir, currentSubFolder = null) {
                const files = fs.readdirSync(dir);
                for (const f of files) {
                    const fullPath = path.join(dir, f);
                    try {
                        const stat = fs.statSync(fullPath);
                        if (stat.isDirectory()) {
                            const nextSubFolder = (dir === catPath) ? f : currentSubFolder;
                            walk(fullPath, nextSubFolder);
                        } else {
                            allFiles.push({ name: f, fullPath, subFolder: currentSubFolder });
                        }
                    } catch (e) {}
                    if (allFiles.length >= 200) break;
                }
            }
            walk(catPath);
            
            for (const fileObj of allFiles) {
                const meta = parseFilename(fileObj.name);
                const createdDate = meta.date || new Date().toISOString().split('T')[0];
                const stats = fs.statSync(fileObj.fullPath);
                const metadata = {
                    ...meta,
                    folderId: fileObj.subFolder || catName,
                    fullPath: fileObj.fullPath,
                    size: (stats.size / 1024 / 1024).toFixed(2) + ' MB'
                };
                
                await client.query('BEGIN');
                try {
                    const docRes = await client.query(`
                        INSERT INTO documents (
                            category, type, name, status, created_at, updated_at, current_version, metadata, project_id
                        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
                        RETURNING id
                    `, [catName, meta.type, meta.title, 'APPROVED', createdDate, createdDate, 'v1', JSON.stringify(metadata), defaultProjectId]);
                    
                    const docId = docRes.rows[0].id;
                    await client.query(`
                        INSERT INTO document_versions (
                            document_id, version, file_path, file_size, change_log, created_at
                        ) VALUES ($1, $2, $3, $4, $5, $6)
                    `, [docId, 'v1', fileObj.fullPath, 0, 'Initial Import from StdFolder', createdDate]);
                    await client.query('COMMIT');
                } catch (e) {
                    await client.query('ROLLBACK');
                    console.error(`  Skipping ${fileObj.name}: ${e.message}`);
                }
            }
        }
        console.log('✅ Seeding completed successfully.');
    } catch (err) {
        console.error('❌ Global seeding error:', err);
    } finally {
        client.release();
        await pool.end();
    }
}
seed();
