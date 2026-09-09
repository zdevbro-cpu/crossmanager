const { GoogleGenerativeAI } = require('@google/generative-ai')

// Gemini API init
const genAI = process.env.GEMINI_API_KEY
    ? new GoogleGenerativeAI(process.env.GEMINI_API_KEY)
    : null

function countDelayedTasks(activeTasks = []) {
    if (!Array.isArray(activeTasks)) return 0

    return activeTasks.filter((task) => {
        const delayRisk = task?.delay_risk
        const name = String(task?.name || '')

        return (
            delayRisk === true ||
            delayRisk === 'HIGH' ||
            delayRisk === 'DELAY' ||
            name.includes('지연') ||
            name.toLowerCase().includes('delay')
        )
    }).length
}

function summaryPrefix(type) {
    if (type === 'WEEKLY') return '금주'
    if (type === 'MONTHLY') return '금월'
    return '금일'
}

function generateStructuredSummary(reportData) {
    const prefix = summaryPrefix(reportData?.type)
    const totalActive = Number(reportData?.pms?.totalActive || 0)
    const delayedCount = countDelayedTasks(reportData?.pms?.activeTasks || [])
    const driCount = Array.isArray(reportData?.sms?.dris) ? reportData.sms.dris.length : 0
    const incidentCount = Array.isArray(reportData?.sms?.incidents) ? reportData.sms.incidents.length : 0

    const lines = []

    if (totalActive > 0) lines.push(`* ${prefix} ${totalActive}건 작업진행`)
    else lines.push(`* ${prefix} 작업진행 없음`)

    if (delayedCount > 0) lines.push(`* 작업지연 ${delayedCount}건 발생`)
    else lines.push(`* 작업지연 없음`)

    if (driCount > 0) lines.push(`* TBM/DRI 시행: ${driCount}건`)
    else lines.push(`* TBM/DRI 시행 없음`)

    lines.push(`* 안전사고 발생 : ${incidentCount}건`)

    return lines.join('\n')
}

function normalizeBullets(text) {
    if (!text) return ''

    const lines = String(text)
        .replace(/\r\n/g, '\n')
        .split('\n')
        .map((line) => line.trim())
        .filter(Boolean)

    if (lines.length === 0) return ''

    return lines
        .map((line) => {
            const normalized = line.replace(/^[-•*]\s*/, '')
            return `* ${normalized}`
        })
        .join('\n')
}

/**
 * Generate report summary
 * - Default: structured bullets (deterministic)
 * - Optional: Gemini (set REPORT_SUMMARY_MODE=GEMINI)
 */
async function generateReportSummary(reportData) {
    const structured = generateStructuredSummary(reportData)
    const mode = (process.env.REPORT_SUMMARY_MODE || 'STRUCTURED').toUpperCase()

    if (mode !== 'GEMINI') return structured

    if (!genAI) {
        console.warn('Gemini API key not configured, using structured summary')
        return structured
    }

    try {
        const model = genAI.getGenerativeModel({ model: 'gemini-pro' })

        const prefix = summaryPrefix(reportData?.type)
        const totalActive = Number(reportData?.pms?.totalActive || 0)
        const delayedCount = countDelayedTasks(reportData?.pms?.activeTasks || [])
        const driCount = Array.isArray(reportData?.sms?.dris) ? reportData.sms.dris.length : 0
        const incidentCount = Array.isArray(reportData?.sms?.incidents) ? reportData.sms.incidents.length : 0

        const prompt = `
아래 JSON 데이터를 참고해서 "${prefix} 작업 요약"을 한국어로 작성해 주세요.
Data: ${JSON.stringify(reportData)}

출력은 반드시 아래 4줄 형식(각 줄은 NEW LINE)으로만 답해 주세요. 문장을 추가하거나 합치지 마세요.
- 첫 글자는 반드시 "* " 로 시작
- 아래 숫자 값은 데이터에 맞게 채움

형식(예시):
* ${prefix} ${totalActive}건 작업진행
* 작업지연 ${delayedCount}건 발생
* TBM/DRI 시행: ${driCount}건
* 안전사고 발생 : ${incidentCount}건
        `.trim()

        const result = await model.generateContent(prompt)
        const response = await result.response
        const text = normalizeBullets(response.text())

        return text || structured
    } catch (error) {
        console.error('Gemini API error:', error.message)
        return structured
    }
}

module.exports = { generateReportSummary }

