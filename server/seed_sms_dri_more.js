
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

const newSampleDris = [
    { location: '지하 1층 주차장 구간', content: '천장 배관 보온 작업', attendees: 5, risks: '[낙하] 사다리 작업 시 전도 주의\n[질식] 밀폐 공간 산소 농도 측정' },
    { location: '105동 15층', content: '세대 내 조적 조적 공사', attendees: 8, risks: '[전도] 자재 운반 중 걸림 주의\n[절단] 조적 절단기 사용 시 보안경 착용' },
    { location: '202동 옥탑', content: '엘리베이터 기계실 장비 양중', attendees: 6, risks: '[추락] 개구부 주변 안전난간 설치\n[협착] 양중기 신호수 배치 철저' },
    { location: '단지 조경 구간', content: '대형 수목 식재 및 굴착', attendees: 7, risks: '[충돌] 굴착기 선회 반경 접근 금지\n[전도] 경사면 작업 시 미끄럼 주의' },
    { location: '공용부 계단실', content: '석재 연마 및 광택 작업', attendees: 4, risks: '[감전] 연마기 전선 피복 확인\n[유해물질] 분진 발생 시 방진마스크 착용' }
];

async function seedAdditionalDris() {
    const client = await pool.connect();
    try {
        console.log('Seeding 5 Additional DRI Data...');
        await client.query('BEGIN');

        // Get a valid project ID
        const projRes = await client.query('SELECT id FROM projects LIMIT 1');
        const projectId = projRes.rows.length > 0 ? projRes.rows[0].id : null;

        for (let i = 0; i < newSampleDris.length; i++) {
            const data = newSampleDris[i];
            const dateOffset = Math.floor(Math.random() * 7); // Past 0-6 days

            await client.query(`
                INSERT INTO sms_dris (
                    project_id, date, location, work_content, risk_points, 
                    attendees_count, created_by, status
                ) VALUES ($1, CURRENT_DATE - $2::INTEGER, $3, $4, $5, $6, '관리자', 'COMPLETED')
            `, [projectId, dateOffset, data.location, data.content, data.risks, data.attendees]);
        }

        await client.query('COMMIT');
        console.log('Successfully seeded 5 ADDITIONAL DRI records.');
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('Error seeding additional DRI data:', err);
    } finally {
        client.release();
        pool.end();
    }
}

seedAdditionalDris();
