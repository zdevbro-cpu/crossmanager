// Migration script to add Firebase Storage columns to contracts table
// Run with: node add_contract_attachment_columns.js

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

async function migrate() {
    try {
        console.log('🔄 Starting migration: Add contract attachment columns...')

        await pool.query(`
            ALTER TABLE contracts 
            ADD COLUMN IF NOT EXISTS attachment_path TEXT,
            ADD COLUMN IF NOT EXISTS attachment_size BIGINT,
            ADD COLUMN IF NOT EXISTS attachment_name VARCHAR(255)
        `)

        console.log('✅ Columns added successfully')

        // Verify columns exist
        const result = await pool.query(`
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name = 'contracts' 
            AND column_name IN ('attachment_path', 'attachment_size', 'attachment_name')
        `)

        console.log(`✅ Verified ${result.rows.length}/3 columns exist:`)
        result.rows.forEach(row => console.log(`   - ${row.column_name}`))

    } catch (error) {
        console.error('❌ Migration failed:', error.message)
        process.exit(1)
    } finally {
        await pool.end()
    }
}

migrate()
