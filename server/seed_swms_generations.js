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

async function seedGenerations() {
    const client = await pool.connect()
    try {
        console.log('🌱 Starting SWMS generations seeding...')

        // Get material types
        const mtResult = await client.query('SELECT id, name, unit FROM swms_material_types LIMIT 5')
        const materialTypes = mtResult.rows

        if (materialTypes.length === 0) {
            console.log('❌ No material types found. Please run seed_swms_data.js first.')
            return
        }

        // Sample generations data
        const generations = [
            {
                generation_date: '2025-12-01',
                material_type_id: materialTypes[0].id,
                process_name: '철골 용접',
                quantity: 2.5,
                location: 'A동 1층',
                notes: '용접 작업 중 발생한 철 스크랩'
            },
            {
                generation_date: '2025-12-02',
                material_type_id: materialTypes[1].id,
                process_name: '알루미늄 절단',
                quantity: 1.2,
                location: 'B동 2층',
                notes: '창호 설치 작업 중 발생'
            },
            {
                generation_date: '2025-12-03',
                material_type_id: materialTypes[0].id,
                process_name: '철근 가공',
                quantity: 3.8,
                location: '야적장',
                notes: '철근 절단 작업'
            },
            {
                generation_date: '2025-12-04',
                material_type_id: materialTypes[2].id,
                process_name: '전기 배선',
                quantity: 0.5,
                location: 'C동 지하',
                notes: '전선 피복 제거 작업'
            },
            {
                generation_date: '2025-12-05',
                material_type_id: materialTypes[0].id,
                process_name: '철골 조립',
                quantity: 4.2,
                location: 'A동 3층',
                notes: '철골 조립 중 발생한 자투리'
            },
            {
                generation_date: '2025-12-06',
                material_type_id: materialTypes[3].id,
                process_name: '스테인리스 가공',
                quantity: 0.8,
                location: 'B동 1층',
                notes: '주방 설비 설치'
            },
            {
                generation_date: '2025-12-07',
                material_type_id: materialTypes[0].id,
                process_name: '철골 해체',
                quantity: 5.5,
                location: '야적장',
                notes: '기존 구조물 해체'
            }
        ]

        for (const gen of generations) {
            await client.query(`
                INSERT INTO swms_generations (
                    generation_date, material_type_id, process_name,
                    quantity, unit, location, notes, created_by
                )
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
            `, [
                gen.generation_date,
                gen.material_type_id,
                gen.process_name,
                gen.quantity,
                materialTypes.find(mt => mt.id === gen.material_type_id)?.unit || '톤',
                gen.location,
                gen.notes,
                '시스템 관리자'
            ])
        }

        console.log(`✅ Seeded ${generations.length} generation records`)
        console.log('🎉 SWMS generations seeding completed successfully!')
    } catch (err) {
        console.error('❌ Error seeding generations:', err)
    } finally {
        client.release()
        await pool.end()
    }
}

seedGenerations()
