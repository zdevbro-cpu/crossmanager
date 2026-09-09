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

pool.query('SELECT id, name FROM documents LIMIT 1', (err, res) => {
    if (err) console.error(err)
    else console.log('DOC_ID:', res.rows[0]?.id, 'NAME:', res.rows[0]?.name)
    pool.end()
})
