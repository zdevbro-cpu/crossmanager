/**
 * CLI runner for dashboard ingestion.
 * Usage: NODE_ENV=development node jobs/run_dashboard_ingest.js
 */
const { ingestDashboardHealth } = require('./dashboard_ingest')

async function main() {
  try {
    const { total, success } = await ingestDashboardHealth()
    console.log(`[dashboard ingest] completed. success=${success}/${total}`)
    process.exit(0)
  } catch (err) {
    console.error('[dashboard ingest] failed:', err)
    process.exit(1)
  }
}

main()
