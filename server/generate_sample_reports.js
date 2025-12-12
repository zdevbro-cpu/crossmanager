
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

const generateSamples = async () => {
    const client = await pool.connect();
    try {
        console.log("Connected to DB, starting sample generation...");

        // 1. Get a Project ID
        const projectRes = await client.query('SELECT id, name FROM projects LIMIT 1');
        if (projectRes.rows.length === 0) {
            console.error("No projects found. Create a project first.");
            return;
        }
        const projectId = projectRes.rows[0].id;
        const projectName = projectRes.rows[0].name;
        console.log(`Using Project: ${projectName} (${projectId})`);

        // 2. Generate Daily Report Data
        const dailyContent = {
            summary: "일일 공정 진행 및 안전 점검 완료",
            weather: "Sunny, 25C",
            pms: {
                activeTasks: [
                    { name: "기초 터파기", progress: 80, delayRisk: false },
                    { name: "철근 배근", progress: 30, delayRisk: true }
                ],
                totalActive: 2
            },
            sms: {
                dris: [{ work_content: "고소 작업", risk_points: "추락 주의", status: "COMPLETED" }],
                incidents: [],
                safetyStatus: "SAFE"
            },
            ems: {
                deployedCount: 3,
                equipmentList: [
                    { name: "굴삭기 01", status: "가동" },
                    { name: "크레인 02", status: "대기" },
                    { name: "덤프 03", status: "가동" }
                ]
            }
        };

        // 3. Generate Weekly Report Data
        const weeklyContent = {
            summary: "주간 공정률 5% 달성 (계획 대비 98%)",
            pms: {
                weeklyProgress: 5.2,
                cumulativeProgress: 45.0,
                keyIssues: "자재 입고 지연 해소됨"
            },
            sms: {
                accidentCount: 0,
                nearMissCount: 2,
                patrolIssues: 5
            }
        };

        // 4. Insert Reports
        const reports = [
            {
                title: "2024-12-12 일일 작업 보고서",
                type: "DAILY",
                content: dailyContent
            },
            {
                title: "12월 2주차 주간 공정 보고서",
                type: "WEEKLY",
                content: weeklyContent
            }
        ];

        for (const r of reports) {
            await client.query(`
                INSERT INTO reports (project_id, title, report_date, status, content, created_by, created_at)
                VALUES ($1, $2, CURRENT_DATE, 'DRAFT', $3, 'System Sample', NOW())
            `, [projectId, r.title, JSON.stringify(r.content)]);
            console.log(`Created sample report: ${r.title}`);
        }

        console.log("Sample generation complete.");

    } catch (err) {
        console.error("Error:", err);
    } finally {
        client.release();
        pool.end();
    }
};

generateSamples();
