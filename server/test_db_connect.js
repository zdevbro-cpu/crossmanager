const { Pool } = require('pg');
const path = require('path');
const fs = require('fs');

// Load env_customer.env specifically
const envPath = path.join(__dirname, 'env_customer.env');
if (!fs.existsSync(envPath)) {
    console.error('env_customer.env not found!');
    process.exit(1);
}
require('dotenv').config({ path: envPath });

console.log('Testing DB Access for:', process.env.DB_HOST);

const pool = new Pool({
    user: process.env.DB_USER,
    host: process.env.DB_HOST,
    database: process.env.DB_NAME,
    password: process.env.DB_PASSWORD,
    port: process.env.DB_PORT || 5432,
    ssl: { rejectUnauthorized: false } // Cloud SQL often needs this or valid certs
});

pool.connect((err, client, release) => {
    if (err) {
        console.error('Connection Error:', err.message);
        process.exit(1);
    }
    console.log('Successfully connected to Customer DB!');
    client.query('SELECT NOW()', (err, result) => {
        release();
        if (err) {
            console.error('Query Error:', err.message);
            process.exit(1);
        }
        console.log('DB Time:', result.rows[0].now);
        process.exit(0);
    });
});
