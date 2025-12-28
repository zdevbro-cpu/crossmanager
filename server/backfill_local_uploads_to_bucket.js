/**
 * Backfill "local-only" document files to Firebase Storage so deployed server can access them.
 *
 * ?€??
 * - document_versions.file_path ê°€ "documents/..." ê°€ ?„ë‹Œ ?¨ìˆœ ?Œì¼ëª?ë¡œì»¬ ?”ìŠ¤???€??ì¼€?´ìŠ¤)
 * - document_versions.file_content ê°€ ë¹„ì–´?ˆê±°??NULL ??ì¼€?´ìŠ¤
 * - Server/uploads/<file_path> ?Œì¼???¤ì œë¡?ì¡´ì¬?˜ëŠ” ì¼€?´ìŠ¤
 *
 * ?™ì‘:
 * - uploadsDir ?ì„œ ?Œì¼???½ì–´ ë²„í‚· documents/<project_id|global>/<filename> ë¡??…ë¡œ??
 * - document_versions.file_path ë¥??´ë‹¹ destination ?¼ë¡œ ?…ë°?´íŠ¸
 *
 * ?ˆì „?¥ì¹˜:
 * - ê¸°ë³¸?€ DRY RUN ?…ë‹ˆ??
 * - ?¤ì œ ë°˜ì˜?€ `RUN=1` ?˜ê²½ë³€?˜ë¡œë§??™ì‘?©ë‹ˆ??
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
  return 'crossmanager-482403.appspot.com'
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


