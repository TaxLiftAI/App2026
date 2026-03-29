/**
 * emailDrip.js — Post-scan email drip sequence for TaxLift
 *
 * scheduleDrip(email, scanData) queues 3 emails:
 *   Step 1 — immediate:  scan results summary
 *   Step 2 — 48 hours:   SR&ED education + deadline urgency
 *   Step 3 — 96 hours:   personal-feeling nudge with objection handling
 *
 * A setInterval loop runs every 15 minutes and sends any pending emails
 * whose send_after timestamp has passed.
 *
 * SMTP config (all optional — falls back to log-only mode if absent):
 *   SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS
 *   EMAIL_FROM defaults to hello@taxlift.ai
 */

const nodemailer = require('nodemailer')
const db         = require('../db')
const { makeId } = require('../utils/uuid')

const EMAIL_FROM   = process.env.EMAIL_FROM   || 'hello@taxlift.ai'
const SMTP_HOST    = process.env.SMTP_HOST
const SMTP_PORT    = parseInt(process.env.SMTP_PORT || '587', 10)
const SMTP_USER    = process.env.SMTP_USER
const SMTP_PASS    = process.env.SMTP_PASS
const FRONTEND_URL = (process.env.FRONTEND_URL || 'https://taxlift.ai').replace(/\/$/, '')

// ── Transporter ────────────────────────────────────────────────────────────────
let _transporter = null

function getTransporter() {
  if (_transporter) return _transporter
  if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS) return null

  _transporter = nodemailer.createTransport({
    host:   SMTP_HOST,
    port:   SMTP_PORT,
    secure: SMTP_PORT === 465,
    auth: { user: SMTP_USER, pass: SMTP_PASS },
  })
  return _transporter
}

// ── Shared HTML layout ─────────────────────────────────────────────────────────
function layout(body) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>TaxLift</title>
</head>
<body style="margin:0;padding:0;background:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;padding:40px 0;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 1px 4px rgba(0,0,0,0.08);">
          <!-- Header -->
          <tr>
            <td style="background:#6366f1;padding:28px 40px;">
              <span style="font-size:22px;font-weight:700;color:#ffffff;letter-spacing:-0.3px;">TaxLift</span>
              <span style="font-size:13px;color:rgba(255,255,255,0.7);margin-left:10px;">SR&amp;ED Intelligence</span>
            </td>
          </tr>
          <!-- Body -->
          <tr>
            <td style="padding:40px;">
              ${body}
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="padding:24px 40px;border-top:1px solid #f1f5f9;">
              <p style="margin:0;font-size:12px;color:#94a3b8;line-height:1.6;">
                You're receiving this because you ran a free SR&amp;ED scan at TaxLift.<br>
                Questions? Reply to this email — we read every one.<br>
                <a href="${FRONTEND_URL}/unsubscribe" style="color:#6366f1;text-decoration:none;">Unsubscribe</a>
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`
}

function ctaButton(text, url) {
  return `<a href="${url}" style="display:inline-block;margin-top:24px;padding:14px 28px;background:#6366f1;color:#ffffff;font-size:15px;font-weight:600;text-decoration:none;border-radius:8px;">${text}</a>`
}

// ── Email builders ─────────────────────────────────────────────────────────────

function buildEmail1(scanData) {
  const {
    email,
    estimated_credit = 0,
    clusters         = [],
    commit_count     = 0,
    repos            = [],
    scan_id,
  } = scanData

  const low  = Math.round(estimated_credit * 0.8).toLocaleString('en-CA')
  const high = Math.round(estimated_credit * 1.2).toLocaleString('en-CA')
  const top3 = clusters.slice(0, 3)
  const repoCount = repos.length
  const reportUrl = `${FRONTEND_URL}/scan/results?id=${scan_id}`

  const clusterRows = top3.length > 0
    ? top3.map(c => `
        <tr>
          <td style="padding:10px 0;border-bottom:1px solid #f1f5f9;">
            <span style="font-size:14px;font-weight:600;color:#1e293b;">${escHtml(c.name || c.theme || 'SR&ED Cluster')}</span>
            ${c.theme ? `<span style="display:block;font-size:12px;color:#64748b;margin-top:2px;">${escHtml(c.theme)}</span>` : ''}
          </td>
          <td style="padding:10px 0;border-bottom:1px solid #f1f5f9;text-align:right;">
            <span style="font-size:14px;font-weight:600;color:#6366f1;">~$${Math.round((c.credit_cad || c.estimatedCredit || 0)).toLocaleString('en-CA')}</span>
          </td>
        </tr>`).join('')
    : `<tr><td colspan="2" style="padding:10px 0;font-size:14px;color:#64748b;">Qualifying SR&ED work detected across your repositories.</td></tr>`

  const body = `
    <h1 style="margin:0 0 8px;font-size:24px;font-weight:700;color:#1e293b;">Your SR&amp;ED scan results are ready</h1>
    <p style="margin:0 0 28px;font-size:15px;color:#475569;">Here's what TaxLift found in your codebase.</p>

    <!-- Credit estimate -->
    <div style="background:#f5f3ff;border:1px solid #e0e7ff;border-radius:10px;padding:24px;margin-bottom:28px;">
      <p style="margin:0 0 4px;font-size:13px;font-weight:600;color:#6366f1;text-transform:uppercase;letter-spacing:0.5px;">Estimated SR&amp;ED Credit</p>
      <p style="margin:0;font-size:36px;font-weight:800;color:#1e293b;">$${low} – $${high} <span style="font-size:18px;color:#64748b;font-weight:500;">CAD</span></p>
      <p style="margin:8px 0 0;font-size:13px;color:#64748b;">Refundable federal + provincial estimate for a CCPC</p>
    </div>

    <!-- Top clusters -->
    <h2 style="margin:0 0 16px;font-size:16px;font-weight:700;color:#1e293b;">Top qualifying clusters</h2>
    <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:28px;">
      ${clusterRows}
    </table>

    ${ctaButton('See your full report →', reportUrl)}

    <p style="margin:28px 0 0;font-size:13px;color:#94a3b8;">
      This estimate is based on ${commit_count.toLocaleString()} qualifying commits across ${repoCount} repo${repoCount !== 1 ? 's' : ''}.
      Final credit amounts depend on CRA review and your specific expenditure mix.
    </p>`

  return {
    subject: 'Your TaxLift SR&ED scan results are ready',
    html:    layout(body),
  }
}

function buildEmail2() {
  const body = `
    <h1 style="margin:0 0 8px;font-size:24px;font-weight:700;color:#1e293b;">Most Canadian founders leave SR&amp;ED money on the table</h1>
    <p style="margin:0 0 24px;font-size:15px;color:#475569;">Here's why — and how to make sure you don't.</p>

    <p style="margin:0 0 16px;font-size:15px;color:#334155;line-height:1.7;">
      The average CCPC that files SR&amp;ED claims receives <strong style="color:#1e293b;">~$175,000</strong> in refundable tax credits.
      Yet the majority of qualifying Canadian software companies never file — usually because they don't realize their day-to-day engineering work counts.
    </p>

    <!-- Stat callout -->
    <div style="background:#f0fdf4;border-left:4px solid #22c55e;padding:16px 20px;border-radius:0 8px 8px 0;margin:24px 0;">
      <p style="margin:0;font-size:14px;color:#15803d;line-height:1.6;">
        <strong>Good news:</strong> You've already done the hard part. TaxLift identified qualifying SR&amp;ED activity in your repo.
        The remaining step is packaging it into a CPA-ready claim.
      </p>
    </div>

    <h2 style="margin:24px 0 12px;font-size:16px;font-weight:700;color:#1e293b;">The deadline you can't miss</h2>
    <p style="margin:0 0 16px;font-size:15px;color:#334155;line-height:1.7;">
      CRA requires SR&amp;ED claims to be filed within <strong>18 months of your fiscal year-end</strong>.
      Miss it and the credits are gone permanently — no extensions, no exceptions.
    </p>
    <p style="margin:0 0 24px;font-size:15px;color:#334155;line-height:1.7;">
      TaxLift generates a complete, CPA-ready package: technical narratives, T661 support documentation,
      and an expenditure schedule — so your accountant can file without the back-and-forth.
    </p>

    ${ctaButton('Get your CPA-ready package →', `${FRONTEND_URL}/pricing`)}

    <p style="margin:28px 0 0;font-size:13px;color:#94a3b8;">
      Questions? Just reply — our team responds within one business day.
    </p>`

  return {
    subject: 'Most Canadian founders leave SR&ED money on the table — here\'s why',
    html:    layout(body),
  }
}

function buildEmail3(scanData) {
  const {
    repos    = [],
    clusters = [],
  } = scanData

  const repoName = repos[0]
    ? String(repos[0]).split('/').pop()
    : 'your repo'

  const topCluster = clusters[0]
  const theme = topCluster
    ? (topCluster.theme || topCluster.name || 'software systems')
    : 'software systems'

  // Map internal theme keys to readable labels
  const themeLabels = {
    MachineLearning:        'machine learning',
    PerformanceOptimization:'performance optimization',
    SystemsEngineering:     'systems engineering',
    CloudInfrastructure:    'cloud infrastructure',
    Security:               'security research',
    Algorithms:             'algorithm design',
    Compilers:              'compiler / language tooling',
    DataEngineering:        'data engineering',
  }
  const themeLabel = themeLabels[theme] || theme.toLowerCase()

  const body = `
    <h1 style="margin:0 0 8px;font-size:24px;font-weight:700;color:#1e293b;">Quick question about your <em>${escHtml(repoName)}</em> scan</h1>
    <p style="margin:0 0 24px;font-size:15px;color:#475569;">We noticed something worth flagging.</p>

    <p style="margin:0 0 16px;font-size:15px;color:#334155;line-height:1.7;">
      We scanned <strong>${escHtml(repoName)}</strong> and found qualifying ${escHtml(themeLabel)} work.
      Did you know <strong>${escHtml(themeLabel)}</strong> is one of the most consistently approved SR&amp;ED categories by CRA?
      It has a strong track record because the technical uncertainty is clear and the experiments are well-documented in commit history.
    </p>

    <!-- Objection handling -->
    <div style="background:#fafafa;border:1px solid #e2e8f0;border-radius:10px;padding:24px;margin:24px 0;">
      <h2 style="margin:0 0 16px;font-size:15px;font-weight:700;color:#1e293b;">What founders usually ask us</h2>
      <div style="margin-bottom:14px;">
        <p style="margin:0 0 4px;font-size:14px;font-weight:600;color:#1e293b;">"How much of my time does this take?"</p>
        <p style="margin:0;font-size:14px;color:#475569;line-height:1.6;">About 2 hours — one call to review the clusters we found, then your CPA does the rest. TaxLift handles all the technical documentation.</p>
      </div>
      <div style="margin-bottom:14px;">
        <p style="margin:0 0 4px;font-size:14px;font-weight:600;color:#1e293b;">"What if CRA audits us?"</p>
        <p style="margin:0;font-size:14px;color:#475569;line-height:1.6;">Every claim we generate is backed by commit-level evidence. Your package includes a full audit trail — the same thing CPAs charge thousands to produce manually.</p>
      </div>
      <div>
        <p style="margin:0 0 4px;font-size:14px;font-weight:600;color:#1e293b;">"Is it worth it for a small team?"</p>
        <p style="margin:0;font-size:14px;color:#475569;line-height:1.6;">Yes. Most of our customers are 3–20 person teams. Smaller teams often have a higher percentage of qualifying work, not less.</p>
      </div>
    </div>

    ${ctaButton('Start for $299/mo — cancel anytime →', `${FRONTEND_URL}/pricing`)}

    <p style="margin:28px 0 0;font-size:13px;color:#94a3b8;">
      Not ready yet? Your scan results are saved. Come back any time at <a href="${FRONTEND_URL}/scan" style="color:#6366f1;text-decoration:none;">taxlift.ai/scan</a>.
    </p>`

  return {
    subject: `Quick question about your ${repoName} scan`,
    html:    layout(body),
  }
}

// ── Schedule helper ────────────────────────────────────────────────────────────

function hoursFromNow(h) {
  return new Date(Date.now() + h * 60 * 60 * 1000).toISOString()
}

function escHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

/**
 * scheduleDrip(email, scanData)
 *
 * Inserts 3 rows into drip_emails for the given email + scan.
 * scanData should include: { scan_id, estimated_credit, clusters, repos, commit_count }
 */
function scheduleDrip(email, scanData) {
  if (!email) return

  const steps = [
    { step: 1, sendAfter: hoursFromNow(0) },
    { step: 2, sendAfter: hoursFromNow(48) },
    { step: 3, sendAfter: hoursFromNow(96) },
  ]

  const insert = db.prepare(`
    INSERT INTO drip_emails (id, email, scan_id, sequence_step, send_after, status)
    VALUES (?, ?, ?, ?, ?, 'pending')
  `)

  for (const { step, sendAfter } of steps) {
    try {
      insert.run(makeId(), email, scanData.scan_id || '', step, sendAfter)
    } catch (err) {
      console.error(`[emailDrip] Failed to schedule step ${step} for ${email}:`, err.message)
    }
  }

  console.log(`[emailDrip] Scheduled 3-email drip for ${email} (scan ${scanData.scan_id})`)
}

// ── Sender ─────────────────────────────────────────────────────────────────────

async function sendDripEmail(row) {
  // Fetch original scan data to personalise emails
  let scanData = { scan_id: row.scan_id, repos: [], clusters: [], estimated_credit: 0, commit_count: 0 }
  try {
    const scan = db.prepare('SELECT * FROM free_scans WHERE id = ?').get(row.scan_id)
    if (scan) {
      scanData = {
        scan_id:          scan.id,
        email:            scan.email,
        repos:            JSON.parse(scan.repos_json    || '[]'),
        clusters:         JSON.parse(scan.clusters_json || '[]'),
        estimated_credit: scan.estimated_credit,
        commit_count:     scan.commit_count,
      }
    }
  } catch { /* use defaults */ }

  let mail
  if      (row.sequence_step === 1) mail = buildEmail1({ ...scanData, email: row.email })
  else if (row.sequence_step === 2) mail = buildEmail2()
  else                               mail = buildEmail3(scanData)

  const transport = getTransporter()

  if (!transport) {
    // No SMTP config — log only
    console.log(`[emailDrip] [LOG-ONLY] Would send step ${row.sequence_step} to ${row.email}: "${mail.subject}"`)
    db.prepare(`UPDATE drip_emails SET status = 'skipped', sent_at = ? WHERE id = ?`)
      .run(new Date().toISOString(), row.id)
    return
  }

  await transport.sendMail({
    from:    `TaxLift <${EMAIL_FROM}>`,
    to:      row.email,
    subject: mail.subject,
    html:    mail.html,
  })

  db.prepare(`UPDATE drip_emails SET status = 'sent', sent_at = ? WHERE id = ?`)
    .run(new Date().toISOString(), row.id)

  console.log(`[emailDrip] Sent step ${row.sequence_step} to ${row.email}`)
}

// ── Scheduler loop ─────────────────────────────────────────────────────────────
const POLL_INTERVAL_MS = 15 * 60 * 1000  // 15 minutes

async function processPendingEmails() {
  let pending
  try {
    pending = db.prepare(`
      SELECT * FROM drip_emails
      WHERE status = 'pending' AND send_after <= ?
      ORDER BY send_after ASC
    `).all(new Date().toISOString())
  } catch (err) {
    console.error('[emailDrip] Failed to query pending emails:', err.message)
    return
  }

  if (pending.length === 0) return

  console.log(`[emailDrip] Processing ${pending.length} pending email(s)…`)

  for (const row of pending) {
    try {
      // Mark in-flight to prevent duplicate sends
      db.prepare(`UPDATE drip_emails SET status = 'sending' WHERE id = ? AND status = 'pending'`).run(row.id)
      await sendDripEmail(row)
    } catch (err) {
      console.error(`[emailDrip] Failed to send step ${row.sequence_step} to ${row.email}:`, err.message)
      db.prepare(`UPDATE drip_emails SET status = 'failed' WHERE id = ?`).run(row.id)
    }
  }
}

function startDripScheduler() {
  // Run once immediately on startup (catches any emails queued before restart)
  processPendingEmails().catch(err => console.error('[emailDrip] startup flush error:', err.message))

  setInterval(() => {
    processPendingEmails().catch(err => console.error('[emailDrip] poll error:', err.message))
  }, POLL_INTERVAL_MS)

  if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS) {
    console.warn('[emailDrip] ⚠️  SMTP not configured (SMTP_HOST/SMTP_USER/SMTP_PASS missing) — emails will be logged but NOT delivered. Set these in Railway Variables.')
  }
  console.log(`[emailDrip] Scheduler started — polling every ${POLL_INTERVAL_MS / 60000} minutes`)
}

module.exports = { scheduleDrip, startDripScheduler }
