/**
 * Auth routes
 *   POST /api/auth/register
 *   POST /api/auth/login
 *   GET  /api/auth/me
 */
const router  = require('express').Router()
const bcrypt  = require('bcryptjs')
const { v4: uuid } = require('../utils/uuid')
const db      = require('../db')
const { signToken, requireAuth } = require('../middleware/auth')

// ── POST /api/auth/register ───────────────────────────────────────────────────
router.post('/register', async (req, res) => {
  const { email, password, full_name = '', firm_name = '', role = 'admin' } = req.body ?? {}

  if (!email || !password) {
    return res.status(400).json({ message: 'email and password are required' })
  }
  if (password.length < 8) {
    return res.status(400).json({ message: 'Password must be at least 8 characters' })
  }

  const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email.toLowerCase())
  if (existing) {
    return res.status(409).json({ message: 'An account with that email already exists' })
  }

  const id            = uuid()
  const password_hash = await bcrypt.hash(password, 10)
  const tenant_id     = `tenant-${id.slice(0, 8)}`

  // Only allow safe roles on self-registration
  const safeRole = ['admin', 'developer', 'reviewer'].includes(role) ? role : 'admin'

  db.prepare(`
    INSERT INTO users (id, email, password_hash, full_name, firm_name, role, tenant_id)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(id, email.toLowerCase(), password_hash, full_name, firm_name, safeRole, tenant_id)

  const user  = db.prepare('SELECT id, email, full_name, firm_name, role, tenant_id, created_at FROM users WHERE id = ?').get(id)
  const token = signToken({ id: user.id, email: user.email, role: user.role, tenant_id: user.tenant_id })

  res.status(201).json({ access_token: token, token_type: 'bearer', user })
})

// ── POST /api/auth/login ──────────────────────────────────────────────────────
router.post('/login', async (req, res) => {
  // Accept both JSON body and form-encoded (for FastAPI OAuth2 compat)
  const email    = (req.body?.email ?? req.body?.username ?? '').toLowerCase()
  const password = req.body?.password ?? ''

  if (!email || !password) {
    return res.status(400).json({ message: 'email and password are required' })
  }

  const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email)
  if (!user) {
    return res.status(401).json({ message: 'Invalid email or password' })
  }

  const valid = await bcrypt.compare(password, user.password_hash)
  if (!valid) {
    return res.status(401).json({ message: 'Invalid email or password' })
  }

  const token = signToken({ id: user.id, email: user.email, role: user.role, tenant_id: user.tenant_id })

  // Return both the FastAPI-compat field name AND a clean user object
  res.json({
    access_token: token,
    token_type:   'bearer',
    user: {
      id:         user.id,
      email:      user.email,
      full_name:  user.full_name,
      firm_name:  user.firm_name,
      role:       user.role,
      tenant_id:  user.tenant_id,
      created_at: user.created_at,
    },
  })
})

// ── GET /api/auth/me ──────────────────────────────────────────────────────────
router.get('/me', requireAuth, (req, res) => {
  const user = db.prepare(
    'SELECT id, email, full_name, firm_name, role, tenant_id, created_at FROM users WHERE id = ?'
  ).get(req.user.id)

  if (!user) {
    return res.status(404).json({ message: 'User not found' })
  }
  res.json(user)
})

module.exports = router
