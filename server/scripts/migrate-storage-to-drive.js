// 기존 Firebase Storage 문서를 구글 드라이브로 이관한다.
//
//   node scripts/migrate-storage-to-drive.js --dry-run     현황만 출력
//   node scripts/migrate-storage-to-drive.js --limit 5     5건만 이관 (시험)
//   node scripts/migrate-storage-to-drive.js               전체 이관
//
// 안전 장치
//   - 원본 Firebase 파일은 지우지 않는다. 드라이브에 복사본을 만들 뿐이다.
//   - file_path 도 그대로 둔다. drive_file_id 만 채우고 storage_kind 를 바꾼다.
//     되돌리려면 drive_file_id 를 NULL, storage_kind 를 'firebase' 로 되돌리면 된다.
//   - 이미 옮긴 건(drive_file_id 존재)은 건너뛴다. 중간에 끊겨도 다시 돌리면 이어서 한다.
//   - 한 건이 실패해도 나머지는 계속 진행하고, 실패 목록을 마지막에 출력한다.

const path = require('path')
const { execFileSync } = require('child_process')

require('dotenv').config({ path: path.join(__dirname, '..', 'env_customer.env') })

const { Client } = require('pg')
const gdrive = require('../lib/drive')

const BUCKET = process.env.FIREBASE_STORAGE_BUCKET || 'crossmanager-482403.firebasestorage.app'
const args = process.argv.slice(2)
const dryRun = args.includes('--dry-run')
const limitIdx = args.indexOf('--limit')
const limit = limitIdx >= 0 ? Number(args[limitIdx + 1]) : null

// 버킷 파일은 HTTP 로 직접 받는다.
// Windows 의 gcloud 는 배치 파일이라 Node 20 에서 execFile 로 실행되지 않고,
// 수백 건마다 프로세스를 띄우는 것도 느리다. 토큰만 한 번 받아 재사용한다.
function getAccessToken() {
    const out = execFileSync(
        process.env.COMSPEC || 'cmd.exe',
        ['/c', 'gcloud auth print-access-token'],
        { stdio: ['ignore', 'pipe', 'pipe'] }
    )
    const t = String(out).trim()
    if (!t || t.length < 20) throw new Error('gcloud 액세스 토큰을 받지 못했습니다')
    return t
}

async function downloadFromBucket(token, objectPath) {
    const url = `https://storage.googleapis.com/storage/v1/b/${encodeURIComponent(BUCKET)}` +
                `/o/${encodeURIComponent(objectPath)}?alt=media`
    const r = await fetch(url, { headers: { Authorization: 'Bearer ' + token } })
    if (!r.ok) throw new Error(`버킷 응답 ${r.status}`)
    return Buffer.from(await r.arrayBuffer())
}

function mimeOf(name) {
    const e = path.extname(name).toLowerCase()
    return {
        '.pdf': 'application/pdf', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
        '.gif': 'image/gif', '.txt': 'text/plain', '.csv': 'text/csv',
        '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        '.xls': 'application/vnd.ms-excel',
        '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        '.doc': 'application/msword',
        '.pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
        '.hwp': 'application/x-hwp', '.zip': 'application/zip'
    }[e] || 'application/octet-stream'
}

async function main() {
    const db = new Client({
        host: process.env.DB_HOST, port: Number(process.env.DB_PORT || 5432),
        user: process.env.DB_USER, password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME, ssl: { rejectUnauthorized: false }
    })
    await db.connect()

    const { rows } = await db.query(`
        SELECT v.id, v.file_path, v.file_size, d.name
          FROM document_versions v
          JOIN documents d ON d.id = v.document_id
         WHERE v.drive_file_id IS NULL
           AND v.file_path IS NOT NULL
           AND v.file_path NOT LIKE 'http%'
         ORDER BY v.created_at
         ${limit ? 'LIMIT ' + Number(limit) : ''}`)

    console.log('\n이관 대상:', rows.length, '건')
    console.log('버킷      :', BUCKET)

    if (dryRun) {
        rows.slice(0, 10).forEach(r => console.log('  -', r.name))
        if (rows.length > 10) console.log('  ... 외', rows.length - 10, '건')
        await db.end()
        return
    }

    const token = getAccessToken()
    let done = 0
    const failed = []

    for (const r of rows) {
        try {
            const buf = await downloadFromBucket(token, r.file_path)
            if (buf.length === 0) throw new Error('내려받은 파일이 0바이트')

            // 이름은 문서명 + 원래 확장자. 드라이브에서 사람이 알아볼 수 있게 한다.
            const ext = path.extname(r.file_path)
            const base = String(r.name || path.basename(r.file_path)).replace(/[\\/:*?"<>|]/g, '_')
            const fileName = base.toLowerCase().endsWith(ext.toLowerCase()) ? base : base + ext

            const up = await gdrive.uploadToDrive({
                buffer: buf, fileName, mimeType: mimeOf(r.file_path)
            })

            // file_path 는 그대로 두어 되돌릴 수 있게 한다.
            await db.query(
                `UPDATE document_versions
                    SET drive_file_id = $1, storage_kind = 'gdrive',
                        file_size = COALESCE(file_size, $2)
                  WHERE id = $3`,
                [up.driveFileId, buf.length, r.id])

            done++
            if (done % 25 === 0 || done === rows.length) {
                console.log(`  ${done}/${rows.length} 완료`)
            }
        } catch (e) {
            failed.push({ name: r.name, path: r.file_path, err: String(e.message).split('\n')[0].slice(0, 100) })
        }
    }

    console.log('\n성공:', done, '건 / 실패:', failed.length, '건')
    if (failed.length) {
        console.log('\n실패 목록 (원본은 Firebase 에 그대로 남아 있어 계속 열립니다):')
        failed.slice(0, 15).forEach(f => console.log('  -', f.name, '|', f.err))
        if (failed.length > 15) console.log('  ... 외', failed.length - 15, '건')
        console.log('\n다시 실행하면 실패분만 재시도합니다.')
    }

    await db.end()
}

main().catch((e) => { console.error('\n중단:', e.message, '\n'); process.exit(1) })
