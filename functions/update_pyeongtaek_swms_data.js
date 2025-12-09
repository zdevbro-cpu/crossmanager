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

const TARGET_PROJECT_NAME = '평택 P3 설비 해체 공사'

const generationSamples = [
    { date: '2025-12-04', material: '건설 폐기물', process: '지상층 잔재물 청소', quantity: 1.2, location: 'P3 동문 램프', notes: '청소 후 바로 반출 준비' },
    { date: '2025-12-05', material: '목재 폐기물', process: '포장목재 해체', quantity: 2.1, location: '창고 2동 전면', notes: '팔레트/보강목 분리 적재' },
    { date: '2025-12-05', material: '플라스틱 폐기물', process: '배관 보양 제거', quantity: 0.8, location: '배관 라인 E구간', notes: '스트레치 필름 분리' },
    { date: '2025-12-06', material: '철 스크랩', process: '덕트 철거 철재', quantity: 3.6, location: '덕트 샤프트 B-3층', notes: '절단 후 묶음 보관' },
    { date: '2025-12-06', material: '알루미늄 스크랩', process: '전선 트레이 교체', quantity: 2.4, location: '클린룸 4라인 상부', notes: '트레이 분리 후 세척 필요' },
    { date: '2025-12-07', material: '스테인리스 스크랩', process: '설비 베드 보강 철거', quantity: 2.9, location: '장비실 3구역', notes: '볼트 잔재 제거 완료' },
    { date: '2025-12-07', material: '일반 폐기물', process: '보양재 및 잡자재 수거', quantity: 1.1, location: 'P3 로딩도크', notes: 'PP자루 소포장 완료' },
    { date: '2025-12-08', material: '지정 폐기물', process: '오일 묻은 걸레 수거', quantity: 0.35, location: '기계실 정비구역', notes: '지정폐기물 드럼 밀봉' },
    { date: '2025-12-08', material: '구리 스크랩', process: '동 버스바 교체', quantity: 1.7, location: '전력실 A구역', notes: '산화막 제거 후 적재' },
    { date: '2025-12-09', material: '혼합 금속 스크랩', process: '장비 배관 혼합철', quantity: 2.2, location: '배기 덕트 라인', notes: '철/알루미늄 혼재 분리' }
]

const weighingSamples = [
    { date: '2025-12-05', time: '09:20', direction: 'OUT', material: '건설 폐기물', gross: 14.8, tare: 7.2, vendor: '한국폐기물처리', vehicle: '89라2345', driver: '최진수', contact: '010-2345-7812', notes: '건설폐기물 1차 반출' },
    { date: '2025-12-05', time: '14:10', direction: 'OUT', material: '목재 폐기물', gross: 12.5, tare: 4.1, vendor: '그린환경', vehicle: '85더9043', driver: '장문혁', contact: '010-9988-2011', notes: '목재 팔레트/포장재 반출' },
    { date: '2025-12-06', time: '10:05', direction: 'IN', material: '철 스크랩', gross: 21.4, tare: 9.1, vendor: '서울금속자원', vehicle: '77노5632', driver: '김태곤', contact: '010-3011-7722', notes: '철재 반입 계근' },
    { date: '2025-12-06', time: '15:20', direction: 'OUT', material: '알루미늄 스크랩', gross: 13.6, tare: 7.5, vendor: '(주)대한스크랩', vehicle: '92자4411', driver: '오승환', contact: '010-4421-1100', notes: '알루미늄 트레이 반출' },
    { date: '2025-12-07', time: '11:40', direction: 'OUT', material: '스테인리스 스크랩', gross: 15.2, tare: 8.0, vendor: '동양메탈', vehicle: '66보7742', driver: '박정후', contact: '010-5520-6675', notes: 'SUS 베드 재료 반출' },
    { date: '2025-12-07', time: '16:05', direction: 'OUT', material: '지정 폐기물', gross: 8.4, tare: 4.9, vendor: '한국폐기물처리', vehicle: '80무2122', driver: '윤상빈', contact: '010-1200-4422', notes: '지정폐기물 드럼 12본' },
    { date: '2025-12-08', time: '09:55', direction: 'OUT', material: '구리 스크랩', gross: 14.1, tare: 7.3, vendor: '서울금속자원', vehicle: '93소1881', driver: '정해민', contact: '010-7782-3991', notes: '동 버스바 해체분' },
    { date: '2025-12-09', time: '13:25', direction: 'OUT', material: '혼합 금속 스크랩', gross: 17.3, tare: 8.6, vendor: '동양메탈', vehicle: '81서5580', driver: '최민우', contact: '010-6442-1255', notes: '혼합 철/알루미늄 덕트' }
]

async function main() {
    const client = await pool.connect()
    try {
        console.log('🔍 Loading lookup data...')

        const projectRes = await client.query(
            'SELECT id, name FROM projects WHERE name = $1',
            [TARGET_PROJECT_NAME]
        )
        if (projectRes.rows.length === 0) {
            throw new Error(`프로젝트를 찾을 수 없습니다: ${TARGET_PROJECT_NAME}`)
        }
        const projectId = projectRes.rows[0].id
        console.log(`🎯 Target project: ${TARGET_PROJECT_NAME} (${projectId})`)

        const mtRes = await client.query('SELECT id, name, unit FROM swms_material_types')
        const materialMap = new Map(mtRes.rows.map((mt) => [mt.name, { id: mt.id, unit: mt.unit || '톤' }]))

        const vendorRes = await client.query('SELECT id, name FROM swms_vendors')
        const vendorMap = new Map(vendorRes.rows.map((v) => [v.name, v.id]))

        const getMaterial = (name) => {
            const mt = materialMap.get(name)
            if (!mt) throw new Error(`자재 종류를 찾을 수 없습니다: ${name}`)
            return mt
        }

        const getVendor = (name) => {
            const id = vendorMap.get(name)
            if (!id) throw new Error(`거래처를 찾을 수 없습니다: ${name}`)
            return id
        }

        await client.query('BEGIN')

        await client.query('DELETE FROM swms_weighings WHERE project_id = $1', [projectId])
        await client.query('DELETE FROM swms_generations WHERE project_id = $1', [projectId])
        console.log('🧹 Removed existing 평택 P3 sample data')

        for (const gen of generationSamples) {
            const mt = getMaterial(gen.material)
            await client.query(
                `
                INSERT INTO swms_generations (
                    project_id, generation_date, material_type_id, process_name,
                    quantity, unit, location, notes, created_by
                )
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
                `,
                [
                    projectId,
                    gen.date,
                    mt.id,
                    gen.process,
                    gen.quantity,
                    mt.unit || '톤',
                    gen.location,
                    gen.notes,
                    '샘플데이터'
                ]
            )
        }
        console.log(`➕ Inserted ${generationSamples.length} generation records`)

        for (const w of weighingSamples) {
            const mt = getMaterial(w.material)
            const vendorId = getVendor(w.vendor)
            const net = Number((w.gross - w.tare).toFixed(2))

            await client.query(
                `
                INSERT INTO swms_weighings (
                    project_id, weighing_date, weighing_time, vehicle_number,
                    driver_name, driver_contact, material_type_id, direction,
                    gross_weight, tare_weight, net_weight, unit, vendor_id, notes, created_by
                )
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
                `,
                [
                    projectId,
                    w.date,
                    w.time,
                    w.vehicle,
                    w.driver,
                    w.contact,
                    mt.id,
                    w.direction,
                    w.gross,
                    w.tare,
                    net,
                    mt.unit || '톤',
                    vendorId,
                    w.notes,
                    '샘플데이터'
                ]
            )
        }
        console.log(`➕ Inserted ${weighingSamples.length} weighing records`)

        await client.query('COMMIT')
        console.log('✅ 평택 P3 샘플데이터를 새로 반영했습니다.')
    } catch (err) {
        await client.query('ROLLBACK')
        console.error('❌ Error updating 평택 P3 sample data:', err.message)
        process.exitCode = 1
    } finally {
        client.release()
        await pool.end()
    }
}

main()
