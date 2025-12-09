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

async function checkSwmsData() {
    const client = await pool.connect()
    try {
        console.log('🔍 Checking SWMS data...\n')

        // Check projects
        const projectsResult = await client.query('SELECT id, name FROM projects ORDER BY name')
        console.log('📋 Projects:')
        projectsResult.rows.forEach(p => {
            console.log(`   ${p.name}: ${p.id}`)
        })

        // Check generations
        const genResult = await client.query(`
            SELECT 
                g.id,
                g.project_id,
                g.generation_date,
                g.quantity,
                mt.name as material_name
            FROM swms_generations g
            LEFT JOIN swms_material_types mt ON g.material_type_id = mt.id
            ORDER BY g.generation_date DESC
            LIMIT 5
        `)
        console.log(`\n📦 Generations (${genResult.rows.length} shown):`)
        genResult.rows.forEach(g => {
            console.log(`   ${g.generation_date} | ${g.material_name} | ${g.quantity}톤 | Project: ${g.project_id}`)
        })

        // Check weighings
        const weighResult = await client.query(`
            SELECT 
                w.id,
                w.project_id,
                w.weighing_date,
                w.net_weight,
                w.direction,
                mt.name as material_name
            FROM swms_weighings w
            LEFT JOIN swms_material_types mt ON w.material_type_id = mt.id
            ORDER BY w.weighing_date DESC
            LIMIT 5
        `)
        console.log(`\n⚖️  Weighings (${weighResult.rows.length} shown):`)
        weighResult.rows.forEach(w => {
            console.log(`   ${w.weighing_date} | ${w.direction} | ${w.material_name} | ${w.net_weight}톤 | Project: ${w.project_id}`)
        })

        // Count by project
        console.log('\n📊 Count by Project:')
        for (const project of projectsResult.rows) {
            const genCount = await client.query(
                'SELECT COUNT(*) as count FROM swms_generations WHERE project_id = $1',
                [project.id]
            )
            const weighCount = await client.query(
                'SELECT COUNT(*) as count FROM swms_weighings WHERE project_id = $1',
                [project.id]
            )
            console.log(`   ${project.name}:`)
            console.log(`      Generations: ${genCount.rows[0].count}`)
            console.log(`      Weighings: ${weighCount.rows[0].count}`)
        }

    } catch (err) {
        console.error('❌ Error:', err)
    } finally {
        client.release()
        await pool.end()
    }
}

checkSwmsData()
