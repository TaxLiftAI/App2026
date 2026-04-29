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
const { v4: makeId } = require('../utils/uuid')

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

function buildEmail2(scanData = {}) {
  const { estimated_credit = 0, repos = [] } = scanData
  const low  = estimated_credit ? `$${Math.round(estimated_credit * 0.8).toLocaleString('en-CA')}` : null
  const high = estimated_credit ? `$${Math.round(estimated_credit * 1.2).toLocaleString('en-CA')}` : null
  const creditCallout = low
    ? `<p style="margin:0 0 16px;font-size:15px;color:#334155;line-height:1.7;">
        Your scan found between <strong style="color:#4f46e5;">${low} – ${high} CAD</strong> in potential SR&amp;ED credits.
        That's real refundable money — but only if the claim gets filed within 18 months of your fiscal year-end.
       </p>`
    : `<p style="margin:0 0 16px;font-size:15px;color:#334155;line-height:1.7;">
        The average CCPC that files SR&amp;ED claims receives <strong style="color:#1e293b;">~$175,000</strong> in refundable tax credits.
        Yet most qualifying Canadian software companies never file — usually because they don't realize their day-to-day engineering work counts.
       </p>`

  const body = `
    <h1 style="margin:0 0 8px;font-size:24px;font-weight:700;color:#1e293b;">Your SR&amp;ED credits expire if you don't act</h1>
    <p style="margin:0 0 24px;font-size:15px;color:#475569;">Here's what you need to know before your filing window closes.</p>

    ${creditCallout}

    <!-- Stat callout -->
    <div style="background:#f0fdf4;border-left:4px solid #22c55e;padding:16px 20px;border-radius:0 8px 8px 0;margin:24px 0;">
      <p style="margin:0;font-size:14px;color:#15803d;line-height:1.6;">
        <strong>Good news:</strong> You've already done the hard part. TaxLift identified qualifying SR&amp;ED activity in your repo.
        The remaining step is packaging it into a CPA-ready claim — TaxLift does that automatically.
      </p>
    </div>

    <h2 style="margin:24px 0 12px;font-size:16px;font-weight:700;color:#1e293b;">The 18-month deadline you can't miss</h2>
    <p style="margin:0 0 16px;font-size:15px;color:#334155;line-height:1.7;">
      CRA requires SR&amp;ED claims to be filed within <strong>18 months of your fiscal year-end</strong>.
      Miss it and the credits are gone permanently — no extensions, no exceptions.
    </p>

    <!-- What TaxLift generates -->
    <table width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 24px;">
      ${[
        ['T661 technical narratives', 'AI-generated, CRA-compliant, ready for your CPA to review'],
        ['Financial schedule',        'Qualified expenditures mapped from your payroll and contractor costs'],
        ['Audit evidence chain',      'Every qualifying commit timestamped and linked to CRA activity categories'],
        ['CPA handoff package',       'One click exports everything — your accountant files, you collect the refund'],
      ].map(([title, desc]) => `
        <tr>
          <td style="padding:10px 0;border-bottom:1px solid #f1f5f9;vertical-align:top;">
            <p style="margin:0 0 2px;font-size:14px;font-weight:600;color:#1e293b;">✓ &nbsp;${title}</p>
            <p style="margin:0;font-size:13px;color:#64748b;padding-left:18px;">${desc}</p>
          </td>
        </tr>`).join('')}
    </table>

    ${ctaButton('Get your CPA-ready package →', `${FRONTEND_URL}/pricing`)}

    <p style="margin:28px 0 0;font-size:13px;color:#94a3b8;">
      Questions? Just reply — our team responds within one business day.
    </p>`

  return {
    subject: `Your SR&ED estimate expires in 18 months — here's what to do`,
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
  else if (row.sequence_step === 2) mail = buildEmail2(scanData)
  else                               mail = buildEmail3(scanData)

  const transport = getTransporter()

  if (!transport) {
    // No SMTP config — log only
    console.log(`[emailDrip] [LOG-ONLY] Would send step ${row.sequence_step} to ${row.email}: "${mail.subject}"`)
    db.prepare(`UPDATE drip_emails SET status = 'skipped', sent_at = ? WHERE id = ?`)
      .run(new Date().toISOString(), row.id)
    return
  }

  const unsubUrl = `${FRONTEND_URL}/unsubscribe?email=${encodeURIComponent(row.email)}&type=scan`
  await transport.sendMail({
    from:    `TaxLift <${EMAIL_FROM}>`,
    to:      row.email,
    subject: mail.subject,
    html:    mail.html,
    headers: {
      'List-Unsubscribe':      `<${unsubUrl}>, <mailto:${EMAIL_FROM}?subject=unsubscribe>`,
      'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
    },
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
  processUserDripEmails().catch(err => console.error('[userDrip] startup flush error:', err.message))

  setInterval(() => {
    processPendingEmails().catch(err => console.error('[emailDrip] poll error:', err.message))
    processUserDripEmails().catch(err => console.error('[userDrip] poll error:', err.message))
  }, POLL_INTERVAL_MS)

  if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS) {
    console.warn('[emailDrip] ⚠️  SMTP not configured (SMTP_HOST/SMTP_USER/SMTP_PASS missing) — emails will be logged but NOT delivered. Set these in Railway Variables.')
  }
  console.log(`[emailDrip] Scheduler started — polling every ${POLL_INTERVAL_MS / 60000} minutes`)
}

// ══════════════════════════════════════════════════════════════════════════════
// USER DRIP — 3-email sequence for registered users (not scan leads)
// ══════════════════════════════════════════════════════════════════════════════

function buildUserEmail1({ name, email, estimatedCredit, firmName }) {
  const firstName   = (name || email).split(/[\s@]/)[0]
  const creditStr   = estimatedCredit
    ? `$${Math.round(estimatedCredit / 1000)}K–$${Math.round(estimatedCredit * 1.35 / 1000)}K`
    : 'significant SR&ED credits'
  const dashUrl     = `${FRONTEND_URL}/dashboard`
  const connectUrl  = `${FRONTEND_URL}/quick-connect`

  return {
    subject: `Welcome to TaxLift, ${firstName} — your SR&ED estimate is ready`,
    html: layout(`
      <h2 style="margin:0 0 8px;font-size:22px;font-weight:700;color:#0f172a;">
        Welcome, ${firstName}. 👋
      </h2>
      <p style="margin:0 0 20px;font-size:15px;color:#334155;line-height:1.7;">
        Your TaxLift account is live. Based on your company profile, you may qualify for
        <strong style="color:#4f46e5;">${creditStr}</strong> in annual SR&ED credits —
        and potentially <strong>$700K+</strong> in additional Canadian grants.
      </p>

      <table width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;border-radius:10px;margin:0 0 24px;">
        <tr><td style="padding:18px 20px;">
          <p style="margin:0 0 10px;font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;color:#64748b;">Your next steps</p>
          ${[
            ['1', 'Connect GitHub or Jira', 'TaxLift scans your commits and auto-detects SR&ED clusters.', connectUrl, 'Connect integration →'],
            ['2', 'Review your first clusters', 'Approve, edit, or reject — takes about 10 minutes.', dashUrl, 'Go to dashboard →'],
            ['3', 'Share with your CPA', 'One click generates a T661 package your accountant can file.', dashUrl, 'See how it works →'],
          ].map(([n, title, body, url, cta]) => `
            <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:14px;">
              <tr>
                <td style="width:28px;vertical-align:top;padding-top:2px;">
                  <span style="display:inline-flex;width:22px;height:22px;background:#4f46e5;border-radius:50%;color:#fff;font-size:11px;font-weight:700;align-items:center;justify-content:center;">${n}</span>
                </td>
                <td style="padding-left:10px;">
                  <p style="margin:0;font-size:14px;font-weight:600;color:#1e293b;">${title}</p>
                  <p style="margin:2px 0 4px;font-size:13px;color:#64748b;">${body}</p>
                  <a href="${url}" style="font-size:13px;color:#4f46e5;text-decoration:none;font-weight:600;">${cta}</a>
                </td>
              </tr>
            </table>
          `).join('')}
        </td></tr>
      </table>

      <a href="${connectUrl}"
         style="display:inline-block;padding:14px 32px;background:#4f46e5;color:#fff;font-size:15px;font-weight:700;text-decoration:none;border-radius:10px;">
        Connect your first integration →
      </a>

      <p style="margin:24px 0 0;font-size:13px;color:#94a3b8;">
        Questions? Reply to this email — I read every one.<br>
        — Prateek, TaxLift
      </p>
    `),
  }
}

function buildUserEmail2({ name, email }) {
  const firstName = (name || email).split(/[\s@]/)[0]
  const clustersUrl = `${FRONTEND_URL}/clusters`
  const connectUrl  = `${FRONTEND_URL}/quick-connect`

  return {
    subject: `${firstName}, your SR&ED clusters are waiting for review`,
    html: layout(`
      <h2 style="margin:0 0 8px;font-size:22px;font-weight:700;color:#0f172a;">
        One review session = one T661 ready to file
      </h2>
      <p style="margin:0 0 20px;font-size:15px;color:#334155;line-height:1.7;">
        Hey ${firstName} — most TaxLift customers complete their first cluster review in under
        <strong>15 minutes</strong>. The AI does the narrative work; you just confirm each cluster is correct.
      </p>

      <table width="100%" cellpadding="0" cellspacing="0" style="background:#eff6ff;border:1px solid #bfdbfe;border-radius:10px;margin:0 0 24px;">
        <tr><td style="padding:18px 20px;">
          <p style="margin:0 0 6px;font-size:13px;font-weight:700;color:#1e40af;">What happens when you review a cluster:</p>
          ${[
            'TaxLift shows you the commits and hours it grouped together',
            'You confirm the technical theme and approve or adjust the narrative',
            'The T661 section auto-generates — ready for your CPA to review',
            'The evidence chain is locked with SHA-256 hashes for CRA audit defence',
          ].map(s => `
            <p style="margin:5px 0;font-size:13px;color:#1e3a8a;">✓ &nbsp;${s}</p>
          `).join('')}
        </td></tr>
      </table>

      <a href="${clustersUrl}"
         style="display:inline-block;padding:14px 32px;background:#4f46e5;color:#fff;font-size:15px;font-weight:700;text-decoration:none;border-radius:10px;">
        Review my clusters →
      </a>

      <p style="margin:16px 0 0;font-size:13px;color:#64748b;">
        Haven't connected GitHub or Jira yet?
        <a href="${connectUrl}" style="color:#4f46e5;font-weight:600;">Connect now — takes 2 minutes.</a>
      </p>

      <p style="margin:24px 0 0;font-size:13px;color:#94a3b8;">— Prateek, TaxLift</p>
    `),
  }
}

function buildUserEmail3({ name, email, estimatedCredit }) {
  const firstName  = (name || email).split(/[\s@]/)[0]
  const creditStr  = estimatedCredit
    ? `$${Math.round(estimatedCredit / 1000)}K`
    : 'your estimated credit'
  const settingsUrl = `${FRONTEND_URL}/settings`
  const grantsUrl   = `${FRONTEND_URL}/grants`

  return {
    subject: `${firstName} — are you leaving $700K+ in grants on the table?`,
    html: layout(`
      <h2 style="margin:0 0 8px;font-size:22px;font-weight:700;color:#0f172a;">
        SR&ED is just the start.
      </h2>
      <p style="margin:0 0 20px;font-size:15px;color:#334155;line-height:1.7;">
        Hi ${firstName} — your SR&ED estimate is around <strong>${creditStr}</strong>.
        But most companies like yours also qualify for <strong style="color:#4f46e5;">$700K–$2M+</strong> in additional
        Canadian grants — NRC-IRAP, SDTC, Mitacs, and regional development agencies.
      </p>

      <table width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 24px;">
        ${[
          ['NRC-IRAP', 'Up to $500K for R&D salaries', 'For Canadian SMEs doing R&D work'],
          ['SDTC', 'Up to $15M for cleantech/deep tech', 'Non-dilutive — no equity given up'],
          ['Mitacs Accelerate', 'Up to $15K per intern per term', 'Requires university partner'],
          ['Regional Dev Agency', 'Up to $500K matching', 'FedDev, PacifiCan, ACOA by province'],
        ].map(([name, amount, note]) => `
          <tr>
            <td style="padding:10px 0;border-bottom:1px solid #f1f5f9;vertical-align:top;">
              <p style="margin:0;font-size:14px;font-weight:700;color:#1e293b;">${name}</p>
              <p style="margin:2px 0;font-size:13px;color:#4f46e5;font-weight:600;">${amount}</p>
              <p style="margin:0;font-size:12px;color:#64748b;">${note}</p>
            </td>
          </tr>
        `).join('')}
      </table>

      <p style="margin:0 0 20px;font-size:14px;color:#334155;line-height:1.7;">
        TaxLift Plus matches your profile against all 9 programs automatically —
        and generates the application sections using your SR&ED data.
        <strong>Upgrade in 30 seconds.</strong>
      </p>

      <a href="${settingsUrl}"
         style="display:inline-block;padding:14px 32px;background:#4f46e5;color:#fff;font-size:15px;font-weight:700;text-decoration:none;border-radius:10px;">
        Upgrade to Plus — unlock grants →
      </a>

      <p style="margin:16px 0 0;font-size:13px;color:#64748b;">
        Already on Plus?
        <a href="${grantsUrl}" style="color:#4f46e5;font-weight:600;">View your matched grants →</a>
      </p>

      <p style="margin:24px 0 0;font-size:13px;color:#94a3b8;">— Prateek, TaxLift</p>
    `),
  }
}

/**
 * scheduleUserDrip(userId, email, userData)
 *
 * Queues a 3-step email drip for a newly registered user.
 * userData: { name, firm_name, estimated_credit }
 */
function scheduleUserDrip(userId, email, userData = {}) {
  if (!userId || !email) return

  const steps = [
    { step: 1, sendAfter: hoursFromNow(0)   },   // immediate welcome
    { step: 2, sendAfter: hoursFromNow(48)  },   // Day 2 — cluster review nudge
    { step: 3, sendAfter: hoursFromNow(120) },   // Day 5 — grants upgrade
  ]

  const insert = db.prepare(`
    INSERT OR IGNORE INTO user_drip_emails
      (id, user_id, email, sequence_step, send_after, status)
    VALUES (?, ?, ?, ?, ?, 'pending')
  `)

  for (const { step, sendAfter } of steps) {
    try {
      insert.run(makeId(), userId, email, step, sendAfter)
    } catch (err) {
      console.error(`[userDrip] Failed to schedule step ${step} for ${email}:`, err.message)
    }
  }

  console.log(`[userDrip] Scheduled 3-email drip for ${email} (user ${userId})`)
}

async function sendUserDripEmail(row) {
  const user = db.prepare('SELECT full_name, firm_name FROM users WHERE id = ?').get(row.user_id) ?? {}

  // Rough credit estimate from company profile
  let estimatedCredit = null
  try {
    const profile = db.prepare('SELECT employee_count, industry_domain FROM company_profiles WHERE user_id = ?').get(row.user_id)
    if (profile?.employee_count) {
      const rdPcts = { software: 0.40, ai_ml: 0.45, biotech: 0.50, cleantech: 0.40, fintech: 0.35, medtech: 0.40, other: 0.20 }
      const rdPct  = rdPcts[profile.industry_domain] ?? 0.25
      estimatedCredit = Math.round(profile.employee_count * 105_000 * rdPct * 0.35)
    }
  } catch { /* ignore */ }

  const userData = { name: user.full_name, email: row.email, firmName: user.firm_name, estimatedCredit }

  let mail
  if      (row.sequence_step === 1) mail = buildUserEmail1(userData)
  else if (row.sequence_step === 2) mail = buildUserEmail2(userData)
  else                               mail = buildUserEmail3(userData)

  const transport = getTransporter()

  if (!transport) {
    console.log(`[userDrip] [LOG-ONLY] Would send step ${row.sequence_step} to ${row.email}: "${mail.subject}"`)
    db.prepare(`UPDATE user_drip_emails SET status = 'skipped', sent_at = ? WHERE id = ?`)
      .run(new Date().toISOString(), row.id)
    return
  }

  const unsubUrl = `${FRONTEND_URL}/unsubscribe?email=${encodeURIComponent(row.email)}&type=user`
  await transport.sendMail({
    from:    `"TaxLift" <${EMAIL_FROM}>`,
    to:      row.email,
    subject: mail.subject,
    html:    mail.html,
    headers: {
      'List-Unsubscribe':      `<${unsubUrl}>, <mailto:${EMAIL_FROM}?subject=unsubscribe>`,
      'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
    },
  })

  db.prepare(`UPDATE user_drip_emails SET status = 'sent', sent_at = ? WHERE id = ?`)
    .run(new Date().toISOString(), row.id)

  console.log(`[userDrip] Sent step ${row.sequence_step} to ${row.email}`)
}

async function processUserDripEmails() {
  let pending
  try {
    pending = db.prepare(`
      SELECT * FROM user_drip_emails
      WHERE status = 'pending' AND send_after <= ?
      ORDER BY send_after ASC
    `).all(new Date().toISOString())
  } catch (err) {
    console.error('[userDrip] Failed to query pending emails:', err.message)
    return
  }

  if (pending.length === 0) return

  console.log(`[userDrip] Processing ${pending.length} pending user email(s)…`)

  for (const row of pending) {
    try {
      db.prepare(`UPDATE user_drip_emails SET status = 'sending' WHERE id = ? AND status = 'pending'`).run(row.id)
      await sendUserDripEmail(row)
    } catch (err) {
      console.error(`[userDrip] Failed step ${row.sequence_step} for ${row.email}:`, err.message)
      db.prepare(`UPDATE user_drip_emails SET status = 'failed' WHERE id = ?`).run(row.id)
    }
  }
}

module.exports = { scheduleDrip, scheduleUserDrip, startDripScheduler }
