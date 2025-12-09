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

async function initSwmsTables() {
    const client = await pool.connect()
    try {
        console.log('🚀 Starting SWMS tables initialization (CLEAN START)...')
        console.log('⚠️  Dropping existing SWMS tables...')

        // Drop existing tables in reverse order of dependency
        const tablesToDrop = [
            'swms_photos',
            'swms_settlement_items',
            'swms_settlements',
            'swms_outbounds',
            'swms_inventory_storage', // New
            'swms_inventory_adjustments',
            'swms_inbounds',
            'swms_weighings',
            'swms_generations',
            'swms_warehouses', // New
            'swms_sites', // New
            'swms_companies', // New
            'swms_vendors',
            'swms_material_types'
        ]

        for (const table of tablesToDrop) {
            await client.query(`DROP TABLE IF EXISTS ${table} CASCADE`)
        }
        console.log('✅ Existing tables dropped.')

        // ==========================================
        // 1. Core Hierarchy (Company -> Site -> Warehouse)
        // ==========================================

        // 1.1 Company (최상위 조직)
        await client.query(`
            CREATE TABLE swms_companies (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                code VARCHAR(50) UNIQUE NOT NULL,
                name VARCHAR(100) NOT NULL,
                registration_number VARCHAR(50), -- 사업자등록번호
                ceo_name VARCHAR(50),
                address TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `)
        console.log('✅ swms_companies table created')

        // 1.2 Site (사업장/현장)
        await client.query(`
            CREATE TABLE swms_sites (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                company_id UUID REFERENCES swms_companies(id) ON DELETE CASCADE,
                code VARCHAR(50) NOT NULL,
                name VARCHAR(100) NOT NULL, -- 본사, 평택공장, 제2공장 등
                type VARCHAR(50) DEFAULT 'FACTORY', -- FACTORY, HEADQUARTERS, CONSTRUCTION_SITE
                address TEXT,
                manager_name VARCHAR(50),
                contact VARCHAR(50),
                is_active BOOLEAN DEFAULT true,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(company_id, code)
            )
        `)
        console.log('✅ swms_sites table created')

        // 1.3 Warehouse (창고/적재구역)
        await client.query(`
            CREATE TABLE swms_warehouses (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                site_id UUID REFERENCES swms_sites(id) ON DELETE CASCADE,
                code VARCHAR(50) NOT NULL,
                name VARCHAR(100) NOT NULL, -- A동 창고, 야적장 1구역
                type VARCHAR(50) DEFAULT 'INDOOR', -- INDOOR, OUTDOOR, YARD
                capacity DECIMAL(15,2),
                unit VARCHAR(20) DEFAULT '톤',
                description TEXT,
                is_active BOOLEAN DEFAULT true,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(site_id, code)
            )
        `)
        console.log('✅ swms_warehouses table created')


        // ==========================================
        // 2. Master Data (Common to Site/Company)
        // ==========================================

        // 2.1 Material Types
        await client.query(`
            CREATE TABLE swms_material_types (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                code VARCHAR(50) UNIQUE NOT NULL,
                name VARCHAR(100) NOT NULL,
                category VARCHAR(50), -- 스크랩, 폐기물
                unit VARCHAR(20) DEFAULT '톤',
                unit_price DECIMAL(15,2),
                description TEXT,
                is_active BOOLEAN DEFAULT true,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `)
        console.log('✅ swms_material_types table created')

        // 2.2 Vendors (Shared across sites usually)
        await client.query(`
            CREATE TABLE swms_vendors (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                code VARCHAR(50) UNIQUE NOT NULL,
                name VARCHAR(255) NOT NULL,
                type VARCHAR(50), -- 매입처, 매각처, 처리업체
                is_active BOOLEAN DEFAULT true,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `)
        console.log('✅ swms_vendors table created')


        // ==========================================
        // 3. Transactions (Site-Centric)
        // ==========================================

        // 3.1 Generations (발생)
        await client.query(`
            CREATE TABLE swms_generations (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                site_id UUID REFERENCES swms_sites(id) NOT NULL, -- 필수
                project_id UUID, -- 선택 (Optional Analysis Dimension)
                work_order_id VARCHAR(100), -- 선택 (PMS Link)
                cost_center VARCHAR(100), -- 선택
                generation_date DATE DEFAULT CURRENT_DATE,
                material_type_id UUID REFERENCES swms_material_types(id),
                quantity DECIMAL(10,2),
                unit VARCHAR(20) DEFAULT '톤',
                location VARCHAR(255),
                status VARCHAR(50) DEFAULT 'REGISTERED',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `)
        console.log('✅ swms_generations table created')

        // 3.2 Weighings (계근)
        await client.query(`
            CREATE TABLE swms_weighings (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                site_id UUID REFERENCES swms_sites(id) NOT NULL,
                project_id UUID,
                weighing_date DATE DEFAULT CURRENT_DATE,
                weighing_time TIME DEFAULT '00:00:00',
                vehicle_number VARCHAR(50),
                material_type_id UUID REFERENCES swms_material_types(id),
                vendor_id UUID REFERENCES swms_vendors(id),
                direction VARCHAR(20), -- IN, OUT
                gross_weight DECIMAL(10,2),
                tare_weight DECIMAL(10,2),
                net_weight DECIMAL(10,2),
                unit VARCHAR(20) DEFAULT '톤',
                status VARCHAR(50) DEFAULT 'COMPLETED',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `)
        console.log('✅ swms_weighings table created')

        // 3.3 Inbounds (입고)
        await client.query(`
            CREATE TABLE swms_inbounds (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                site_id UUID REFERENCES swms_sites(id) NOT NULL,
                project_id UUID,
                warehouse_id UUID REFERENCES swms_warehouses(id), -- 입고 창고
                inbound_date DATE DEFAULT CURRENT_DATE,
                weighing_id UUID REFERENCES swms_weighings(id),
                material_type_id UUID REFERENCES swms_material_types(id),
                vendor_id UUID REFERENCES swms_vendors(id),
                quantity DECIMAL(10,2),
                unit_price DECIMAL(15,2),
                total_amount DECIMAL(15,2),
                status VARCHAR(50) DEFAULT 'STORED',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `)
        console.log('✅ swms_inbounds table created')

        // 3.4 Outbounds (출고)
        await client.query(`
            CREATE TABLE swms_outbounds (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                site_id UUID REFERENCES swms_sites(id) NOT NULL,
                project_id UUID,
                warehouse_id UUID REFERENCES swms_warehouses(id), -- 출고 창고
                outbound_date DATE DEFAULT CURRENT_DATE,
                weighing_id UUID REFERENCES swms_weighings(id),
                material_type_id UUID REFERENCES swms_material_types(id),
                vendor_id UUID REFERENCES swms_vendors(id),
                quantity DECIMAL(10,2),
                unit_price DECIMAL(15,2),
                total_amount DECIMAL(15,2),
                status VARCHAR(50) DEFAULT 'SHIPPED',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `)
        console.log('✅ swms_outbounds table created')

        // 3.5 Inventory Adjustments (재고 실사/조정)
        await client.query(`
            CREATE TABLE swms_inventory_adjustments (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                site_id UUID REFERENCES swms_sites(id) NOT NULL,
                warehouse_id UUID REFERENCES swms_warehouses(id),
                project_id UUID, -- 재고 귀속 프로젝트가 명확할 경우
                adjustment_date DATE DEFAULT CURRENT_DATE,
                material_type_id UUID REFERENCES swms_material_types(id),
                adjustment_type VARCHAR(50),
                quantity DECIMAL(10,2), -- +/-
                reason TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `)
        console.log('✅ swms_inventory_adjustments table created')

        // 3.6 Real-time Inventory Storage (재고 스냅샷/현황)
        await client.query(`
            CREATE TABLE swms_inventory_storage (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                site_id UUID REFERENCES swms_sites(id) ON DELETE CASCADE,
                warehouse_id UUID REFERENCES swms_warehouses(id) ON DELETE CASCADE,
                material_type_id UUID REFERENCES swms_material_types(id) ON DELETE CASCADE,
                quantity DECIMAL(15,2) DEFAULT 0,
                last_updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(site_id, warehouse_id, material_type_id)
            )
        `)
        console.log('✅ swms_inventory_storage table created')


        // ==========================================
        // 4. Seed Initial Data
        // ==========================================

        console.log('🌱 Seeding initial data...')

        // 4.1 Company
        const companyRes = await client.query(`
            INSERT INTO swms_companies (code, name, registration_number)
            VALUES ('CROSS', 'Cross Specialness Inc.', '123-45-67890')
            RETURNING id
        `)
        const companyId = companyRes.rows[0].id

        // 4.2 Sites
        const sitePyeongtaek = await client.query(`
            INSERT INTO swms_sites (company_id, code, name, type, address)
            VALUES ($1, 'PT-01', '평택 제1공장', 'FACTORY', '경기도 평택시 ...')
            RETURNING id
        `, [companyId])
        const siteId = sitePyeongtaek.rows[0].id

        const siteSeoul = await client.query(`
            INSERT INTO swms_sites (company_id, code, name, type, address)
            VALUES ($1, 'HQ-01', '서울 본사', 'HEADQUARTERS', '서울시 강남구 ...')
            RETURNING id
        `, [companyId])

        // 4.3 Warehouses (in Pyeongtaek)
        await client.query(`
            INSERT INTO swms_warehouses (site_id, code, name, type)
            VALUES 
            ($1, 'WH-A', 'A동 스크랩 비치장', 'INDOOR'),
            ($1, 'WH-B', 'B동 폐기물 야적장', 'OUTDOOR')
        `, [siteId])

        // 4.4 Materials (Sample)
        await client.query(`
            INSERT INTO swms_material_types (code, name, category, unit_price)
            VALUES 
            ('M-SC-01', '고철 A등급', '스크랩', 350000),
            ('M-SC-02', '고철 B등급', '스크랩', 320000),
            ('M-WA-01', '폐합성수지', '폐기물', -150000) -- 처리비용 (-)
        `)

        // 4.5 Vendors (Sample)
        await client.query(`
            INSERT INTO swms_vendors (code, name, type)
            VALUES 
            ('V-001', '대성자원', '매각처'),
            ('V-002', '환경사랑', '처리업체')
        `)

        // 4.6 Seed Operational Data (Sample Set - 10 items)
        console.log('🌱 Seeding operational data (10 items)...')

        const matScrapA = (await client.query("SELECT id FROM swms_material_types WHERE name='고철 A등급' LIMIT 1")).rows[0].id
        const matWaste = (await client.query("SELECT id FROM swms_material_types WHERE name='폐합성수지' LIMIT 1")).rows[0].id
        const vendor1 = (await client.query("SELECT id FROM swms_vendors WHERE code='V-001' LIMIT 1")).rows[0].id
        const vendor2 = (await client.query("SELECT id FROM swms_vendors WHERE code='V-002' LIMIT 1")).rows[0].id
        const whA = (await client.query("SELECT id FROM swms_warehouses WHERE code='WH-A' LIMIT 1")).rows[0].id
        const whB = (await client.query("SELECT id FROM swms_warehouses WHERE code='WH-B' LIMIT 1")).rows[0].id

        const locations = ['생산라인 1', '생산라인 2', '야적장 A', '야적장 B', '창고 앞']
        const directions = ['IN', 'OUT']

        for (let i = 1; i <= 10; i++) {
            // Generation
            await client.query(`
                INSERT INTO swms_generations (site_id, project_id, generation_date, material_type_id, quantity, location, status)
                VALUES ($1, NULL, CURRENT_DATE - INTERVAL '${i} days', $2, $3, $4, 'REGISTERED')
             `, [siteId, (i % 2 === 0 ? matScrapA : matWaste), (Math.random() * 10).toFixed(2), locations[i % locations.length]])

            // Weighing
            await client.query(`
                INSERT INTO swms_weighings (site_id, project_id, weighing_date, weighing_time, vehicle_number, material_type_id, direction, gross_weight, tare_weight, net_weight, vendor_id)
                VALUES ($1, NULL, CURRENT_DATE - INTERVAL '${i} days', '10:00:00', '82나' || ${1000 + i}, $2, $3, 25.0, 10.0, 15.0, $4)
             `, [siteId, (i % 2 === 0 ? matScrapA : matWaste), directions[i % 2], (i % 2 === 0 ? vendor1 : vendor2)])

            // Inbound
            await client.query(`
                INSERT INTO swms_inbounds (site_id, inbound_date, warehouse_id, material_type_id, quantity, unit_price, total_amount, vendor_id, status)
                VALUES ($1, CURRENT_DATE - INTERVAL '${i} days', $2, $3, 10.0, 100000, 1000000, $4, 'CONFIRMED')
             `, [siteId, whA, matScrapA, vendor1])

            // Inventory update for Inbound
            await client.query(`
                 INSERT INTO swms_inventory_storage (site_id, warehouse_id, material_type_id, quantity)
                 VALUES ($1, $2, $3, 10.0)
                 ON CONFLICT (site_id, warehouse_id, material_type_id)
                 DO UPDATE SET quantity = swms_inventory_storage.quantity + 10.0
            `, [siteId, whA, matScrapA])

            // Outbound
            await client.query(`
                INSERT INTO swms_outbounds (site_id, outbound_date, warehouse_id, material_type_id, quantity, unit_price, total_amount, vendor_id, status)
                VALUES ($1, CURRENT_DATE - INTERVAL '${i} days', $2, $3, 5.0, 50000, 250000, $4, 'CONFIRMED')
             `, [siteId, whB, matWaste, vendor2])

            // Inventory update for Outbound
            await client.query(`
                 INSERT INTO swms_inventory_storage (site_id, warehouse_id, material_type_id, quantity)
                 VALUES ($1, $2, $3, -5.0)
                 ON CONFLICT (site_id, warehouse_id, material_type_id)
                 DO UPDATE SET quantity = swms_inventory_storage.quantity - 5.0
            `, [siteId, whB, matWaste])
        }

        console.log('🎉 SWMS Database re-initialized with Site-Centric Architecture!')

    } catch (err) {
        console.error('❌ Error initializing SWMS tables:', err)
    } finally {
        client.release()
        await pool.end()
    }
}

initSwmsTables()
