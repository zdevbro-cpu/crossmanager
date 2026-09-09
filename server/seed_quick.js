const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
    user: process.env.DB_USER || 'postgres',
    host: process.env.DB_HOST || 'localhost',
    database: process.env.DB_NAME || 'cross_db',
    password: process.env.DB_PASSWORD || 'password',
    port: process.env.DB_PORT || 5432,
});

async function seed() {
    try {
        console.log('Seeding sample data...');

        // 1. Ensure Project 'p1' exists
        const projRes = await pool.query("INSERT INTO projects (id, name, status) VALUES ('p1', 'Demo Project', 'ACTIVE') ON CONFLICT (id) DO NOTHING");

        // 2. Insert SMS Data
        await pool.query("DELETE FROM sms_checklists WHERE project_id = 'p1'");
        await pool.query("INSERT INTO sms_checklists (project_id, date, status, checked_items) VALUES ('p1', NOW(), 'COMPLIANT', '{\"tbm\": true}')");
        await pool.query("INSERT INTO sms_incidents (project_id, date, type, description, status) VALUES ('p1', NOW(), 'NEAR_MISS', 'Slight slip', 'OPEN')");

        // 3. Insert EMS Data
        await pool.query("DELETE FROM ems_equipment WHERE project_id = 'p1'");
        await pool.query("INSERT INTO ems_equipment (project_id, name, status, utilization_rate) VALUES ('p1', 'Excavator-1', 'ACTIVE', 90)");

        // 4. Insert SWMS Data
        await pool.query("DELETE FROM swms_waste_logs WHERE project_id = 'p1'");
        await pool.query("INSERT INTO swms_waste_logs (project_id, waste_type, weight_kg, date) VALUES ('p1', 'Concrete', 2000, NOW())");

        console.log('Done.');
    } catch (err) {
        console.error('Error:', err);
    } finally {
        await pool.end();
    }
}

seed();
