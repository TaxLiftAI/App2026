/**
 * Narratives routes — thin adapter over the clusters.narrative column.
 *
 * The frontend treats narratives as first-class objects (GET /narratives?cluster_id=X,
 * PATCH /narratives/:id, etc.) but the DB stores them in clusters.narrative.
 * This adapter maps between the two shapes using the cluster ID as the narrative ID.
 *
 *   GET    /api/v1/narratives?cluster_id=   → list (returns 0 or 1 item)
 *   POST   /api/v1/narratives               → create/upsert narrative for a cluster
 *   GET    /api/v1/narratives/:id           → get single narrative
 *   PATCH  /api/v1/narratives/:id           → update content
 *   PATCH  /api/v1/narratives/:id/approve   → mark approved
 *   GET    /api/v1/narratives/:id/versions  → version history (stub — returns [])
 */
const router = require('express').Router()
const db = require('../db')
const { requireAuth } = require('../middleware/auth')

router.use(requireAuth)

// Shape a cluster row into a narrative object the frontend expects
function shapeNarrative(cl) {
  return {
    id:          cl.id,                       // use cluster id as narrative id
    cluster_id:  cl.id,
    content:     cl.narrative ?? '',
    status:      cl.narrative ? 'Drafted' : 'Pending',
    approved_by: cl.approved_by ?? null,
    approved_at: cl.approved_at ?? null,
    created_at:  cl.created_at,
    updated_at:  cl.updated_at,
  }
}

function getClusterForUser(clusterId, userId) {
  return db.prepare(`
    SELECT cl.*, c.user_id FROM clusters cl
    JOIN clients c ON cl.client_id = c.id
    WHERE cl.id = ? AND c.user_id = ?
  `).get(clusterId, userId)
}

// GET /narratives?cluster_id=X
router.get('/', (req, res) => {
  const { cluster_id } = req.query
  if (!cluster_id) return res.json([])

  const cl = getClusterForUser(cluster_id, req.user.id)
  if (!cl || !cl.narrative) return res.json([])
  res.json([shapeNarrative(cl)])
})

// GET /narratives/:id
router.get('/:id', (req, res) => {
  const cl = getClusterForUser(req.params.id, req.user.id)
  if (!cl) return res.status(404).json({ message: 'Narrative not found' })
  res.json(shapeNarrative(cl))
})

// POST /narratives — create/upsert narrative content for a cluster
router.post('/', (req, res) => {
  const { cluster_id, content } = req.body ?? {}
  if (!cluster_id) return res.status(400).json({ message: 'cluster_id is required' })

  const cl = getClusterForUser(cluster_id, req.user.id)
  if (!cl) return res.status(404).json({ message: 'Cluster not found' })

  db.prepare(`UPDATE clusters SET narrative = ?, updated_at = datetime('now') WHERE id = ?`).run(content ?? '', cluster_id)
  const updated = db.prepare(`SELECT cl.* FROM clusters cl WHERE cl.id = ?`).get(cluster_id)
  res.status(201).json(shapeNarrative(updated))
})

// PATCH /narratives/:id — update content
router.patch('/:id', (req, res) => {
  const cl = getClusterForUser(req.params.id, req.user.id)
  if (!cl) return res.status(404).json({ message: 'Narrative not found' })

  const { content } = req.body ?? {}
  if (content !== undefined) {
    db.prepare(`UPDATE clusters SET narrative = ?, updated_at = datetime('now') WHERE id = ?`).run(content, req.params.id)
  }
  const updated = db.prepare(`SELECT cl.* FROM clusters cl WHERE cl.id = ?`).get(req.params.id)
  res.json(shapeNarrative(updated))
})

// PATCH /narratives/:id/approve
router.patch('/:id/approve', (req, res) => {
  const cl = getClusterForUser(req.params.id, req.user.id)
  if (!cl) return res.status(404).json({ message: 'Narrative not found' })

  // Store approval metadata in cluster status
  db.prepare(`UPDATE clusters SET status = 'Approved', updated_at = datetime('now') WHERE id = ?`).run(req.params.id)
  const updated = db.prepare(`SELECT cl.* FROM clusters cl WHERE cl.id = ?`).get(req.params.id)
  res.json({ ...shapeNarrative(updated), approved_by: req.user.id, approved_at: new Date().toISOString() })
})

// GET /narratives/:id/versions — stub (no versioning table)
router.get('/:id/versions', (req, res) => {
  res.json([])
})

module.exports = router
