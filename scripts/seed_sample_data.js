const fs = require('fs')
const path = require('path')
const crypto = require('crypto')
const { Pool } = require('pg')
const dotenv = require('dotenv')

function loadEnv() {
    const candidates = [
        path.join(__dirname, '..', 'server', 'env_customer.env'),
        path.join(__dirname, '..', 'server', '.env'),
        path.join(__dirname, '..', 'functions', '.env'),
        path.join(__dirname, '..', '.env'),
    ]
    for (const p of candidates) {
        if (fs.existsSync(p)) {
            dotenv.config({ path: p })
            console.log(`[seed] Loaded env: ${p}`)
            return
        }
    }
    dotenv.config()
}

function isUuid(value) {
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value || '')
}

async function tableExists(client, table) {
    const q = 'SELECT to_regclass($1) AS reg'
    const r = await client.query(q, [`public.${table}`])
    return !!r.rows[0]?.reg
}

async function getTableColumns(client, table) {
    const q = `
        SELECT column_name
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = $1
    `
    const r = await client.query(q, [table])
    return new Set(r.rows.map((row) => row.column_name))
}

async function getColumnInfo(client, table) {
    const q = `
        SELECT column_name, data_type
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = $1
    `
    const r = await client.query(q, [table])
    const info = new Map()
    for (const row of r.rows) {
        info.set(row.column_name, row.data_type)
    }
    return info
}

async function insertRow(client, table, columns, valuesByField, requiredFields) {
    const fields = Object.keys(valuesByField).filter((field) => columns.has(field))
    for (const required of requiredFields) {
        if (!fields.includes(required)) {
            console.log(`[seed] ${table} missing required column ${required}, skipping`)
            return false
        }
    }
    const placeholders = fields.map((_, i) => `$${i + 1}`)
    const values = fields.map((field) => valuesByField[field])
    await client.query(
        `INSERT INTO ${table} (${fields.join(', ')}) VALUES (${placeholders.join(', ')})`,
        values
    )
    return true
}

async function getProjectId(client) {
    if (!(await tableExists(client, 'projects'))) return null
    try {
        const r = await client.query('SELECT id FROM projects LIMIT 1')
        return r.rows[0]?.id || null
    } catch (e) {
        console.warn('[seed] Failed to fetch project id:', e.message)
        return null
    }
}

async function getSwmsSiteId(client) {
    if (!(await tableExists(client, 'swms_sites'))) return null
    try {
        const r = await client.query('SELECT id FROM swms_sites LIMIT 1')
        return r.rows[0]?.id || null
    } catch (e) {
        console.warn('[seed] Failed to fetch SWMS site id:', e.message)
        return null
    }
}

async function main() {
    loadEnv()

    const dbConfig = {
        user: process.env.DB_USER,
        database: process.env.DB_NAME,
        password: process.env.DB_PASSWORD,
        port: process.env.DB_PORT || 5432,
        host: process.env.DB_HOST || 'localhost',
    }

    if (!dbConfig.user || !dbConfig.database || !dbConfig.password) {
        throw new Error('Missing DB connection env values (DB_USER/DB_NAME/DB_PASSWORD)')
    }

    const host = String(dbConfig.host || '')
    const isLocal = host === 'localhost' || host === '127.0.0.1'
    if (!isLocal && !host.startsWith('/cloudsql')) {
        dbConfig.ssl = { rejectUnauthorized: false }
    }

    const pool = new Pool(dbConfig)
    const client = await pool.connect()

    try {
        const projectIdRaw = await getProjectId(client)
        const projectId = isUuid(projectIdRaw) ? projectIdRaw : null
        const siteIdEnv = process.env.SWMS_SITE_ID || 'FAC-001'
        let swmsSiteId = siteIdEnv

        // EMS: equipment
        if (await tableExists(client, 'equipment')) {
            const eqColumns = await getTableColumns(client, 'equipment')
            const eqRes = await client.query(
                "SELECT COUNT(*)::int AS cnt FROM equipment WHERE equipment_id LIKE 'SAMPLE-%'"
            )
            if ((eqRes.rows[0]?.cnt || 0) === 0) {
                const equipmentList = [
                    {
                        equipment_id: 'SAMPLE-EQ-001',
                        name: 'Sample Excavator',
                        category: 'HEAVY',
                        manufacturer: 'SampleCo',
                        equipment_status: 'ACTIVE',
                        assigned_site: 'Sample Yard',
                    },
                    {
                        equipment_id: 'SAMPLE-EQ-002',
                        name: 'Sample Forklift',
                        category: 'LOGISTICS',
                        manufacturer: 'SampleCo',
                        equipment_status: 'IDLE',
                        assigned_site: 'Sample Yard',
                    },
                    {
                        equipment_id: 'SAMPLE-EQ-003',
                        name: 'Sample Crane',
                        category: 'LIFT',
                        manufacturer: 'SampleCo',
                        equipment_status: 'MAINTENANCE',
                        assigned_site: 'Sample Yard',
                    },
                ]

                for (const eq of equipmentList) {
                    const valuesByField = {
                        id: crypto.randomUUID(),
                        equipment_id: eq.equipment_id,
                        name: eq.name,
                        category: eq.category,
                        manufacturer: eq.manufacturer,
                        equipment_status: eq.equipment_status,
                        assigned_site: eq.assigned_site,
                    }
                    const fields = Object.keys(valuesByField).filter((field) => eqColumns.has(field))
                    if (!fields.includes('name')) {
                        console.log('[seed] equipment table missing required columns, skipping')
                        break
                    }
                    const placeholders = fields.map((_, i) => `$${i + 1}`)
                    const values = fields.map((field) => valuesByField[field])
                    await client.query(
                        `INSERT INTO equipment (${fields.join(', ')}) VALUES (${placeholders.join(', ')})`,
                        values
                    )
                }
                console.log('[seed] EMS equipment inserted')
            } else {
                console.log('[seed] EMS equipment already present')
            }
        }

        // SMS: risk standards (for RA editor)
        if (await tableExists(client, 'sms_risk_standard_items')) {
            const standardColumns = await getTableColumns(client, 'sms_risk_standard_items')
            const standardRes = await client.query(
                "SELECT COUNT(*)::int AS cnt FROM sms_risk_standard_items WHERE construction_type = 'GENERAL'"
            )
            if ((standardRes.rows[0]?.cnt || 0) === 0) {
                await insertRow(
                    client,
                    'sms_risk_standard_items',
                    standardColumns,
                    {
                        id: crypto.randomUUID(),
                        construction_type: 'GENERAL',
                        step: 'Step 1',
                        risk_factor: 'Slip',
                        risk_factor_detail: 'Wet floor',
                        risk_level: 'MED',
                        measure: 'Clean up',
                        measure_detail: 'Dry the floor',
                        residual_risk: 'LOW',
                        created_at: new Date(),
                    },
                    ['risk_factor']
                )
                await insertRow(
                    client,
                    'sms_risk_standard_items',
                    standardColumns,
                    {
                        id: crypto.randomUUID(),
                        construction_type: 'GENERAL',
                        step: 'Step 2',
                        risk_factor: 'Trip',
                        risk_factor_detail: 'Loose cables',
                        risk_level: 'MED',
                        measure: 'Secure',
                        measure_detail: 'Bundle and tape cables',
                        residual_risk: 'LOW',
                        created_at: new Date(),
                    },
                    ['risk_factor']
                )
                console.log('[seed] SMS risk standards inserted')
            } else {
                console.log('[seed] SMS risk standards already present')
            }
        }

        // SMS: risk assessments + items
        if (await tableExists(client, 'sms_risk_assessments')) {
            const raColumns = await getTableColumns(client, 'sms_risk_assessments')
            const itemColumns = await getTableColumns(client, 'sms_risk_items')
            const raRes = await client.query(
                "SELECT COUNT(*)::int AS cnt FROM sms_risk_assessments WHERE process_name LIKE 'Sample Process%'"
            )
            if ((raRes.rows[0]?.cnt || 0) === 0) {
                const raId = crypto.randomUUID()
                await insertRow(
                    client,
                    'sms_risk_assessments',
                    raColumns,
                    {
                        id: raId,
                        project_id: projectId,
                        process_name: 'Sample Process - Demo',
                        assessor_name: 'Sample Assessor',
                        approver_name: 'Sample Approver',
                        status: 'APPROVED',
                    },
                    ['process_name']
                )

                await insertRow(
                    client,
                    'sms_risk_items',
                    itemColumns,
                    {
                        id: crypto.randomUUID(),
                        assessment_id: raId,
                        risk_factor: 'Fall from height',
                        risk_type: 'FALL',
                        frequency: 3,
                        severity: 4,
                        mitigation_measure: 'Use harness',
                        action_manager: 'Sample Manager',
                        action_deadline: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
                    },
                    ['assessment_id', 'risk_factor']
                )
                await insertRow(
                    client,
                    'sms_risk_items',
                    itemColumns,
                    {
                        id: crypto.randomUUID(),
                        assessment_id: raId,
                        risk_factor: 'Equipment collision',
                        risk_type: 'HIT',
                        frequency: 2,
                        severity: 3,
                        mitigation_measure: 'Add spotter',
                        action_manager: 'Sample Manager',
                        action_deadline: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000),
                    },
                    ['assessment_id', 'risk_factor']
                )

                console.log('[seed] SMS risk assessments inserted')
            } else {
                console.log('[seed] SMS risk assessments already present')
            }
        }

        // SMS: DRIs
        if (await tableExists(client, 'sms_dris')) {
            const driColumns = await getTableColumns(client, 'sms_dris')
            const driRes = await client.query(
                "SELECT COUNT(*)::int AS cnt FROM sms_dris WHERE created_by = 'Sample User'"
            )
            if ((driRes.rows[0]?.cnt || 0) === 0) {
                await insertRow(
                    client,
                    'sms_dris',
                    driColumns,
                    {
                        id: crypto.randomUUID(),
                        project_id: projectId,
                        date: new Date(),
                        location: 'Sample Zone A',
                        work_content: 'Sample welding work',
                        risk_points: 'Hot work and sparks',
                        attendees_count: 12,
                        status: 'COMPLETED',
                        created_by: 'Sample User',
                    },
                    ['created_by']
                )
                console.log('[seed] SMS DRIs inserted')
            } else {
                console.log('[seed] SMS DRIs already present')
            }
        }

        // SMS: Patrols
        if (await tableExists(client, 'sms_patrols')) {
            const patrolColumns = await getTableColumns(client, 'sms_patrols')
            const patrolRes = await client.query(
                "SELECT COUNT(*)::int AS cnt FROM sms_patrols WHERE created_by = 'sample-user'"
            )
            if ((patrolRes.rows[0]?.cnt || 0) === 0) {
                await insertRow(
                    client,
                    'sms_patrols',
                    patrolColumns,
                    {
                        project_id: null,
                        location: 'Sample Area B',
                        issue_type: 'HOUSEKEEPING',
                        severity: 'MED',
                        description: 'Obstructions found in walkway',
                        action_required: 'Clear path and add signage',
                        status: 'OPEN',
                        created_by: 'sample-user',
                    },
                    ['location']
                )
                console.log('[seed] SMS patrols inserted')
            } else {
                console.log('[seed] SMS patrols already present')
            }
        }

        // SMS: Checklist templates
        if (await tableExists(client, 'sms_checklist_templates')) {
            const tplRes = await client.query(
                "SELECT COUNT(*)::int AS cnt FROM sms_checklist_templates WHERE id = 'TPL-001'"
            )
            if ((tplRes.rows[0]?.cnt || 0) === 0) {
                const items = [
                    { label: 'PPE worn', value: 'ppe', required: true },
                    { label: 'Area clean', value: 'clean', required: true },
                ]
                await client.query(
                    `INSERT INTO sms_checklist_templates (
                        id, title, items, category, updated_at
                    ) VALUES ($1, $2, $3, $4, CURRENT_DATE)`,
                    ['TPL-001', 'Sample Daily Checklist', JSON.stringify(items), 'GENERAL']
                )
                console.log('[seed] SMS checklist template inserted')
            } else {
                console.log('[seed] SMS checklist template already present')
            }
        }

        // SWMS: master data
        let materialTypeId = null
        let vendorId = null
        if (await tableExists(client, 'swms_material_types')) {
            const materialColumns = await getTableColumns(client, 'swms_material_types')
            const mtRes = await client.query('SELECT id FROM swms_material_types ORDER BY name LIMIT 1')
            if (mtRes.rows.length === 0) {
                materialTypeId = crypto.randomUUID()
                await insertRow(
                    client,
                    'swms_material_types',
                    materialColumns,
                    {
                        id: materialTypeId,
                        code: 'SAMPLE-MT-001',
                        name: 'Sample Scrap',
                        category: 'SCRAP',
                        unit: 'TON',
                        unit_price: 350000,
                        symbol: 'SC',
                    },
                    ['name']
                )
            } else {
                materialTypeId = mtRes.rows[0].id
            }
        }

        if (await tableExists(client, 'swms_vendors')) {
            const vendorColumns = await getTableColumns(client, 'swms_vendors')
            const vRes = await client.query('SELECT id FROM swms_vendors ORDER BY name LIMIT 1')
            if (vRes.rows.length === 0) {
                vendorId = crypto.randomUUID()
                await insertRow(
                    client,
                    'swms_vendors',
                    vendorColumns,
                    {
                        id: vendorId,
                        code: 'SAMPLE-VND-001',
                        name: 'Sample Vendor',
                        type: 'RECYCLER',
                    },
                    ['name']
                )
            } else {
                vendorId = vRes.rows[0].id
            }
        }

        // SWMS: ensure site exists (for FK constraints)
        if (await tableExists(client, 'swms_sites')) {
            const siteInfo = await getColumnInfo(client, 'swms_sites')
            let existingSiteId = await getSwmsSiteId(client)

            if (!existingSiteId) {
                let companyId = null
                if (await tableExists(client, 'swms_companies')) {
                    const companyColumns = await getTableColumns(client, 'swms_companies')
                    const companyRes = await client.query('SELECT id FROM swms_companies LIMIT 1')
                    if (companyRes.rows.length === 0) {
                        companyId = crypto.randomUUID()
                        await insertRow(
                            client,
                            'swms_companies',
                            companyColumns,
                            {
                                id: companyId,
                                code: 'SAMPLE-COMP',
                                name: 'Sample Company',
                                registration_number: 'REG-0001',
                                ceo_name: 'Sample CEO',
                                address: 'Sample Address',
                            },
                            ['code', 'name']
                        )
                    } else {
                        companyId = companyRes.rows[0].id
                    }
                }

                existingSiteId = crypto.randomUUID()
                const siteColumns = await getTableColumns(client, 'swms_sites')
                await insertRow(
                    client,
                    'swms_sites',
                    siteColumns,
                    {
                        id: existingSiteId,
                        company_id: companyId,
                        code: 'SAMPLE-SITE',
                        name: 'Sample Site',
                        type: 'FACTORY',
                        address: 'Sample Address',
                        is_active: true,
                    },
                    ['code', 'name']
                )
            }

            if (siteInfo.get('id') === 'uuid') {
                swmsSiteId = existingSiteId
            }
        }

        // SWMS: warehouses
        let warehouseId = null
        if (await tableExists(client, 'swms_warehouses')) {
            const warehouseColumns = await getTableColumns(client, 'swms_warehouses')
            const warehouseInfo = await getColumnInfo(client, 'swms_warehouses')
            if (warehouseInfo.get('site_id') === 'uuid' && !isUuid(swmsSiteId)) {
                swmsSiteId = (await getSwmsSiteId(client)) || crypto.randomUUID()
            }
            const whRes = await client.query(
                "SELECT id FROM swms_warehouses WHERE site_id::text = $1::text AND name = 'Sample Warehouse A' LIMIT 1",
                [swmsSiteId]
            )
            if (whRes.rows.length === 0) {
                warehouseId = crypto.randomUUID()
                await insertRow(
                    client,
                    'swms_warehouses',
                    warehouseColumns,
                    {
                        id: warehouseId,
                        site_id: swmsSiteId,
                        code: 'SAMPLE-WH-A',
                        name: 'Sample Warehouse A',
                        type: 'General',
                    },
                    ['name']
                )
                await insertRow(
                    client,
                    'swms_warehouses',
                    warehouseColumns,
                    {
                        id: crypto.randomUUID(),
                        site_id: swmsSiteId,
                        code: 'SAMPLE-WH-B',
                        name: 'Sample Warehouse B',
                        type: 'Indoor',
                    },
                    ['name']
                )
            } else {
                warehouseId = whRes.rows[0].id
            }
        }

        // SWMS: generations
        if (await tableExists(client, 'swms_generations') && materialTypeId) {
            const genColumns = await getTableColumns(client, 'swms_generations')
            const gRes = await client.query(
                'SELECT COUNT(*)::int AS cnt FROM swms_generations WHERE site_id::text = $1::text',
                [swmsSiteId]
            )
            if ((gRes.rows[0]?.cnt || 0) === 0) {
                await insertRow(
                    client,
                    'swms_generations',
                    genColumns,
                    {
                        id: crypto.randomUUID(),
                        site_id: swmsSiteId,
                        project_id: null,
                        generation_date: new Date(),
                        material_type_id: materialTypeId,
                        process_name: 'Sample Generation',
                        quantity: 2.5,
                        unit: 'TON',
                        location: 'Sample Line',
                        notes: 'Seeded sample',
                        status: 'REGISTERED',
                        created_by: 'seed-script',
                    },
                    ['site_id']
                )
                console.log('[seed] SWMS generations inserted')
            } else {
                console.log('[seed] SWMS generations already present')
            }
        }

        // SWMS: weighings
        if (await tableExists(client, 'swms_weighings') && materialTypeId && vendorId) {
            const weighingColumns = await getTableColumns(client, 'swms_weighings')
            const wRes = await client.query(
                'SELECT COUNT(*)::int AS cnt FROM swms_weighings WHERE site_id::text = $1::text',
                [swmsSiteId]
            )
            if ((wRes.rows[0]?.cnt || 0) === 0) {
                await insertRow(
                    client,
                    'swms_weighings',
                    weighingColumns,
                    {
                        id: crypto.randomUUID(),
                        site_id: swmsSiteId,
                        project_id: null,
                        weighing_date: new Date(),
                        weighing_time: new Date().toISOString().slice(11, 19),
                        vehicle_number: 'SAMPLE-VEH-001',
                        driver_name: 'Sample Driver',
                        driver_contact: '010-0000-0000',
                        material_type_id: materialTypeId,
                        direction: 'IN',
                        gross_weight: 12.5,
                        tare_weight: 4.0,
                        net_weight: 8.5,
                        vendor_id: vendorId,
                        notes: 'Seeded sample',
                        created_by: 'seed-script',
                    },
                    ['site_id']
                )
                console.log('[seed] SWMS weighings inserted')
            } else {
                console.log('[seed] SWMS weighings already present')
            }
        }

        // SWMS: inbounds/outbounds/inventory
        if (warehouseId && materialTypeId) {
            if (await tableExists(client, 'swms_inbounds')) {
                const inboundColumns = await getTableColumns(client, 'swms_inbounds')
                const inRes = await client.query(
                    'SELECT COUNT(*)::int AS cnt FROM swms_inbounds WHERE site_id::text = $1::text',
                    [swmsSiteId]
                )
                if ((inRes.rows[0]?.cnt || 0) === 0) {
                    await insertRow(
                        client,
                        'swms_inbounds',
                        inboundColumns,
                        {
                            id: crypto.randomUUID(),
                            site_id: swmsSiteId,
                            project_id: null,
                            inbound_date: new Date(),
                            warehouse_id: warehouseId,
                            vendor_id: vendorId,
                            material_type_id: materialTypeId,
                            quantity: 5,
                            unit_price: 200000,
                            total_amount: 1000000,
                            status: 'CONFIRMED',
                        },
                        ['site_id']
                    )
                    console.log('[seed] SWMS inbounds inserted')
                } else {
                    console.log('[seed] SWMS inbounds already present')
                }
            }

            if (await tableExists(client, 'swms_outbounds')) {
                const outboundColumns = await getTableColumns(client, 'swms_outbounds')
                const outRes = await client.query(
                    'SELECT COUNT(*)::int AS cnt FROM swms_outbounds WHERE site_id::text = $1::text',
                    [swmsSiteId]
                )
                if ((outRes.rows[0]?.cnt || 0) === 0) {
                    await insertRow(
                        client,
                        'swms_outbounds',
                        outboundColumns,
                        {
                            id: crypto.randomUUID(),
                            site_id: swmsSiteId,
                            project_id: null,
                            outbound_date: new Date(),
                            warehouse_id: warehouseId,
                            vendor_id: vendorId,
                            material_type_id: materialTypeId,
                            quantity: 2,
                            unit_price: 250000,
                            total_amount: 500000,
                            status: 'PENDING',
                        },
                        ['site_id']
                    )
                    console.log('[seed] SWMS outbounds inserted')
                } else {
                    console.log('[seed] SWMS outbounds already present')
                }
            }

            if (await tableExists(client, 'swms_inventory')) {
                const inventoryColumns = await getTableColumns(client, 'swms_inventory')
                const required = ['site_id', 'warehouse_id', 'material_type_id']
                if (required.every((col) => inventoryColumns.has(col))) {
                    await client.query(
                        `INSERT INTO swms_inventory (
                            id, site_id, warehouse_id, material_type_id, quantity, last_updated_at
                        ) VALUES ($1, $2, $3, $4, $5, NOW())
                        ON CONFLICT (site_id, warehouse_id, material_type_id)
                        DO UPDATE SET quantity = EXCLUDED.quantity, last_updated_at = NOW()`,
                        [
                            crypto.randomUUID(),
                            swmsSiteId,
                            warehouseId,
                            materialTypeId,
                            3,
                        ]
                    )
                    console.log('[seed] SWMS inventory upserted')
                } else {
                    console.log('[seed] SWMS inventory missing required columns, skipping')
                }
            }
        }

        console.log('[seed] Done')
    } finally {
        client.release()
        await pool.end()
    }
}

main().catch((err) => {
    console.error('[seed] Failed:', err)
    process.exit(1)
})
