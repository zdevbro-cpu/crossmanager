/**
 * Backfill "local-only" document files to Firebase Storage so deployed server can access them.
 *
 * 대상:
 * - document_versions.file_path 가 "documents/..." 가 아닌 단순 파일명(로컬 디스크 저장 케이스)
 * - document_versions.file_content 가 비어있거나 NULL 인 케이스
 * - Server/uploads/<file_path> 파일이 실제로 존재하는 케이스
 *
 * 동작:
 * - uploadsDir 에서 파일을 읽어 버킷 documents/<project_id|global>/<filename> 로 업로드
 * - document_versions.file_path 를 해당 destination 으로 업데이트
 *
 * 안전장치:
 * - 기본은 DRY RUN 입니다.
 * - 실제 반영은 `RUN=1` 환경변수로만 동작합니다.
 */

const path = require('path')
const fs = require('fs')
require('dotenv').config({ path: path.join(__dirname, '.env') })
const { Pool } = require('pg')
const admin = require('firebase-admin')

const RUN = process.env.RUN === '1'

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
  return 'crossmanager-1e21c.appspot.com'
}

function initAdmin() {
  if (admin.apps.length) return

  const bucketName = resolveBucketName()
  const serviceAccountPath = path.join(__dirname, 'serviceAccountKey.json')

  if (fs.existsSync(serviceAccountPath)) {
    const serviceAccount = require(serviceAccountPath)
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      storageBucket: bucketName
    })
  } else {
    admin.initializeApp({ storageBucket: bucketName })
  }
}

async function main() {
  initAdmin()
  const bucketName = resolveBucketName()
  const bucket = admin.storage().bucket(bucketName)
  console.log('[Backfill] bucket =', bucketName)
  console.log('[Backfill] RUN =', RUN)

  const pool = new Pool({
    user: process.env.DB_USER,
    host: process.env.DB_HOST,
    database: process.env.DB_NAME,
    password: process.env.DB_PASSWORD,
    port: Number(process.env.DB_PORT) || 5432,
    ssl: { rejectUnauthorized: false }
  })

  const uploadsDir = path.join(__dirname, 'uploads')
  if (!fs.existsSync(uploadsDir)) {
    console.error('[Backfill] uploads dir missing:', uploadsDir)
    process.exitCode = 1
    await pool.end()
    return
  }

  const { rows } = await pool.query(`
    SELECT
      v.id as version_id,
      v.document_id,
      v.file_path,
      v.file_content,
      d.project_id
    FROM document_versions v
    JOIN documents d ON d.id = v.document_id
    WHERE v.file_path IS NOT NULL
      AND v.file_path NOT LIKE 'documents/%'
      AND (v.file_content IS NULL OR v.file_content = '')
    ORDER BY v.created_at DESC
    LIMIT 200
  `)

  if (rows.length === 0) {
    console.log('[Backfill] No candidates')
    await pool.end()
    return
  }

  console.log(`[Backfill] Candidates: ${rows.length}`)

  for (const row of rows) {
    const filename = path.basename(row.file_path)
    const localPath = path.join(uploadsDir, filename)
    const destination = `documents/${row.project_id || 'global'}/${filename}`

    if (!fs.existsSync(localPath)) {
      console.warn('[Backfill] missing local file:', filename)
      continue
    }

    console.log('[Backfill]', row.version_id, '->', destination)

    if (!RUN) continue

    await bucket.upload(localPath, {
      destination,
      metadata: { contentType: 'application/octet-stream' }
    })

    await pool.query('UPDATE document_versions SET file_path = $1 WHERE id = $2', [destination, row.version_id])
  }

  await pool.end()
  console.log('[Backfill] done')
}

main().catch((e) => {
  console.error('[Backfill] failed:', e)
  process.exitCode = 1
})

