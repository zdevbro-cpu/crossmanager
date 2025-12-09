
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

const samplePatrols = [
    {
        location: '101동 5층 슬라브',
        issue_type: '부적합',
        severity: 'HIGH',
        description: '승강기 개구부 안전난간 미설치 및 덮개 고정 상태 불량',
        action_required: '즉시 작업 중단 및 안전시설물 보강 조치',
        status: 'OPEN'
    },
    {
        location: '지하 2층 주차장 A구역',
        issue_type: '우수사례',
        severity: 'LOW',
        description: '가설 통로 조도 확보 양호 및 자재 적재 상태 우수',
        action_required: '전파 교육 실시',
        status: 'CLOSED'
    },
    {
        location: '외부 비계 3단',
        issue_type: '아차사고',
        severity: 'MEDIUM',
        description: '작업자 이동 중 안전고리 미체결 상태 일시적 발생',
        action_required: '특별 안전 교육 및 관리감독 강화',
        status: 'OPEN'
    },
    {
        location: '203동 1층 진입로',
        issue_type: '부적합',
        severity: 'MEDIUM',
        description: '이동식 크레인 아우트리거 하부 지반 보강 미흡',
        action_required: '철판 보강 후 작업 재개',
        status: 'CLOSED'
    },
    {
        location: '자재 야적장',
        issue_type: '부적합',
        severity: 'HIGH',
        description: '인화성 물질(페인트, 신너) 보관소 주변 소화기 미비치',
        action_required: '대형 소화기 2대 즉시 비치 및 화기 엄금 표지판 부착',
        status: 'OPEN'
    },
    {
        location: '105동 옥탑층',
        issue_type: '부적합',
        severity: 'MEDIUM',
        description: '철근 가공 작업장 주변 잔재물 정리 미흡 (전도 위험)',
        action_required: '작업 종료 후 즉시 청소 실시',
        status: 'OPEN'
    }
];

async function seedPatrols() {
    const client = await pool.connect();
    try {
        console.log('Seeding Patrol Data...');
        await client.query('BEGIN');

        // Reset table slightly to change schema if needed
        await client.query('DROP TABLE IF EXISTS sms_patrols');

        // Ensure table exists with CORRECT UUID type
        await client.query(`
            CREATE TABLE IF NOT EXISTS sms_patrols (
                id SERIAL PRIMARY KEY,
                project_id UUID REFERENCES projects(id),
                location VARCHAR(255),
                issue_type VARCHAR(50),
                severity VARCHAR(20),
                description TEXT,
                action_required VARCHAR(255),
                photo_url TEXT,
                status VARCHAR(20) DEFAULT 'OPEN',
                created_by VARCHAR(50),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // Get a valid project ID
        const projRes = await client.query('SELECT id FROM projects LIMIT 1');
        const projectId = projRes.rows.length > 0 ? projRes.rows[0].id : null;

        for (let i = 0; i < samplePatrols.length; i++) {
            const data = samplePatrols[i];

            await client.query(`
                INSERT INTO sms_patrols (
                    project_id, location, issue_type, severity, description, 
                    action_required, status, created_by, created_at
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, '안전팀장', NOW() - ($8 || ' hours')::INTERVAL)
            `, [
                projectId,
                data.location,
                data.issue_type,
                data.severity,
                data.description,
                data.action_required,
                data.status,
                Math.floor(Math.random() * 48) // Random time within last 48 hours
            ]);
        }

        await client.query('COMMIT');
        console.log('Successfully seeded 6 Patrol records.');
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('Error seeding Patrol data:', err);
    } finally {
        client.release();
        pool.end();
    }
}

seedPatrols();
