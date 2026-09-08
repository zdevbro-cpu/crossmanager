// 마이그레이션 SQL 파일을 적용한다.
//
//   node scripts/apply-migration.js migrations/20260908_m0_core_master.sql
//   node scripts/apply-migration.js <파일> --check    적용 여부만 확인(실행 안 함)
//
// 이 저장소에는 마이그레이션 러너가 없어 파일을 psql 로 직접 넣어 왔다.
// Windows psql 은 콘솔 코드페이지 때문에 한글이 깨지고, 접속 정보도 매번 달라
// 서버와 같은 설정(env_customer.env → .env)으로 붙는 러너를 둔다.

const path = require('path')
const fs = require('fs')

const envFile = fs.existsSync(path.join(__dirname, '..', 'env_customer.env'))
    ? path.join(__dirname, '..', 'env_customer.env')
    : path.join(__dirname, '..', '.env')
require('dotenv').config({ path: envFile })

const { Client } = require('pg')

const file = process.argv[2]
const checkOnly = process.argv.includes('--check')

if (!file) {
    console.error('사용법: node scripts/apply-migration.js <마이그레이션 파일>')
    process.exit(1)
}

const abs = path.isAbsolute(file) ? file : path.join(__dirname, '..', file)
if (!fs.existsSync(abs)) {
    console.error('파일을 찾을 수 없습니다:', abs)
    process.exit(1)
}

async function main() {
    const sql = fs.readFileSync(abs, 'utf8')
    const db = new Client({
        host: process.env.DB_HOST,
        port: Number(process.env.DB_PORT || 5432),
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME,
        ssl: { rejectUnauthorized: false }
    })
    await db.connect()

    const dbName = (await db.query('SELECT current_database() d')).rows[0].d
    console.log('\n대상 DB :', process.env.DB_HOST, '/', dbName)
    console.log('파일    :', path.basename(abs), `(${sql.split('\n').length}행)`)

    if (checkOnly) {
        console.log('\n--check 모드 — 실행하지 않았습니다.')
        await db.end()
        return
    }

    // 파일 안에서 BEGIN/COMMIT 을 직접 관리한다. 여기서 감싸면 중첩된다.
    await db.query(sql)
    console.log('\n적용 완료')
    await db.end()
}

main().catch((e) => {
    console.error('\n적용 실패:', e.message)
    if (e.position) console.error('위치:', e.position)
    process.exit(1)
})
