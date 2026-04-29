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

// ── GET /api/admin/sales — sales CRM: registered users with plan + activity ───
router.get('/sales', requireAuth, requireAdmin, (req, res) => {
  try {
    // All registered users with their cluster counts + last activity
    const users = db.prepare(`
      SELECT
        u.id,
        u.email,
        u.full_name,
        u.firm_name,
        u.subscription_tier,
        u.subscribed_at,
        u.created_at,
        u.onboarding_completed,
        cp.employee_count,
        cp.industry_domain,
        cp.province,
        (SELECT COUNT(*) FROM clusters cl JOIN clients c ON cl.client_id = c.id
         WHERE c.tenant_id = u.id AND cl.status NOT IN ('Archived','Rejected')) AS cluster_count,
        (SELECT COUNT(*) FROM clusters cl JOIN clients c ON cl.client_id = c.id
         WHERE c.tenant_id = u.id AND cl.status = 'Approved') AS approved_count,
        (SELECT MAX(cl.updated_at) FROM clusters cl JOIN clients c ON cl.client_id = c.id
         WHERE c.tenant_id = u.id) AS last_cluster_activity,
        (SELECT estimated_credit FROM free_scans WHERE email = u.email
         ORDER BY created_at DESC LIMIT 1) AS scan_credit_estimate
      FROM users u
      LEFT JOIN company_profiles cp ON cp.user_id = u.id
      ORDER BY u.created_at DESC
      LIMIT 500
    `).all()

    // Estimate credit from company profile if no scan exists
    const RD_PCTS = { software: 0.40, ai_ml: 0.45, biotech: 0.50, cleantech: 0.40,
                      fintech: 0.35, medtech: 0.40, other: 0.20 }

    const rows = users.map(u => {
      const rdPct     = RD_PCTS[u.industry_domain] ?? 0.25
      const profEstimate = u.employee_count
        ? Math.round(u.employee_count * 105_000 * rdPct * 0.35)
        : null
      const creditEstimate = u.scan_credit_estimate ?? profEstimate

      // Score: high credit + free plan + clusters created = hot lead
      let score = 0
      if (creditEstimate > 100_000) score += 40
      else if (creditEstimate > 50_000) score += 25
      else if (creditEstimate > 25_000) score += 10
      if (u.cluster_count > 0) score += 20
      if (u.approved_count > 0) score += 15
      if (u.onboarding_completed) score += 10
      if (u.subscription_tier === 'free') score += 5   // upgrade opportunity

      return {
        ...u,
        credit_estimate: creditEstimate,
        lead_score: score,
        is_paid: u.subscription_tier !== 'free',
        days_since_signup: u.created_at
          ? Math.floor((Date.now() - new Date(u.created_at).getTime()) / 86400000)
          : null,
      }
    })

    // Sort hot leads first
    rows.sort((a, b) => {
      if (a.is_paid !== b.is_paid) return a.is_paid ? 1 : -1   // free first
      return b.lead_score - a.lead_score
    })

    res.json({ users: rows, total: rows.length })
  } catch (err) {
    console.error('[admin/sales] query error:', err.message)
    res.status(500).json({ message: 'Failed to fetch sales data' })
  }
})

// ── POST /api/admin/test-email ────────────────────────────────────────────────
// No auth — intentionally open so you can test SMTP from curl without logging in.
// Send a test alert email immediately to diagnose SMTP config in Railway.
// Usage: curl -X POST https://app2026-production.up.railway.app/api/v1/admin/test-email
router.post('/test-email', async (req, res) => {
  const nodemailer = require('nodemailer')
  const SMTP_HOST  = process.env.SMTP_HOST
  const SMTP_PORT  = parseInt(process.env.SMTP_PORT || '587', 10)
  const SMTP_USER  = process.env.SMTP_USER
  const SMTP_PASS  = process.env.SMTP_PASS
  const EMAIL_FROM = process.env.EMAIL_FROM || 'hello@taxlift.ai'
  const ALERT_TO   = process.env.SCAN_ALERT_TO || process.env.ALERT_TO || 'info@taxlift.ai'

  const config = {
    SMTP_HOST: SMTP_HOST || '(not set)',
    SMTP_PORT,
    SMTP_USER: SMTP_USER || '(not set)',
    SMTP_PASS: SMTP_PASS ? `${SMTP_PASS.slice(0, 6)}…` : '(not set)',
    EMAIL_FROM,
    ALERT_TO,
    secure: SMTP_PORT === 465,
  }

  console.log('[admin/test-email] Config:', JSON.stringify(config))

  if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS) {
    return res.status(500).json({
      ok: false,
      error: 'SMTP not configured',
      config,
      fix: 'Set SMTP_HOST, SMTP_USER, SMTP_PASS, SMTP_PORT=465 in Railway env vars',
    })
  }

  // Resolve hostname to IPv4 — Railway is IPv6-first, Hostinger SMTP is IPv4-only
  let smtpIp = SMTP_HOST
  try {
    const addrs = await require('dns').promises.resolve4(SMTP_HOST)
    if (addrs && addrs[0]) smtpIp = addrs[0]
  } catch { /* fall back to hostname */ }

  const transport = nodemailer.createTransport({
    host:   smtpIp,
    port:   SMTP_PORT,
    secure: SMTP_PORT === 465,
    auth:   { user: SMTP_USER, pass: SMTP_PASS },
    tls:    { servername: SMTP_HOST },
  })

  try {
    await transport.verify()
    console.log('[admin/test-email] SMTP verify OK')
  } catch (err) {
    console.error('[admin/test-email] SMTP verify FAILED:', err.message)
    return res.status(500).json({ ok: false, error: `SMTP verify failed: ${err.message}`, config })
  }

  try {
    await transport.sendMail({
      from:    EMAIL_FROM,
      to:      ALERT_TO,
      subject: '✅ TaxLift SMTP test — it works!',
      text:    `SMTP is working correctly.\n\nSent at: ${new Date().toISOString()}\nFrom: ${EMAIL_FROM}\nTo: ${ALERT_TO}`,
    })
    console.log(`[admin/test-email] Test email sent → ${ALERT_TO}`)
    res.json({ ok: true, message: `Test email sent to ${ALERT_TO}`, config })
  } catch (err) {
    console.error('[admin/test-email] sendMail FAILED:', err.message)
    res.status(500).json({ ok: false, error: `sendMail failed: ${err.message}`, config })
  }
})

module.exports = router
