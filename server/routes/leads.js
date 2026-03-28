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
// Admin only. Returns paginated leads list, enriched with free_scan data.
// Query params:
//   page, limit, search, plan, source
//   min_credit  — filter to leads with estimated_credit >= this value
//   sort        — 'credit' | 'date' (default: credit desc, then date desc)
router.get('/', requireAuth, requireAdmin, (req, res) => {
  const page  = Math.max(1, parseInt(req.query.page  ?? '1',  10))
  const limit = Math.min(200, Math.max(1, parseInt(req.query.limit ?? '50', 10)))
  const offset = (page - 1) * limit

  const search        = req.query.search     ?? ''
  const plan_filter   = req.query.plan       ?? ''
  const source_filter = req.query.source     ?? ''
  const min_credit    = parseFloat(req.query.min_credit ?? '0') || 0
  const sort          = req.query.sort === 'date' ? 'date' : 'credit'

  // Base query — LEFT JOIN free_scans to surface credit estimates
  // Uses MAX so each lead row is unique even if there are multiple scans per email
  let where  = 'WHERE 1=1'
  const args = []

  if (search) {
    where += ' AND (l.email LIKE ? OR l.name LIKE ? OR l.company LIKE ?)'
    const like = `%${search}%`
    args.push(like, like, like)
  }
  if (plan_filter) {
    where += ' AND l.plan_interest = ?'
    args.push(plan_filter)
  }
  if (source_filter) {
    where += ' AND l.source = ?'
    args.push(source_filter)
  }
  if (min_credit > 0) {
    where += ' AND COALESCE(fs_agg.estimated_credit, 0) >= ?'
    args.push(min_credit)
  }

  const orderBy = sort === 'date'
    ? 'ORDER BY l.created_at DESC'
    : 'ORDER BY COALESCE(fs_agg.estimated_credit, 0) DESC, l.created_at DESC'

  // Subquery aggregates best scan per email
  const scanSubquery = `
    SELECT email,
           MAX(estimated_credit) as estimated_credit,
           MAX(cluster_count)    as cluster_count,
           MAX(commit_count)     as commit_count,
           MAX(id)               as scan_id,
           MAX(created_at)       as scanned_at
    FROM free_scans
    GROUP BY email
  `

  const countSql = `
    SELECT COUNT(*) as n
    FROM leads l
    LEFT JOIN (${scanSubquery}) fs_agg ON fs_agg.email = l.email
    ${where}
  `
  const dataSql = `
    SELECT
      l.id, l.email, l.name, l.company, l.plan_interest, l.source, l.created_at,
      COALESCE(fs_agg.estimated_credit, 0) as estimated_credit,
      COALESCE(fs_agg.cluster_count,    0) as cluster_count,
      COALESCE(fs_agg.commit_count,     0) as commit_count,
      fs_agg.scan_id,
      fs_agg.scanned_at
    FROM leads l
    LEFT JOIN (${scanSubquery}) fs_agg ON fs_agg.email = l.email
    ${where}
    ${orderBy}
    LIMIT ? OFFSET ?
  `

  const total = db.prepare(countSql).get(...args).n
  const rows  = db.prepare(dataSql).all(...args, limit, offset)

  // Compute summary stats for the admin dashboard header
  const statsRows = db.prepare(`
    SELECT
      COUNT(DISTINCT l.id) as total_leads,
      COUNT(DISTINCT CASE WHEN l.source = 'free_scan' OR fs_agg.scan_id IS NOT NULL THEN l.id END) as scan_leads,
      COUNT(DISTINCT CASE WHEN COALESCE(fs_agg.estimated_credit, 0) >= 100000 THEN l.id END) as hot_leads,
      COALESCE(MAX(fs_agg.estimated_credit), 0) as top_credit
    FROM leads l
    LEFT JOIN (${scanSubquery}) fs_agg ON fs_agg.email = l.email
  `).get()

  res.json({
    leads:  rows,
    total,
    page,
    limit,
    pages:  Math.ceil(total / limit),
    stats:  statsRows,
  })
})

// ── GET /api/leads/export ──────────────────────────────────────────────────────
// CSV export — admin only. Includes scan credit data.
router.get('/export', requireAuth, requireAdmin, (req, res) => {
  const rows = db.prepare(`
    SELECT
      l.id, l.email, l.name, l.company, l.plan_interest, l.source, l.created_at,
      COALESCE(fs_agg.estimated_credit, 0) as estimated_credit,
      COALESCE(fs_agg.cluster_count, 0) as cluster_count,
      fs_agg.scanned_at
    FROM leads l
    LEFT JOIN (
      SELECT email, MAX(estimated_credit) as estimated_credit,
             MAX(cluster_count) as cluster_count, MAX(created_at) as scanned_at
      FROM free_scans GROUP BY email
    ) fs_agg ON fs_agg.email = l.email
    ORDER BY COALESCE(fs_agg.estimated_credit, 0) DESC, l.created_at DESC
  `).all()

  const escape = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`

  const header = ['ID', 'Email', 'Name', 'Company', 'Plan Interest', 'Source', 'Estimated Credit (CAD)', 'Clusters', 'Scanned At', 'Lead Captured At']
  const lines  = [
    header.join(','),
    ...rows.map(r => [
      escape(r.id),
      escape(r.email),
      escape(r.name),
      escape(r.company),
      escape(r.plan_interest),
      escape(r.source),
      escape(r.estimated_credit ? Math.round(r.estimated_credit) : ''),
      escape(r.cluster_count || ''),
      escape(r.scanned_at || ''),
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
