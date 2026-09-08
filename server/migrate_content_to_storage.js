/**
 * Migrate document_versions.file_content (base64) → Firebase Storage
 *
 * 실행:
 *   node migrate_content_to_storage.js          # DRY RUN (실제 변경 없음)
 *   RUN=1 node migrate_content_to_storage.js    # 실제 실행
 *
 * 동작:
 *   1. file_content 가 있는 모든 document_versions 조회
 *   2. base64 디코딩 → Firebase Storage 업로드 (documents/<project_id>/<filename>)
 *   3. file_path 를 스토리지 경로로 업데이트
 *   4. file_content NULL 처리 (용량 해제)
 */

const path = require('path')
const fs = require('fs')
require('dotenv').config({ path: path.join(__dirname, '.env.local') })
const { Pool } = require('pg')
const admin = require('firebase-admin')

const RUN = process.env.RUN === '1'

// ----------- Firebase 초기화 -----------
const serviceAccountPath = path.join(__dirname, 'serviceAccountKey.json')
const serviceAccount = require(serviceAccountPath)
const BUCKET_NAME = `${serviceAccount.project_id}.firebasestorage.app`

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  storageBucket: BUCKET_NAME
})
const bucket = admin.storage().bucket(BUCKET_NAME)

// ----------- DB 연결 -----------
const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT) || 5432,
  database: process.env.DB_NAME || 'cross_manager',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD,
})

// 파일 확장자로 Content-Type 결정
function getContentType(filename) {
  const ext = path.extname(filename).toLowerCase()
  const map = {
    '.pdf': 'application/pdf',
    '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    '.xls': 'application/vnd.ms-excel',
    '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    '.doc': 'application/msword',
    '.pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    '.ppt': 'application/vnd.ms-powerpoint',
    '.hwp': 'application/x-hwp',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
  }
  return map[ext] || 'application/octet-stream'
}

async function main() {
  console.log(`[Migrate] bucket = ${BUCKET_NAME}`)
  console.log(`[Migrate] RUN = ${RUN}`)
  console.log('[Migrate] DRY RUN — set RUN=1 to apply changes\n')

  // file_content 가 있는 rows 조회
  const { rows } = await pool.query(`
    SELECT
      v.id as version_id,
      v.document_id,
      v.file_path,
      v.version,
      v.file_content,
      d.project_id
    FROM document_versions v
    JOIN documents d ON d.id = v.document_id
    WHERE v.file_content IS NOT NULL
      AND length(v.file_content) > 100
    ORDER BY length(v.file_content) DESC
  `)

  console.log(`[Migrate] Found ${rows.length} versions with file_content\n`)

  let ok = 0, skip = 0, fail = 0
  let totalBytes = 0

  for (const row of rows) {
    const filename = row.file_path
      ? path.basename(row.file_path)
      : `${row.document_id}_${row.version || 'v1'}`

    const destination = `documents/${row.project_id || 'global'}/${filename}`
    const sizeMB = (row.file_content.length / 1024 / 1024).toFixed(2)

    console.log(`[${row.version_id}] ${filename} (${sizeMB} MB encoded) -> ${destination}`)

    if (!RUN) {
      skip++
      continue
    }

    try {
      // base64 디코딩 — DB에 base64 문자열로 저장된 경우
      let buffer
      try {
        buffer = Buffer.from(row.file_content, 'base64')
        // base64가 아닌 raw binary/text인 경우 체크
        if (buffer.length < 10) {
          buffer = Buffer.from(row.file_content, 'utf8')
        }
      } catch {
        buffer = Buffer.from(row.file_content, 'utf8')
      }

      totalBytes += buffer.length

      // Firebase Storage 업로드
      const file = bucket.file(destination)
      await file.save(buffer, {
        metadata: {
          contentType: getContentType(filename),
          metadata: {
            documentId: row.document_id,
            version: row.version || 'v1',
          }
        }
      })

      // DB 업데이트: file_path 갱신, file_content NULL
      await pool.query(
        `UPDATE document_versions SET file_path = $1, file_content = NULL WHERE id = $2`,
        [destination, row.version_id]
      )

      console.log(`  ✓ uploaded (${(buffer.length / 1024 / 1024).toFixed(2)} MB actual)`)
      ok++
    } catch (e) {
      console.error(`  ✗ FAILED: ${e.message}`)
      fail++
    }
  }

  await pool.end()

  console.log('\n========== 결과 ==========')
  if (RUN) {
    console.log(`성공: ${ok}, 실패: ${fail}`)
    console.log(`총 업로드: ${(totalBytes / 1024 / 1024).toFixed(2)} MB`)
  } else {
    console.log(`대상: ${rows.length}건 (DRY RUN — 변경 없음)`)
    console.log('실제 실행: RUN=1 node migrate_content_to_storage.js')
  }
}

main().catch((e) => {
  console.error('[Migrate] fatal error:', e)
  process.exitCode = 1
})
