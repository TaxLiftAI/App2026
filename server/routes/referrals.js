/**
 * Referral routes
 *   GET  /api/referrals          — list referrals for current user
 *   POST /api/referrals          — create referral record
 *   PUT  /api/referrals/:id      — update referral (status, commission)
 *   GET  /api/referrals/stats    — aggregate stats (total credit, commissions)
 */
const router = require('express').Router()
const { v4: uuid } = require('../utils/uuid')
const db     = require('../db')
const { requireAuth } = require('../middleware/auth')

router.use(requireAuth)

// ── GET /api/referrals/stats ──────────────────────────────────────────────────
// Must be before /:id so it doesn't match "stats" as an id
router.get('/stats', (req, res) => {
  const rows = db.prepare(
    'SELECT * FROM referrals WHERE referrer_user_id = ?'
  ).all(req.user.id)

  const totalReferred       = rows.length
  const totalPipelineCredit = rows.reduce((s, r) => s + r.estimated_credit_cad, 0)
  const totalCommissionEarned = rows
    .filter(r => r.commission_status !== 'pending')
    .reduce((s, r) => s + r.commission_cad, 0)
  const pendingPayout = rows
    .filter(r => r.commission_status === 'confirmed')
    .reduce((s, r) => s + r.commission_cad, 0)

  const byCommissionStatus = {
    pending:   rows.filter(r => r.commission_status === 'pending'),
    confirmed: rows.filter(r => r.commission_status === 'confirmed'),
    paid:      rows.filter(r => r.commission_status === 'paid'),
  }

  res.json({
    totalReferred,
    totalPipelineCredit,
    totalCommissionEarned,
    pendingPayout,
    pendingCount:   byCommissionStatus.pending.length,
    confirmedCount: byCommissionStatus.confirmed.length,
    paidCount:      byCommissionStatus.paid.length,
    pendingCredit:   byCommissionStatus.pending.reduce((s, r)   => s + r.estimated_credit_cad, 0),
    confirmedCredit: byCommissionStatus.confirmed.reduce((s, r) => s + r.estimated_credit_cad, 0),
    paidCredit:      byCommissionStatus.paid.reduce((s, r)      => s + r.estimated_credit_cad, 0),
  })
})

// ── GET /api/referrals ────────────────────────────────────────────────────────
router.get('/', (req, res) => {
  const { status, commission_status } = req.query
  let sql = 'SELECT * FROM referrals WHERE referrer_user_id = ?'
  const params = [req.user.id]

  if (status) {
    sql += ' AND referral_status = ?'
    params.push(status)
  }
  if (commission_status) {
    sql += ' AND commission_status = ?'
    params.push(commission_status)
  }

  sql += ' ORDER BY date_referred DESC'
  const referrals = db.prepare(sql).all(...params)

  // Re-shape boolean ints back to JS booleans
  const shaped = referrals.map(r => ({
    ...r,
    commission_confirmed: Boolean(r.commission_confirmed),
    commission_paid:      Boolean(r.commission_paid),
  }))

  res.json({ referrals: shaped, total: shaped.length })
})

// ── POST /api/referrals ───────────────────────────────────────────────────────
router.post('/', (req, res) => {
  const {
    company_name, industry = '', fiscal_year = '',
    primary_contact = '', ref_code,
  } = req.body ?? {}

  if (!company_name?.trim()) {
    return res.status(400).json({ message: 'company_name is required' })
  }

  const id      = uuid()
  const refCode = ref_code ?? `REF-${id.slice(0, 8).toUpperCase()}`

  db.prepare(`
    INSERT INTO referrals
      (id, referrer_user_id, ref_code, company_name, industry, fiscal_year, primary_contact)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(id, req.user.id, refCode, company_name.trim(), industry, fiscal_year, primary_contact)

  const referral = db.prepare('SELECT * FROM referrals WHERE id = ?').get(id)
  res.status(201).json({
    ...referral,
    commission_confirmed: Boolean(referral.commission_confirmed),
    commission_paid:      Boolean(referral.commission_paid),
  })
})

// ── GET /api/referrals/:id ────────────────────────────────────────────────────
router.get('/:id', (req, res) => {
  const referral = db.prepare(
    'SELECT * FROM referrals WHERE id = ? AND referrer_user_id = ?'
  ).get(req.params.id, req.user.id)

  if (!referral) return res.status(404).json({ message: 'Referral not found' })
  res.json({
    ...referral,
    commission_confirmed: Boolean(referral.commission_confirmed),
    commission_paid:      Boolean(referral.commission_paid),
  })
})

// ── PUT /api/referrals/:id ────────────────────────────────────────────────────
router.put('/:id', (req, res) => {
  const referral = db.prepare(
    'SELECT * FROM referrals WHERE id = ? AND referrer_user_id = ?'
  ).get(req.params.id, req.user.id)

  if (!referral) return res.status(404).json({ message: 'Referral not found' })

  const allowed = [
    'company_name', 'industry', 'fiscal_year', 'primary_contact',
    'referral_status', 'commission_status', 'estimated_credit_cad',
    'commission_cad', 'commission_confirmed', 'commission_paid', 'paid_at', 'notes',
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
  db.prepare(`UPDATE referrals SET ${setClauses} WHERE id = ? AND referrer_user_id = ?`).run(...values)

  const updated = db.prepare('SELECT * FROM referrals WHERE id = ?').get(req.params.id)
  res.json({
    ...updated,
    commission_confirmed: Boolean(updated.commission_confirmed),
    commission_paid:      Boolean(updated.commission_paid),
  })
})

module.exports = router
