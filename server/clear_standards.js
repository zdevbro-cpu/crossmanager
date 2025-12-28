const { Pool } = require('pg');
const path = require('path');
const fs = require('fs');

// Load env
const customerEnvPath = path.join(__dirname, 'env_customer.env');
if (fs.existsSync(customerEnvPath)) {
    require('dotenv').config({ path: customerEnvPath });
} else {
    require('dotenv').config({ path: path.join(__dirname, '.env') });
}

// Mimic server/index.js logic
const dbConfig = {
    user: process.env.DB_USER,
    database: process.env.DB_NAME,
    password: process.env.DB_PASSWORD,
    port: process.env.DB_PORT || 5432,
    host: process.env.DB_HOST || 'localhost',
    ssl: { rejectUnauthorized: false } // FORCE SSL
};

const pool = new Pool(dbConfig);

async function clearTable() {
    try {
        console.log('Connecting to DB...', dbConfig.host);
        const client = await pool.connect();

        console.log('Truncating sms_risk_standard_items...');
        await client.query('TRUNCATE TABLE sms_risk_standard_items CASCADE');
        console.log('Successfully cleared standard DB.');
        client.release();
    } catch (err) {
        console.error('Error clearing table:', err);
    } finally {
        await pool.end();
    }
}

clearTable();
