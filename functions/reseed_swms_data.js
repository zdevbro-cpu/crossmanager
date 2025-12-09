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

async function reseedSwmsData() {
    const client = await pool.connect()
    try {
        console.log('🔄 Re-seeding SWMS data...\n')

        // Get projects
        const projectsResult = await client.query('SELECT id, name FROM projects ORDER BY name')
        const projects = projectsResult.rows

        if (projects.length === 0) {
            console.log('❌ No projects found.')
            return
        }

        console.log(`📋 Projects: ${projects.map(p => p.name).join(', ')}`)

        // Get material types and vendors
        const mtResult = await client.query('SELECT id, name, category, unit FROM swms_material_types ORDER BY category, name')
        const vendorResult = await client.query('SELECT id, name, type FROM swms_vendors ORDER BY type, name')

        const materialTypes = mtResult.rows
        const vendors = vendorResult.rows

        // Delete existing data
        await client.query('DELETE FROM swms_weighings')
        await client.query('DELETE FROM swms_generations')
        console.log('🗑️  Deleted existing data\n')

        // Generate diverse data for each project
        let totalGen = 0
        let totalWeigh = 0

        for (const project of projects) {
            console.log(`📍 ${project.name}:`)

            // Generations - 10 per project with diverse data
            const genData = [
                { date: '2025-12-01', mt: 0, process: '철골 용접 작업', qty: 3.2, loc: 'A동 1층 작업장' },
                { date: '2025-12-02', mt: 1, process: '알루미늄 창호 설치', qty: 1.5, loc: 'B동 외벽' },
                { date: '2025-12-03', mt: 2, process: '전기 배선 공사', qty: 0.8, loc: 'C동 지하 전기실' },
                { date: '2025-12-04', mt: 0, process: '철근 절단 가공', qty: 4.5, loc: '야적장' },
                { date: '2025-12-05', mt: 3, process: '주방 설비 설치', qty: 1.2, loc: 'B동 2층' },
                { date: '2025-12-06', mt: 4, process: '목재 거푸집 해체', qty: 2.8, loc: 'A동 3층' },
                { date: '2025-12-07', mt: 5, process: '플라스틱 포장재', qty: 0.6, loc: '현장 사무소 앞' },
                { date: '2025-11-28', mt: 0, process: '철골 구조물 해체', qty: 5.1, loc: '옥상' },
                { date: '2025-11-29', mt: 6, process: '콘크리트 파쇄', qty: 3.7, loc: 'A동 지하' },
                { date: '2025-11-30', mt: 1, process: '알루미늄 덕트 교체', qty: 1.9, loc: 'C동 기계실' }
            ]

            for (const gen of genData) {
                const mt = materialTypes[gen.mt % materialTypes.length]
                await client.query(`
                    INSERT INTO swms_generations (
                        project_id, generation_date, material_type_id, process_name,
                        quantity, unit, location, notes, created_by
                    )
                    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
                `, [
                    project.id,
                    gen.date,
                    mt.id,
                    gen.process,
                    gen.qty,
                    mt.unit,
                    gen.loc,
                    `${project.name} - ${gen.process}`,
                    '현장 관리자'
                ])
                totalGen++
            }

            // Weighings - 10 per project with diverse data
            const weighData = [
                { date: '2025-12-01', time: '09:15', vehicle: '12가3456', driver: '김철수', mt: 0, dir: 'IN', gross: 18.5, tare: 8.2, vendor: 0 },
                { date: '2025-12-01', time: '14:30', vehicle: '34나5678', driver: '이영희', mt: 1, dir: 'OUT', gross: 12.8, tare: 7.5, vendor: 1 },
                { date: '2025-12-02', time: '10:20', vehicle: '56다7890', driver: '박민수', mt: 0, dir: 'IN', gross: 22.3, tare: 9.1, vendor: 0 },
                { date: '2025-12-03', time: '11:45', vehicle: '78라9012', driver: '정수진', mt: 2, dir: 'OUT', gross: 11.5, tare: 7.0, vendor: 2 },
                { date: '2025-12-04', time: '15:10', vehicle: '90마1234', driver: '최동욱', mt: 0, dir: 'IN', gross: 19.7, tare: 8.8, vendor: 0 },
                { date: '2025-12-05', time: '13:25', vehicle: '12바3456', driver: '강지훈', mt: 3, dir: 'OUT', gross: 13.2, tare: 7.6, vendor: 1 },
                { date: '2025-12-06', time: '16:40', vehicle: '34사5678', driver: '윤서연', mt: 0, dir: 'IN', gross: 21.1, tare: 9.3, vendor: 0 },
                { date: '2025-12-07', time: '10:05', vehicle: '56아7890', driver: '한민준', mt: 1, dir: 'OUT', gross: 14.6, tare: 7.8, vendor: 2 },
                { date: '2025-11-29', time: '14:50', vehicle: '78자9012', driver: '조예진', mt: 0, dir: 'IN', gross: 20.4, tare: 8.9, vendor: 0 },
                { date: '2025-11-30', time: '11:15', vehicle: '90차1234', driver: '임도현', mt: 4, dir: 'OUT', gross: 15.3, tare: 7.7, vendor: 1 }
            ]

            for (const w of weighData) {
                const mt = materialTypes[w.mt % materialTypes.length]
                const vendor = vendors[w.vendor % vendors.length]
                const net = w.gross - w.tare

                await client.query(`
                    INSERT INTO swms_weighings (
                        project_id, weighing_date, weighing_time, vehicle_number,
                        driver_name, driver_contact, material_type_id, direction,
                        gross_weight, tare_weight, net_weight, vendor_id, notes, created_by
                    )
                    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
                `, [
                    project.id,
                    w.date,
                    w.time,
                    w.vehicle,
                    w.driver,
                    `010-${Math.floor(Math.random() * 9000 + 1000)}-${Math.floor(Math.random() * 9000 + 1000)}`,
                    mt.id,
                    w.dir,
                    w.gross,
                    w.tare,
                    net,
                    vendor.id,
                    `${project.name} - ${w.dir === 'IN' ? '입고' : '출고'}`,
                    '계근원'
                ])
                totalWeigh++
            }

            console.log(`   ✅ 10 generations + 10 weighings`)
        }

        console.log(`\n🎉 Re-seeding completed!`)
        console.log(`   📦 Total Generations: ${totalGen}`)
        console.log(`   ⚖️  Total Weighings: ${totalWeigh}`)

        // Show summary
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
        console.error('❌ Error:', err)
    } finally {
        client.release()
        await pool.end()
    }
}

reseedSwmsData()
