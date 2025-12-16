const path = require('path')
const fs = require('fs')
const { Pool } = require('pg')

require('dotenv').config({ path: path.join(__dirname, '.env') })

const dbConfig = {
    user: process.env.DB_USER || 'postgres',
    database: process.env.DB_NAME || 'cross_db',
    password: process.env.DB_PASSWORD || 'password',
    port: Number(process.env.DB_PORT || 5432),
    host: process.env.DB_HOST || 'localhost',
}

// Keep behavior aligned with Server/index.js: use socket when configured, otherwise enable SSL for TCP.
const runningOnGcp = !!(process.env.K_SERVICE || process.env.FUNCTION_TARGET)
const preferSocket = process.env.FORCE_TCP !== 'true' && (process.env.USE_CLOUD_SQL_SOCKET === 'true' || runningOnGcp)
if (preferSocket && dbConfig.host && String(dbConfig.host).startsWith('/cloudsql')) {
    console.log('[DB][Seed] Using Cloud SQL Socket:', dbConfig.host)
} else {
    dbConfig.ssl = { rejectUnauthorized: false }
    console.log('[DB][Seed] Using TCP Connection (SSL):', dbConfig.host, dbConfig.port)
}

const pool = new Pool(dbConfig)

async function getMissingPmsResourceTables(client) {
    const required = [
        'person',
        'employment',
        'qualification_cert',
        'qualification_training',
        'person_cert',
        'person_training',
        'trade_group',
        'work_type',
        'override',
    ]
    const checks = await client.query(
        `SELECT relname
         FROM pg_class
         WHERE relkind = 'r' AND relname = ANY($1::text[])`,
        [required]
    )
    const present = new Set(checks.rows.map((r) => r.relname))
    return required.filter((t) => !present.has(t))
}

async function applyPmsResourceMigrations(client) {
    const migrationsDir = path.join(__dirname, 'migrations')
    if (!fs.existsSync(migrationsDir)) throw new Error(`Migrations directory not found: ${migrationsDir}`)

    const files = fs
        .readdirSync(migrationsDir)
        .filter((f) => /^\d{8}_pms_resource.*\.sql$/i.test(f))
        .sort()

    if (files.length === 0) throw new Error('No PMS resource migration files found.')

    for (const file of files) {
        const fullPath = path.join(migrationsDir, file)
        const sql = fs.readFileSync(fullPath, 'utf8')
        await client.query(sql)
    }
}

async function seed() {
    let client
    try {
        client = await pool.connect()
    } catch (err) {
        console.error('[PMS][Seed] DB connect failed:', err.message)
        throw err
    }
    try {
        await client.query('BEGIN')
        let missing = await getMissingPmsResourceTables(client)
        if (missing.length) {
            console.log('[PMS][Seed] schema missing, applying migrations...')
            await applyPmsResourceMigrations(client)
            missing = await getMissingPmsResourceTables(client)
            if (missing.length) {
                throw new Error(`PMS resource tables still missing after migrations: ${missing.join(', ')}`)
            }
        }

        console.log('[PMS][Seed] inserting sample people/certs/trainings/overrides...')

        const people = [
            { id: 1001, name: '홍길동', contact: '010-1001-0001', status: 'active', role_tags: ['ELECTRICIAN'] },
            { id: 1002, name: '김용접', contact: '010-1002-0002', status: 'active', role_tags: ['WELDER'] },
            { id: 1003, name: '박크레인', contact: '010-1003-0003', status: 'active', role_tags: ['CRANE_OP'] },
            { id: 1004, name: '이철거', contact: '010-1004-0004', status: 'active', role_tags: ['DEMOLITION'] },
            { id: 1005, name: '최신호수', contact: '010-1005-0005', status: 'active', role_tags: ['SIGNALMAN'] },
            { id: 1006, name: '정굴착', contact: '010-1006-0006', status: 'active', role_tags: ['EXCAVATOR_OP'] },
        ]

        for (const p of people) {
            await client.query(
                `INSERT INTO person (id, name, contact, status, role_tags)
                 VALUES ($1, $2, $3, $4, $5)
                 ON CONFLICT (id) DO UPDATE SET
                   name = EXCLUDED.name,
                   contact = EXCLUDED.contact,
                   status = EXCLUDED.status,
                   role_tags = EXCLUDED.role_tags,
                   updated_at = now()`,
                [p.id, p.name, p.contact, p.status, p.role_tags]
            )
        }

        const employments = [
            { person_id: 1001, hire_type: 'contract', job_family: 'electrical', job_level: 'senior', career_years: 8, wage_type: 'daily' },
            { person_id: 1002, hire_type: 'contract', job_family: 'welding', job_level: 'mid', career_years: 5, wage_type: 'daily' },
            { person_id: 1003, hire_type: 'contract', job_family: 'lifting', job_level: 'senior', career_years: 10, wage_type: 'daily' },
            { person_id: 1004, hire_type: 'contract', job_family: 'demolition', job_level: 'mid', career_years: 4, wage_type: 'daily' },
            { person_id: 1005, hire_type: 'contract', job_family: 'lifting', job_level: 'junior', career_years: 2, wage_type: 'daily' },
            { person_id: 1006, hire_type: 'contract', job_family: 'earthwork', job_level: 'mid', career_years: 6, wage_type: 'daily' },
        ]

        for (const e of employments) {
            await client.query(
                `INSERT INTO employment (person_id, hire_type, job_family, job_level, career_years, wage_type, active_flag, created_at, updated_at)
                 VALUES ($1,$2,$3,$4,$5,$6,true,now(),now())
                 ON CONFLICT DO NOTHING`,
                [e.person_id, e.hire_type, e.job_family, e.job_level, e.career_years, e.wage_type]
            )
        }

        const certRows = [
            // Electrician: satisfies WT_ELEC_LOW_VOLT (all + any)
            { person_id: 1001, cert_code: 'CERT_ELEC_WORKER_BASIC', issued_at: '2023-01-10', expires_at: '2026-06-30', status: 'verified' },
            { person_id: 1001, cert_code: 'CERT_ELEC_TECH_MANAGER', issued_at: '2023-01-10', expires_at: '2026-06-30', status: 'verified' },

            // Crane operator: expired license (fails on 2025-12-16)
            { person_id: 1003, cert_code: 'CERT_LIFT_CRANE_MOBILE', issued_at: '2020-02-01', expires_at: '2025-12-01', status: 'verified' },

            // Signalman: has cert, but training pending (fails)
            { person_id: 1005, cert_code: 'CERT_LIFT_SIGNALMAN', issued_at: '2024-03-12', expires_at: '2027-03-11', status: 'verified' },

            // Excavator: expiring soon (shows expiring_soon)
            { person_id: 1006, cert_code: 'CERT_EARTH_EXCAVATOR', issued_at: '2021-01-01', expires_at: '2025-12-26', status: 'verified' },
        ]

        for (const r of certRows) {
            await client.query(
                `INSERT INTO person_cert (person_id, cert_code, issued_at, expires_at, status, evidence_uri)
                 VALUES ($1,$2,$3,$4,$5,$6)
                 ON CONFLICT (person_id, cert_code, expires_at) DO UPDATE SET
                   status = EXCLUDED.status,
                   issued_at = EXCLUDED.issued_at,
                   evidence_uri = EXCLUDED.evidence_uri`,
                [r.person_id, r.cert_code, r.issued_at, r.expires_at, r.status, `seed://person/${r.person_id}/cert/${r.cert_code}`]
            )
        }

        const trainingRows = [
            // Electrician
            { person_id: 1001, training_code: 'TRN_SAFETY_BASIC', taken_at: '2025-01-15', expires_at: '2026-01-15', status: 'verified' },
            { person_id: 1001, training_code: 'TRN_ELECTRICAL_SPECIAL', taken_at: '2025-01-15', expires_at: '2026-01-15', status: 'verified' },

            // Welder: trainings ok, cert missing (no CERT_WELD_SMAW row)
            { person_id: 1002, training_code: 'TRN_SAFETY_BASIC', taken_at: '2025-02-01', expires_at: '2026-02-01', status: 'verified' },
            { person_id: 1002, training_code: 'TRN_WELDING_SAFETY', taken_at: '2025-02-01', expires_at: '2026-02-01', status: 'verified' },

            // Crane operator
            { person_id: 1003, training_code: 'TRN_SAFETY_BASIC', taken_at: '2025-01-10', expires_at: '2026-01-10', status: 'verified' },
            { person_id: 1003, training_code: 'TRN_LIFTING_SPECIAL', taken_at: '2025-01-10', expires_at: '2026-01-10', status: 'verified' },

            // Demolition: missing TRN_DEMOLITION_SPECIAL (WARN work type -> eligible true but missing list)
            { person_id: 1004, training_code: 'TRN_SAFETY_BASIC', taken_at: '2025-03-05', expires_at: '2026-03-05', status: 'verified' },

            // Signalman: training pending -> treated as missing
            { person_id: 1005, training_code: 'TRN_SAFETY_BASIC', taken_at: '2025-01-20', expires_at: '2026-01-20', status: 'verified' },
            { person_id: 1005, training_code: 'TRN_LIFTING_SIGNAL', taken_at: '2025-01-20', expires_at: '2026-01-20', status: 'pending' },

            // Excavator
            { person_id: 1006, training_code: 'TRN_SAFETY_BASIC', taken_at: '2025-01-02', expires_at: '2026-01-02', status: 'verified' },
        ]

        for (const r of trainingRows) {
            await client.query(
                `INSERT INTO person_training (person_id, training_code, taken_at, expires_at, status, evidence_uri)
                 VALUES ($1,$2,$3,$4,$5,$6)
                 ON CONFLICT (person_id, training_code, expires_at) DO UPDATE SET
                   status = EXCLUDED.status,
                   taken_at = EXCLUDED.taken_at,
                   evidence_uri = EXCLUDED.evidence_uri`,
                [r.person_id, r.training_code, r.taken_at, r.expires_at, r.status, `seed://person/${r.person_id}/training/${r.training_code}`]
            )
        }

        const overrides = [
            {
                scope: 'project',
                scope_ref: 'p1',
                work_type_code: 'WT_LIFT_MOBILE_CRANE_OP',
                patch_json: { required_trainings_all_add: ['TRN_LIFTING_SIGNAL'] },
                reason: '샘플: 프로젝트(p1) 이동식크레인 운전 시 신호수 교육 추가 요구',
            },
            {
                scope: 'project',
                scope_ref: 'p1',
                work_type_code: 'WT_DEMO_GENERAL',
                patch_json: { enforcement_mode_replace: 'BLOCK' },
                reason: '샘플: 프로젝트(p1) 일반철거를 BLOCK으로 강화',
            },
        ]

        for (const ov of overrides) {
            await client.query(
                `INSERT INTO override (scope, scope_ref, work_type_code, patch_json, approved_by, approved_at, reason, active_flag)
                 VALUES ($1,$2,$3,$4,$5,now(),$6,true)
                 ON CONFLICT (scope, scope_ref, work_type_code, active_flag) DO UPDATE SET
                   patch_json = EXCLUDED.patch_json,
                   approved_at = now(),
                   reason = EXCLUDED.reason`,
                [ov.scope, ov.scope_ref, ov.work_type_code, ov.patch_json, 'seed', ov.reason]
            )
        }

        await client.query(
            `SELECT setval(pg_get_serial_sequence('person','id'), GREATEST((SELECT COALESCE(MAX(id), 1) FROM person), 1), true)`
        )
        await client.query(
            `SELECT setval(pg_get_serial_sequence('employment','id'), GREATEST((SELECT COALESCE(MAX(id), 1) FROM employment), 1), true)`
        )
        await client.query(
            `SELECT setval(pg_get_serial_sequence('person_cert','id'), GREATEST((SELECT COALESCE(MAX(id), 1) FROM person_cert), 1), true)`
        )
        await client.query(
            `SELECT setval(pg_get_serial_sequence('person_training','id'), GREATEST((SELECT COALESCE(MAX(id), 1) FROM person_training), 1), true)`
        )
        await client.query(
            `SELECT setval(pg_get_serial_sequence('override','id'), GREATEST((SELECT COALESCE(MAX(id), 1) FROM override), 1), true)`
        )

        await client.query('COMMIT')

        console.log('[PMS][Seed] done.')
        console.log('Sample people IDs:', people.map((p) => p.id).join(', '))
        console.log("Try eligibility with date '2025-12-16' and work types like WT_ELEC_LOW_VOLT / WT_WELD_SMAW / WT_LIFT_MOBILE_CRANE_OP.")
    } catch (err) {
        await client.query('ROLLBACK')
        console.error('[PMS][Seed] failed:', err.message)
        throw err
    } finally {
        client.release()
    }
}

seed()
    .catch(() => process.exitCode = 1)
    .finally(async () => {
        await pool.end()
    })
