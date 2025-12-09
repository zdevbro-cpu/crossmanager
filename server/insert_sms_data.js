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

async function runSQLFile(filename) {
    const client = await pool.connect()
    try {
        const sql = fs.readFileSync(path.join(__dirname, filename), 'utf8')
        console.log(`Executing ${filename}...`)
        await client.query(sql)
        console.log(`✅ ${filename} executed successfully!`)
    } catch (err) {
        console.error(`❌ Error executing ${filename}:`, err.message)
        throw err
    } finally {
        client.release()
    }
}

async function main() {
    try {
        await runSQLFile('sms_sample_data_project2.sql')
        console.log('\n🎉 All sample data inserted successfully!')
        process.exit(0)
    } catch (err) {
        console.error('\n💥 Failed to insert sample data')
        process.exit(1)
    }
}

main()
