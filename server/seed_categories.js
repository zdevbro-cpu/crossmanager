
const { Pool } = require('pg');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env.local') });

const pool = new Pool({
    user: process.env.DB_USER,
    host: process.env.DB_HOST,
    database: process.env.DB_NAME,
    password: process.env.DB_PASSWORD,
    port: process.env.DB_PORT,
});

const STANDARD_FOLDERS = [
  { parent: '00_공무_행정', folders: ['01_사업자_면허', '02_계약_서약', '03_선임_조직', '04_인력_출력', '05_내역_정산'] },
  { parent: '01_안전_보건', folders: ['01_안전교육', '02_위험성평가', '03_안전점검', '04_TBM_회의', '05_보호구_장구', '06_산업보건', '07_사고_사례'] },
  { parent: '02_공사_작업', folders: ['01_작업계획서', '02_시공계획서', '03_공사일보', '04_작업허가서', '05_도면_설계'] },
  { parent: '03_장비_공도구', folders: ['01_장비서류', '02_중장비_점검', '03_공도구_관리'] },
  { parent: '04_기록_자료', folders: ['01_사진대지', '02_공문_수발신', '03_회의록_일반', '04_준공_정산'] },
  { parent: '05_기타', folders: [] }
];

async function seed() {
    try {
        const projects = await pool.query('SELECT id FROM projects');
        console.log(`Found ${projects.rows.length} projects to seed.`);

        for (const proj of projects.rows) {
            for (const cat of STANDARD_FOLDERS) {
                for (let i = 0; i < cat.folders.length; i++) {
                    const folderName = cat.folders[i];
                    await pool.query(
                        'INSERT INTO dms_categories (project_id, parent_category, name, sequence_no) VALUES ($1, $2, $3, $4) ON CONFLICT DO NOTHING',
                        [proj.id, cat.parent, folderName, i + 1]
                    );
                }
            }
        }
        console.log('Seeding completed successfully.');
    } catch (err) {
        console.error('Seeding failed:', err);
    } finally {
        await pool.end();
    }
}

seed();
