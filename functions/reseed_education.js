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

async function clearAndReseed() {
    const client = await pool.connect();
    try {
        console.log('Clearing existing education data...');
        await client.query('DELETE FROM sms_education_attendees');
        await client.query('DELETE FROM sms_educations');
        console.log('Existing data cleared.');

        console.log('Reseeding Education Data with Attendees...');
        await client.query('BEGIN');

        const projRes = await client.query('SELECT id FROM projects LIMIT 1');
        const projectId = projRes.rows.length > 0 ? projRes.rows[0].id : null;

        const agencies = ['대한건설', '삼성건설', '현대건설', 'GS건설', '롯데건설', '포스코건설'];
        const names = ['김철수', '이영희', '박민수', '최지은', '정대호', '강미영', '조성훈', '윤서연', '임동욱', '한지혜',
            '송민재', '오수진', '신태양', '배은지', '홍길동', '장미란', '권혁진', '노승우', '서하늘', '문정아'];

        const educations = [
            { title: '12월 정기 안전 보건 교육', type: '정기', instructor: '김철수 안전팀장', place: '현장 안전교육장', content: '동절기 한랭질환 예방', date: '2023-12-01', attendees: 18 },
            { title: '신규 채용자 안전 교육', type: '신규채용', instructor: '박영희 안전관리자', place: '관리 사무실 회의실', content: '현장 기본 안전 수칙', date: '2023-12-03', attendees: 8 },
            { title: '밀폐 공간 작업 특별 안전 교육', type: '특별', instructor: '외부 초빙 강사', place: '지하 2층 펌프실 앞', content: '산소 농도 측정 방법', date: '2023-11-28', attendees: 12 },
            { title: '콘크리트 타설 작업 안전 교육', type: '특별', instructor: '최오반 공사과장', place: '101동 1층 로비', content: '펌프카 전도 방지', date: '2023-11-25', attendees: 15 },
            { title: 'MSDS 교육 - 도장공사', type: '물질안전', instructor: '이보건 보건관리자', place: '자재 창고 앞', content: '방수제 및 페인트 취급 요령', date: '2023-11-20', attendees: 10 }
        ];

        for (const edu of educations) {
            const insertRes = await client.query(`
                INSERT INTO sms_educations (
                    project_id, title, type, instructor, date, place, content
                ) VALUES ($1, $2, $3, $4, $5, $6, $7)
                RETURNING id
            `, [projectId, edu.title, edu.type, edu.instructor, edu.date, edu.place, edu.content]);

            const educationId = insertRes.rows[0].id;
            console.log(`Created education: ${edu.title} (ID: ${educationId})`);

            // Generate attendees with varied times
            for (let i = 0; i < edu.attendees; i++) {
                const randomName = names[Math.floor(Math.random() * names.length)];
                const randomAgency = agencies[Math.floor(Math.random() * agencies.length)];
                const randomBirth = `${80 + Math.floor(Math.random() * 20)}${String(Math.floor(Math.random() * 12) + 1).padStart(2, '0')}${String(Math.floor(Math.random() * 28) + 1).padStart(2, '0')}`;

                // Random attendance time between 8:50 and 9:20
                const baseTime = new Date(edu.date + 'T09:00:00');
                const randomMinutes = Math.floor(Math.random() * 30) - 10; // -10 to +20 minutes
                baseTime.setMinutes(baseTime.getMinutes() + randomMinutes);

                await client.query(`
                    INSERT INTO sms_education_attendees (education_id, worker_name, worker_birth, worker_agency, signature_url, attended_at)
                    VALUES ($1, $2, $3, $4, $5, $6)
                `, [educationId, randomName, randomBirth, randomAgency, 'Signed', baseTime]);
            }
            console.log(`  Added ${edu.attendees} attendees`);
        }

        await client.query('COMMIT');
        console.log('\n✅ Successfully reseeded 5 Education records with realistic attendees.');
        console.log('Total attendees: 63');
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('❌ Error reseeding Education data:', err);
    } finally {
        client.release();
        pool.end();
    }
}

clearAndReseed();
