/**
 * Admin routes
 *
 * GET  /api/admin/funnel          — full sales funnel data
 * POST /api/admin/drip/trigger    — manually trigger a drip email step
 * GET  /api/admin/funnel/export   — CSV export of free scans with drip status
 *
 * All endpoints require auth + admin role.
 */
const router = require('express').Router()
const db     = require('../db')
const { requireAuth } = require('../middleware/auth')
const { v4: uuidv4 }  = require('../utils/uuid')

function requireAdmin(req, res, next) {
  if (!req.user) return res.status(401).json({ message: 'Unauthorised' })
  const adminEmail = process.env.ADMIN_EMAIL
  const isAdmin = req.user.role === 'admin' || (adminEmail && req.user.email === adminEmail)
  if (!isAdmin) return res.status(403).json({ message: 'Admin access required' })
  next()
}

// ── GET /api/admin/funnel ─────────────────────────────────────────────────────
router.get('/funnel', requireAuth, requireAdmin, (req, res) => {
  // Free scans ordered by most recent
  const freeScans = db.prepare(`
    SELECT id, email, repos_json, clusters_json,
           estimated_credit, commit_count, cluster_count, hours_total, created_at
    FROM free_scans
    ORDER BY created_at DESC
  `).all()

  // All drip emails — build a map: scan_id → step → { status, sent_at }
  const dripRows = db.prepare(`
    SELECT scan_id, sequence_step, status, sent_at
    FROM drip_emails
  `).all()

  const dripByScanId = {}
  for (const row of dripRows) {
    if (!dripByScanId[row.scan_id]) dripByScanId[row.scan_id] = {}
    dripByScanId[row.scan_id][row.sequence_step] = {
      status:  row.status,
      sent_at: row.sent_at,
    }
  }

  const scansWithDrip = freeScans.map(scan => ({
    ...scan,
    drip: dripByScanId[scan.id] ?? {},
  }))

  // Marketing leads
  const leadsRows = db.prepare(`
    SELECT id, email, name, company, plan_interest, source, created_at
    FROM leads
    ORDER BY created_at DESC
  `).all()

  // Users
  const totalUsers = db.prepare(`SELECT COUNT(*) as n FROM users`).get().n

  const userLast7 = db.prepare(`
    SELECT date(created_at) as day, COUNT(*) as n
    FROM users
    WHERE created_at >= datetime('now', '-6 days')
    GROUP BY day
    ORDER BY day ASC
  `).all()

  // Free scans sparkline (last 7 days)
  const scanLast7 = db.prepare(`
    SELECT date(created_at) as day, COUNT(*) as n
    FROM free_scans
    WHERE created_at >= datetime('now', '-6 days')
    GROUP BY day
    ORDER BY day ASC
  `).all()

  // Paid users (any non-free tier)
  const paidCount = db.prepare(`
    SELECT COUNT(*) as n FROM users
    WHERE subscription_tier NOT IN ('free', '') AND subscription_tier IS NOT NULL
  `).get().n

  // Unique email leads (union of free_scans + leads)
  const emailLeadsTotal = db.prepare(`
    SELECT COUNT(DISTINCT email) as n FROM (
      SELECT email FROM free_scans WHERE email != ''
      UNION
      SELECT email FROM leads WHERE email != ''
    )
  `).get().n

  // Unique emails that have at least 1 drip step sent
  const dripSentCount = db.prepare(`
    SELECT COUNT(DISTINCT email) as n FROM drip_emails WHERE status = 'sent'
  `).get().n

  // 30-day daily series: scans + signups per day
  const scansDaily = db.prepare(`
    SELECT date(created_at) as day, COUNT(*) as scans
    FROM free_scans
    WHERE created_at >= datetime('now', '-29 days')
    GROUP BY day
    ORDER BY day ASC
  `).all()

  const signupsDaily = db.prepare(`
    SELECT date(created_at) as day, COUNT(*) as signups
    FROM users
    WHERE created_at >= datetime('now', '-29 days')
    GROUP BY day
    ORDER BY day ASC
  `).all()

  // Merge into unified day array (last 30 days, fill gaps with 0)
  const daily = []
  for (let i = 29; i >= 0; i--) {
    const d   = new Date()
    d.setDate(d.getDate() - i)
    const day = d.toISOString().slice(0, 10)
    const s   = scansDaily.find(r => r.day === day)
    const u   = signupsDaily.find(r => r.day === day)
    daily.push({ day, scans: s?.scans ?? 0, signups: u?.signups ?? 0 })
  }

  // All users list with tier info (for Users tab)
  const allUsers = db.prepare(`
    SELECT id, email, full_name, firm_name, subscription_tier, onboarding_completed, created_at
    FROM users
    ORDER BY created_at DESC
  `).all()

  res.json({
    freeScans:   scansWithDrip,
    leads:       leadsRows,
    users:       { total: totalUsers, last7days: userLast7 },
    emailLeads:  { total: emailLeadsTotal, dripSentCount },
    paidCount,
    scanSparkline: scanLast7,
    daily,
    allUsers,
  })
})

// ── GET /api/admin/funnel/export ──────────────────────────────────────────────
router.get('/funnel/export', requireAuth, requireAdmin, (req, res) => {
  const scans = db.prepare(`
    SELECT id, email, repos_json, clusters_json, estimated_credit, created_at
    FROM free_scans
    ORDER BY created_at DESC
  `).all()

  const dripRows = db.prepare(`
    SELECT scan_id, sequence_step, status FROM drip_emails
  `).all()

  const dripMap = {}
  for (const row of dripRows) {
    if (!dripMap[row.scan_id]) dripMap[row.scan_id] = {}
    dripMap[row.scan_id][row.sequence_step] = row.status
  }

  const esc = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`

  const header = ['ID', 'Email', 'Repos', 'Estimate (CAD)', 'Email1', 'Email2', 'Email3', 'Scanned At']
  const lines  = [
    header.join(','),
    ...scans.map(s => {
      const repos    = JSON.parse(s.repos_json    || '[]')
      const drip     = dripMap[s.id] ?? {}
      const low      = Math.round((s.estimated_credit ?? 0) * 0.8)
      const high     = Math.round((s.estimated_credit ?? 0) * 1.2)
      const estimate = s.estimated_credit > 0 ? `$${low}–$${high}` : '$0'
      return [
        esc(s.id),
        esc(s.email),
        esc(repos.join('; ')),
        esc(estimate),
        esc(drip[1] ?? 'not scheduled'),
        esc(drip[2] ?? 'not scheduled'),
        esc(drip[3] ?? 'not scheduled'),
        esc(s.created_at),
      ].join(',')
    }),
  ]

  const filename = `taxlift-funnel-${new Date().toISOString().slice(0, 10)}.csv`
  res.setHeader('Content-Type', 'text/csv')
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`)
  res.send(lines.join('\r\n'))
})

// ── POST /api/admin/drip/trigger ──────────────────────────────────────────────
router.post('/drip/trigger', requireAuth, requireAdmin, (req, res) => {
  const { email, scanId, step = 1 } = req.body ?? {}

  if (!email || !scanId) {
    return res.status(400).json({ message: 'email and scanId are required' })
  }

  const now = new Date().toISOString()

  // Update existing row or insert a new one
  const existing = db.prepare(`
    SELECT id FROM drip_emails WHERE scan_id = ? AND sequence_step = ?
  `).get(scanId, step)

  if (existing) {
    db.prepare(`
      UPDATE drip_emails SET status = 'sent', sent_at = ? WHERE id = ?
    `).run(now, existing.id)
  } else {
    db.prepare(`
      INSERT INTO drip_emails (id, email, scan_id, sequence_step, send_after, sent_at, status)
      VALUES (?, ?, ?, ?, ?, ?, 'sent')
    `).run(uuidv4(), email, scanId, step, now, now)
  }

  console.log(`[admin] Manual drip trigger: ${email} scan=${scanId} step=${step}`)
  res.json({ success: true, message: `Email step ${step} triggered for ${email}` })
})

module.exports = router
