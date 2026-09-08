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

const projects = [
    { id: 'e63249c5-365e-499f-aa01-c26778fe19c6', code: 'PRJ-2401', name: 'A공장 설비 해체' },
    { id: 'f72158d6-476f-5a0a-bb12-d37889ef20d7', code: 'PRJ-2402', name: 'B타워 철거' }
];

async function seed() {
    try {
        console.log('Seeding projects with UUIDs...');
        for (const p of projects) {
            await pool.query(
                'INSERT INTO projects (id, code, name, status) VALUES ($1, $2, $3, $4) ON CONFLICT (id) DO NOTHING',
                [p.id, p.code, p.name, 'ACTIVE']
            );
        }
        
        console.log('Linking documents to the first project...');
        await pool.query("UPDATE documents SET project_id = $1", [projects[0].id]);
        
        console.log('✅ Projects seeded and documents linked successfully.');
    } catch (err) {
        console.error('❌ Error during seeding projects:', err.message);
    } finally {
        await pool.end();
    }
}
seed();
