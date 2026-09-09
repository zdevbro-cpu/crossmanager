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

async function quickSeed() {
    const client = await pool.connect()
    try {
        // Get site and warehouse IDs
        const siteRes = await client.query("SELECT id FROM swms_sites WHERE type = 'FACTORY' LIMIT 1")
        const warehouseRes = await client.query("SELECT id FROM swms_warehouses LIMIT 1")
        const materialRes = await client.query("SELECT id FROM swms_material_types LIMIT 5")

        if (siteRes.rows.length === 0) {
            console.log('❌ No site found')
            return
        }

        const siteId = siteRes.rows[0].id
        const warehouseId = warehouseRes.rows[0]?.id
        const materials = materialRes.rows

        console.log('🌱 Seeding 10 generations...')
        for (let i = 0; i < 10; i++) {
            const mat = materials[i % materials.length]
            await client.query(`
                INSERT INTO swms_generations (site_id, generation_date, material_type_id, quantity, location, status)
                VALUES ($1, CURRENT_DATE - ${i}, $2, ${10 + i * 5}, '야적장 A', 'REGISTERED')
            `, [siteId, mat.id])
        }

        console.log('🌱 Seeding 10 weighings...')
        for (let i = 0; i < 10; i++) {
            const mat = materials[i % materials.length]
            const direction = i % 2 === 0 ? 'IN' : 'OUT'
            await client.query(`
                INSERT INTO swms_weighings (site_id, weighing_date, weighing_time, vehicle_number, material_type_id, direction, gross_weight, tare_weight, net_weight)
                VALUES ($1, CURRENT_DATE - ${i}, '09:00', '12가${3456 + i}', $2, $3, ${50 + i * 2}, 10, ${40 + i * 2})
            `, [siteId, mat.id, direction])
        }

        if (warehouseId) {
            console.log('🌱 Seeding 10 inbounds...')
            for (let i = 0; i < 10; i++) {
                const mat = materials[i % materials.length]
                await client.query(`
                    INSERT INTO swms_inbounds (site_id, warehouse_id, inbound_date, material_type_id, quantity, unit_price, total_amount, status)
                    VALUES ($1, $2, CURRENT_DATE - ${i}, $3, ${5 + i}, 100000, ${(5 + i) * 100000}, 'REGISTERED')
                `, [siteId, warehouseId, mat.id])
            }

            console.log('🌱 Seeding 10 outbounds...')
            for (let i = 0; i < 10; i++) {
                const mat = materials[i % materials.length]
                await client.query(`
                    INSERT INTO swms_outbounds (site_id, warehouse_id, outbound_date, material_type_id, quantity, unit_price, total_amount, status)
                    VALUES ($1, $2, CURRENT_DATE - ${i}, $3, ${3 + i}, 120000, ${(3 + i) * 120000}, 'REGISTERED')
                `, [siteId, warehouseId, mat.id])
            }
        }

        console.log('✅ Quick seed completed!')
    } catch (err) {
        console.error('❌ Error:', err)
    } finally {
        client.release()
        await pool.end()
    }
}

quickSeed()
