const { Pool } = require('pg');
const path = require('path');
const fs = require('fs');

// 로컬 환경 및 커스텀 환경 설정 우선 로드
const localEnvPath = path.join(__dirname, '..', '.env.local');
const envPath = fs.existsSync(localEnvPath) ? localEnvPath : path.join(__dirname, '..', '.env');
require('dotenv').config({ path: envPath });

const pool = new Pool({
    user: process.env.DB_USER,
    host: process.env.DB_HOST || 'localhost',
    database: process.env.DB_NAME,
    password: process.env.DB_PASSWORD,
    port: process.env.DB_PORT || 5432,
});

const STD_FOLDER_ROOT = 'C:\\ProjectCode\\Cross\\Data\\CrossDoc\\StdFolder';

// 하위 공종 매핑 설정
const SUB_CAT_MAPPING = {
    '00_공무_행정': [
        { id: '01_사업자_면허', keywords: ['사업자', '등록증', '면허'] },
        { id: '02_계약_서약', keywords: ['계약', '서약'] },
        { id: '03_선임_조직', keywords: ['선임', '조직', '지정서'] },
        { id: '04_인력_출력', keywords: ['인력'] },
        { id: '05_내역_정산', keywords: ['내역서', '내역', '정산', '사용내역'] }
    ],
    '01_안전_보건': [
        { id: '01_안전교육', keywords: ['교육', '이수증', '수료증'] },
        { id: '02_위험성평가', keywords: ['위험성', 'KRA', '위평'] },
        { id: '03_안전점검', keywords: ['점검', '패트롤', '순회'] },
        { id: '04_TBM_회의', keywords: ['TBM', '회의'] },
        { id: '05_보호구_장구', keywords: ['보호구', '안전모', '귀마개', '착용'] },
        { id: '06_산업보건', keywords: ['보건', 'MSDS', '검진', '건강'] },
        { id: '07_사고_사례', keywords: ['사고', '사례', '재발방지'] }
    ],
    '02_공사_작업': [
        { id: '01_작업계획서', keywords: ['작업계획서', '계획서', '중량물'] },
        { id: '02_시공계획서', keywords: ['시공계획서', '시공'] },
        { id: '03_공사일보', keywords: ['일보', '진도'] },
        { id: '04_작업허가서', keywords: ['허가서', '허가'] },
        { id: '05_도면_설계', keywords: ['도면', '설계', 'SHOP'] }
    ],
    '03_장비_공도구': [
        { id: '01_장비서류', keywords: ['장비', '검사증', '보험증', '등록증'] },
        { id: '02_중장비_점검', keywords: ['점검', '체크리스트'] },
        { id: '03_공도구_관리', keywords: ['공도구'] }
    ],
    '04_기록_자료': [
        { id: '01_사진대지', keywords: ['사진'] },
        { id: '02_공문_수발신', keywords: ['공문'] },
        { id: '03_회의록_일반', keywords: ['회의록'] },
        { id: '04_준공_정산', keywords: ['준공'] }
    ]
};

async function run() {
    console.log('🚀 [Ingestion] Starting document ingestion from StdFolder...');
    const client = await pool.connect();

    try {
        // 1. 프로젝트 확인 (첫 번째 프로젝트 사용)
        const projRes = await client.query('SELECT id, name FROM projects ORDER BY created_at DESC LIMIT 1');
        if (projRes.rows.length === 0) {
            console.error('❌ No projects found in DB. Please create a project first.');
            return;
        }
        const projectId = projRes.rows[0].id;
        console.log(`📂 Using Project: ${projRes.rows[0].name} (${projectId})`);

        // 2. 카테고리별 스캔 루프
        for (const [category, subCats] of Object.entries(SUB_CAT_MAPPING)) {
            const catPath = path.join(STD_FOLDER_ROOT, category);
            if (!fs.existsSync(catPath)) {
                console.warn(`⚠️ Category folder not found: ${catPath}`);
                continue;
            }

            console.log(`\n📁 Processing Category: ${category}`);

            for (const subCat of subCats) {
                console.log(`  🔍 Sub-Category: ${subCat.id}`);
                let count = 0;

                // 재귀적으로 파일 탐색
                function walk(dir) {
                    if (count >= 5) return []; // 5개 제한
                    let files = [];
                    try {
                        const items = fs.readdirSync(dir, { withFileTypes: true });
                        for (const item of items) {
                            if (count >= 5) break;

                            const fullPath = path.join(dir, item.name);
                            if (item.isDirectory()) {
                                files = files.concat(walk(fullPath));
                            } else {
                                // 키워드 매칭 여부 확인
                                const matched = subCat.keywords.some(k => item.name.includes(k));
                                if (matched) {
                                    files.push({ name: item.name, path: fullPath });
                                    count++;
                                }
                            }
                        }
                    } catch (e) {
                        console.error(`Error reading ${dir}: ${e.message}`);
                    }
                    return files;
                }

                const targetFiles = walk(catPath);
                console.log(`  ✅ Found ${targetFiles.length} files for ${subCat.id}`);

                for (const fileObj of targetFiles) {
                    // 파일명에서 날짜 추출 (YYYYMMDD)
                    const dateMatch = fileObj.name.match(/^(\d{4})(\d{2})(\d{2})/);
                    const productionDate = dateMatch ? `${dateMatch[1]}-${dateMatch[2]}-${dateMatch[3]}` : new Date().toISOString().split('T')[0];
                    
                    const fileName = fileObj.name;
                    const fileExt = path.extname(fileName).toLowerCase().replace('.', '');
                    const stats = fs.statSync(fileObj.path);

                    // 용량 제한 (5MB 이상은 생략하여 DB 부하 방지)
                    if (stats.size > 5 * 1024 * 1024) {
                        console.log(`    ⏩ Skipping large file: ${fileName} (${(stats.size/1024/1024).toFixed(2)}MB)`);
                        continue;
                    }

                    try {
                        const fileContentB64 = fs.readFileSync(fileObj.path, { encoding: 'base64' });

                        await client.query('BEGIN');

                        // documents 테이블 삽입
                        const docRes = await client.query(`
                            INSERT INTO documents (
                                project_id, name, category, sub_category, type, status, 
                                metadata, created_at, updated_at
                            ) VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW())
                            RETURNING id
                        `, [
                            projectId, 
                            fileName, 
                            category, 
                            subCat.id, 
                            fileExt.toUpperCase(), 
                            'APPROVED',
                            JSON.stringify({
                                official_name: fileName.split('_').slice(1).join('_').replace(/\.[^/.]+$/, "") || fileName,
                                production_date: productionDate,
                                tags: [`#${category.split('_')[1]}`, `#${subCat.id.split('_')[1]}`],
                                source_path: fileObj.path
                            })
                        ]);

                        const docId = docRes.rows[0].id;

                        // document_versions 테이블 삽입
                        await client.query(`
                            INSERT INTO document_versions (
                                document_id, version, file_path, file_size, file_content, 
                                change_log, created_at
                            ) VALUES ($1, $2, $3, $4, $5, $6, NOW())
                        `, [
                            docId, 
                            'v1.0', 
                            fileName, 
                            stats.size, 
                            fileContentB64, 
                            'Initial automated ingestion'
                        ]);

                        await client.query('COMMIT');
                        console.log(`    ✨ Ingested: ${fileName}`);
                    } catch (err) {
                        await client.query('ROLLBACK');
                        console.error(`    ❌ Failed to ingest ${fileName}: ${err.message}`);
                    }
                }
            }
        }

        console.log('\n🏁 [Ingestion] All tasks completed!');

    } catch (err) {
        console.error('❌ Global error in script:', err);
    } finally {
        client.release();
        await pool.end();
    }
}

run();
