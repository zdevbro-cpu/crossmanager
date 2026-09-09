// 현장 위험성평가 파일을 파싱해 위험요인 라이브러리 씨앗을 만든다.
//
//   node scripts/parse-ra-files.js --scan            대상 파일만 찾아 출력
//   node scripts/parse-ra-files.js --inspect <경로>  한 파일의 표 구조를 본다
//   node scripts/parse-ra-files.js --load            정제해서 hazard_item 에 적재
//
// 왜 이 경로인가
//   sms/src/data/riskTemplates.ts 는 1,634건 전부 플레이스홀더라 씨앗으로 쓸 수 없다
//   (risk_factor 전부 "위험성", measure 전부 "내용 확인 필요").
//   실제 제출·승인된 문구는 현장 RA 파일에만 있다(설계서 11.4.3).
//
// 적재 방침 (설계서 12.2.3)
//   - 플레이스홀더·빈 행 제외, 중복 병합
//   - 담당자명은 담지 않는다
//   - active=false 로 넣는다. 안전관리팀 검수 전에는 현장에 노출되지 않는다.

const fs = require('fs')
const path = require('path')
const XLSX = require('xlsx')

const ROOT = process.env.CROSSDOC_ROOT || 'Z:\\CrossDoc'
const args = process.argv.slice(2)

// 현장 RA 파일의 컬럼 이름은 현장마다 조금씩 다르다. 별칭으로 흡수한다.
const FIELD = {
    process: ['세부공정', '공정', '작업명', '단위작업', '세부작업', '작업단계'],
    location: ['작업위치', '위치', '장소'],
    hazardClass: ['위험분류', '유해위험요인분류', '분류'],
    hazard: ['위험발생 상황 및 결과', '유해위험요인', '위험요인', '위험발생상황', '위험성'],
    accident: ['재해형태', '재해유형', '사고형태'],
    legal: ['관련근거', '법적근거', '관련법규', '법규'],
    control: ['현재의 안전보건조치', '현재 안전보건조치', '현재조치', '기존 안전조치'],
    freq: ['가능성', '빈도'],
    sev: ['중대성', '강도'],
    grade: ['위험성', '위험등급', '등급'],
    measure: ['감소대책', '개선대책', '위험성 감소대책', '안전대책']
}

const PLACEHOLDER = ['', '-', '위험성', '내용 확인 필요', '확인 필요', 'N/A', '해당없음']

// 구버전 .xls 는 인코딩이 어긋나 U+FFFD(치환문자)가 섞여 나오는 셀이 있다.
// 그대로 저장하면 화면에 마름모 물음표로 보인다. 깨진 값은 아예 담지 않는다.
const norm = (v) => {
    const t = String(v == null ? '' : v).replace(/\s+/g, ' ').trim()
    return t.includes('�') ? '' : t
}
const isBlank = (v) => PLACEHOLDER.includes(norm(v))
// 위험성 등급 — 빈도x강도 점수를 먼저 내고 등급으로 치환한다.
// 경계는 현장 RA 파일 142행을 역산해 확정했다(6/8/9=D, 10/12=C, 15/16=B, 20=A).
// 양식 하단 안내는 A(20~25) B(15~20) C(10~15) D(5~10) E(1~5) 로 경계가 겹쳐 있는데,
// 실사용은 '이상' 기준이다. E 는 주로 개선 후 위험성에 쓰인다.
const gradeOf = (f, s) => { const v = f * s; return v >= 20 ? 'A' : v >= 15 ? 'B' : v >= 10 ? 'C' : v >= 5 ? 'D' : 'E' }

function walk(dir, out = [], depth = 0) {
    if (depth > 4) return out
    let entries
    try { entries = fs.readdirSync(dir, { withFileTypes: true }) } catch (e) { return out }
    for (const e of entries) {
        const p = path.join(dir, e.name)
        if (e.isDirectory()) walk(p, out, depth + 1)
        else if (/\.(xlsx|xls|xlsm)$/i.test(e.name) && /위험성\s*평가|위험성평가|risk/i.test(e.name)) out.push(p)
    }
    return out
}

// 표의 머리글을 찾는다.
// 현장 양식은 머리글이 두 줄에 걸쳐 병합돼 있다. 예를 들어
//   4행: 세부공정 | 작업 위치 | 위험성평가[잠재위험요인] |     | 재해형태 | ...
//   5행:          |           | 위험분류 | 위험발생 상황 및 결과 | 가능성(빈도) | 중대성(강도)
// 한 줄만 보면 위험분류·빈도·강도를 놓친다. 두 줄을 열 단위로 합쳐서 본다.
function findHeader(rows) {
    for (let i = 0; i < Math.min(40, rows.length - 1); i++) {
        const a = rows[i].map(norm)
        const b = (rows[i + 1] || []).map(norm)
        const c2 = (rows[i + 2] || []).map(norm)
        const width = Math.max(a.length, b.length, c2.length)
        const merged = []
        for (let c = 0; c < width; c++) merged.push([a[c] || '', b[c] || '', c2[c] || ''].filter(Boolean).join(' '))

        const joined = merged.join(' ')
        const hit = Object.values(FIELD).filter(alts => alts.some(x => joined.includes(x))).length
        if (hit < 4) continue

        const map = {}
        for (const [key, alts] of Object.entries(FIELD)) {
            // 긴 별칭부터 맞춰야 '위험성'이 '위험발생 상황 및 결과'를 가로채지 않는다.
            for (const alt of [...alts].sort((x, y) => y.length - x.length)) {
                const idx = merged.findIndex(c => c && c.replace(/\s+/g, '').includes(alt.replace(/\s+/g, '')))
                if (idx >= 0 && !Object.values(map).includes(idx)) { map[key] = idx; break }
            }
        }
        if (map.hazard == null || (map.freq == null && map.measure == null)) continue
        return { headerRow: i + 1, map }
    }
    return null
}

function parseFile(file) {
    const wb = XLSX.readFile(file)
    const items = []
    for (const sheetName of wb.SheetNames) {
        const rows = XLSX.utils.sheet_to_json(wb.Sheets[sheetName], { header: 1, defval: '' })
        const h = findHeader(rows)
        if (!h) continue
        for (let i = h.headerRow + 1; i < rows.length; i++) {
            const g = (k) => h.map[k] != null ? norm(rows[i][h.map[k]]) : ''
            const hazard = g('hazard')
            if (isBlank(hazard) || hazard.length < 8) continue

            // 양식 안내문·서명란·번호매김이 표 안에 섞여 있다. 걸러낸다.
            if (/^[0-9]+[.)]|^[※①-⑳]|^\(|참고|첨부|서명|기재|작성\s*시|해당\s*양식|필요시|비고|예시|스케치/.test(hazard)) continue
            if (!/[가-힣]/.test(hazard)) continue

            const f = parseInt(g('freq'), 10)
            const s = parseInt(g('sev'), 10)

            // 빈도·강도가 없으면 등급을 매길 수 없고, 대책도 없으면 라이브러리 가치가 없다.
            const hasScore = f >= 1 && f <= 5 && s >= 1 && s <= 5
            const hasBody = !isBlank(g('measure')) || !isBlank(g('control'))
            if (!hasScore && !hasBody) continue
            items.push({
                sheet: sheetName,
                process: g('process'), location: g('location'),
                hazardClass: g('hazardClass'), hazard,
                accident: g('accident'), legal: g('legal'),
                control: g('control'), measure: g('measure'),
                freq: f >= 1 && f <= 5 ? f : null,
                sev: s >= 1 && s <= 5 ? s : null
            })
        }
    }
    return items
}

async function main() {
    if (args.includes('--inspect')) {
        const file = args[args.indexOf('--inspect') + 1]
        const wb = XLSX.readFile(file)
        console.log('\n시트:', wb.SheetNames.join(' | '))
        const rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1, defval: '' })
        console.log('행 수:', rows.length)
        for (let i = 0; i < Math.min(14, rows.length); i++) {
            const r = rows[i].map(x => norm(x).slice(0, 14))
            if (r.join('').trim()) console.log(String(i).padStart(3), '|', r.slice(0, 14).join(' | '))
        }
        return
    }

    console.log('\n탐색 경로:', ROOT)
    const files = walk(ROOT)
    console.log('RA 후보 파일:', files.length, '건\n')

    if (args.includes('--scan')) {
        files.slice(0, 40).forEach(f => console.log('  -', f.replace(ROOT, '')))
        if (files.length > 40) console.log('  ... 외', files.length - 40, '건')
        return
    }

    const all = []
    let parsed = 0, skipped = 0
    for (const f of files) {
        try {
            const items = parseFile(f)
            if (items.length) { parsed++; items.forEach(x => { x.file = path.basename(f); all.push(x) }) }
            else skipped++
        } catch (e) { skipped++ }
    }
    console.log('표 인식 성공:', parsed, '파일 / 인식 실패:', skipped, '파일')
    console.log('추출 라인   :', all.length, '건')

    // 중복 병합 — 같은 위험요인 문구는 한 건으로 모은다
    const merged = new Map()
    for (const it of all) {
        const key = `${it.hazard}|${it.measure}`.toLowerCase()
        if (!merged.has(key)) merged.set(key, { ...it, count: 1 })
        else {
            const m = merged.get(key)
            m.count++
            if (!m.legal && it.legal) m.legal = it.legal
            if (!m.control && it.control) m.control = it.control
            if (!m.freq && it.freq) { m.freq = it.freq; m.sev = it.sev }
        }
    }
    console.log('중복 병합 후:', merged.size, '건\n')

    let list = [...merged.values()]

    // 안내문·머리글 잔재를 한 번 더 걸러낸다.
    list = list.filter(x => !/^위험요인|^유해위험|확인요청|^구분$|^번호|^No/i.test(x.hazard))

    // 품질 등급 — 빈도·강도가 있는 것이 라이브러리로서 가장 쓸모 있다.
    const full = list.filter(x => x.freq && x.sev && x.measure)
    const scored = list.filter(x => x.freq && x.sev && !x.measure)
    const textOnly = list.filter(x => !(x.freq && x.sev))
    console.log('품질 분포')
    console.log('   빈도×강도 + 감소대책 :', full.length, '건  ← 즉시 사용 가능')
    console.log('   빈도×강도만          :', scored.length, '건')
    console.log('   문구만 (등급 없음)    :', textOnly.length, '건')
    console.log('')

    if (args.includes('--only-full')) list = full

    console.log('상위 표본 5건')
    list.slice(0, 5).forEach(x => console.log(
        '  -', (x.hazardClass || '?').padEnd(6), (x.hazard || '').slice(0, 40),
        '|', x.freq && x.sev ? `${x.freq}x${x.sev}=${gradeOf(x.freq, x.sev)}` : '등급없음'))

    if (!args.includes('--load')) {
        console.log('\n(--load 를 붙이면 hazard_item 에 적재합니다. 지금은 적재하지 않았습니다.)\n')
        return
    }

    // 적재
    const envFile = fs.existsSync(path.join(__dirname, '..', 'env_customer.env'))
        ? path.join(__dirname, '..', 'env_customer.env') : path.join(__dirname, '..', '.env')
    require('dotenv').config({ path: envFile })
    const { Client } = require('pg')
    const db = new Client({
        host: process.env.DB_HOST, port: Number(process.env.DB_PORT || 5432),
        user: process.env.DB_USER, password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME, ssl: { rejectUnauthorized: false }
    })
    await db.connect()

    let ins = 0, dup = 0
    for (const x of list) {
        try {
            const r = await db.query(`
                INSERT INTO hazard_item
                    (work_type_code, scope, hazard_class, hazard_desc, legal_basis,
                     current_control, reduction_measure, frequency, severity, grade,
                     usage_count, source_note, active)
                SELECT NULL, 'STANDARD', $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, FALSE
                 WHERE NOT EXISTS (SELECT 1 FROM hazard_item WHERE hazard_desc = $2)
                RETURNING id`,
                [x.hazardClass || null, x.hazard, x.legal || null, x.control || null,
                 x.measure || null, x.freq, x.sev,
                 x.freq && x.sev ? gradeOf(x.freq, x.sev) : null,
                 x.count, `현장 RA 파싱: ${x.file}`.slice(0, 200)])
            r.rowCount ? ins++ : dup++
        } catch (e) { /* 한 건 실패가 전체를 막지 않게 한다 */ }
    }
    console.log(`\n적재: 신규 ${ins}건 / 기존 중복 ${dup}건`)
    console.log('전부 active=false 입니다. 안전관리팀 검수 후 활성화하십시오.\n')
    await db.end()
}

main().catch(e => { console.error('\n실패:', e.message, '\n'); process.exit(1) })
