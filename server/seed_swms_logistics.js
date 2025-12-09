const { Pool } = require('pg')
const path = require('path')
require('dotenv').config({ path: path.join(__dirname, '.env') })

const pool = new Pool({
    user: process.env.DB_USER,
    host: process.env.DB_HOST,
    database: process.env.DB_NAME,
    password: process.env.DB_PASSWORD,
    port: process.env.DB_PORT || 5432,
    ssl: { rejectUnauthorized: false }
})

const WAREHOUSES = [
    { code: 'PJU-01', name: '파주 중앙창고', allow_hazardous: true, location: '파주 캠퍼스' },
    { code: 'PJU-02', name: '파주 임시보관', allow_hazardous: false, location: '파주 캠퍼스' },
    { code: 'PTK-01', name: '평택 메인창고', allow_hazardous: true, location: '평택 P3' },
    { code: 'PTK-02', name: '평택 야적장', allow_hazardous: false, location: '평택 P3' }
]

const inboundTypes = ['내부발생', '외부반입', '조정입고']
const outboundTypes = ['매각출고', '위탁폐기', '이동출고']

function pad(n) {
    return n.toString().padStart(2, '0')
}

function docNumber(prefix, projectCode, projectId, date, seq) {
    const d = new Date(date)
    const y = d.getFullYear()
    const m = pad(d.getMonth() + 1)
    const dd = pad(d.getDate())
    const rawBase =
        projectCode && projectCode.trim().length > 0
            ? projectCode
            : projectId
            ? projectId.replace(/-/g, '')
            : 'PRJ'
    const cleaned = rawBase.replace(/[^A-Z0-9]/gi, '').toUpperCase()
    const idTail = projectId ? projectId.replace(/-/g, '').slice(-4) : '0000'
    const code = `${(cleaned.length > 0 ? cleaned.slice(0, 6) : 'PRJ')}${idTail}`
    return `${prefix}-${code}-${y}${m}${dd}-${pad(seq)}`
}

async function ensureTables(client) {
    await client.query(`
        CREATE TABLE IF NOT EXISTS swms_warehouses (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            code VARCHAR(50) UNIQUE NOT NULL,
            name VARCHAR(255) NOT NULL,
            location VARCHAR(255),
            allow_hazardous BOOLEAN DEFAULT false,
            is_active BOOLEAN DEFAULT true,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
    `)

    await client.query(`
        CREATE TABLE IF NOT EXISTS swms_inbound_docs (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            document_no VARCHAR(80) UNIQUE NOT NULL,
            project_id UUID NOT NULL,
            warehouse_id UUID NOT NULL REFERENCES swms_warehouses(id),
            doc_date DATE NOT NULL,
            inbound_type VARCHAR(50) NOT NULL,
            process_name VARCHAR(255),
            vendor_id UUID,
            weighing_id UUID,
            status VARCHAR(30) NOT NULL DEFAULT 'DRAFT',
            remarks TEXT,
            created_by VARCHAR(100),
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
    `)

    await client.query(`
        CREATE TABLE IF NOT EXISTS swms_inbound_lines (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            inbound_id UUID NOT NULL REFERENCES swms_inbound_docs(id) ON DELETE CASCADE,
            line_no INT NOT NULL,
            material_type_id UUID NOT NULL REFERENCES swms_material_types(id),
            material_name VARCHAR(200) NOT NULL,
            lot_no VARCHAR(80) NOT NULL,
            weight DECIMAL(12,2) NOT NULL,
            quantity DECIMAL(12,2),
            unit VARCHAR(20) NOT NULL,
            unit_price DECIMAL(14,2),
            amount DECIMAL(16,2),
            storage_zone VARCHAR(80),
            hazardous BOOLEAN DEFAULT false,
            remarks TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(inbound_id, line_no)
        );
    `)

    await client.query(`
        CREATE TABLE IF NOT EXISTS swms_outbound_docs (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            document_no VARCHAR(80) UNIQUE NOT NULL,
            project_id UUID NOT NULL,
            src_warehouse_id UUID NOT NULL REFERENCES swms_warehouses(id),
            dest_warehouse_id UUID,
            doc_date DATE NOT NULL,
            outbound_type VARCHAR(50) NOT NULL,
            vendor_id UUID,
            carrier_id UUID,
            weighing_id UUID,
            status VARCHAR(30) NOT NULL DEFAULT 'DRAFT',
            requester VARCHAR(100),
            approver VARCHAR(100),
            remarks TEXT,
            created_by VARCHAR(100),
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
    `)

    await client.query(`
        CREATE TABLE IF NOT EXISTS swms_outbound_lines (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            outbound_id UUID NOT NULL REFERENCES swms_outbound_docs(id) ON DELETE CASCADE,
            line_no INT NOT NULL,
            material_type_id UUID NOT NULL REFERENCES swms_material_types(id),
            material_name VARCHAR(200) NOT NULL,
            lot_no VARCHAR(80) NOT NULL,
            weight DECIMAL(12,2) NOT NULL,
            quantity DECIMAL(12,2),
            unit VARCHAR(20) NOT NULL,
            unit_price DECIMAL(14,2),
            amount DECIMAL(16,2),
            carrier VARCHAR(120),
            vehicle_no VARCHAR(50),
            remarks TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(outbound_id, line_no)
        );
    `)

    await client.query(`
        CREATE TABLE IF NOT EXISTS swms_inventory_snapshots (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            project_id UUID NOT NULL,
            warehouse_id UUID NOT NULL REFERENCES swms_warehouses(id),
            material_type_id UUID NOT NULL REFERENCES swms_material_types(id),
            material_name VARCHAR(200) NOT NULL,
            lot_no VARCHAR(80) NOT NULL,
            on_hand_weight DECIMAL(12,2) NOT NULL,
            on_hand_qty DECIMAL(12,2),
            unit VARCHAR(20) NOT NULL,
            hazardous BOOLEAN DEFAULT false,
            first_inbound_date DATE,
            last_movement_date DATE,
            snapshot_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(project_id, warehouse_id, material_type_id, lot_no)
        );
    `)
}

async function ensureWarehouses(client) {
    for (const wh of WAREHOUSES) {
        await client.query(
            `
            INSERT INTO swms_warehouses (code, name, location, allow_hazardous)
            VALUES ($1, $2, $3, $4)
            ON CONFLICT (code) DO UPDATE SET
                name = EXCLUDED.name,
                location = EXCLUDED.location,
                allow_hazardous = EXCLUDED.allow_hazardous;
            `,
            [wh.code, wh.name, wh.location, wh.allow_hazardous]
        )
    }
}

async function seed() {
    const client = await pool.connect()
    try {
        // Ensure schema + warehouse master first (auto-commit)
        await ensureTables(client)
        await ensureWarehouses(client)

        await client.query('BEGIN')

        const projects = (await client.query('SELECT id, name, code FROM projects ORDER BY name')).rows
        if (projects.length === 0) throw new Error('프로젝트가 없습니다.')

        const mtypes = (await client.query('SELECT id, name, category, unit FROM swms_material_types ORDER BY name')).rows
        const vendors = (await client.query('SELECT id, name FROM swms_vendors ORDER BY name')).rows

        const warehouseMap = new Map((await client.query('SELECT id, code FROM swms_warehouses')).rows.map(w => [w.code, w.id]))

        const materialByIdx = (idx) => mtypes[idx % mtypes.length]
        const vendorByIdx = (idx) => vendors[idx % vendors.length]

        // wipe old sample data
        await client.query('DELETE FROM swms_inventory_snapshots')
        await client.query('DELETE FROM swms_outbound_lines')
        await client.query('DELETE FROM swms_outbound_docs')
        await client.query('DELETE FROM swms_inbound_lines')
        await client.query('DELETE FROM swms_inbound_docs')

        const globalDocNos = new Set()

        for (const project of projects) {
            const seenDocNos = new Set()
            const inboundTotals = {}
            const inboundKeys = []
            let inSeq = 1
            let outSeq = 1

            // Inbounds
            for (let i = 0; i < 10; i++) {
                const mt = materialByIdx(i)
                const date = new Date(2025, 11, 1 + i) // December 2025
                const docNo = docNumber('IN', project.code || project.name, project.id, date, inSeq++)
                if (seenDocNos.has(docNo) || globalDocNos.has(docNo)) {
                    throw new Error(`중복 입고번호 감지: ${docNo}`)
                }
                seenDocNos.add(docNo)
                globalDocNos.add(docNo)
                const warehouseCode = project.name.includes('평택') ? 'PTK-01' : 'PJU-01'
                const warehouseId = warehouseMap.get(warehouseCode)
                const inboundType = inboundTypes[i % inboundTypes.length]
                const vendor = i % 2 === 0 ? vendorByIdx(i) : null
                const status = 'CONFIRMED'
                const lot = `${mt.name.slice(0, 2)}-${docNo}-L${i + 1}`
                const weight = Number((Math.random() * 5 + 1.2).toFixed(2))
                const unitPrice = inboundType === '외부반입' ? Number((Math.random() * 50 + 120).toFixed(2)) : null
                const amount = unitPrice ? Number((weight * unitPrice).toFixed(2)) : null

                const inbound = await client.query(
                    `
                    INSERT INTO swms_inbound_docs (
                        document_no, project_id, warehouse_id, doc_date, inbound_type,
                        process_name, vendor_id, status, remarks, created_by
                    ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
                    RETURNING id
                    `,
                    [
                        docNo,
                        project.id,
                        warehouseId,
                        date,
                        inboundType,
                        inboundType === '내부발생' ? '해체/정리 공정' : null,
                        vendor?.id || null,
                        status,
                        '샘플 입고 데이터',
                        'sample-bot'
                    ]
                )

                await client.query(
                    `
                    INSERT INTO swms_inbound_lines (
                        inbound_id, line_no, material_type_id, material_name, lot_no,
                        weight, quantity, unit, unit_price, amount, storage_zone, hazardous, remarks
                    ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
                    `,
                    [
                        inbound.rows[0].id,
                        1,
                        mt.id,
                        mt.name,
                        lot,
                        weight,
                        null,
                        mt.unit || '톤',
                        unitPrice,
                        amount,
                        'Z1',
                        mt.category === '폐기물',
                        '자동 생성'
                    ]
                )

                if (status === 'CONFIRMED') {
                    const key = `${warehouseId}|${mt.id}|${lot}`
                    if (!inboundTotals[key]) {
                        inboundTotals[key] = {
                            project_id: project.id,
                            warehouse_id: warehouseId,
                            material_type_id: mt.id,
                            material_name: mt.name,
                            lot_no: lot,
                            unit: mt.unit || '톤',
                            hazardous: mt.category === '폐기물',
                            first_inbound_date: date,
                            last_movement_date: date,
                            on_hand_weight: 0
                        }
                    }
                    inboundTotals[key].on_hand_weight += weight
                    inboundTotals[key].last_movement_date = date
                    inboundKeys.push(key)
                }
            }

            // Outbounds
            for (let i = 0; i < 10; i++) {
                const mt = materialByIdx(i + 3)
                const date = new Date(2025, 11, 10 + i)
                const docNo = docNumber('OUT', project.code || project.name, project.id, date, outSeq++)
                if (seenDocNos.has(docNo) || globalDocNos.has(docNo)) {
                    throw new Error(`중복 출고번호 감지: ${docNo}`)
                }
                seenDocNos.add(docNo)
                globalDocNos.add(docNo)
                const srcWarehouse = project.name.includes('평택') ? 'PTK-01' : 'PJU-01'
                const srcWarehouseId = warehouseMap.get(srcWarehouse)
                const destWarehouseId = project.name.includes('평택') ? warehouseMap.get('PTK-02') : warehouseMap.get('PJU-02')
                const outboundType = outboundTypes[i % outboundTypes.length]
                const vendor = vendorByIdx(i + 1)
                const status = i < 8 ? 'CONFIRMED' : 'REQUESTED'
                const lot = `${mt.name.slice(0, 2)}-OUT-${i + 1}`
                const weight = Number((Math.random() * 3 + 0.8).toFixed(2))
                const unitPrice = outboundType === '매각출고' ? Number((Math.random() * 80 + 150).toFixed(2)) : null
                const amount = unitPrice ? Number((weight * unitPrice).toFixed(2)) : null

                const outbound = await client.query(
                    `
                    INSERT INTO swms_outbound_docs (
                        document_no, project_id, src_warehouse_id, dest_warehouse_id, doc_date,
                        outbound_type, vendor_id, status, requester, approver, remarks, created_by
                    ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
                    RETURNING id
                    `,
                    [
                        docNo,
                        project.id,
                        srcWarehouseId,
                        outboundType === '이동출고' ? destWarehouseId : null,
                        date,
                        outboundType,
                        vendor.id,
                        status,
                        'sample-requester',
                        status === 'CONFIRMED' ? 'sample-approver' : null,
                        '샘플 출고 데이터',
                        'sample-bot'
                    ]
                )

                await client.query(
                    `
                    INSERT INTO swms_outbound_lines (
                        outbound_id, line_no, material_type_id, material_name, lot_no,
                        weight, quantity, unit, unit_price, amount, carrier, vehicle_no, remarks
                    ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
                    `,
                    [
                        outbound.rows[0].id,
                        1,
                        mt.id,
                        mt.name,
                        lot,
                        weight,
                        null,
                        mt.unit || '톤',
                        unitPrice,
                        amount,
                        '샘플운반사',
                        '89가1234',
                        '자동 생성'
                    ]
                )

                if (status === 'CONFIRMED') {
                    // subtract from a matching lot but keep some balance for snapshots
                    const candidates = inboundKeys.filter((k) => k.split('|')[1] === mt.id)
                    const matchKey = candidates.length ? candidates[i % candidates.length] : inboundKeys[i % inboundKeys.length]
                    if (matchKey) {
                        const available = inboundTotals[matchKey].on_hand_weight
                        const take = Math.min(available * 0.6, weight) // leave at least 40% to keep inventory visible
                        inboundTotals[matchKey].on_hand_weight = Math.max(
                            0,
                            Number((inboundTotals[matchKey].on_hand_weight - take).toFixed(2))
                        )
                        inboundTotals[matchKey].last_movement_date = date
                    }
                }
            }

            // Snapshots from on-hand
            for (const key of Object.keys(inboundTotals)) {
                const snap = inboundTotals[key]
                await client.query(
                    `
                    INSERT INTO swms_inventory_snapshots (
                        project_id, warehouse_id, material_type_id, material_name, lot_no,
                        on_hand_weight, on_hand_qty, unit, hazardous,
                        first_inbound_date, last_movement_date
                    ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
                    ON CONFLICT (project_id, warehouse_id, material_type_id, lot_no) DO UPDATE SET
                        on_hand_weight = EXCLUDED.on_hand_weight,
                        on_hand_qty = EXCLUDED.on_hand_qty,
                        unit = EXCLUDED.unit,
                        hazardous = EXCLUDED.hazardous,
                        first_inbound_date = EXCLUDED.first_inbound_date,
                        last_movement_date = EXCLUDED.last_movement_date,
                        snapshot_at = CURRENT_TIMESTAMP;
                    `,
                    [
                        snap.project_id,
                        snap.warehouse_id,
                        snap.material_type_id,
                        snap.material_name,
                        snap.lot_no,
                        Number(snap.on_hand_weight.toFixed(2)),
                        null,
                        snap.unit,
                        snap.hazardous,
                        snap.first_inbound_date,
                        snap.last_movement_date
                    ]
                )
            }

            console.log(`✅ ${project.name}: 입고 10건, 출고 10건, 재고 스냅샷 ${Object.keys(inboundTotals).length}건`)
        }

        await client.query('COMMIT')
        console.log('\n🎉 SWMS 물류 샘플데이터가 준비되었습니다.')
    } catch (err) {
        await client.query('ROLLBACK')
        console.error('❌ Error seeding logistics data:', err.message)
        process.exitCode = 1
    } finally {
        client.release()
        await pool.end()
    }
}

seed()
