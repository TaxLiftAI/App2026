/**
 * Auth routes
 *   POST  /api/auth/register
 *   POST  /api/auth/login
 *   GET   /api/auth/me
 *   GET   /api/auth/profile
 *   PATCH /api/auth/profile
 *   PATCH /api/auth/onboarding-complete
 *   GET   /api/auth/verify-email?token=xxx  — verify email address
 *   POST  /api/auth/resend-verification     — resend verification email (auth required)
 */
const router  = require('express').Router()
const bcrypt  = require('bcryptjs')
const crypto  = require('crypto')
const { v4: uuid } = require('../utils/uuid')
const db      = require('../db')
const { signToken, requireAuth } = require('../middleware/auth')

const APP_URL    = (process.env.FRONTEND_URL || 'https://taxlift.ai').replace(/\/$/, '')
const EMAIL_FROM = process.env.EMAIL_FROM || 'hello@taxlift.ai'

const USER_SELECT = `
  SELECT id, email, full_name, firm_name, role, tenant_id,
         subscription_tier, onboarding_completed, email_verified, created_at
  FROM users WHERE id = ?
`

function shapeUser(u) {
  return {
    id:                   u.id,
    email:                u.email,
    full_name:            u.full_name,
    display_name:         u.full_name,
    firm_name:            u.firm_name,
    role:                 u.role,
    tenant_id:            u.tenant_id,
    subscription_tier:    u.subscription_tier ?? 'free',
    onboarding_completed: !!u.onboarding_completed,
    email_verified:       !!u.email_verified,
    created_at:           u.created_at,
  }
}

// ── Email verification helper ─────────────────────────────────────────────────
function makeVerifyToken() {
  return crypto.randomBytes(32).toString('hex')
}

async function sendVerificationEmail(email, token) {
  const verifyUrl = `${APP_URL}/verify-email?token=${token}`
  let nodemailer, transport
  try {
    nodemailer = require('nodemailer')
    if (!process.env.SMTP_HOST || !process.env.SMTP_USER || !process.env.SMTP_PASS) throw new Error('SMTP not configured')
    transport = nodemailer.createTransport({
      host:   process.env.SMTP_HOST,
      port:   parseInt(process.env.SMTP_PORT || '587', 10),
      secure: process.env.SMTP_PORT === '465',
      auth:   { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
    })
  } catch {
    console.log(`[auth/verify] SMTP not configured. Verify URL: ${verifyUrl}`)
    return
  }

  await transport.sendMail({
    from:    EMAIL_FROM,
    to:      email,
    subject: 'Verify your TaxLift email address',
    html: `
      <div style="font-family:Arial,sans-serif;max-width:520px;margin:0 auto;padding:24px">
        <div style="background:#4F46E5;border-radius:12px;padding:24px;margin-bottom:24px;text-align:center">
          <h1 style="color:#fff;margin:0;font-size:22px;font-weight:700">Verify your email</h1>
          <p style="color:#C7D2FE;margin:8px 0 0;font-size:14px">One click and you're ready to claim your SR&amp;ED credit</p>
        </div>
        <p style="color:#334155;font-size:14px;line-height:1.6">Hi there,</p>
        <p style="color:#334155;font-size:14px;line-height:1.6">
          Thanks for signing up for TaxLift. Please verify your email address to activate your account.
        </p>
        <div style="text-align:center;margin:32px 0">
          <a href="${verifyUrl}"
             style="display:inline-block;background:#4F46E5;color:#fff;padding:14px 32px;border-radius:10px;text-decoration:none;font-size:15px;font-weight:700">
            Verify email address →
          </a>
        </div>
        <p style="color:#64748B;font-size:13px;line-height:1.6">
          This link expires in <strong>48 hours</strong>. If you didn't create a TaxLift account, you can safely ignore this email.
        </p>
        <p style="color:#94A3B8;font-size:12px;margin-top:24px">
          Or copy this link into your browser:<br/>
          <a href="${verifyUrl}" style="color:#6366F1;word-break:break-all">${verifyUrl}</a>
        </p>
        <hr style="border:none;border-top:1px solid #E2E8F0;margin:24px 0"/>
        <p style="color:#94A3B8;font-size:11px;text-align:center;margin:0">
          TaxLift Inc. · <a href="${APP_URL}" style="color:#94A3B8">${APP_URL}</a>
        </p>
      </div>
    `,
    text: `Verify your TaxLift email address\n\nClick the link below (expires in 48 hours):\n${verifyUrl}\n\nIf you didn't create a TaxLift account, ignore this email.`,
  })
  console.log(`[auth/verify] Verification email sent to ${email}`)
}

// ── POST /api/auth/register ───────────────────────────────────────────────────
router.post('/register', async (req, res) => {
  const { email, password, full_name = '', firm_name = '', role = 'admin' } = req.body ?? {}

  if (!email || !password) {
    return res.status(400).json({ message: 'email and password are required' })
  }
  if (password.length < 8) {
    return res.status(400).json({ message: 'Password must be at least 8 characters' })
  }

  const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email.toLowerCase())
  if (existing) {
    return res.status(409).json({ message: 'An account with that email already exists' })
  }

  const id            = uuid()
  const password_hash = await bcrypt.hash(password, 10)
  const tenant_id     = `tenant-${id.slice(0, 8)}`

  const safeRole = ['admin', 'developer', 'reviewer', 'cpa'].includes(role) ? role : 'admin'

  const verifyToken = makeVerifyToken()

  db.prepare(`
    INSERT INTO users (id, email, password_hash, full_name, firm_name, role, tenant_id,
                       email_verify_token, email_verify_sent_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
  `).run(id, email.toLowerCase(), password_hash, full_name, firm_name, safeRole, tenant_id, verifyToken)

  // Fire-and-forget — never blocks the response
  sendVerificationEmail(email.toLowerCase(), verifyToken)
    .catch(err => console.error('[auth/register] verify email error:', err.message))

  const user  = db.prepare(USER_SELECT).get(id)
  const token = signToken({ id: user.id, email: user.email, role: user.role, tenant_id: user.tenant_id })

  // Kick off 3-step drip sequence (fire-and-forget, never blocks the response)
  try {
    const { scheduleUserDrip } = require('../lib/emailDrip')
    scheduleUserDrip(id, email.toLowerCase(), { name: full_name, firm_name })
  } catch (err) {
    console.error('[auth/register] scheduleUserDrip error:', err.message)
  }

  // Real-time founder alert — fire-and-forget
  const { alertNewRegistration } = require('../lib/alertEmail')
  alertNewRegistration({
    email: email.toLowerCase(),
    fullName: full_name,
    firmName: firm_name,
    plan: 'free',
  }).catch(err => console.error('[auth/register] alert error:', err.message))

  res.status(201).json({ access_token: token, token_type: 'bearer', user: shapeUser(user) })
})

// ── POST /api/auth/login ──────────────────────────────────────────────────────
router.post('/login', async (req, res) => {
  const email    = (req.body?.email ?? req.body?.username ?? '').toLowerCase()
  const password = req.body?.password ?? ''

  if (!email || !password) {
    return res.status(400).json({ message: 'email and password are required' })
  }

  const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email)
  if (!user) {
    return res.status(401).json({ message: 'Invalid email or password' })
  }

  const valid = await bcrypt.compare(password, user.password_hash)
  if (!valid) {
    return res.status(401).json({ message: 'Invalid email or password' })
  }

  const token = signToken({ id: user.id, email: user.email, role: user.role, tenant_id: user.tenant_id })

  res.json({ access_token: token, token_type: 'bearer', user: shapeUser(user) })
})

// ── GET /api/auth/me ──────────────────────────────────────────────────────────
router.get('/me', requireAuth, (req, res) => {
  const user = db.prepare(USER_SELECT).get(req.user.id)

  if (!user) {
    return res.status(404).json({ message: 'User not found' })
  }
  res.json(shapeUser(user))
})

// ── PATCH /api/auth/onboarding-complete ──────────────────────────────────────
router.patch('/onboarding-complete', requireAuth, (req, res) => {
  db.prepare('UPDATE users SET onboarding_completed = 1 WHERE id = ?').run(req.user.id)
  const user = db.prepare(USER_SELECT).get(req.user.id)
  res.json(shapeUser(user))
})

// ── GET /api/auth/profile ─────────────────────────────────────────────────────
router.get('/profile', requireAuth, (req, res) => {
  const profile = db.prepare('SELECT * FROM company_profiles WHERE user_id = ?').get(req.user.id)
  if (!profile) return res.json({})
  let tech_stack = []
  try { tech_stack = JSON.parse(profile.tech_stack || '[]') } catch {}
  res.json({ ...profile, tech_stack })
})

// ── PATCH /api/auth/profile ───────────────────────────────────────────────────
router.patch('/profile', requireAuth, (req, res) => {
  const {
    company_name, fiscal_year_end, employee_count,
    tech_stack, sred_claimed, province, industry_domain,
  } = req.body ?? {}

  if (company_name) {
    db.prepare('UPDATE users SET firm_name = ? WHERE id = ?').run(company_name, req.user.id)
  }

  const existing = db.prepare('SELECT id FROM company_profiles WHERE user_id = ?').get(req.user.id)
  if (existing) {
    db.prepare(`
      UPDATE company_profiles
      SET company_name    = COALESCE(?, company_name),
          fiscal_year_end = COALESCE(?, fiscal_year_end),
          employee_count  = COALESCE(?, employee_count),
          tech_stack      = COALESCE(?, tech_stack),
          sred_claimed    = COALESCE(?, sred_claimed),
          province        = COALESCE(?, province),
          industry_domain = COALESCE(?, industry_domain)
      WHERE user_id = ?
    `).run(
      company_name    ?? null,
      fiscal_year_end ?? null,
      employee_count  ?? null,
      tech_stack      ? JSON.stringify(tech_stack) : null,
      sred_claimed    ?? null,
      province        ?? null,
      industry_domain ?? null,
      req.user.id
    )
  } else {
    db.prepare(`
      INSERT INTO company_profiles
        (id, user_id, company_name, fiscal_year_end, employee_count, tech_stack, sred_claimed, province, industry_domain)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      uuid(),
      req.user.id,
      company_name    ?? '',
      fiscal_year_end ?? 'December',
      employee_count  ?? 10,
      tech_stack      ? JSON.stringify(tech_stack) : '[]',
      sred_claimed    ?? 'not_sure',
      province        ?? 'ON',
      industry_domain ?? ''
    )
  }

  // Bust eligibility cache so next visit re-scores with new profile
  db.prepare('DELETE FROM eligibility_cache WHERE user_id = ?').run(req.user.id)

  res.json({ ok: true })
})

// ── POST /api/auth/forgot-password ───────────────────────────────────────────
// Public. Sends a password-reset link. Always returns 200 to prevent enumeration.
router.post('/forgot-password', async (req, res) => {
  const email = (req.body?.email ?? '').toLowerCase().trim()
  if (!email) return res.status(400).json({ message: 'Email is required.' })

  res.json({ ok: true, message: 'If that email exists, a reset link has been sent.' })  // respond immediately

  const user = db.prepare('SELECT id, email FROM users WHERE email = ?').get(email)
  if (!user) return  // don't reveal whether the email exists

  // Rate-limit: one reset email per 10 minutes
  const existing = db.prepare('SELECT password_reset_sent_at FROM users WHERE id = ?').get(user.id)
  if (existing?.password_reset_sent_at) {
    const sentAt  = new Date(existing.password_reset_sent_at + 'Z')
    if (Date.now() < sentAt.getTime() + 10 * 60 * 1000) return
  }

  const resetToken = makeVerifyToken()
  db.prepare(`UPDATE users SET password_reset_token = ?, password_reset_sent_at = datetime('now') WHERE id = ?`)
    .run(resetToken, user.id)

  const resetUrl = `${APP_URL}/reset-password?token=${resetToken}`
  let transport
  try {
    if (!process.env.SMTP_HOST || !process.env.SMTP_USER || !process.env.SMTP_PASS) throw new Error('no SMTP')
    const nodemailer = require('nodemailer')
    transport = nodemailer.createTransport({
      host:   process.env.SMTP_HOST,
      port:   parseInt(process.env.SMTP_PORT || '587', 10),
      secure: process.env.SMTP_PORT === '465',
      auth:   { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
    })
    await transport.sendMail({
      from:    EMAIL_FROM,
      to:      user.email,
      subject: 'Reset your TaxLift password',
      html: `
        <div style="font-family:Arial,sans-serif;max-width:520px;margin:0 auto;padding:24px">
          <div style="background:#1E1B4B;border-radius:12px;padding:24px;margin-bottom:24px;text-align:center">
            <h1 style="color:#fff;margin:0;font-size:22px;font-weight:700">Reset your password</h1>
            <p style="color:#C7D2FE;margin:8px 0 0;font-size:14px">This link expires in 1 hour</p>
          </div>
          <p style="color:#334155;font-size:14px;line-height:1.6">
            We received a request to reset the password for your TaxLift account (<strong>${user.email}</strong>).
          </p>
          <div style="text-align:center;margin:32px 0">
            <a href="${resetUrl}" style="display:inline-block;background:#4F46E5;color:#fff;padding:14px 32px;border-radius:10px;text-decoration:none;font-size:15px;font-weight:700">
              Reset password →
            </a>
          </div>
          <p style="color:#64748B;font-size:13px">
            If you didn't request this, you can safely ignore this email — your password has not changed.
          </p>
          <p style="color:#94A3B8;font-size:12px;margin-top:16px">
            Or paste this link: <a href="${resetUrl}" style="color:#6366F1">${resetUrl}</a>
          </p>
        </div>
      `,
      text: `Reset your TaxLift password\n\nLink (expires in 1 hour):\n${resetUrl}\n\nIf you didn't request this, ignore this email.`,
    })
    console.log(`[auth/forgot-password] Reset email sent to ${user.email}`)
  } catch {
    console.log(`[auth/forgot-password] SMTP not configured. Reset URL: ${resetUrl}`)
  }
})

// ── POST /api/auth/reset-password ────────────────────────────────────────────
// Public. Validates reset token and sets a new password.
router.post('/reset-password', async (req, res) => {
  const { token, password } = req.body ?? {}
  if (!token || !password) return res.status(400).json({ message: 'Token and password are required.' })
  if (password.length < 8)  return res.status(400).json({ message: 'Password must be at least 8 characters.' })

  const user = db.prepare('SELECT id, email, password_reset_sent_at FROM users WHERE password_reset_token = ?').get(token)
  if (!user) return res.status(404).json({ message: 'This reset link is invalid or has already been used.' })

  // 1-hour expiry
  if (user.password_reset_sent_at) {
    const expiry = new Date(new Date(user.password_reset_sent_at + 'Z').getTime() + 60 * 60 * 1000)
    if (Date.now() > expiry.getTime()) {
      return res.status(410).json({ expired: true, message: 'This reset link has expired. Please request a new one.' })
    }
  }

  const hash = await bcrypt.hash(password, 10)
  db.prepare('UPDATE users SET password_hash = ?, password_reset_token = NULL, password_reset_sent_at = NULL WHERE id = ?')
    .run(hash, user.id)

  console.log(`[auth/reset-password] Password reset for ${user.email}`)
  res.json({ ok: true, message: 'Password updated successfully. You can now log in.' })
})

// ── GET /api/auth/verify-email?token=xxx ─────────────────────────────────────
// Public — no auth. Called when user clicks the link in their email.
// Returns JSON so the frontend /verify-email page can handle success/error.
router.get('/verify-email', (req, res) => {
  const { token } = req.query
  if (!token || typeof token !== 'string' || token.length < 32) {
    return res.status(400).json({ ok: false, message: 'Invalid or missing verification token.' })
  }

  const user = db.prepare(`
    SELECT id, email, email_verified, email_verify_sent_at
    FROM users WHERE email_verify_token = ?
  `).get(token)

  if (!user) {
    return res.status(404).json({ ok: false, message: 'This verification link is invalid or has already been used.' })
  }

  if (user.email_verified) {
    return res.json({ ok: true, already: true, message: 'Your email is already verified. You\'re all set!' })
  }

  // Check 48-hour expiry
  if (user.email_verify_sent_at) {
    const sentAt  = new Date(user.email_verify_sent_at + 'Z')
    const expiry  = new Date(sentAt.getTime() + 48 * 60 * 60 * 1000)
    if (Date.now() > expiry.getTime()) {
      return res.status(410).json({ ok: false, expired: true, message: 'This verification link has expired. Please request a new one.' })
    }
  }

  db.prepare(`
    UPDATE users
    SET email_verified = 1, email_verify_token = NULL
    WHERE id = ?
  `).run(user.id)

  console.log(`[auth/verify] Email verified for ${user.email}`)
  res.json({ ok: true, message: 'Email verified! Your account is now fully active.' })
})

// ── POST /api/auth/resend-verification ───────────────────────────────────────
// Auth required. Rate-limited: one resend per 5 minutes.
router.post('/resend-verification', requireAuth, async (req, res) => {
  const user = db.prepare('SELECT id, email, email_verified, email_verify_sent_at FROM users WHERE id = ?').get(req.user.id)

  if (!user) return res.status(404).json({ message: 'User not found' })

  if (user.email_verified) {
    return res.json({ ok: true, message: 'Your email is already verified.' })
  }

  // Rate limit: max one resend every 5 minutes
  if (user.email_verify_sent_at) {
    const sentAt  = new Date(user.email_verify_sent_at + 'Z')
    const cooloff = new Date(sentAt.getTime() + 5 * 60 * 1000)
    if (Date.now() < cooloff.getTime()) {
      const secsLeft = Math.ceil((cooloff.getTime() - Date.now()) / 1000)
      return res.status(429).json({ message: `Please wait ${secsLeft} seconds before requesting another verification email.` })
    }
  }

  const newToken = makeVerifyToken()
  db.prepare(`
    UPDATE users SET email_verify_token = ?, email_verify_sent_at = datetime('now') WHERE id = ?
  `).run(newToken, user.id)

  sendVerificationEmail(user.email, newToken)
    .catch(err => console.error('[auth/resend-verification] error:', err.message))

  res.json({ ok: true, message: 'Verification email sent. Check your inbox.' })
})

module.exports = router
