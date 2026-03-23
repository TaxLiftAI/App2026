/**
 * Leads routes — public lead capture + admin view
 *
 *   POST /api/leads          — public, no auth required
 *   GET  /api/leads          — admin only (role = 'admin')
 *   GET  /api/leads/export   — CSV export, admin only
 */
const router    = require('express').Router()
const db        = require('../db')
const { requireAuth } = require('../middleware/auth')
const { v4: uuidv4 }  = require('../utils/uuid')

// ── Middleware: require admin role ─────────────────────────────────────────────
function requireAdmin(req, res, next) {
  if (!req.user)             return res.status(401).json({ message: 'Unauthorised' })
  if (req.user.role !== 'admin') return res.status(403).json({ message: 'Admin access required' })
  next()
}

// ── POST /api/leads ────────────────────────────────────────────────────────────
// Public — no auth. Captures marketing leads (waitlist, pricing CTAs, demo requests).
router.post('/', (req, res) => {
  const { email, name = '', company = '', plan_interest = '', source = 'marketing' } = req.body ?? {}

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ message: 'A valid email address is required' })
  }

  const id = uuidv4()

  try {
    db.prepare(`
      INSERT INTO leads (id, email, name, company, plan_interest, source)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(id, email.toLowerCase().trim(), name.trim(), company.trim(), plan_interest.trim(), source.trim())

    console.log(`[leads] New lead captured: ${email} (plan: ${plan_interest || 'unspecified'})`)
    res.status(201).json({ id, message: 'Lead captured successfully' })
  } catch (err) {
    // Silently succeed on duplicate email — don't tell the user we already have them
    if (err.message?.includes('UNIQUE constraint failed')) {
      return res.status(200).json({ id: null, message: 'Thanks! We already have you on the list.' })
    }
    console.error('[leads] insert error:', err.message)
    res.status(500).json({ message: 'Failed to save lead' })
  }
})

// ── GET /api/leads ─────────────────────────────────────────────────────────────
// Admin only. Returns paginated leads list.
router.get('/', requireAuth, requireAdmin, (req, res) => {
  const page  = Math.max(1, parseInt(req.query.page  ?? '1',  10))
  const limit = Math.min(200, Math.max(1, parseInt(req.query.limit ?? '50', 10)))
  const offset = (page - 1) * limit

  const search       = req.query.search ?? ''
  const plan_filter  = req.query.plan   ?? ''
  const source_filter = req.query.source ?? ''

  let where  = 'WHERE 1=1'
  const args = []

  if (search) {
    where += ' AND (email LIKE ? OR name LIKE ? OR company LIKE ?)'
    const like = `%${search}%`
    args.push(like, like, like)
  }
  if (plan_filter) {
    where += ' AND plan_interest = ?'
    args.push(plan_filter)
  }
  if (source_filter) {
    where += ' AND source = ?'
    args.push(source_filter)
  }

  const total = db.prepare(`SELECT COUNT(*) as n FROM leads ${where}`).get(...args).n
  const rows  = db.prepare(`
    SELECT id, email, name, company, plan_interest, source, created_at
    FROM leads ${where}
    ORDER BY created_at DESC
    LIMIT ? OFFSET ?
  `).all(...args, limit, offset)

  res.json({ leads: rows, total, page, limit, pages: Math.ceil(total / limit) })
})

// ── GET /api/leads/export ──────────────────────────────────────────────────────
// CSV export — admin only.
router.get('/export', requireAuth, requireAdmin, (req, res) => {
  const rows = db.prepare(`
    SELECT id, email, name, company, plan_interest, source, created_at
    FROM leads
    ORDER BY created_at DESC
  `).all()

  const escape = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`

  const header = ['ID', 'Email', 'Name', 'Company', 'Plan Interest', 'Source', 'Created At']
  const lines  = [
    header.join(','),
    ...rows.map(r => [
      escape(r.id),
      escape(r.email),
      escape(r.name),
      escape(r.company),
      escape(r.plan_interest),
      escape(r.source),
      escape(r.created_at),
    ].join(',')),
  ]

  const csv = lines.join('\r\n')
  const filename = `taxlift-leads-${new Date().toISOString().slice(0, 10)}.csv`

  res.setHeader('Content-Type', 'text/csv')
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`)
  res.send(csv)
})

module.exports = router
