const { Pool } = require('pg')
require('dotenv').config()

const pool = new Pool({
    user: process.env.DB_USER,
    host: process.env.DB_HOST,
    database: process.env.DB_NAME,
    password: process.env.DB_PASSWORD,
    port: process.env.DB_PORT,
    ssl: { rejectUnauthorized: false }
})

async function generateScenario() {
    const client = await pool.connect()
    try {
        await client.query('BEGIN')

        // 0. Get ALL Project IDs
        const pRes = await client.query("SELECT id FROM projects")
        const projectIds = pRes.rows.map(r => r.id)

        if (projectIds.length === 0) {
            console.error("❌ No projects found in DB. Please create a project in the Web UI first.");
            return;
        }

        const today = new Date().toISOString().split('T')[0]
        console.log(`Generating scenario data for ${projectIds.length} projects (Date: ${today})...`)

        let tableRecreated = false;

        for (const projectId of projectIds) {
            console.log(`Processing Project: ${projectId}`)

            // 1. PMS Tasks
            try {
                await client.query("DELETE FROM tasks WHERE project_id = $1", [projectId])
                const tasks = [
                    { name: '1구역 구조물 철거 (정상)', progress: 65, start: '2025-11-01', end: '2025-12-31', risk: false },
                    { name: '2구역 비계 설치 (지연)', progress: 20, start: today, end: '2025-12-25', risk: true },
                    { name: '폐기물 반출 (조기 달성)', progress: 90, start: today, end: '2026-01-10', risk: false },
                    { name: '현장 정리 정돈 (완료)', progress: 100, start: '2025-12-01', end: today, risk: false }
                ]

                for (const t of tasks) {
                    await client.query(`
                        INSERT INTO tasks (project_id, name, progress, start_date, end_date, delay_risk, status)
                        VALUES ($1, $2, $3, $4, $5, $6, 'IN_PROGRESS')
                    `, [projectId, t.name, t.progress, t.start, t.end, t.risk])
                }
            } catch (e) {
                console.warn("Tasks insert failed:", e.message)
            }

            // 2. SMS (Recreate Tables ONCE)
            try {
                if (!tableRecreated) {
                    await client.query("DROP TABLE IF EXISTS sms_dris CASCADE")
                    await client.query(`
                        CREATE TABLE sms_dris (
                            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                            project_id UUID,
                            date DATE,
                            work_content TEXT,
                            risk_points VARCHAR(50),
                            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                        )
                    `)
                    await client.query("DROP TABLE IF EXISTS sms_incidents CASCADE")
                    await client.query(`
                        CREATE TABLE sms_incidents (
                            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                            project_id UUID,
                            date DATE,
                            title VARCHAR(255),
                            type VARCHAR(50),
                            status VARCHAR(20),
                            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                        )
                    `)
                }

                // Insert SMS
                await client.query("INSERT INTO sms_dris (project_id, date, work_content, risk_points) VALUES ($1, $2, '오전 TBM - 고소작업 안전교육', 'NORMAL')", [projectId, today])
                await client.query("INSERT INTO sms_incidents (project_id, date, title, type, status) VALUES ($1, $2, '경미한 자재 낙하', 'NEAR_MISS', 'CLOSED')", [projectId, today])
                await client.query("INSERT INTO sms_incidents (project_id, date, title, type, status) VALUES ($1, '2025-01-01', '안전 난간 미설치 지적', 'ACCIDENT', 'OPEN')", [projectId])

            } catch (e) {
                console.error("SMS processing failed:", e)
            }

            // 3. EMS (Skip for now to avoid schema issues, focus on PMS/SMS/SWMS)

            // 4. SWMS (Recreate Tables ONCE to fix UUID Types)
            try {
                if (!tableRecreated) {
                    await client.query("DROP TABLE IF EXISTS swms_generations CASCADE")
                    await client.query(`
                        CREATE TABLE swms_generations (
                            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                            site_id VARCHAR(50),
                            project_id UUID,
                            generation_date DATE,
                            quantity DECIMAL,
                            unit VARCHAR(20),
                            location VARCHAR(100),
                            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                        )
                    `)
                    tableRecreated = true; // Mark tables as recreated
                }

                await client.query("DELETE FROM swms_generations WHERE project_id = $1", [projectId])
                await client.query(`
                    INSERT INTO swms_generations (site_id, project_id, generation_date, quantity, unit, location)
                    VALUES 
                    ('site1', $1, $2, 12, 'TON', 'Zone A'),
                    ('site1', $1, $2, 5.5, 'TON', 'Zone B')
                `, [projectId, today])
            } catch (e) {
                console.warn("SWMS table creation/insert failed:", e.message)
            }
        }

        await client.query('COMMIT')
        console.log('✅ Scenario Data Generated Successfully for ALL Projects!')

    } catch (e) {
        await client.query('ROLLBACK')
        console.error('Error generating scenario:', e)
    } finally {
        client.release()
        pool.end()
    }
}

generateScenario()
