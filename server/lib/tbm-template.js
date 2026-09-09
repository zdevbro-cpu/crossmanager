// TBM(작업전 위험예지) 일지를 고객사 양식 그대로 출력한다.
//
// 왜 RA 인식기를 그대로 쓸 수 없는가
//   RA 는 '행이 반복되는 표' 하나라 열 번호만 알면 채울 수 있다.
//   TBM 은 구조가 다르다. 실측한 두 양식 모두
//     ① 라벨-값 쌍의 머리글 블록  (교육일시 · 교육장소 · 작업명 · TBM장소 …)
//     ② 위험요인 몇 줄            (① ② ③ 또는 1 2 3 4 — 위험 / 대책 쌍)
//     ③ 참석자 서명 격자          (성명 · Sign 이 가로로 여러 벌)
//   세 덩어리가 한 장에 섞여 있다. 열 매핑만으로는 어디에 무엇을 쓸지 정할 수 없다.
//
//   그래서 여기서는 '라벨을 찾아 그 옆 칸에 쓴다'를 기본으로 삼고,
//   위험요인·참석자만 반복 블록으로 따로 잡는다.
//
// 실측한 양식
//   동우화인켐 환경안전교육일지(TBM)  소속·교육일시·교육장소·교육강사·교육구분·
//                                    교육내용 + 1R 잠재위험 4줄 + 3R 대책 4줄
//   크로스 TBM 회의록                 TBM일시·작업명·작업내용·TBM장소 +
//                                    잠재적위험 ①②③ + 대책 + 참석자 서명

const ExcelJS = require('exceljs')

// 머리글에 채울 값. 라벨 문구는 양식마다 달라 별칭을 넉넉히 둔다.
const HEADER_FIELDS = {
    date: { label: '일시', re: /TBM\s*일시|교육\s*일시|작업\s*일자|^일시$|^일자$/ },
    location: { label: '장소', re: /TBM\s*장소|교육\s*장소|작업\s*장소|^장소$|작업\s*위치/ },
    workName: { label: '작업명', re: /작\s*업\s*명|공\s*종\s*명|훈련\s*제목/ },
    workContent: { label: '작업내용', re: /작\s*업\s*내\s*용|교육\s*내용/ },
    company: { label: '소속', re: /^소\s*속$|협력\s*업체|업체\s*명/ },
    leader: { label: '리더', re: /TBM\s*리더|교육\s*강사|주관자|진행자/ },
    projectName: { label: '현장명', re: /현\s*장\s*명|사업장/ },
    attendeesCount: { label: '참석인원', re: /참석\s*인원|인\s*원\s*수/ },
}

// 위험요인 반복 블록을 찾는 표식. ①②③ 또는 1 2 3 이 세로로 붙는다.
const MARKERS = ['①', '②', '③', '④', '⑤']

const norm = (v) => {
    if (v == null) return ''
    if (typeof v === 'object' && v.richText) return v.richText.map(x => x.text).join('').replace(/\s+/g, ' ').trim()
    if (typeof v === 'object' && v.text) return String(v.text).replace(/\s+/g, ' ').trim()
    if (v instanceof Date) return v.toISOString().slice(0, 10)
    return String(v).replace(/\s+/g, ' ').trim()
}

// 병합된 칸은 왼쪽 위 칸에만 값이 있고 나머지는 같은 문자열로 읽힌다.
// 라벨이 가로로 늘어선 것처럼 보이므로, 라벨이 끝나는 지점을 찾아 그 다음 칸을 값 칸으로 본다.
function valueCellRight(ws, r, c, label) {
    const width = Math.min(ws.columnCount, 30)
    let cc = c
    while (cc < width && norm(ws.getRow(r).getCell(cc + 1).value) === label) cc++
    return { r, c: cc + 1 }
}

/**
 * 업로드된 TBM 양식을 훑어 구조를 추정한다.
 * 자동 인식이 늘 맞지는 않으므로 '추정값'으로 돌려주고 화면에서 고치게 한다.
 */
async function analyzeTbmTemplate(buffer) {
    const wb = new ExcelJS.Workbook()
    await wb.xlsx.load(buffer)

    const sheets = wb.worksheets.map(w => ({ name: w.name, rows: w.rowCount, cols: w.columnCount }))

    let best = null
    wb.worksheets.forEach((ws, si) => {
        const found = scanSheet(ws)
        if (found && (!best || found.hits > best.hits)) best = { ...found, sheetIndex: si, sheetName: ws.name }
    })

    if (!best) {
        return { sheets, detected: false, message: 'TBM 양식으로 보이는 항목을 찾지 못했습니다. 직접 지정하십시오.' }
    }

    return {
        sheets,
        detected: true,
        sheetIndex: best.sheetIndex,
        sheetName: best.sheetName,
        headerCells: best.headerCells,   // { date: {r,c}, location: {r,c} ... }
        hazardBlock: best.hazardBlock,   // { startRow, rowStep, count, descCol, measureCol }
        attendeeBlock: best.attendeeBlock, // { startRow, nameCols: [..], rowCount }
        fieldLabels: Object.fromEntries(Object.entries(HEADER_FIELDS).map(([k, v]) => [k, v.label])),
    }
}

function scanSheet(ws) {
    const maxR = Math.min(ws.rowCount, 80)
    const maxC = Math.min(ws.columnCount, 30)

    const headerCells = {}
    let hits = 0

    for (let r = 1; r <= maxR; r++) {
        for (let c = 1; c <= maxC; c++) {
            const t = norm(ws.getRow(r).getCell(c).value)
            if (!t || t.length > 24) continue
            for (const [key, spec] of Object.entries(HEADER_FIELDS)) {
                if (headerCells[key]) continue
                if (spec.re.test(t)) {
                    headerCells[key] = valueCellRight(ws, r, c, t)
                    hits++
                }
            }
        }
    }

    const hazardBlock = findHazardBlock(ws, maxR, maxC)
    const attendeeBlock = findAttendeeBlock(ws, maxR, maxC)
    if (hazardBlock) hits += 2

    if (hits < 2) return null
    return { headerCells, hazardBlock, attendeeBlock, hits }
}

// ① ② ③ 이 같은 열에 세로로 놓인 곳을 찾는다. 없으면 1 2 3 4 를 본다.
//
// 표식은 한 장에 여러 벌 나온다. 크로스 회의록은 잠재적위험에 ①②③,
// 아래 전일 조치확인에 또 ①②③ 이 있다. 전부를 한 덩어리로 보면 간격이
// 어긋나 통째로 버려진다. 그래서 '간격이 일정한 가장 긴 구간'만 고른다.
function longestRun(rows) {
    let best = null
    for (let i = 0; i < rows.length - 1; i++) {
        const step = rows[i + 1].r - rows[i].r
        if (step < 1 || step > 3) continue
        let j = i + 1
        while (j + 1 < rows.length && rows[j + 1].r - rows[j].r === step) j++
        const len = j - i + 1
        if (len >= 3 && (!best || len > best.count)) {
            best = { startRow: rows[i].r, rowStep: step, count: len }
        }
    }
    return best
}

// 병합된 표식은 오른쪽으로 같은 값이 이어진다. 그 끝 다음 칸이 내용 칸이다.
function spanEnd(ws, r, c, maxC) {
    const v = norm(ws.getRow(r).getCell(c).value)
    let cc = c
    while (cc < maxC && norm(ws.getRow(r).getCell(cc + 1).value) === v) cc++
    return cc
}

function findHazardBlock(ws, maxR, maxC) {
    for (let c = 1; c <= maxC; c++) {
        const rows = []
        for (let r = 1; r <= maxR; r++) {
            const t = norm(ws.getRow(r).getCell(c).value)
            if (MARKERS.includes(t) || /^[1-9]$/.test(t)) rows.push({ r, t })
        }
        if (rows.length < 3) continue

        const run = longestRun(rows)
        if (!run) continue

        // 표식이 병합돼 있으면 그 오른쪽 끝 다음 칸부터가 내용이다.
        const end = spanEnd(ws, run.startRow, c, maxC)
        const descCol = Math.min(end + 1, maxC)
        // 대책 칸은 머리말에서 찾는다. 없으면 오른쪽 절반으로 둔다.
        const measureCol = findMeasureCol(ws, run.startRow, maxC) || Math.min(maxC, Math.round(maxC * 0.7))
        return { ...run, descCol, measureCol, markerCol: c }
    }
    return null
}

// 위험 블록 바로 위에서 「대책」 머리말을 찾는다.
function findMeasureCol(ws, startRow, maxC) {
    for (let r = Math.max(1, startRow - 4); r < startRow; r++) {
        for (let c = 1; c <= maxC; c++) {
            const t = norm(ws.getRow(r).getCell(c).value)
            if (t && /대\s*책|감소\s*대책|안전\s*조치|3R/.test(t)) {
                // 병합 머리말은 왼쪽 첫 칸이 시작점이다.
                if (norm(ws.getRow(r).getCell(c - 1).value) === t) continue
                return c
            }
        }
    }
    return null
}

// 성명 · Sign 이 가로로 여러 벌 놓인 줄을 찾는다.
function findAttendeeBlock(ws, maxR, maxC) {
    for (let r = 1; r <= maxR; r++) {
        const nameCols = []
        for (let c = 1; c <= maxC; c++) {
            const t = norm(ws.getRow(r).getCell(c).value)
            if (/^성\s*명$/.test(t) && !nameCols.includes(c)) {
                // 병합된 칸은 같은 값이 이어진다. 첫 칸만 잡는다.
                if (norm(ws.getRow(r).getCell(c - 1).value) !== t) nameCols.push(c)
            }
        }
        if (nameCols.length >= 1) {
            return { startRow: r + 1, nameCols, rowCount: 10 }
        }
    }
    return null
}

const ymd = (d) => `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`

/**
 * 등록된 양식으로 TBM 일지를 채운다.
 * @param {Buffer} templateBuffer 양식 파일
 * @param {object} tpl  template 행 (sheet_index, header_cells, hazard_block, attendee_block)
 * @param {object} tbm  sms_dris 행 + { hazards, attendees, project_name, company_name }
 */
async function renderTbmWithTemplate(templateBuffer, tpl, tbm) {
    const wb = new ExcelJS.Workbook()
    await wb.xlsx.load(templateBuffer)
    const ws = wb.worksheets[tpl.sheet_index || 0]

    // 레이아웃은 template.header_cells 한 칸에 모아 둔다. 컬럼을 더 만들면
    // RA 와 스키마가 갈라진다. { fields, hazard, attendee } 형태다.
    const layout = tpl.header_cells || {}
    const hc = layout.fields || layout
    const put = (spec, val) => {
        if (!spec || val == null || val === '') return
        ws.getRow(spec.r).getCell(spec.c).value = val
    }

    const d = tbm.date ? new Date(tbm.date) : new Date()
    put(hc.date, ymd(d))
    put(hc.location, tbm.location)
    put(hc.workName, tbm.work_type_name || tbm.process_name)
    put(hc.workContent, tbm.work_content)
    put(hc.company, tbm.company_name)
    put(hc.leader, tbm.leader_name)
    put(hc.projectName, tbm.project_name)
    put(hc.attendeesCount, tbm.attendees_count)

    // 위험요인 — 표식 줄을 따라 내려가며 채운다.
    const hb = layout.hazard || tpl.hazard_block
    const hazards = tbm.hazards || []
    if (hb && hazards.length) {
        for (let i = 0; i < Math.min(hazards.length, hb.count); i++) {
            const r = hb.startRow + i * (hb.rowStep || 1)
            const h = hazards[i]
            if (hb.descCol) ws.getRow(r).getCell(hb.descCol).value = h.hazard_desc || ''
            if (hb.measureCol) ws.getRow(r).getCell(hb.measureCol).value = h.reduction_measure || ''
        }
    }

    // 참석자 — 성명 칸이 가로로 여러 벌이면 세로로 채우다 다음 벌로 넘어간다.
    const ab = layout.attendee || tpl.attendee_block
    const attendees = tbm.attendees || []
    if (ab && attendees.length) {
        const cols = ab.nameCols || []
        const perCol = ab.rowCount || 10
        attendees.forEach((a, i) => {
            const colIdx = Math.floor(i / perCol)
            if (colIdx >= cols.length) return      // 양식 칸보다 사람이 많으면 넘치는 만큼은 못 적는다
            const r = ab.startRow + (i % perCol)
            ws.getRow(r).getCell(cols[colIdx]).value = a.worker_name || ''
        })
    }

    return await wb.xlsx.writeBuffer()
}

module.exports = { analyzeTbmTemplate, renderTbmWithTemplate, HEADER_FIELDS }
