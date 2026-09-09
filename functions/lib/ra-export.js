// 위험성평가서를 현장 양식 그대로 엑셀로 내보낸다.
//
// 왜 원본 xlsx 를 템플릿으로 쓰는가
//   현장 양식은 22열 · 병합셀 338개 · 별도 시트 3개(근로자 의견 기록, 사진대장)로
//   되어 있다. 화면에서 HTML 로 그려 인쇄하면 이 서식을 재현할 수 없어
//   현장에서 쓸 수 없는 문서가 나온다.
//   원본 파일을 열어 셀에 값만 채우면 서식·병합·인쇄영역이 그대로 유지된다.
//   설계서 6.4절이 정한 방향이다.
//
// 열 배치는 현장 파일에서 실측했다.
//   [0] 세부공정          [1] 작업위치        [2] 위험분류
//   [3] 위험발생 상황     [5] 재해형태        [6] 관련근거(법적기준)
//   [7] 현재의 안전보건조치
//   [9] 가능성(빈도)      [10] 중대성(강도)   [11] 위험성(등급)
//   [13] 위험성 감소대책  [18] 개선 후 위험성(등급만 적는다)
//   [19] 근로자/근로자대표 [20] 협력업체소장  [21] 공사담당자

const path = require('path')
const fs = require('fs')
const ExcelJS = require('exceljs')

const TEMPLATE = path.join(__dirname, '..', 'templates', 'RA_현장양식_빈양식.xlsx')

// 1-based 열 번호. 실측한 0-based 인덱스에 1을 더한 값이다.
const COL = {
    process: 1,       // 세부공정
    location: 2,      // 작업 위치
    hazardClass: 3,   // 위험분류
    hazardDesc: 4,    // 위험발생 상황 및 결과
    accident: 6,      // 재해형태
    legal: 7,         // 관련근거(법적기준)
    control: 8,       // 현재의 안전보건조치
    freq: 10,         // 가능성(빈도)
    sev: 11,          // 중대성(강도)
    grade: 12,        // 위험성
    measure: 14,      // 위험성 감소대책
    resGrade: 19,     // 개선 후 위험성 (원본에 빈도·강도 칸은 없고 등급만 적는다)
}

const HEADER_ROW = {
    siteName: { r: 1, c: 2 },     // 현 장 명
    writeDate: { r: 2, c: 2 },    // 작성일자
    partner: { r: 3, c: 2 },      // 협력업체
    workType: { r: 4, c: 2 },     // 공 종 명
    periodFrom: { r: 4, c: 7 },   // 적용기간
}

const DATA_START = 7   // 데이터 첫 행(1-based)

// 하단 안내문이 있는 행을 찾는다. 데이터를 그 위까지만 채운다.
function findTailRow(ws) {
    for (let r = DATA_START; r <= ws.rowCount; r++) {
        const v = ws.getRow(r).getCell(1).value
        if (v && /위험성평가\s*방법/.test(String(v))) return r
    }
    return ws.rowCount + 1
}

/**
 * @param {object} ra   sms_risk_assessments 행 + { items, project_name, company_name }
 * @returns {Promise<Buffer>}
 */
async function buildRaWorkbook(ra) {
    if (!fs.existsSync(TEMPLATE)) {
        throw new Error('현장 양식 템플릿이 없습니다. scripts/make-ra-template.js 를 먼저 실행하십시오.')
    }

    const wb = new ExcelJS.Workbook()
    await wb.xlsx.readFile(TEMPLATE)
    const ws = wb.worksheets[0]

    const d = ra.date ? new Date(ra.date) : new Date()
    const ymd = (x) => `${x.getFullYear()}.${String(x.getMonth() + 1).padStart(2, '0')}.${String(x.getDate()).padStart(2, '0')}`

    // 머리글
    ws.getRow(HEADER_ROW.siteName.r).getCell(HEADER_ROW.siteName.c).value = ra.project_name || ''
    ws.getRow(HEADER_ROW.writeDate.r).getCell(HEADER_ROW.writeDate.c).value = ymd(d)
    ws.getRow(HEADER_ROW.partner.r).getCell(HEADER_ROW.partner.c).value = ra.company_name || ''
    ws.getRow(HEADER_ROW.workType.r).getCell(HEADER_ROW.workType.c).value = ra.process_name || ''
    if (ra.period_from) {
        const pf = new Date(ra.period_from)
        const pt = ra.period_to ? new Date(ra.period_to) : null
        ws.getRow(HEADER_ROW.periodFrom.r).getCell(HEADER_ROW.periodFrom.c).value =
            pt ? `${ymd(pf)} ~ ${ymd(pt)}` : `${ymd(pf)} ~`
    }

    // 본문 — 템플릿 행이 모자라면 마지막 데이터 행의 서식을 복제해 늘린다.
    const items = ra.items || []
    const tail = findTailRow(ws)
    const capacity = tail - DATA_START

    if (items.length > capacity) {
        const need = items.length - capacity
        ws.spliceRows(tail, 0, ...Array.from({ length: need }, () => []))
        // 서식 복제 — 마지막 데이터 행을 본떠 테두리를 잇는다.
        const model = ws.getRow(tail - 1)
        for (let i = 0; i < need; i++) {
            const row = ws.getRow(tail + i)
            model.eachCell({ includeEmpty: true }, (cell, col) => {
                const t = row.getCell(col)
                t.style = { ...cell.style }
            })
            row.height = model.height
        }
    }

    items.forEach((it, i) => {
        const row = ws.getRow(DATA_START + i)
        const set = (c, v) => { if (v != null && v !== '') row.getCell(c).value = v }

        set(COL.process, it.process_name || ra.process_name || '')
        set(COL.location, it.location_name || '')
        set(COL.hazardClass, it.hazard_class || '')
        set(COL.hazardDesc, it.risk_factor || '')
        set(COL.accident, it.risk_type || '')
        set(COL.legal, it.legal_basis || '')
        set(COL.control, it.current_control || '')
        set(COL.freq, it.frequency ?? '')
        set(COL.sev, it.severity ?? '')
        set(COL.grade, it.grade || '')
        set(COL.measure, it.mitigation_measure || '')
        set(COL.resGrade, it.residual_grade || '')

        row.commit && row.commit()
    })

    return await wb.xlsx.writeBuffer()
}

module.exports = { buildRaWorkbook, TEMPLATE }
