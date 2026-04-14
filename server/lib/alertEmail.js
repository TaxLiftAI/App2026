/**
 * alertEmail.js — Real-time founder alert emails
 *
 * Sends a notification to ALERT_TO (default: hello@taxlift.ai) whenever
 * something business-critical happens:
 *   - New scan lead captured with a credit estimate
 *   - New user registration (paid signup)
 *   - Scan completed with estimate above threshold
 *
 * Uses the same SMTP config as emailDrip.js:
 *   SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS
 *   EMAIL_FROM   (default: hello@taxlift.ai)
 *   ALERT_TO     (default: hello@taxlift.ai) — where alerts are sent
 *
 * Falls back to console.log if SMTP is not configured — safe in dev.
 */

const nodemailer = require('nodemailer')
const https      = require('https')

const EMAIL_FROM      = process.env.EMAIL_FROM      || 'hello@taxlift.ai'
const ALERT_TO        = process.env.ALERT_TO        || 'hello@taxlift.ai'
const SMTP_HOST       = process.env.SMTP_HOST
const SMTP_PORT       = parseInt(process.env.SMTP_PORT || '587', 10)
const SMTP_USER       = process.env.SMTP_USER
const SMTP_PASS       = process.env.SMTP_PASS
const APP_URL         = (process.env.FRONTEND_URL || 'https://taxlift.ai').replace(/\/$/, '')
const SLACK_WEBHOOK   = process.env.SLACK_ALERT_WEBHOOK_URL   // optional Slack incoming webhook
const HIGH_VALUE_THRESHOLD = Number(process.env.HIGH_VALUE_THRESHOLD || 25_000)  // default $25K

// ── Slack helper ──────────────────────────────────────────────────────────────
function postSlack(text) {
  if (!SLACK_WEBHOOK) return Promise.resolve()
  return new Promise(resolve => {
    const body = JSON.stringify({ text })
    const url  = new URL(SLACK_WEBHOOK)
    const req  = https.request({
      hostname: url.hostname, path: url.pathname + url.search,
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) },
    }, () => resolve())
    req.on('error', err => { console.warn('[alert/slack] failed:', err.message); resolve() })
    req.write(body); req.end()
  })
}

let _transport = null

function getTransport() {
  if (_transport) return _transport
  if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS) return null   // log-only mode
  _transport = nodemailer.createTransport({
    host: SMTP_HOST,
    port: SMTP_PORT,
    secure: SMTP_PORT === 465,
    auth: { user: SMTP_USER, pass: SMTP_PASS },
  })
  return _transport
}

async function sendAlert({ subject, html, text }) {
  const transport = getTransport()
  if (!transport) {
    console.log(`[alert] (SMTP not configured — log only)\nTo: ${ALERT_TO}\nSubject: ${subject}\n${text}`)
    return
  }
  try {
    await transport.sendMail({ from: EMAIL_FROM, to: ALERT_TO, subject, html, text })
    console.log(`[alert] Sent: "${subject}" → ${ALERT_TO}`)
  } catch (err) {
    console.error('[alert] Failed to send alert email:', err.message)
  }
}

// ── Alert: new scan lead ───────────────────────────────────────────────────────
// Called when POST /api/leads captures an email with an estimated credit.
async function alertNewLead({ email, name = '', company = '', estimatedCredit, source = 'unknown' }) {
  const creditStr = estimatedCredit
    ? `$${Number(estimatedCredit).toLocaleString('en-CA')} CAD`
    : 'not estimated'

  const subject = `🎯 New TaxLift lead${estimatedCredit ? ` — ${creditStr} SR&ED estimate` : ''}: ${email}`

  const html = `
    <div style="font-family:Arial,sans-serif;max-width:520px;margin:0 auto;padding:24px">
      <div style="background:#4F46E5;border-radius:12px;padding:20px;margin-bottom:20px">
        <h2 style="color:#fff;margin:0;font-size:18px">🎯 New Lead Captured</h2>
        <p style="color:#C7D2FE;margin:6px 0 0;font-size:13px">Follow up while they're warm</p>
      </div>

      <table style="width:100%;border-collapse:collapse;font-size:14px">
        <tr style="background:#F8FAFC">
          <td style="padding:10px 12px;font-weight:600;color:#334155;width:140px">Email</td>
          <td style="padding:10px 12px;color:#1E293B"><a href="mailto:${email}" style="color:#4F46E5">${email}</a></td>
        </tr>
        ${name ? `<tr><td style="padding:10px 12px;font-weight:600;color:#334155">Name</td><td style="padding:10px 12px;color:#1E293B">${name}</td></tr>` : ''}
        ${company ? `<tr style="background:#F8FAFC"><td style="padding:10px 12px;font-weight:600;color:#334155">Company</td><td style="padding:10px 12px;color:#1E293B">${company}</td></tr>` : ''}
        <tr ${name || company ? '' : 'style="background:#F8FAFC"'}>
          <td style="padding:10px 12px;font-weight:600;color:#334155">SR&amp;ED Estimate</td>
          <td style="padding:10px 12px;color:${estimatedCredit ? '#059669' : '#94A3B8'};font-weight:${estimatedCredit ? '700' : '400'}">${creditStr}</td>
        </tr>
        <tr style="background:#F8FAFC">
          <td style="padding:10px 12px;font-weight:600;color:#334155">Source</td>
          <td style="padding:10px 12px;color:#1E293B">${source}</td>
        </tr>
        <tr>
          <td style="padding:10px 12px;font-weight:600;color:#334155">Time</td>
          <td style="padding:10px 12px;color:#1E293B">${new Date().toLocaleString('en-CA', { timeZone: 'America/Toronto' })} ET</td>
        </tr>
      </table>

      <div style="margin-top:20px;padding:16px;background:#EEF2FF;border-radius:10px">
        <p style="margin:0;font-size:13px;color:#3730A3">
          <strong>Suggested next step:</strong> Reply within 15 minutes with a personal note and a Calendly link.
          Warm lead conversion drops 10× after the first hour.
        </p>
      </div>

      <div style="margin-top:16px;text-align:center">
        <a href="${APP_URL}/admin/leads" style="display:inline-block;background:#4F46E5;color:#fff;padding:10px 20px;border-radius:8px;text-decoration:none;font-size:13px;font-weight:600">
          View All Leads →
        </a>
      </div>

      <p style="margin-top:24px;font-size:11px;color:#94A3B8;text-align:center">
        TaxLift Alert · <a href="${APP_URL}" style="color:#94A3B8">${APP_URL}</a>
      </p>
    </div>
  `

  const text = `New TaxLift lead: ${email}${name ? ` (${name})` : ''}${company ? ` at ${company}` : ''}\nSR&ED estimate: ${creditStr}\nSource: ${source}\nTime: ${new Date().toISOString()}\n\nView leads: ${APP_URL}/admin/leads`

  await sendAlert({ subject, html, text })
}

// ── Alert: new user registration ───────────────────────────────────────────────
// Called when POST /api/auth/register creates a new account.
async function alertNewRegistration({ email, fullName = '', firmName = '', plan = 'free' }) {
  const subject = `🚀 New TaxLift signup: ${email}${firmName ? ` (${firmName})` : ''}`

  const html = `
    <div style="font-family:Arial,sans-serif;max-width:520px;margin:0 auto;padding:24px">
      <div style="background:#059669;border-radius:12px;padding:20px;margin-bottom:20px">
        <h2 style="color:#fff;margin:0;font-size:18px">🚀 New Account Created</h2>
        <p style="color:#A7F3D0;margin:6px 0 0;font-size:13px">Someone just signed up for TaxLift</p>
      </div>

      <table style="width:100%;border-collapse:collapse;font-size:14px">
        <tr style="background:#F8FAFC">
          <td style="padding:10px 12px;font-weight:600;color:#334155;width:140px">Email</td>
          <td style="padding:10px 12px;color:#1E293B"><a href="mailto:${email}" style="color:#4F46E5">${email}</a></td>
        </tr>
        ${fullName ? `<tr><td style="padding:10px 12px;font-weight:600;color:#334155">Name</td><td style="padding:10px 12px;color:#1E293B">${fullName}</td></tr>` : ''}
        ${firmName ? `<tr style="background:#F8FAFC"><td style="padding:10px 12px;font-weight:600;color:#334155">Firm</td><td style="padding:10px 12px;color:#1E293B">${firmName}</td></tr>` : ''}
        <tr style="background:#F8FAFC">
          <td style="padding:10px 12px;font-weight:600;color:#334155">Plan</td>
          <td style="padding:10px 12px;color:#1E293B;font-weight:600">${plan}</td>
        </tr>
        <tr>
          <td style="padding:10px 12px;font-weight:600;color:#334155">Time</td>
          <td style="padding:10px 12px;color:#1E293B">${new Date().toLocaleString('en-CA', { timeZone: 'America/Toronto' })} ET</td>
        </tr>
      </table>

      <div style="margin-top:16px;text-align:center">
        <a href="${APP_URL}/admin/leads" style="display:inline-block;background:#059669;color:#fff;padding:10px 20px;border-radius:8px;text-decoration:none;font-size:13px;font-weight:600">
          View in Admin →
        </a>
      </div>

      <p style="margin-top:24px;font-size:11px;color:#94A3B8;text-align:center">
        TaxLift Alert · <a href="${APP_URL}" style="color:#94A3B8">${APP_URL}</a>
      </p>
    </div>
  `

  const text = `New TaxLift signup: ${email}${fullName ? ` (${fullName})` : ''}${firmName ? ` at ${firmName}` : ''}\nPlan: ${plan}\nTime: ${new Date().toISOString()}`

  await Promise.all([
    sendAlert({ subject, html, text }),
    postSlack(`🚀 *New signup* — ${email}${firmName ? ` · ${firmName}` : ''}  |  plan: ${plan}\n🔗 ${APP_URL}/admin/sales`),
  ])
}

// ── Alert: high-value scan completed ──────────────────────────────────────────
// Called when a scan completes with an estimate above the threshold.
async function alertHighValueScan({ email, estimatedCredit, clusterCount, repoCount }) {
  if (!estimatedCredit || Number(estimatedCredit) < HIGH_VALUE_THRESHOLD) return

  const creditStr = `$${Number(estimatedCredit).toLocaleString('en-CA')} CAD`
  const subject   = `💰 High-value scan: ${creditStr} estimate for ${email || 'anonymous user'}`

  const html = `
    <div style="font-family:Arial,sans-serif;max-width:520px;margin:0 auto;padding:24px">
      <div style="background:#7C3AED;border-radius:12px;padding:20px;margin-bottom:20px">
        <h2 style="color:#fff;margin:0;font-size:18px">💰 High-Value Scan Completed</h2>
        <p style="color:#DDD6FE;margin:6px 0 0;font-size:13px">This lead has strong SR&amp;ED potential</p>
      </div>

      <table style="width:100%;border-collapse:collapse;font-size:14px">
        <tr style="background:#F8FAFC">
          <td style="padding:10px 12px;font-weight:600;color:#334155;width:140px">Email</td>
          <td style="padding:10px 12px;color:#1E293B">${email ? `<a href="mailto:${email}" style="color:#4F46E5">${email}</a>` : '<em style="color:#94A3B8">not provided</em>'}</td>
        </tr>
        <tr>
          <td style="padding:10px 12px;font-weight:600;color:#334155">SR&amp;ED Estimate</td>
          <td style="padding:10px 12px;color:#059669;font-weight:700;font-size:16px">${creditStr}</td>
        </tr>
        <tr style="background:#F8FAFC">
          <td style="padding:10px 12px;font-weight:600;color:#334155">Clusters</td>
          <td style="padding:10px 12px;color:#1E293B">${clusterCount ?? 'unknown'} qualifying activities</td>
        </tr>
        <tr>
          <td style="padding:10px 12px;font-weight:600;color:#334155">Repos Scanned</td>
          <td style="padding:10px 12px;color:#1E293B">${repoCount ?? 'unknown'}</td>
        </tr>
        <tr style="background:#F8FAFC">
          <td style="padding:10px 12px;font-weight:600;color:#334155">Time</td>
          <td style="padding:10px 12px;color:#1E293B">${new Date().toLocaleString('en-CA', { timeZone: 'America/Toronto' })} ET</td>
        </tr>
      </table>

      <div style="margin-top:20px;padding:16px;background:#F5F3FF;border-radius:10px">
        <p style="margin:0;font-size:13px;color:#5B21B6">
          <strong>Action:</strong> If email was captured, follow up within 15 minutes.
          A ${creditStr} refund means ~${`$${Math.round(Number(estimatedCredit) * 0.20).toLocaleString('en-CA')}`} lost to a consultant if they don't use TaxLift.
        </p>
      </div>

      <p style="margin-top:24px;font-size:11px;color:#94A3B8;text-align:center">
        TaxLift Alert · <a href="${APP_URL}" style="color:#94A3B8">${APP_URL}</a>
      </p>
    </div>
  `

  const text = `High-value scan: ${creditStr} estimate\nEmail: ${email || 'not provided'}\nClusters: ${clusterCount}\nRepos: ${repoCount}\nTime: ${new Date().toISOString()}`

  await Promise.all([
    sendAlert({ subject, html, text }),
    postSlack(`💰 *High-value scan* — ${creditStr} SR&ED estimate\n📧 ${email || '_no email_'}  |  ${clusterCount ?? '?'} clusters  |  ${repoCount ?? '?'} repos\n🔗 ${APP_URL}/admin/sales`),
  ])
}

module.exports = { alertNewLead, alertNewRegistration, alertHighValueScan }
