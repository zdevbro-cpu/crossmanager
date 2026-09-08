const { Pool } = require('pg');
const pool = new Pool({
    user: 'postgres',
    host: 'localhost',
    database: 'postgres',
    password: 'Kevin0371_',
    port: 5432,
    ssl: false
});

const STANDARD_HIERARCHY = [
    { id: '00_공무_행정', label: '00_공무_행정', children: ['01_사업자_면허', '02_계약_서약', '03_선임_조직', '04_인력_출역', '05_내역_정산'] },
    { id: '01_안전_보건', label: '01_안전_보건', children: ['01_안전교육', '02_위험성평가', '03_안전점검', '04_TBM_회의', '05_보호구_장구', '06_산업보건', '07_사고_재해'] },
    { id: '02_공사_작업', label: '02_공사_작업', children: ['01_작업계획서', '02_시공계획서', '03_공사일보', '04_작업허가서', '05_도면_설계'] },
    { id: '03_장비_공도구', label: '03_장비_공도구', children: ['01_장비서류', '02_중장비_점검', '03_공도구_관리'] },
    { id: '04_기록_자료', label: '04_기록_자료', children: ['01_사진대지', '02_공문_수발신', '03_회의록_일반', '04_준공_인허가'] },
    { id: '05_기타', label: '05_기타', children: [] }
];

async function init() {
    try {
        console.log('--- Init DMS Categories ---');
        
        // 1. Create table
        await pool.query(`
            CREATE TABLE IF NOT EXISTS dms_categories (
                id TEXT PRIMARY KEY,
                parent_id TEXT,
                label TEXT NOT NULL,
                display_order INTEGER DEFAULT 0,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);
        console.log('Table dms_categories ensured.');

        // 2. Check if empty
        const countRes = await pool.query("SELECT COUNT(*) FROM dms_categories");
        const count = parseInt(countRes.rows[0].count);

        if (count === 0) {
            console.log('Seeding standard hierarchy...');
            for (let i = 0; i < STANDARD_HIERARCHY.length; i++) {
                const parent = STANDARD_HIERARCHY[i];
                await pool.query(
                    "INSERT INTO dms_categories (id, parent_id, label, display_order) VALUES ($1, $2, $3, $4)",
                    [parent.id, null, parent.label, i]
                );
                
                for (let j = 0; j < parent.children.length; j++) {
                    const child = parent.children[j];
                    const childId = `${parent.id}_${child}`;
                    await pool.query(
                        "INSERT INTO dms_categories (id, parent_id, label, display_order) VALUES ($1, $2, $3, $4)",
                        [childId, parent.id, child, j]
                    );
                }
            }
            console.log('Seeding complete.');
        } else {
            console.log('Table already has data. Skipping seed.');
        }
        
    } catch (e) {
        console.error('INIT_ERROR:', e.message);
    } finally {
        await pool.end();
    }
}
init();
