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

    return 'crossmanager-1e21c.appspot.com'
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

            const { projectId, category, type, name, status, securityLevel, metadata } = fields
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
          project_id, category, type, name, status, security_level, current_version, metadata
        ) VALUES ($1, $2, $3, $4, $5, $6, 'v1', $7)
        RETURNING id
      `, [pId, category, type, name, status || 'DRAFT', securityLevel || 'NORMAL', metadata ? JSON.parse(metadata) : null])

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

    // 3. Get All Documents
    router.get('/', async (req, res) => {
        try {
            const { projectId, category, type, search } = req.query
            let query = `
        SELECT d.*, v.file_path, v.file_size, v.version, v.created_at as version_date
        FROM documents d
        LEFT JOIN document_versions v ON d.id = v.document_id AND d.current_version = v.version
      `
            const params = []
            const conditions = []

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

    router.patch('/:id', async (req, res) => {
        const { id } = req.params
        const { status, securityLevel, name } = req.body

        const updates = []
        const params = [id]

        if (status) {
            params.push(status)
            updates.push(`status = $${params.length}`)
        }
        if (securityLevel) {
            params.push(securityLevel)
            updates.push(`security_level = $${params.length}`)
        }
        if (name) {
            params.push(name)
            updates.push(`name = $${params.length}`)
        }

        if (updates.length === 0) return res.json({ message: 'No changes provided' })

        try {
            await pool.query(`UPDATE documents SET ${updates.join(', ')}, updated_at = NOW() WHERE id = $1`, params)
            res.json({ message: 'Document updated successfully' })
        } catch (err) {
            console.error(err)
            res.status(500).json({ error: 'Failed to update document' })
        }
    })

    // 6. Delete Document
    router.delete('/:id', async (req, res) => {
        const client = await pool.connect()
        try {
            await client.query('BEGIN')
            const { id } = req.params

            // Get all file paths associated with this document
            const verRes = await client.query('SELECT file_path FROM document_versions WHERE document_id = $1', [id])

            // Delete files from Firebase Storage
            if (bucket) {
                for (const row of verRes.rows) {
                    if (row.file_path && !row.file_path.startsWith('http') && !row.file_path.startsWith('/')) {
                        try {
                            await bucket.file(row.file_path).delete()
                        } catch (storageErr) {
                            console.warn(`Failed to delete file from Storage:`, storageErr.message)
                        }
                    }
                }
            }

            await client.query('DELETE FROM documents WHERE id = $1', [id])
            await client.query('COMMIT')
            res.json({ message: 'Document deleted' })
        } catch (err) {
            await client.query('ROLLBACK')
            console.error(err)
            res.status(500).json({ error: 'Failed to delete document' })
        } finally {
            client.release()
        }
    })

    // 7. Delete Version
    router.delete('/:id/versions/:versionId', async (req, res) => {
        const client = await pool.connect()
        try {
            await client.query('BEGIN')
            const { id, versionId } = req.params

            const verRes = await client.query('SELECT * FROM document_versions WHERE id = $1 AND document_id = $2', [versionId, id])
            if (verRes.rows.length === 0) {
                await client.query('ROLLBACK')
                return res.status(404).json({ error: 'Version not found' })
            }
            const targetVer = verRes.rows[0]
            const storagePath = targetVer.file_path

            // Delete from Storage
            if (bucket && storagePath && !storagePath.startsWith('http') && !storagePath.startsWith('/')) {
                try { await bucket.file(storagePath).delete() } catch (e) { }
            }

            await client.query('DELETE FROM document_versions WHERE id = $1', [versionId])

            // Update current version logic...
            const docRes = await client.query('SELECT current_version FROM documents WHERE id = $1', [id])
            if (docRes.rows.length > 0) {
                const currentVer = docRes.rows[0].current_version
                if (currentVer === targetVer.version) {
                    const latestRes = await client.query('SELECT version FROM document_versions WHERE document_id = $1 ORDER BY created_at DESC LIMIT 1', [id])
                    if (latestRes.rows.length > 0) {
                        const newLatest = latestRes.rows[0].version
                        await client.query('UPDATE documents SET current_version = $1 WHERE id = $2', [newLatest, id])
                    } else {
                        await client.query("UPDATE documents SET current_version = '-' WHERE id = $1", [id])
                    }
                }
            }

            await client.query('COMMIT')
            res.json({ message: 'Version deleted' })
        } catch (err) {
            await client.query('ROLLBACK')
            console.error('Delete version error:', err)
            res.status(500).json({ error: 'Failed to delete version', details: err.message })
        } finally {
            client.release()
        }
    })

    return router
}

module.exports = { createDocumentsRouter }
