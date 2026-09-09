/**
 * Dashboard batch ingestion (skeleton)
 * - Fetch projects (or target list)
 * - Build metrics from upstream systems (TODO: replace with real queries)
 * - Compute Health Score
 * - Upsert into dashboard.health_daily
 *
 * This is a starting point; wire real queries for schedule/safety/cost/resource/quality metrics.
 */

const { Pool } = require('pg')
const { computeHealth } = require('../services/dashboard')

// Pool config uses environment variables (DB_HOST, DB_USER, DB_PASSWORD, DB_NAME, DB_PORT)
const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  port: process.env.DB_PORT || 5432,
  ssl: process.env.DB_HOST && !String(process.env.DB_HOST).includes('localhost')
    ? { rejectUnauthorized: false }
    : false,
})

// TODO: replace with real project source
async function fetchProjects() {
  try {
    const { rows } = await pool.query('SELECT id FROM projects LIMIT 200')
    return rows.map(r => r.id)
  } catch (e) {
    console.warn('[dashboard ingest] projects fetch failed, fallback to empty', e.message)
    return []
  }
}

// TODO: replace with real metrics aggregation per project
async function buildMetricsForProject(projectId) {
  // Placeholder metrics; integrate schedule/safety/cost/resource/quality data here.
  return {
    project_id: projectId,
    calc_date: new Date().toISOString().slice(0, 10),
    metrics: {
      schedule_delay_pp: 0,
      critical_delay_weeks: 0,
      nc_unresolved: 0,
      near_miss_increase_rate: 0,
      checklist_miss_rate: 0,
      accident_penalty: 0,
      cost_over_rate: 0,
      margin_gap_pp: 0,
      dup_dispatch: 0,
      idle_rate: 0,
      manpower_short_rate: 0,
      key_cert_missing: false,
      missing_docs: 0,
      approval_delay_days: 0,
      rejected_cnt: 0,
    },
    top_reasons: [],
    data_quality_flag: {},
  }
}

async function upsertHealth(item) {
  const {
    project_id,
    calc_date,
    metrics = {},
    weights = {},
    top_reasons = [],
    data_quality_flag = {},
  } = item
  const scores = computeHealth(metrics, weights)

  const sql = `
    INSERT INTO dashboard.health_daily (
      project_id, calc_date,
      score_total, score_schedule, score_safety, score_cost, score_resource, score_quality,
      grade, forced_red, top_reasons, data_quality_flag, created_at, updated_at
    )
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,NOW(),NOW())
    ON CONFLICT (project_id, calc_date) DO UPDATE SET
      score_total = EXCLUDED.score_total,
      score_schedule = EXCLUDED.score_schedule,
      score_safety = EXCLUDED.score_safety,
      score_cost = EXCLUDED.score_cost,
      score_resource = EXCLUDED.score_resource,
      score_quality = EXCLUDED.score_quality,
      grade = EXCLUDED.grade,
      forced_red = EXCLUDED.forced_red,
      top_reasons = EXCLUDED.top_reasons,
      data_quality_flag = EXCLUDED.data_quality_flag,
      updated_at = NOW()
  `
  const params = [
    project_id,
    calc_date,
    scores.score_total,
    scores.score_schedule,
    scores.score_safety,
    scores.score_cost,
    scores.score_resource,
    scores.score_quality,
    scores.grade,
    scores.forced_red,
    JSON.stringify(top_reasons || []),
    JSON.stringify(data_quality_flag || {}),
  ]
  await pool.query(sql, params)
}

async function ingestDashboardHealth() {
  const projectIds = await fetchProjects()
  let success = 0
  for (const pid of projectIds) {
    try {
      const item = await buildMetricsForProject(pid)
      await upsertHealth(item)
      success += 1
    } catch (e) {
      console.error(`[dashboard ingest] failed project ${pid}:`, e.message)
    }
  }
  return { total: projectIds.length, success }
}

module.exports = {
  ingestDashboardHealth,
}
