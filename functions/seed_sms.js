
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

const sampleRisks = [
    {
        process_name: '철골 구조물 설치 작업',
        assessor: '김안전',
        items: [
            { factor: '고소 작업 중 안전대 미체결로 인한 추락', type: '추락', freq: 4, sev: 5, measure: '안전대 이중 체결 및 생명줄 설치 확인', manager: '박반장' },
            { factor: '크레인 인양 중 자재 낙하', type: '낙하', freq: 3, sev: 5, measure: '인양 구간 하부 통제 및 신호수 배치', manager: '이신호' }
        ]
    },
    {
        process_name: '지하 터파기 및 흙막이 공사',
        assessor: '이토목',
        items: [
            { factor: '굴착면 붕괴로 인한 매몰', type: '붕괴', freq: 3, sev: 5, measure: '법면 기울기 준수 및 흙막이 계측 관리', manager: '최소장' },
            { factor: '덤프트럭 후진 중 작업자 충돌', type: '충돌', freq: 4, sev: 4, measure: '후방 감지기 작동 확인 및 유도원 배치', manager: '김유도' }
        ]
    },
    {
        process_name: '전기 배선 및 분전반 설치',
        assessor: '박전기',
        items: [
            { factor: '활선 근접 작업 중 감전', type: '감전', freq: 3, sev: 4, measure: '절연 장갑 착용 및 정전 작업 원칙 준수', manager: '정전기' },
            { factor: '고소작업대(렌탈) 과상승으로 인한 협착', type: '협착', freq: 3, sev: 5, measure: '상승 방지봉 설치 및 2인 1조 작업', manager: '오기사' }
        ]
    },
    {
        process_name: '외부 비계 설치 및 해체',
        assessor: '최비계',
        items: [
            { factor: '벽이음 부족으로 인한 비계 전도', type: '전도', freq: 2, sev: 5, measure: '구조검토서에 따른 벽이음 설치 간격 준수', manager: '강팀장' },
            { factor: '작업 발판 고정 불량으로 인한 추락', type: '추락', freq: 4, sev: 5, measure: '발판 틈새 없는 설치 및 고정 철저', manager: '조반장' }
        ]
    },
    {
        process_name: '콘크리트 타설 작업',
        assessor: '정타설',
        items: [
            { factor: '펌프카 붐대 파손으로 인한 낙하', type: '낙하', freq: 2, sev: 5, measure: '작업 전 붐대 균열 점검 및 하부 통제', manager: '윤펌프' },
            { factor: '거푸집 동바리 붕괴', type: '붕괴', freq: 2, sev: 5, measure: '콘크리트 타설 순서 준수 및 동바리 수직도 확인', manager: '한목수' }
        ]
    },
    {
        process_name: '용접 및 용단 작업',
        assessor: '강용접',
        items: [
            { factor: '불티 비산으로 인한 화재', type: '화재', freq: 4, sev: 5, measure: '불티 비산 방지포 설치 및 소화기 비치', manager: '임화기' },
            { factor: '밀폐 공간 용접 시 질식', type: '질식', freq: 2, sev: 5, measure: '산소 농도 측정 및 송풍기 가동', manager: '배감시' }
        ]
    },
    {
        process_name: '타워크레인 설치/해체',
        assessor: '송타워',
        items: [
            { factor: '마스트 볼트 체결 불량으로 인한 붕괴', type: '붕괴', freq: 1, sev: 5, measure: '볼트 체결 토크 값 준수 및 확인', manager: '신검사' },
            { factor: '작업자 이동 중 추락', type: '추락', freq: 3, sev: 5, measure: '이동 통로 안전망 설치 및 안전고리 체결', manager: '권설치' }
        ]
    },
    {
        process_name: '조적 및 미장 공사',
        assessor: '양미장',
        items: [
            { factor: '우마 사다리 사용 중 전도', type: '전도', freq: 4, sev: 3, measure: '안전 인증 사다리 사용 및 2인 1조 작업', manager: '서조적' },
            { factor: '자재 운반 중 근골격계 질환', type: '기타', freq: 4, sev: 2, measure: '중량물 취급 원칙 준수 및 스트레칭 실시', manager: '홍보건' }
        ]
    },
    {
        process_name: '시스템 동바리 설치',
        assessor: '문시스템',
        items: [
            { factor: '수직재 연결 핀 누락으로 인한 좌굴 붕괴', type: '붕괴', freq: 2, sev: 5, measure: '연결 핀 전수 검사 및 육안 확인', manager: '장구조' },
            { factor: '자재 인양 중 낙하', type: '낙하', freq: 3, sev: 4, measure: '인양 포대 사용 및 하부 통제', manager: '유반장' }
        ]
    },
    {
        process_name: '승강기 설치 공사',
        assessor: '고승강',
        items: [
            { factor: '승강로 내부 추락', type: '추락', freq: 3, sev: 5, measure: '개구부 안전 난간 및 추락 방지망 설치', manager: '황소장' },
            { factor: '카 상부 작업 중 협착', type: '협착', freq: 3, sev: 5, measure: '비상 정지 장치 작동 확인 및 2인 1조', manager: '전기사' }
        ]
    }
];

async function seedRiskAssessments() {
    const client = await pool.connect();
    try {
        console.log('Seeding Risk Assessments...');
        await client.query('BEGIN');

        // Get a valid project ID (optional, using first found or null)
        const projRes = await client.query('SELECT id FROM projects LIMIT 1');
        const projectId = projRes.rows.length > 0 ? projRes.rows[0].id : null;

        for (const ra of sampleRisks) {
            // 1. Create Assessment Header
            const raRes = await client.query(`
                INSERT INTO sms_risk_assessments (project_id, process_name, assessor_name, status, date)
                VALUES ($1, $2, $3, 'APPROVED', CURRENT_DATE - (RANDOM() * 10)::INTEGER)
                RETURNING id
            `, [projectId, ra.process_name, ra.assessor]);

            const raId = raRes.rows[0].id;

            // 2. Create Risk Items
            for (const item of ra.items) {
                await client.query(`
                    INSERT INTO sms_risk_items (
                        assessment_id, risk_factor, risk_type, frequency, severity, 
                        mitigation_measure, action_manager, action_deadline
                    ) VALUES ($1, $2, $3, $4, $5, $6, $7, CURRENT_DATE + 7)
                `, [raId, item.factor, item.type, item.freq, item.sev, item.measure, item.manager]);
            }
        }

        await client.query('COMMIT');
        console.log('Successfully seeded 10 Risk Assessments with items.');
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('Error seeding data:', err);
    } finally {
        client.release();
        pool.end();
    }
}

seedRiskAssessments();
