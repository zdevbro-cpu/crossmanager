const express = require('express')
const router = express.Router()
const { Pool } = require('pg')
const multer = require('multer')
const path = require('path')
const fs = require('fs')

const pool = new Pool({
    user: process.env.DB_USER,
    host: process.env.DB_HOST,
    database: process.env.DB_NAME,
    password: process.env.DB_PASSWORD,
    port: process.env.DB_PORT || 5432,
    ssl: { rejectUnauthorized: false }
})

// Configure Multer for Documents
const uploadsDir = path.join(__dirname, '../uploads')
if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true })
}

const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, uploadsDir)
    },
    filename: function (req, file, cb) {
        // Safe filename: timestamp-original
        // Fix for Korean filename encoding issue (latin1 to utf8)
        const originalName = Buffer.from(file.originalname, 'latin1').toString('utf8')
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9)
        cb(null, uniqueSuffix + '-' + originalName.replace(/\s+/g, '_'))
    }
})

const upload = multer({
    storage: storage,
    limits: { fileSize: 50 * 1024 * 1024 } // 50MB
})

// ------------------------------------------
// API Routes
// ------------------------------------------

router.use((req, res, next) => {
    console.log('Documents Router Middleware Hit:', req.method, req.url)
    next()
})

// ------------------------------------------
// View Routes (Must be before /:id to ensure precedence if ambiguity exists)
// ------------------------------------------

// 4.5 View Document File (Inline with Clean Name) - Current Version
router.get('/:id/view', async (req, res) => {
    try {
        const { id } = req.params
        console.log(`[View] Request for doc id: ${id}`)

        // Robust Query: Get the latest version's file info
        const query = `
            SELECT v.file_path, d.name
            FROM documents d
            JOIN document_versions v ON d.id = v.document_id
            WHERE d.id = $1
            ORDER BY 
                CASE WHEN d.current_version = v.version THEN 1 ELSE 2 END,
                v.created_at DESC
            LIMIT 1
        `
        const resDb = await pool.query(query, [id])

        if (resDb.rows.length === 0) {
            console.log(`[View] Document not found or no versions: ${id}`)
            return res.status(404).send('Document not found')
        }

        const filePath = resDb.rows[0].file_path
        const docName = resDb.rows[0].name || 'Document'

        if (!filePath) {
            console.log(`[View] File path missing for doc: ${id}`)
            return res.status(404).send('File path missing')
        }

        const fullPath = path.join(__dirname, '../', filePath)
        console.log(`[View] Serving file: ${fullPath}`)

        if (fs.existsSync(fullPath)) {
            const ext = path.extname(fullPath).toLowerCase()
            let safeName = docName.replace(/[^a-zA-Z0-9가-힣\s\-_.]/g, '').trim()
            if (!safeName) safeName = 'document'

            const downloadFilename = `${safeName}${ext}`
            const encodedName = encodeURIComponent(downloadFilename)

            let mimeType = 'application/octet-stream'
            if (ext === '.pdf') mimeType = 'application/pdf'
            else if (ext === '.png') mimeType = 'image/png'
            else if (ext === '.jpg' || ext === '.jpeg') mimeType = 'image/jpeg'

            res.setHeader('Content-Type', mimeType)
            res.setHeader('Content-Disposition', `inline; filename*=UTF-8''${encodedName}`)
            res.sendFile(fullPath)
        } else {
            console.error(`[View] File missing on disk: ${fullPath}`)
            res.status(404).send('File not found on server disk')
        }
    } catch (err) {
        console.error('[View] Error:', err)
        res.status(500).send('Server Error')
    }
})

// 4.6 View Document Version File (Inline with Clean Name)
router.get('/versions/:versionId/view', async (req, res) => {
    try {
        const { versionId } = req.params
        console.log(`[View Version] Request for version id: ${versionId}`)

        const query = `
            SELECT v.file_path, d.name, v.version
            FROM document_versions v
            JOIN documents d ON v.document_id = d.id
            WHERE v.id = $1
        `
        const resDb = await pool.query(query, [versionId])

        if (resDb.rows.length === 0) return res.status(404).send('Version not found')

        const filePath = resDb.rows[0].file_path
        const docName = resDb.rows[0].name || 'Document'
        const version = resDb.rows[0].version

        if (!filePath) return res.status(404).send('File path missing')

        const fullPath = path.join(__dirname, '../', filePath)

        if (fs.existsSync(fullPath)) {
            const ext = path.extname(fullPath).toLowerCase()
            let safeName = docName.replace(/[^a-zA-Z0-9가-힣\s\-_.]/g, '').trim()
            if (!safeName) safeName = 'document'

            const downloadFilename = `${safeName}_${version}${ext}`
            const encodedName = encodeURIComponent(downloadFilename)

            let mimeType = 'application/octet-stream'
            if (ext === '.pdf') mimeType = 'application/pdf'
            else if (ext === '.png') mimeType = 'image/png'
            else if (ext === '.jpg' || ext === '.jpeg') mimeType = 'image/jpeg'

            res.setHeader('Content-Type', mimeType)
            res.setHeader('Content-Disposition', `inline; filename*=UTF-8''${encodedName}`)
            res.sendFile(fullPath)
        } else {
            res.status(404).send('File not found on server disk')
        }
    } catch (err) {
        console.error('[View Version] Error:', err)
        res.status(500).send('Server Error')
    }
})

// 1. Get All Documents (Filter by projectId, category)
router.get('/', async (req, res) => {
    console.log('GET /api/documents hit')
    try {
        const { projectId, category, type, search } = req.query
        let query = `
            SELECT d.*, v.file_path, v.file_size, v.version as latest_version_name 
            FROM documents d
            LEFT JOIN document_versions v ON d.id = v.document_id AND d.current_version = v.version
        `
        let conditions = []
        let params = []

        if (projectId) {
            conditions.push(`d.project_id = $${params.length + 1}`)
            params.push(projectId)
        }
        if (category) {
            conditions.push(`d.category = $${params.length + 1}`)
            params.push(category)
        }
        if (type) {
            conditions.push(`d.type = $${params.length + 1}`)
            params.push(type)
        }
        if (search) {
            conditions.push(`d.name ILIKE $${params.length + 1}`)
            params.push(`%${search}%`)
        }

        if (conditions.length > 0) {
            query += ' WHERE ' + conditions.join(' AND ')
        }

        query += ' ORDER BY d.created_at DESC'

        const { rows } = await pool.query(query, params)
        res.json(rows)
    } catch (err) {
        console.error(err)
        res.status(500).json({ error: 'Failed to fetch documents' })
    }
})

// 2. Upload New Document (First Version)
router.post('/upload', upload.single('file'), async (req, res) => {
    const client = await pool.connect()
    try {
        await client.query('BEGIN')

        const { projectId, category, type, name, status, securityLevel, metadata } = req.body
        const file = req.file

        if (!file) {
            throw new Error('No file uploaded')
        }

        // Fix safe encoding for originalname 
        file.originalname = Buffer.from(file.originalname, 'latin1').toString('utf8')

        // 1. Insert Master
        const masterSql = `
            INSERT INTO documents (
                project_id, category, type, name, status, 
                current_version, security_level, metadata
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
            RETURNING id
        `
        // Defaults
        const docName = name || file.originalname
        const docStatus = status || 'DRAFT'
        const initialVersion = 'v1'
        const secLevel = securityLevel || 'NORMAL'
        const jsonMeta = metadata ? JSON.parse(metadata) : {}

        const { rows: masterRows } = await client.query(masterSql, [
            projectId || null, category, type, docName, docStatus,
            initialVersion, secLevel, JSON.stringify(jsonMeta)
        ])
        const documentId = masterRows[0].id

        // 2. Insert Version
        const versionSql = `
            INSERT INTO document_versions (
                document_id, version, file_path, file_size
            ) VALUES ($1, $2, $3, $4)
        `
        // Store relative path or full URL depending on requirement. 
        // Index.js serves '/uploads', so we store 'uploads/filename' or just filename
        // Let's store relative path for flexibility.
        const filePath = `uploads/${file.filename}`

        await client.query(versionSql, [
            documentId, initialVersion, filePath, file.size
        ])

        await client.query('COMMIT')

        res.status(201).json({
            message: 'Document uploaded successfully',
            documentId,
            version: initialVersion,
            file: file.filename
        })

    } catch (err) {
        await client.query('ROLLBACK')
        console.error(err)
        // clean up file if db failed
        if (req.file && fs.existsSync(req.file.path)) {
            fs.unlinkSync(req.file.path)
        }
        res.status(500).json({ error: 'Failed to upload document', details: err.message })
    } finally {
        client.release()
    }
})

// 3. Upload New Version (v2, v3...)
router.post('/:id/versions', upload.single('file'), async (req, res) => {
    const client = await pool.connect()
    try {
        await client.query('BEGIN')
        const { id } = req.params
        const { changeLog } = req.body
        const file = req.file

        if (!file) {
            throw new Error('No file uploaded')
        }

        // 1. Get current version count to increment
        const countRes = await client.query('SELECT COUNT(*) FROM document_versions WHERE document_id = $1', [id])
        const nextVerNum = parseInt(countRes.rows[0].count) + 1
        const nextVersion = `v${nextVerNum}`

        // 2. Insert New Version
        const filePath = `uploads/${file.filename}`
        await client.query(`
            INSERT INTO document_versions (document_id, version, file_path, file_size, change_log)
            VALUES ($1, $2, $3, $4, $5)
        `, [id, nextVersion, filePath, file.size, changeLog])

        // 3. Update Master Current Version
        await client.query(`
            UPDATE documents SET current_version = $1, updated_at = NOW() WHERE id = $2
        `, [nextVersion, id])

        await client.query('COMMIT')

        res.json({ message: 'New version uploaded', version: nextVersion })

    } catch (err) {
        await client.query('ROLLBACK')
        console.error(err)
        if (req.file) fs.unlinkSync(req.file.path)
        res.status(500).json({ error: 'Failed to upload new version' })
    } finally {
        client.release()
    }
})

// 4. Get Document Details (with Version History)
router.get('/:id', async (req, res) => {
    try {
        const { id } = req.params

        // 1. Get Master Data + Join with Current Version Info
        const query = `
            SELECT d.*, v.file_path, v.file_size
            FROM documents d
            LEFT JOIN document_versions v ON d.id = v.document_id AND d.current_version = v.version
            WHERE d.id = $1
        `
        const docRes = await pool.query(query, [id])

        if (docRes.rows.length === 0) {
            return res.status(404).json({ error: 'Document not found' })
        }
        const doc = docRes.rows[0]

        // 2. Get Versions
        const verRes = await pool.query(`
            SELECT * FROM document_versions 
            WHERE document_id = $1 
            ORDER BY created_at DESC
        `, [id])

        res.json({
            ...doc,
            versions: verRes.rows
        })
    } catch (err) {
        console.error(err)
        res.status(500).json({ error: 'Failed to fetch document details' })
    }
})

// 5. Update Status / Security Level / Name
router.patch('/:id', async (req, res) => {
    try {
        const { id } = req.params
        const { status, securityLevel, name } = req.body

        const updates = []
        const params = [id]

        if (status) {
            updates.push(`status = $${params.length + 1}`)
            params.push(status)
        }
        if (securityLevel) {
            updates.push(`security_level = $${params.length + 1}`)
            params.push(securityLevel)
        }
        if (name) {
            updates.push(`name = $${params.length + 1}`)
            params.push(name)
        }

        if (updates.length > 0) {
            await pool.query(`UPDATE documents SET ${updates.join(', ')} WHERE id = $1`, params)
            res.json({ message: 'Document updated successfully' })
        } else {
            res.json({ message: 'No changes provided' })
        }
    } catch (err) {
        console.error(err)
        res.status(500).json({ error: 'Failed to update document' })
    }
})

// 6. Delete Document
router.delete('/:id', async (req, res) => {
    try {
        // On Delete Cascade will handle versions, but files remain on disk.
        // For MVP, we leave files on disk (safer).
        const { id } = req.params
        await pool.query('DELETE FROM documents WHERE id = $1', [id])
        res.json({ message: 'Document deleted' })
    } catch (err) {
        console.error(err)
        res.status(500).json({ error: 'Failed to delete document' })
    }
})

// 7. Delete Specific Version
router.delete('/:id/versions/:versionId', async (req, res) => {
    const client = await pool.connect()
    try {
        await client.query('BEGIN')
        const { id, versionId } = req.params

        // 1. Get Version Info
        const verRes = await client.query('SELECT * FROM document_versions WHERE id = $1 AND document_id = $2', [versionId, id])
        if (verRes.rows.length === 0) {
            await client.query('ROLLBACK')
            return res.status(404).json({ error: 'Version not found' })
        }
        const targetVer = verRes.rows[0]

        // 2. Delete File from Disk
        const fullPath = path.join(__dirname, '../', targetVer.file_path)
        if (fs.existsSync(fullPath)) {
            try {
                fs.unlinkSync(fullPath)
            } catch (fsErr) {
                console.error('File delete error:', fsErr)
            }
        }

        // 3. Delete from DB
        await client.query('DELETE FROM document_versions WHERE id = $1', [versionId])

        // 4. Update Master if needed
        // Check current master version
        const docRes = await client.query('SELECT current_version FROM documents WHERE id = $1', [id])
        if (docRes.rows.length > 0) {
            const currentVer = docRes.rows[0].current_version
            if (currentVer === targetVer.version) {
                // We deleted the current version, so find the new latest
                const latestRes = await client.query('SELECT version FROM document_versions WHERE document_id = $1 ORDER BY created_at DESC LIMIT 1', [id])
                if (latestRes.rows.length > 0) {
                    const newLatest = latestRes.rows[0].version
                    await client.query('UPDATE documents SET current_version = $1 WHERE id = $2', [newLatest, id])
                } else {
                    // No versions left
                    await client.query("UPDATE documents SET current_version = '-' WHERE id = $1", [id])
                }
            }
        }

        await client.query('COMMIT')
        res.json({ message: 'Version deleted' })

    } catch (err) {
        await client.query('ROLLBACK')
        console.error(err)
        res.status(500).json({ error: 'Failed to delete version' })
    } finally {
        client.release()
    }
})

// 8. Create Empty Folder (Placeholder Document)
router.post('/folder', async (req, res) => {
    const client = await pool.connect()
    try {
        await client.query('BEGIN')
        const { projectId, category } = req.body

        if (!projectId || !category) {
            return res.status(400).json({ error: 'Project ID and Category Name required' })
        }

        // Check if category already exists (optional, but good for cleanliness)
        // Actually, we just want to ensure at least one doc exists.
        // If we create a placeholder, it might show up as a file if we don't filter it out in UI.
        // We will mark it as type='FOLDER' and status='SYSTEM'.

        const query = `
            INSERT INTO documents (
                project_id, category, type, name, status, 
                current_version, security_level
            ) VALUES ($1, $2, 'FOLDER', $2, 'SYSTEM', '-', 'NORMAL')
            RETURNING id
        `
        const { rows } = await client.query(query, [projectId, category])

        await client.query('COMMIT')
        res.status(201).json({ message: 'Folder created', id: rows[0].id })

    } catch (err) {
        await client.query('ROLLBACK')
        console.error(err)
        res.status(500).json({ error: 'Failed to create folder' })
    } finally {
        client.release()
    }
})

// 9. Rename Category
router.patch('/category', async (req, res) => {
    try {
        const { projectId, oldCategory, newCategory } = req.body

        if (!projectId || !oldCategory || !newCategory) {
            return res.status(400).json({ error: 'Missing required fields' })
        }

        const query = `
            UPDATE documents 
            SET category = $1 
            WHERE project_id = $2 AND category = $3
        `
        await pool.query(query, [newCategory, projectId, oldCategory])

        // Also update the placeholder document name if it exists
        await pool.query(`
            UPDATE documents
            SET name = $1
            WHERE project_id = $2 AND category = $1 AND type = 'FOLDER'
        `, [newCategory, projectId])

        res.json({ message: 'Category renamed' })
    } catch (err) {
        console.error(err)
        res.status(500).json({ error: 'Failed to rename category' })
    }
})

// 10. Delete Category
router.delete('/category', async (req, res) => {
    try {
        const { projectId, category } = req.query

        if (!projectId || !category) {
            return res.status(400).json({ error: 'Missing required fields' })
        }

        // Delete all documents in this category
        // Note: Files on disk will remain (MVP limitation as per deletion route)
        const query = `
            DELETE FROM documents 
            WHERE project_id = $1 AND category = $2
        `
        await pool.query(query, [projectId, category])

        res.json({ message: 'Category deleted' })
    } catch (err) {
        console.error(err)
        res.status(500).json({ error: 'Failed to delete category' })
    }
})

module.exports = router
