
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

const email = 'zdevbro@gmail.com'

async function forceApprove() {
    try {
        console.log(`Checking user: ${email}...`)
        const res = await pool.query("SELECT * FROM users WHERE email = $1", [email])

        if (res.rows.length === 0) {
            console.log('User not found in DB. Please log in once to trigger auto-registration, then run this script again.')
        } else {
            console.log('User found. Updating status to approved and role to sysadmin...')
            await pool.query("UPDATE users SET status = 'approved', role = 'sysadmin' WHERE email = $1", [email])
            console.log('Success! User is now approved System Admin.')
        }
    } catch (err) {
        console.error(err)
    } finally {
        await pool.end()
    }
}

forceApprove()
