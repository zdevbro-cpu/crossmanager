import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'

/**
 * Generate PDF from report raw data
 * @param reportData - Report content object
 * @param title - Report title
 */
export async function generateReportPDF(reportData: any, title: string) {
    const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4'
    })

    // 0. 한글 폰트 로드 (Noto Sans KR)
    try {
        // 구글 폰트 CDN 대신, base64 변환된 woff/ttf가 이상적이나,
        // 로컬 폰트 파일 로드 (캐시 버스팅 추가)
        const fontUrl = `${import.meta.env.BASE_URL}fonts/NotoSansKR-Regular.ttf?v=${Date.now()}`
        const response = await fetch(fontUrl)

        if (!response.ok) {
            throw new Error(`Font fetch failed: ${response.status} ${response.statusText}`)
        }

        const blob = await response.blob()
        if (blob.size < 1000) { // 파일이 너무 작으면(에러 페이지 등) 실패 처리
            throw new Error('Font file is invalid (too small)')
        }

        await new Promise((resolve, reject) => {
            const reader = new FileReader()
            reader.onloadend = () => {
                if (typeof reader.result === 'string') {
                    const base64data = reader.result.split(',')[1]
                    if (base64data) {
                        pdf.addFileToVFS('NotoSansKR-Regular.ttf', base64data)
                        pdf.addFont('NotoSansKR-Regular.ttf', 'NotoSansKR', 'normal')
                        pdf.setFont('NotoSansKR')
                        resolve(true)
                    } else {
                        reject(new Error('Base64 conversion failed'))
                    }
                } else {
                    reject(new Error('FileReader result is not string'))
                }
            }
            reader.onerror = reject
            reader.readAsDataURL(blob)
        })
    } catch (e) {
        console.warn('Korean font load failed, falling back to default:', e)
        alert('한글 폰트 로드에 실패했습니다. 텍스트가 깨질 수 있습니다.')
    }

    let yPos = 20

    // 1. 헤더
    pdf.setFontSize(18)
    // pdf.setFont('helvetica', 'bold') // 한글 폰트 유지
    pdf.text(title || '일일 업무 보고서', 105, yPos, { align: 'center' })
    yPos += 15

    // 2. 메타 정보
    pdf.setFontSize(10)

    const metaY = yPos
    pdf.text(`날씨: ${reportData.weather || '-'}`, 20, metaY)
    pdf.text(`안전등급: ${reportData.sms?.safetyStatus || '-'}`, 80, metaY)
    pdf.text(`작성일: ${new Date().toLocaleDateString('ko-KR')}`, 140, metaY)
    yPos += 10

    // 구분선
    pdf.setDrawColor(200, 200, 200)
    pdf.line(20, yPos, 190, yPos)
    yPos += 10

    // 3. 금일 작업 요약
    pdf.setFontSize(12)
    pdf.text('1. 금일 작업 요약', 20, yPos)
    yPos += 7

    pdf.setFontSize(10)
    const summaryLines = pdf.splitTextToSize(reportData.summary || '요약 없음', 170)
    pdf.text(summaryLines, 20, yPos)
    yPos += summaryLines.length * 5 + 10

    // 4. 공정 현황 (표)
    pdf.setFontSize(12)
    pdf.text(`2. 공정 현황 (진행 중: ${reportData.pms?.totalActive || 0}건)`, 20, yPos)
    yPos += 7

    if (reportData.pms?.activeTasks && reportData.pms.activeTasks.length > 0) {
        autoTable(pdf, {
            startY: yPos,
            head: [['상태', '작업명', '진척률']],
            body: reportData.pms.activeTasks.map((t: any) => {
                const isDelay = t.delay_risk === true || t.delay_risk === 'HIGH' || t.name?.includes('지연')
                const status = isDelay ? '지연' : t.name?.includes('조기') ? '조기달성' : '정상'
                return [status, t.name || '-', `${t.progress || 0}%`]
            }),
            theme: 'grid',
            headStyles: {
                fillColor: [30, 41, 59],
                textColor: [255, 255, 255],
                font: 'NotoSansKR', // 표 헤더 폰트 적용
                fontStyle: 'normal' // 한글 폰트는 보통 bold가 따로 없으면 normal로 사용
            },
            styles: {
                fontSize: 9,
                cellPadding: 3,
                font: 'NotoSansKR' // 표 본문 폰트 적용
            },
            columnStyles: {
                0: { cellWidth: 25 },
                1: { cellWidth: 120 },
                2: { cellWidth: 25, halign: 'center' }
            }
        })
        yPos = (pdf as any).lastAutoTable.finalY + 10
    } else {
        pdf.setFontSize(10)
        pdf.text('진행 중인 작업 없음', 20, yPos)
        yPos += 10
    }

    // 5. 안전 활동
    pdf.setFontSize(12)
    pdf.text('3. 안전 활동', 20, yPos)
    yPos += 7

    pdf.setFontSize(10)
    pdf.text(`• TBM/DRI 시행: ${reportData.sms?.dris?.length || 0}건`, 25, yPos)
    yPos += 5
    pdf.text(`• 사고/이슈: ${reportData.sms?.incidents?.length || 0}건`, 25, yPos)
    yPos += 5
    pdf.text(`• 미조치 이슈: ${reportData.issues?.openIncidents?.length || 0}건`, 25, yPos)
    yPos += 10

    // 6. 자원 및 폐기물 현황
    pdf.setFontSize(12)
    pdf.text('4. 자원 및 폐기물 현황', 20, yPos)
    yPos += 7

    pdf.setFontSize(10)

    // 장비 가동률
    const equipmentData = [
        ['장비 가동률', `${reportData.ems?.deployedCount || 0}대`],
        ['예상 수익 (SWMS)', `${reportData.swms?.totalCount || 0}건`]
    ]

    autoTable(pdf, {
        startY: yPos,
        body: equipmentData,
        theme: 'plain',
        styles: {
            fontSize: 9,
            cellPadding: 2,
            font: 'NotoSansKR' // 폰트 적용
        },
        columnStyles: {
            0: { cellWidth: 60 },
            1: { cellWidth: 110 }
        }
    })

    yPos = (pdf as any).lastAutoTable.finalY + 10

    // 페이지 번호
    const pageCount = (pdf as any).internal.getNumberOfPages()
    for (let i = 1; i <= pageCount; i++) {
        pdf.setPage(i)
        pdf.setFontSize(8)
        pdf.text(`${i} / ${pageCount}`, 105, 287, { align: 'center' })
    }

    // 저장
    const fileName = `${title.replace(/\s+/g, '_')}_${new Date().toISOString().slice(0, 10)}.pdf`
    pdf.save(fileName)
}
