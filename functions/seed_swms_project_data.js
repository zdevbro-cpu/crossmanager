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

async function seedSwmsProjectData() {
    const client = await pool.connect()
    try {
        console.log('🌱 Starting SWMS project-based data seeding...')

        // 1. Get existing projects
        const projectsResult = await client.query('SELECT id, name FROM projects ORDER BY name')
        const projects = projectsResult.rows

        if (projects.length === 0) {
            console.log('❌ No projects found. Please create projects first.')
            return
        }

        console.log(`📋 Found ${projects.length} projects:`)
        projects.forEach(p => console.log(`   - ${p.name} (${p.id})`))

        // 2. Get material types and vendors
        const mtResult = await client.query('SELECT id, name, category, unit FROM swms_material_types ORDER BY category, name')
        const vendorResult = await client.query('SELECT id, name, type FROM swms_vendors ORDER BY type, name')

        const materialTypes = mtResult.rows
        const vendors = vendorResult.rows

        console.log(`📦 Material types: ${materialTypes.length}`)
        console.log(`🏢 Vendors: ${vendors.length}`)

        // 3. Clear existing data
        await client.query('DELETE FROM swms_generations')
        await client.query('DELETE FROM swms_weighings')
        console.log('🗑️  Cleared existing SWMS data')

        // 4. Generate data for each project
        let totalGenerations = 0
        let totalWeighings = 0

        for (const project of projects) {
            console.log(`\n📍 Generating data for: ${project.name}`)

            // Generate 10 generations per project
            const generationDates = [
                '2025-12-01', '2025-12-02', '2025-12-03', '2025-12-04', '2025-12-05',
                '2025-12-06', '2025-12-07', '2025-11-28', '2025-11-29', '2025-11-30'
            ]

            for (let i = 0; i < 10; i++) {
                const mt = materialTypes[i % materialTypes.length]
                const processes = ['철골 용접', '철근 가공', '알루미늄 절단', '전기 배선', '배관 작업', '철골 조립', '해체 작업', '마감 작업']
                const locations = ['A동 1층', 'B동 2층', 'C동 지하', '야적장', '작업장', '현장 사무소 앞']

                const quantity = (Math.random() * 5 + 0.5).toFixed(2)

                await client.query(`
                    INSERT INTO swms_generations (
                        project_id, generation_date, material_type_id, process_name,
                        quantity, unit, location, notes, created_by
                    )
                    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
                `, [
                    project.id,
                    generationDates[i],
                    mt.id,
                    processes[i % processes.length],
                    parseFloat(quantity),
                    mt.unit,
                    locations[i % locations.length],
                    `${project.name} ${mt.category} 발생`,
                    '현장 관리자'
                ])
                totalGenerations++
            }

            // Generate 10 weighings per project
            const weighingDates = [
                { date: '2025-12-01', time: '09:30:00' },
                { date: '2025-12-01', time: '14:20:00' },
                { date: '2025-12-02', time: '10:15:00' },
                { date: '2025-12-03', time: '11:45:00' },
                { date: '2025-12-04', time: '15:30:00' },
                { date: '2025-12-05', time: '13:00:00' },
                { date: '2025-12-06', time: '16:45:00' },
                { date: '2025-12-07', time: '10:00:00' },
                { date: '2025-11-29', time: '14:30:00' },
                { date: '2025-11-30', time: '11:00:00' }
            ]

            const vehicleNumbers = [
                '12가3456', '34나5678', '56다7890', '78라9012', '90마1234',
                '12바3456', '34사5678', '56아7890', '78자9012', '90차1234'
            ]

            const driverNames = [
                '김철수', '이영희', '박민수', '정수진', '최동욱',
                '강지훈', '윤서연', '한민준', '조예진', '임도현'
            ]

            for (let i = 0; i < 10; i++) {
                const mt = materialTypes[i % materialTypes.length]
                const vendor = vendors[i % vendors.length]
                const direction = i % 2 === 0 ? 'IN' : 'OUT'

                const gross_weight = (Math.random() * 10 + 10).toFixed(2)
                const tare_weight = (Math.random() * 3 + 7).toFixed(2)
                const net_weight = (parseFloat(gross_weight) - parseFloat(tare_weight)).toFixed(2)

                await client.query(`
                    INSERT INTO swms_weighings (
                        project_id, weighing_date, weighing_time, vehicle_number,
                        driver_name, driver_contact, material_type_id, direction,
                        gross_weight, tare_weight, net_weight, vendor_id, notes, created_by
                    )
                    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
                `, [
                    project.id,
                    weighingDates[i].date,
                    weighingDates[i].time,
                    vehicleNumbers[i],
                    driverNames[i],
                    `010-${Math.floor(Math.random() * 9000 + 1000)}-${Math.floor(Math.random() * 9000 + 1000)}`,
                    mt.id,
                    direction,
                    parseFloat(gross_weight),
                    parseFloat(tare_weight),
                    parseFloat(net_weight),
                    vendor.id,
                    `${project.name} ${direction === 'IN' ? '입고' : '출고'} 계근`,
                    '계근원'
                ])
                totalWeighings++
            }

            console.log(`   ✅ Generated 10 generations + 10 weighings`)
        }

        console.log(`\n🎉 SWMS project-based data seeding completed!`)
        console.log(`   📦 Total Generations: ${totalGenerations}`)
        console.log(`   ⚖️  Total Weighings: ${totalWeighings}`)

        // 5. Show summary by project
        console.log('\n📊 Summary by Project:')
        for (const project of projects) {
            const genResult = await client.query(
                'SELECT COUNT(*) as count, SUM(quantity) as total FROM swms_generations WHERE project_id = $1',
                [project.id]
            )
            const weighResult = await client.query(
                'SELECT COUNT(*) as count, SUM(net_weight) as total FROM swms_weighings WHERE project_id = $1',
                [project.id]
            )

            console.log(`   ${project.name}:`)
            console.log(`      - Generations: ${genResult.rows[0].count}건, ${parseFloat(genResult.rows[0].total || 0).toFixed(2)}톤`)
            console.log(`      - Weighings: ${weighResult.rows[0].count}건, ${parseFloat(weighResult.rows[0].total || 0).toFixed(2)}톤`)
        }

    } catch (err) {
        console.error('❌ Error seeding SWMS project data:', err)
    } finally {
        client.release()
        await pool.end()
    }
}

seedSwmsProjectData()
