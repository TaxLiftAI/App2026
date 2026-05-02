/**
 * scan.js — Free Scan API
 *
 * POST /api/scan/free
 *   No auth required. Accepts pre-computed scan results from the browser
 *   (client-side scanning via sredScanner.js using the stored GitHub OAuth token),
 *   persists them to the free_scans table, and optionally captures a lead.
 *
 * GET /api/scan/free/:id
 *   Retrieve a previously saved free scan by ID.
 */
const express = require('express')
const router  = express.Router()
const db      = require('../db')
const { v4: makeId } = require('../utils/uuid')
const { scheduleDrip } = require('../lib/emailDrip')
const { alertHighValueScan, alertNewScan } = require('../lib/alertEmail')
const { requireAuth }       = require('../middleware/auth')
const { scanLimiter }       = require('../middleware/rateLimiter')

/**
 * POST /api/scan/free
 *
 * Body: {
 *   email           string   (optional — captured on landing page)
 *   repos           string[] (array of "owner/repo" strings)
 *   clusters        object[] (SR&ED cluster objects from sredScanner.scanCommits)
 *   estimated_credit number  (total CAD estimate)
 *   commit_count    number
 *   hours_total     number
 *   user_id         string   (optional — if user happens to be logged in)
 * }
 */
const { isValidEmail } = require('../utils/validators')

router.post('/free', scanLimiter, (req, res) => {
  try {
    const {
      email            = '',
      repos            = [],
      clusters         = [],
      estimated_credit = 0,
      commit_count     = 0,
      hours_total      = 0,
      team_size        = null,
      user_id          = null,
    } = req.body

    console.log(`[scan/free] hit — email=${email || 'none'} repos=${repos.length} credit=${estimated_credit} clusters=${clusters.length} teamSize=${team_size} hours=${hours_total}`)

    // Validate email format before any drip scheduling
    if (email && !isValidEmail(email)) {
      return res.status(400).json({ message: 'Invalid email address' })
    }

    const id = makeId()

    db.prepare(`
      INSERT INTO free_scans
        (id, email, repos_json, clusters_json, estimated_credit,
         commit_count, cluster_count, hours_total, user_id)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      email,
      JSON.stringify(repos),
      JSON.stringify(clusters),
      estimated_credit,
      commit_count,
      clusters.length,
      hours_total,
      user_id,
    )

    // Also capture as a lead if email is provided
    if (email) {
      try {
        db.prepare(`
          INSERT OR IGNORE INTO leads (id, email, source)
          VALUES (?, ?, 'free_scan')
        `).run(makeId(), email)
      } catch { /* lead already exists — silent */ }

      // Schedule post-scan email drip sequence
      try {
        scheduleDrip(email, {
          scan_id:          id,
          estimated_credit,
          clusters,
          repos,
          commit_count,
        })
      } catch (err) {
        console.error('[scan/free] scheduleDrip error:', err.message)
      }

      // High-value scan alert to founder (fire-and-forget, $50K+ threshold)
      alertHighValueScan({
        email,
        estimatedCredit: estimated_credit,
        clusterCount:    clusters?.length ?? 0,
        repoCount:       repos.length,
      }).catch(err => console.error('[scan/free] alert error:', err.message))
    }

    // Notify info@taxlift.ai on every scan — fire-and-forget
    alertNewScan({
      email,
      estimatedCredit: estimated_credit,
      clusterCount:    clusters.length,
      repoCount:       repos.length,
      repos,
    }).catch(err => console.error('[scan/free] alertNewScan error:', err.message))

    res.json({ ok: true, id, estimated_credit, cluster_count: clusters.length })
  } catch (err) {
    console.error('[scan/free] error:', err.message)
    res.status(500).json({ message: 'Failed to save scan results', ...(process.env.NODE_ENV !== 'production' && { detail: err.message }) })
  }
})

/**
 * GET /api/scan/free/:id
 * Retrieve a scan by ID (used for auto-associating scan with new user account).
 * Returns only non-sensitive fields to callers whose email matches the scan,
 * or who are authenticated admins.
 */
router.get('/free/:id', (req, res) => {
  try {
    const row = db.prepare('SELECT id, email, estimated_credit, commit_count, cluster_count, hours_total, created_at, repos_json, clusters_json, user_id FROM free_scans WHERE id = ?').get(req.params.id)
    if (!row) return res.status(404).json({ message: 'Scan not found' })

    // Allow: authenticated admin, or token-authenticated owner, or email param matches
    const callerEmail = req.user?.email ?? req.query.email ?? ''
    const isAdmin     = req.user?.role === 'admin'
    const isOwner     = row.email && callerEmail.toLowerCase() === row.email.toLowerCase()

    const payload = {
      id:              row.id,
      estimated_credit: row.estimated_credit,
      commit_count:    row.commit_count,
      cluster_count:   row.cluster_count,
      hours_total:     row.hours_total,
      created_at:      row.created_at,
      repos:           JSON.parse(row.repos_json    ?? '[]'),
      clusters:        JSON.parse(row.clusters_json ?? '[]'),
    }
    // Only expose email and user_id to owners or admins
    if (isAdmin || isOwner) {
      payload.email   = row.email
      payload.user_id = row.user_id
    }

    res.json(payload)
  } catch (err) {
    console.error('[scan/free/:id] error:', err.message)
    res.status(500).json({ message: 'Failed to retrieve scan' })
  }
})

/**
 * PATCH /api/scan/free/:id/associate
 * Associate a free scan with a newly-registered user.
 * Called after the user signs up, passing their new user_id.
 */
router.patch('/free/:id/associate', requireAuth, (req, res) => {
  try {
    const user_id = req.user.id
    db.prepare('UPDATE free_scans SET user_id = ? WHERE id = ?').run(user_id, req.params.id)
    res.json({ ok: true })
  } catch (err) {
    console.error('[scan/free/:id/associate] error:', err.message)
    res.status(500).json({ message: 'Failed to associate scan' })
  }
})

/**
 * GET /api/scan/drip/status/:email
 * Admin endpoint — returns the drip email queue for a given email address.
 */
router.get('/drip/status/:email', requireAuth, (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ message: 'Forbidden' })
  try {
    const rows = db.prepare(`
      SELECT id, email, scan_id, sequence_step, send_after, sent_at, status, created_at
      FROM drip_emails
      WHERE email = ?
      ORDER BY sequence_step ASC
    `).all(req.params.email)
    res.json({ email: req.params.email, steps: rows })
  } catch (err) {
    console.error('[scan/drip/status] error:', err.message)
    res.status(500).json({ message: 'Failed to retrieve drip status' })
  }
})

module.exports = router
