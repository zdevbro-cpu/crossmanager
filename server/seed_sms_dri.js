
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

const sampleDris = [
    { location: '101동 3층 슬라브', content: '철근 배근 및 거푸집 설치', attendees: 12, risks: '[추락] 개구부 덮개 확인\n[전도] 자재 정리정돈 철저' },
    { location: '지하 2층 기계실', content: '배관 용접 작업', attendees: 4, risks: '[화재] 소화기 비치 및 불티 비산 방지\n[질식] 환기 팬 가동 확인' },
    { location: '외부 비계 5단', content: '낙하물 방지망 설치', attendees: 6, risks: '[추락] 안전대 체결 필수\n[낙하] 하부 통제 철저' },
    { location: '103동 옥상', content: '방수 우레탄 도포', attendees: 3, risks: '[중독] 유기용제 취급 시 마스크 착용\n[화재] 인화성 물질 관리' },
    { location: '단지 내 도로', content: '자재 양중 및 하역', attendees: 8, risks: '[충돌] 신호수 배치\n[낙하] 인양물 결속 상태 확인' }
];

async function seedDris() {
    const client = await pool.connect();
    try {
        console.log('Seeding DRI Data...');
        await client.query('BEGIN');

        // Get a valid project ID
        const projRes = await client.query('SELECT id FROM projects LIMIT 1');
        const projectId = projRes.rows.length > 0 ? projRes.rows[0].id : null;

        for (let i = 0; i < sampleDris.length; i++) {
            const data = sampleDris[i];
            const dateOffset = Math.floor(Math.random() * 5); // Past 0-4 days

            await client.query(`
                INSERT INTO sms_dris (
                    project_id, date, location, work_content, risk_points, 
                    attendees_count, created_by, status
                ) VALUES ($1, CURRENT_DATE - $2::INTEGER, $3, $4, $5, $6, '관리자', 'COMPLETED')
            `, [projectId, dateOffset, data.location, data.content, data.risks, data.attendees]);
        }

        await client.query('COMMIT');
        console.log('Successfully seeded 5 DRI records.');
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('Error seeding DRI data:', err);
    } finally {
        client.release();
        pool.end();
    }
}

seedDris();
