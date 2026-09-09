const { Pool } = require('pg')
require('dotenv').config()

const pool = new Pool({
    user: process.env.DB_USER,
    host: process.env.DB_HOST,
    database: process.env.DB_NAME,
    password: process.env.DB_PASSWORD,
    port: process.env.DB_PORT || 5432,
    ssl: { rejectUnauthorized: false }
})

async function showProjectIds() {
    const client = await pool.connect()
    try {
        const result = await client.query('SELECT id, code, name FROM projects ORDER BY code')
        console.log('\nProject IDs:')
        console.log('='.repeat(80))
        result.rows.forEach(row => {
            console.log(`ID: ${row.id}`)
            console.log(`Code: ${row.code}`)
            console.log(`Name: ${row.name}`)
            console.log('-'.repeat(80))
        })
    } catch (err) {
        console.error('Error:', err.message)
    } finally {
        client.release()
        pool.end()
    }
}

showProjectIds()
