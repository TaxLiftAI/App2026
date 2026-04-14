/**
 * CPA routes
 *
 *   POST /api/cpa/send-handoff   — email a CPA review package link
 *   GET  /api/cpa/smtp-status    — check whether SMTP is configured
 */
const router = require('express').Router()
const nodemailer = require('nodemailer')
const { requireAuth } = require('../middleware/auth')

const EMAIL_FROM   = process.env.EMAIL_FROM   || 'hello@taxlift.ai'
const SMTP_HOST    = process.env.SMTP_HOST
const SMTP_PORT    = parseInt(process.env.SMTP_PORT || '587', 10)
const SMTP_USER    = process.env.SMTP_USER
const SMTP_PASS    = process.env.SMTP_PASS
const FRONTEND_URL = (process.env.FRONTEND_URL || 'https://app.taxlift.ai').replace(/\/$/, '')

let _transporter = null
function getTransporter() {
  if (_transporter) return _transporter
  if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS) return null
  _transporter = nodemailer.createTransport({
    host:   SMTP_HOST,
    port:   SMTP_PORT,
    secure: SMTP_PORT === 465,
    auth:   { user: SMTP_USER, pass: SMTP_PASS },
  })
  return _transporter
}

// ── HTML helpers ──────────────────────────────────────────────────────────────
function emailLayout(body) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>TaxLift SR&amp;ED Review Package</title>
</head>
<body style="margin:0;padding:0;background:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;padding:40px 16px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 1px 4px rgba(0,0,0,0.08);">

          <!-- Header -->
          <tr>
            <td style="background:#1e1b4b;padding:28px 40px;">
              <span style="font-size:22px;font-weight:700;color:#ffffff;letter-spacing:-0.3px;">TaxLift</span>
              <span style="font-size:13px;color:rgba(255,255,255,0.55);margin-left:10px;">SR&amp;ED Intelligence</span>
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
                This package was shared via TaxLift — SR&amp;ED automation software.<br>
                Questions? Reply to this email or contact
                <a href="mailto:hello@taxlift.ai" style="color:#6366f1;text-decoration:none;">hello@taxlift.ai</a>
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

function formatCAD(n) {
  if (!n || isNaN(n)) return 'N/A'
  return new Intl.NumberFormat('en-CA', { style: 'currency', currency: 'CAD', maximumFractionDigits: 0 }).format(n)
}

function buildHandoffEmail({
  cpaName, companyName, fiscalYear,
  sharedBy, sharedByEmail,
  reviewLink, expiresAt,
  totalCredit, clusterCount, auditScore,
}) {
  const expDate = expiresAt
    ? new Date(expiresAt).toLocaleDateString('en-CA', { month: 'long', day: 'numeric', year: 'numeric' })
    : '7 days from now'

  const greeting = cpaName ? `Hi ${cpaName},` : 'Hi,'

  const creditLine = totalCredit
    ? `<p style="margin:0 0 16px;font-size:15px;color:#334155;line-height:1.7;">
        The package covers <strong>${clusterCount ?? 'multiple'} SR&amp;ED cluster${(clusterCount ?? 2) !== 1 ? 's' : ''}</strong>
        with an estimated ITC of <strong style="color:#4f46e5;">${formatCAD(totalCredit)}</strong>
        for FY${fiscalYear}.
       </p>`
    : `<p style="margin:0 0 16px;font-size:15px;color:#334155;line-height:1.7;">
        The package covers the SR&amp;ED claim for <strong>${companyName}</strong> FY${fiscalYear}.
       </p>`

  const auditBadge = auditScore
    ? `<span style="display:inline-block;padding:2px 10px;background:#dcfce7;color:#166534;font-size:12px;font-weight:600;border-radius:20px;margin-left:8px;">
        Audit readiness: ${auditScore}/100
       </span>`
    : ''

  const body = `
    <h2 style="margin:0 0 6px;font-size:22px;font-weight:700;color:#0f172a;letter-spacing:-0.3px;">
      SR&amp;ED Review Package — ${companyName} ${auditBadge}
    </h2>
    <p style="margin:0 0 24px;font-size:14px;color:#64748b;">FY${fiscalYear} · Shared by ${sharedBy}</p>

    <p style="margin:0 0 16px;font-size:15px;color:#334155;line-height:1.7;">
      ${greeting}
    </p>
    <p style="margin:0 0 16px;font-size:15px;color:#334155;line-height:1.7;">
      ${sharedBy} has shared a TaxLift SR&amp;ED review package with you for
      <strong>${companyName}</strong>'s FY${fiscalYear} claim. Please review and advise on next steps.
    </p>

    ${creditLine}

    <!-- What's included -->
    <table width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 24px;background:#f8fafc;border-radius:10px;overflow:hidden;">
      <tr>
        <td style="padding:18px 20px;">
          <p style="margin:0 0 12px;font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;color:#64748b;">What's included</p>
          <table width="100%" cellpadding="0" cellspacing="0">
            ${[
              'T661 narrative drafts (AI-generated, pending your review)',
              'Financial schedule — proxy method estimate with line items',
              'Cluster-by-cluster activity descriptions and time allocations',
              'Evidence chain-of-custody with SHA-256 snapshot hashes',
              'Audit readiness checklist',
            ].map(item => `
              <tr>
                <td style="padding:5px 0;font-size:14px;color:#334155;vertical-align:top;">
                  <span style="color:#4f46e5;margin-right:8px;">✓</span>${item}
                </td>
              </tr>`).join('')}
          </table>
        </td>
      </tr>
    </table>

    <!-- CTA -->
    <p style="margin:0 0 20px;font-size:15px;color:#334155;line-height:1.7;">
      Click below to access the read-only package — no login required.
      The link expires on <strong>${expDate}</strong>.
    </p>

    <a href="${reviewLink}"
       style="display:inline-block;padding:14px 32px;background:#4f46e5;color:#ffffff;font-size:15px;font-weight:700;text-decoration:none;border-radius:10px;letter-spacing:-0.2px;">
      Open SR&amp;ED Review Package →
    </a>

    <p style="margin:28px 0 0;font-size:13px;color:#94a3b8;line-height:1.6;">
      Or copy the link manually:<br>
      <span style="font-family:monospace;font-size:12px;color:#64748b;word-break:break-all;">${reviewLink}</span>
    </p>

    ${sharedByEmail ? `<p style="margin:20px 0 0;font-size:13px;color:#64748b;">
      Questions? Reply to <a href="mailto:${sharedByEmail}" style="color:#4f46e5;">${sharedByEmail}</a>
    </p>` : ''}
  `

  return emailLayout(body)
}

// ── GET /api/cpa/smtp-status ──────────────────────────────────────────────────
router.get('/smtp-status', requireAuth, (req, res) => {
  res.json({ configured: !!(SMTP_HOST && SMTP_USER && SMTP_PASS) })
})

// ── POST /api/cpa/send-handoff ────────────────────────────────────────────────
router.post('/send-handoff', requireAuth, async (req, res) => {
  const {
    cpaEmail, cpaName,
    companyName, fiscalYear,
    sharedBy, sharedByEmail,
    reviewLink, expiresAt,
    totalCredit, clusterCount, auditScore,
  } = req.body ?? {}

  if (!cpaEmail || !reviewLink) {
    return res.status(400).json({ message: 'cpaEmail and reviewLink are required' })
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  if (!emailRegex.test(cpaEmail)) {
    return res.status(400).json({ message: 'Invalid CPA email address' })
  }

  const html = buildHandoffEmail({
    cpaName, companyName, fiscalYear,
    sharedBy, sharedByEmail,
    reviewLink, expiresAt,
    totalCredit, clusterCount, auditScore,
  })

  const subject = `SR&ED Review Package — ${companyName ?? 'Your Client'} (FY${fiscalYear ?? new Date().getFullYear()})`

  const transport = getTransporter()
  if (!transport) {
    // SMTP not configured — log and return a helpful message
    console.log(`[cpa/send-handoff] SMTP not configured. Would have sent to: ${cpaEmail}`)
    console.log(`[cpa/send-handoff] Subject: ${subject}`)
    console.log(`[cpa/send-handoff] Review link: ${reviewLink}`)
    return res.status(503).json({
      message: 'SMTP is not configured on the server. Set SMTP_HOST, SMTP_USER, and SMTP_PASS in Railway Variables.',
      configured: false,
    })
  }

  try {
    await transport.sendMail({
      from:    `"TaxLift" <${EMAIL_FROM}>`,
      to:      cpaName ? `"${cpaName}" <${cpaEmail}>` : cpaEmail,
      replyTo: sharedByEmail || EMAIL_FROM,
      subject,
      html,
      text: `SR&ED Review Package for ${companyName ?? 'your client'} FY${fiscalYear}.\n\nReview link (no login required):\n${reviewLink}\n\nShared by: ${sharedBy ?? 'TaxLift user'}`,
    })

    console.log(`[cpa/send-handoff] Sent to ${cpaEmail} for ${companyName}`)
    res.json({ ok: true, message: `Package emailed to ${cpaEmail}` })
  } catch (err) {
    console.error('[cpa/send-handoff] Send error:', err.message)
    res.status(502).json({ message: `Failed to send email: ${err.message}` })
  }
})

// ── POST /api/cpa/partner-signup ──────────────────────────────────────────────
// Public — no auth required. CPA submits partnership interest.
// Creates a referral record and sends welcome email.

router.post('/partner-signup', async (req, res) => {
  const {
    full_name,
    email,
    firm_name,
    province   = 'ON',
    phone      = '',
    client_count = '',
  } = req.body ?? {}

  if (!full_name?.trim() || !email?.trim() || !firm_name?.trim()) {
    return res.status(400).json({ message: 'full_name, email, and firm_name are required' })
  }

  // Generate unique referral code: first 3 letters of firm + 6 hex chars
  const firmSlug = firm_name.replace(/[^a-zA-Z]/g, '').slice(0, 3).toUpperCase()
  const hex      = require('crypto').randomBytes(3).toString('hex').toUpperCase()
  const refCode  = `CPA-${firmSlug}${hex}`

  const db     = require('../db')
  const makeId = require('../utils/uuid').makeId || (() => require('crypto').randomUUID())
  const now    = new Date().toISOString()

  // Store in cpa_partners table (create if needed)
  try {
    db.exec(`
      CREATE TABLE IF NOT EXISTS cpa_partners (
        id           TEXT PRIMARY KEY,
        full_name    TEXT NOT NULL,
        email        TEXT UNIQUE NOT NULL,
        firm_name    TEXT NOT NULL,
        province     TEXT NOT NULL DEFAULT 'ON',
        phone        TEXT NOT NULL DEFAULT '',
        client_count TEXT NOT NULL DEFAULT '',
        referral_code TEXT UNIQUE NOT NULL,
        status       TEXT NOT NULL DEFAULT 'pending',
        created_at   TEXT NOT NULL DEFAULT (datetime('now'))
      )
    `)

    db.prepare(`
      INSERT OR IGNORE INTO cpa_partners
        (id, full_name, email, firm_name, province, phone, client_count, referral_code, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(require('crypto').randomUUID(), full_name, email, firm_name, province, phone, client_count, refCode, now)
  } catch (err) {
    console.error('[cpa/partner-signup] DB error:', err.message)
    return res.status(500).json({ message: 'Failed to save application' })
  }

  // Send welcome email to CPA
  const transport = getTransporter()
  const referralUrl = `${FRONTEND_URL}/scan?ref=${refCode}`
  const partnerUrl  = `${FRONTEND_URL}/cpa/partner-signup/confirmed?ref=${refCode}`

  if (transport) {
    const welcomeHtml = emailLayout(`
      <h2 style="margin:0 0 8px;font-size:22px;font-weight:700;color:#0f172a;">
        Welcome to the TaxLift Partner Program, ${escHtml(full_name.split(' ')[0])}!
      </h2>
      <p style="margin:0 0 20px;font-size:15px;color:#334155;line-height:1.7;">
        Your CPA partner application has been received. Here's your unique referral link to share with clients:
      </p>
      <div style="background:#f5f3ff;border:1px solid #e0e7ff;border-radius:10px;padding:20px 24px;margin:0 0 24px;">
        <p style="margin:0 0 6px;font-size:12px;font-weight:700;color:#6366f1;text-transform:uppercase;letter-spacing:0.5px;">Your Referral Link</p>
        <a href="${referralUrl}" style="font-size:15px;font-weight:600;color:#4f46e5;word-break:break-all;">${referralUrl}</a>
        <p style="margin:8px 0 0;font-size:12px;color:#64748b;">Referral code: <strong>${refCode}</strong></p>
      </div>
      <h3 style="margin:0 0 12px;font-size:16px;font-weight:700;color:#1e293b;">How it works</h3>
      <table width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 24px;">
        ${[
          ['Share your link', 'Send the link to clients filing SR&ED. They get a free scan with your referral code attached.'],
          ['Client gets their T661 package', 'TaxLift scans their GitHub/Jira, generates narratives, and delivers a CPA-ready T661 package — you review and file as normal.'],
          ['You earn a flat referral fee', 'Fees range from $750 to $9,000 per client based on their SR&ED credit size. Paid within 14 days of T661 package delivery — no % contingency, no Rule 205 concerns.'],
        ].map(([title, body]) => `
          <tr>
            <td style="padding:8px 0;vertical-align:top;border-bottom:1px solid #f1f5f9;">
              <p style="margin:0;font-size:14px;font-weight:600;color:#1e293b;">✓ ${title}</p>
              <p style="margin:2px 0 0;font-size:13px;color:#64748b;">${body}</p>
            </td>
          </tr>
        `).join('')}
      </table>
      <p style="margin:0 0 20px;font-size:14px;color:#334155;line-height:1.7;">
        Our team will review your application within 1 business day and send your partner welcome kit.
        In the meantime, feel free to share your link with interested clients.
      </p>
      <a href="${partnerUrl}" style="display:inline-block;padding:14px 28px;background:#6366f1;color:#ffffff;font-size:15px;font-weight:600;text-decoration:none;border-radius:8px;">
        View your partner dashboard →
      </a>
    `)

    try {
      await transport.sendMail({
        from:    `"TaxLift" <${EMAIL_FROM}>`,
        to:      `"${full_name}" <${email}>`,
        subject: `Welcome to TaxLift Partner Program — your referral link is ready`,
        html:    welcomeHtml,
      })
    } catch (emailErr) {
      console.warn('[cpa/partner-signup] Welcome email failed:', emailErr.message)
      // Don't fail the signup if email fails
    }

    // Notify internal team
    try {
      await transport.sendMail({
        from:    `"TaxLift Bot" <${EMAIL_FROM}>`,
        to:      EMAIL_FROM,
        subject: `🤝 New CPA Partner: ${full_name} — ${firm_name} (${province})`,
        text:    `Name: ${full_name}\nEmail: ${email}\nFirm: ${firm_name}\nProvince: ${province}\nPhone: ${phone}\nClient count: ${client_count}\nRef code: ${refCode}`,
      })
    } catch { /* ignore internal notification failures */ }
  }

  res.json({ ok: true, referral_code: refCode, referral_url: referralUrl })
})

function escHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

module.exports = router
