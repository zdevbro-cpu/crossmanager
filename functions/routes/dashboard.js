const express = require('express')

const createDashboardRouter = (pool) => {
  const router = express.Router()

  // DMS Categories
  router.get('/categories', async (req, res) => {
    try {
      await pool.query(`
        CREATE TABLE IF NOT EXISTS dms_categories (
          id VARCHAR(100) PRIMARY KEY,
          parent_id VARCHAR(100),
          label VARCHAR(255) NOT NULL,
          display_order INTEGER DEFAULT 0,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `)
      const { rows } = await pool.query('SELECT * FROM dms_categories ORDER BY display_order, id')
      res.json(rows)
    } catch (err) {
      console.error('[Dashboard] categories GET error:', err)
      res.status(500).json({ error: 'Failed to fetch categories' })
    }
  })

  router.post('/categories', async (req, res) => {
    try {
      const { id, parent_id, label, display_order } = req.body
      await pool.query(`
        INSERT INTO dms_categories (id, parent_id, label, display_order)
        VALUES ($1, $2, $3, $4)
        ON CONFLICT (id) DO UPDATE SET label = EXCLUDED.label, display_order = EXCLUDED.display_order
      `, [id, parent_id || null, label, display_order || 0])
      res.status(201).json({ id, parent_id, label, display_order })
    } catch (err) {
      console.error('[Dashboard] categories POST error:', err)
      res.status(500).json({ error: 'Failed to create category' })
    }
  })

  return router
}

module.exports = { createDashboardRouter }
