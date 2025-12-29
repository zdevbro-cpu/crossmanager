// FORCE DEPLOY: Update 2025-12-28 15:15
const express = require('express')
const cors = require('cors')
const multer = require('multer')
const path = require('path')
const fs = require('fs')
const os = require('os')
// Priority Load: Customer Env -> Default Env
const customerEnvPath = path.join(__dirname, 'env_customer.env')
if (fs.existsSync(customerEnvPath)) {
    require('dotenv').config({ path: customerEnvPath })
    console.log('[Config] Loaded env_customer.env')
} else {
    require('dotenv').config({ path: path.join(__dirname, '.env') })
    console.log('[Config] Loaded default .env')
}
const { Pool } = require('pg')
const { createDocumentsRouter } = require('./routes/documents')

const app = express()
app.use(cors({ origin: true }))
const PORT = process.env.PORT || 3000

// Ensure uploads directory exists (use /tmp on Cloud Run/Functions which is writable)
const uploadsDir = process.env.UPLOAD_DIR || path.join(os.tmpdir(), 'uploads')
if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true })
}

// Configure multer for file uploads
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, uploadsDir)
    },
    filename: function (req, file, cb) {
        // Generate unique filename: timestamp-originalname
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9)
        cb(null, uniqueSuffix + '-' + file.originalname)
    }
})

const upload = multer({
    storage: storage,
    limits: { fileSize: 10 * 1024 * 1024 } // 10MB limit
})

function normalizeBucketName(value) {
    const bucket = String(value || '')
    return bucket.endsWith('.firebasestorage.app')
        ? bucket.replace(/\.firebasestorage\.app$/, '.appspot.com')
        : bucket
}

function resolveBucketName() {
    if (process.env.FIREBASE_STORAGE_BUCKET) return process.env.FIREBASE_STORAGE_BUCKET
    try {
        if (process.env.FIREBASE_CONFIG) {
            const config = JSON.parse(process.env.FIREBASE_CONFIG)
            if (config.storageBucket) return normalizeBucketName(config.storageBucket)
        }
    } catch (e) { }
    return 'crossmanager-482403.appspot.com'
}

// Utility helpers
const todayStr = () => new Date().toISOString().split('T')[0]
function generateInboundDocNo(docDate) {
    const d = new Date(docDate || Date.now())
    const y = d.getFullYear()
    const m = `${(d.getMonth() + 1)}`.padStart(2, '0')
    const day = `${d.getDate()}`.padStart(2, '0')
    const rand = Math.floor(Math.random() * 9000 + 1000)
    return `IN-${y}${m}${day}-${rand}`
}

async function applyInventoryDelta(client, projectId, warehouseId, lines, multiplier) {
    for (const line of lines) {
        const { material_type_id, material_name, lot_no, weight, unit, hazardous } = line
        const delta = Number(weight || 0) * multiplier
        if (delta === 0) continue
        await client.query(
            `
            INSERT INTO swms_inventory_snapshots (
                project_id, warehouse_id, material_type_id, material_name, lot_no,
                on_hand_weight, on_hand_qty, unit, hazardous, first_inbound_date, last_movement_date
            )
            VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
            ON CONFLICT (project_id, warehouse_id, material_type_id, lot_no) DO UPDATE SET
                on_hand_weight = GREATEST(0, swms_inventory_snapshots.on_hand_weight + EXCLUDED.on_hand_weight),
                last_movement_date = CURRENT_DATE,
                unit = EXCLUDED.unit,
                hazardous = EXCLUDED.hazardous
            `,
            [
                projectId,
                warehouseId,
                material_type_id,
                material_name,
                lot_no,
                delta,
                null,
                unit || '��',
                !!hazardous,
                todayStr(),
                todayStr()
            ]
        )
    }
}

const dbConfig = {
    user: process.env.DB_USER,
    database: process.env.DB_NAME,
    password: process.env.DB_PASSWORD,
}

// Connection preference:
// 1) Cloud SQL Unix socket on GCP or when USE_CLOUD_SQL_SOCKET=true
// 2) TCP(DB_HOST) locally or when FORCE_TCP=true
const runningOnGcp = !!(process.env.K_SERVICE || process.env.FUNCTION_TARGET)
// Fix: Prioritize Socket on GCP regardless of FORCE_TCP (which is for local dev)
const preferSocket = runningOnGcp || (process.env.FORCE_TCP !== 'true' && process.env.USE_CLOUD_SQL_SOCKET === 'true')
const instance = process.env.INSTANCE_CONNECTION_NAME || 'crossmanager-482403:asia-northeast3:crossmanager'

if (preferSocket && instance) {
    dbConfig.host = `/cloudsql/${instance}`
} else if (process.env.DB_HOST) {
    dbConfig.host = process.env.DB_HOST
    dbConfig.port = process.env.DB_PORT || 5432
    dbConfig.ssl = { rejectUnauthorized: false }
} else {
    dbConfig.host = 'localhost'
    dbConfig.port = 5432
    dbConfig.ssl = { rejectUnauthorized: false }
}

const pool = new Pool(dbConfig)

// Ensure schema exists for older/local DBs (prevents docview failures)
async function ensureDocumentSchema() {
    try {
        await pool.query('ALTER TABLE document_versions ADD COLUMN IF NOT EXISTS file_content TEXT')
        console.log('[Schema] document_versions.file_content OK')
    } catch (e) {
        console.warn('[Schema] document_versions.file_content check failed:', e.message)
    }
}

// Fire-and-forget: do not block server start
ensureDocumentSchema()

async function ensureContractsSchema() {
    try {
        await pool.query('ALTER TABLE contracts ADD COLUMN IF NOT EXISTS attachment_path TEXT')
        await pool.query('ALTER TABLE contracts ADD COLUMN IF NOT EXISTS attachment_size BIGINT')
        await pool.query('ALTER TABLE contracts ADD COLUMN IF NOT EXISTS attachment_name TEXT')
        await pool.query('ALTER TABLE contracts ADD COLUMN IF NOT EXISTS attachment_content TEXT')
        await pool.query('ALTER TABLE contracts ADD COLUMN IF NOT EXISTS attachment_mime_type TEXT')
        console.log('[Schema] contracts attachments OK')
    } catch (e) {
        console.warn('[Schema] contracts schema check failed:', e.message)
    }
}

ensureContractsSchema()

// --- Added File Retrieval Routes (Ported from server/index.js) ---
// 1. View Document File (Inline with Clean Name)
app.get(['/api/docview/:id/:filename', '/api/docview/:id'], async (req, res) => {
    try {
        const { id } = req.params
        console.log(`[App.js View] Request for doc id: ${id}`)

        // Robust Query: Get the latest version's file info
        const query = `
            SELECT v.file_path, v.file_content, d.name
            FROM documents d
            JOIN document_versions v ON d.id = v.document_id
            WHERE d.id = $1
            ORDER BY 
                CASE WHEN d.current_version = v.version THEN 1 ELSE 2 END,
                v.created_at DESC
            LIMIT 1
        `
        let resDb
        try {
            resDb = await pool.query(query, [id])
        } catch (e) {
            // Backward-compatible fallback when DB is missing document_versions.file_content
            if (String(e?.message || '').includes('file_content')) {
                const fallbackQuery = `
                    SELECT v.file_path, NULL as file_content, d.name
                    FROM documents d
                    JOIN document_versions v ON d.id = v.document_id
                    WHERE d.id = $1
                    ORDER BY 
                        CASE WHEN d.current_version = v.version THEN 1 ELSE 2 END,
                        v.created_at DESC
                    LIMIT 1
                `
                resDb = await pool.query(fallbackQuery, [id])
            } else {
                throw e
            }
        }

        if (resDb.rows.length === 0) {
            console.log(`[App.js View] Document not found or no versions: ${id}`)
            return res.status(404).send('Document not found')
        }

        const row = resDb.rows[0];
        const filePath = row.file_path
        const fileContent = row.file_content
        const docName = row.name || 'Document'

        let mimeType = 'application/octet-stream'
        const ext = path.extname(filePath || docName).toLowerCase()
        if (ext === '.pdf') mimeType = 'application/pdf'
        else if (ext === '.png') mimeType = 'image/png'
        else if (ext === '.jpg' || ext === '.jpeg') mimeType = 'image/jpeg'

        // Safe filename for header
        let safeName = docName.replace(/[^a-zA-Z0-9��-�R\s\-_.]/g, '').trim()
        if (!safeName) safeName = 'document'
        const downloadFilename = `${safeName}${ext}`
        const encodedName = encodeURIComponent(downloadFilename)

        res.setHeader('Content-Type', mimeType)
        res.setHeader('Content-Disposition', `inline; filename*=UTF-8''${encodedName}`)

        // 1. Try DB Content (Base64) - Persistent Legacy
        if (fileContent) {
            const buffer = Buffer.from(fileContent, 'base64')
            console.log(`[View] Serving from DB: ${buffer.length} bytes`)
            return res.send(buffer)
        }

        // 2. Try Local Disk (Fallback or Legacy Local)
        let fullPath = filePath ? path.join(__dirname, 'uploads', path.basename(filePath)) : null

        // If file_path is like "documents/...", it might be GCS. 
        // If file_path is simple filename, it's local.
        if (filePath && !filePath.includes('/')) {
            fullPath = path.join(uploadsDir, filePath)
        }

        if (fullPath && fs.existsSync(fullPath)) {
            console.log(`[View] Serving file from disk: ${fullPath}`)
            return res.sendFile(fullPath)
        }

        // 3. Try Firebase Bucket (New Standard)
        const admin = require('firebase-admin')

        // Initialize if not already
        if (!admin.apps.length) {
            // Note: In Cloud Functions, default creds usually work. 
            // We blindly try default if we don't have key file logic here.
            admin.initializeApp()
        }

        // Determine bucket name (Logic matches routes/documents.js)
        let bucketName = process.env.FIREBASE_STORAGE_BUCKET || 'crossmanager-482403.appspot.com'
        try {
            if (process.env.FIREBASE_CONFIG) {
                const config = JSON.parse(process.env.FIREBASE_CONFIG)
                if (config.storageBucket) {
                    const b = String(config.storageBucket)
                    bucketName = b.endsWith('.firebasestorage.app') ? b.replace(/\.firebasestorage\.app$/, '.appspot.com') : b
                }
            }
        } catch (e) { }

        try {
            const bucket = admin.storage().bucket(bucketName)
            if (filePath && bucket) {
                const file = bucket.file(filePath)
                const [exists] = await file.exists()
                if (exists) {
                    console.log(`[View] Streaming from Bucket: ${filePath}`)
                    // Create read stream and pipe to res
                    return file.createReadStream().pipe(res)
                }
            }
        } catch (e) {
            console.warn("[View] Bucket stream failed:", e.message)
        }

        console.error(`[View] File missing on disk and cloud: ${filePath}`)
        res.status(404).send('File not found (Server Storage)')

    } catch (err) {
        console.error('[View] Error:', err)
        res.status(500).send('Internal Server Error')
    }
})

// 2. View Document Version File (Inline with Clean Name)
app.get(['/api/docview/versions/:versionId/:filename', '/api/docview/versions/:versionId'], async (req, res) => {
    try {
        const { versionId } = req.params
        console.log(`[App.js View Version] Request for version id: ${versionId}`)

        const query = `
            SELECT v.file_path, v.file_content, d.name, v.version
            FROM document_versions v
            JOIN documents d ON v.document_id = d.id
            WHERE v.id = $1
        `
        let resDb
        try {
            resDb = await pool.query(query, [versionId])
        } catch (e) {
            // Backward-compatible fallback when DB is missing document_versions.file_content
            if (String(e?.message || '').includes('file_content')) {
                const fallbackQuery = `
                    SELECT v.file_path, NULL as file_content, d.name, v.version
                    FROM document_versions v
                    JOIN documents d ON v.document_id = d.id
                    WHERE v.id = $1
                `
                resDb = await pool.query(fallbackQuery, [versionId])
            } else {
                throw e
            }
        }

        if (resDb.rows.length === 0) return res.status(404).send('Version not found')

        const row = resDb.rows[0];
        const filePath = row.file_path
        const fileContent = row.file_content
        const docName = row.name || 'Document'
        const version = row.version

        let mimeType = 'application/octet-stream'
        const ext = path.extname(filePath || docName).toLowerCase()
        if (ext === '.pdf') mimeType = 'application/pdf'
        else if (ext === '.png') mimeType = 'image/png'
        else if (ext === '.jpg' || ext === '.jpeg') mimeType = 'image/jpeg'

        let safeName = docName.replace(/[^a-zA-Z0-9��-�R\s\-_.]/g, '').trim()
        if (!safeName) safeName = 'document'
        const requestedFilename = req.params.filename ? decodeURIComponent(req.params.filename) : null
        const defaultFilename = `${safeName}_${version}${ext}`
        const finalFilename = requestedFilename || defaultFilename
        const encodedName = encodeURIComponent(finalFilename)

        res.setHeader('Content-Type', mimeType)
        res.setHeader('Content-Disposition', `inline; filename*=UTF-8''${encodedName}`)

        // 1. Try DB Content (Base64)
        if (fileContent) {
            const buffer = Buffer.from(fileContent, 'base64')
            console.log(`[View Version] Serving from DB: ${buffer.length} bytes`)
            return res.send(buffer)
        }

        // 2. Fallback to Disk
        if (!filePath) return res.status(404).send('File path missing')

        let safeFullPath = path.join(uploadsDir, path.basename(filePath))

        // 3. Bucket logic for versions (missing in server/index.js but needed?)
        // The original server/index.js didn't have Bucket logic in ViewVersion? 
        // Let's add it for robustness, similar to View Doc.

        // If file_path is like "documents/...", it might be GCS. 
        if (filePath.includes('/')) {
            const admin = require('firebase-admin')
            if (!admin.apps.length) admin.initializeApp()
            let bucketName = process.env.FIREBASE_STORAGE_BUCKET || 'crossmanager-482403.appspot.com'
            try {
                if (process.env.FIREBASE_CONFIG) {
                    const config = JSON.parse(process.env.FIREBASE_CONFIG)
                    if (config.storageBucket) {
                        const b = String(config.storageBucket)
                        bucketName = b.endsWith('.firebasestorage.app') ? b.replace(/\.firebasestorage\.app$/, '.appspot.com') : b
                    }
                }
            } catch (e) { }

            try {
                const bucket = admin.storage().bucket(bucketName)
                const file = bucket.file(filePath)
                const [exists] = await file.exists()
                if (exists) {
                    return file.createReadStream().pipe(res)
                }
            } catch (e) { }
        } else {
            // Local Check
            if (fs.existsSync(safeFullPath)) {
                return res.sendFile(safeFullPath)
            }
        }

        res.status(404).send('File not found on server disk or cloud')

    } catch (err) {
        console.error('[View Version] Error:', err)
        res.status(500).send('Server Error')
    }
})

// Documents Router MUST be mounted BEFORE body parsers (json/urlencoded)
// so that Multer can handle multipart/form-data streams first.
const documentsRouter = createDocumentsRouter(pool, uploadsDir)
app.use('/api/documents', documentsRouter)

// SMS Standards API
try {
    app.use('/api/sms', require('./routes/sms_standards')(pool))
} catch (e) {
    console.warn('[App] Failed to load SMS Standards route:', e.message)
}

app.use(express.json({ limit: '50mb' }))
app.use(express.urlencoded({ extended: true, limit: '50mb' }))
// Serve uploaded files statically
app.use('/uploads', express.static(uploadsDir))

app.get('/api/test', (req, res) => {
    res.json({ ok: true })
})

pool.connect((err) => {
    if (err) {
        console.error('Database connection error', err.stack)
    } else {
        console.log('Database connected successfully');

        // Initialize DB Tables (Async)
        (async () => {
            try {
                // 0. Init Projects Table
                await pool.query(`
                        CREATE TABLE IF NOT EXISTS projects (
                            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                            code VARCHAR(50) UNIQUE NOT NULL,
                            name VARCHAR(255) NOT NULL,
                            client VARCHAR(100),
                            address TEXT,
                            start_date DATE,
                            end_date DATE,
                            description TEXT,
                            security_level VARCHAR(20) DEFAULT '�Ϲ�',
                            pm_name VARCHAR(100),
                            regulation_type VARCHAR(20),
                            status VARCHAR(20) DEFAULT 'RUNNING',
                            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                        )
                    `)

                // Seed Projects if empty
                const { rows: pCount } = await pool.query('SELECT count(*) FROM projects')
                if (parseInt(pCount[0].count) === 0) {
                    await pool.query(`
                            INSERT INTO projects (code, name, client, address, status, regulation_type)
                            VALUES 
                            ('PJ-2024-001', '���� P3 ���� ��ü ����', '�Ｚ����', '��⵵ ���ý�', 'RUNNING', 'SAMSUNG'),
                            ('PJ-2024-002', '���� LGD ���� ö��', 'LG���÷���', '��⵵ ���ֽ�', 'PREPARING', 'LG')
                        `)
                    console.log('Sample projects seeded.')
                }

                // 1. Reset Contracts Tables (Force Schema Update)
                // await pool.query('DROP TABLE IF EXISTS contract_items CASCADE')
                // await pool.query('DROP TABLE IF EXISTS contracts CASCADE')

                await pool.query(`
                        CREATE TABLE IF NOT EXISTS contracts (
                            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                            project_id UUID,
                            code VARCHAR(50) UNIQUE,
                            type VARCHAR(20),
                            category VARCHAR(20),
                            name VARCHAR(255),
                            total_amount DECIMAL(15, 2) DEFAULT 0,
                            cost_direct DECIMAL(15, 2) DEFAULT 0,
                            cost_indirect DECIMAL(15, 2) DEFAULT 0,
                            risk_fee DECIMAL(15, 2) DEFAULT 0,
                            margin DECIMAL(15, 2) DEFAULT 0,
                            indirect_rate DECIMAL(5, 2) DEFAULT 0,
                            risk_rate DECIMAL(5, 2) DEFAULT 0,
                            margin_rate DECIMAL(5, 2) DEFAULT 0,
                            attachment JSONB,
                            regulation_config JSONB,
                            client_manager VARCHAR(100),
                            our_manager VARCHAR(100),
                            contract_date DATE,
                            start_date DATE,
                            end_date DATE,
                            terms_payment TEXT,
                            terms_penalty TEXT,
                            status VARCHAR(20) DEFAULT 'DRAFT',
                            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                        )
                    `)

                await pool.query(`
                        CREATE TABLE IF NOT EXISTS contract_items (
                            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                            contract_id UUID REFERENCES contracts(id) ON DELETE CASCADE,
                            group_name VARCHAR(50),
                            name VARCHAR(100),
                            spec VARCHAR(100),
                            quantity DECIMAL(12, 2) DEFAULT 0,
                            unit VARCHAR(20),
                            unit_price DECIMAL(15, 2) DEFAULT 0,
                            amount DECIMAL(15, 2) DEFAULT 0,
                            note TEXT,
                            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                        )
                    `)

                // Seed Sample Contract if empty
                const { rows: existing } = await pool.query('SELECT count(*) FROM contracts')
                if (parseInt(existing[0].count) === 0) {
                    const { rows: projs } = await pool.query('SELECT id FROM projects LIMIT 1')
                    if (projs.length > 0) {
                        const pid = projs[0].id
                        await pool.query(`
                                INSERT INTO contracts (project_id, code, name, status, type, total_amount, contract_date) 
                                VALUES ($1, 'SAMPLE-EST-001', '�ý��� �ڵ� ���� ���� ����', 'DRAFT', 'EST', 10000000, CURRENT_DATE)
                            `, [pid])
                        console.log('Sample contract seeded.')
                    }
                }

                // 2. Init Users Table
                await pool.query(`
                        CREATE TABLE IF NOT EXISTS users (
                            uid VARCHAR(255) PRIMARY KEY,
                            email VARCHAR(255) NOT NULL,
                            name VARCHAR(255),
                            role VARCHAR(50) DEFAULT 'field',
                            status VARCHAR(50) DEFAULT 'pending',
                            contact VARCHAR(50),
                            code VARCHAR(50),
                            branch VARCHAR(50),
                            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                        )
                    `)
                await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS contact VARCHAR(50)`)
                await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS code VARCHAR(50)`)
                await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS branch VARCHAR(50)`)

                // 3. Init Resources Table
                await pool.query(`
                        CREATE TABLE IF NOT EXISTS resources (
                            id VARCHAR(255) PRIMARY KEY,
                            type VARCHAR(50) NOT NULL,
                            name VARCHAR(255) NOT NULL,
                            project_id VARCHAR(255),
                            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                        )
                    `)

                // 3-1. Init PMS Documents tables (safe, no drop)
                await pool.query(`
                        CREATE TABLE IF NOT EXISTS documents (
                            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                            project_id UUID,
                            category VARCHAR(50),
                            type VARCHAR(100),
                            name VARCHAR(255) NOT NULL,
                            status VARCHAR(20) DEFAULT 'DRAFT',
                            current_version VARCHAR(20) DEFAULT 'v1',
                            security_level VARCHAR(20) DEFAULT 'NORMAL',
                            metadata JSONB,
                            review_status VARCHAR(20),
                            created_by UUID,
                            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                        )
                    `)

                await pool.query(`
                        CREATE TABLE IF NOT EXISTS document_versions (
                            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                            document_id UUID REFERENCES documents(id) ON DELETE CASCADE,
                            version VARCHAR(20) NOT NULL,
                            file_path TEXT NOT NULL,
                            file_size BIGINT,
                            file_hash VARCHAR(255),
                            change_log TEXT,
                            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                        )
                    `)

                // Ensure extensions/columns exist for documents schema (safe idempotent)
                await pool.query(`CREATE EXTENSION IF NOT EXISTS "pgcrypto"`)
                await pool.query(`ALTER TABLE documents ADD COLUMN IF NOT EXISTS review_status VARCHAR(20)`)
                await pool.query(`ALTER TABLE documents ADD COLUMN IF NOT EXISTS metadata JSONB`)
                await pool.query(`ALTER TABLE documents ADD COLUMN IF NOT EXISTS security_level VARCHAR(20) DEFAULT 'NORMAL'`)
                await pool.query(`ALTER TABLE documents ADD COLUMN IF NOT EXISTS current_version VARCHAR(20) DEFAULT 'v1'`)
                await pool.query(`ALTER TABLE document_versions ADD COLUMN IF NOT EXISTS file_size BIGINT`)
                await pool.query(`ALTER TABLE document_versions ADD COLUMN IF NOT EXISTS file_hash VARCHAR(255)`)
                await pool.query(`ALTER TABLE document_versions ADD COLUMN IF NOT EXISTS change_log TEXT`)

                // 4. Init EMS Equipment Table
                await pool.query(`
                        CREATE TABLE IF NOT EXISTS equipment (
                            id VARCHAR(255) PRIMARY KEY,
                            equipment_id VARCHAR(100),
                            name VARCHAR(255) NOT NULL,
                            category VARCHAR(100),
                            model VARCHAR(255),
                            manufacturer VARCHAR(255),
                            manufacture_year INTEGER,
                            specifications VARCHAR(255),
                            serial_number VARCHAR(255),
                            acquisition_date DATE,
                            equipment_status VARCHAR(50) DEFAULT '��밡��',
                            purchase_type VARCHAR(50),
                            purchase_amount DECIMAL(15,2),
                            residual_value DECIMAL(15,2),
                            depreciation_method VARCHAR(50),
                            contract_start_date DATE,
                            contract_end_date DATE,
                            supplier VARCHAR(255),
                            supplier_contact VARCHAR(255),
                            warranty_period VARCHAR(100),
                            registration_number VARCHAR(255),
                            insurance_info TEXT,
                            inspection_cycle VARCHAR(100),
                            last_inspection_date DATE,
                            next_inspection_date DATE,
                            assigned_site VARCHAR(255),
                            operator_name VARCHAR(255),
                            primary_use VARCHAR(255),
                            operating_hours VARCHAR(100),
                            usage_restrictions TEXT,
                            maintenance_cycle VARCHAR(100),
                            consumables_cycle VARCHAR(255),
                            parts_lifespan TEXT,
                            service_provider VARCHAR(255),
                            service_contact VARCHAR(255),
                            accumulated_hours DECIMAL(10,2),
                            fuel_consumption DECIMAL(10,2),
                            work_performance TEXT,
                            failure_records TEXT,
                            downtime_hours DECIMAL(10,2),
                            fuel_cost DECIMAL(15,2),
                            maintenance_cost DECIMAL(15,2),
                            insurance_cost DECIMAL(15,2),
                            depreciation_cost DECIMAL(15,2),
                            rental_cost DECIMAL(15,2),
                            total_cost DECIMAL(15,2),
                            documents JSONB,
                            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                        )
                    `)

                // 5. Init Reports Tables
                await pool.query(`
                    CREATE TABLE IF NOT EXISTS report_templates (
                        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                        title VARCHAR(255) NOT NULL,
                        type VARCHAR(50),
                        layout_config JSONB,
                        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                    )
                `)

                await pool.query(`
                    CREATE TABLE IF NOT EXISTS reports (
                        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                        project_id UUID,
                        template_id UUID REFERENCES report_templates(id),
                        title VARCHAR(255) NOT NULL,
                        report_date DATE DEFAULT CURRENT_DATE,
                        status VARCHAR(20) DEFAULT 'DRAFT',
                        content JSONB,
                        created_by VARCHAR(100),
                        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                    )
                `)

            } catch (err) {
                console.error('Error in DB Init:', err)
            }
        })();

        // --- SMS Tables Init ---
        const initSmsTables = async () => {
            try {
                // 1. sms_risk_assessments
                await pool.query(`
                    CREATE TABLE IF NOT EXISTS sms_risk_assessments (
                        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                        project_id UUID,
                        process_name VARCHAR(255) NOT NULL,
                        assessor_name VARCHAR(100),
                        approver_name VARCHAR(100),
                        status VARCHAR(50) DEFAULT 'DRAFT',
                        date DATE DEFAULT CURRENT_DATE,
                        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                    )
                `)

                // 2. sms_risk_items
                await pool.query(`
                    CREATE TABLE IF NOT EXISTS sms_risk_items (
                        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                        assessment_id UUID REFERENCES sms_risk_assessments(id) ON DELETE CASCADE,
                        risk_factor TEXT NOT NULL,
                        risk_type VARCHAR(100),
                        frequency INTEGER DEFAULT 1,
                        severity INTEGER DEFAULT 1,
                        mitigation_measure TEXT,
                        action_manager VARCHAR(100),
                        action_deadline DATE,
                        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                    )
                `)

                // 3. sms_dris
                await pool.query(`
                    CREATE TABLE IF NOT EXISTS sms_dris (
                        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                        project_id UUID,
                        date DATE DEFAULT CURRENT_DATE,
                        location VARCHAR(255),
                        work_content TEXT,
                        risk_points TEXT,
                        attendees_count INTEGER DEFAULT 0,
                        photo_url TEXT,
                        status VARCHAR(50) DEFAULT 'COMPLETED',
                        created_by VARCHAR(100),
                        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                    )
                `)

                // 4. sms_patrols
                await pool.query(`
                    CREATE TABLE IF NOT EXISTS sms_patrols (
                        id SERIAL PRIMARY KEY,
                        project_id INTEGER REFERENCES projects(id),
                        location VARCHAR(255),
                        issue_type VARCHAR(50),
                        severity VARCHAR(20),
                        description TEXT,
                        action_required VARCHAR(255),
                        photo_url TEXT,
                        status VARCHAR(20) DEFAULT 'OPEN',
                        created_by VARCHAR(50),
                        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                    )
                `)
                // 5. sms_checklists
                await pool.query(`
                    CREATE TABLE IF NOT EXISTS sms_checklists (
                        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                        project_id UUID,
                        template_id VARCHAR(50),
                        title VARCHAR(255),
                        status VARCHAR(50) DEFAULT 'COMPLETED',
                        results JSONB,
                        created_by VARCHAR(100),
                        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                    )
                `)
                // 6. sms_educations
                await pool.query(`
                    CREATE TABLE IF NOT EXISTS sms_educations (
                        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                        project_id UUID,
                        title VARCHAR(255) NOT NULL,
                        type VARCHAR(50), 
                        instructor VARCHAR(100),
                        date DATE DEFAULT CURRENT_DATE,
                        place VARCHAR(100),
                        content TEXT,
                        photo_url TEXT,
                        status VARCHAR(50) DEFAULT 'PLANNED',
                        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                    )
                `)

                // 7. sms_education_attendees
                await pool.query(`
                    CREATE TABLE IF NOT EXISTS sms_education_attendees (
                        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                        education_id UUID REFERENCES sms_educations(id) ON DELETE CASCADE,
                        worker_name VARCHAR(100),
                        worker_birth VARCHAR(50),
                        worker_agency VARCHAR(100),
                        signature_url TEXT,
                        attended_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                    )
                `)

                // 8. sms_personnel (For QR ID Card)
                await pool.query(`
                    CREATE TABLE IF NOT EXISTS sms_personnel (
                        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                        project_id UUID,
                        name VARCHAR(100) NOT NULL,
                        birth_date VARCHAR(20),
                        job_type VARCHAR(50), -- ���� (���, ö�� ??
                        blood_type VARCHAR(10),
                        phone VARCHAR(20),
                        agency VARCHAR(100), -- ??�� ??ü
                        qr_code_data TEXT, -- QR Code String
                        photo_url TEXT,
                        status VARCHAR(20) DEFAULT 'ACTIVE',
                        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                    )
                `)

                // 9. sms_incidents (Accident/Near Miss)
                await pool.query(`
                    CREATE TABLE IF NOT EXISTS sms_incidents (
                        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                        project_id UUID,
                        type VARCHAR(50), -- ??��, ??��??��
                        title VARCHAR(255) NOT NULL,
                        date DATE DEFAULT CURRENT_DATE,
                        time VARCHAR(50), -- �߻� ??��
                        place VARCHAR(100),
                        description TEXT,
                        cause TEXT, -- ??��
                        measure TEXT, -- ��ġ ??��
                        reporter VARCHAR(100), -- ����??
                        status VARCHAR(50) DEFAULT 'REPORTED', -- REPORTED, INVESTIGATING, CLOSED
                        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                    )
                `)

                // 10. sms_incident_photos
                await pool.query(`
                    CREATE TABLE IF NOT EXISTS sms_incident_photos (
                        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                        incident_id UUID REFERENCES sms_incidents(id) ON DELETE CASCADE,
                        photo_url TEXT NOT NULL,
                        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                    )
                `)

                // 11. sms_documents (Reports/Documents)
                await pool.query(`
                    CREATE TABLE IF NOT EXISTS sms_documents (
                        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                        project_id UUID,
                        category VARCHAR(50), -- ??��������, �ְ�����, ??������, ��??��?? ��??
                        title VARCHAR(255) NOT NULL,
                        description TEXT,
                        file_url TEXT,
                        file_name VARCHAR(255),
                        file_size INTEGER,
                        uploaded_by VARCHAR(100),
                        upload_date DATE DEFAULT CURRENT_DATE,
                        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                    )
                `)

                // 12. sms_document_comments (PM/Manager feedback)
                await pool.query(`
                    CREATE TABLE IF NOT EXISTS sms_document_comments (
                        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                        document_id UUID REFERENCES sms_documents(id) ON DELETE CASCADE,
                        commenter_name VARCHAR(100),
                        commenter_role VARCHAR(50), -- PM, �濵??
                        comment TEXT NOT NULL,
                        status VARCHAR(50) DEFAULT 'PENDING', -- PENDING, RESOLVED
                        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                    )
                `)
                console.log('SMS Tables initialized successfully')
            } catch (err) {
                console.error('Error creating SMS tables:', err)
            }
        }
        initSmsTables()
    }
})

// ... (Existing User Management APIs) ...

// --- Checklist API ---
// Moved to routes/sms_routes.js


// --- User Management APIs ---

// 1. Register (called after Firebase Auth Signup)
app.post('/api/users/register', async (req, res) => {
    try {
        const { uid, email, name, contact } = req.body

        // Auto-approve specific admin email
        let status = 'pending'
        let role = 'field'

        if (email === 'zdevbro@gmail.com') {
            status = 'approved'
            role = 'sysadmin'
        }

        const query = `
            INSERT INTO users (uid, email, name, contact, status, role)
            VALUES ($1, $2, $3, $4, $5, $6)
            ON CONFLICT (uid) DO UPDATE SET email = $2, name = $3, contact = $4, status = $5
            RETURNING *
        `
        const { rows } = await pool.query(query, [uid, email, name, contact, status, role])
        res.status(201).json(rows[0])
    } catch (err) {
        console.error(err)
        res.status(500).json({ error: 'Failed to register user' })
    }
})


// 2. Get All Users
app.get('/api/users', async (req, res) => {
    try {
        const { rows } = await pool.query('SELECT * FROM users ORDER BY created_at DESC')
        res.json(rows)
    } catch (err) {
        console.error(err)
        res.status(500).json({ error: 'Failed to fetch users' })
    }
})

// 3. Get Single User
app.get('/api/users/:uid', async (req, res) => {
    try {
        const { uid } = req.params
        const { rows } = await pool.query('SELECT * FROM users WHERE uid = $1', [uid])
        if (rows.length === 0) return res.status(404).json({ error: 'User not found' })
        res.json(rows[0])
    } catch (err) {
        console.error(err)
        res.status(500).json({ error: 'Failed to fetch user' })
    }
})

// 4. Approve User & Update Role (Unique Code Gen)
app.post('/api/users/approve', async (req, res) => {
    const client = await pool.connect()
    try {
        await client.query('BEGIN')
        const { uid, role } = req.body

        // Get current user to check if code exists
        const userRes = await client.query('SELECT code, status FROM users WHERE uid = $1', [uid])
        if (userRes.rows.length === 0) {
            await client.query('ROLLBACK')
            return res.status(404).json({ error: 'User not found' })
        }

        let newCode = userRes.rows[0].code

        // Generate Code if no code exists (regardless of previous status, since we are approving now)
        if (!newCode) {
            // Find max code starting with CR
            const codeRes = await client.query("SELECT code FROM users WHERE code LIKE 'CR%' ORDER BY code DESC LIMIT 1")
            if (codeRes.rows.length > 0) {
                const maxCode = codeRes.rows[0].code
                const numPart = parseInt(maxCode.substring(2))
                newCode = 'CR' + (numPart + 1).toString().padStart(4, '0')
            } else {
                newCode = 'CR0001'
            }
        }

        const updateQuery = `
            UPDATE users 
            SET status = 'approved', 
                role = COALESCE($2, role),
                code = COALESCE(code, $3)
            WHERE uid = $1 
            RETURNING *
        `
        const { rows } = await client.query(updateQuery, [uid, role || null, newCode])

        await client.query('COMMIT')
        res.json(rows[0])
    } catch (err) {
        await client.query('ROLLBACK')
        console.error(err)
        res.status(500).json({ error: 'Failed to approve user' })
    } finally {
        client.release()
    }
})

// 5. Delete User
app.delete('/api/users/:uid', async (req, res) => {
    try {
        const { uid } = req.params
        await pool.query('DELETE FROM users WHERE uid = $1', [uid])
        res.json({ message: 'User deleted' })
    } catch (err) {
        console.error(err)
        res.status(500).json({ error: 'Failed to delete user' })
    }
})

// --- Contracts API ---

function inferMimeType(filename = '') {
    const ext = path.extname(String(filename)).toLowerCase()
    if (ext === '.pdf') return 'application/pdf'
    if (ext === '.png') return 'image/png'
    if (ext === '.jpg' || ext === '.jpeg') return 'image/jpeg'
    if (ext === '.doc') return 'application/msword'
    if (ext === '.docx') return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    return 'application/octet-stream'
}

function getBucket() {
    const admin = require('firebase-admin')
    if (!admin.apps.length) admin.initializeApp({ storageBucket: resolveBucketName() })
    return admin.storage().bucket(resolveBucketName())
}

// 0. Attachment View (serves DB fallback content or local file)
app.get('/api/contracts/:id/attachment', async (req, res) => {
    try {
        const { id } = req.params
        const { rows } = await pool.query(
            'SELECT attachment_name, attachment_path, attachment_content, attachment_mime_type FROM contracts WHERE id = $1',
            [id]
        )
        if (rows.length === 0) return res.status(404).send('Contract not found')

        const row = rows[0]
        const mimeType = row.attachment_mime_type || inferMimeType(row.attachment_name || row.attachment_path || '')

        if (row.attachment_content) {
            const buffer = Buffer.from(row.attachment_content, 'base64')
            const filename = encodeURIComponent(row.attachment_name || 'attachment')
            res.setHeader('Content-Type', mimeType)
            res.setHeader('Content-Disposition', `inline; filename*=UTF-8''${filename}`)
            return res.send(buffer)
        }

        if (row.attachment_path && !String(row.attachment_path).includes('/')) {
            const fullPath = path.join(uploadsDir, path.basename(row.attachment_path))
            if (fs.existsSync(fullPath)) {
                res.setHeader('Content-Type', mimeType)
                return res.sendFile(fullPath)
            }
        }

        return res.status(404).send('Attachment not found')
    } catch (e) {
        console.error('[Contracts] Attachment error:', e)
        return res.status(500).send('Server Error')
    }
})

// 1. Get All Contracts
app.get('/api/contracts', async (req, res) => {
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

// 2. Get Single Contract
app.get('/api/contracts/:id', async (req, res) => {
    try {
        const { id } = req.params

        const contractRes = await pool.query('SELECT * FROM contracts WHERE id = $1', [id])
        if (contractRes.rows.length === 0) {
            return res.status(404).json({ error: 'Contract not found' })
        }
        const contract = contractRes.rows[0]

        const itemsRes = await pool.query('SELECT * FROM contract_items WHERE contract_id = $1 ORDER BY created_at ASC', [id])
        contract.items = itemsRes.rows

        if (contract.attachment_content) {
            contract.attachmentUrl = `/api/contracts/${id}/attachment`
        } else if (contract.attachment_path) {
            if (!String(contract.attachment_path).startsWith('http') && !String(contract.attachment_path).startsWith('/')) {
                if (String(contract.attachment_path).startsWith('contracts/')) {
                    try {
                        const bucket = getBucket()
                        const [url] = await bucket.file(contract.attachment_path).getSignedUrl({
                            action: 'read',
                            expires: Date.now() + 1000 * 60 * 60,
                        })
                        contract.attachmentUrl = url
                    } catch (e) {
                        console.warn('[Contracts] Error signing URL:', e.message)
                    }
                } else {
                    contract.attachmentUrl = `/api/contracts/${id}/attachment`
                }
            } else {
                contract.attachmentUrl = contract.attachment_path
            }
        }

        res.json(contract)
    } catch (err) {
        console.error(err)
        res.status(500).json({ error: 'Failed to fetch contract details' })
    }
})

// 3. Create Contract
app.post('/api/contracts', upload.single('file'), async (req, res) => {
    const client = await pool.connect()
    try {
        await client.query('BEGIN')

        const body = req.body || {}
        const file = req.file || null

        const {
            projectId, type, category, name,
            totalAmount, costDirect, costIndirect, riskFee, margin,
            indirectRate, riskRate, marginRate,
            regulationConfig, clientManager, ourManager,
            contractDate, startDate, endDate,
            termsPayment, termsPenalty, status, items, attachment
        } = body

        const parsedItems = typeof items === 'string' ? safeParseJson(items, []) : items
        const parsedRegulationConfig = typeof regulationConfig === 'string' ? safeParseJson(regulationConfig, {}) : regulationConfig

        let attachmentPath = null
        let attachmentSize = null
        let attachmentName = null
        let attachmentContentBase64 = null
        let attachmentMimeType = null

        if (file) {
            const destination = `contracts/${projectId || 'global'}/${file.filename}`
            try {
                const bucket = getBucket()
                await bucket.upload(file.path, { destination, metadata: { contentType: file.mimetype } })
                attachmentPath = destination
                attachmentSize = file.size
                attachmentName = file.originalname
                attachmentMimeType = file.mimetype
                try { fs.unlinkSync(file.path) } catch (e) { }
            } catch (e) {
                attachmentPath = file.filename
                attachmentSize = file.size
                attachmentName = file.originalname
                attachmentMimeType = file.mimetype
                try {
                    attachmentContentBase64 = fs.readFileSync(file.path).toString('base64')
                    try { fs.unlinkSync(file.path) } catch (e2) { }
                } catch (e2) {
                    console.warn('[Contracts] Failed to read local file for DB fallback:', e2.message)
                }
            }
        }

        // Generate Code
        const dateStr = new Date().toISOString().slice(2, 10).replace(/-/g, '')
        const rand = Math.floor(Math.random() * 1000).toString().padStart(3, '0')
        const code = `${type === 'CONTRACT' ? 'CON' : 'EST'}-${dateStr}-${rand}`

        const insertMaster = `
            INSERT INTO contracts (
                project_id, code, type, category, name, 
                total_amount, cost_direct, cost_indirect, risk_fee, margin,
                indirect_rate, risk_rate, margin_rate,
                regulation_config, client_manager, our_manager,
                contract_date, start_date, end_date,
                terms_payment, terms_penalty, status, attachment,
                attachment_path, attachment_size, attachment_name, attachment_content, attachment_mime_type
            ) VALUES (
                $1, $2, $3, $4, $5, 
                $6, $7, $8, $9, $10,
                $11, $12, $13,
                $14, $15, $16,
                $17, $18, $19,
                $20, $21, $22, $23,
                $24, $25, $26, $27, $28
            ) RETURNING *
        `

        const masterParams = [
            projectId, code, type, category, name,
            totalAmount || 0, costDirect || 0, costIndirect || 0, riskFee || 0, margin || 0,
            indirectRate || 0, riskRate || 0, marginRate || 0,
            JSON.stringify(parsedRegulationConfig || {}), clientManager, ourManager,
            contractDate, startDate, endDate,
            termsPayment, termsPenalty, status || 'DRAFT',
            attachment ? JSON.stringify(attachment) : null,
            attachmentPath, attachmentSize, attachmentName, attachmentContentBase64, attachmentMimeType
        ]

        const { rows: masterRows } = await client.query(insertMaster, masterParams)
        const contractId = masterRows[0].id

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
        console.error(err)
        res.status(500).json({ error: 'Failed to create contract' })
    } finally {
        client.release()
    }
})

// 4. Update Contract
app.put('/api/contracts/:id', upload.single('file'), async (req, res) => {
    const client = await pool.connect()
    try {
        await client.query('BEGIN')
        const { id } = req.params
        const body = req.body || {}
        const file = req.file || null

        const {
            category, name,
            totalAmount, costDirect, costIndirect, riskFee, margin,
            indirectRate, riskRate, marginRate,
            regulationConfig, clientManager, ourManager,
            contractDate, startDate, endDate,
            termsPayment, termsPenalty, status, items, attachment
        } = body

        const parsedItems = typeof items === 'string' ? safeParseJson(items, []) : items
        const parsedRegulationConfig = typeof regulationConfig === 'string' ? safeParseJson(regulationConfig, null) : regulationConfig

        if (file) {
            // project_id for destination
            const projectRes = await client.query('SELECT project_id FROM contracts WHERE id = $1', [id])
            const projectId = projectRes.rows[0]?.project_id

            let attachmentPath = null
            let attachmentSize = file.size
            let attachmentName = file.originalname
            let attachmentContentBase64 = null
            let attachmentMimeType = file.mimetype

            const destination = `contracts/${projectId || 'global'}/${file.filename}`
            try {
                const bucket = getBucket()
                await bucket.upload(file.path, { destination, metadata: { contentType: file.mimetype } })
                attachmentPath = destination
                attachmentContentBase64 = null
                try { fs.unlinkSync(file.path) } catch (e) { }
            } catch (e) {
                attachmentPath = file.filename
                try {
                    attachmentContentBase64 = fs.readFileSync(file.path).toString('base64')
                    try { fs.unlinkSync(file.path) } catch (e2) { }
                } catch (e2) {
                    console.warn('[Contracts] Failed to read local file for DB fallback:', e2.message)
                }
            }

            const updateWithFile = `
                UPDATE contracts SET
                    category = COALESCE($2, category),
                    name = COALESCE($3, name),
                    total_amount = COALESCE($4, total_amount),
                    cost_direct = COALESCE($5, cost_direct),
                    cost_indirect = COALESCE($6, cost_indirect),
                    risk_fee = COALESCE($7, risk_fee),
                    margin = COALESCE($8, margin),
                    indirect_rate = COALESCE($9, indirect_rate),
                    risk_rate = COALESCE($10, risk_rate),
                    margin_rate = COALESCE($11, margin_rate),
                    regulation_config = COALESCE($12, regulation_config),
                    client_manager = COALESCE($13, client_manager),
                    our_manager = COALESCE($14, our_manager),
                    contract_date = COALESCE($15, contract_date),
                    start_date = COALESCE($16, start_date),
                    end_date = COALESCE($17, end_date),
                    terms_payment = COALESCE($18, terms_payment),
                    terms_penalty = COALESCE($19, terms_penalty),
                    status = COALESCE($20, status),
                    attachment = COALESCE($21, attachment),
                    attachment_path = $22,
                    attachment_size = $23,
                    attachment_name = $24,
                    attachment_content = $25,
                    attachment_mime_type = $26,
                    updated_at = CURRENT_TIMESTAMP
                WHERE id = $1
                RETURNING *
            `

            const params = [
                id, category, name,
                totalAmount, costDirect, costIndirect, riskFee, margin,
                indirectRate, riskRate, marginRate,
                parsedRegulationConfig !== undefined ? JSON.stringify(parsedRegulationConfig) : null,
                clientManager, ourManager,
                contractDate, startDate, endDate,
                termsPayment, termsPenalty, status,
                attachment ? JSON.stringify(attachment) : null,
                attachmentPath, attachmentSize, attachmentName, attachmentContentBase64, attachmentMimeType
            ]

            const { rows: masterRows } = await client.query(updateWithFile, params)
            if (masterRows.length === 0) {
                await client.query('ROLLBACK')
                return res.status(404).json({ error: 'Contract not found' })
            }

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
            return res.json(masterRows[0])
        }

        const updateMaster = `
            UPDATE contracts SET 
                category = COALESCE($2, category),
                name = COALESCE($3, name),
                total_amount = COALESCE($4, total_amount),
                cost_direct = COALESCE($5, cost_direct),
                cost_indirect = COALESCE($6, cost_indirect),
                risk_fee = COALESCE($7, risk_fee),
                margin = COALESCE($8, margin),
                indirect_rate = COALESCE($9, indirect_rate),
                risk_rate = COALESCE($10, risk_rate),
                margin_rate = COALESCE($11, margin_rate),
                regulation_config = COALESCE($12, regulation_config),
                client_manager = COALESCE($13, client_manager),
                our_manager = COALESCE($14, our_manager),
                contract_date = COALESCE($15, contract_date),
                start_date = COALESCE($16, start_date),
                end_date = COALESCE($17, end_date),
                terms_payment = COALESCE($18, terms_payment),
                terms_penalty = COALESCE($19, terms_penalty),
                status = COALESCE($20, status),
                attachment = COALESCE($21, attachment),
                updated_at = CURRENT_TIMESTAMP
            WHERE id = $1
            RETURNING *
        `
        const masterParams = [
            id, category, name,
            totalAmount, costDirect, costIndirect, riskFee, margin,
            indirectRate, riskRate, marginRate,
            parsedRegulationConfig !== undefined ? JSON.stringify(parsedRegulationConfig) : null,
            clientManager, ourManager,
            contractDate, startDate, endDate,
            termsPayment, termsPenalty, status,
            attachment ? JSON.stringify(attachment) : null
        ]

        const { rows: masterRows } = await client.query(updateMaster, masterParams)
        if (masterRows.length === 0) {
            await client.query('ROLLBACK')
            return res.status(404).json({ error: 'Contract not found' })
        }

        // Full Replace Items
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
        console.error(err)
        res.status(500).json({ error: 'Failed to update contract' })
    } finally {
        client.release()
    }
})

// 5. Delete Contract
app.delete('/api/contracts/:id', async (req, res) => {
    try {
        const { id } = req.params
        await pool.query('DELETE FROM contracts WHERE id = $1', [id])
        res.json({ message: 'Contract deleted' })
    } catch (err) {
        console.error(err)
        res.status(500).json({ error: 'Failed to delete contract' })
    }
})

// --- Projects API ---
app.get('/api/projects', async (req, res) => {
    try {
        const { rows } = await pool.query('SELECT * FROM projects ORDER BY name')
        res.json(rows)
    } catch (err) {
        console.error(err)
        res.status(500).json({ error: 'Failed to fetch projects' })
    }
})

app.get('/api/projects/:id', async (req, res) => {
    try {
        const { id } = req.params
        const { rows } = await pool.query('SELECT * FROM projects WHERE id = $1', [id])
        if (rows.length === 0) {
            return res.status(404).json({ error: 'Project not found' })
        }
        res.json(rows[0])
    } catch (err) {
        console.error(err)
        res.status(500).json({ error: 'Failed to fetch project' })
    }
})

// --- Resources API (Simple for PMS) ---
app.get('/api/resources', async (req, res) => {
    try {
        const { rows } = await pool.query('SELECT * FROM resources ORDER BY created_at DESC')
        res.json(rows)
    } catch (err) {
        console.error(err)
        res.status(500).json({ error: 'Failed to fetch resources' })
    }
})

app.post('/api/resources', async (req, res) => {
    try {
        const { id, type, name, projectId } = req.body
        const query = 'INSERT INTO resources (id, type, name, project_id) VALUES ($1, $2, $3, $4) RETURNING *'
        const { rows } = await pool.query(query, [id, type, name, projectId])
        res.status(201).json(rows[0])
    } catch (err) {
        console.error(err)
        res.status(500).json({ error: 'Failed to create resource' })
    }
})

app.delete('/api/resources/:id', async (req, res) => {
    try {
        const { id } = req.params
        await pool.query('DELETE FROM resources WHERE id = $1', [id])
        res.json({ message: 'Resource deleted' })
    } catch (err) {
        console.error(err)
        res.status(500).json({ error: 'Failed to delete resource' })
    }
})

// --- Resource Assignments API (Links Resources/Equipment/Users to Tasks) ---
app.get('/api/resource-assignments', async (req, res) => {
    try {
        const { projectId } = req.query
        let query = 'SELECT * FROM resource_assignments ORDER BY created_at DESC'
        let params = []

        if (projectId) {
            query = 'SELECT * FROM resource_assignments WHERE project_id = $1 ORDER BY created_at DESC'
            params = [projectId]
        }

        const { rows } = await pool.query(query, params)
        res.json(rows)
    } catch (err) {
        console.error(err)
        res.status(500).json({ error: 'Failed to fetch resource assignments' })
    }
})

app.post('/api/resource-assignments', async (req, res) => {
    try {
        const { projectId, resourceType, resourceId, taskId, startDate, endDate } = req.body

        if (!resourceId || !startDate || !endDate) {
            return res.status(400).json({ error: 'Missing required fields' })
        }

        const query = `
            INSERT INTO resource_assignments (project_id, resource_type, resource_id, start_date, end_date)
            VALUES ($1, $2, $3, $4, $5)
            RETURNING *
        `
        const { rows } = await pool.query(query, [projectId, resourceType, resourceId, startDate, endDate])
        res.status(201).json(rows[0])
    } catch (err) {
        console.error(err)
        res.status(500).json({ error: 'Failed to create resource assignment' })
    }
})

app.delete('/api/resource-assignments/:id', async (req, res) => {
    try {
        const { id } = req.params
        await pool.query('DELETE FROM resource_assignments WHERE id = $1', [id])
        res.json({ message: 'Assignment deleted' })
    } catch (err) {
        console.error(err)
        res.status(500).json({ error: 'Failed to delete assignment' })
    }
})

// --- Personnel API (Field Workers without Auth) ---
app.get('/api/personnel', async (req, res) => {
    try {
        const { rows } = await pool.query('SELECT * FROM personnel ORDER BY name')
        res.json(rows)
    } catch (err) {
        console.error(err)
        res.status(500).json({ error: 'Failed to fetch personnel' })
    }
})

app.post('/api/personnel', async (req, res) => {
    try {
        const { name, role, qualifications, securityClearance } = req.body
        const query = `
            INSERT INTO personnel (name, role, qualifications, security_clearance)
            VALUES ($1, $2, $3, $4)
            RETURNING *
        `
        const { rows } = await pool.query(query, [name, role, qualifications || [], securityClearance])
        res.status(201).json(rows[0])
    } catch (err) {
        console.error(err)
        res.status(500).json({ error: 'Failed to create personnel' })
    }
})

app.delete('/api/personnel/:id', async (req, res) => {
    try {
        const { id } = req.params
        await pool.query('DELETE FROM personnel WHERE id = $1', [id])
        res.json({ message: 'Personnel deleted' })
    } catch (err) {
        console.error(err)
        res.status(500).json({ error: 'Failed to delete personnel' })
    }
})

// --- EMS Equipment API ---
app.get('/api/equipment', async (req, res) => {
    try {
        const { rows } = await pool.query('SELECT * FROM equipment ORDER BY created_at DESC')
        res.json(rows)
    } catch (err) {
        console.error(err)
        res.status(500).json({ error: 'Failed to fetch equipment' })
    }
})

app.get('/api/equipment/:id', async (req, res) => {
    try {
        const { id } = req.params
        const { rows } = await pool.query('SELECT * FROM equipment WHERE id = $1', [id])
        if (rows.length === 0) return res.status(404).json({ error: 'Equipment not found' })
        res.json(rows[0])
    } catch (err) {
        console.error(err)
        res.status(500).json({ error: 'Failed to fetch equipment' })
    }
})

app.post('/api/equipment', async (req, res) => {
    try {
        const data = req.body
        const fields = ['id', 'name']
        const values = [data.id || crypto.randomUUID(), data.name]

        const fieldMapping = {
            equipment_id: data.equipmentId,
            category: data.category,
            model: data.model,
            manufacturer: data.manufacturer,
            manufacture_year: data.manufactureYear,
            specifications: data.specifications,
            serial_number: data.serialNumber,
            acquisition_date: data.acquisitionDate,
            equipment_status: data.equipmentStatus,
            purchase_type: data.purchaseType,
            purchase_amount: data.purchaseAmount,
            residual_value: data.residualValue,
            depreciation_method: data.depreciationMethod,
            contract_start_date: data.contractStartDate,
            contract_end_date: data.contractEndDate,
            supplier: data.supplier,
            supplier_contact: data.supplierContact,
            warranty_period: data.warrantyPeriod,
            registration_number: data.registrationNumber,
            insurance_info: data.insuranceInfo,
            inspection_cycle: data.inspectionCycle,
            last_inspection_date: data.lastInspectionDate,
            next_inspection_date: data.nextInspectionDate,
            assigned_site: data.assignedSite,
            operator_name: data.operatorName,
            primary_use: data.primaryUse,
            operating_hours: data.operatingHours,
            usage_restrictions: data.usageRestrictions,
            maintenance_cycle: data.maintenanceCycle,
            consumables_cycle: data.consumablesCycle,
            parts_lifespan: data.partsLifespan,
            service_provider: data.serviceProvider,
            service_contact: data.serviceContact,
            accumulated_hours: data.accumulatedHours,
            fuel_consumption: data.fuelConsumption,
            work_performance: data.workPerformance,
            failure_records: data.failureRecords,
            downtime_hours: data.downtimeHours,
            fuel_cost: data.fuelCost,
            maintenance_cost: data.maintenanceCost,
            insurance_cost: data.insuranceCost,
            depreciation_cost: data.depreciationCost,
            rental_cost: data.rentalCost,
            total_cost: data.totalCost,
            documents: data.documents ? JSON.stringify(data.documents) : null
        }

        Object.entries(fieldMapping).forEach(([field, value]) => {
            if (value !== undefined && value !== null && value !== '') {
                fields.push(field)
                values.push(value)
            }
        })

        const placeholders = fields.map((_, i) => `$${i + 1}`).join(', ')
        const query = `INSERT INTO equipment (${fields.join(', ')}) VALUES (${placeholders}) RETURNING *`

        const { rows } = await pool.query(query, values)
        res.status(201).json(rows[0])
    } catch (err) {
        console.error(err)
        res.status(500).json({ error: 'Failed to create equipment', details: err.message })
    }
})

app.put('/api/equipment/:id', async (req, res) => {
    try {
        const { id } = req.params
        const data = req.body

        // Build dynamic UPDATE query
        const updates = []
        const values = []
        let paramIndex = 1

        const fieldMapping = {
            equipment_id: data.equipmentId,
            name: data.name,
            category: data.category,
            model: data.model,
            manufacturer: data.manufacturer,
            manufacture_year: data.manufactureYear,
            specifications: data.specifications,
            serial_number: data.serialNumber,
            acquisition_date: data.acquisitionDate,
            equipment_status: data.equipmentStatus,
            purchase_type: data.purchaseType,
            purchase_amount: data.purchaseAmount,
            residual_value: data.residualValue,
            depreciation_method: data.depreciationMethod,
            contract_start_date: data.contractStartDate,
            contract_end_date: data.contractEndDate,
            supplier: data.supplier,
            supplier_contact: data.supplierContact,
            warranty_period: data.warrantyPeriod,
            registration_number: data.registrationNumber,
            insurance_info: data.insuranceInfo,
            inspection_cycle: data.inspectionCycle,
            last_inspection_date: data.lastInspectionDate,
            next_inspection_date: data.nextInspectionDate,
            assigned_site: data.assignedSite,
            operator_name: data.operatorName,
            primary_use: data.primaryUse,
            operating_hours: data.operatingHours,
            usage_restrictions: data.usageRestrictions,
            maintenance_cycle: data.maintenanceCycle,
            consumables_cycle: data.consumablesCycle,
            parts_lifespan: data.partsLifespan,
            service_provider: data.serviceProvider,
            service_contact: data.serviceContact,
            accumulated_hours: data.accumulatedHours,
            fuel_consumption: data.fuelConsumption,
            work_performance: data.workPerformance,
            failure_records: data.failureRecords,
            downtime_hours: data.downtimeHours,
            fuel_cost: data.fuelCost,
            maintenance_cost: data.maintenanceCost,
            insurance_cost: data.insuranceCost,
            depreciation_cost: data.depreciationCost,
            rental_cost: data.rentalCost,
            total_cost: data.totalCost,
            documents: data.documents ? JSON.stringify(data.documents) : undefined
        }

        Object.entries(fieldMapping).forEach(([field, value]) => {
            if (value !== undefined) {
                updates.push(`${field} = $${paramIndex}`)
                values.push(value)
                paramIndex++
            }
        })

        if (updates.length === 0) {
            return res.status(400).json({ error: 'No fields to update' })
        }

        updates.push(`updated_at = CURRENT_TIMESTAMP`)
        values.push(id)

        const query = `UPDATE equipment SET ${updates.join(', ')} WHERE id = $${paramIndex} RETURNING *`
        const { rows } = await pool.query(query, values)

        if (rows.length === 0) {
            return res.status(404).json({ error: 'Equipment not found' })
        }

        res.json(rows[0])
    } catch (err) {
        console.error(err)
        res.status(500).json({ error: 'Failed to update equipment', details: err.message })
    }
})

app.delete('/api/equipment/:id', async (req, res) => {
    try {
        const { id } = req.params
        const { rows } = await pool.query('DELETE FROM equipment WHERE id = $1 RETURNING id', [id])
        if (rows.length === 0) {
            return res.status(404).json({ error: 'Equipment not found' })
        }
        res.json({ message: 'Equipment deleted successfully' })
    } catch (err) {
        console.error(err)
        res.status(500).json({ error: 'Failed to delete equipment' })
    }
})

// --- File Upload API for Equipment Documents ---
app.post('/api/equipment/:id/upload', upload.single('file'), async (req, res) => {
    try {
        const { id } = req.params
        const { category } = req.body

        if (!req.file) {
            return res.status(400).json({ error: 'No file uploaded' })
        }

        // Get current equipment documents
        const { rows } = await pool.query('SELECT documents FROM equipment WHERE id = $1', [id])
        if (rows.length === 0) {
            // Delete uploaded file if equipment not found
            fs.unlinkSync(req.file.path)
            return res.status(404).json({ error: 'Equipment not found' })
        }

        const currentDocs = rows[0].documents || []

        // Create new document entry
        const newDoc = {
            id: `${Date.now()}-${Math.random()}`,
            name: req.file.originalname,
            type: req.file.mimetype,
            size: req.file.size,
            uploadDate: new Date().toISOString(),
            category: category || '��??',
            path: req.file.filename, // Store filename, not full path
            url: `/uploads/${req.file.filename}` // URL for accessing the file
        }

        // Add to documents array
        const updatedDocs = [...currentDocs, newDoc]

        // Update equipment with new documents
        await pool.query(
            'UPDATE equipment SET documents = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
            [JSON.stringify(updatedDocs), id]
        )

        res.status(201).json(newDoc)
    } catch (err) {
        console.error(err)
        // Clean up uploaded file on error
        if (req.file) {
            fs.unlinkSync(req.file.path)
        }
        res.status(500).json({ error: 'Failed to upload file', details: err.message })
    }
})

// Delete equipment document
app.delete('/api/equipment/:equipmentId/documents/:documentId', async (req, res) => {
    try {
        const { equipmentId, documentId } = req.params

        // Get current equipment documents
        const { rows } = await pool.query('SELECT documents FROM equipment WHERE id = $1', [equipmentId])
        if (rows.length === 0) {
            return res.status(404).json({ error: 'Equipment not found' })
        }

        const currentDocs = rows[0].documents || []
        const docToDelete = currentDocs.find(doc => doc.id === documentId)

        if (!docToDelete) {
            return res.status(404).json({ error: 'Document not found' })
        }

        // Delete file from filesystem
        const filePath = path.join(uploadsDir, docToDelete.path)
        if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath)
        }

        // Remove from documents array
        const updatedDocs = currentDocs.filter(doc => doc.id !== documentId)

        // Update equipment
        await pool.query(
            'UPDATE equipment SET documents = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
            [JSON.stringify(updatedDocs), equipmentId]
        )

        res.json({ message: 'Document deleted successfully' })
    } catch (err) {
        console.error(err)
        res.status(500).json({ error: 'Failed to delete document', details: err.message })
    }
})

// --- EMS alias routes (backward compatibility: /api/ems/equipment -> /api/equipment) ---
app.get('/api/ems/equipment', async (req, res) => {
    try {
        const { rows } = await pool.query('SELECT * FROM equipment ORDER BY created_at DESC')
        res.json(rows)
    } catch (err) {
        console.error(err)
        res.status(500).json({ error: 'Failed to fetch equipment' })
    }
})

app.get('/api/ems/equipment/:id', async (req, res) => {
    try {
        const { id } = req.params
        const { rows } = await pool.query('SELECT * FROM equipment WHERE id = $1', [id])
        if (rows.length === 0) return res.status(404).json({ error: 'Equipment not found' })
        res.json(rows[0])
    } catch (err) {
        console.error(err)
        res.status(500).json({ error: 'Failed to fetch equipment' })
    }
})

app.post('/api/ems/equipment', async (req, res) => {
    // Delegate to existing handler
    req.url = req.url.replace('/api/ems/equipment', '/api/equipment')
    app._router.handle(req, res)
})

app.put('/api/ems/equipment/:id', async (req, res) => {
    req.url = req.url.replace('/api/ems/equipment', '/api/equipment')
    app._router.handle(req, res)
})

app.delete('/api/ems/equipment/:id', async (req, res) => {
    req.url = req.url.replace('/api/ems/equipment', '/api/equipment')
    app._router.handle(req, res)
})

app.post('/api/ems/equipment/:id/upload', upload.single('file'), async (req, res) => {
    req.url = req.url.replace('/api/ems/equipment', '/api/equipment')
    app._router.handle(req, res)
})

app.delete('/api/ems/equipment/:equipmentId/documents/:documentId', async (req, res) => {
    req.url = req.url.replace('/api/ems/equipment', '/api/equipment')
    app._router.handle(req, res)
})

app.get('/', (req, res) => {
    res.send('Cross PMS API Server is running')
})

app.get('/api/projects', async (req, res) => {
    try {
        const query = `
      SELECT 
        id, code, name, client, address, pm_name as pm, regulation_type as regulation, status,
            start_date as "startDate",
            end_date as "endDate",
            security_level as "securityLevel"
      FROM projects
            `
        const { rows } = await pool.query(query)
        res.json(rows)
    } catch (err) {
        console.error(err)
        res.status(500).json({ error: 'Internal Server Error' })
    }
})

// Tasks API
app.get('/api/tasks', async (req, res) => {
    try {
        const { projectId } = req.query
        let query = `
            SELECT 
                id,
            project_id as "projectId",
            parent_task_id as "parentId",
            name,
            TO_CHAR(start_date, 'YYYY-MM-DD') as "start",
            TO_CHAR(end_date, 'YYYY-MM-DD') as "end",
            progress,
            status,
            sort_order as "order",
            predecessors,
            weight,
            delay_risk as "delayRisk"
            FROM tasks
            `
        const params = []
        if (projectId) {
            query += ` WHERE project_id = $1`
            params.push(projectId)
        }
        query += ` ORDER BY sort_order ASC`

        const { rows } = await pool.query(query, params)
        res.json(rows)
    } catch (err) {
        console.error(err)
        res.status(500).json({ error: 'Failed to fetch tasks' })
    }
})

app.post('/api/tasks', async (req, res) => {
    try {
        const { projectId, parentId, name, start, end, progress, predecessors, order, weight, id } = req.body
        const query = `
            INSERT INTO tasks(
                id, project_id, parent_task_id, name, start_date, end_date, progress, sort_order, predecessors, weight
            ) VALUES(COALESCE($10, gen_random_uuid()), $1, $2, $3, $4, $5, $6, $7, $8, $9)
            RETURNING *,
            project_id as "projectId",
            parent_task_id as "parentId",
            start_date as "start",
            end_date as "end",
            sort_order as "order",
            delay_risk as "delayRisk"
        `
        const values = [
            projectId || null,
            parentId || null,
            name,
            start,
            end,
            progress || 0,
            order || 0,
            predecessors || [],
            weight || 1,
            id || null
        ]
        const { rows } = await pool.query(query, values)

        if (parentId) {
            await syncParentDates(parentId)
        }

        res.status(201).json(rows[0])
    } catch (err) {
        console.error(err)
        res.status(500).json({ error: 'Failed to create task' })
    }
})

app.put('/api/tasks/:id', async (req, res) => {
    const client = await pool.connect()
    try {
        await client.query('BEGIN')
        const { id } = req.params
        const { name, start, end, progress, predecessors, parentId, order, weight } = req.body

        // 1. Get old parent ID
        const oldTaskResult = await client.query('SELECT parent_task_id FROM tasks WHERE id = $1', [id])
        if (oldTaskResult.rows.length === 0) {
            await client.query('ROLLBACK')
            return res.status(404).json({ error: 'Task not found' })
        }
        const oldParentId = oldTaskResult.rows[0].parent_task_id

        // 2. Update task
        const query = `
            UPDATE tasks 
            SET 
                name = COALESCE($1, name),
            start_date = COALESCE($2, start_date),
            end_date = COALESCE($3, end_date),
            progress = COALESCE($4, progress),
            predecessors = COALESCE($5, predecessors),
            parent_task_id = $6,
            sort_order = COALESCE($7, sort_order),
            weight = COALESCE($8, weight)
            WHERE id = $9
            RETURNING *,
            project_id as "projectId",
            parent_task_id as "parentId",
            start_date as "start",
            end_date as "end",
            sort_order as "order",
            delay_risk as "delayRisk"
        `
        const values = [
            name,
            start,
            end,
            progress,
            predecessors,
            parentId === undefined ? oldParentId : (parentId || null), // preserving logic: undefined means no change, null means set to null
            order,
            weight,
            id
        ]

        const { rows } = await client.query(query, values)

        // 3. Sync parents
        const newParentId = rows[0].parentId

        // If parent changed, sync old parent
        if (oldParentId && oldParentId !== newParentId) {
            await syncParentDates(oldParentId, client)
        }

        // Sync the task itself (in case it has children, enforce calculated dates)
        await syncParentDates(id, client)

        // Sync new parent (or current parent if unchanged)
        // This is still needed if 'id' is a leaf node (and thus didn't recurse up)
        if (newParentId) {
            await syncParentDates(newParentId, client)
        }

        await client.query('COMMIT')
        res.json(rows[0])
    } catch (err) {
        await client.query('ROLLBACK')
        console.error(err)
        res.status(500).json({ error: 'Failed to update task' })
    } finally {
        client.release()
    }
})

app.delete('/api/tasks', async (req, res) => {
    try {
        const { projectId } = req.query
        if (!projectId) return res.status(400).json({ error: 'Project ID required' })

        await pool.query('DELETE FROM tasks WHERE project_id = $1', [projectId])
        res.json({ message: 'All project tasks deleted' })
    } catch (err) {
        console.error(err)
        res.status(500).json({ error: 'Failed to delete tasks' })
    }
})

app.delete('/api/tasks/:id', async (req, res) => {
    const client = await pool.connect()
    try {
        await client.query('BEGIN')
        const { id } = req.params

        // Get parent ID before delete
        const oldTaskResult = await client.query('SELECT parent_task_id FROM tasks WHERE id = $1', [id])
        const parentId = oldTaskResult.rows.length > 0 ? oldTaskResult.rows[0].parent_task_id : null

        const query = 'DELETE FROM tasks WHERE id = $1 RETURNING id'
        const { rows } = await client.query(query, [id])

        if (rows.length === 0) {
            await client.query('ROLLBACK')
            return res.status(404).json({ error: 'Task not found' })
        }

        if (parentId) {
            await syncParentDates(parentId, client)
        }

        await client.query('COMMIT')
        res.json({ message: 'Task deleted successfully', id })
    } catch (err) {
        await client.query('ROLLBACK')
        console.error(err)
        res.status(500).json({ error: 'Failed to delete task' })
    } finally {
        client.release()
    }
})

// Recursively update parent dates based on children
async function syncParentDates(parentId, client = pool) {
    if (!parentId) return

    try {
        // 1. Get all children stats
        const statsQuery = `
            SELECT 
                MIN(start_date) as min_start,
            MAX(end_date) as max_end 
            FROM tasks 
            WHERE parent_task_id = $1
            `
        const { rows } = await client.query(statsQuery, [parentId])
        const { min_start, max_end } = rows[0]

        if (!min_start || !max_end) return // Should not happen if children exist, but if all deleted?

        // 2. Update parent
        const updateQuery = `
            UPDATE tasks 
            SET start_date = $1, end_date = $2 
            WHERE id = $3 
            RETURNING parent_task_id
            `
        const updateRes = await client.query(updateQuery, [min_start, max_end, parentId])

        // 3. Recurse up if grandparent exists
        if (updateRes.rows.length > 0) {
            const grandParentId = updateRes.rows[0].parent_task_id
            if (grandParentId) {
                await syncParentDates(grandParentId, client)
            }
        }
    } catch (err) {
        console.error('Error syncing parent dates:', err)
        throw err
    }
}

// ==================== SMS APIs ====================
// Mounted before inline routes to take precedence
const smsRouter = require('./routes/sms_routes')(pool)
app.use('/api/sms', smsRouter)

// --- SMS API ---

// 1. Get Risk Assessments (List)
app.get('/api/sms/risk-assessments', async (req, res) => {
    try {
        const { projectId } = req.query
        let query = `
            SELECT 
                ra.*,
                (SELECT COUNT(*) FROM sms_risk_items WHERE assessment_id = ra.id) as item_count
            FROM sms_risk_assessments ra
        `
        const params = []
        if (projectId) {
            query += ` WHERE ra.project_id = $1`
            params.push(projectId)
        }
        query += ` ORDER BY ra.created_at DESC`

        const { rows } = await pool.query(query, params)
        res.json(rows)
    } catch (err) {
        console.error(err)
        res.status(500).json({ error: 'Failed to fetch risk assessments' })
    }
})

// 2. Get Single Risk Assessment with Items
app.get('/api/sms/risk-assessments/:id', async (req, res) => {
    try {
        const { id } = req.params
        // Get RA details
        const raRes = await pool.query('SELECT * FROM sms_risk_assessments WHERE id = $1', [id])
        if (raRes.rows.length === 0) return res.status(404).json({ error: 'Assessment not found' })

        // Get Risk Items
        const itemsRes = await pool.query('SELECT * FROM sms_risk_items WHERE assessment_id = $1 ORDER BY risk_factor', [id])

        res.json({
            ...raRes.rows[0],
            items: itemsRes.rows
        })
    } catch (err) {
        console.error(err)
        res.status(500).json({ error: 'Failed to fetch assessment details' })
    }
})

// 3. Create Risk Assessment
app.post('/api/sms/risk-assessments', async (req, res) => {
    const client = await pool.connect()
    try {
        await client.query('BEGIN')
        const { projectId, processName, assessorName, items } = req.body

        // Create Header
        const raQuery = `
            INSERT INTO sms_risk_assessments (project_id, process_name, assessor_name, status)
            VALUES ($1, $2, $3, 'DRAFT')
            RETURNING *
        `
        const raRes = await client.query(raQuery, [projectId || null, processName, assessorName])
        const raId = raRes.rows[0].id

        // Create Items
        if (items && items.length > 0) {
            for (const item of items) {
                await client.query(`
                    INSERT INTO sms_risk_items (
                        assessment_id, risk_factor, risk_type, frequency, severity, 
                        mitigation_measure, action_manager, action_deadline
                    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
                `, [
                    raId,
                    item.riskFactor,
                    item.riskType || '��??',
                    item.frequency || 1,
                    item.severity || 1,
                    item.mitigationMeasure || '',
                    item.actionManager || '',
                    item.actionDeadline || null
                ])
            }
        }

        await client.query('COMMIT')
        res.status(201).json(raRes.rows[0])
    } catch (err) {
        await client.query('ROLLBACK')
        console.error(err)
        res.status(500).json({ error: 'Failed to create risk assessment' })
    } finally {
        client.release()
    }
})

// --- DRI (Daily Risk Insight) API ---

// 1. Get DRIs (List with optional filters)
app.get('/api/sms/dris', async (req, res) => {
    try {
        const { projectId, date } = req.query
        let query = `SELECT * FROM sms_dris`
        const params = []
        const conditions = []

        if (projectId && projectId !== 'all') {
            params.push(projectId)
            conditions.push(`project_id = $${params.length}`)
        }
        if (date) {
            params.push(date)
            conditions.push(`date = $${params.length}`)
        }

        if (conditions.length > 0) {
            query += ` WHERE ` + conditions.join(' AND ')
        }

        query += ` ORDER BY date DESC, created_at DESC`

        const { rows } = await pool.query(query, params)
        res.json(rows)
    } catch (err) {
        console.error(err)
        res.status(500).json({ error: 'Failed to fetch DRIs' })
    }
})

// 2. Create DRI
app.post('/api/sms/dris', async (req, res) => {
    try {
        const { projectId, date, location, workContent, riskPoints, attendeesCount, photoUrl, createdBy } = req.body

        const query = `
            INSERT INTO sms_dris (
                project_id, date, location, work_content, risk_points, 
                attendees_count, photo_url, created_by, status
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'COMPLETED')
            RETURNING *
        `

        const { rows } = await pool.query(query, [
            projectId, date || new Date(), location, workContent, riskPoints,
            attendeesCount || 0, photoUrl, createdBy
        ])

        res.status(201).json(rows[0])
    } catch (err) {
        console.error(err)
        res.status(500).json({ error: 'Failed to create DRI' })
    }
})

// --- Patrol API ---

// 1. Get Patrols
app.get('/api/sms/patrols', async (req, res) => {
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

// 2. Create Patrol
app.post('/api/sms/patrols', async (req, res) => {
    try {
        const { projectId, location, issueType, severity, description, actionRequired } = req.body

        const query = `
            INSERT INTO sms_patrols (
                project_id, location, issue_type, severity, description, 
                action_required, status, created_by, created_at
            ) VALUES ($1, $2, $3, $4, $5, $6, 'OPEN', '??��������', NOW())
            RETURNING *
        `

        const { rows } = await pool.query(query, [
            projectId, location, issueType, severity, description, actionRequired
        ])

        res.status(201).json(rows[0])
    } catch (err) {
        console.error(err)
        res.status(500).json({ error: 'Failed to create patrol' })
    }
})

// --- Education API ---

// 1. Get Educations
app.get('/api/sms/educations', async (req, res) => {
    try {
        const { projectId } = req.query
        let query = `
            SELECT 
                e.*,
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

// 1.5 Get Single Education with Attendees
app.get('/api/sms/educations/:id', async (req, res) => {
    try {
        const { id } = req.params
        // Get Education
        const eduRes = await pool.query('SELECT * FROM sms_educations WHERE id = $1', [id])
        if (eduRes.rows.length === 0) return res.status(404).json({ error: 'Education not found' })

        // Get Attendees (sorted by attendance time - earliest first)
        const attRes = await pool.query('SELECT * FROM sms_education_attendees WHERE education_id = $1 ORDER BY attended_at ASC', [id])

        res.json({
            ...eduRes.rows[0],
            attendees: attRes.rows
        })
    } catch (err) {
        console.error(err)
        res.status(500).json({ error: 'Failed to fetch education details' })
    }
})

// 2. Create Education
app.post('/api/sms/educations', async (req, res) => {
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

// 3. Mark Attendance (Bulk or Single)
app.post('/api/sms/educations/:id/attend', async (req, res) => {
    try {
        const { id } = req.params
        const { attendees } = req.body // Array of { name, birth, signature }

        if (!attendees || attendees.length === 0) {
            return res.status(400).json({ error: 'No attendees provided' })
        }

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

// --- Personnel API (QR System) ---

// 1. Get Personnel
app.get('/api/sms/personnel', async (req, res) => {
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

// 2. Register Personnel
app.post('/api/sms/personnel', async (req, res) => {
    try {
        const { projectId, name, birthDate, jobType, bloodType, phone, agency } = req.body

        // Generate QR Data: JSON String containing minimal info
        const qrData = JSON.stringify({
            n: name,
            b: birthDate,
            j: jobType,
            t: 'W' // Type: Worker
        })

        const query = `
            INSERT INTO sms_personnel (
                project_id, name, birth_date, job_type, blood_type, phone, agency, qr_code_data
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
            RETURNING *
        `
        const { rows } = await pool.query(query, [
            projectId, name, birthDate, jobType, bloodType, phone, agency, qrData
        ])
        res.status(201).json(rows[0])
    } catch (err) {
        console.error(err)
        res.status(500).json({ error: 'Failed to register personnel' })
    }
})

// --- Incident API ---

// 1. Get Incidents
app.get('/api/sms/incidents', async (req, res) => {
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

// 2. Create Incident
app.post('/api/sms/incidents', async (req, res) => {
    try {
        const { projectId, type, title, date, time, place, description, photos } = req.body

        const client = await pool.connect()
        try {
            await client.query('BEGIN')

            const insertRes = await client.query(`
                INSERT INTO sms_incidents (
                    project_id, type, title, date, time, place, description, reporter
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, '������')
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

// ==================== SMS DOCUMENTS (Reports) ====================
// 1. Get all documents
app.get('/api/sms/documents', async (req, res) => {
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

// 2. Create document
app.post('/api/sms/documents', async (req, res) => {
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

// 3. Get comments for a document
app.get('/api/sms/documents/:id/comments', async (req, res) => {
    try {
        const { id } = req.params
        const result = await pool.query(`
            SELECT * FROM sms_document_comments 
            WHERE document_id = $1 
            ORDER BY created_at DESC
        `, [id])
        res.json(result.rows)
    } catch (err) {
        console.error(err)
        res.status(500).json({ error: 'Failed to fetch comments' })
    }
})

// 4. Add comment to document
app.post('/api/sms/documents/:id/comments', async (req, res) => {
    try {
        const { id } = req.params
        const { commenter_name, commenter_role, comment } = req.body

        const result = await pool.query(`
            INSERT INTO sms_document_comments (
                document_id, commenter_name, commenter_role, comment
            ) VALUES ($1, $2, $3, $4)
            RETURNING *
        `, [id, commenter_name, commenter_role, comment])

        // TODO: Create task in PMS todo list
        // This will be implemented when integrating with PMS

        res.json(result.rows[0])
    } catch (err) {
        console.error(err)
        res.status(500).json({ error: 'Failed to add comment' })
    }
})



// ==================== Personnel APIs ====================
app.get('/api/personnel', async (req, res) => {
    try {
        const { role } = req.query
        let query = 'SELECT * FROM personnel ORDER BY created_at DESC'
        let params = []

        if (role) {
            query = 'SELECT * FROM personnel WHERE role = $1 ORDER BY created_at DESC'
            params = [role]
        }

        const { rows } = await pool.query(query, params)
        res.json(rows)
    } catch (err) {
        console.error(err)
        res.status(500).json({ error: 'Failed to fetch personnel' })
    }
})

app.get('/api/personnel/pm-list', async (req, res) => {
    try {
        // Get personnel with PM/PL/CEO/EXECUTIVE roles for project assignment
        const { rows } = await pool.query(
            `SELECT * FROM personnel 
             WHERE role IN ('CEO', 'EXECUTIVE', 'PM', 'PL') 
             ORDER BY 
                CASE role 
                    WHEN 'CEO' THEN 1 
                    WHEN 'EXECUTIVE' THEN 2 
                    WHEN 'PM' THEN 3 
                    WHEN 'PL' THEN 4 
                END, name`
        )
        res.json(rows)
    } catch (err) {
        console.error(err)
        res.status(500).json({ error: 'Failed to fetch PM list' })
    }
})

// ==================== Projects APIs ====================
app.get('/api/projects', async (req, res) => {
    try {
        const query = `
            SELECT id, code, name, client, address, 
                   TO_CHAR(start_date, 'YYYY-MM-DD') as start_date, 
                   TO_CHAR(end_date, 'YYYY-MM-DD') as end_date, 
                   description, security_level, pm_name, regulation_type, status, created_at, updated_at, site_id
            FROM projects 
            ORDER BY created_at DESC
        `
        const { rows } = await pool.query(query)
        res.json(rows)
    } catch (err) {
        console.error(err)
        res.status(500).json({ error: 'Failed to fetch projects' })
    }
})

app.get('/api/projects/:id', async (req, res) => {
    try {
        const { id } = req.params
        const { rows } = await pool.query('SELECT * FROM projects WHERE id = $1', [id])
        if (rows.length === 0) {
            return res.status(404).json({ error: 'Project not found' })
        }
        res.json(rows[0])
    } catch (err) {
        console.error(err)
        res.status(500).json({ error: 'Failed to fetch project' })
    }
})

app.post('/api/projects', async (req, res) => {
    try {
        const { code, name, client, address, start_date, end_date, security_level, pm_name, regulation_type, status } = req.body

        const query = `
            INSERT INTO projects (code, name, client, address, start_date, end_date, security_level, pm_name, regulation_type, status)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
            RETURNING id, code, name, client, address, 
                      TO_CHAR(start_date, 'YYYY-MM-DD') as start_date, 
                      TO_CHAR(end_date, 'YYYY-MM-DD') as end_date, 
                      description, security_level, pm_name, regulation_type, status, created_at, updated_at, site_id
        `

        const { rows } = await pool.query(query, [code, name, client, address, start_date, end_date, security_level, pm_name, regulation_type, status])
        res.status(201).json(rows[0])
    } catch (err) {
        console.error(err)
        res.status(500).json({ error: 'Failed to create project', details: err.message })
    }
})

app.put('/api/projects/:id', async (req, res) => {
    try {
        const { id } = req.params
        const { code, name, client, address, start_date, end_date, security_level, pm_name, regulation_type, status } = req.body

        const query = `
            UPDATE projects 
            SET code = $1, name = $2, client = $3, address = $4, start_date = $5, end_date = $6,
                security_level = $7, pm_name = $8, regulation_type = $9, status = $10, updated_at = CURRENT_TIMESTAMP
            WHERE id = $11
            RETURNING id, code, name, client, address, 
                      TO_CHAR(start_date, 'YYYY-MM-DD') as start_date, 
                      TO_CHAR(end_date, 'YYYY-MM-DD') as end_date, 
                      description, security_level, pm_name, regulation_type, status, created_at, updated_at, site_id
        `

        const { rows } = await pool.query(query, [code, name, client, address, start_date, end_date, security_level, pm_name, regulation_type, status, id])

        if (rows.length === 0) {
            return res.status(404).json({ error: 'Project not found' })
        }

        res.json(rows[0])
    } catch (err) {
        console.error(err)
        res.status(500).json({ error: 'Failed to update project', details: err.message })
    }
})

app.delete('/api/projects/:id', async (req, res) => {
    try {
        const { id } = req.params
        const { rows } = await pool.query('DELETE FROM projects WHERE id = $1 RETURNING id', [id])

        if (rows.length === 0) {
            return res.status(404).json({ error: 'Project not found' })
        }

        res.json({ message: 'Project deleted successfully' })
    } catch (err) {
        console.error(err)
        res.status(500).json({ error: 'Failed to delete project' })
    }
})


// ==================== SWMS APIs ====================
// NOTE: Deprecated legacy SWMS router (duplicates newer /routes/swms* and can break when schemas diverge).
// require('./swms_routes')(app, pool)


// ==================== SUMMARY APIs ====================
const emsSummaryRouter = require('./routes/ems_summary')(pool)
const swmsSummaryRouter = require('./routes/swms_summary')(pool)
app.use('/api/ems', emsSummaryRouter)
app.use('/api/swms', swmsSummaryRouter)


// ==================== REPORTS APIs ====================
const reportsRouter = require('./routes/reports')(pool)
app.use('/api/reports', reportsRouter)

if (require.main === module) {
    app.listen(PORT, () => {
        console.log(`Server is running on http://localhost:${PORT}`)
    })
}

// --- SWMS Routes ---
app.use('/api/swms', require('./routes/swms')(pool))
app.use('/api/swms', require('./routes/swms_analytics')(pool))
app.use('/api/swms', require('./routes/swms_dashboard')(pool))
app.use('/api/swms', require('./routes/swms_market')(pool))
app.use('/api/swms', require('./routes/swms_pricing')(pool))

module.exports = app


