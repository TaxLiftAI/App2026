/**
 * Users routes — list/get users within the authenticated user's tenant.
 *
 *   GET  /api/v1/users          → list users (filtered by tenant_id query param)
 *   GET  /api/v1/users/:id      → get single user
 *   PUT  /api/v1/users/:id      → update user (admin only)
 */
const router = require('express').Router()
const db = require('../db')
const { requireAuth } = require('../middleware/auth')

router.use(requireAuth)

function shapeUser(u) {
  return {
    id:           u.id,
    email:        u.email,
    display_name: u.display_name,
    role:         u.role,
    tenant_id:    u.tenant_id,
    is_active:    u.is_active ?? 1,
    created_at:   u.created_at,
    last_login_at: u.last_login_at,
  }
}

// GET /users?tenant_id=X
router.get('/', (req, res) => {
  const { tenant_id } = req.query

  // Users can only list users in their own tenant
  const effectiveTenantId = req.user.tenant_id

  let rows
  if (effectiveTenantId) {
    rows = db.prepare(`SELECT * FROM users WHERE tenant_id = ? ORDER BY created_at DESC`).all(effectiveTenantId)
  } else {
    // No tenant — return just the requesting user
    rows = db.prepare(`SELECT * FROM users WHERE id = ?`).all(req.user.id)
  }

  res.json(rows.map(shapeUser))
})

// GET /users/:id
router.get('/:id', (req, res) => {
  const user = db.prepare(`SELECT * FROM users WHERE id = ?`).get(req.params.id)
  if (!user) return res.status(404).json({ message: 'User not found' })

  // Only allow viewing own user or users in same tenant
  if (user.id !== req.user.id && user.tenant_id !== req.user.tenant_id) {
    return res.status(403).json({ message: 'Forbidden' })
  }
  res.json(shapeUser(user))
})

// PUT /users/:id — update display_name or role
router.put('/:id', (req, res) => {
  const user = db.prepare(`SELECT * FROM users WHERE id = ?`).get(req.params.id)
  if (!user) return res.status(404).json({ message: 'User not found' })
  if (user.id !== req.user.id && user.tenant_id !== req.user.tenant_id) {
    return res.status(403).json({ message: 'Forbidden' })
  }

  const allowed = ['display_name', 'role', 'is_active']
  const updates = {}
  for (const key of allowed) {
    if (key in (req.body ?? {})) updates[key] = req.body[key]
  }
  if (Object.keys(updates).length === 0) return res.status(400).json({ message: 'No updatable fields' })

  const setClauses = Object.keys(updates).map(k => `${k} = ?`).join(', ')
  db.prepare(`UPDATE users SET ${setClauses} WHERE id = ?`).run(...Object.values(updates), req.params.id)
  const updated = db.prepare(`SELECT * FROM users WHERE id = ?`).get(req.params.id)
  res.json(shapeUser(updated))
})

module.exports = router
