const { GoogleGenerativeAI } = require('@google/generative-ai')

// Gemini API 초기화
const genAI = process.env.GEMINI_API_KEY
    ? new GoogleGenerativeAI(process.env.GEMINI_API_KEY)
    : null

/**
 * Generate AI summary for report data
 * @param {Object} reportData - Aggregated report data
 * @returns {Promise<string>} - Generated summary
 */
async function generateReportSummary(reportData) {
    if (!genAI) {
        console.warn('Gemini API key not configured, using fallback summary')
        return generateFallbackSummary(reportData)
    }

    try {
        const model = genAI.getGenerativeModel({ model: 'gemini-pro' })

        const prompt = `
다음은 건설 현장의 일일 작업 데이터입니다. 이를 바탕으로 간결한 업무 요약을 작성해주세요.

**공정 현황 (PMS):**
- 진행 중인 작업: ${reportData.pms.totalActive}건
- 작업 목록: ${reportData.pms.activeTasks.map(t => `${t.name} (${t.progress}%)`).join(', ')}

**안전 활동 (SMS):**
- TBM/DRI 시행: ${reportData.sms.dris.length}건
- 사고/이슈: ${reportData.sms.incidents.length}건
- 안전 등급: ${reportData.sms.safetyStatus}

**장비 현황 (EMS):**
- 투입 장비: ${reportData.ems.deployedCount}대

**폐기물 관리 (SWMS):**
- 발생 건수: ${reportData.swms.totalCount}건

**요약 작성 지침:**
1. 2-3문장으로 간결하게 작성
2. 주요 진행 사항과 특이사항 위주로 요약
3. 지연 작업이나 안전 이슈가 있으면 반드시 언급
4. 전문적이고 공식적인 톤 유지

요약:
`

        const result = await model.generateContent(prompt)
        const response = await result.response
        const summary = response.text().trim()

        return summary || generateFallbackSummary(reportData)

    } catch (error) {
        console.error('Gemini API error:', error.message)
        return generateFallbackSummary(reportData)
    }
}

/**
 * Generate fallback summary when AI is unavailable
 */
function generateFallbackSummary(reportData) {
    const parts = []

    // 공정 현황
    if (reportData.pms.totalActive > 0) {
        const delayedTasks = reportData.pms.activeTasks.filter(t =>
            t.delay_risk === true || t.delay_risk === 'HIGH' || t.name.includes('지연')
        )

        if (delayedTasks.length > 0) {
            parts.push(`금일 ${reportData.pms.totalActive}건의 작업이 진행 중이며, ${delayedTasks.length}건의 지연 작업이 발생했습니다.`)
        } else {
            parts.push(`금일 ${reportData.pms.totalActive}건의 작업이 정상적으로 진행 중입니다.`)
        }
    } else {
        parts.push('금일 진행 중인 작업이 없습니다.')
    }

    // 안전 현황
    if (reportData.sms.incidents.length > 0) {
        parts.push(`안전 이슈 ${reportData.sms.incidents.length}건이 발생하여 즉시 조치가 필요합니다.`)
    } else {
        parts.push(`TBM/DRI ${reportData.sms.dris.length}건을 시행하였으며, 안전사고는 발생하지 않았습니다.`)
    }

    // 장비 현황
    if (reportData.ems.deployedCount > 0) {
        parts.push(`현장에 ${reportData.ems.deployedCount}대의 장비가 투입되었습니다.`)
    }

    return parts.join(' ')
}

module.exports = { generateReportSummary }
