// DMS 드라이브 연동 상태를 실제로 확인한다.
// 말이 아니라 실행 결과로 판단하기 위한 스크립트다.
//
//   cd C:\ProjectCode\Cross\Server
//   node scripts/verify-dms.js
//
// 서버가 떠 있지 않아도 된다. DB 와 드라이브에 직접 붙어 확인한다.

const path = require('path')
const fs = require('fs')

const envFile = fs.existsSync(path.join(__dirname, '..', 'env_customer.env'))
    ? path.join(__dirname, '..', 'env_customer.env')
    : path.join(__dirname, '..', '.env')
require('dotenv').config({ path: envFile })

const { Client } = require('pg')
const { google } = require('googleapis')

const ok = (s) => console.log('  [OK]   ' + s)
const ng = (s) => { console.log('  [실패] ' + s); failed++ }
let failed = 0

async function main() {
    console.log('\n설정 파일:', path.basename(envFile), '\n')

    // 1) DB
    console.log('[1] 데이터베이스')
    const db = new Client({
        host: process.env.DB_HOST,
        port: Number(process.env.DB_PORT || 5432),
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME,
        ssl: { rejectUnauthorized: false }
    })
    await db.connect()
    const isLocal = ['localhost', '127.0.0.1'].includes(String(process.env.DB_HOST))
    console.log('  접속:', process.env.DB_HOST, '/', (await db.query('SELECT current_database() d')).rows[0].d)
    isLocal ? ng('로컬 DB 에 붙어 있다. 실 데이터는 Cloud SQL 이다.') : ok('Cloud SQL 에 접속')

    const hq = await db.query('SELECT id, name FROM projects WHERE is_hq = TRUE')
    hq.rowCount ? ok('본사 레코드 존재: ' + hq.rows[0].name) : ng('본사 레코드 없음')

    const fk = await db.query(
        "SELECT confdeltype FROM pg_constraint WHERE conname = 'documents_project_id_fkey'")
    fk.rows[0]?.confdeltype === 'r'
        ? ok('현장 문서 삭제 방지(RESTRICT) 적용됨')
        : ng('삭제 방지 미적용 — 현장을 지우면 문서가 함께 사라진다')

    const cols = await db.query(`
        SELECT count(*)::int n FROM information_schema.columns
         WHERE (table_name='documents' AND column_name IN ('deleted_at','is_personal_data','retention_until'))
            OR (table_name='document_versions' AND column_name IN ('storage_kind','drive_file_id'))`)
    cols.rows[0].n === 5 ? ok('신규 컬럼 5개 존재') : ng('신규 컬럼 ' + cols.rows[0].n + '/5')

    const log = await db.query("SELECT to_regclass('public.document_access_log') t")
    log.rows[0].t ? ok('감사 로그 테이블 존재') : ng('감사 로그 테이블 없음')

    const b64 = await db.query(
        'SELECT count(*)::int n FROM document_versions WHERE file_content IS NOT NULL')
    console.log('  참고: 파일 본문이 DB 에 남은 과거 버전 ' + b64.rows[0].n + '건 (신규는 저장하지 않음)')

    // 2) 드라이브
    console.log('\n[2] 구글 드라이브')
    const o = new google.auth.OAuth2(
        process.env.GOOGLE_OAUTH_CLIENT_ID,
        process.env.GOOGLE_OAUTH_CLIENT_SECRET,
        process.env.GOOGLE_OAUTH_REDIRECT_URI)
    o.setCredentials({ refresh_token: process.env.GOOGLE_OAUTH_REFRESH_TOKEN })

    try {
        await o.getAccessToken()
        const drive = google.drive({ version: 'v3', auth: o })
        const me = await drive.about.get({ fields: 'user(emailAddress)' })
        ok('토큰 유효 — 계정 ' + me.data.user.emailAddress)

        const folderId = process.env.GOOGLE_DRIVE_FOLDER_ID
        if (folderId) {
            const f = await drive.files.get({ fileId: folderId, fields: 'name', supportsAllDrives: true })
            ok('보관 폴더 접근 — ' + f.data.name)
        } else {
            ng('GOOGLE_DRIVE_FOLDER_ID 미설정 — 드라이브 최상위에 저장된다')
        }

        // 실제 왕복 시험
        const gd = require('../lib/drive')
        const body = Buffer.from('verify ' + new Date().toISOString())
        const up = await gd.uploadToDrive({ buffer: body, fileName: '__verify.txt', mimeType: 'text/plain' })
        const dn = await gd.downloadFromDrive(up.driveFileId)
        const chunks = []
        for await (const c of dn.stream) chunks.push(c)
        Buffer.concat(chunks).equals(body)
            ? ok('업로드 → 다운로드 내용 일치 (' + body.length + 'B)')
            : ng('업로드한 내용과 받은 내용이 다르다')
        await gd.trashInDrive(up.driveFileId)
        ok('시험 파일 휴지통 정리')
    } catch (e) {
        ng('드라이브: ' + e.message)
    }

    await db.end()
    console.log('\n결과: ' + (failed === 0 ? '이상 없음' : failed + '건 실패') + '\n')
    process.exit(failed === 0 ? 0 : 1)
}

main().catch((e) => { console.error('\n검증 중단:', e.message, '\n'); process.exit(1) })
