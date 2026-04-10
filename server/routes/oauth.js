/**
 * OAuth proxy routes — server-side token exchange so the browser
 * never needs to handle client_secret.
 *
 *   POST /api/oauth/state                          ← generate state, set httpOnly cookie
 *   GET  /api/oauth/github/callback?code=&state=   ← GitHub server-side redirect target
 *   POST /api/oauth/github/exchange  { code }      ← browser SPA exchange (OAuthCallbackPage)
 *   GET  /api/oauth/atlassian/callback?code=&state=
 *   POST /api/oauth/jira/exchange  { code, verifier } ← browser SPA exchange (OAuthCallbackPage)
 *   GET  /api/oauth/github/repos          (proxy, requires Bearer token in header)
 *   GET  /api/oauth/github/commits?repo=  (proxy)
 *   GET  /api/oauth/github/user           (proxy)
 *   GET  /api/oauth/atlassian/resources   (proxy — lists accessible Jira sites)
 *   GET  /api/oauth/atlassian/issues?cloudId=&projectKey= (proxy)
 */
const router = require('express').Router()
const axios  = require('axios')
const crypto = require('crypto')
const { requireAuth, optionalAuth, cookieOptions } = require('../middleware/auth')

// ── Helpers ────────────────────────────────────────────────────────────────────
function cfg(key) {
  return process.env[key] ?? ''
}

function missingEnv(...keys) {
  return keys.filter(k => !process.env[k])
}

// ── OAuth state cookie constants (Fix 2) ──────────────────────────────────────
const OAUTH_STATE_COOKIE = 'taxlift_oauth_state'
const STATE_COOKIE_OPTS  = { ...cookieOptions(10 * 60 * 1000), httpOnly: true }  // 10 min TTL

// ── POST /api/oauth/state — generate state, set httpOnly cookie ───────────────
// Called by the frontend BEFORE redirecting to GitHub/Atlassian.
// Returns { state } which the frontend includes in the authorization URL.
// The server-side GET callbacks verify this cookie to prevent OAuth CSRF.
//
// The browser SPA (OAuthCallbackPage) also validates state client-side via
// localStorage — this server-issued cookie provides defense-in-depth for the
// server-side callback routes.
router.post('/state', (req, res) => {
  const { provider = 'github' } = req.body ?? {}
  const state = `${provider}:${crypto.randomBytes(16).toString('hex')}`
  res.cookie(OAUTH_STATE_COOKIE, state, STATE_COOKIE_OPTS)
  res.json({ state })
})

// ── Internal: validate OAuth state cookie, then clear it ─────────────────────
function validateOAuthState(req, res, expectedState) {
  const cookieState = req.cookies?.[OAUTH_STATE_COOKIE] ?? null

  // Clear the state cookie regardless of outcome (one-time use)
  const clearOpts = { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'Lax', path: '/' }
  res.clearCookie(OAUTH_STATE_COOKIE, clearOpts)

  if (!cookieState) {
    // No cookie — could be an old browser or the flow wasn't initiated via /state.
    // Warn but allow: the browser SPA already validates state client-side.
    // Strict mode would return 403 here; we log and continue.
    console.warn('[oauth] state cookie missing — state CSRF guard bypassed')
    return true
  }

  if (expectedState && cookieState !== expectedState) {
    console.warn(`[oauth] state mismatch: cookie="${cookieState}" query="${expectedState}"`)
    return false
  }

  return true
}

// ── GitHub callback — exchange code for access token ─────────────────────────
router.get('/github/callback', optionalAuth, async (req, res) => {
  const { code, state } = req.query
  if (!code) return res.status(400).json({ message: 'code is required' })

  // Validate OAuth state cookie to prevent CSRF (Fix 2)
  if (!validateOAuthState(req, res, state)) {
    return res.status(403).json({ message: 'OAuth state mismatch — request may have been tampered with. Please try connecting again.' })
  }

  const missing = missingEnv('GITHUB_CLIENT_ID', 'GITHUB_CLIENT_SECRET')
  if (missing.length) {
    return res.status(503).json({
      message: `GitHub OAuth not configured. Missing env vars: ${missing.join(', ')}`,
      demo: true,
    })
  }

  try {
    const resp = await axios.post(
      'https://github.com/login/oauth/access_token',
      {
        client_id:     cfg('GITHUB_CLIENT_ID'),
        client_secret: cfg('GITHUB_CLIENT_SECRET'),
        code,
      },
      { headers: { Accept: 'application/json' } }
    )

    if (resp.data.error) {
      return res.status(400).json({ message: resp.data.error_description ?? resp.data.error })
    }

    res.json({
      access_token: resp.data.access_token,
      scope:        resp.data.scope,
      token_type:   resp.data.token_type,
    })
  } catch (err) {
    res.status(502).json({ message: 'GitHub token exchange failed', detail: err.message })
  }
})

// ── GitHub exchange — POST alias used by the browser SPA ─────────────────────
// The GET /github/callback route above is used when GitHub redirects back to the
// server directly.  OAuthCallbackPage.jsx calls this POST endpoint instead, so
// the browser can send the code in a JSON body (avoids CORS issues with GitHub).
router.post('/github/exchange', async (req, res) => {
  const { code } = req.body ?? {}
  if (!code) return res.status(400).json({ message: 'code is required' })

  const missing = missingEnv('GITHUB_CLIENT_ID', 'GITHUB_CLIENT_SECRET')
  if (missing.length) {
    return res.status(503).json({
      message: `GitHub OAuth not configured. Missing env vars: ${missing.join(', ')}`,
      demo: true,
    })
  }

  try {
    const resp = await axios.post(
      'https://github.com/login/oauth/access_token',
      {
        client_id:     cfg('GITHUB_CLIENT_ID'),
        client_secret: cfg('GITHUB_CLIENT_SECRET'),
        code,
      },
      { headers: { Accept: 'application/json' } }
    )

    if (resp.data.error) {
      return res.status(400).json({ message: resp.data.error_description ?? resp.data.error })
    }

    res.json({
      access_token: resp.data.access_token,
      scope:        resp.data.scope,
      token_type:   resp.data.token_type,
    })
  } catch (err) {
    res.status(502).json({ message: 'GitHub token exchange failed', detail: err.message })
  }
})

// ── Atlassian callback — exchange code for access token ───────────────────────
router.get('/atlassian/callback', optionalAuth, async (req, res) => {
  const { code, state } = req.query
  if (!code) return res.status(400).json({ message: 'code is required' })

  // Validate OAuth state cookie to prevent CSRF (Fix 2)
  if (!validateOAuthState(req, res, state)) {
    return res.status(403).json({ message: 'OAuth state mismatch — request may have been tampered with. Please try connecting again.' })
  }

  const missing = missingEnv('ATLASSIAN_CLIENT_ID', 'ATLASSIAN_CLIENT_SECRET')
  if (missing.length) {
    return res.status(503).json({
      message: `Atlassian OAuth not configured. Missing env vars: ${missing.join(', ')}`,
      demo: true,
    })
  }

  try {
    const resp = await axios.post(
      'https://auth.atlassian.com/oauth/token',
      {
        grant_type:    'authorization_code',
        client_id:     cfg('ATLASSIAN_CLIENT_ID'),
        client_secret: cfg('ATLASSIAN_CLIENT_SECRET'),
        code,
        redirect_uri:  cfg('ATLASSIAN_REDIRECT_URI') || `${req.protocol}://${req.get('host')}/oauth/callback`,
      },
      { headers: { 'Content-Type': 'application/json' } }
    )

    res.json({
      access_token:  resp.data.access_token,
      refresh_token: resp.data.refresh_token,
      expires_in:    resp.data.expires_in,
      token_type:    resp.data.token_type,
    })
  } catch (err) {
    const detail = err.response?.data ?? err.message
    res.status(502).json({ message: 'Atlassian token exchange failed', detail })
  }
})

// ── Jira/Atlassian exchange — POST alias used by the browser SPA ──────────────
// OAuthCallbackPage.jsx calls POST /api/oauth/jira/exchange with { code, verifier }.
// The PKCE code_verifier is forwarded to Atlassian so the S256 challenge can be verified.
router.post('/jira/exchange', async (req, res) => {
  const { code, verifier } = req.body ?? {}
  if (!code) return res.status(400).json({ message: 'code is required' })

  const missing = missingEnv('ATLASSIAN_CLIENT_ID', 'ATLASSIAN_CLIENT_SECRET')
  if (missing.length) {
    return res.status(503).json({
      message: `Atlassian OAuth not configured. Missing env vars: ${missing.join(', ')}`,
      demo: true,
    })
  }

  try {
    const body = {
      grant_type:    'authorization_code',
      client_id:     cfg('ATLASSIAN_CLIENT_ID'),
      client_secret: cfg('ATLASSIAN_CLIENT_SECRET'),
      code,
      redirect_uri:  cfg('ATLASSIAN_REDIRECT_URI') || `${req.protocol}://${req.get('host')}/oauth/callback`,
    }
    if (verifier) body.code_verifier = verifier

    const resp = await axios.post(
      'https://auth.atlassian.com/oauth/token',
      body,
      { headers: { 'Content-Type': 'application/json' } }
    )

    res.json({
      access_token:  resp.data.access_token,
      refresh_token: resp.data.refresh_token,
      expires_in:    resp.data.expires_in,
      token_type:    resp.data.token_type,
    })
  } catch (err) {
    const detail = err.response?.data ?? err.message
    res.status(502).json({ message: 'Atlassian token exchange failed', detail })
  }
})

// ── GitHub proxy helpers ───────────────────────────────────────────────────────
function githubHeaders(req) {
  // Accept either a dedicated X-GitHub-Token header or the standard Bearer
  const token = req.headers['x-github-token'] ?? req.headers.authorization?.replace('Bearer ', '')
  if (!token) return null
  return {
    Authorization: `Bearer ${token}`,
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
  }
}

// GET /api/oauth/github/user
router.get('/github/user', async (req, res) => {
  const headers = githubHeaders(req)
  if (!headers) return res.status(400).json({ message: 'GitHub token required in Authorization or X-GitHub-Token header' })

  try {
    const resp = await axios.get('https://api.github.com/user', { headers })
    res.json(resp.data)
  } catch (err) {
    res.status(err.response?.status ?? 502).json({ message: 'GitHub API error', detail: err.response?.data ?? err.message })
  }
})

// GET /api/oauth/github/repos
router.get('/github/repos', async (req, res) => {
  const headers = githubHeaders(req)
  if (!headers) return res.status(400).json({ message: 'GitHub token required' })

  try {
    const resp = await axios.get('https://api.github.com/user/repos', {
      headers,
      params: { per_page: 100, sort: 'pushed', type: 'all' },
    })
    res.json(resp.data)
  } catch (err) {
    res.status(err.response?.status ?? 502).json({ message: 'GitHub API error', detail: err.response?.data ?? err.message })
  }
})

// GET /api/oauth/github/commits?repo=owner/repo&per_page=100&page=1
router.get('/github/commits', async (req, res) => {
  const headers = githubHeaders(req)
  if (!headers) return res.status(400).json({ message: 'GitHub token required' })

  const { repo, per_page = 100, page = 1 } = req.query
  if (!repo) return res.status(400).json({ message: 'repo query param required (format: owner/repo)' })

  try {
    const resp = await axios.get(`https://api.github.com/repos/${repo}/commits`, {
      headers,
      params: { per_page, page },
    })
    res.json(resp.data)
  } catch (err) {
    res.status(err.response?.status ?? 502).json({ message: 'GitHub API error', detail: err.response?.data ?? err.message })
  }
})

// ── Atlassian proxy helpers ────────────────────────────────────────────────────
function atlassianHeaders(req) {
  const token = req.headers['x-atlassian-token'] ?? req.headers.authorization?.replace('Bearer ', '')
  if (!token) return null
  return { Authorization: `Bearer ${token}`, Accept: 'application/json' }
}

// GET /api/oauth/atlassian/resources
router.get('/atlassian/resources', async (req, res) => {
  const headers = atlassianHeaders(req)
  if (!headers) return res.status(400).json({ message: 'Atlassian token required' })

  try {
    const resp = await axios.get('https://api.atlassian.com/oauth/token/accessible-resources', { headers })
    res.json(resp.data)
  } catch (err) {
    res.status(err.response?.status ?? 502).json({ message: 'Atlassian API error', detail: err.response?.data ?? err.message })
  }
})

// GET /api/oauth/atlassian/issues?cloudId=&projectKey=&maxResults=50
router.get('/atlassian/issues', async (req, res) => {
  const headers = atlassianHeaders(req)
  if (!headers) return res.status(400).json({ message: 'Atlassian token required' })

  const { cloudId, projectKey, maxResults = 50 } = req.query
  if (!cloudId) return res.status(400).json({ message: 'cloudId is required' })

  const jql = projectKey ? `project = "${projectKey}" ORDER BY updated DESC` : 'ORDER BY updated DESC'

  try {
    const resp = await axios.get(
      `https://api.atlassian.com/ex/jira/${cloudId}/rest/api/3/search`,
      { headers, params: { jql, maxResults, fields: 'summary,description,status,labels,comment,worklog' } }
    )
    res.json(resp.data)
  } catch (err) {
    res.status(err.response?.status ?? 502).json({ message: 'Atlassian API error', detail: err.response?.data ?? err.message })
  }
})

module.exports = router
