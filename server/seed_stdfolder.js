/**
 * seed_stdfolder.js
 * 1) 기존 documents / document_versions 전체 삭제
 * 2) Data/CrossDoc/StdFolder 의 각 폴더에서 파일 10개씩
 *    Firebase Storage 업로드 + DB 등록
 */

const path = require('path')
const fs = require('fs')

// Load env
const envPath = path.join(__dirname, '..', 'functions', '.env')
require('dotenv').config({ path: envPath })

const { Pool } = require('../functions/node_modules/pg')
const admin = require('../functions/node_modules/firebase-admin')

// DB 연결
const pool = new Pool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  ssl: { rejectUnauthorized: false },
})

// Firebase 초기화
const serviceAccountPath = path.join(__dirname, 'serviceAccountKey.json')
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(require(serviceAccountPath)),
    storageBucket: 'crossmanager-482403.firebasestorage.app',
  })
}
const bucket = admin.storage().bucket()

// StdFolder 경로
const STD_FOLDER = path.join(__dirname, '..', 'Data', 'CrossDoc', 'StdFolder')

// 카테고리 매핑 (폴더명 → category)
const FOLDER_MAP = {
  '00_공무_행정': '00_공무_행정',
  '01_안전_보건': '01_안전_보건',
  '02_공사_작업': '02_공사_작업',
  '03_장비_공도구': '03_장비_공도구',
  '04_기록_자료': '04_기록_자료',
  '99_미분류': '99_미분류',
}

const FILES_PER_FOLDER = 10

async function run() {
  const client = await pool.connect()
  try {
    // 1. 기존 데이터 삭제
    console.log('기존 document_versions 삭제...')
    await client.query('DELETE FROM document_versions')
    console.log('기존 documents 삭제...')
    await client.query('DELETE FROM documents')
    console.log('삭제 완료')

    // 프로젝트 ID 가져오기
    const { rows: projects } = await client.query('SELECT id FROM projects ORDER BY created_at LIMIT 1')
    if (!projects.length) { console.error('프로젝트 없음'); return }
    const projectId = projects[0].id
    console.log('프로젝트 ID:', projectId)

    // 2. 폴더별 파일 업로드 + 등록
    const folders = fs.readdirSync(STD_FOLDER).filter(f =>
      fs.statSync(path.join(STD_FOLDER, f)).isDirectory()
    )

    for (const folder of folders) {
      const category = FOLDER_MAP[folder] || folder
      const folderPath = path.join(STD_FOLDER, folder)
      const files = fs.readdirSync(folderPath)
        .filter(f => fs.statSync(path.join(folderPath, f)).isFile())
        .slice(0, FILES_PER_FOLDER)

      console.log(`\n[${folder}] ${files.length}개 등록 중...`)

      for (const filename of files) {
        const localPath = path.join(folderPath, filename)
        const storagePath = `documents/${projectId}/${folder}/${filename}`
        const ext = path.extname(filename).toLowerCase()

        try {
          // Firebase Storage 업로드
          await bucket.upload(localPath, {
            destination: storagePath,
            metadata: { contentType: getContentType(ext) },
          })
          console.log(`  업로드: ${filename}`)

          const fileSize = fs.statSync(localPath).size

          // DB: documents 등록
          const { rows: docRows } = await client.query(`
            INSERT INTO documents (project_id, category, type, name, status, security_level, current_version)
            VALUES ($1, $2, 'FILE', $3, 'ACTIVE', 'NORMAL', 1)
            RETURNING id
          `, [projectId, category, filename])

          const docId = docRows[0].id

          // DB: document_versions 등록
          await client.query(`
            INSERT INTO document_versions (document_id, version, file_path, file_size, change_log)
            VALUES ($1, 1, $2, $3, '초기 등록')
          `, [docId, storagePath, fileSize])

          console.log(`  DB 등록: ${filename} (${docId})`)
        } catch (e) {
          console.error(`  실패: ${filename} - ${e.message}`)
        }
      }
    }

    console.log('\n완료!')
  } finally {
    client.release()
    await pool.end()
  }
}

function getContentType(ext) {
  const map = {
    '.pdf': 'application/pdf',
    '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    '.xls': 'application/vnd.ms-excel',
    '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    '.doc': 'application/msword',
    '.hwp': 'application/x-hwp',
    '.hwpx': 'application/x-hwpx',
    '.pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    '.ppt': 'application/vnd.ms-powerpoint',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.png': 'image/png',
    '.gif': 'image/gif',
    '.txt': 'text/plain',
    '.zip': 'application/zip',
  }
  return map[ext] || 'application/octet-stream'
}

run().catch(e => { console.error(e); process.exit(1) })
