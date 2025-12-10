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

const sampleDocs = [
    { category: 'CONTRACT', type: '계약서', name: '표준 하도급 계약서.pdf', status: 'APPROVED', security: 'CONFIDENTIAL' },
    { category: 'CONTRACT', type: '견적서', name: '1차 철거 견적서_수정.pdf', status: 'APPROVED', security: 'NORMAL' },
    { category: 'PROCESS', type: '공정표', name: '전체 공정 일정표_v2.xlsx', status: 'PENDING', security: 'NORMAL' },
    { category: 'SAFETY', type: '안전관리계획서', name: '유해위험방지계획서.pdf', status: 'APPROVED', security: 'SECRET' },
    { category: 'SAFETY', type: 'TBM일지', name: '2023-10-25_TBM일지.jpg', status: 'DRAFT', security: 'NORMAL' },
    { category: 'QUALITY', type: '검측요청서', name: '배관 해체 검측 요청서.pdf', status: 'PENDING', security: 'NORMAL' },
    { category: 'EVIDENCE', type: '거래명세서', name: '폐기물 운반 거래명세서(10월).pdf', status: 'APPROVED', security: 'NORMAL' },
    { category: 'SCRAP', type: '계량증명서', name: '계량증명서_231025_001.jpg', status: 'APPROVED', security: 'NORMAL' },
    { category: 'PHOTO', type: '현장사진', name: 'A구역 작업 전 사진.jpg', status: 'DRAFT', security: 'NORMAL' },
    { category: 'PHOTO', type: '현장사진', name: 'A구역 작업 후 사진.jpg', status: 'DRAFT', security: 'NORMAL' }
];

async function seed() {
    try {
        console.log('Connecting to DB...');
        // 1. Get a Project ID (or create one)
        let projectId;
        const projRes = await pool.query('SELECT id FROM projects LIMIT 1');
        if (projRes.rows.length === 0) {
            console.log('No projects found. Creating a dummy project...');
            const insertProj = await pool.query(`
                INSERT INTO projects (code, name, client, status, start_date, end_date)
                VALUES ('TEST-001', '테스트 철거 프로젝트', '테스트 클라이언트', 'IN_PROGRESS', NOW(), NOW() + INTERVAL '1 month')
                RETURNING id
            `);
            projectId = insertProj.rows[0].id;
        } else {
            projectId = projRes.rows[0].id;
        }
        console.log('Using Project ID:', projectId);

        // 2. Insert Documents
        for (const doc of sampleDocs) {
            const client = await pool.connect();
            try {
                await client.query('BEGIN');

                // Insert Master
                const insertMaster = `
                    INSERT INTO documents (
                        project_id, category, type, name, status, 
                        current_version, security_level, metadata, created_by
                    ) VALUES ($1, $2, $3, $4, $5, 'v1', $6, '{}', NULL)
                    RETURNING id
                `;
                const masterRes = await client.query(insertMaster, [
                    projectId, doc.category, doc.type, doc.name, doc.status, doc.security
                ]);
                const docId = masterRes.rows[0].id;

                // Insert Version
                const insertVersion = `
                    INSERT INTO document_versions (
                        document_id, version, file_path, file_size
                    ) VALUES ($1, 'v1', $2, $3)
                `;
                // Dummy path and size
                const dummyPath = `uploads/sample_${Math.floor(Math.random() * 1000)}.dat`;
                const dummySize = Math.floor(Math.random() * 1024 * 1024 * 5); // 0-5MB

                await client.query(insertVersion, [docId, dummyPath, dummySize]);

                await client.query('COMMIT');
                console.log(`Initialized document: ${doc.name}`);
            } catch (e) {
                await client.query('ROLLBACK');
                console.error(`Error inserting ${doc.name}:`, e);
            } finally {
                client.release();
            }
        }

        console.log('Seeding completed!');
    } catch (err) {
        console.error('Seeding failed:', err);
    } finally {
        pool.end();
    }
}

seed();
