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

async function checkData() {
    const client = await pool.connect()
    try {
        console.log('SMS Data Summary by Project')
        console.log('='.repeat(60))

        const projects = await client.query('SELECT id, code, name FROM projects ORDER BY code')

        for (const project of projects.rows) {
            console.log(`\nProject: ${project.name}`)

            const counts = await Promise.all([
                client.query('SELECT COUNT(*) FROM sms_risk_assessments WHERE project_id = $1', [project.id]),
                client.query('SELECT COUNT(*) FROM sms_dris WHERE project_id = $1', [project.id]),
                client.query('SELECT COUNT(*) FROM sms_checklists WHERE project_id = $1', [project.id]),
                client.query('SELECT COUNT(*) FROM sms_patrols WHERE project_id = $1', [project.id]),
                client.query('SELECT COUNT(*) FROM sms_educations WHERE project_id = $1', [project.id]),
                client.query('SELECT COUNT(*) FROM sms_incidents WHERE project_id = $1', [project.id]),
                client.query('SELECT COUNT(*) FROM sms_documents WHERE project_id = $1', [project.id]),
                client.query('SELECT COUNT(*) FROM sms_personnel WHERE project_id = $1', [project.id])
            ])

            console.log(`  Risk Assessments: ${counts[0].rows[0].count}`)
            console.log(`  DRIs: ${counts[1].rows[0].count}`)
            console.log(`  Checklists: ${counts[2].rows[0].count}`)
            console.log(`  Patrols: ${counts[3].rows[0].count}`)
            console.log(`  Educations: ${counts[4].rows[0].count}`)
            console.log(`  Incidents: ${counts[5].rows[0].count}`)
            console.log(`  Documents: ${counts[6].rows[0].count}`)
            console.log(`  Personnel: ${counts[7].rows[0].count}`)
        }

        console.log('\n' + '='.repeat(60))
        console.log('Data verification complete!')

    } catch (err) {
        console.error('Error:', err.message)
    } finally {
        client.release()
        pool.end()
    }
}

checkData()
