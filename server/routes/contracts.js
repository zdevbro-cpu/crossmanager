const express = require('express')
const router = express.Router()
const { Pool } = require('pg')
const Busboy = require('busboy')
const path = require('path')
const fs = require('fs')
const admin = require('firebase-admin')
const os = require('os')

// Initialize Firebase Admin if not already initialized
if (!admin.apps.length) {
    try {
        admin.initializeApp()
    } catch (e) {
        console.warn("Firebase Init Error (might lack credentials):", e.message)
    }
}

// Determine bucket name
let bucketName = 'crossmanager-1e21c.firebasestorage.app'
try {
    if (process.env.FIREBASE_CONFIG) {
        const config = JSON.parse(process.env.FIREBASE_CONFIG)
        if (config.storageBucket) bucketName = config.storageBucket
    }
} catch (e) { }

console.log('[Contracts] Using Storage Bucket:', bucketName)

let bucket;
try {
    bucket = admin.storage().bucket(bucketName)
} catch (e) {
    console.warn("[Contracts] Bucket init failed:", e.message)
}

// Uploads directory
const uploadsDir = process.env.UPLOAD_DIR || path.join(os.tmpdir(), 'uploads')
if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true })
}

// DB Connection
const pool = new Pool({
    user: process.env.DB_USER,
    host: process.env.DB_HOST,
    database: process.env.DB_NAME,
    password: process.env.DB_PASSWORD,
    port: process.env.DB_PORT || 5432,
    ssl: { rejectUnauthorized: false }
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

// --- Contracts API ---

// 1. Get All Contracts (Filter by projectId or status)
router.get('/', async (req, res) => {
    try {
        const { projectId, type, status } = req.query
        let query = 'SELECT * FROM contracts'
        let conditions = []
        let params = []

        if (projectId) {
            conditions.push(`project_id = $${params.length + 1}`)
            params.push(projectId)
        }
        if (type) {
            conditions.push(`type = $${params.length + 1}`)
            params.push(type)
        }
        if (status) {
            conditions.push(`status = $${params.length + 1}`)
            params.push(status)
        }

        if (conditions.length > 0) {
            query += ' WHERE ' + conditions.join(' AND ')
        }

        query += ' ORDER BY created_at DESC'

        const { rows } = await pool.query(query, params)

        // Fetch items for each contract
        for (const contract of rows) {
            const itemsRes = await pool.query('SELECT * FROM contract_items WHERE contract_id = $1 ORDER BY created_at ASC', [contract.id])
            contract.items = itemsRes.rows
        }

        res.json(rows)
    } catch (err) {
        console.error(err)
        res.status(500).json({ error: 'Failed to fetch contracts' })
    }
})

// 2. Get Single Contract with Items (Detail View)
router.get('/:id', async (req, res) => {
    try {
        const { id } = req.params

        // Fetch Master
        const contractRes = await pool.query('SELECT * FROM contracts WHERE id = $1', [id])
        if (contractRes.rows.length === 0) {
            return res.status(404).json({ error: 'Contract not found' })
        }
        const contract = contractRes.rows[0]

        // Fetch Items
        const itemsRes = await pool.query('SELECT * FROM contract_items WHERE contract_id = $1 ORDER BY created_at ASC', [id])
        contract.items = itemsRes.rows

        // Generate Signed URL for attachment if exists
        if (contract.attachment_path) {
            if (!contract.attachment_path.startsWith('http') && !contract.attachment_path.startsWith('/') && bucket) {
                try {
                    const [url] = await bucket.file(contract.attachment_path).getSignedUrl({
                        action: 'read',
                        expires: Date.now() + 1000 * 60 * 60, // 1 hour
                    })
                    contract.attachmentUrl = url
                } catch (e) {
                    console.error('[Contracts] Error signing URL:', e)
                }
            } else {
                // Legacy local path support
                contract.attachmentUrl = `/uploads/${path.basename(contract.attachment_path)}`
            }
        }

        res.json(contract)
    } catch (err) {
        console.error(err)
        res.status(500).json({ error: 'Failed to fetch contract details' })
    }
})

// 3. Create Contract (with optional file attachment)
router.post('/', async (req, res) => {
    const client = await pool.connect()
    let uploadedFile = null

    try {
        // Check if this is a multipart request (has file)
        const isMultipart = req.headers['content-type']?.includes('multipart/form-data')

        let fields, file
        if (isMultipart) {
            const upload = await processUpload(req)
            fields = upload.fields
            file = upload.file
            uploadedFile = file
        } else {
            // Regular JSON request
            fields = req.body
        }

        await client.query('BEGIN')

        const {
            projectId, type, category, name,
            totalAmount, costDirect, costIndirect, riskFee, margin,
            indirectRate, riskRate, marginRate,
            regulationConfig, clientManager, ourManager,
            contractDate, startDate, endDate,
            termsPayment, termsPenalty, status, items, attachment
        } = fields

        // Parse JSON fields if they came from multipart
        const parsedItems = typeof items === 'string' ? JSON.parse(items) : items
        const parsedRegulationConfig = typeof regulationConfig === 'string' ? JSON.parse(regulationConfig) : regulationConfig

        // Generate Code
        const dateStr = new Date().toISOString().slice(2, 10).replace(/-/g, '')
        const rand = Math.floor(Math.random() * 1000).toString().padStart(3, '0')
        const code = `${type === 'CONTRACT' ? 'CON' : 'EST'}-${dateStr}-${rand}`

        // Handle file upload to Firebase Storage
        let attachmentPath = null
        let attachmentSize = null
        let attachmentName = null

        if (file) {
            const destination = `contracts/${projectId || 'global'}/${file.filename}`
            let uploadedToCloud = false

            if (bucket) {
                try {
                    await bucket.upload(file.path, {
                        destination: destination,
                        metadata: {
                            contentType: file.mimeType,
                        }
                    })
                    uploadedToCloud = true
                    attachmentPath = destination
                    attachmentSize = file.size
                    attachmentName = file.originalName
                    // Remove temp file
                    try { fs.unlinkSync(file.path) } catch (e) { }
                } catch (e) {
                    console.warn(`[Contracts] Storage Upload Failed: ${e.message}`)
                }
            }

            if (!uploadedToCloud) {
                // Fallback to local storage
                attachmentPath = file.filename
                attachmentSize = file.size
                attachmentName = file.originalName
            }
        }

        const insertMaster = `
            INSERT INTO contracts (
                project_id, code, type, category, name, 
                total_amount, cost_direct, cost_indirect, risk_fee, margin,
                indirect_rate, risk_rate, margin_rate,
                regulation_config, client_manager, our_manager,
                contract_date, start_date, end_date,
                terms_payment, terms_penalty, status, attachment,
                attachment_path, attachment_size, attachment_name
            ) VALUES (
                $1, $2, $3, $4, $5, 
                $6, $7, $8, $9, $10,
                $11, $12, $13,
                $14, $15, $16,
                $17, $18, $19,
                $20, $21, $22, $23,
                $24, $25, $26
            ) RETURNING *
        `

        const masterParams = [
            projectId, code, type, category, name,
            totalAmount || 0, costDirect || 0, costIndirect || 0, riskFee || 0, margin || 0,
            indirectRate || 0, riskRate || 0, marginRate || 0,
            JSON.stringify(parsedRegulationConfig || {}), clientManager, ourManager,
            contractDate, startDate, endDate,
            termsPayment, termsPenalty, status || 'DRAFT',
            attachment ? JSON.stringify(attachment) : null, // Keep for backward compatibility
            attachmentPath, attachmentSize, attachmentName
        ]

        const { rows: masterRows } = await client.query(insertMaster, masterParams)
        const contractId = masterRows[0].id

        // Insert Items if any
        if (parsedItems && Array.isArray(parsedItems) && parsedItems.length > 0) {
            const insertItem = `
                INSERT INTO contract_items (
                    contract_id, group_name, name, spec, 
                    quantity, unit, unit_price, amount, note
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
            `

            for (const item of parsedItems) {
                await client.query(insertItem, [
                    contractId, item.group, item.name, item.spec,
                    item.quantity || 0, item.unit, item.unitPrice || 0, item.amount || 0, item.note
                ])
            }
        }

        await client.query('COMMIT')
        res.status(201).json({ ...masterRows[0], code })
    } catch (err) {
        await client.query('ROLLBACK')
        console.error('[Contracts] Create error:', err)

        // Clean up temp file if exists
        if (uploadedFile && fs.existsSync(uploadedFile.path)) {
            try { fs.unlinkSync(uploadedFile.path) } catch (e) { }
        }

        res.status(500).json({ error: 'Failed to create contract', details: err.message })
    } finally {
        client.release()
    }
})

// 4. Update Contract (with optional file attachment)
router.put('/:id', async (req, res) => {
    const client = await pool.connect()
    let uploadedFile = null

    try {
        const { id } = req.params

        // Check if this is a multipart request (has file)
        const isMultipart = req.headers['content-type']?.includes('multipart/form-data')

        let fields, file
        if (isMultipart) {
            const upload = await processUpload(req)
            fields = upload.fields
            file = upload.file
            uploadedFile = file
        } else {
            fields = req.body
        }

        await client.query('BEGIN')

        const {
            category, name,
            totalAmount, costDirect, costIndirect, riskFee, margin,
            indirectRate, riskRate, marginRate,
            regulationConfig, clientManager, ourManager,
            contractDate, startDate, endDate,
            termsPayment, termsPenalty, status, items, attachment
        } = fields

        // Parse JSON fields if they came from multipart
        const parsedItems = typeof items === 'string' ? JSON.parse(items) : items
        const parsedRegulationConfig = typeof regulationConfig === 'string' ? JSON.parse(regulationConfig) : regulationConfig

        // Handle file upload to Firebase Storage
        let attachmentPath = null
        let attachmentSize = null
        let attachmentName = null

        if (file) {
            // Get project_id for storage path
            const projectRes = await client.query('SELECT project_id FROM contracts WHERE id = $1', [id])
            const projectId = projectRes.rows[0]?.project_id

            const destination = `contracts/${projectId || 'global'}/${file.filename}`
            let uploadedToCloud = false

            if (bucket) {
                try {
                    await bucket.upload(file.path, {
                        destination: destination,
                        metadata: {
                            contentType: file.mimeType,
                        }
                    })
                    uploadedToCloud = true
                    attachmentPath = destination
                    attachmentSize = file.size
                    attachmentName = file.originalName
                    try { fs.unlinkSync(file.path) } catch (e) { }
                } catch (e) {
                    console.warn(`[Contracts] Storage Upload Failed: ${e.message}`)
                }
            }

            if (!uploadedToCloud) {
                attachmentPath = file.filename
                attachmentSize = file.size
                attachmentName = file.originalName
            }
        }

        // Build dynamic update query
        const updateFields = []
        const updateParams = [id]
        let paramIndex = 2

        if (category !== undefined) {
            updateFields.push(`category = $${paramIndex++}`)
            updateParams.push(category)
        }
        if (name !== undefined) {
            updateFields.push(`name = $${paramIndex++}`)
            updateParams.push(name)
        }
        if (totalAmount !== undefined) {
            updateFields.push(`total_amount = $${paramIndex++}`)
            updateParams.push(totalAmount)
        }
        if (costDirect !== undefined) {
            updateFields.push(`cost_direct = $${paramIndex++}`)
            updateParams.push(costDirect)
        }
        if (costIndirect !== undefined) {
            updateFields.push(`cost_indirect = $${paramIndex++}`)
            updateParams.push(costIndirect)
        }
        if (riskFee !== undefined) {
            updateFields.push(`risk_fee = $${paramIndex++}`)
            updateParams.push(riskFee)
        }
        if (margin !== undefined) {
            updateFields.push(`margin = $${paramIndex++}`)
            updateParams.push(margin)
        }
        if (indirectRate !== undefined) {
            updateFields.push(`indirect_rate = $${paramIndex++}`)
            updateParams.push(indirectRate)
        }
        if (riskRate !== undefined) {
            updateFields.push(`risk_rate = $${paramIndex++}`)
            updateParams.push(riskRate)
        }
        if (marginRate !== undefined) {
            updateFields.push(`margin_rate = $${paramIndex++}`)
            updateParams.push(marginRate)
        }
        if (parsedRegulationConfig !== undefined) {
            updateFields.push(`regulation_config = $${paramIndex++}`)
            updateParams.push(JSON.stringify(parsedRegulationConfig))
        }
        if (clientManager !== undefined) {
            updateFields.push(`client_manager = $${paramIndex++}`)
            updateParams.push(clientManager)
        }
        if (ourManager !== undefined) {
            updateFields.push(`our_manager = $${paramIndex++}`)
            updateParams.push(ourManager)
        }
        if (contractDate !== undefined) {
            updateFields.push(`contract_date = $${paramIndex++}`)
            updateParams.push(contractDate)
        }
        if (startDate !== undefined) {
            updateFields.push(`start_date = $${paramIndex++}`)
            updateParams.push(startDate)
        }
        if (endDate !== undefined) {
            updateFields.push(`end_date = $${paramIndex++}`)
            updateParams.push(endDate)
        }
        if (termsPayment !== undefined) {
            updateFields.push(`terms_payment = $${paramIndex++}`)
            updateParams.push(termsPayment)
        }
        if (termsPenalty !== undefined) {
            updateFields.push(`terms_penalty = $${paramIndex++}`)
            updateParams.push(termsPenalty)
        }
        if (status !== undefined) {
            updateFields.push(`status = $${paramIndex++}`)
            updateParams.push(status)
        }
        if (attachment !== undefined) {
            updateFields.push(`attachment = $${paramIndex++}`)
            updateParams.push(attachment ? JSON.stringify(attachment) : null)
        }
        if (attachmentPath !== null) {
            updateFields.push(`attachment_path = $${paramIndex++}`)
            updateParams.push(attachmentPath)
        }
        if (attachmentSize !== null) {
            updateFields.push(`attachment_size = $${paramIndex++}`)
            updateParams.push(attachmentSize)
        }
        if (attachmentName !== null) {
            updateFields.push(`attachment_name = $${paramIndex++}`)
            updateParams.push(attachmentName)
        }

        updateFields.push(`updated_at = CURRENT_TIMESTAMP`)

        const updateMaster = `
            UPDATE contracts SET ${updateFields.join(', ')}
            WHERE id = $1
            RETURNING *
        `

        const { rows: masterRows } = await client.query(updateMaster, updateParams)
        if (masterRows.length === 0) {
            await client.query('ROLLBACK')
            return res.status(404).json({ error: 'Contract not found' })
        }

        // Full Replace Items (Simple Strategy)
        if (parsedItems && Array.isArray(parsedItems)) {
            await client.query('DELETE FROM contract_items WHERE contract_id = $1', [id])

            const insertItem = `
                INSERT INTO contract_items (
                    contract_id, group_name, name, spec, 
                    quantity, unit, unit_price, amount, note
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
            `

            for (const item of parsedItems) {
                await client.query(insertItem, [
                    id, item.group, item.name, item.spec,
                    item.quantity || 0, item.unit, item.unitPrice || 0, item.amount || 0, item.note
                ])
            }
        }

        await client.query('COMMIT')
        res.json(masterRows[0])
    } catch (err) {
        await client.query('ROLLBACK')
        console.error('[Contracts] Update error:', err)

        // Clean up temp file if exists
        if (uploadedFile && fs.existsSync(uploadedFile.path)) {
            try { fs.unlinkSync(uploadedFile.path) } catch (e) { }
        }

        res.status(500).json({ error: 'Failed to update contract', details: err.message })
    } finally {
        client.release()
    }
})

// 5. Delete Contract
router.delete('/:id', async (req, res) => {
    try {
        const { id } = req.params
        await pool.query('DELETE FROM contracts WHERE id = $1', [id])
        res.json({ message: 'Contract deleted' })
    } catch (err) {
        console.error(err)
        res.status(500).json({ error: 'Failed to delete contract' })
    }
})

module.exports = router
