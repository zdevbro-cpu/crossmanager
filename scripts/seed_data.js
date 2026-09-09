const { Pool } = require('pg');
require('dotenv').config({ path: '../server/.env' });

// Use environment variables for connection
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
        const projRes = await pool.query("INSERT INTO projects (id, name, status) VALUES ('p1', 'Demo Project', 'ACTIVE') ON CONFLICT (id) DO NOTHING RETURNING *");
        console.log('Project ensured:', projRes.rowCount);

        // 2. Insert SMS Data (Checklists/Incidents)
        // Clear old data for demo
        await pool.query("DELETE FROM sms_checklists WHERE project_id = 'p1'");
        await pool.query("INSERT INTO sms_checklists (project_id, date, status, checked_items) VALUES ('p1', NOW(), 'COMPLIANT', '{\"tbm\": true, \"safety_gear\": true}')");

        // 3. Insert EMS Data (Equipment)
        await pool.query("DELETE FROM ems_equipment WHERE project_id = 'p1'");
        await pool.query("INSERT INTO ems_equipment (project_id, name, status, utilization_rate) VALUES ('p1', 'Excavator-01', 'ACTIVE', 85.5)");
        await pool.query("INSERT INTO ems_equipment (project_id, name, status, utilization_rate) VALUES ('p1', 'Crane-02', 'IDLE', 0)");

        // 4. Insert SWMS Data (Waste)
        await pool.query("DELETE FROM swms_waste_logs WHERE project_id = 'p1'");
        await pool.query("INSERT INTO swms_waste_logs (project_id, waste_type, weight_kg, date) VALUES ('p1', 'Concrete', 5000, NOW())");

        console.log('Sample data seeded successfully. Now AI summary should work.');
    } catch (err) {
        console.error('Seeding failed:', err);
    } finally {
        await pool.end();
    }
}

seed();
