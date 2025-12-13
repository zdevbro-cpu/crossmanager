const express = require('express')
const router = express.Router()

function countDelayedTasks(activeTasks = []) {
    if (!Array.isArray(activeTasks)) return 0

    return activeTasks.filter((task) => {
        const delayRisk = task?.delay_risk
        const name = String(task?.name || '')

        return (
            delayRisk === true ||
            delayRisk === 'HIGH' ||
            delayRisk === 'DELAY' ||
            name.includes('지연') ||
            name.toLowerCase().includes('delay')
        )
    }).length
}

function summaryPrefix(type) {
    if (type === 'WEEKLY') return '금주'
    if (type === 'MONTHLY') return '금월'
    return '금일'
}

function generateStructuredSummary({ type, pms, sms }) {
    const prefix = summaryPrefix(type)
    const totalActive = Number(pms?.totalActive || 0)
    const delayedCount = countDelayedTasks(pms?.activeTasks || [])
    const driCount = Array.isArray(sms?.dris) ? sms.dris.length : 0
    const incidentCount = Array.isArray(sms?.incidents) ? sms.incidents.length : 0

    const lines = []

    if (totalActive > 0) lines.push(`* ${prefix} ${totalActive}건 작업진행`)
    else lines.push(`* ${prefix} 작업진행 없음`)

    if (delayedCount > 0) lines.push(`* 작업지연 ${delayedCount}건 발생`)
    else lines.push(`* 작업지연 없음`)

    if (driCount > 0) lines.push(`* TBM/DRI 시행: ${driCount}건`)
    else lines.push(`* TBM/DRI 시행 없음`)

    lines.push(`* 안전사고 발생 : ${incidentCount}건`)

    return lines.join('\n')
}

module.exports = (pool) => {

    // --- Template APIs ---

    // 1. Get All Templates
    router.get('/templates', async (req, res) => {
        try {
            const { rows } = await pool.query('SELECT * FROM report_templates ORDER BY created_at DESC')
            res.json(rows)
        } catch (err) {
            console.error(err)
            res.status(500).json({ error: 'Failed to fetch templates' })
        }
    })

    // 2. Create Template
    router.post('/templates', async (req, res) => {
        try {
            const { title, type, layoutConfig } = req.body
            const query = `
                INSERT INTO report_templates (title, type, layout_config)
                VALUES ($1, $2, $3)
                RETURNING *
            `
            const { rows } = await pool.query(query, [title, type, JSON.stringify(layoutConfig)])
            res.status(201).json(rows[0])
        } catch (err) {
            console.error(err)
            res.status(500).json({ error: 'Failed to create template' })
        }
    })

    // --- Report APIs ---

    // 3. Get Reports
    router.get('/', async (req, res) => {
        try {
            const { projectId, date, type } = req.query
            let query = `
                SELECT r.*, t.title as template_title, t.type as template_type
                FROM reports r
                LEFT JOIN report_templates t ON r.template_id = t.id
            `
            const params = []
            const conditions = []

            if (projectId) {
                params.push(projectId)
                conditions.push(`r.project_id = $${params.length}`)
            }
            if (date) {
                params.push(date)
                conditions.push(`r.report_date = $${params.length}`)
            }

            if (conditions.length > 0) {
                query += ' WHERE ' + conditions.join(' AND ')
            }

            query += ' ORDER BY r.report_date DESC, r.created_at DESC'

            const { rows } = await pool.query(query, params)
            res.json(rows)
        } catch (err) {
            console.error(err)
            res.status(500).json({ error: 'Failed to fetch reports' })
        }
    })

    // 4. Create Report (Auto-Generate)
    router.post('/', async (req, res) => {
        const client = await pool.connect()
        try {
            const { projectId, templateId, title, date, createdBy, type = 'DAILY' } = req.body
            const reportDate = date || new Date().toISOString().split('T')[0]

            // Calculate Date Range based on Type
            let startDate = reportDate;
            if (type === 'WEEKLY') {
                const d = new Date(reportDate);
                d.setDate(d.getDate() - 6);
                startDate = d.toISOString().split('T')[0];
            } else if (type === 'MONTHLY') {
                const d = new Date(reportDate);
                d.setDate(1); // Start of month
                startDate = d.toISOString().split('T')[0];
            }

            // --- DATA AGGREGATION START ---
            // 1. PMS Data (Tasks in progress, delayed)
            const pmsQuery = `
                SELECT id, name, progress, start_date, end_date, delay_risk 
                FROM tasks 
                WHERE project_id = $1 
                AND start_date <= $3 AND end_date >= $2
            `
            // Query logic: Task active if it overlaps with [startDate, reportDate]
            const pmsRes = await client.query(pmsQuery, [projectId, startDate, reportDate])

            // 2. SMS Data (DRI, Accidents in range)
            const smsDriQuery = `SELECT * FROM sms_dris WHERE project_id = $1 AND date >= $2 AND date <= $3`
            const smsDriRes = await client.query(smsDriQuery, [projectId, startDate, reportDate])

            const smsIncidentQuery = `SELECT * FROM sms_incidents WHERE project_id = $1 AND date >= $2 AND date <= $3`
            const smsIncidentRes = await client.query(smsIncidentQuery, [projectId, startDate, reportDate])

            // 3. EMS Data (Active Equipment) - Simplified logic: Fetch assigned equipment
            const emsQuery = `SELECT * FROM equipment WHERE assigned_site = (SELECT name FROM projects WHERE id = $1) OR assigned_site = $1::text`
            // Note: Project name matching is tricky, might need ID link. For now simplified.
            const emsRes = await client.query(emsQuery, [projectId])

            // 4. SWMS Data (Waste Generation)
            let swmsRows = [];
            try {
                const swmsQuery = `SELECT * FROM swms_generations WHERE project_id = $1 AND generation_date >= $2 AND generation_date <= $3`
                const swmsRes = await client.query(swmsQuery, [projectId, startDate, reportDate])
                swmsRows = swmsRes.rows;
            } catch (e) {
                console.warn('SWMS table query failed:', e.message);
            }

            // 5. Issue Tracking (Open Risks/Incidents)
            // Fetch ALL open incidents regardless of date to track ongoing issues
            const openIssuesQuery = `SELECT * FROM sms_incidents WHERE project_id = $1 AND status != 'CLOSED'`
            let openIssuesRes = { rows: [] };
            try {
                openIssuesRes = await client.query(openIssuesQuery, [projectId])
            } catch (e) {
                console.warn('SMS table might not have status column yet', e);
            }

            const aggregatedData = {
                type, // Store report type
                summary: '',
                weather: 'Sunny (Mock)', // Placeholder
                pms: {
                    activeTasks: pmsRes.rows,
                    totalActive: pmsRes.rows.length
                },
                sms: {
                    dris: smsDriRes.rows,
                    incidents: smsIncidentRes.rows,
                    safetyStatus: smsIncidentRes.rows.length > 0 ? 'ACCIDENT' : 'SAFE'
                },
                ems: {
                    deployedCount: emsRes.rows.length,
                    equipmentList: emsRes.rows.map(e => ({ name: e.name, status: e.equipment_status }))
                },
                swms: {
                    generations: swmsRows,
                    totalCount: swmsRows.length
                },
                issues: {
                    openIncidents: openIssuesRes.rows
                }
            }

            aggregatedData.summary = generateStructuredSummary(aggregatedData)
            // --- DATA AGGREGATION END ---

            const insertQuery = `
                INSERT INTO reports (project_id, template_id, title, report_date, status, content, created_by)
                VALUES ($1, $2, $3, $4, 'DRAFT', $5, $6)
                RETURNING *
            `
            const { rows } = await client.query(insertQuery, [
                projectId, templateId, title, reportDate, JSON.stringify(aggregatedData), createdBy
            ])

            await client.query('COMMIT')
            res.status(201).json(rows[0])

        } catch (err) {
            await client.query('ROLLBACK')
            console.error(err)
            res.status(500).json({ error: 'Failed to create report' })
        } finally {
            client.release()
        }
    })

    // 5. Get Report Detail
    router.get('/:id', async (req, res) => {
        try {
            const { id } = req.params
            const { rows } = await pool.query('SELECT * FROM reports WHERE id = $1', [id])
            if (rows.length === 0) return res.status(404).json({ error: 'Report not found' })
            res.json(rows[0])
        } catch (err) {
            console.error(err)
            res.status(500).json({ error: 'Failed to fetch report' })
        }
    })

    // 6. Update Report
    router.put('/:id', async (req, res) => {
        try {
            const { id } = req.params
            const { title, content, status } = req.body

            const query = `
                UPDATE reports 
                SET title = COALESCE($1, title), 
                    content = COALESCE($2, content), 
                    status = COALESCE($3, status),
                    updated_at = CURRENT_TIMESTAMP
                WHERE id = $4
                RETURNING *
            `
            const { rows } = await pool.query(query, [title, JSON.stringify(content), status, id])
            if (rows.length === 0) return res.status(404).json({ error: 'Report not found' })
            res.json(rows[0])
        } catch (err) {
            console.error(err)
            res.status(500).json({ error: 'Failed to update report' })
        }
    })

    // 7. Update Report Status (Approval Workflow)
    router.patch('/:id/status', async (req, res) => {
        try {
            const { id } = req.params
            const { status, comment } = req.body

            // In a real app, we would verify permissions here and log the approval history.
            // For now, we update status and potentially append comment to content.history.

            const query = `
                UPDATE reports 
                SET status = $1, 
                    updated_at = CURRENT_TIMESTAMP
                WHERE id = $2
                RETURNING *
            `
            const { rows } = await pool.query(query, [status, id])

            if (rows.length === 0) return res.status(404).json({ error: 'Report not found' })
            res.json(rows[0])
        } catch (err) {
            console.error('Status update failed:', err)
            res.status(500).json({ error: 'Failed to update status' })
        }
    })

    // 8. Delete Report
    router.delete('/:id', async (req, res) => {
        try {
            const { id } = req.params
            const query = 'DELETE FROM reports WHERE id = $1 RETURNING id'
            const { rows } = await pool.query(query, [id])

            if (rows.length === 0) return res.status(404).json({ error: 'Report not found' })
            res.json({ message: 'Deleted successfully', id })
        } catch (err) {
            console.error('Delete failed:', err)
            res.status(500).json({ error: 'Failed to delete report' })
        }
    })

    return router
}
