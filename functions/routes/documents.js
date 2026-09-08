const express = require('express')
const Busboy = require('busboy')
const path = require('path')
const fs = require('fs')
const admin = require('firebase-admin')
const { validate: isUuid } = require('uuid')
const gdrive = require('../lib/drive')

// 문서 실물은 드라이브, 링크·메타는 DB (상세설계서 v0.2).
// 기존 Firebase Storage 문서는 다운로드 폴백을 그대로 남긴다.
const HQ_PROJECT_ID = '00000000-0000-0000-0000-000000000001'

// 민감문서 열람·다운로드 기록 (설계서 9.4). 실패해도 본 요청을 막지 않는다.
async function recordAccess(pool, { documentId, action, req }) {
    try {
        await pool.query(
            `INSERT INTO document_access_log (document_id, action, ip, user_agent)
             VALUES ($1, $2, $3, $4)`,
            [documentId, action, req.ip || null, req.headers['user-agent'] || null]
        )
    } catch (e) {
        console.warn('[access_log] 기록 실패:', e.message)
    }
}

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

  return 'crossmanager-482403.appspot.com'
}

// Initialize Firebase Admin if not already initialized
if (!admin.apps.length) {
  admin.initializeApp({ storageBucket: resolveBucketName() })
}

// Determine bucket name from env or fallback
// Note: In Cloud Functions Gen 2, FIREBASE_CONFIG might be present.
let bucketName = resolveBucketName()

// Forcing explicit bucket name to avoid "bucket not found"
console.log('Using Storage Bucket:', bucketName)
let bucket
try {
  bucket = admin.storage().bucket(bucketName)
} catch (e) {
  console.warn('Bucket init failed:', e.message)
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

            // 파일을 메모리에 모은다. 디스크에 쓰고 다시 읽으면 busboy 의 finish 가
      // 쓰기 완료보다 먼저 나서 0바이트 파일을 올리게 된다.
      let fileDone = null

      busboy.on('file', (fieldname, file, info) => {
          const { filename, encoding, mimeType } = info
          fileData = {
              originalName: filename, encoding, mimeType,
              filename: `${Date.now()}-${filename}`, buffer: null, size: 0
          }
          const chunks = []
          fileDone = new Promise((res, rej) => {
              file.on('data', (c) => chunks.push(c))
              file.on('end', () => {
                  fileData.buffer = Buffer.concat(chunks)
                  fileData.size = fileData.buffer.length
                  res()
              })
              file.on('error', rej)
          })
      })

      busboy.on('finish', async () => {
          try {
              if (fileDone) await fileDone
              resolve({ fields, file: fileData })
          } catch (e) { reject(e) }
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
      // 현장이 지정되지 않은 문서는 본사 문서로 둔다.
            const pId = (projectId === 'null' || !projectId) ? HQ_PROJECT_ID : projectId

      // --- 드라이브 업로드 ---
      // 파일 실물은 드라이브에만 둔다. base64 로 DB 에 넣던 폴백은 폐기했다.
      const up = await gdrive.uploadToDrive({
        buffer: file.buffer,
        fileName: file.originalName || file.filename,
        mimeType: file.mimeType
      })
      const driveFileId = up.driveFileId
      const dbFilePath = up.driveFileId

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
          document_id, version, file_path, file_size, change_log, storage_kind, drive_file_id
        ) VALUES ($1, 'v1', $2, $3, 'Initial upload', 'gdrive', $4)
      `, [docId, dbFilePath, file.size, driveFileId])

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

      // --- 드라이브 업로드 ---
      // 파일 실물은 드라이브에만 둔다. base64 로 DB 에 넣던 폴백은 폐기했다.
      const up = await gdrive.uploadToDrive({
        buffer: file.buffer,
        fileName: file.originalName || file.filename,
        mimeType: file.mimeType
      })
      const driveFileId = up.driveFileId
      const dbFilePath = up.driveFileId

      await client.query('BEGIN')

      // Insert version
      await client.query(`
        INSERT INTO document_versions (
          document_id, version, file_path, file_size, change_log, storage_kind, drive_file_id
        ) VALUES ($1, $2, $3, $4, $5, 'gdrive', $6)
      `, [id, nextVer, dbFilePath, file.size, changeLog, driveFileId])

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

      // 논리 삭제된 문서는 제외한다. 현장 문서는 레퍼런스라 물리 삭제하지 않는다.
      conditions.push('d.deleted_at IS NULL')

      if (projectId) {
        // 현장에 매이지 않는 문서(자격증·MSDS 등)는 본사에 1건만 둔다.
        // includeHq=true 면 현장 문서와 본사 문서를 합쳐서 돌려준다.
        if (String(req.query.includeHq) === 'true' && projectId !== HQ_PROJECT_ID) {
          conditions.push(`d.project_id IN ($${params.length + 1}, $${params.length + 2})`)
          params.push(projectId, HQ_PROJECT_ID)
        } else {
          conditions.push(`d.project_id = $${params.length + 1}`)
          params.push(projectId)
        }
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

  // --- Folder Management APIs ---

  // Create Folder (Empty Document with type='FOLDER')
  router.post('/folder', async (req, res) => {
    const { projectId, category } = req.body
    if (!category || !category.trim()) return res.status(400).json({ error: 'Category name required' })

    try {
      // Check if folder already exists
      const existing = await pool.query(`
        SELECT id FROM documents 
        WHERE project_id = $1 AND category = $2 AND type = 'FOLDER'
      `, [projectId, category])

      if (existing.rows.length > 0) {
        return res.json({ message: 'Folder already exists' })
      }

      // Create folder placeholder
      await pool.query(`
        INSERT INTO documents (
          project_id, category, type, name, status, security_level
        ) VALUES ($1, $2, 'FOLDER', $2, 'FOLDER', 'NORMAL')
      `, [projectId, category])

      res.status(201).json({ message: 'Folder created' })

    } catch (err) {
      console.error('Create folder error:', err)
      res.status(500).json({ error: 'Failed to create folder' })
    }
  })

  // Rename Folder (Update category for all docs in it)
  router.patch('/category', async (req, res) => {
    const { projectId, oldCategory, newCategory } = req.body
    if (!oldCategory || !newCategory) return res.status(400).json({ error: 'Both category names required' })

    const client = await pool.connect()
    try {
      await client.query('BEGIN')

      // Update folder placeholder
      await client.query(`
        UPDATE documents 
        SET category = $1, name = $1
        WHERE project_id = $2 AND category = $3 AND type = 'FOLDER'
      `, [newCategory, projectId, oldCategory])

      // Update content documents
      await client.query(`
        UPDATE documents 
        SET category = $1 
        WHERE project_id = $2 AND category = $3
      `, [newCategory, projectId, oldCategory])

      await client.query('COMMIT')
      res.json({ message: 'Category renamed' })
    } catch (err) {
      await client.query('ROLLBACK')
      console.error('Rename category error:', err)
      res.status(500).json({ error: 'Failed to rename category' })
    } finally {
      client.release()
    }
  })

  // Delete Folder (Delete all docs in category)
  router.delete('/category', async (req, res) => {
    const { projectId, category } = req.query
    if (!projectId || !category) return res.status(400).json({ error: 'Project ID and Category required' })

    const client = await pool.connect()
    try {
      await client.query('BEGIN')

      // 1. Find all docs in this category to delete files from storage
      const fileDocsRes = await client.query(`
        SELECT v.file_path 
        FROM documents d
        JOIN document_versions v ON d.id = v.document_id
        WHERE d.project_id = $1 AND d.category = $2
      `, [projectId, category])

      for (const row of fileDocsRes.rows) {
        if (bucket && row.file_path && !row.file_path.startsWith('http') && !row.file_path.startsWith('/')) {
          try { await bucket.file(row.file_path).delete() } catch (e) {
            console.warn(`[Delete Folder] Failed to delete file ${row.file_path}:`, e.message)
          }
        }
      }

      // 2. Explicitly delete versions first (Safety measure)
      await client.query(`
        DELETE FROM document_versions 
        WHERE document_id IN (
            SELECT id FROM documents WHERE project_id = $1 AND category = $2
        )
      `, [projectId, category])

      // 3. Delete all db records (Folder placeholder + actual docs)
      const delRes = await client.query(`
        DELETE FROM documents 
        WHERE project_id = $1 AND category = $2
      `, [projectId, category])

      await client.query('COMMIT')
      res.json({ message: 'Folder deleted', count: delRes.rowCount })
    } catch (err) {
      await client.query('ROLLBACK')
      console.error('Delete folder error:', err)
      res.status(500).json({ error: 'Failed to delete folder', details: err.message, code: err.code })
    } finally {
      client.release()
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
        if (!doc.file_path.startsWith('http') && !doc.file_path.startsWith('/')) {
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
          // Legacy local path support
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
    const { status, securityLevel, name, category, subCategory, type, metadata: metaUpdates } = req.body

    const updates = []
    const params = [id]

    if (status) { params.push(status); updates.push(`status = $${params.length}`) }
    if (securityLevel) { params.push(securityLevel); updates.push(`security_level = $${params.length}`) }
    if (name) { params.push(name); updates.push(`name = $${params.length}`) }
    if (category) { params.push(category); updates.push(`category = $${params.length}`) }
    if (subCategory) { params.push(subCategory); updates.push(`sub_category = $${params.length}`) }
    if (type) { params.push(type); updates.push(`type = $${params.length}`) }

    if (metaUpdates) {
      try {
        const current = await pool.query('SELECT metadata FROM documents WHERE id = $1', [id])
        const newMetadata = { ...(current.rows[0]?.metadata || {}), ...(subCategory ? { folderId: subCategory } : {}), ...metaUpdates }
        params.push(JSON.stringify(newMetadata))
        updates.push(`metadata = $${params.length}`)
      } catch (e) { console.warn('metadata merge error:', e.message) }
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

  // Checkout Document (lock)
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

  // Checkin Document (upload new version + unlock)
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

      // --- 드라이브 업로드 ---
      // 버전마다 별도 파일을 만든다. 드라이브 리비전은 30일 후 자동 삭제된다.
      const up = await gdrive.uploadToDrive({
        buffer: file.buffer,
        fileName: file.originalName || file.filename,
        mimeType: file.mimeType
      })
      const driveFileId = up.driveFileId
      const dbFilePath = up.driveFileId

      await client.query('BEGIN')
      await client.query(`
        INSERT INTO document_versions (document_id, version, file_path, file_size, change_log, storage_kind, drive_file_id)
        VALUES ($1, $2, $3, $4, $5, 'gdrive', $6)
      `, [id, version.trim(), dbFilePath, file.size, changeLog || '', driveFileId])

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

  // Force Unlock
  router.delete('/:id/lock', async (req, res) => {
    const { id } = req.params
    try {
      await pool.query('UPDATE documents SET locked_by = NULL, locked_at = NULL, locked_by_name = NULL WHERE id = $1', [id])
      res.json({ message: 'Unlocked successfully' })
    } catch (err) {
      res.status(500).json({ error: 'Unlock failed' })
    }
  })

  // Get Version History
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

  // 6. Delete Document
  router.delete('/:id', async (req, res) => {
    const client = await pool.connect()
    try {
      await client.query('BEGIN')
      const { id } = req.params

      // 현장 문서는 레퍼런스이므로 물리 삭제하지 않는다(설계서 1.4.2).
      // 레코드는 deleted_at 으로만 감추고, 드라이브 파일은 휴지통으로 보낸다.
      const verRes = await client.query(
        'SELECT drive_file_id FROM document_versions WHERE document_id = $1', [id])
      for (const row of verRes.rows) {
        if (!row.drive_file_id) continue
        try {
          await gdrive.trashInDrive(row.drive_file_id)
        } catch (e) {
          console.warn('[삭제] 드라이브 휴지통 이동 실패:', e.message)
        }
      }

      await client.query(
        'UPDATE documents SET deleted_at = NOW() WHERE id = $1 AND deleted_at IS NULL', [id])
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
      if (storagePath && !storagePath.startsWith('http') && !storagePath.startsWith('/')) {
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

