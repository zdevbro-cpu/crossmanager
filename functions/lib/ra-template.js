// 고객사 RA 양식을 등록하고, 그 양식으로 평가서를 출력한다.
//
// 왜 이렇게 하는가
//   양식은 고객사마다 다르다. 실측해 보니 열 배치·머리글 위치·시트 수는 물론
//   등급 표기까지 달랐다(크로스 A~E, 표준 템플릿 상·중·하).
//   열 좌표를 코드에 박으면 고객사가 늘 때마다 코드를 고쳐야 한다.
//   개요서 3.1 — "표준화 대상은 데이터이며, 서류는 데이터를 발주처 양식으로
//   렌더링한 결과물이다."
//
//   그래서 양식 파일과 매핑을 DB(template / template_mapping)에 두고,
//   출력은 그 매핑을 읽어 채운다. 양식이 바뀌면 매핑만 고친다.

const ExcelJS = require('exceljs')

// 표준 필드 — 어느 양식이든 이 이름으로 매핑한다.
const FIELDS = {
    process: '세부공정',
    location: '작업위치',
    hazardClass: '위험분류',
    hazardDesc: '위험발생 상황 및 결과',
    accident: '재해형태',
    legal: '관련근거(법적기준)',
    control: '현재의 안전보건조치',
    freq: '가능성(빈도)',
    sev: '중대성(강도)',
    grade: '위험성',
    measure: '위험성 감소대책',
    resFreq: '개선 후 가능성',
    resSev: '개선 후 중대성',
    resGrade: '개선 후 위험성',
}

// 머리글 문구로 필드를 알아본다. 표현이 현장마다 달라 별칭을 넉넉히 둔다.
const PATTERNS = {
    process: /세부공정|단위작업|작업단계|작업명|공정명/,
    location: /작업\s*위치|^위치$|장소/,
    hazardClass: /위험분류|유해위험요인분류/,
    hazardDesc: /위험발생\s*상황|유해[·\s]*위험요인|위험요인|잠재위험/,
    accident: /재해형태|재해유형|사고형태/,
    legal: /관련근거|법적기준|법적근거|관련법규/,
    control: /현재의?\s*안전보건조치|현재조치|기존\s*안전조치/,
    freq: /가능성|빈도/,
    sev: /중대성|강도/,
    grade: /^위험성$|위험등급|^등급$/,
    measure: /감소대책|개선대책|안전대책/,
    resFreq: /개선\s*후.*가능성|잔여.*빈도/,
    resSev: /개선\s*후.*중대성|잔여.*강도/,
    resGrade: /개선\s*후\s*위험성|잔여\s*위험성/,
}

// 머리글 셀(현장명·작성일자 등)을 찾는 문구
const HEADER_PATTERNS = {
    siteName: /현\s*장\s*명/,
    writeDate: /작성\s*일자|작성일/,
    partner: /협력\s*업체|업체명/,
    workType: /공\s*종\s*명/,
    period: /적용\s*기간|평가\s*기간/,
}

const norm = v => String(v == null ? '' : v).replace(/\s+/g, ' ').trim()

/**
 * 업로드된 양식을 훑어 구조를 추정한다.
 * 사람이 화면에서 고칠 수 있게 '추정값'으로 돌려준다 — 자동 인식이 늘 맞지는 않는다.
 */
async function analyzeTemplate(buffer) {
    const wb = new ExcelJS.Workbook()
    await wb.xlsx.load(buffer)

    const sheets = wb.worksheets.map(w => ({ name: w.name, rows: w.rowCount, cols: w.columnCount }))

    // 본문 시트 — 머리글 후보가 가장 많이 잡히는 시트를 고른다.
    let best = null
    wb.worksheets.forEach((ws, si) => {
        const found = detectColumns(ws)
        if (found && (!best || found.hits > best.hits)) best = { ...found, sheetIndex: si, sheetName: ws.name, ws }
    })

    if (!best) {
        return { sheets, detected: false, message: '머리글을 찾지 못했습니다. 직접 지정하십시오.' }
    }

    return {
        sheets,
        detected: true,
        sheetIndex: best.sheetIndex,
        sheetName: best.sheetName,
        headerRow: best.headerRow,
        dataStartRow: best.dataStartRow,
        columns: best.columns,          // { fieldKey: colIndex(1-based) }
        headerCells: detectHeaderCells(best.ws, best.headerRow),
        gradeScale: detectGradeScale(best.ws, best.dataStartRow, best.columns),
        tailMarker: detectTail(best.ws, best.dataStartRow),
        fieldLabels: FIELDS,
    }
}

// 머리글은 2~3행에 걸쳐 병합돼 있는 경우가 많다. 열 단위로 합쳐서 본다.
function detectColumns(ws) {
    const candidates = []
    const maxRow = Math.min(40, ws.rowCount)
    for (let r = 1; r <= maxRow; r++) {
        const merged = []
        const width = ws.columnCount
        for (let c = 1; c <= width; c++) {
            const parts = []
            for (let k = 0; k < 3; k++) {
                const v = ws.getRow(r + k)?.getCell(c)?.value
                const t = norm(typeof v === 'object' && v?.richText
                    ? v.richText.map(x => x.text).join('')
                    : v)
                if (t) parts.push(t)
            }
            merged[c] = parts.join(' ')
        }

        const columns = {}
        let hits = 0
        for (const [key, re] of Object.entries(PATTERNS)) {
            // 긴 문구부터 맞춰야 '위험성'이 '위험발생 상황'을 가로채지 않는다.
            for (let c = 1; c <= width; c++) {
                if (!merged[c] || Object.values(columns).includes(c)) continue
                if (re.test(merged[c])) { columns[key] = c; hits++; break }
            }
        }

        if (hits >= 5 && columns.hazardDesc) {
            // 데이터 시작 행 — 머리글 아래에서 값이 실제로 나오는 첫 행.
            // 머리글이 2~3행에 걸쳐 있으면 그만큼 건너뛴다.
            let start = r + 1
            for (let rr = r + 1; rr <= Math.min(r + 8, ws.rowCount); rr++) {
                const v = norm(ws.getRow(rr).getCell(columns.hazardDesc).value)
                if (!v) { start = rr + 1; continue }
                if (Object.values(PATTERNS).some(re => re.test(v))) { start = rr + 1; continue }
                start = rr
                break
            }
            candidates.push({ headerRow: r, dataStartRow: start, columns, hits })
        }
    }
    // 가장 많이 맞은 행을 고른다. 첫 행에서 멈추면 2행짜리 머리글의 윗줄만 잡힌다.
    if (!candidates.length) return null
    return candidates.sort((a, b) => b.hits - a.hits || a.headerRow - b.headerRow)[0]
}

function detectHeaderCells(ws, headerRow) {
    const out = {}
    for (let r = 1; r < headerRow; r++) {
        for (let c = 1; c <= Math.min(12, ws.columnCount); c++) {
            const t = norm(ws.getRow(r).getCell(c).value)
            if (!t) continue
            for (const [key, re] of Object.entries(HEADER_PATTERNS)) {
                // 라벨 오른쪽 칸에 값을 쓴다.
                if (!out[key] && re.test(t)) out[key] = { r, c: c + 1 }
            }
        }
    }
    return out
}

// 등급 표기를 알아본다. A~E 인지 상·중·하 인지에 따라 채워 넣을 값이 달라진다.
function detectGradeScale(ws, dataStart, columns) {
    if (!columns.grade) return 'A_E'
    const seen = new Set()
    for (let r = dataStart; r <= Math.min(dataStart + 40, ws.rowCount); r++) {
        const t = norm(ws.getRow(r).getCell(columns.grade).value)
        if (t) seen.add(t)
    }
    const vals = [...seen]
    if (vals.some(v => /^[상중하]$/.test(v))) return 'HIGH_MID_LOW'
    if (vals.some(v => /^[A-E]$/i.test(v))) return 'A_E'
    if (vals.every(v => /^\d+$/.test(v)) && vals.length) return 'NUMERIC'
    return 'A_E'
}

function detectTail(ws, dataStart) {
    for (let r = dataStart; r <= ws.rowCount; r++) {
        const t = norm(ws.getRow(r).getCell(1).value)
        if (t && /위험성평가\s*방법|평가\s*기준|비고/.test(t)) return t.slice(0, 60)
    }
    return null
}

// 등급 값을 양식 표기에 맞춘다.
function toScale(grade, scale) {
    if (!grade) return ''
    if (scale === 'HIGH_MID_LOW') {
        return { A: '상', B: '상', C: '중', D: '하', E: '하' }[grade] || grade
    }
    if (scale === 'NUMERIC') {
        return { A: 5, B: 4, C: 3, D: 2, E: 1 }[grade] ?? ''
    }
    return grade
}

/**
 * 등록된 양식으로 평가서를 채운다.
 * @param {Buffer} templateBuffer  양식 파일
 * @param {object} tpl   template 행 (header_row, data_start_row, columns 매핑 등)
 * @param {object} ra    평가서 + items
 */
async function renderWithTemplate(templateBuffer, tpl, ra) {
    const wb = new ExcelJS.Workbook()
    await wb.xlsx.load(templateBuffer)
    const ws = wb.worksheets[tpl.sheet_index || 0]

    const COL = tpl.columns || {}
    const scale = tpl.grade_scale || 'A_E'
    const d = ra.date ? new Date(ra.date) : new Date()
    const ymd = x => `${x.getFullYear()}.${String(x.getMonth() + 1).padStart(2, '0')}.${String(x.getDate()).padStart(2, '0')}`

    // 머리글
    const hc = tpl.header_cells || {}
    const put = (spec, val) => { if (spec && val) ws.getRow(spec.r).getCell(spec.c).value = val }
    put(hc.siteName, ra.project_name)
    put(hc.writeDate, ymd(d))
    put(hc.partner, ra.company_name)
    put(hc.workType, ra.process_name)
    if (hc.period && ra.period_from) {
        const pf = new Date(ra.period_from)
        const pt = ra.period_to ? new Date(ra.period_to) : null
        put(hc.period, pt ? `${ymd(pf)} ~ ${ymd(pt)}` : `${ymd(pf)} ~`)
    }

    // 본문 — 먼저 기존 내용을 비운다.
    // 등록된 양식이 지난 회차가 적힌 파일일 수 있다. 그대로 두면 우리 데이터가
    // 덮이지 않은 줄에 남의 내용이 남는다. 서식은 두고 값만 지운다.
    const start = tpl.data_start_row || 1
    const items = ra.items || []

    const tailWord = (tpl.tail_marker || '위험성평가 방법').slice(0, 8)
    for (let r = start; r <= ws.rowCount; r++) {
        const first = norm(ws.getRow(r).getCell(1).value)
        if (first && first.includes(tailWord)) break
        if (first && (first.includes('위험성평가 방법') || first.includes('평가 기준'))) break
        ws.getRow(r).eachCell({ includeEmpty: false }, cell => { cell.value = null })
    }
    items.forEach((it, i) => {
        const row = ws.getRow(start + i)
        const set = (key, v) => {
            const c = COL[key]
            if (c && v != null && v !== '') row.getCell(c).value = v
        }
        set('process', it.process_name || ra.process_name)
        set('location', it.location_name)
        set('hazardClass', it.hazard_class)
        set('hazardDesc', it.risk_factor)
        set('accident', it.risk_type)
        set('legal', it.legal_basis)
        set('control', it.current_control)
        set('freq', it.frequency)
        set('sev', it.severity)
        set('grade', toScale(it.grade, scale))
        set('measure', it.mitigation_measure)
        set('resFreq', it.residual_frequency)
        set('resSev', it.residual_severity)
        set('resGrade', toScale(it.residual_grade, scale))
        row.commit && row.commit()
    })

    return await wb.xlsx.writeBuffer()
}

module.exports = { analyzeTemplate, renderWithTemplate, FIELDS, toScale }
