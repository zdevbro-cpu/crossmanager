const { Pool } = require('pg');
require('dotenv').config({ path: 'env_customer.env' });

const pool = new Pool({
    user: process.env.DB_USER,
    host: process.env.DB_HOST,
    database: process.env.DB_NAME,
    password: process.env.DB_PASSWORD,
    port: process.env.DB_PORT || 5432,
    ssl: { rejectUnauthorized: false }
});

pool.query("SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name", (err, res) => {
    if (err) {
        console.error('Error fetching tables:', err.message);
    } else {
        console.log('--- ACTUAL DB TABLES ---');
        res.rows.forEach(r => console.log(r.table_name));
        console.log('------------------------');
        console.log(`Total Tables Found: ${res.rows.length}`);
    }
    pool.end();
});
