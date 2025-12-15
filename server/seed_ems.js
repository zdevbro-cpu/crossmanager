// Seed EMS Data
const { Pool } = require('pg')
require('dotenv').config()

const dbConfig = {
    user: process.env.DB_USER,
    database: process.env.DB_NAME,
    password: process.env.DB_PASSWORD,
    port: process.env.DB_PORT || 5432,
    host: process.env.DB_HOST || 'localhost'
}

const pool = new Pool(dbConfig)

async function seedEMS() {
    try {
        console.log('Seeding EMS Equipment...')

        await pool.query('DELETE FROM equipment') // Clean start for dev

        const equipmentList = [
            {
                equipment_id: 'EQ-001',
                name: '굴삭기 (Excavator 01)',
                category: '중장비',
                manufacturer: 'Doosan',
                equipment_status: '신품',
                assigned_site: 'Paju Plant A'
            },
            {
                equipment_id: 'EQ-002',
                name: '지게차 (Forklift 03)',
                category: '운반장비',
                manufacturer: 'Hyundai',
                equipment_status: '중고',
                assigned_site: 'Dangjin Steel Mill'
            },
            {
                equipment_id: 'EQ-003',
                name: '불도저 (Bulldozer B2)',
                category: '중장비',
                manufacturer: 'CAT',
                equipment_status: '정비중',
                assigned_site: 'Paju Plant A'
            },
            {
                equipment_id: 'EQ-004',
                name: '타워크레인 (Tower Crane T1)',
                category: '크레인',
                manufacturer: 'Liebherr',
                equipment_status: '신품',
                assigned_site: 'Songdo Site'
            },
            {
                equipment_id: 'EQ-005',
                name: '덤프트럭 (Dump Truck D5)',
                category: '운송차량',
                manufacturer: 'Volvo',
                equipment_status: '중고',
                assigned_site: 'Dangjin Steel Mill'
            }
        ]

        for (const eq of equipmentList) {
            await pool.query(
                `INSERT INTO equipment (
                    id, equipment_id, name, category, manufacturer, equipment_status, assigned_site
                ) VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6)`,
                [eq.equipment_id, eq.name, eq.category, eq.manufacturer, eq.equipment_status, eq.assigned_site]
            )
        }

        console.log(`Inserted ${equipmentList.length} equipment items.`)
        process.exit(0)
    } catch (e) {
        console.error('Seed Failed:', e)
        process.exit(1)
    }
}

seedEMS()
