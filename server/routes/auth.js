/**
 * Auth routes
  *   POST  /api/auth/register
   *   POST  /api/auth/login
    *   GET   /api/auth/me
     *   GET   /api/auth/profile
      *   PATCH /api/auth/profile
       */
const router  = require('express').Router()
const bcrypt  = require('bcryptjs')
const { v4: uuid } = require('../utils/uuid')
const db      = require('../db')
const { signToken, requireAuth } = require('../middleware/auth')

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
    
      // Only allow safe roles on self-registration
          const safeRole = ['admin', 'developer', 'reviewer'].includes(role) ? role : 'admin'
    
      db.prepare(`
          INSERT INTO users (id, email, password_hash, full_name, firm_name, role, tenant_id)
              VALUES (?, ?, ?, ?, ?, ?, ?)
                `).run(id, email.toLowerCase(), password_hash, full_name, firm_name, safeRole, tenant_id)
    
      const user  = db.prepare('SELECT id, email, full_name, firm_name, role, tenant_id, onboarding_completed, created_at FROM users WHERE id = ?').get(id)
      const token = signToken({ id: user.id, email: user.email, role: user.role, tenant_id: user.tenant_id })
    
      res.status(201).json({ access_token: token, token_type: 'bearer', user })
  })

// ── POST /api/auth/login ──────────────────────────────────────────────────────
    router.post('/login', async (req, res) => {
        // Accept both JSON body and form-encoded (for FastAPI OAuth2 compat)
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
      
        // Return both the FastAPI-compat field name AND a clean user object
            res.json({
                  access_token: token,
                  token_type:   'bearer',
                  user: {
                          id:                   user.id,
                          email:                user.email,
                          full_name:            user.full_name,
                          firm_name:            user.firm_name,
                          role:                 user.role,
                          tenant_id:            user.tenant_id,
                          onboarding_completed: user.onboarding_completed,
                          created_at:           user.created_at,
                  },
            })
    })

// ── GET /api/auth/me ──────────────────────────────────────────────────────────
      router.get('/me', requireAuth, (req, res) => {
          const user = db.prepare(
                'SELECT id, email, full_name, firm_name, role, tenant_id, onboarding_completed, created_at FROM users WHERE id = ?'
              ).get(req.user.id)
        
          if (!user) {
                return res.status(404).json({ message: 'User not found' })
          }
          res.json(user)
      })

// ── PATCH /api/auth/onboarding-complete ──────────────────────────────────────
        router.patch('/onboarding-complete', requireAuth, (req, res) => {
            db.prepare('UPDATE users SET onboarding_completed = 1 WHERE id = ?').run(req.user.id)
            const user = db.prepare(
                  'SELECT id, email, full_name, firm_name, role, tenant_id, onboarding_completed, created_at FROM users WHERE id = ?'
                ).get(req.user.id)
            res.json(user)
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
                      const { v4: uuid } = require('../utils/uuid')
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

module.exports = router
/**
 * Auth routes
 *   POST /api/auth/register
 *   POST /api/auth/login
 *   GET  /api/auth/me
 */
const router  = require('express').Router()
const bcrypt  = require('bcryptjs')
const { v4: uuid } = require('../utils/uuid')
const db      = require('../db')
const { signToken, requireAuth } = require('../middleware/auth')

// ── POST /api/auth/register ───────────────────────────────────────────────────
router.post('/register', async (req, res) => {
  const { email, password, full_name = '', firm_name = '', role = 'admin' } = req.body ?? {}

  if (!email || !password) {
    return res.status(400).json({ message: 'email and password are required' })
  }
  if (password.length < 8) {
    return res.status(400).json({ message: 'Password must be at least 8 characters' })
  }
  if (!/[A-Z]/.test(password) || !/[0-9]/.test(password)) {
    return res.status(400).json({ message: 'Password must contain at least one uppercase letter and one number' })
  }

  const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email.toLowerCase())
  if (existing) {
    return res.status(409).json({ message: 'An account with that email already exists' })
  }

  const id            = uuid()
  const password_hash = await bcrypt.hash(password, 10)
  const tenant_id     = `tenant-${id.slice(0, 8)}`

  // Only allow safe roles on self-registration
  const safeRole = ['admin', 'developer', 'reviewer'].includes(role) ? role : 'admin'

  db.prepare(`
    INSERT INTO users (id, email, password_hash, full_name, firm_name, role, tenant_id)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(id, email.toLowerCase(), password_hash, full_name, firm_name, safeRole, tenant_id)

  const user  = db.prepare('SELECT id, email, full_name, firm_name, role, tenant_id, onboarding_completed, created_at FROM users WHERE id = ?').get(id)
  const token = signToken({ id: user.id, email: user.email, role: user.role, tenant_id: user.tenant_id })

  res.status(201).json({ access_token: token, token_type: 'bearer', user: { ...user, display_name: user.full_name } })
})

// ── POST /api/auth/login ──────────────────────────────────────────────────────
router.post('/login', async (req, res) => {
  // Accept both JSON body and form-encoded (for FastAPI OAuth2 compat)
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

  // Return both the FastAPI-compat field name AND a clean user object
  res.json({
    access_token: token,
    token_type:   'bearer',
    user: {
      id:                   user.id,
      email:                user.email,
      full_name:            user.full_name,
      display_name:         user.full_name,
      firm_name:            user.firm_name,
      role:                 user.role,
      tenant_id:            user.tenant_id,
      onboarding_completed: user.onboarding_completed,
      created_at:           user.created_at,
    },
  })
})

// ── GET /api/auth/me ──────────────────────────────────────────────────────────
router.get('/me', requireAuth, (req, res) => {
  const user = db.prepare(
    'SELECT id, email, full_name, firm_name, role, tenant_id, onboarding_completed, created_at FROM users WHERE id = ?'
  ).get(req.user.id)

  if (!user) {
    return res.status(404).json({ message: 'User not found' })
  }
  res.json({ ...user, display_name: user.full_name })
})

// ── PATCH /api/auth/onboarding-complete ──────────────────────────────────────
router.patch('/onboarding-complete', requireAuth, (req, res) => {
  db.prepare('UPDATE users SET onboarding_completed = 1 WHERE id = ?').run(req.user.id)
  const user = db.prepare(
    'SELECT id, email, full_name, firm_name, role, tenant_id, onboarding_completed, created_at FROM users WHERE id = ?'
  ).get(req.user.id)
  res.json({ ...user, display_name: user.full_name })
})

// ── PATCH /api/auth/profile ───────────────────────────────────────────────────
router.patch('/profile', requireAuth, (req, res) => {
  const { company_name, fiscal_year_end, employee_count, tech_stack, sred_claimed } = req.body ?? {}

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
          sred_claimed    = COALESCE(?, sred_claimed)
      WHERE user_id = ?
    `).run(
      company_name    ?? null,
      fiscal_year_end ?? null,
      employee_count  ?? null,
      tech_stack      ? JSON.stringify(tech_stack) : null,
      sred_claimed    ?? null,
      req.user.id
    )
  } else {
    const { v4: uuid } = require('../utils/uuid')
    db.prepare(`
      INSERT INTO company_profiles (id, user_id, company_name, fiscal_year_end, employee_count, tech_stack, sred_claimed)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      uuid(),
      req.user.id,
      company_name    ?? '',
      fiscal_year_end ?? 'December',
      employee_count  ?? 10,
      tech_stack      ? JSON.stringify(tech_stack) : '[]',
      sred_claimed    ?? 'not_sure'
    )
  }

  res.json({ ok: true })
})

module.exports = router
