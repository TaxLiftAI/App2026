/**
 * Client routes
 *   GET    /api/clients          — list all clients for authenticated user
 *   POST   /api/clients          — create a new client
 *   GET    /api/clients/:id      — get client + its clusters
 *   PUT    /api/clients/:id      — update client
 *   DELETE /api/clients/:id      — soft-delete (not exposed in UI yet)
 */
const router = require('express').Router()
const { v4: uuid } = require('../utils/uuid')
const db     = require('../db')
const { requireAuth } = require('../middleware/auth')

// All routes require auth
router.use(requireAuth)

// ── GET /api/clients ──────────────────────────────────────────────────────────
router.get('/', (req, res) => {
  const { status, search, sort = 'last_activity_at', order = 'desc' } = req.query

  let sql = 'SELECT * FROM clients WHERE user_id = ?'
  const params = [req.user.id]

  if (status) {
    sql += ' AND status = ?'
    params.push(status)
  }

  if (search) {
    sql += ' AND (company_name LIKE ? OR industry LIKE ? OR primary_contact LIKE ?)'
    const like = `%${search}%`
    params.push(like, like, like)
  }

  // Whitelist sortable columns
  const safeSort  = ['last_activity_at', 'company_name', 'filing_deadline', 'estimated_credit_cad', 'avg_readiness_score'].includes(sort)
    ? sort : 'last_activity_at'
  const safeOrder = order === 'asc' ? 'ASC' : 'DESC'
  sql += ` ORDER BY ${safeSort} ${safeOrder}`

  const clients = db.prepare(sql).all(...params)
  res.json({ clients, total: clients.length })
})

// ── POST /api/clients ─────────────────────────────────────────────────────────
router.post('/', (req, res) => {
  const {
    company_name, industry = '', fiscal_year_end = 'December',
    filing_deadline = '', primary_contact = '', primary_contact_email = '',
    status = 'onboarded', notes = '',
  } = req.body ?? {}

  if (!company_name?.trim()) {
    return res.status(400).json({ message: 'company_name is required' })
  }

  const id = uuid()
  db.prepare(`
    INSERT INTO clients
      (id, user_id, company_name, industry, fiscal_year_end, filing_deadline,
       primary_contact, primary_contact_email, status, notes)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(id, req.user.id, company_name.trim(), industry, fiscal_year_end,
         filing_deadline, primary_contact, primary_contact_email, status, notes)

  const client = db.prepare('SELECT * FROM clients WHERE id = ?').get(id)
  res.status(201).json(client)
})

// ── GET /api/clients/:id ──────────────────────────────────────────────────────
router.get('/:id', (req, res) => {
  const client = db.prepare('SELECT * FROM clients WHERE id = ? AND user_id = ?')
    .get(req.params.id, req.user.id)

  if (!client) return res.status(404).json({ message: 'Client not found' })

  const clusters = db.prepare('SELECT * FROM clusters WHERE client_id = ? ORDER BY created_at DESC')
    .all(req.params.id)

  res.json({ ...client, clusters })
})

// ── PUT /api/clients/:id ──────────────────────────────────────────────────────
router.put('/:id', (req, res) => {
  const client = db.prepare('SELECT * FROM clients WHERE id = ? AND user_id = ?')
    .get(req.params.id, req.user.id)

  if (!client) return res.status(404).json({ message: 'Client not found' })

  const allowed = [
    'company_name', 'industry', 'fiscal_year_end', 'filing_deadline',
    'primary_contact', 'primary_contact_email', 'clusters_total',
    'clusters_approved', 'clusters_pending_review', 'avg_readiness_score',
    'estimated_credit_cad', 'documents_count', 'last_activity_at', 'status', 'notes',
  ]

  const updates = {}
  for (const key of allowed) {
    if (key in (req.body ?? {})) updates[key] = req.body[key]
  }

  if (Object.keys(updates).length === 0) {
    return res.status(400).json({ message: 'No updatable fields provided' })
  }

  const setClauses = Object.keys(updates).map(k => `${k} = ?`).join(', ')
  const values     = [...Object.values(updates), req.params.id, req.user.id]

  db.prepare(`UPDATE clients SET ${setClauses} WHERE id = ? AND user_id = ?`).run(...values)

  const updated = db.prepare('SELECT * FROM clients WHERE id = ?').get(req.params.id)
  res.json(updated)
})

// ── DELETE /api/clients/:id ───────────────────────────────────────────────────
router.delete('/:id', (req, res) => {
  const client = db.prepare('SELECT id FROM clients WHERE id = ? AND user_id = ?')
    .get(req.params.id, req.user.id)

  if (!client) return res.status(404).json({ message: 'Client not found' })

  // Cascade to clusters
  db.prepare('DELETE FROM clusters WHERE client_id = ?').run(req.params.id)
  db.prepare('DELETE FROM clients WHERE id = ?').run(req.params.id)

  res.status(204).send()
})

module.exports = router
