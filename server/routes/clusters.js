/**
 * Cluster routes
 * GET /api/clusters -- list clusters for the logged-in user (via clients)
 * GET /api/clusters/:id -- get cluster detail
 * PUT /api/clusters/:id -- update cluster (narrative edits, status)
 * POST /api/clusters -- create cluster under a client
 */
const router = require('express').Router()
const { v4: uuid } = require('../utils/uuid')
const db = require('../db')
const { requireAuth } = require('../middleware/auth')
const { requireClusterQuota, injectPlanInfo } = require('../middleware/planLimits')

router.use(requireAuth)
router.use(injectPlanInfo)   // attaches req.plan for handlers to read

// Field-alias helper: maps DB column names to the shape the frontend normCluster() expects
function shapeCluster(cl) {
  return {
    id:                     cl.id,
    client_id:              cl.client_id,
    business_component:     cl.name,
    theme:                  cl.theme,
    aggregate_time_hours:   cl.hours ?? 0,
    estimated_credit_cad:   cl.credit_cad ?? 0,
    estimated_credit_usd:   Math.round((cl.credit_cad ?? 0) * 0.74),
    risk_score:             0.75,
    eligibility_percentage: 80.0,
    narrative:              cl.narrative,
    status:                 cl.status,
    created_at:             cl.created_at,
    updated_at:             cl.updated_at,
    company_name:           cl.company_name,
    industry:               cl.industry,
    stale_context:          false,
    proxy_used:             false,
    proxy_confidence:       null,
    manual_override_pct:    null,
    manual_override_reason: null,
    trigger_rules:          [],
    narrative_id:           null,
    evidence_snapshot_id:   null,
  }
}

// -- GET /api/clusters (list) -------------------------------------------------
router.get('/', (req, res) => {
  const { status, limit = 200 } = req.query
  let sql = `
    SELECT cl.*, c.company_name, c.industry
    FROM clusters cl
    JOIN clients c ON cl.client_id = c.id
    WHERE c.user_id = ?
  `
  const params = [req.user.id]
  if (status && status !== 'All') {
    sql += ' AND cl.status = ?'
    params.push(status)
  }
  sql += ' ORDER BY cl.created_at DESC LIMIT ?'
  params.push(Number(limit) || 200)
  const rows = db.prepare(sql).all(...params)
  res.json(rows.map(shapeCluster))
})

// -- GET /api/clusters/:id ----------------------------------------------------
router.get('/:id', (req, res) => {
  const cluster = db.prepare(`
    SELECT cl.*, c.company_name, c.industry, c.user_id
    FROM clusters cl
    JOIN clients c ON cl.client_id = c.id
    WHERE cl.id = ? AND c.user_id = ?
  `).get(req.params.id, req.user.id)

  if (!cluster) return res.status(404).json({ message: 'Cluster not found' })
  res.json(shapeCluster(cluster))
})

// -- POST /api/clusters -------------------------------------------------------
router.post('/', requireClusterQuota, (req, res) => {
  const { client_id, name, theme = '', hours = 0, credit_cad = 0, narrative = '' } = req.body ?? {}

  if (!client_id || !name?.trim()) {
    return res.status(400).json({ message: 'client_id and name are required' })
  }

  // Verify client belongs to user
  const client = db.prepare('SELECT id FROM clients WHERE id = ? AND user_id = ?')
    .get(client_id, req.user.id)
  if (!client) return res.status(404).json({ message: 'Client not found' })

  const id = uuid()
  db.prepare(`
    INSERT INTO clusters (id, client_id, name, theme, hours, credit_cad, narrative)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(id, client_id, name.trim(), theme, Number(hours), Number(credit_cad), narrative)

  updateClientAggregates(client_id)

  const cluster = db.prepare(`
    SELECT cl.*, c.company_name, c.industry
    FROM clusters cl JOIN clients c ON cl.client_id = c.id
    WHERE cl.id = ?
  `).get(id)
  res.status(201).json(shapeCluster(cluster))
})

// -- PUT /api/clusters/:id ----------------------------------------------------
router.put('/:id', (req, res) => {
  const cluster = db.prepare(`
    SELECT cl.*, c.user_id FROM clusters cl
    JOIN clients c ON cl.client_id = c.id
    WHERE cl.id = ? AND c.user_id = ?
  `).get(req.params.id, req.user.id)

  if (!cluster) return res.status(404).json({ message: 'Cluster not found' })

  const allowed = ['name', 'theme', 'hours', 'credit_cad', 'status', 'narrative']
  const updates = {}
  for (const key of allowed) {
    if (key in (req.body ?? {})) updates[key] = req.body[key]
  }

  if (Object.keys(updates).length === 0) {
    return res.status(400).json({ message: 'No updatable fields provided' })
  }

  const setClauses = Object.keys(updates).map(k => k + ' = ?').join(', ')
  const values = [...Object.values(updates), req.params.id]
  db.prepare('UPDATE clusters SET ' + setClauses + ' WHERE id = ?').run(...values)

  updateClientAggregates(cluster.client_id)

  const updated = db.prepare(`
    SELECT cl.*, c.company_name, c.industry
    FROM clusters cl JOIN clients c ON cl.client_id = c.id
    WHERE cl.id = ?
  `).get(req.params.id)
  res.json(shapeCluster(updated))
})

// -- DELETE /api/clusters/:id -------------------------------------------------
router.delete('/:id', (req, res) => {
  const cluster = db.prepare(`
    SELECT cl.client_id, c.user_id FROM clusters cl
    JOIN clients c ON cl.client_id = c.id
    WHERE cl.id = ? AND c.user_id = ?
  `).get(req.params.id, req.user.id)

  if (!cluster) return res.status(404).json({ message: 'Cluster not found' })

  db.prepare('DELETE FROM clusters WHERE id = ?').run(req.params.id)
  updateClientAggregates(cluster.client_id)
  res.status(204).send()
})

// -- Helper: recompute client aggregate columns --------------------------------
function updateClientAggregates(clientId) {
  const agg = db.prepare(`
    SELECT
      COUNT(*) AS total,
      SUM(CASE WHEN status = 'approved' THEN 1 ELSE 0 END) AS approved,
      SUM(CASE WHEN status = 'in_review' THEN 1 ELSE 0 END) AS in_review,
      COALESCE(SUM(credit_cad), 0) AS total_credit
    FROM clusters WHERE client_id = ?
  `).get(clientId)

  db.prepare(`
    UPDATE clients SET
      clusters_total = ?,
      clusters_approved = ?,
      clusters_pending_review = ?,
      estimated_credit_cad = ?,
      last_activity_at = strftime('%Y-%m-%dT%H:%M:%SZ','now')
    WHERE id = ?
  `).run(agg.total, agg.approved, agg.in_review, agg.total_credit, clientId)
}

module.exports = router
