// 장비 목 데이터 삽입 스크립트
const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
    user: process.env.DB_USER,
    host: process.env.DB_HOST,
    database: process.env.DB_NAME,
    password: process.env.DB_PASSWORD,
    port: process.env.DB_PORT || 5432,
});

const equipmentData = [
    {
        id: 'eq-001',
        equipment_id: 'EQ-2024-001',
        name: '굴삭기 20톤',
        category: '굴삭기',
        model: 'DX225LC',
        manufacturer: '두산',
        manufacture_year: 2023,
        specifications: '20톤급',
        serial_number: 'DS2023-001-KR',
        acquisition_date: '2023-03-15',
        equipment_status: '신품',
        assigned_site: '서울 강남 재개발 현장'
    },
    {
        id: 'eq-002',
        equipment_id: 'EQ-2024-002',
        name: '굴삭기 15톤',
        category: '굴삭기',
        model: 'R140LC-9',
        manufacturer: '현대',
        manufacture_year: 2022,
        specifications: '15톤급',
        serial_number: 'HD2022-045-KR',
        acquisition_date: '2022-08-20',
        equipment_status: '중고',
        assigned_site: '인천 송도 신도시'
    },
    {
        id: 'eq-003',
        equipment_id: 'EQ-2024-003',
        name: '지게차 3톤',
        category: '지게차',
        model: '30D-9',
        manufacturer: '두산',
        manufacture_year: 2024,
        specifications: '3톤급',
        serial_number: 'DS2024-012-KR',
        acquisition_date: '2024-01-10',
        equipment_status: '신품',
        assigned_site: '부산 신항만 물류센터'
    },
    {
        id: 'eq-004',
        equipment_id: 'EQ-2024-004',
        name: '덤프트럭 25톤',
        category: '덤프트럭',
        model: 'Xcient',
        manufacturer: '현대',
        manufacture_year: 2021,
        specifications: '25톤급',
        serial_number: 'HD2021-089-KR',
        acquisition_date: '2021-06-05',
        equipment_status: '중고',
        assigned_site: '경기 평택 산업단지'
    },
    {
        id: 'eq-005',
        equipment_id: 'EQ-2024-005',
        name: '타워크레인 10톤',
        category: '타워크레인',
        model: 'TC-6013',
        manufacturer: '극동',
        manufacture_year: 2023,
        specifications: '10톤급',
        serial_number: 'KD2023-007-KR',
        acquisition_date: '2023-09-12',
        equipment_status: '신품',
        assigned_site: '대전 둔산 아파트 건설'
    },
    {
        id: 'eq-006',
        equipment_id: 'EQ-2024-006',
        name: '콘크리트 펌프카 42M',
        category: '펌프카',
        model: 'PX42',
        manufacturer: '에버다임',
        manufacture_year: 2022,
        specifications: '42M급',
        serial_number: 'EV2022-034-KR',
        acquisition_date: '2022-11-28',
        equipment_status: '중고',
        assigned_site: '광주 첨단지구 공장'
    },
    {
        id: 'eq-007',
        equipment_id: 'EQ-2024-007',
        name: '휠로더 5톤',
        category: '로더',
        model: 'HL960',
        manufacturer: '현대',
        manufacture_year: 2024,
        specifications: '5톤급',
        serial_number: 'HD2024-003-KR',
        acquisition_date: '2024-02-14',
        equipment_status: '신품',
        assigned_site: '강원 춘천 도로공사'
    },
    {
        id: 'eq-008',
        equipment_id: 'EQ-2024-008',
        name: '불도저 30톤',
        category: '불도저',
        model: 'D85EX-18',
        manufacturer: '두산',
        manufacture_year: 2020,
        specifications: '30톤급',
        serial_number: 'DS2020-056-KR',
        acquisition_date: '2020-04-22',
        equipment_status: '정비중',
        assigned_site: '정비센터'
    },
    {
        id: 'eq-009',
        equipment_id: 'EQ-2024-009',
        name: '모터그레이더 140HP',
        category: '그레이더',
        model: 'GD655-5',
        manufacturer: '두산',
        manufacture_year: 2023,
        specifications: '140HP',
        serial_number: 'DS2023-019-KR',
        acquisition_date: '2023-07-30',
        equipment_status: '신품',
        assigned_site: '충남 천안 도로정비'
    },
    {
        id: 'eq-010',
        equipment_id: 'EQ-2024-010',
        name: '진동롤러 10톤',
        category: '롤러',
        model: 'DV210',
        manufacturer: '볼보',
        manufacture_year: 2021,
        specifications: '10톤급',
        serial_number: 'VV2021-078-KR',
        acquisition_date: '2021-10-18',
        equipment_status: '중고',
        assigned_site: '경북 포항 항만공사'
    }
];

async function seedEquipment() {
    try {
        console.log('장비 데이터 삽입 시작...');

        for (const eq of equipmentData) {
            const query = `
        INSERT INTO equipment (
          id, equipment_id, name, category, model, manufacturer,
          manufacture_year, specifications, serial_number, acquisition_date,
          equipment_status, assigned_site
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
        ON CONFLICT (id) DO NOTHING
      `;

            const values = [
                eq.id, eq.equipment_id, eq.name, eq.category, eq.model, eq.manufacturer,
                eq.manufacture_year, eq.specifications, eq.serial_number, eq.acquisition_date,
                eq.equipment_status, eq.assigned_site
            ];

            await pool.query(query, values);
            console.log(`✓ ${eq.name} 삽입 완료`);
        }

        console.log('\n모든 장비 데이터 삽입 완료!');
        console.log(`총 ${equipmentData.length}개 장비 등록됨`);

        // 결과 확인
        const result = await pool.query('SELECT COUNT(*) FROM equipment');
        console.log(`\n현재 데이터베이스에 등록된 총 장비 수: ${result.rows[0].count}`);

    } catch (err) {
        console.error('오류 발생:', err);
    } finally {
        await pool.end();
    }
}

seedEquipment();
