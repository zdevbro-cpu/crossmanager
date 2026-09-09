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

async function addColumn() {
    const client = await pool.connect();
    try {
        await client.query(`
            ALTER TABLE sms_education_attendees 
            ADD COLUMN IF NOT EXISTS worker_agency VARCHAR(100)
        `);
        console.log('Column worker_agency added successfully');
    } catch (err) {
        console.error('Error:', err.message);
    } finally {
        client.release();
        pool.end();
    }
}

addColumn();
