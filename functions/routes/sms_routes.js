const express = require('express');
const router = express.Router();

module.exports = (pool) => {

    // ==========================================
    // 1. Checklist Templates API
    // ==========================================

    // Get All Templates
    router.get('/checklist-templates', async (req, res) => {
        try {
            const { rows } = await pool.query('SELECT * FROM sms_checklist_templates ORDER BY id ASC')
            res.json(rows)
        } catch (err) {
            console.error(err)
            res.status(500).json({ error: 'Failed to fetch templates' })
        }
    })

    // Create Template
    router.post('/checklist-templates', async (req, res) => {
        try {
            const { id, title, items, category } = req.body

            let newId = id
            // Auto Generate ID if not provided (TPL-xxx)
            if (!newId) {
                const { rows } = await pool.query("SELECT id FROM sms_checklist_templates WHERE id LIKE 'TPL-%' ORDER BY id DESC LIMIT 1")
                if (rows.length > 0) {
                    const lastId = rows[0].id
                    const numStr = lastId.replace('TPL-', '')
                    const num = parseInt(numStr) + 1
                    newId = `TPL-${String(num).padStart(3, '0')}`
                } else {
                    newId = 'TPL-001'
                }
            }

            const query = `
                INSERT INTO sms_checklist_templates (id, title, items, category, updated_at)
                VALUES ($1, $2, $3, $4, CURRENT_DATE)
                RETURNING *
            `
            const { rows: saved } = await pool.query(query, [newId, title, JSON.stringify(items), category])
            res.status(201).json(saved[0])
        } catch (err) {
            console.error(err)
            res.status(500).json({ error: 'Failed to create template' })
        }
    })

    // Update Template
    router.put('/checklist-templates/:id', async (req, res) => {
        try {
            const { id } = req.params
            const { title, items, category } = req.body
            const query = `
                UPDATE sms_checklist_templates 
                SET title = $1, items = $2, category = $3, updated_at = CURRENT_DATE
                WHERE id = $4
                RETURNING *
            `
            const { rows } = await pool.query(query, [title, JSON.stringify(items), category, id])
            if (rows.length === 0) return res.status(404).json({ error: 'Template not found' })
            res.json(rows[0])
        } catch (err) {
            console.error(err)
            res.status(500).json({ error: 'Failed to update template' })
        }
    })

    // Delete Template
    router.delete('/checklist-templates/:id', async (req, res) => {
        try {
            const { id } = req.params
            await pool.query('DELETE FROM sms_checklist_templates WHERE id = $1', [id])
            res.json({ message: 'Template deleted' })
        } catch (err) {
            console.error(err)
            res.status(500).json({ error: 'Failed to delete template' })
        }
    })

    // ==========================================
    // 2. Checklists Execution API
    // ==========================================

    // Get Checklists List
    router.get('/checklists', async (req, res) => {
        try {
            const { project_id } = req.query;
            let query = 'SELECT * FROM sms_checklists';
            const params = [];
            if (project_id) {
                query += ' WHERE project_id = $1';
                params.push(project_id);
            }
            query += ' ORDER BY created_at DESC';

            const { rows } = await pool.query(query, params);
            res.json(rows);
        } catch (err) {
            console.error(err);
            res.status(500).json({ error: 'Failed to fetch checklists' });
        }
    });

    // Submit Checklist (Immutable Snapshot)
    router.post('/checklists/submit', async (req, res) => {
        const client = await pool.connect();
        try {
            const {
                project_id,
                template_id,
                title,
                results,
                meta_info
            } = req.body;

            // 1. Fetch the Template to include in snapshot (Self-contained)
            const tplRes = await client.query('SELECT * FROM sms_checklist_templates WHERE id = $1', [template_id]);
            const templateSnapshot = tplRes.rows[0] || {};

            // 2. Create Immutable Snapshot Object
            const snapshot = {
                template: templateSnapshot,
                results: results,
                submitted_at: new Date(),
                meta: meta_info
            };

            await client.query('BEGIN');

            const query = `
                INSERT INTO sms_checklists (
                    project_id, template_id, title, 
                    status, results, immutable_snapshot, 
                    created_by, created_at, submitted_at,
                    weather_info, location_info
                )
                VALUES ($1, $2, $3, 'SUBMITTED', $4, $5, $6, NOW(), NOW(), $7, $8)
                RETURNING *
            `;

            const values = [
                project_id,
                template_id,
                title,
                JSON.stringify(results),
                JSON.stringify(snapshot),
                meta_info?.author || 'Unknown',
                JSON.stringify(meta_info?.weather || {}),
                JSON.stringify(meta_info?.location || {})
            ];

            const { rows } = await client.query(query, values);
            await client.query('COMMIT');

            res.status(201).json(rows[0]);

        } catch (err) {
            await client.query('ROLLBACK');
            console.error('[SMS] Submit Error:', err);
            res.status(500).json({ error: 'Failed to submit checklist' });
        } finally {
            client.release();
        }
    });

    // Get Checklist Summary (stub)
    router.get('/checklists/summary', async (req, res) => {
        try {
            const { project_id } = req.query;
            // Basic KPI Aggregation Mock
            const { rows } = await pool.query(`SELECT * FROM sms_checklists WHERE project_id = $1`, [project_id]);
            const total = rows.length;
            const recentIssues = 0;
            const summaryBlock = {
                safety_compliance_rate: total > 0 ? Math.round(((total - recentIssues) / total) * 100) : 100,
                incident_count: { accident: 0, near_miss: 0 },
                checklist_summary: {
                    total: total,
                    conducted: total,
                    failed_items: recentIssues
                },
                major_risks: ["추락 위험", "장비 충돌 위험"],
                open_issues: recentIssues
            };
            res.json(summaryBlock);
        } catch (err) {
            console.error('[SMS] Summary Error:', err);
            res.status(500).json({ error: 'Failed to generate summary' });
        }
    });

    // ==========================================
    // 3. Other SMS APIs (Patrols, Educations, Etc)
    // ==========================================

    // Patrols
    router.get('/patrols', async (req, res) => {
        try {
            const { projectId } = req.query
            let query = `SELECT * FROM sms_patrols`
            const params = []
            if (projectId && projectId !== 'all') {
                query += ` WHERE project_id = $1`
                params.push(projectId)
            }
            query += ` ORDER BY created_at DESC`
            const { rows } = await pool.query(query, params)
            res.json(rows)
        } catch (err) {
            console.error(err)
            res.status(500).json({ error: 'Failed to fetch patrols' })
        }
    })

    router.post('/patrols', async (req, res) => {
        try {
            const { projectId, location, issueType, severity, description, actionRequired } = req.body
            const query = `
                INSERT INTO sms_patrols (
                    project_id, location, issue_type, severity, description, 
                    action_required, status, created_by, created_at
                ) VALUES ($1, $2, $3, $4, $5, $6, 'OPEN', '안전관리자', NOW())
                RETURNING *
            `
            const { rows } = await pool.query(query, [projectId, location, issueType, severity, description, actionRequired])
            res.status(201).json(rows[0])
        } catch (err) {
            console.error(err)
            res.status(500).json({ error: 'Failed to create patrol' })
        }
    })

    // Educations
    router.get('/educations', async (req, res) => {
        try {
            const { projectId } = req.query
            let query = `
                SELECT e.*,
                (SELECT COUNT(*) FROM sms_education_attendees WHERE education_id = e.id) as attendee_count
                FROM sms_educations e
            `
            const params = []
            if (projectId) {
                query += ` WHERE e.project_id = $1`
                params.push(projectId)
            }
            query += ` ORDER BY e.date DESC, e.created_at DESC`
            const { rows } = await pool.query(query, params)
            res.json(rows)
        } catch (err) {
            console.error(err)
            res.status(500).json({ error: 'Failed to fetch educations' })
        }
    })

    router.get('/educations/:id', async (req, res) => {
        try {
            const { id } = req.params
            const eduRes = await pool.query('SELECT * FROM sms_educations WHERE id = $1', [id])
            if (eduRes.rows.length === 0) return res.status(404).json({ error: 'Education not found' })
            const attRes = await pool.query('SELECT * FROM sms_education_attendees WHERE education_id = $1 ORDER BY attended_at ASC', [id])
            res.json({ ...eduRes.rows[0], attendees: attRes.rows })
        } catch (err) {
            console.error(err)
            res.status(500).json({ error: 'Failed to fetch education details' })
        }
    })

    router.post('/educations', async (req, res) => {
        try {
            const { projectId, title, type, instructor, date, place, content } = req.body
            const query = `
                INSERT INTO sms_educations (
                    project_id, title, type, instructor, date, place, content
                ) VALUES ($1, $2, $3, $4, $5, $6, $7)
                RETURNING *
            `
            const { rows } = await pool.query(query, [projectId, title, type, instructor, date, place, content])
            res.status(201).json(rows[0])
        } catch (err) {
            console.error(err)
            res.status(500).json({ error: 'Failed to create education' })
        }
    })

    router.post('/educations/:id/attend', async (req, res) => {
        try {
            const { id } = req.params
            const { attendees } = req.body
            if (!attendees || attendees.length === 0) return res.status(400).json({ error: 'No attendees provided' })

            const client = await pool.connect()
            try {
                await client.query('BEGIN')
                for (const person of attendees) {
                    await client.query(`
                        INSERT INTO sms_education_attendees (education_id, worker_name, worker_birth, signature_url)
                        VALUES ($1, $2, $3, $4)
                    `, [id, person.name, person.birth, person.signature])
                }
                await client.query('COMMIT')
                res.json({ message: 'Attendance recorded successfully' })
            } catch (err) {
                await client.query('ROLLBACK')
                throw err
            } finally {
                client.release()
            }
        } catch (err) {
            console.error(err)
            res.status(500).json({ error: 'Failed to record attendance' })
        }
    })

    // Personnel
    router.get('/personnel', async (req, res) => {
        try {
            const { projectId } = req.query
            let query = `SELECT * FROM sms_personnel`
            const params = []
            if (projectId) {
                query += ` WHERE project_id = $1`
                params.push(projectId)
            }
            query += ` ORDER BY name ASC`
            const { rows } = await pool.query(query, params)
            res.json(rows)
        } catch (err) {
            console.error(err)
            res.status(500).json({ error: 'Failed to fetch personnel' })
        }
    })

    router.post('/personnel', async (req, res) => {
        try {
            const { projectId, name, birthDate, jobType, bloodType, phone, agency } = req.body
            const qrData = JSON.stringify({ n: name, b: birthDate, j: jobType, t: 'W' })
            const query = `
                INSERT INTO sms_personnel (
                    project_id, name, birth_date, job_type, blood_type, phone, agency, qr_code_data
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
                RETURNING *
            `
            const { rows } = await pool.query(query, [projectId, name, birthDate, jobType, bloodType, phone, agency, qrData])
            res.status(201).json(rows[0])
        } catch (err) {
            console.error(err)
            res.status(500).json({ error: 'Failed to register personnel' })
        }
    })

    // Incidents
    router.get('/incidents', async (req, res) => {
        try {
            const { projectId } = req.query
            let query = `
                SELECT i.*, 
                (SELECT photo_url FROM sms_incident_photos WHERE incident_id = i.id LIMIT 1) as thumbnail 
                FROM sms_incidents i
            `
            const params = []
            if (projectId) {
                query += ` WHERE i.project_id = $1`
                params.push(projectId)
            }
            query += ` ORDER BY i.date DESC, i.created_at DESC`
            const { rows } = await pool.query(query, params)
            res.json(rows)
        } catch (err) {
            console.error(err)
            res.status(500).json({ error: 'Failed to fetch incidents' })
        }
    })

    router.post('/incidents', async (req, res) => {
        try {
            const { projectId, type, title, date, time, place, description, photos } = req.body
            const client = await pool.connect()
            try {
                await client.query('BEGIN')
                const insertRes = await client.query(`
                    INSERT INTO sms_incidents (
                        project_id, type, title, date, time, place, description, reporter
                    ) VALUES ($1, $2, $3, $4, $5, $6, $7, '관리자')
                    RETURNING id
                `, [projectId, type, title, date, time, place, description])
                const incidentId = insertRes.rows[0].id

                if (photos && photos.length > 0) {
                    for (const url of photos) {
                        await client.query(`
                            INSERT INTO sms_incident_photos (incident_id, photo_url)
                            VALUES ($1, $2)
                        `, [incidentId, url])
                    }
                }
                await client.query('COMMIT')
                res.status(201).json({ id: incidentId, message: 'Incident reported' })
            } catch (err) {
                await client.query('ROLLBACK')
                throw err
            } finally {
                client.release()
            }
        } catch (err) {
            console.error(err)
            res.status(500).json({ error: 'Failed to report incident' })
        }
    })

    // Documents (SMS Reports)
    router.get('/documents', async (req, res) => {
        try {
            const { projectId } = req.query
            let query = 'SELECT * FROM sms_documents'
            const params = []
            if (projectId) {
                query += ' WHERE project_id = $1'
                params.push(projectId)
            }
            query += ' ORDER BY upload_date DESC'
            const result = await pool.query(query, params)
            res.json(result.rows)
        } catch (err) {
            console.error(err)
            res.status(500).json({ error: 'Failed to fetch documents' })
        }
    })

    router.post('/documents', async (req, res) => {
        try {
            const { projectId, category, title, description, content_summary, file_url, uploaded_by } = req.body
            const fileName = title + '.pdf'
            const fileSize = 1024 * 100
            const result = await pool.query(`
                INSERT INTO sms_documents (
                    project_id, category, title, description, content_summary,
                    file_url, file_name, file_size, uploaded_by
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
                RETURNING *
            `, [projectId, category, title, description, content_summary, file_url, fileName, fileSize, uploaded_by])
            res.json(result.rows[0])
        } catch (err) {
            console.error(err)
            res.status(500).json({ error: 'Failed to create document' })
        }
    })

    return router
}
