// 만료 스캔 배치 — 설계서 7.6절
//
//   node scripts/expiry-scan.js            스캔 + 상태 갱신 + 반입 차단 반영
//   node scripts/expiry-scan.js --dry-run  결과만 출력, 변경하지 않음
//
// 동작
//   1. worker_qualification / worker_health / equipment_document 의 유효기간을
//      expiry_watch 로 모은다. 흩어진 만료일을 한 곳에서 보기 위함이다.
//   2. expire_date - today <= alert_days  → WARNING
//      expire_date <  today               → EXPIRED
//   3. EXPIRED 가 근로자 자격·건강이면 해당 근로자의 현장 배정을
//      entry_status = BLOCKED 로 바꾼다. 만료는 곧 현장 반입 거부다(개요서 5.2).
//
// 유효기간 2원 구분(설계서 6.3)
//   여기서 다루는 것은 '자격 유효기간'뿐이다.
//   문서의 법정 보존연한(documents.retention_until)은 파기 배치 소관이고
//   성격이 달라 섞지 않는다.

const path = require('path')
const fs = require('fs')

const envFile = fs.existsSync(path.join(__dirname, '..', 'env_customer.env'))
    ? path.join(__dirname, '..', 'env_customer.env')
    : path.join(__dirname, '..', '.env')
require('dotenv').config({ path: envFile })

const { Client } = require('pg')
const dryRun = process.argv.includes('--dry-run')

async function main() {
    const db = new Client({
        host: process.env.DB_HOST, port: Number(process.env.DB_PORT || 5432),
        user: process.env.DB_USER, password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME, ssl: { rejectUnauthorized: false }
    })
    await db.connect()
    console.log('\n만료 스캔', dryRun ? '(dry-run)' : '', '—', new Date().toISOString().slice(0, 16).replace('T', ' '))

    if (!dryRun) {
        // 1) 근로자 자격
        await db.query(`
            INSERT INTO expiry_watch (target_type, target_id, owner_type, owner_id, title, expire_date, alert_days)
            SELECT 'WORKER_QUAL', q.id::text, 'WORKER', q.worker_id::text,
                   w.name || ' — ' || COALESCE(q.qual_name, q.qual_type_code), q.expire_date, 30
              FROM worker_qualification q
              JOIN worker w ON w.id = q.worker_id
             WHERE q.expire_date IS NOT NULL AND q.deleted_at IS NULL
            ON CONFLICT (target_type, target_id)
            DO UPDATE SET expire_date = EXCLUDED.expire_date, title = EXCLUDED.title, updated_at = NOW()`)

        // 2) 근로자 건강검진
        await db.query(`
            INSERT INTO expiry_watch (target_type, target_id, owner_type, owner_id, title, expire_date, alert_days)
            SELECT 'WORKER_HEALTH', h.id::text, 'WORKER', h.worker_id::text,
                   w.name || ' — ' || COALESCE(h.exam_type, '건강검진'), h.expire_date, 30
              FROM worker_health h
              JOIN worker w ON w.id = h.worker_id
             WHERE h.expire_date IS NOT NULL AND h.deleted_at IS NULL
            ON CONFLICT (target_type, target_id)
            DO UPDATE SET expire_date = EXCLUDED.expire_date, title = EXCLUDED.title, updated_at = NOW()`)

        // 3) 장비 서류 (등록증·검사증·보험)
        await db.query(`
            INSERT INTO expiry_watch (target_type, target_id, owner_type, owner_id, title, expire_date, alert_days)
            SELECT 'EQUIP_DOC', e.id::text, 'EQUIPMENT', e.equipment_id,
                   e.equipment_id || ' — ' || e.doc_type_code, e.expire_date, 30
              FROM equipment_document e
             WHERE e.expire_date IS NOT NULL AND e.deleted_at IS NULL
            ON CONFLICT (target_type, target_id)
            DO UPDATE SET expire_date = EXCLUDED.expire_date, title = EXCLUDED.title, updated_at = NOW()`)

        // 4) 상태 갱신
        await db.query(`
            UPDATE expiry_watch SET status = CASE
                     WHEN expire_date < CURRENT_DATE THEN 'EXPIRED'
                     WHEN expire_date - CURRENT_DATE <= alert_days THEN 'WARNING'
                     ELSE 'VALID' END,
                   updated_at = NOW()`)

        // 5) 만료된 자격·건강을 가진 근로자는 현장 반입을 막는다
        const blocked = await db.query(`
            UPDATE worker_site_assignment a
               SET entry_status = 'BLOCKED',
                   blocked_reason = '자격 또는 건강검진 만료',
                   updated_at = NOW()
             WHERE a.entry_status = 'ALLOWED'
               AND EXISTS (SELECT 1 FROM expiry_watch e
                            WHERE e.status = 'EXPIRED'
                              AND e.owner_type = 'WORKER'
                              AND e.owner_id = a.worker_id::text)
            RETURNING a.id`)

        // 만료가 해소되면 다시 허용한다
        const released = await db.query(`
            UPDATE worker_site_assignment a
               SET entry_status = 'ALLOWED', blocked_reason = NULL, updated_at = NOW()
             WHERE a.entry_status = 'BLOCKED'
               AND NOT EXISTS (SELECT 1 FROM expiry_watch e
                                WHERE e.status = 'EXPIRED'
                                  AND e.owner_type = 'WORKER'
                                  AND e.owner_id = a.worker_id::text)
            RETURNING a.id`)

        if (blocked.rowCount) console.log('  반입 차단 전환 :', blocked.rowCount, '건')
        if (released.rowCount) console.log('  반입 허용 복구 :', released.rowCount, '건')
    }

    const sum = await db.query(`
        SELECT status, count(*)::int n FROM expiry_watch GROUP BY status ORDER BY status`)
    console.log('\n감시 대상')
    if (sum.rowCount === 0) console.log('  (없음 — 자격·검사증 데이터가 아직 등록되지 않았습니다)')
    sum.rows.forEach(r => console.log('  ', r.status.padEnd(8), r.n, '건'))

    const soon = await db.query(`
        SELECT title, expire_date, status, expire_date - CURRENT_DATE AS d
          FROM expiry_watch WHERE status IN ('WARNING','EXPIRED')
         ORDER BY expire_date LIMIT 20`)
    if (soon.rowCount) {
        console.log('\n조치 필요')
        soon.rows.forEach(r => console.log(
            '  ', r.status === 'EXPIRED' ? '[만료]' : `[D${r.d >= 0 ? '-' + r.d : '+' + -r.d}]`,
            r.expire_date.toISOString().slice(0, 10), r.title))
    }

    await db.end()
    console.log('')
}

main().catch((e) => { console.error('\n스캔 실패:', e.message, '\n'); process.exit(1) })
