require('dotenv').config()
const { Pool } = require('pg')

const pool = new Pool({
    user: process.env.DB_USER,
    host: process.env.DB_HOST,
    database: process.env.DB_NAME,
    password: process.env.DB_PASSWORD,
    port: process.env.DB_PORT || 5432,
    ssl: { rejectUnauthorized: false }
})

async function check() {
    try {
        // Check contract
        const contract = await pool.query("SELECT * FROM contracts WHERE name LIKE '%7차%' LIMIT 1")
        console.log('Contract:', contract.rows[0]?.name, 'ID:', contract.rows[0]?.id)

        if (contract.rows[0]) {
            // Check items
            const items = await pool.query('SELECT * FROM contract_items WHERE contract_id = $1', [contract.rows[0].id])
            console.log('Items count:', items.rows.length)
            console.log('Items:', items.rows)
        }
    } catch (err) {
        console.error('Error:', err)
    } finally {
        pool.end()
    }
}

check()
