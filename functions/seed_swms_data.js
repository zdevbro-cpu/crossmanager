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

async function seedSwmsData() {
    const client = await pool.connect()
    try {
        console.log('🌱 Starting SWMS data seeding...')

        // 1. Seed Material Types
        const materialTypes = [
            { code: 'SCR-001', name: '철 스크랩', category: '스크랩', unit: '톤', unit_price: 350000 },
            { code: 'SCR-002', name: '알루미늄 스크랩', category: '스크랩', unit: '톤', unit_price: 2500000 },
            { code: 'SCR-003', name: '구리 스크랩', category: '스크랩', unit: '톤', unit_price: 8500000 },
            { code: 'SCR-004', name: '스테인리스 스크랩', category: '스크랩', unit: '톤', unit_price: 1800000 },
            { code: 'SCR-005', name: '혼합 금속 스크랩', category: '스크랩', unit: '톤', unit_price: 200000 },
            { code: 'WST-001', name: '일반 폐기물', category: '폐기물', unit: '톤', unit_price: -150000 },
            { code: 'WST-002', name: '건설 폐기물', category: '폐기물', unit: '톤', unit_price: -180000 },
            { code: 'WST-003', name: '목재 폐기물', category: '폐기물', unit: '톤', unit_price: -120000 },
            { code: 'WST-004', name: '플라스틱 폐기물', category: '폐기물', unit: '톤', unit_price: -200000 },
            { code: 'WST-005', name: '지정 폐기물', category: '폐기물', unit: '톤', unit_price: -500000 }
        ]

        for (const mt of materialTypes) {
            await client.query(`
                INSERT INTO swms_material_types (code, name, category, unit, unit_price, description)
                VALUES ($1, $2, $3, $4, $5, $6)
                ON CONFLICT (code) DO UPDATE SET
                    name = $2,
                    category = $3,
                    unit = $4,
                    unit_price = $5
            `, [mt.code, mt.name, mt.category, mt.unit, mt.unit_price, `${mt.category} - ${mt.name}`])
        }
        console.log(`✅ Seeded ${materialTypes.length} material types`)

        // 2. Seed Vendors
        const vendors = [
            {
                code: 'VND-001',
                name: '(주)대한스크랩',
                type: '매각처',
                business_number: '123-45-67890',
                representative: '김철수',
                contact: '02-1234-5678',
                email: 'daehan@scrap.com',
                address: '서울시 강남구 테헤란로 123',
                bank_name: '국민은행',
                bank_account: '123-456-789012'
            },
            {
                code: 'VND-002',
                name: '서울금속자원',
                type: '매각처',
                business_number: '234-56-78901',
                representative: '이영희',
                contact: '02-2345-6789',
                email: 'seoul@metal.com',
                address: '서울시 송파구 올림픽로 456',
                bank_name: '신한은행',
                bank_account: '234-567-890123'
            },
            {
                code: 'VND-003',
                name: '한국폐기물처리',
                type: '처리업체',
                business_number: '345-67-89012',
                representative: '박민수',
                contact: '031-3456-7890',
                email: 'korea@waste.com',
                address: '경기도 화성시 동탄대로 789',
                bank_name: '우리은행',
                bank_account: '345-678-901234'
            },
            {
                code: 'VND-004',
                name: '그린환경',
                type: '처리업체',
                business_number: '456-78-90123',
                representative: '정수진',
                contact: '031-4567-8901',
                email: 'green@env.com',
                address: '경기도 용인시 수지구 포은대로 321',
                bank_name: '하나은행',
                bank_account: '456-789-012345'
            },
            {
                code: 'VND-005',
                name: '동양메탈',
                type: '매각처',
                business_number: '567-89-01234',
                representative: '최동욱',
                contact: '032-5678-9012',
                email: 'dongyang@metal.com',
                address: '인천시 남동구 논현로 654',
                bank_name: '기업은행',
                bank_account: '567-890-123456'
            }
        ]

        for (const vendor of vendors) {
            await client.query(`
                INSERT INTO swms_vendors (
                    code, name, type, business_number, representative, 
                    contact, email, address, bank_name, bank_account
                )
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
                ON CONFLICT (code) DO UPDATE SET
                    name = $2,
                    type = $3,
                    business_number = $4,
                    representative = $5,
                    contact = $6,
                    email = $7,
                    address = $8,
                    bank_name = $9,
                    bank_account = $10
            `, [
                vendor.code, vendor.name, vendor.type, vendor.business_number,
                vendor.representative, vendor.contact, vendor.email, vendor.address,
                vendor.bank_name, vendor.bank_account
            ])
        }
        console.log(`✅ Seeded ${vendors.length} vendors`)

        console.log('🎉 SWMS data seeding completed successfully!')
    } catch (err) {
        console.error('❌ Error seeding SWMS data:', err)
    } finally {
        client.release()
        await pool.end()
    }
}

seedSwmsData()
