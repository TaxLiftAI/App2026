/**
 * changelog.js — SR&ED Activity Log upload & retrieval
 *
 * POST /api/v1/changelog/upload
 *   Body: { filename, rows: [{date,type,area,title,description,role,hours,eligibility,uncertainty,impact}] }
 *   Parsed client-side via SheetJS; backend computes credit estimate and stores.
 *
 * GET  /api/v1/changelog          — list uploads for the logged-in user
 * GET  /api/v1/changelog/estimate — aggregate credit across all uploads
 */
const router = require('express').Router()
const db     = require('../db')
const { v4: uuid } = require('../utils/uuid')
const { requireAuth } = require('../middleware/auth')

router.use(requireAuth)

// ── Hourly rate assumptions (CAD, salary + 20% overhead ÷ 1800 hrs/yr) ───────
const RATE = {
  'Developer':          72,   // $90K
  'Senior Developer':   92,   // $115K
  'Architect':         116,   // $145K
  'ML Engineer':       116,
  'QA Engineer':        72,
  'Product':            72,
}
const DEFAULT_RATE    = 80
const FEDERAL_RATE    = 0.35   // CCPC ≤ $3M QE, refundable
const PROV_RATES      = { ON: 0.08, QC: 0.30, BC: 0.10, AB: 0.10 }
const DEFAULT_PROV    = 0.08

function eligWeight(e) {
  if (String(e).toLowerCase() === 'yes')     return 1.0
  if (String(e).toLowerCase() === 'partial') return 0.5
  return 0
}

// ── POST /api/v1/changelog/upload ─────────────────────────────────────────────
router.post('/upload', (req, res) => {
  const { filename = 'upload.xlsx', rows, province = 'ON' } = req.body ?? {}

  if (!Array.isArray(rows) || rows.length === 0) {
    return res.status(400).json({ message: 'No activity rows provided.' })
  }
  if (rows.length > 2000) {
    return res.status(400).json({ message: 'Maximum 2000 rows per upload.' })
  }

  const prov     = String(province).toUpperCase()
  const provRate = PROV_RATES[prov] ?? DEFAULT_PROV

  let totalHours    = 0
  let eligibleHours = 0
  let eligExpend    = 0
  const byType = {}
  const byElig = { Yes: 0, Partial: 0, No: 0 }

  const cleaned = rows.map(r => {
    const hours    = Math.max(0, parseFloat(r.hours) || 0)
    const eligW    = eligWeight(r.eligibility)
    const eligH    = hours * eligW
    const rate     = RATE[r.role] ?? DEFAULT_RATE

    totalHours    += hours
    eligibleHours += eligH
    eligExpend    += eligH * rate

    const e = eligW === 1 ? 'Yes' : eligW === 0.5 ? 'Partial' : 'No'
    byType[r.type || 'Other'] = (byType[r.type || 'Other'] || 0) + 1
    byElig[e] = (byElig[e] || 0) + 1

    return {
      date:        String(r.date        || '').slice(0, 20),
      type:        String(r.type        || 'Feature').slice(0, 50),
      area:        String(r.area        || '').slice(0, 100),
      title:       String(r.title       || '').slice(0, 200),
      description: String(r.description || '').slice(0, 1000),
      role:        String(r.role        || 'Developer').slice(0, 50),
      hours,
      eligibility: e,
      elig_hours:  eligH,
      uncertainty: String(r.uncertainty || '').slice(0, 500),
      impact:      String(r.impact      || 'Medium').slice(0, 20),
    }
  })

  const federalCredit    = Math.round(eligExpend * FEDERAL_RATE)
  const provincialCredit = Math.round(eligExpend * provRate)
  const totalCredit      = federalCredit + provincialCredit

  const uploadId = uuid()
  db.prepare(`
    INSERT INTO changelog_uploads
      (id, user_id, filename, total_rows, eligible_hours, elig_expenditure,
       federal_credit, provincial_credit, province, raw_json, created_at)
    VALUES (?,?,?,?,?,?,?,?,?,?,datetime('now'))
  `).run(
    uploadId, req.user.id, String(filename).slice(0, 200),
    cleaned.length, Math.round(eligibleHours), Math.round(eligExpend),
    federalCredit, provincialCredit, prov,
    JSON.stringify(cleaned.slice(0, 500))
  )

  res.json({
    upload_id:              uploadId,
    filename,
    total_rows:             cleaned.length,
    total_hours:            Math.round(totalHours),
    eligible_hours:         Math.round(eligibleHours),
    eligible_pct:           totalHours > 0 ? Math.round(eligibleHours / totalHours * 100) : 0,
    eligible_expenditure:   Math.round(eligExpend),
    federal_credit_cad:     federalCredit,
    provincial_credit_cad:  provincialCredit,
    total_credit_cad:       totalCredit,
    province:               prov,
    by_type:                byType,
    by_eligibility:         byElig,
    rate_assumptions: {
      Developer:          `$${RATE.Developer}/hr ($90K salary + 20% overhead ÷ 1,800 hrs/yr)`,
      'Senior Developer': `$${RATE['Senior Developer']}/hr ($115K salary + 20% overhead ÷ 1,800 hrs/yr)`,
      Architect:          `$${RATE.Architect}/hr ($145K salary + 20% overhead ÷ 1,800 hrs/yr)`,
      'ML Engineer':      `$${RATE['ML Engineer']}/hr ($145K salary + 20% overhead ÷ 1,800 hrs/yr)`,
    },
    methodology: {
      federal_rate:    `${FEDERAL_RATE * 100}% (CCPC refundable, QE ≤ $3M)`,
      provincial_rate: `${provRate * 100}% (${prov})`,
      partial_weight:  '50% of hours count for Partial-eligible activities',
    },
  })
})

// ── GET /api/v1/changelog ──────────────────────────────────────────────────────
router.get('/', (req, res) => {
  const rows = db.prepare(`
    SELECT id, filename, total_rows, eligible_hours, federal_credit,
           provincial_credit, province, created_at
    FROM changelog_uploads WHERE user_id = ?
    ORDER BY created_at DESC LIMIT 20
  `).all(req.user.id)
  res.json(rows)
})

// ── GET /api/v1/changelog/estimate ────────────────────────────────────────────
router.get('/estimate', (req, res) => {
  const row = db.prepare(`
    SELECT
      COALESCE(SUM(eligible_hours), 0)    AS eligible_hours,
      COALESCE(SUM(elig_expenditure), 0)  AS elig_expenditure,
      COALESCE(SUM(federal_credit), 0)    AS federal_credit,
      COALESCE(SUM(provincial_credit), 0) AS provincial_credit,
      COUNT(*)                            AS upload_count,
      MAX(created_at)                     AS last_upload
    FROM changelog_uploads WHERE user_id = ?
  `).get(req.user.id)
  res.json({
    ...row,
    total_credit_cad: (row?.federal_credit ?? 0) + (row?.provincial_credit ?? 0),
  })
})

module.exports = router
