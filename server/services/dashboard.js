// Health Score calculation utilities (initial version)
// Inputs: metrics from upstream systems (schedule/safety/cost/resource/quality) and weights/penalties

function clamp100(v) {
  return Math.max(0, Math.min(100, Number.isFinite(v) ? v : 0))
}

function calcSchedule(m) {
  const delay = Math.max(0, Number(m.schedule_delay_pp || 0)) // 계획-실적(%p)
  const criticalPenalty = m.critical_delay_weeks && m.critical_delay_weeks >= 2 ? 15 : 0
  const score = 100 - delay * 4 - criticalPenalty
  return clamp100(score)
}

function calcSafety(m) {
  const ncUnresolved = Number(m.nc_unresolved || 0)
  const nearMissRise = Number(m.near_miss_increase_rate || 0)
  const checklistGap = Number(m.checklist_miss_rate || 0)
  const accidentPenalty = Number(m.accident_penalty || 0) // 0, 30~70 등
  const score = 100 - ncUnresolved * 8 - nearMissRise * 0.5 - checklistGap * 1.0 - accidentPenalty
  return clamp100(score)
}

function calcCost(m) {
  const costOver = Number(m.cost_over_rate || 0) // %
  const marginGap = Number(m.margin_gap_pp || 0) // 목표 대비 부족 %p
  const score = 100 - costOver * 2 - marginGap * 3
  return clamp100(score)
}

function calcResource(m) {
  const dupDispatch = Number(m.dup_dispatch || 0)
  const idleRate = Number(m.idle_rate || 0)
  const manpowerShort = Number(m.manpower_short_rate || 0)
  const keyMissing = m.key_cert_missing ? 15 : 0
  const score = 100 - dupDispatch * 5 - idleRate * 0.5 - manpowerShort * 1.0 - keyMissing
  return clamp100(score)
}

function calcQuality(m) {
  const missingDocs = Number(m.missing_docs || 0)
  const approvalDelay = Number(m.approval_delay_days || 0)
  const rejected = Number(m.rejected_cnt || 0)
  const score = 100 - missingDocs * 10 - approvalDelay * 2 - rejected * 15
  return clamp100(score)
}

function calcGrades(total, forcedRed) {
  if (forcedRed) return 'RED'
  if (total >= 80) return 'GREEN'
  if (total >= 65) return 'YELLOW'
  if (total >= 50) return 'ORANGE'
  return 'RED'
}

function calcForcedRed(m) {
  if (m.major_accident) return true
  if (m.critical_delay_weeks && m.critical_delay_weeks >= 2) return true
  if (m.cost_over_rate && m.cost_over_rate >= 15) return true
  if (m.missing_legal_docs) return true
  return false
}

function computeHealth(metrics = {}, weights = {}) {
  const w = {
    schedule: Number(weights.w_schedule) || 0.25,
    safety: Number(weights.w_safety) || 0.30,
    cost: Number(weights.w_cost) || 0.20,
    resource: Number(weights.w_resource) || 0.15,
    quality: Number(weights.w_quality) || 0.10,
  }

  const s = calcSchedule(metrics)
  const sa = calcSafety(metrics)
  const c = calcCost(metrics)
  const r = calcResource(metrics)
  const q = calcQuality(metrics)

  const forcedRed = calcForcedRed(metrics)
  const total = clamp100(
    s * w.schedule +
    sa * w.safety +
    c * w.cost +
    r * w.resource +
    q * w.quality
  )
  const grade = calcGrades(total, forcedRed)

  return {
    score_total: total,
    score_schedule: s,
    score_safety: sa,
    score_cost: c,
    score_resource: r,
    score_quality: q,
    grade,
    forced_red: forcedRed,
  }
}

module.exports = {
  computeHealth,
}
