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

const documents = {
    '안전관리비': [
        { title: '2023년 12월 안전관리비 사용 내역', description: '12월 한 달간 안전시설 및 보호구 구매 내역' },
        { title: '2023년 11월 안전관리비 사용 내역', description: '11월 한 달간 안전교육 및 점검 비용 내역' },
        { title: '2023년 10월 안전관리비 사용 내역', description: '10월 한 달간 안전시설 유지보수 비용' },
        { title: '2023년 3분기 안전관리비 집행 현황', description: '7~9월 안전관리비 집행 현황 및 잔액' },
        { title: '안전보호구 구매 내역 (12월)', description: '안전모, 안전화, 안전벨트 등 구매 내역' },
        { title: '안전시설물 설치 비용 (11월)', description: '추락방지망, 안전난간 설치 비용' },
        { title: '안전교육 강사료 지급 내역', description: '외부 강사 초빙 교육 비용' },
        { title: '안전점검 장비 구매 내역', description: '가스측정기, 절연저항계 등 구매' },
        { title: '응급의료용품 구매 내역', description: '구급함, 응급처치 용품 구매' },
        { title: '안전표지판 제작 및 설치 비용', description: '경고표지, 안내표지 제작 설치' }
    ],
    '주간보고': [
        { title: '2023년 12월 1주차 안전 주간보고', description: '12/1~12/7 안전활동 및 점검 결과' },
        { title: '2023년 11월 4주차 안전 주간보고', description: '11/24~11/30 안전활동 및 점검 결과' },
        { title: '2023년 11월 3주차 안전 주간보고', description: '11/17~11/23 안전활동 및 점검 결과' },
        { title: '2023년 11월 2주차 안전 주간보고', description: '11/10~11/16 안전활동 및 점검 결과' },
        { title: '2023년 11월 1주차 안전 주간보고', description: '11/3~11/9 안전활동 및 점검 결과' },
        { title: '2023년 10월 5주차 안전 주간보고', description: '10/27~11/2 안전활동 및 점검 결과' },
        { title: '2023년 10월 4주차 안전 주간보고', description: '10/20~10/26 안전활동 및 점검 결과' },
        { title: '2023년 10월 3주차 안전 주간보고', description: '10/13~10/19 안전활동 및 점검 결과' },
        { title: '2023년 10월 2주차 안전 주간보고', description: '10/6~10/12 안전활동 및 점검 결과' },
        { title: '2023년 10월 1주차 안전 주간보고', description: '10/1~10/5 안전활동 및 점검 결과' }
    ],
    '월간보고': [
        { title: '2023년 11월 안전관리 월간보고', description: '11월 안전활동 종합 보고서' },
        { title: '2023년 10월 안전관리 월간보고', description: '10월 안전활동 종합 보고서' },
        { title: '2023년 9월 안전관리 월간보고', description: '9월 안전활동 종합 보고서' },
        { title: '2023년 8월 안전관리 월간보고', description: '8월 안전활동 종합 보고서' },
        { title: '2023년 7월 안전관리 월간보고', description: '7월 안전활동 종합 보고서' },
        { title: '2023년 6월 안전관리 월간보고', description: '6월 안전활동 종합 보고서' },
        { title: '2023년 5월 안전관리 월간보고', description: '5월 안전활동 종합 보고서' },
        { title: '2023년 4월 안전관리 월간보고', description: '4월 안전활동 종합 보고서' },
        { title: '2023년 3월 안전관리 월간보고', description: '3월 안전활동 종합 보고서' },
        { title: '2023년 2월 안전관리 월간보고', description: '2월 안전활동 종합 보고서' }
    ],
    '검사보고': [
        { title: '타워크레인 정기검사 보고서', description: '2023년 12월 타워크레인 안전검사 결과' },
        { title: '리프트 정기검사 보고서', description: '2023년 11월 건설용 리프트 검사 결과' },
        { title: '비계 안전검사 보고서', description: '2023년 11월 강관비계 안전검사 결과' },
        { title: '전기설비 안전검사 보고서', description: '2023년 10월 전기설비 정기검사 결과' },
        { title: '가설구조물 안전검사 보고서', description: '2023년 10월 가설구조물 안전성 검토' },
        { title: '소방시설 점검 보고서', description: '2023년 9월 소방시설 정기점검 결과' },
        { title: '밀폐공간 작업환경 측정 보고서', description: '2023년 9월 밀폐공간 산소농도 측정' },
        { title: '석면 해체작업 사전조사 보고서', description: '2023년 8월 석면 함유 여부 조사' },
        { title: '작업환경 측정 보고서', description: '2023년 8월 소음, 분진 등 측정 결과' },
        { title: '안전난간 설치 검사 보고서', description: '2023년 7월 안전난간 설치상태 검사' }
    ],
    '기타': [
        { title: '안전보건경영시스템 인증서', description: 'ISO 45001 인증서 사본' },
        { title: '안전관리자 선임신고서', description: '안전관리자 선임 및 신고 서류' },
        { title: '산업재해 통계 분석 자료', description: '최근 3년간 산업재해 발생 통계' },
        { title: '안전보건 개선계획서', description: '2024년도 안전보건 개선계획' },
        { title: '비상대응 매뉴얼', description: '화재, 붕괴 등 비상상황 대응 절차' },
        { title: '안전보건 협의체 회의록', description: '2023년 12월 안전보건협의체 회의' },
        { title: '안전점검 체크리스트', description: '일일 안전점검 체크리스트 양식' },
        { title: '위험성평가 실시 결과', description: '2023년 하반기 위험성평가 결과' },
        { title: '안전보건교육 계획서', description: '2024년도 안전보건교육 연간계획' },
        { title: '개인보호구 지급대장', description: '근로자별 보호구 지급 현황' }
    ]
};

const uploaders = ['김철수', '이영희', '박민수', '최지은', '정대호'];

async function seedDocuments() {
    const client = await pool.connect();
    try {
        console.log('Seeding Documents Data...');
        await client.query('BEGIN');

        const projRes = await client.query('SELECT id FROM projects LIMIT 1');
        const projectId = projRes.rows.length > 0 ? projRes.rows[0].id : null;

        let totalCount = 0;

        for (const [category, items] of Object.entries(documents)) {
            console.log(`\nSeeding ${category}...`);

            for (let i = 0; i < items.length; i++) {
                const doc = items[i];
                const uploader = uploaders[Math.floor(Math.random() * uploaders.length)];
                const daysAgo = Math.floor(Math.random() * 60);
                const fileSize = Math.floor(Math.random() * 500000) + 50000;

                const uploadDate = new Date();
                uploadDate.setDate(uploadDate.getDate() - daysAgo);

                await client.query(`
                    INSERT INTO sms_documents (
                        project_id, category, title, description, 
                        file_url, file_name, file_size, uploaded_by, upload_date
                    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
                `, [
                    projectId,
                    category,
                    doc.title,
                    doc.description,
                    'https://example.com/files/' + doc.title + '.pdf',
                    doc.title + '.pdf',
                    fileSize,
                    uploader,
                    uploadDate.toISOString().split('T')[0]
                ]);

                totalCount++;
            }
            console.log(`  ✓ Added ${items.length} documents`);
        }

        await client.query('COMMIT');
        console.log(`\n✅ Successfully seeded ${totalCount} documents across 5 categories.`);
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('❌ Error seeding documents:', err);
    } finally {
        client.release();
        pool.end();
    }
}

seedDocuments();
