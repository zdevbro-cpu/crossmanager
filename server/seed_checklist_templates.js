const { Pool } = require('pg');
require('dotenv').config();

const dbConfig = {
    user: process.env.DB_USER,
    database: process.env.DB_NAME,
    password: process.env.DB_PASSWORD,
    port: process.env.DB_PORT || 5432,
    host: process.env.DB_HOST || 'localhost'
};

if (process.env.DB_HOST && process.env.DB_HOST.startsWith('/cloudsql')) {
    dbConfig.host = process.env.DB_HOST;
} else {
    dbConfig.ssl = { rejectUnauthorized: false };
}

const pool = new Pool(dbConfig);

const templates = [
    {
        id: 'TPL-001',
        title: '지게차 작업 전 안전점검',
        category: 'HeavyEq',
        items: [
            { id: 'i1', content: '전조등, 후미등, 방향지시등 작동 상태는 양호한가?' },
            { id: 'i2', content: '경광등 및 후진 경보음 작동 상태는 양호한가?' },
            { id: 'i3', content: '타이어 마모 상태 및 공기압은 적정한가?' },
            { id: 'i4', content: '유압 장치(리프트, 틸트) 작동 시 누유는 없는가?' },
            { id: 'i5', content: '운전자 자격증 소지 및 안전벨트 착용 확인' }
        ]
    },
    {
        id: 'TPL-002',
        title: '고소작업대(TL) 사용 전 점검',
        category: 'HighPlace',
        items: [
            { id: 'i1', content: '아웃트리거 설치 및 지반 상태 확인' },
            { id: 'i2', content: '작업대 난간 및 낙하방지 조치 확인' },
            { id: 'i3', content: '비상정지 장치 및 하강 장치 작동 확인' },
            { id: 'i4', content: '안전고리 체결 상태 확인' }
        ]
    }
];

async function seed() {
    const client = await pool.connect();
    try {
        console.log('Seeding Checklist Templates...');

        for (const tpl of templates) {
            await client.query(`
                INSERT INTO sms_checklist_templates (id, title, items, category, updated_at)
                VALUES ($1, $2, $3, $4, NOW())
                ON CONFLICT (id) DO UPDATE 
                SET title = EXCLUDED.title, 
                    items = EXCLUDED.items,
                    category = EXCLUDED.category,
                    updated_at = NOW()
            `, [tpl.id, tpl.title, JSON.stringify(tpl.items), tpl.category]);
            console.log(`Seeded: ${tpl.title}`);
        }

        console.log('Done.');
    } catch (e) {
        console.error(e);
    } finally {
        client.release();
        pool.end();
    }
}

seed();
