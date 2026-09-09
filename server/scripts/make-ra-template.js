// 현장 RA 원본에서 데이터 행만 비워 빈 양식 템플릿을 만든다.
//
//   node scripts/make-ra-template.js
//
// 원본을 그대로 쓰면 지난 회차 내용이 딸려 나온다.
// 머리글·서식·병합·인쇄영역은 남기고 데이터 행의 값만 지운다.
//
// exceljs 를 쓰는 이유: xlsx(SheetJS) 는 셀 서식·병합·인쇄설정을 보존하지 못한다.
// 현장 양식을 그대로 유지하는 것이 이 작업의 목적이므로 서식 보존이 필수다.

const path = require('path')
const fs = require('fs')
const ExcelJS = require('exceljs')

const SRC = path.join(__dirname, '..', 'templates', 'RA_현장양식.xlsx')
const OUT = path.join(__dirname, '..', 'templates', 'RA_현장양식_빈양식.xlsx')

// 데이터가 시작되는 행(1-based). 4~5행이 머리글이므로 6행부터가 내용이다.
const DATA_START = 7
// 하단 안내문("► 위험성평가 방법 …")이 있는 행은 남긴다.
const KEEP_TAIL = /위험성평가\s*방법|가능성.*중대성/

async function main() {
    if (!fs.existsSync(SRC)) {
        console.error('원본이 없습니다:', SRC)
        process.exit(1)
    }
    const wb = new ExcelJS.Workbook()
    await wb.xlsx.readFile(SRC)

    const ws = wb.worksheets[0]
    console.log('시트:', wb.worksheets.map(w => w.name).join(' | '))
    console.log('행 수:', ws.rowCount, '/ 열 수:', ws.columnCount)

    let cleared = 0
    for (let r = DATA_START; r <= ws.rowCount; r++) {
        const row = ws.getRow(r)
        const joined = []
        row.eachCell({ includeEmpty: false }, c => joined.push(String(c.value ?? '')))
        if (KEEP_TAIL.test(joined.join(' '))) continue

        row.eachCell({ includeEmpty: false }, cell => {
            // 서식은 두고 값만 지운다.
            cell.value = null
            cleared++
        })
    }
    console.log('비운 셀:', cleared, '개')

    await wb.xlsx.writeFile(OUT)
    console.log('빈 양식 저장:', path.basename(OUT), Math.round(fs.statSync(OUT).size / 1024), 'KB')
}

main().catch(e => { console.error('실패:', e.message); process.exit(1) })
