/**
 * OAuth proxy routes — server-side token exchange so the browser
 * never needs to handle client_secret.
 *
 *   GET /api/oauth/github/callback?code=&state=
 *   GET /api/oauth/atlassian/callback?code=&state=
 *   GET /api/oauth/github/repos          (proxy, requires Bearer token in header)
 *   GET /api/oauth/github/commits?repo=  (proxy)
 *   GET /api/oauth/github/user           (proxy)
 *   GET /api/oauth/atlassian/resources   (proxy — lists accessible Jira sites)
 *   GET /api/oauth/atlassian/issues?cloudId=&projectKey= (proxy)
 */
const router = require('express').Router()
const axios  = require('axios')
const { requireAuth, optionalAuth } = require('../middleware/auth')

// ── Helpers ────────────────────────────────────────────────────────────────────
function cfg(key) {
  return process.env[key] ?? ''
}

function missingEnv(...keys) {
  return keys.filter(k => !process.env[k])
}

// ── GitHub callback — exchange code for access token ─────────────────────────
router.get('/github/callback', optionalAuth, async (req, res) => {
  const { code, state } = req.query
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
