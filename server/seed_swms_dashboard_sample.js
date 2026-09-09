/**
 * Seed sample data for SWMS dashboard so the UI can be verified.
 *
 * - Uses a dedicated project_id: SAMPLE-PROJ-001 (safe cleanup scope)
 * - Creates [SAMPLE] master data (vendors/materials/warehouses)
 * - Inserts last 30 days of inbounds/outbounds + today's weighings
 * - Inserts a few anomalies/allbaro statuses
 *
 * Usage:
 *   cd Server
 *   node seed_swms_dashboard_sample.js
 */
require('dotenv').config({ path: require('path').join(__dirname, '.env') })

const { Pool } = require('pg')
const crypto = require('crypto')
const fs = require('fs')
const path = require('path')

function parseArg(name) {
    const i = process.argv.findIndex((x) => x === name || x.startsWith(`${name}=`))
    if (i < 0) return null
    const v = process.argv[i].includes('=') ? process.argv[i].split('=')[1] : process.argv[i + 1]
    return v ? String(v) : null
}

const SITE_ID = process.env.SWMS_SITE_ID || parseArg('--siteId') || 'FAC-001'
// Keep sample scope isolated per-site to avoid collisions in shared environments.
const PROJECT_ID = process.env.SWMS_SAMPLE_PROJECT_ID || `SAMPLE-PROJ-001-${SITE_ID}`

function isoDate(d) {
    return d.toISOString().slice(0, 10)
}

function addDays(date, delta) {
    const d = new Date(date)
    d.setDate(d.getDate() + delta)
    return d
}

function hhmmss(hour, minute, second = 0) {
    const hh = String(hour).padStart(2, '0')
    const mm = String(minute).padStart(2, '0')
    const ss = String(second).padStart(2, '0')
    return `${hh}:${mm}:${ss}`
}

async function tableHasColumn(client, table, column) {
    const q = `
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema='public'
        AND table_name = $1
        AND column_name = $2
        LIMIT 1
    `
    const r = await client.query(q, [table, column])
    return r.rows.length > 0
}

async function tableExists(client, table) {
    const q = `SELECT to_regclass($1) AS reg`
    const r = await client.query(q, [`public.${table}`])
    return !!r.rows[0]?.reg
}

async function main() {
    const dbConfig = {
        user: process.env.DB_USER,
        database: process.env.DB_NAME,
        password: process.env.DB_PASSWORD,
        port: process.env.DB_PORT || 5432,
        host: process.env.DB_HOST || 'localhost',
    }

    if (dbConfig.host && String(dbConfig.host).startsWith('/cloudsql')) {
        dbConfig.host = process.env.DB_HOST
    } else {
        dbConfig.ssl = { rejectUnauthorized: false }
    }

    const pool = new Pool(dbConfig)
    const client = await pool.connect()

    const now = new Date()
    const today = isoDate(now)

    try {
        await client.query('BEGIN')

        // Ensure SWMS migrations are applied (seed script can run without starting the server)
        const migrationsDir = path.join(__dirname, 'migrations')
        if (fs.existsSync(migrationsDir)) {
            const files = fs
                .readdirSync(migrationsDir)
                .filter((f) => /^\d{8}_swms_.*\.sql$/i.test(f))
                .sort()
            for (const file of files) {
                const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf8')
                await client.query(sql)
            }
        }

        const sampleVendors = await client.query(
            "SELECT id FROM swms_vendors WHERE name LIKE '[SAMPLE]%'"
        )
        const vendorIds = sampleVendors.rows.map(r => r.id)

        const sampleMaterials = await client.query(
            "SELECT id FROM swms_material_types WHERE name LIKE '[SAMPLE]%'"
        )
        const materialIds = sampleMaterials.rows.map(r => r.id)

        const sampleWarehouses = await client.query(
            "SELECT id FROM swms_warehouses WHERE site_id=$1 AND name LIKE '[SAMPLE]%'",
            [SITE_ID]
        )
        const warehouseIds = sampleWarehouses.rows.map(r => r.id)

        // Cleanup orphan process events (warehouses removed/renamed over time)
        if (await tableExists(client, 'swms_process_events')) {
            await client.query(
                `DELETE FROM swms_process_events e
                 WHERE e.site_id = $1
                 AND e.warehouse_id IS NOT NULL
                 AND NOT EXISTS (
                    SELECT 1 FROM swms_warehouses w
                    WHERE w.site_id = $1 AND w.id = e.warehouse_id
                 )`,
                [SITE_ID]
            )
        }

        // Cleanup (sample scope only, site-bounded)
        if (vendorIds.length > 0) {
            await client.query(
                `DELETE FROM swms_settlement_items
                 WHERE settlement_id IN (
                    SELECT id FROM swms_settlements
                    WHERE site_id = $2
                    AND vendor_id = ANY($1::text[])
                 )`,
                [vendorIds, SITE_ID]
            )
            await client.query(
                'DELETE FROM swms_settlements WHERE site_id = $2 AND vendor_id = ANY($1::text[])',
                [vendorIds, SITE_ID]
            )
        }

        await client.query('DELETE FROM swms_outbounds WHERE project_id=$1 AND site_id=$2', [PROJECT_ID, SITE_ID])
        await client.query('DELETE FROM swms_inbounds WHERE project_id=$1 AND site_id=$2', [PROJECT_ID, SITE_ID])
        await client.query('DELETE FROM swms_weighings WHERE project_id=$1 AND site_id=$2', [PROJECT_ID, SITE_ID])
        await client.query("DELETE FROM swms_anomalies WHERE site_id=$1 AND title LIKE '[SAMPLE]%' ", [SITE_ID])
        await client.query("DELETE FROM swms_allbaro_sync WHERE site_id=$1 AND (external_key LIKE 'SAMPLE-%' OR error_message LIKE '[SAMPLE]%')", [SITE_ID])
        await client.query("DELETE FROM swms_claims WHERE site_id=$1 AND notes LIKE '[SAMPLE]%'", [SITE_ID])
        await client.query("DELETE FROM swms_dispatch_plans WHERE site_id=$1 AND meta->>'seed' = 'sample'", [SITE_ID])
        await client.query("DELETE FROM swms_work_items WHERE site_id=$1 AND meta->>'seed' = 'sample'", [SITE_ID])
        await client.query("DELETE FROM swms_attachments WHERE site_id=$1 AND file_name LIKE '[SAMPLE]%'", [SITE_ID])

        if (warehouseIds.length > 0) {
            if (await tableExists(client, 'swms_process_events')) {
                await client.query('DELETE FROM swms_process_events WHERE site_id=$1 AND warehouse_id = ANY($2::text[])', [SITE_ID, warehouseIds])
            }
            await client.query('DELETE FROM swms_inventory WHERE warehouse_id = ANY($1::text[])', [warehouseIds])
            await client.query("DELETE FROM swms_warehouses WHERE id = ANY($1::text[])", [warehouseIds])
        }
        // Cleanup: utility warehouse ids used only for sample/testing
        await client.query('DELETE FROM swms_inventory WHERE site_id=$1 AND warehouse_id IN ($2,$3)', [SITE_ID, 'WH-KPI', 'WH-NEG'])

        // NOTE: Do not delete [SAMPLE] vendors/materials here.
        // In shared/demo environments they may be referenced by existing records (FK),
        // and repeated runs should be safe (we upsert by name below).

        // Master data (sample)
        const materials = [
            {
                id: crypto.randomUUID(),
                name: '[SAMPLE] 스크랩-고철 A',
                category: 'SCRAP',
                unit: '톤',
                unit_price: 350000,
                is_scrap: true,
            },
            {
                id: crypto.randomUUID(),
                name: '[SAMPLE] 스크랩-구리 A',
                category: 'SCRAP',
                unit: '톤',
                unit_price: 8500000,
                is_scrap: true,
            },
            {
                id: crypto.randomUUID(),
                name: '[SAMPLE] 스크랩-알루미늄 A',
                category: 'SCRAP',
                unit: '톤',
                unit_price: 1800000,
                is_scrap: true,
            },
            {
                id: crypto.randomUUID(),
                name: '[SAMPLE] 폐기물-혼합',
                category: 'WASTE',
                unit: '톤',
                unit_price: -150000,
                is_scrap: false,
            },
            {
                id: crypto.randomUUID(),
                name: '[SAMPLE] 스크랩-아연 A',
                category: 'SCRAP',
                unit: '톤',
                unit_price: 3200000,
                is_scrap: true,
                symbol: 'ZN',
            },
            {
                id: crypto.randomUUID(),
                name: '[SAMPLE] 스크랩-주석 A',
                category: 'SCRAP',
                unit: '톤',
                unit_price: 28000000,
                is_scrap: true,
                symbol: 'SN',
            },
        ]

        const vendors = [
            { id: crypto.randomUUID(), name: '[SAMPLE] 매입처-Alpha', type: 'BUYER' },
            { id: crypto.randomUUID(), name: '[SAMPLE] 매입처-Beta', type: 'BUYER' },
            { id: crypto.randomUUID(), name: '[SAMPLE] 처리업체-Gamma', type: 'DISPOSER' },
        ]

        const hasIsScrap = await tableHasColumn(client, 'swms_material_types', 'is_scrap')
        const hasWarehouseCapacity = await tableHasColumn(client, 'swms_warehouses', 'capacity')
        const hasInventoryGrade = await tableHasColumn(client, 'swms_inventory', 'grade')
        const hasProcessEvents = await tableExists(client, 'swms_process_events')

        if (hasProcessEvents && materialIds.length > 0) {
            await client.query('DELETE FROM swms_process_events WHERE site_id=$1 AND material_type_id = ANY($2::text[])', [SITE_ID, materialIds])
        }

        const ensureMaterial = async (m) => {
            const existing = await client.query('SELECT id FROM swms_material_types WHERE name=$1 LIMIT 1', [m.name])
            if (existing.rows[0]?.id) {
                m.id = existing.rows[0].id
                await client.query('UPDATE swms_material_types SET category=$2, unit=$3, unit_price=$4 WHERE id=$1', [
                    m.id,
                    m.category,
                    m.unit,
                    m.unit_price,
                ])
                if (hasIsScrap) {
                    await client.query('UPDATE swms_material_types SET is_scrap=$2 WHERE id=$1', [m.id, m.is_scrap])
                }
                return
            }
            if (hasIsScrap) {
                await client.query(
                    `INSERT INTO swms_material_types (id, name, category, unit, unit_price, is_scrap)
                     VALUES ($1,$2,$3,$4,$5,$6)`,
                    [m.id, m.name, m.category, m.unit, m.unit_price, m.is_scrap]
                )
            } else {
                await client.query(
                    `INSERT INTO swms_material_types (id, name, category, unit, unit_price)
                     VALUES ($1,$2,$3,$4,$5)`,
                    [m.id, m.name, m.category, m.unit, m.unit_price]
                )
            }
        }

        const ensureVendor = async (v) => {
            const existing = await client.query('SELECT id FROM swms_vendors WHERE name=$1 LIMIT 1', [v.name])
            if (existing.rows[0]?.id) {
                v.id = existing.rows[0].id
                await client.query('UPDATE swms_vendors SET type=$2, contact=$3, registration_no=$4 WHERE id=$1', [
                    v.id,
                    v.type,
                    '010-0000-0000',
                    'SAMPLE-REG',
                ])
                return
            }
            await client.query(
                `INSERT INTO swms_vendors (id, name, type, contact, registration_no)
                 VALUES ($1,$2,$3,$4,$5)`,
                [v.id, v.name, v.type, '010-0000-0000', 'SAMPLE-REG']
            )
        }

        for (const m of materials) await ensureMaterial(m)
        for (const v of vendors) await ensureVendor(v)

        const indoorZones = Array.from({ length: 5 }).map((_, idx) => ({
            id: crypto.randomUUID(),
            name: `[SAMPLE] 인도어 ${idx + 1}구역`,
            type: 'INDOOR',
            capacity: 100,
            unit: '톤',
        }))
        const outdoorZones = Array.from({ length: 4 }).map((_, idx) => ({
            id: crypto.randomUUID(),
            name: `[SAMPLE] 아웃도어 ${idx + 1}구역`,
            type: 'YARD',
            capacity: 100,
            unit: '톤',
        }))
        const warehouses = [...indoorZones, ...outdoorZones]

        if (hasWarehouseCapacity) {
            const values = warehouses
                .map((_, i) => `($${i * 6 + 1},$${i * 6 + 2},$${i * 6 + 3},$${i * 6 + 4},$${i * 6 + 5},$${i * 6 + 6})`)
                .join(',')
            const params = warehouses.flatMap((w) => [w.id, SITE_ID, w.name, w.type, w.capacity, w.unit])
            await client.query(`INSERT INTO swms_warehouses (id, site_id, name, type, capacity, unit) VALUES ${values}`, params)
        } else {
            const values = warehouses
                .map((_, i) => `($${i * 4 + 1},$${i * 4 + 2},$${i * 4 + 3},$${i * 4 + 4})`)
                .join(',')
            const params = warehouses.flatMap((w) => [w.id, SITE_ID, w.name, w.type])
            await client.query(`INSERT INTO swms_warehouses (id, site_id, name, type) VALUES ${values}`, params)
        }

        // Inventory snapshot (current)
        // 목표(색상 테스트): 포화(fillRatePct) 100% 이상부터 10%까지 확인 가능하도록 구성
        // - 임계치(프론트): red>=90 / amber>=70 / green>=40 / slate<40
        const invRows = [
            // Indoor 1: 110% (over-capacity)
            { warehouse_id: indoorZones[0].id, material_type_id: materials[1].id, grade: 'A', quantity: 50.0 },
            { warehouse_id: indoorZones[0].id, material_type_id: materials[1].id, grade: 'B', quantity: 35.0 },
            { warehouse_id: indoorZones[0].id, material_type_id: materials[1].id, grade: 'C', quantity: 25.0 },
            // Indoor 2: 95%
            { warehouse_id: indoorZones[1].id, material_type_id: materials[2].id, grade: 'A', quantity: 45.0 },
            { warehouse_id: indoorZones[1].id, material_type_id: materials[2].id, grade: 'B', quantity: 30.0 },
            { warehouse_id: indoorZones[1].id, material_type_id: materials[2].id, grade: 'C', quantity: 20.0 },
            // Indoor 3: 80%
            { warehouse_id: indoorZones[2].id, material_type_id: materials[5].id, grade: 'A', quantity: 30.0 },
            { warehouse_id: indoorZones[2].id, material_type_id: materials[5].id, grade: 'B', quantity: 30.0 },
            { warehouse_id: indoorZones[2].id, material_type_id: materials[5].id, grade: 'C', quantity: 20.0 },
            // Indoor 4: 65%
            { warehouse_id: indoorZones[3].id, material_type_id: materials[4].id, grade: 'A', quantity: 35.0 },
            { warehouse_id: indoorZones[3].id, material_type_id: materials[4].id, grade: 'B', quantity: 20.0 },
            { warehouse_id: indoorZones[3].id, material_type_id: materials[4].id, grade: 'C', quantity: 10.0 },
            // Indoor 5: 50%
            { warehouse_id: indoorZones[4].id, material_type_id: materials[0].id, grade: 'A', quantity: 25.0 },
            { warehouse_id: indoorZones[4].id, material_type_id: materials[0].id, grade: 'B', quantity: 15.0 },
            { warehouse_id: indoorZones[4].id, material_type_id: materials[0].id, grade: 'C', quantity: 10.0 },
            // Outdoor 1: 35%
            { warehouse_id: outdoorZones[0].id, material_type_id: materials[0].id, grade: 'A', quantity: 20.0 },
            { warehouse_id: outdoorZones[0].id, material_type_id: materials[0].id, grade: 'B', quantity: 10.0 },
            { warehouse_id: outdoorZones[0].id, material_type_id: materials[0].id, grade: 'C', quantity: 5.0 },
            // Outdoor 2: 25%
            { warehouse_id: outdoorZones[1].id, material_type_id: materials[3].id, grade: 'C', quantity: 25.0 },
            // Outdoor 3: 15%
            { warehouse_id: outdoorZones[2].id, material_type_id: materials[3].id, grade: 'C', quantity: 15.0 },
            // Outdoor 4: 10%
            { warehouse_id: outdoorZones[3].id, material_type_id: materials[3].id, grade: 'C', quantity: 10.0 },
            // one negative row to surface risk UI (not tied to a displayed Zone)
            { warehouse_id: 'WH-NEG', material_type_id: materials[3].id, grade: 'C', quantity: -0.4 },
        ]
        for (const r of invRows) {
            if (hasInventoryGrade) {
                await client.query(
                    `INSERT INTO swms_inventory (site_id, warehouse_id, material_type_id, grade, quantity, last_updated_at)
                     VALUES ($1,$2,$3,$4,$5,NOW())
                     ON CONFLICT (site_id, warehouse_id, material_type_id, grade) DO UPDATE SET
                        quantity = EXCLUDED.quantity,
                        last_updated_at = NOW()`,
                    [SITE_ID, r.warehouse_id, r.material_type_id, r.grade, r.quantity]
                )
            } else {
                await client.query(
                    `INSERT INTO swms_inventory (site_id, warehouse_id, material_type_id, quantity, last_updated_at)
                     VALUES ($1,$2,$3,$4,NOW())
                     ON CONFLICT (site_id, warehouse_id, material_type_id) DO UPDATE SET
                        quantity = EXCLUDED.quantity,
                        last_updated_at = NOW()`,
                    [SITE_ID, r.warehouse_id, r.material_type_id, r.quantity]
                )
            }
        }

        // Inbounds / Outbounds (last 30 days)
        const buyerId = vendors[0].id
        const disposerId = vendors[2].id
        const start = addDays(now, -29)
        const KPI_WAREHOUSE_ID = 'WH-KPI'
        for (let i = 0; i < 30; i++) {
            const d = addDays(start, i)
            const dStr = isoDate(d)

            // Inbound scrap (고철) & waste
            const inboundScrapQty = 2.0 + (i % 5) * 0.6
            const inboundAlQty = 0.7 + (i % 4) * 0.25
            const inboundWasteQty = 0.8 + (i % 3) * 0.4
            await client.query(
                `INSERT INTO swms_inbounds
                    (id, site_id, project_id, inbound_date, warehouse_id, vendor_id, material_type_id, grade, quantity, unit_price, total_amount, status, created_at)
                 VALUES
                    ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,NOW()),
                    ($13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,NOW()),
                    ($25,$26,$27,$28,$29,$30,$31,$32,$33,$34,$35,$36,NOW())`,
                [
                    crypto.randomUUID(),
                    SITE_ID,
                    PROJECT_ID,
                    dStr,
                    KPI_WAREHOUSE_ID,
                    disposerId,
                    materials[0].id,
                    i % 3 === 0 ? 'A' : i % 3 === 1 ? 'B' : 'C',
                    inboundScrapQty,
                    0,
                    0,
                    'CONFIRMED',
                    crypto.randomUUID(),
                    SITE_ID,
                    PROJECT_ID,
                    dStr,
                    KPI_WAREHOUSE_ID,
                    disposerId,
                    materials[3].id,
                    'C',
                    inboundWasteQty,
                    0,
                    0,
                    'CONFIRMED',
                    crypto.randomUUID(),
                    SITE_ID,
                    PROJECT_ID,
                    dStr,
                    KPI_WAREHOUSE_ID,
                    disposerId,
                    materials[2].id,
                    i % 2 === 0 ? 'A' : 'B',
                    inboundAlQty,
                    0,
                    0,
                    'CONFIRMED',
                ]
            )

            // Outbound scrap (sell) + outbound aluminum + outbound waste (disposal cost)
            const outboundScrapQty = Math.max(0, inboundScrapQty - 0.4 - (i % 4) * 0.1)
            const outboundAlQty = Math.max(0, inboundAlQty - 0.15)
            const outboundWasteQty = Math.max(0, inboundWasteQty - 0.2)

            const status =
                i >= 27 ? 'PENDING' : i >= 24 ? 'APPROVED' : 'SETTLED'

            await client.query(
                `INSERT INTO swms_outbounds
                    (id, site_id, project_id, outbound_date, warehouse_id, vendor_id, material_type_id, grade, quantity, unit_price, total_amount, status, created_at)
                 VALUES
                    ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,NOW()),
                    ($13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,NOW()),
                    ($25,$26,$27,$28,$29,$30,$31,$32,$33,$34,$35,$36,NOW())`,
                [
                    crypto.randomUUID(),
                    SITE_ID,
                    PROJECT_ID,
                    dStr,
                    KPI_WAREHOUSE_ID,
                    buyerId,
                    materials[0].id,
                    i % 3 === 0 ? 'A' : i % 3 === 1 ? 'B' : 'C',
                    outboundScrapQty,
                    materials[0].unit_price,
                    outboundScrapQty * materials[0].unit_price,
                    status,
                    crypto.randomUUID(),
                    SITE_ID,
                    PROJECT_ID,
                    dStr,
                    KPI_WAREHOUSE_ID,
                    disposerId,
                    materials[3].id,
                    'C',
                    outboundWasteQty,
                    materials[2].unit_price,
                    outboundWasteQty * materials[2].unit_price,
                    status,
                    crypto.randomUUID(),
                    SITE_ID,
                    PROJECT_ID,
                    dStr,
                    KPI_WAREHOUSE_ID,
                    buyerId,
                    materials[2].id,
                    i % 2 === 0 ? 'A' : 'B',
                    outboundAlQty,
                    materials[2].unit_price,
                    outboundAlQty * materials[2].unit_price,
                    status,
                ]
            )

            if (hasProcessEvents) {
                const scrapGrade = i % 3 === 0 ? 'A' : i % 3 === 1 ? 'B' : 'C'
                const alGrade = i % 2 === 0 ? 'A' : 'B'
                const settled = status === 'SETTLED'
                const zone = warehouses[i % warehouses.length]
                const zone2 = warehouses[(i + 3) % warehouses.length]
                const zone3 = warehouses[(i + 6) % warehouses.length]

                // Sorting dwell time sample (hours): used for bottleneck signal (avg dwell time)
                // Make avg > 24h for demo: 6/30 days @48h, 24/30 days @20h  => avg ~25.6h
                const sortDwellHours = i % 5 === 0 ? 48 : 20
                const addHours = (iso, h) => new Date(new Date(iso).getTime() + h * 3600 * 1000).toISOString()

                // Scrap flow (inbound -> sort -> storage(zone) -> outbound -> settlement status)
                const scrapSorted = Math.max(0, inboundScrapQty * 0.96)
                const scrapFlowId = crypto.randomUUID()
                const scrapInAt = new Date(`${dStr}T09:00:00Z`).toISOString()
                const scrapSortedAt = addHours(scrapInAt, sortDwellHours)
                const scrapOutAt = addHours(scrapSortedAt, 4)
                await client.query(
                    `INSERT INTO swms_process_events (site_id, warehouse_id, material_type_id, grade, from_stage, to_stage, quantity, occurred_at, meta)
                     VALUES
                        ($1,$2,$3,$4,'INBOUND','SORT',$5,$6::timestamptz,$11::jsonb),
                        ($1,$2,$3,$4,'SORT','STORAGE',$7,$12::timestamptz,$11::jsonb),
                        ($1,$2,$3,$4,'STORAGE','OUTBOUND',$8,$13::timestamptz,$11::jsonb),
                        ($1,$2,$3,$4,'OUTBOUND',$9,$10,$13::timestamptz,$11::jsonb)`,
                    [
                        SITE_ID,
                        zone.id,
                        materials[0].id,
                        scrapGrade,
                        inboundScrapQty,
                        scrapInAt,
                        scrapSorted,
                        outboundScrapQty,
                        settled ? 'SETTLEMENT_CONFIRMED' : 'SETTLEMENT_PENDING',
                        outboundScrapQty,
                        JSON.stringify({ seed: 'sample', flowId: scrapFlowId, sortDwellHours }),
                        scrapSortedAt,
                        scrapOutAt,
                    ]
                )

                // Waste flow (inbound -> sort -> storage(zone) -> outbound -> settlement status)
                const wasteSorted = Math.max(0, inboundWasteQty * 0.98)
                const wasteFlowId = crypto.randomUUID()
                const wasteInAt = new Date(`${dStr}T09:20:00Z`).toISOString()
                const wasteSortedAt = addHours(wasteInAt, sortDwellHours)
                const wasteOutAt = addHours(wasteSortedAt, 6)
                await client.query(
                    `INSERT INTO swms_process_events (site_id, warehouse_id, material_type_id, grade, from_stage, to_stage, quantity, occurred_at, meta)
                     VALUES
                        ($1,$2,$3,$4,'INBOUND','SORT',$5,$6::timestamptz,$11::jsonb),
                        ($1,$2,$3,$4,'SORT','STORAGE',$7,$12::timestamptz,$11::jsonb),
                        ($1,$2,$3,$4,'STORAGE','OUTBOUND',$8,$13::timestamptz,$11::jsonb),
                        ($1,$2,$3,$4,'OUTBOUND',$9,$10,$13::timestamptz,$11::jsonb)`,
                    [
                        SITE_ID,
                        zone2.id,
                        materials[3].id,
                        'C',
                        inboundWasteQty,
                        wasteInAt,
                        wasteSorted,
                        outboundWasteQty,
                        settled ? 'SETTLEMENT_CONFIRMED' : 'SETTLEMENT_PENDING',
                        outboundWasteQty,
                        JSON.stringify({ seed: 'sample', flowId: wasteFlowId, sortDwellHours }),
                        wasteSortedAt,
                        wasteOutAt,
                    ]
                )

                // Aluminum flow
                const alSorted = Math.max(0, inboundAlQty * 0.97)
                const alFlowId = crypto.randomUUID()
                const alInAt = new Date(`${dStr}T10:10:00Z`).toISOString()
                const alSortedAt = addHours(alInAt, sortDwellHours)
                const alOutAt = addHours(alSortedAt, 5)
                await client.query(
                    `INSERT INTO swms_process_events (site_id, warehouse_id, material_type_id, grade, from_stage, to_stage, quantity, occurred_at, meta)
                     VALUES
                        ($1,$2,$3,$4,'INBOUND','SORT',$5,$6::timestamptz,$11::jsonb),
                        ($1,$2,$3,$4,'SORT','STORAGE',$7,$12::timestamptz,$11::jsonb),
                        ($1,$2,$3,$4,'STORAGE','OUTBOUND',$8,$13::timestamptz,$11::jsonb),
                        ($1,$2,$3,$4,'OUTBOUND',$9,$10,$13::timestamptz,$11::jsonb)`,
                    [
                        SITE_ID,
                        zone3.id,
                        materials[2].id,
                        alGrade,
                        inboundAlQty,
                        alInAt,
                        alSorted,
                        outboundAlQty,
                        settled ? 'SETTLEMENT_CONFIRMED' : 'SETTLEMENT_PENDING',
                        outboundAlQty,
                        JSON.stringify({ seed: 'sample', flowId: alFlowId, sortDwellHours }),
                        alSortedAt,
                        alOutAt,
                    ]
                )
            }
        }

        // Aging(체화) 색상 테스트용: 30일부터 5일까지 분산(warehouse별 최소 입고일을 컨트롤)
        const ageDays = [30, 27, 24, 21, 18, 15, 12, 9, 5]
        const agingValues = ageDays
            .map((_, i) => `($${i * 8 + 1},$${i * 8 + 2},$${i * 8 + 3},$${i * 8 + 4},$${i * 8 + 5},$${i * 8 + 6},$${i * 8 + 7},$${i * 8 + 8},0.1,0,0,'CONFIRMED',NOW())`)
            .join(',')
        const agingParams = []
        for (let i = 0; i < warehouses.length; i++) {
            agingParams.push(
                crypto.randomUUID(),
                SITE_ID,
                PROJECT_ID,
                isoDate(addDays(now, -ageDays[i])),
                warehouses[i].id,
                disposerId,
                materials[0].id,
                'A'
            )
        }
        await client.query(
            `INSERT INTO swms_inbounds
                (id, site_id, project_id, inbound_date, warehouse_id, vendor_id, material_type_id, grade, quantity, unit_price, total_amount, status, created_at)
             VALUES ${agingValues}`,
            agingParams
        )

        // Settlement waiting (DRAFT) to show work queue
        const draftSettlementId = crypto.randomUUID()
        await client.query(
            `INSERT INTO swms_settlements
                (id, site_id, vendor_id, start_date, end_date, total_supply_price, total_vat, total_amount, status, tax_invoice_no, created_at)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,NOW())`,
            [
                draftSettlementId,
                SITE_ID,
                buyerId,
                today.slice(0, 8) + '01',
                today,
                12000000,
                1200000,
                13200000,
                'DRAFT',
                null,
            ]
        )

        const outboundsForSettlement = await client.query(
            `SELECT id
             FROM swms_outbounds
             WHERE project_id=$1 AND vendor_id=$2 AND status='APPROVED'
             ORDER BY outbound_date DESC
             LIMIT 3`,
            [PROJECT_ID, buyerId]
        )
        for (const row of outboundsForSettlement.rows) {
            await client.query(
                `INSERT INTO swms_settlement_items (id, settlement_id, outbound_id)
                 VALUES ($1,$2,$3)`,
                [crypto.randomUUID(), draftSettlementId, row.id]
            )
        }

        // Weighings (today) for hourly chart
        const vehicleNumbers = ['12가3456', '34나5678', '56다7890', '78라1234']
        const weighingMaterialId = materials[0].id
        for (let i = 0; i < 10; i++) {
            const vehicle = vehicleNumbers[i % vehicleNumbers.length]
            const hour = 8 + (i % 10)
            const minute = (i * 6) % 60
            const net = 0.8 + (i % 4) * 0.35
            const tare = 3.2 + (i % 3) * 0.1
            const gross = tare + net

            await client.query(
                `INSERT INTO swms_weighings
                    (id, site_id, project_id, weighing_date, weighing_time, vehicle_number, driver_name, driver_contact,
                     material_type_id, direction, gross_weight, tare_weight, net_weight, vendor_id, notes, created_by, created_at)
                 VALUES
                    ($1,$2,$3,$4,$5,$6,$7,$8,$9,'OUT',$10,$11,$12,$13,$14,$15,NOW())`,
                [
                    crypto.randomUUID(),
                    SITE_ID,
                    PROJECT_ID,
                    today,
                    hhmmss(hour, minute),
                    vehicle,
                    '샘플기사',
                    '010-0000-0000',
                    weighingMaterialId,
                    gross,
                    tare,
                    net,
                    buyerId,
                    '[SAMPLE] outbound weighing',
                    'seed',
                ]
            )
        }

        // Anomalies / Allbaro statuses
        await client.query(
            `INSERT INTO swms_anomalies
                (id, site_id, anomaly_type, severity, title, description, entity_type, entity_id, status, detected_at, created_at, updated_at)
             VALUES
                ($1,$2,'WEIGHING_DEVIATION','warn',$3,$4,'WEIGHING',NULL,'OPEN',NOW(),NOW(),NOW()),
                ($5,$6,'NEGATIVE_INVENTORY','critical',$7,$8,'INVENTORY',NULL,'OPEN',NOW(),NOW(),NOW()),
                ($9,$10,'DOC_MISSING','warn',$11,$12,'SETTLEMENT',NULL,'OPEN',NOW(),NOW(),NOW())`,
            [
                crypto.randomUUID(),
                SITE_ID,
                '[SAMPLE] 계근 편차 의심',
                '동일 차량 평균 대비 중량 편차가 임계치를 초과했습니다.',
                crypto.randomUUID(),
                SITE_ID,
                '[SAMPLE] 재고 음수 발생',
                '재고가 0 미만으로 계산되었습니다(데이터 정합성 확인 필요).',
                crypto.randomUUID(),
                SITE_ID,
                '[SAMPLE] 정산 서류 누락',
                '정산 처리에 필요한 서류가 미등록 상태입니다.',
            ]
        )

        await client.query(
            `INSERT INTO swms_allbaro_sync
                (id, site_id, doc_type, entity_type, entity_id, external_key, sync_status, last_synced_at, error_message, retry_count, created_at, updated_at)
             VALUES
                ($1,$2,'TRANSFER','OUTBOUND',NULL,'SAMPLE-TRANSFER-001','FAILED',NOW(),$3,2,NOW(),NOW()),
                ($4,$5,'TRANSFER','OUTBOUND',NULL,'SAMPLE-TRANSFER-002','PENDING',NULL,NULL,0,NOW(),NOW())`,
            [
                crypto.randomUUID(),
                SITE_ID,
                '[SAMPLE] 올바로 전송 실패(샘플)',
                crypto.randomUUID(),
                SITE_ID,
            ]
        )

        // Market prices (virtual LME via aggregator): CU/AL/NI + FX
        // We only map sample Copper/Aluminum to CU/AL to demo pricing reference.
        const marketStart = addDays(now, -29)
        let fx = 1310
        let cu = 8600
        let al = 2400
        let ni = 16500
        let zn = 2500
        let sn = 26000

        const upsertMarket = async (priceDate, symbol, usdPerTon) => {
            const krwPerTon = usdPerTon * fx
            await client.query(
                `INSERT INTO swms_market_prices_daily
                    (price_date, source, symbol, price_usd_per_ton, fx_usdkrw, price_krw_per_ton, created_at, updated_at)
                 VALUES ($1::date,'AGGREGATOR',$2,$3,$4,$5,NOW(),NOW())
                 ON CONFLICT (price_date, source, symbol) DO UPDATE SET
                    price_usd_per_ton=EXCLUDED.price_usd_per_ton,
                    fx_usdkrw=EXCLUDED.fx_usdkrw,
                    price_krw_per_ton=EXCLUDED.price_krw_per_ton,
                    updated_at=NOW()`,
                [priceDate, symbol, usdPerTon, fx, krwPerTon]
            )
        }

        for (let i = 0; i < 30; i++) {
            const d = addDays(marketStart, i)
            const dStr = isoDate(d)
            fx = fx + (i % 7 === 0 ? -6 : i % 5 === 0 ? 4 : 0)
            cu = cu + (i % 6 === 0 ? -80 : i % 4 === 0 ? 95 : 25)
            al = al + (i % 8 === 0 ? -30 : 18)
            ni = ni + (i % 9 === 0 ? -120 : 60)
            zn = zn + (i % 5 === 0 ? -40 : 25)
            sn = sn + (i % 7 === 0 ? -150 : 80)

            await upsertMarket(dStr, 'CU', cu)
            await upsertMarket(dStr, 'AL', al)
            await upsertMarket(dStr, 'NI', ni)
            await upsertMarket(dStr, 'ZN', zn)
            await upsertMarket(dStr, 'SN', sn)
        }

        // Map materials to symbols
        await client.query(
            `INSERT INTO swms_market_symbol_map (material_type_id, symbol, source, unit)
             VALUES ($1,'CU','AGGREGATOR','TON')
             ON CONFLICT (material_type_id, symbol, source) DO NOTHING`,
            [materials[1].id]
        )
        await client.query(
            `INSERT INTO swms_market_symbol_map (material_type_id, symbol, source, unit)
             VALUES ($1,'AL','AGGREGATOR','TON')
             ON CONFLICT (material_type_id, symbol, source) DO NOTHING`,
            [materials[2].id]
        )
        await client.query(
            `INSERT INTO swms_market_symbol_map (material_type_id, symbol, source, unit)
             VALUES ($1,'ZN','AGGREGATOR','TON')
             ON CONFLICT (material_type_id, symbol, source) DO NOTHING`,
            [materials[4].id]
        )
        await client.query(
            `INSERT INTO swms_market_symbol_map (material_type_id, symbol, source, unit)
             VALUES ($1,'SN','AGGREGATOR','TON')
             ON CONFLICT (material_type_id, symbol, source) DO NOTHING`,
            [materials[5].id]
        )

        // Default coefficients per site/material
        await client.query(
            `INSERT INTO swms_pricing_coefficients (site_id, material_type_id, coefficient_pct, fixed_cost_krw_per_ton, updated_at)
             VALUES
                ($1,$2,60,120000,NOW()),
                ($1,$3,65,80000,NOW()),
                ($1,$4,55,150000,NOW()),
                ($1,$5,70,250000,NOW())
             ON CONFLICT (site_id, material_type_id) DO UPDATE SET
                coefficient_pct=EXCLUDED.coefficient_pct,
                fixed_cost_krw_per_ton=EXCLUDED.fixed_cost_krw_per_ton,
                updated_at=NOW()`,
            [SITE_ID, materials[1].id, materials[2].id, materials[4].id, materials[5].id]
        )

        // Seed today's approved price decision for CU/AL (so trend has blue line)
        const todayMarketCu = await client.query(
            `SELECT price_krw_per_ton, fx_usdkrw FROM swms_market_prices_daily
             WHERE price_date=$1::date AND source='AGGREGATOR' AND symbol='CU' LIMIT 1`,
            [today]
        )
        const todayMarketAl = await client.query(
            `SELECT price_krw_per_ton, fx_usdkrw FROM swms_market_prices_daily
             WHERE price_date=$1::date AND source='AGGREGATOR' AND symbol='AL' LIMIT 1`,
            [today]
        )
        const cuKrw = Number(todayMarketCu.rows[0]?.price_krw_per_ton || 0)
        const cuFx = Number(todayMarketCu.rows[0]?.fx_usdkrw || 0)
        const alKrw = Number(todayMarketAl.rows[0]?.price_krw_per_ton || 0)
        const alFx = Number(todayMarketAl.rows[0]?.fx_usdkrw || 0)

        const todayMarketZn = await client.query(
            `SELECT price_krw_per_ton, fx_usdkrw FROM swms_market_prices_daily
             WHERE price_date=$1::date AND source='AGGREGATOR' AND symbol='ZN' LIMIT 1`,
            [today]
        )
        const znKrw = Number(todayMarketZn.rows[0]?.price_krw_per_ton || 0)
        const znFx = Number(todayMarketZn.rows[0]?.fx_usdkrw || 0)

        const todayMarketSn = await client.query(
            `SELECT price_krw_per_ton, fx_usdkrw FROM swms_market_prices_daily
             WHERE price_date=$1::date AND source='AGGREGATOR' AND symbol='SN' LIMIT 1`,
            [today]
        )
        const snKrw = Number(todayMarketSn.rows[0]?.price_krw_per_ton || 0)
        const snFx = Number(todayMarketSn.rows[0]?.fx_usdkrw || 0)

        const approveDecision = async (materialTypeId, symbol, lmeKrw, fxUsdKrw, coeffPct, fixedCost) => {
            const suggested = lmeKrw * (coeffPct / 100) - fixedCost
            const approved = Math.round(suggested)
            await client.query(
                `INSERT INTO swms_pricing_decisions (
                    site_id, material_type_id, effective_date, reference_date, source, symbol,
                    lme_krw_per_ton, fx_usdkrw, coefficient_pct, fixed_cost_krw_per_ton,
                    suggested_krw_per_ton, approved_krw_per_ton, status, approved_by, approved_at, note
                 )
                 VALUES ($1,$2,$3::date,$3::date,'AGGREGATOR',$4,$5,$6,$7,$8,$9,$10,'APPROVED','[SAMPLE] 대표',NOW(),'[SAMPLE] seed decision')
                 ON CONFLICT (site_id, material_type_id, effective_date) DO UPDATE SET
                    approved_krw_per_ton=EXCLUDED.approved_krw_per_ton,
                    suggested_krw_per_ton=EXCLUDED.suggested_krw_per_ton,
                    approved_at=NOW(),
                    updated_at=NOW()`,
                [SITE_ID, materialTypeId, today, symbol, lmeKrw, fxUsdKrw, coeffPct, fixedCost, Math.round(suggested), approved]
            )
        }

        await approveDecision(materials[1].id, 'CU', cuKrw, cuFx, 60, 120000)
        await approveDecision(materials[2].id, 'AL', alKrw, alFx, 65, 80000)
        await approveDecision(materials[4].id, 'ZN', znKrw, znFx, 55, 150000)
        await approveDecision(materials[5].id, 'SN', snKrw, snFx, 70, 250000)

        await client.query('COMMIT')

        const summary = await client.query(
            `
            SELECT
                (SELECT COUNT(*) FROM swms_inbounds WHERE project_id=$1) AS inbounds,
                (SELECT COUNT(*) FROM swms_outbounds WHERE project_id=$1) AS outbounds,
                (SELECT COUNT(*) FROM swms_weighings WHERE project_id=$1) AS weighings,
                (SELECT COUNT(*) FROM swms_inventory WHERE site_id=$2) AS inventory_rows,
                (SELECT COUNT(*) FROM swms_anomalies WHERE site_id=$2 AND title LIKE '[SAMPLE]%') AS anomalies,
                (SELECT COUNT(*) FROM swms_market_prices_daily WHERE price_date >= CURRENT_DATE - 29 AND source='AGGREGATOR') AS market_rows,
                (SELECT COUNT(*) FROM swms_pricing_decisions WHERE site_id=$2 AND note LIKE '[SAMPLE]%') AS pricing_decisions
            `,
            [PROJECT_ID, SITE_ID]
        )

        console.log('[seed swms dashboard] done:', summary.rows[0])
        console.log('[seed swms dashboard] site_id=', SITE_ID, 'project_id=', PROJECT_ID)
    } catch (e) {
        await client.query('ROLLBACK')
        console.error('[seed swms dashboard] failed:', e)
        process.exitCode = 1
    } finally {
        client.release()
        await pool.end()
    }
}

main()
