
const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
    user: process.env.DB_USER,
    host: process.env.DB_HOST,
    database: process.env.DB_NAME,
    password: process.env.DB_PASSWORD,
    port: process.env.DB_PORT || 5432,
    ssl: { rejectUnauthorized: false }
});

const incidents = [
    {
        type: '사고',
        title: '자재 인양 중 낙하물 사고',
        date: '2023-11-20',
        time: '14:30',
        place: '101동 옥상층',
        description: '타워크레인으로 철근 자재 인양 중 결속 불량으로 인해 철근 1개가 낙하함. 하부 통제 구역 내 낙하하여 인명 피해는 없었으나, 자재 일부 파손 및 작업 중지.',
        status: 'INVESTIGATING',
        reporter: '김안전'
    },
    {
        type: '아차사고',
        title: '가설 통로 미끄러짐',
        date: '2023-12-01',
        time: '08:15',
        place: '지하 1층 주차장 진입로',
        description: '전일 내린 눈으로 인해 가설 통로가 결빙되어 근로자가 이동 중 미끄러질 뻔함. 즉시 모래 살포 및 제설 작업 실시.',
        status: 'CLOSED',
        reporter: '이관리'
    },
    {
        type: '아차사고',
        title: '비계 클램프 체결 불량 발견',
        date: '2023-12-02',
        time: '10:00',
        place: '102동 4층 외부 비계',
        description: '안전 순찰 중 비계 클램프 일부가 풀려 있는 것을 발견하고 즉시 조치함. 작업 전 점검 소홀로 판단됨.',
        status: 'CLOSED',
        reporter: '박반장'
    },
    {
        type: '사고',
        title: '그라인더 작업 중 안구 이물질 침입',
        date: '2023-11-25',
        time: '16:40',
        place: '철골 가공장',
        description: '보안경을 착용했으나 틈새로 미세 쇳가루가 침입하어 안구 통증 호소. 병원 이송 후 세척 치료 및 안대 착용 조치.',
        status: 'CLOSED',
        reporter: '최담당'
    },
    {
        type: '아차사고',
        title: '지게차 후진 중 충돌 위험',
        date: '2023-12-03',
        time: '13:20',
        place: '자재 야적장',
        description: '지게차가 후진하던 중 신호수의 신호를 늦게 인지하여 적재된 파이프와 충돌할 뻔함. 유도자 배치 및 신호 체계 재교육 필요.',
        status: 'INVESTIGATING',
        reporter: '정신호'
    },
    {
        type: '사고',
        title: '사다리 작업 중 추락 (1.5m)',
        date: '2023-11-15',
        time: '09:10',
        place: '상가동 1층 로비',
        description: 'A형 사다리 위에서 전등 교체 작업 중 중심을 잃고 1.5m 높이에서 추락. 발목 염좌 발생하여 병원 치료 중.',
        status: 'INVESTIGATING',
        reporter: '한설비'
    },
    {
        type: '아차사고',
        title: '전동 공구 전선 피복 손상',
        date: '2023-12-04',
        time: '11:00',
        place: '목공 작업장',
        description: '원형톱 사용 전 점검 시 전선 피복이 일부 벗겨져 있는 것을 발견. 감전 위험이 있어 즉시 폐기 및 교체 사용.',
        status: 'CLOSED',
        reporter: '오목수'
    },
    {
        type: '아차사고',
        title: '개구부 덮개 이탈',
        date: '2023-12-05',
        time: '07:50',
        place: '103동 5층 엘리베이터 홀',
        description: '작업자가 자재 운반 중 개구부 덮개를 건드려 이탈됨. 즉시 원상 복구하고 고정 조치 강화함.',
        status: 'CLOSED',
        reporter: '강철근'
    },
    {
        type: '사고',
        title: '용접 불티에 의한 소화 자재 그을림',
        date: '2023-11-28',
        time: '15:00',
        place: '지하 2층 기계실',
        description: '배관 용접 작업 중 불티 비산 방지포가 제대로 설치되지 않아 주변 단열재에 불티가 튀어 그을림 발생. 즉시 소화기로 진화.',
        status: 'CLOSED',
        reporter: '조배관'
    },
    {
        type: '아차사고',
        title: '타워크레인 와이어가이드 파손',
        date: '2023-12-06',
        time: '08:00',
        place: '타워크레인 1호기',
        description: '작업 시작 전 일일 점검 중 와이어가이드에 미세한 균열 발견. 가동 중지하고 부품 교체 요청.',
        status: 'REPORTED',
        reporter: '신기사'
    }
];

async function seedIncidents() {
    const client = await pool.connect();
    try {
        console.log('Seeding Incident Data...');
        await client.query('BEGIN');

        // 1. sms_incidents (Accident/Near Miss) - Ensure exists
        await client.query(`
            CREATE TABLE IF NOT EXISTS sms_incidents (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                project_id UUID,
                type VARCHAR(50), -- 사고, 아차사고
                title VARCHAR(255) NOT NULL,
                date DATE DEFAULT CURRENT_DATE,
                time VARCHAR(50), -- 발생 시간
                place VARCHAR(100),
                description TEXT,
                cause TEXT, -- 원인
                measure TEXT, -- 조치 사항
                reporter VARCHAR(100), -- 보고자
                status VARCHAR(50) DEFAULT 'REPORTED', -- REPORTED, INVESTIGATING, CLOSED
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `)

        await client.query(`
            CREATE TABLE IF NOT EXISTS sms_incident_photos (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                incident_id UUID REFERENCES sms_incidents(id) ON DELETE CASCADE,
                photo_url TEXT NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `)

        // Get Project ID
        const projRes = await client.query('SELECT id FROM projects LIMIT 1');
        const projectId = projRes.rows.length > 0 ? projRes.rows[0].id : null;

        for (const inc of incidents) {
            await client.query(`
                INSERT INTO sms_incidents (
                    project_id, type, title, date, time, place, description, reporter, status
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
            `, [projectId, inc.type, inc.title, inc.date, inc.time, inc.place, inc.description, inc.reporter, inc.status]);
        }

        await client.query('COMMIT');
        console.log('Successfully seeded 10 Incident records.');
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('Error seeding Incident data:', err);
    } finally {
        client.release();
        pool.end();
    }
}

seedIncidents();
