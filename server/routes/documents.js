const express = require('express')
const Busboy = require('busboy')
const path = require('path')
const fs = require('fs')
const admin = require('firebase-admin')
const { validate: isUuid } = require('uuid')

function resolveBucketName() {
    if (process.env.FIREBASE_STORAGE_BUCKET) return process.env.FIREBASE_STORAGE_BUCKET

    try {
        if (process.env.FIREBASE_CONFIG) {
            const config = JSON.parse(process.env.FIREBASE_CONFIG)
            if (config.storageBucket) {
                const bucket = String(config.storageBucket)
                return bucket.endsWith('.firebasestorage.app')
                    ? bucket.replace(/\.firebasestorage\.app$/, '.appspot.com')
                    : bucket
            }
        }
    } catch (e) { }

    try {
        const serviceAccountPath = path.join(__dirname, '..', 'serviceAccountKey.json')
        if (fs.existsSync(serviceAccountPath)) {
            const serviceAccount = require(serviceAccountPath)
            if (serviceAccount?.project_id) return `${serviceAccount.project_id}.appspot.com`
        }
    } catch (e) { }

    return 'crossmanager-482403.appspot.com'
}

// Initialize Firebase Admin if not already initialized
if (!admin.apps.length) {
    // Try with warning if no credentials
    try {
        const bucketName = resolveBucketName()
        const serviceAccountPath = path.join(__dirname, '..', 'serviceAccountKey.json')

        if (fs.existsSync(serviceAccountPath)) {
            const serviceAccount = require(serviceAccountPath)
            admin.initializeApp({
                credential: admin.credential.cert(serviceAccount),
                storageBucket: bucketName
            })
        } else {
            admin.initializeApp({ storageBucket: bucketName })
        }
    } catch (e) {
        console.warn("Firebase Init Error (might lack credentials):", e.message)
    }
}

// Determine bucket name from env or fallback
// Note: In Cloud Functions Gen 2, FIREBASE_CONFIG might be present.
let bucketName = resolveBucketName()

// Forcing explicit bucket name to avoid "bucket not found"
console.log('Using Storage Bucket:', bucketName)

let bucket;
try {
    bucket = admin.storage().bucket(bucketName)
} catch (e) {
    console.warn("Bucket init failed (likely no creds):", e.message)
}

const createDocumentsRouter = (pool, uploadsDir) => {
    const router = express.Router()

    // Ensure uploads directory exists
    if (!fs.existsSync(uploadsDir)) {
        fs.mkdirSync(uploadsDir, { recursive: true })
    }

    // Migration: add checkout lock columns if not present
    pool.query(`
        ALTER TABLE documents
        ADD COLUMN IF NOT EXISTS locked_by TEXT,
        ADD COLUMN IF NOT EXISTS locked_at TIMESTAMP,
        ADD COLUMN IF NOT EXISTS locked_by_name TEXT
    `).catch(e => console.warn('[Migration] lock columns:', e.message))

    // Request splitting/logging
    router.use((req, _res, next) => {
        // console.log('[documents]', req.method, req.url) // Optional verbose logging
        next()
    })

    // Helper: Process Multipart Upload with Busboy
    const processUpload = (req) => {
        return new Promise((resolve, reject) => {
            const busboy = Busboy({
                headers: req.headers,
                defParamCharset: 'utf8'
            })
            const fields = {}
            let fileData = null

            busboy.on('field', (fieldname, val) => {
                fields[fieldname] = val
            })

            busboy.on('file', (fieldname, file, info) => {
                const { filename, encoding, mimeType } = info

                // With defParamCharset: 'utf8', filename is usually correct.
                // If it still breaks, we might need a conditional check, but standard Fetch + Busboy works with utf8 option.
                const safeFilename = filename

                const saveName = `${Date.now()}-${safeFilename}`
                const savePath = path.join(uploadsDir, saveName)

                fileData = {
                    originalName: safeFilename,
                    encoding,
                    mimeType,
                    filename: saveName,
                    path: savePath,
                    size: 0
                }

                const writeStream = fs.createWriteStream(savePath)
                file.pipe(writeStream)

                writeStream.on('finish', () => {
                    fileData.size = writeStream.bytesWritten
                })
            })

            busboy.on('finish', () => {
                resolve({ fields, file: fileData })
            })

            busboy.on('error', (err) => reject(err))

            if (req.rawBody) {
                busboy.end(req.rawBody)
            } else {
                req.pipe(busboy)
            }
        })
    }

    // 1. Upload New Document
    router.post('/upload', async (req, res) => {
        const client = await pool.connect()
        let uploadedFile = null

        try {
            const { fields, file } = await processUpload(req)
            uploadedFile = file

            if (!file) throw new Error('No file uploaded')

            console.log('Fields:', fields)

            const { projectId, category, subCategory, type, name, status, securityLevel, metadata } = fields
            // Fix projectId "null" string issue
            const pId = (projectId === 'null' || !projectId) ? null : projectId

            // --- Upload to Firebase Storage or Local Fallback ---
            // --- Upload to Firebase Storage or Local Fallback ---
            const destination = `documents/${pId || 'global'}/${file.filename}`
            let dbFilePath = destination
            let uploadedToCloud = false
            let fileContentBase64 = null

            if (bucket) {
                try {
                    await bucket.upload(file.path, {
                        destination: destination,
                        metadata: {
                            contentType: file.mimeType,
                        }
                    })
                    uploadedToCloud = true
                    // Remove temp file only if uploaded to bucket
                    try { fs.unlinkSync(file.path) } catch (e) { }
                } catch (e) {
                    console.warn(`Storage Upload Failed (will keep local file): ${e.message}`)
                }
            }

            if (!uploadedToCloud) {
                // console.warn("Skipping Storage Upload or Failed, keeping file locally.")
                dbFilePath = file.filename
                try {
                    fileContentBase64 = fs.readFileSync(file.path).toString('base64')
                    try { fs.unlinkSync(file.path) } catch (e) { }
                } catch (e) {
                    console.warn('Failed to read local file for DB fallback:', e.message)
                }
            }
            // ----------------------------------
            // ----------------------------------

            await client.query('BEGIN')

            // Insert into documents table
            const docRes = await client.query(`
        INSERT INTO documents (
          project_id, category, sub_category, type, name, status, security_level, current_version, metadata
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, 'v1', $8)
        RETURNING id
      `, [pId, category, subCategory, type, name, status || 'DRAFT', securityLevel || 'NORMAL', metadata ? JSON.parse(metadata) : null])

            const docId = docRes.rows[0].id

            // Insert into document_versions table
            await client.query(`
        INSERT INTO document_versions (
          document_id, version, file_path, file_size, change_log, file_content
        ) VALUES ($1, 'v1', $2, $3, 'Initial upload', $4)
      `, [docId, dbFilePath, file.size, fileContentBase64])

            await client.query('COMMIT')

            res.status(201).json({
                message: 'Document uploaded successfully',
                documentId: docId
            })

        } catch (err) {
            if (client) await client.query('ROLLBACK')
            console.error('Upload document error:', err)

            // Clean up temp file if exists
            if (uploadedFile && fs.existsSync(uploadedFile.path)) {
                try { fs.unlinkSync(uploadedFile.path) } catch (e) { }
            }

            res.status(500).json({
                error: 'Failed to upload document',
                details: err.message,
                stack: err.stack,
                code: err.code
            })
        } finally {
            if (client) client.release()
        }
    })

    // 2. Upload New Version
    router.post('/:id/versions', async (req, res) => {
        const { id } = req.params
        const client = await pool.connect()
        let uploadedFile = null

        try {
            const { fields, file } = await processUpload(req)
            uploadedFile = file

            if (!file) throw new Error('No file uploaded')

            const { changeLog, version: userVersion } = fields

            // Get current version logic...
            const docRes = await client.query('SELECT current_version, project_id FROM documents WHERE id = $1', [id])
            if (docRes.rows.length === 0) {
                throw new Error('Document not found')
            }

            let nextVer = ''
            if (userVersion && userVersion.trim()) {
                nextVer = userVersion.trim()
            } else {
                // Auto-increment fallback
                const currentVer = docRes.rows[0].current_version || 'v0'
                const currentNum = parseInt(currentVer.replace(/[^0-9]/g, '')) || 0
                nextVer = `v${currentNum + 1}`
            }

            // --- Upload to Firebase Storage or Local Fallback ---
            // --- Upload to Firebase Storage or Local Fallback ---
            const destination = `documents/${docRes.rows[0].project_id || 'global'}/${file.filename}`
            let dbFilePath = destination
            let uploadedToCloud = false
            let fileContentBase64 = null

            if (bucket) {
                try {
                    await bucket.upload(file.path, {
                        destination: destination,
                        metadata: {
                            contentType: file.mimeType,
                        }
                    })
                    uploadedToCloud = true
                    try { fs.unlinkSync(file.path) } catch (e) { }
                } catch (e) {
                    console.warn(`Storage Upload Failed (will keep local file): ${e.message}`)
                }
            }

            if (!uploadedToCloud) {
                // Fallback
                dbFilePath = file.filename
                try {
                    fileContentBase64 = fs.readFileSync(file.path).toString('base64')
                    try { fs.unlinkSync(file.path) } catch (e) { }
                } catch (e) {
                    console.warn('Failed to read local file for DB fallback:', e.message)
                }
            }
            // ----------------------------------
            // ----------------------------------

            await client.query('BEGIN')

            // Insert version
            await client.query(`
        INSERT INTO document_versions (
          document_id, version, file_path, file_size, change_log, file_content
        ) VALUES ($1, $2, $3, $4, $5, $6)
      `, [id, nextVer, dbFilePath, file.size, changeLog, fileContentBase64])

            // Update document current_version
            await client.query(`
        UPDATE documents SET current_version = $1, updated_at = NOW() WHERE id = $2
      `, [nextVer, id])

            await client.query('COMMIT')

            res.status(201).json({ message: 'New version uploaded', version: nextVer })

        } catch (err) {
            if (client) await client.query('ROLLBACK')
            console.error('Version upload error:', err)
            if (uploadedFile && fs.existsSync(uploadedFile.path)) {
                try { fs.unlinkSync(uploadedFile.path) } catch (e) { }
            }
            res.status(500).json({ error: 'Failed to upload version', details: err.message })
        } finally {
            if (client) client.release()
        }
    })

    // 3. Get All Documents (Unified Search Supported)
    router.get('/', async (req, res) => {
        try {
            let query = `
                SELECT d.*, v.file_path, v.file_size, v.version, v.created_at as version_date,
                       p.name as project_name
                FROM documents d
                LEFT JOIN document_versions v ON d.id = v.document_id AND d.current_version = v.version
                LEFT JOIN projects p ON d.project_id = p.id
            `
            const params = []
            const conditions = []

            const { 
                projectId, category, subCategory, type, search, 
                client, projectYear, status, officialName, tags, productionDate 
            } = req.query

            if (projectId) {
                conditions.push(`d.project_id = $${params.length + 1}`)
                params.push(projectId)
            }
            if (category) {
                conditions.push(`d.category = $${params.length + 1}`)
                params.push(category)
            }
            if (subCategory) {
                conditions.push(`d.sub_category = $${params.length + 1}`)
                params.push(subCategory)
            }
            if (type) {
                conditions.push(`d.type = $${params.length + 1}`)
                params.push(type)
            }
            if (search) {
                conditions.push(`(d.name ILIKE $${params.length + 1} OR d.metadata->>'officialName' ILIKE $${params.length + 1})`)
                params.push(`%${search}%`)
            }
            /* Temporarily disabled filters due to missing columns in projects table
            if (client) {
                conditions.push(`p.client ILIKE $${params.length + 1}`)
                params.push(`%${client}%`)
            }
            if (projectYear) {
                conditions.push(`EXTRACT(YEAR FROM p.start_date)::text = $${params.length + 1}`)
                params.push(projectYear)
            }
            */
            if (status && status !== '전체') {
                conditions.push(`d.status = $${params.length + 1}`)
                params.push(status)
            }
            if (officialName) {
                conditions.push(`d.metadata->>'officialName' ILIKE $${params.length + 1}`)
                params.push(`%${officialName}%`)
            }
            if (productionDate) {
                conditions.push(`d.metadata->>'productionDate' ILIKE $${params.length + 1}`)
                params.push(`%${productionDate}%`)
            }
            if (tags) {
                conditions.push(`d.metadata->>'tags' ILIKE $${params.length + 1}`)
                params.push(`%${tags}%`)
            }

            if (conditions.length > 0) {
                query += ' WHERE ' + conditions.join(' AND ')
            }

            query += ' ORDER BY d.created_at DESC'

            console.log('[DMS API] Query Params:', req.query)
            const { rows } = await pool.query(query, params)
            console.log(`[DMS API] Found ${rows.length} documents for project: ${projectId}`)
            
            res.json(rows)
        } catch (err) {
            console.error('[DMS API] Error:', err)
            res.status(500).json({ error: 'Failed to fetch documents' })
        }
    })

    // 10. Get Project Categories (must be before /:id to avoid route conflict)
    router.get('/categories', async (req, res) => {
        const { projectId } = req.query
        if (!projectId) return res.status(400).json({ error: 'projectId is required' })
        try {
            const query = `
                SELECT * FROM dms_categories
                WHERE project_id = $1
                ORDER BY parent_category, sequence_no, name
            `
            const { rows } = await pool.query(query, [projectId])
            res.json(rows)
        } catch (err) {
            console.error('Fetch categories error:', err)
            res.status(500).json({ error: 'Failed to fetch categories' })
        }
    })

    // 4. Get Document Detail (with Signed URL)
    router.get('/:id', async (req, res) => {
        try {
            const { id } = req.params
            const query = `
        SELECT d.*, v.file_path, v.file_size, v.version, v.change_log, v.created_at as version_date
        FROM documents d
        LEFT JOIN document_versions v ON d.id = v.document_id AND d.current_version = v.version
        WHERE d.id = $1
      `
            const { rows } = await pool.query(query, [id])
            if (rows.length === 0) return res.status(404).json({ error: 'Document not found' })

            const doc = rows[0]
            const verRes = await pool.query(`
        SELECT * FROM document_versions 
        WHERE document_id = $1 
        ORDER BY created_at DESC
      `, [id])

            // Generate Signed URL for the current version if file_path is available
            if (doc.file_path) {
                // Check if it's a Storage path (doesn't start with http or /)
                if (!doc.file_path.startsWith('http') && !doc.file_path.startsWith('/') && bucket) {
                    try {
                        const [url] = await bucket.file(doc.file_path).getSignedUrl({
                            action: 'read',
                            expires: Date.now() + 1000 * 60 * 60, // 1 hour
                        })
                        doc.downloadUrl = url
                    } catch (e) {
                        console.error('Error signing URL:', e)
                    }
                } else {
                    // Legacy local path support or no bucket
                    doc.downloadUrl = `/uploads/${path.basename(doc.file_path)}`
                }
            }

            res.json({ ...doc, versions: verRes.rows })
        } catch (err) {
            console.error(err)
            res.status(500).json({ error: 'Failed to fetch document' })
        }
    })

    // 5. Update Metadata (Status, Security Level) - NEW
    router.patch('/:id/status', async (req, res) => {
        const { id } = req.params
        const { status } = req.body
        if (!status) return res.status(400).json({ error: 'Status is required' })
        try {
            await pool.query('UPDATE documents SET status = $1, updated_at = NOW() WHERE id = $2', [status, id])
            res.json({ message: 'Status updated' })
        } catch (err) {
            console.error(err)
            res.status(500).json({ error: 'Failed to update status' })
        }
    })

    // 8. Update Document Metadata (Status, Security, Category, SubCategory, Name)
    router.patch('/:id', async (req, res) => {
        const { id } = req.params
        const { status, securityLevel, category, subCategory, folderId, type, name, metadata: metaUpdates } = req.body

        try {
            // Fetch current metadata
            const currentRes = await pool.query('SELECT metadata, category, type, name FROM documents WHERE id = $1', [id])
            if (currentRes.rows.length === 0) {
                return res.status(404).json({ error: 'Document not found' })
            }

            const current = currentRes.rows[0]
            const newMetadata = {
                ...(current.metadata || {}),
                folderId: folderId || subCategory || (current.metadata?.folderId),
                ...(metaUpdates || {})   // Merge any metadata fields from request body
            }

            const updateFields = []
            const values = []
            let idx = 1

            if (status !== undefined) {
                updateFields.push(`status = $${idx++}`)
                values.push(status)
            }
            if (securityLevel !== undefined) {
                updateFields.push(`security_level = $${idx++}`)
                values.push(securityLevel)
            }
            if (category !== undefined) {
                updateFields.push(`category = $${idx++}`)
                values.push(category)
            }
            if (subCategory !== undefined || folderId !== undefined) {
                const targetSub = subCategory || folderId
                updateFields.push(`sub_category = $${idx++}`)
                values.push(targetSub)
                newMetadata.folderId = targetSub
            }
            if (type !== undefined) {
                updateFields.push(`type = $${idx++}`)
                values.push(type)
            }
            if (name !== undefined) {
                updateFields.push(`name = $${idx++}`)
                values.push(name)
            }
            
            updateFields.push(`metadata = $${idx++}`)
            values.push(JSON.stringify(newMetadata))
            
            updateFields.push(`updated_at = NOW()`)

            values.push(id)
            const query = `UPDATE documents SET ${updateFields.join(', ')} WHERE id = $${idx} RETURNING *`
            
            const result = await pool.query(query, values)
            res.json(result.rows[0])
        } catch (err) {
            console.error('Update document error:', err)
            res.status(500).json({ error: 'Failed to update document', details: err.message })
        }
    })

    // 9. Copy Document - NEW
    router.post('/:id/copy', async (req, res) => {
        const { id } = req.params
        const { category, subCategory } = req.body
        const client = await pool.connect()

        try {
            await client.query('BEGIN')

            // Fetch source doc and its current version
            const sourceDocRes = await client.query(`
                SELECT d.*, v.file_path, v.file_size, v.version, v.file_content
                FROM documents d
                JOIN document_versions v ON d.id = v.document_id AND d.current_version = v.version
                WHERE d.id = $1
            `, [id])

            if (sourceDocRes.rows.length === 0) {
                throw new Error('Source document not found')
            }

            const source = sourceDocRes.rows[0]
            const copyName = `${source.name} (Copy)`

            // Insert new document
            const newDocRes = await client.query(`
                INSERT INTO documents (
                    project_id, category, sub_category, type, name, status, security_level, current_version, metadata
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, 'v1', $8)
                RETURNING id
            `, [
                source.project_id,
                category || source.category,
                subCategory || source.sub_category,
                source.type,
                copyName,
                'DRAFT',
                source.security_level,
                source.metadata
            ])

            const newId = newDocRes.rows[0].id

            // Insert new document version pointing to same content/path
            await client.query(`
                INSERT INTO document_versions (
                    document_id, version, file_path, file_size, change_log, file_content
                ) VALUES ($1, 'v1', $2, $3, $4, $5)
            `, [
                newId,
                source.file_path,
                source.file_size,
                `Copy of document ${id}`,
                source.file_content
            ])

            await client.query('COMMIT')
            res.status(201).json({ message: 'Document copied successfully', id: newId })

        } catch (err) {
            await client.query('ROLLBACK')
            console.error('Copy document error:', err)
            res.status(500).json({ error: 'Failed to copy document', details: err.message })
        } finally {
            client.release()
        }
    })

    // 14. Checkout Document (lock)
    router.post('/:id/checkout', async (req, res) => {
        const { id } = req.params
        const { userId, userName } = req.body
        try {
            const docRes = await pool.query('SELECT locked_by, locked_by_name FROM documents WHERE id = $1', [id])
            if (!docRes.rows.length) return res.status(404).json({ error: 'Document not found' })
            const doc = docRes.rows[0]
            if (doc.locked_by && doc.locked_by !== (userId || 'system')) {
                return res.status(409).json({ error: `이미 "${doc.locked_by_name || doc.locked_by}"님이 체크아웃 중입니다.` })
            }
            await pool.query(
                'UPDATE documents SET locked_by = $1, locked_at = NOW(), locked_by_name = $2, updated_at = NOW() WHERE id = $3',
                [userId || 'system', userName || '담당자', id]
            )
            res.json({ message: 'Checked out successfully' })
        } catch (err) {
            console.error('Checkout error:', err)
            res.status(500).json({ error: 'Checkout failed', details: err.message })
        }
    })

    // 15. Checkin Document (upload new version + unlock)
    router.post('/:id/checkin', async (req, res) => {
        const { id } = req.params
        const client = await pool.connect()
        let uploadedFile = null
        try {
            const { fields, file } = await processUpload(req)
            uploadedFile = file
            const { version, status, changeLog } = fields
            if (!file) throw new Error('파일을 첨부해주세요.')
            if (!version || !version.trim()) throw new Error('버전 번호를 입력해주세요.')

            const docRes = await client.query('SELECT project_id FROM documents WHERE id = $1', [id])
            if (!docRes.rows.length) throw new Error('Document not found')

            // Upload file
            const destination = `documents/${docRes.rows[0].project_id || 'global'}/${file.filename}`
            let dbFilePath = destination
            let uploadedToCloud = false
            let fileContentBase64 = null

            if (bucket) {
                try {
                    await bucket.upload(file.path, { destination, metadata: { contentType: file.mimeType } })
                    uploadedToCloud = true
                    try { fs.unlinkSync(file.path) } catch (e) { }
                } catch (e) {
                    console.warn('Storage upload failed:', e.message)
                }
            }
            if (!uploadedToCloud) {
                dbFilePath = file.filename
                try {
                    fileContentBase64 = fs.readFileSync(file.path).toString('base64')
                    try { fs.unlinkSync(file.path) } catch (e) { }
                } catch (e) { }
            }

            await client.query('BEGIN')
            await client.query(`
                INSERT INTO document_versions (document_id, version, file_path, file_size, change_log, file_content)
                VALUES ($1, $2, $3, $4, $5, $6)
            `, [id, version.trim(), dbFilePath, file.size, changeLog || '', fileContentBase64])

            await client.query(`
                UPDATE documents SET
                    current_version = $1,
                    status = $2,
                    locked_by = NULL,
                    locked_at = NULL,
                    locked_by_name = NULL,
                    updated_at = NOW()
                WHERE id = $3
            `, [version.trim(), status || 'DRAFT', id])

            await client.query('COMMIT')
            res.json({ message: 'Checked in successfully', version: version.trim() })
        } catch (err) {
            await client.query('ROLLBACK')
            if (uploadedFile && fs.existsSync(uploadedFile.path)) {
                try { fs.unlinkSync(uploadedFile.path) } catch (e) { }
            }
            console.error('Checkin error:', err)
            res.status(500).json({ error: err.message || 'Checkin failed' })
        } finally {
            client.release()
        }
    })

    // 16. Force Unlock
    router.delete('/:id/lock', async (req, res) => {
        const { id } = req.params
        try {
            await pool.query('UPDATE documents SET locked_by = NULL, locked_at = NULL, locked_by_name = NULL WHERE id = $1', [id])
            res.json({ message: 'Unlocked successfully' })
        } catch (err) {
            res.status(500).json({ error: 'Unlock failed' })
        }
    })

    // 17. Get Version History
    router.get('/:id/versions', async (req, res) => {
        const { id } = req.params
        try {
            const { rows } = await pool.query(
                'SELECT id, version, file_path, file_size, change_log, created_at FROM document_versions WHERE document_id = $1 ORDER BY created_at DESC',
                [id]
            )
            res.json(rows)
        } catch (err) {
            res.status(500).json({ error: 'Failed to fetch version history' })
        }
    })

    // 11. Create Project Category - NEW (Auto-numbering logic corrected)
    router.post('/categories', async (req, res) => {
        const { projectId, parentCategory, name } = req.body
        if (!projectId || !parentCategory || !name) {
            return res.status(400).json({ error: 'projectId, parentCategory, and name are required' })
        }

        // 표준 공종 갯수 정의 (ID 기준 마지막 번호)
        const STANDARD_COUNTS = {
            '00_공무_행정': 5,
            '01_안전_보건': 7,
            '02_공사_작업': 5,
            '03_장비_공도구': 3,
            '04_기록_자료': 4,
            '05_기타': 0
        }

        try {
            // 1. 해당 카테고리의 표준 번호 가져오기
            const baseSeq = STANDARD_COUNTS[parentCategory] || 0

            // 2. DB에 이미 추가된 커스텀 공종 중 최대 연번 확인
            const seqRes = await pool.query(
                'SELECT COALESCE(MAX(sequence_no), 0) as max_seq FROM dms_categories WHERE project_id = $1 AND parent_category = $2',
                [projectId, parentCategory]
            )
            const dbMaxSeq = parseInt(seqRes.rows[0].max_seq)

            // 3. 최종 다음 연번 결정 (표준 또는 DB 최대값 중 큰 것 + 1)
            const nextSeq = Math.max(baseSeq, dbMaxSeq) + 1
            const seqStr = String(nextSeq).padStart(2, '0')
            
            // 명칭에 이미 연번이 포함되어 있지 않다면 자동 접두어(06_...) 적용
            let finalName = name
            if (!name.match(/^\d{2}_/)) {
                finalName = `${seqStr}_${name}`
            }

            const insertRes = await pool.query(
                'INSERT INTO dms_categories (project_id, parent_category, name, sequence_no) VALUES ($1, $2, $3, $4) RETURNING *',
                [projectId, parentCategory, finalName, nextSeq]
            )
            res.status(201).json(insertRes.rows[0])
        } catch (err) {
            console.error('Create category error:', err)
            res.status(500).json({ error: 'Failed to create category' })
        }
    })

    // 13. Delete Category (Custom Sub-folder)
    router.delete('/categories/:id', async (req, res) => {
        const { id } = req.params
        try {
            await pool.query('DELETE FROM dms_categories WHERE id = $1', [id])
            res.json({ message: 'Category deleted successfully' })
        } catch (err) {
            console.error('Delete category error:', err)
            res.status(500).json({ error: 'Failed to delete category' })
        }
    })

    // 12. Delete Document - NEW
    router.delete('/:id', async (req, res) => {
        const { id } = req.params
        const client = await pool.connect()
        try {
            await client.query('BEGIN')
            // Versions must be deleted first due to FK
            await client.query('DELETE FROM document_versions WHERE document_id = $1', [id])
            await client.query('DELETE FROM documents WHERE id = $1', [id])
            await client.query('COMMIT')
            res.json({ message: 'Document deleted successfully' })
        } catch (err) {
            await client.query('ROLLBACK')
            console.error('Delete document error:', err)
            res.status(500).json({ error: 'Failed to delete document' })
        } finally {
            client.release()
        }
    })

    return router
}

module.exports = { createDocumentsRouter }

