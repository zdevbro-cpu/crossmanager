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

async function seedWeighings() {
    const client = await pool.connect()
    try {
        console.log('🌱 Starting SWMS weighings seeding...')

        // Get material types and vendors
        const mtResult = await client.query('SELECT id, name FROM swms_material_types LIMIT 5')
        const vendorResult = await client.query('SELECT id, name FROM swms_vendors LIMIT 3')

        const materialTypes = mtResult.rows
        const vendors = vendorResult.rows

        if (materialTypes.length === 0 || vendors.length === 0) {
            console.log('❌ No material types or vendors found. Please run seed_swms_data.js first.')
            return
        }

        // Sample weighings data
        const weighings = [
            {
                weighing_date: '2025-12-01',
                weighing_time: '09:30:00',
                vehicle_number: '12가3456',
                driver_name: '김철수',
                driver_contact: '010-1234-5678',
                material_type_id: materialTypes[0].id,
                direction: 'IN',
                gross_weight: 15.5,
                tare_weight: 8.0,
                vendor_id: vendors[0].id
            },
            {
                weighing_date: '2025-12-01',
                weighing_time: '14:20:00',
                vehicle_number: '34나5678',
                driver_name: '이영희',
                driver_contact: '010-2345-6789',
                material_type_id: materialTypes[1].id,
                direction: 'OUT',
                gross_weight: 12.3,
                tare_weight: 7.5,
                vendor_id: vendors[1].id
            },
            {
                weighing_date: '2025-12-02',
                weighing_time: '10:15:00',
                vehicle_number: '56다7890',
                driver_name: '박민수',
                driver_contact: '010-3456-7890',
                material_type_id: materialTypes[0].id,
                direction: 'IN',
                gross_weight: 18.2,
                tare_weight: 8.5,
                vendor_id: vendors[0].id
            },
            {
                weighing_date: '2025-12-03',
                weighing_time: '11:45:00',
                vehicle_number: '78라9012',
                driver_name: '정수진',
                driver_contact: '010-4567-8901',
                material_type_id: materialTypes[2].id,
                direction: 'OUT',
                gross_weight: 10.8,
                tare_weight: 7.0,
                vendor_id: vendors[2].id
            },
            {
                weighing_date: '2025-12-04',
                weighing_time: '15:30:00',
                vehicle_number: '90마1234',
                driver_name: '최동욱',
                driver_contact: '010-5678-9012',
                material_type_id: materialTypes[0].id,
                direction: 'IN',
                gross_weight: 20.5,
                tare_weight: 9.0,
                vendor_id: vendors[0].id
            },
            {
                weighing_date: '2025-12-05',
                weighing_time: '13:00:00',
                vehicle_number: '12바3456',
                driver_name: '강지훈',
                driver_contact: '010-6789-0123',
                material_type_id: materialTypes[1].id,
                direction: 'OUT',
                gross_weight: 14.7,
                tare_weight: 7.8,
                vendor_id: vendors[1].id
            },
            {
                weighing_date: '2025-12-06',
                weighing_time: '16:45:00',
                vehicle_number: '34사5678',
                driver_name: '윤서연',
                driver_contact: '010-7890-1234',
                material_type_id: materialTypes[0].id,
                direction: 'IN',
                gross_weight: 17.3,
                tare_weight: 8.2,
                vendor_id: vendors[0].id
            },
            {
                weighing_date: '2025-12-07',
                weighing_time: '10:00:00',
                vehicle_number: '56아7890',
                driver_name: '한민준',
                driver_contact: '010-8901-2345',
                material_type_id: materialTypes[3].id,
                direction: 'OUT',
                gross_weight: 11.5,
                tare_weight: 7.2,
                vendor_id: vendors[2].id
            }
        ]

        for (const w of weighings) {
            const net_weight = w.gross_weight - w.tare_weight

            await client.query(`
                INSERT INTO swms_weighings (
                    weighing_date, weighing_time, vehicle_number, driver_name, driver_contact,
                    material_type_id, direction, gross_weight, tare_weight, net_weight,
                    vendor_id, created_by
                )
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
            `, [
                w.weighing_date, w.weighing_time, w.vehicle_number, w.driver_name, w.driver_contact,
                w.material_type_id, w.direction, w.gross_weight, w.tare_weight, net_weight,
                w.vendor_id, '계근원'
            ])
        }

        console.log(`✅ Seeded ${weighings.length} weighing records`)
        console.log('🎉 SWMS weighings seeding completed successfully!')
    } catch (err) {
        console.error('❌ Error seeding weighings:', err)
    } finally {
        client.release()
        await pool.end()
    }
}

seedWeighings()
