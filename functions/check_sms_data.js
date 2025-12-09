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

async function checkData() {
    const client = await pool.connect();
    try {
        console.log('=== SMS 데이터베이스 확인 ===\n');

        // 1. Documents
        const docsRes = await client.query('SELECT category, COUNT(*) as count FROM sms_documents GROUP BY category ORDER BY category');
        console.log('📄 문서 (sms_documents):');
        docsRes.rows.forEach(row => {
            console.log(`  - ${row.category}: ${row.count}건`);
        });
        const totalDocs = await client.query('SELECT COUNT(*) FROM sms_documents');
        console.log(`  총 ${totalDocs.rows[0].count}건\n`);

        // 2. Educations
        const eduRes = await client.query('SELECT COUNT(*) FROM sms_educations');
        console.log(`📚 교육 (sms_educations): ${eduRes.rows[0].count}건`);

        const attendeesRes = await client.query('SELECT COUNT(*) FROM sms_education_attendees');
        console.log(`👥 교육 참석자 (sms_education_attendees): ${attendeesRes.rows[0].count}건\n`);

        // 3. Incidents
        const incidentRes = await client.query('SELECT type, COUNT(*) as count FROM sms_incidents GROUP BY type');
        console.log('⚠️  사고/아차사고 (sms_incidents):');
        incidentRes.rows.forEach(row => {
            console.log(`  - ${row.type}: ${row.count}건`);
        });
        const totalIncidents = await client.query('SELECT COUNT(*) FROM sms_incidents');
        console.log(`  총 ${totalIncidents.rows[0].count}건\n`);

        // 4. Sample data from each table
        console.log('=== 샘플 데이터 확인 ===\n');

        const sampleDoc = await client.query('SELECT title, category, uploaded_by, upload_date FROM sms_documents LIMIT 3');
        console.log('📄 문서 샘플:');
        sampleDoc.rows.forEach(row => {
            console.log(`  - [${row.category}] ${row.title} (${row.uploaded_by}, ${row.upload_date})`);
        });

        const sampleEdu = await client.query('SELECT title, type, date FROM sms_educations LIMIT 3');
        console.log('\n📚 교육 샘플:');
        sampleEdu.rows.forEach(row => {
            console.log(`  - [${row.type}] ${row.title} (${row.date})`);
        });

        const sampleIncident = await client.query('SELECT title, type, date FROM sms_incidents LIMIT 3');
        console.log('\n⚠️  사고 샘플:');
        sampleIncident.rows.forEach(row => {
            console.log(`  - [${row.type}] ${row.title} (${row.date})`);
        });

        console.log('\n✅ 모든 데이터가 PostgreSQL 데이터베이스에 정상적으로 저장되어 있습니다.');
        console.log('💡 이 데이터는 서버를 재시작해도 유지되며, 필요시 언제든지 삭제/재생성 가능합니다.');

    } catch (err) {
        console.error('❌ 오류:', err.message);
    } finally {
        client.release();
        pool.end();
    }
}

checkData();
