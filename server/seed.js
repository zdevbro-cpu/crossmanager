
const { Pool } = require('pg')
const fs = require('fs')
const path = require('path')
require('dotenv').config()

const pool = new Pool({
    user: process.env.DB_USER,
    host: process.env.DB_HOST,
    database: process.env.DB_NAME,
    password: process.env.DB_PASSWORD,
    port: process.env.DB_PORT || 5432,
    ssl: { rejectUnauthorized: false }
})

async function seed() {
    try {
        console.log('Connecting to database...')
        const client = await pool.connect()
        console.log('Connected!')

        const sqlPath = path.join(__dirname, 'init_db.sql')
        const sql = fs.readFileSync(sqlPath, 'utf8')

        console.log('Executing init_db.sql...')
        await client.query(sql)
        console.log('Database initialized successfully with sample data!')

        client.release()
    } catch (err) {
        console.error('Error seeding database:', err)
    } finally {
        await pool.end()
    }
}

seed()
