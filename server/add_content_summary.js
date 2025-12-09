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

async function addContentSummary() {
    const client = await pool.connect();
    try {
        console.log('Adding content_summary column to sms_documents...');

        await client.query(`
            ALTER TABLE sms_documents 
            ADD COLUMN IF NOT EXISTS content_summary TEXT
        `);

        console.log('✅ Column added successfully');

        // Update existing records with sample summaries
        console.log('Updating existing documents with sample summaries...');

        const docs = await client.query('SELECT id, title, category FROM sms_documents LIMIT 10');

        for (const doc of docs.rows) {
            let summary = '';

            if (doc.category === '안전관리비') {
                summary = '본 보고서는 안전시설 및 보호구 구매, 안전교육 실시, 점검 활동 등에 사용된 안전관리비 내역을 상세히 기록하였습니다. 총 집행액과 잔액, 주요 지출 항목별 세부 내역이 포함되어 있습니다.';
            } else if (doc.category === '주간보고') {
                summary = '금주 현장 안전활동 현황, TBM 실시 내역, 안전점검 결과, 발견된 위험요인 및 조치사항을 요약하였습니다. 특이사항 및 다음 주 중점 관리사항이 포함되어 있습니다.';
            } else if (doc.category === '월간보고') {
                summary = '당월 안전관리 활동 전반에 대한 종합 보고서입니다. 교육 실시 현황, 점검 결과, 사고 발생 현황, 개선조치 사항 등이 포함되어 있으며, 다음 달 안전관리 계획이 수립되어 있습니다.';
            } else if (doc.category === '검사보고') {
                summary = '법정 의무 검사 및 자체 안전점검 결과를 상세히 기록하였습니다. 검사 대상 장비/시설의 상태, 적합/부적합 판정, 시정조치 필요사항 등이 명시되어 있습니다.';
            } else {
                summary = '안전보건 관련 주요 문서 및 자료입니다. 인증서, 신고서, 통계자료, 매뉴얼 등 현장 안전관리에 필요한 참고자료가 포함되어 있습니다.';
            }

            await client.query('UPDATE sms_documents SET content_summary = $1 WHERE id = $2', [summary, doc.id]);
        }

        console.log('✅ Sample summaries updated');

    } catch (err) {
        console.error('❌ Error:', err.message);
    } finally {
        client.release();
        pool.end();
    }
}

addContentSummary();
