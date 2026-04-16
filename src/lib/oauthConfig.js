/**
 * oauthConfig.js
 *
 * OAuth 2.0 configuration and helpers for GitHub and Atlassian (Jira) integrations.
 *
 * Setup (add to .env.local):
 *   VITE_GITHUB_CLIENT_ID   — GitHub OAuth App client ID
 *                             Create at: https://github.com/settings/developers
 *                             Callback URL: https://yourdomain.com/oauth/callback
 *
 *   VITE_JIRA_CLIENT_ID     — Atlassian OAuth 2.0 (3LO) app client ID
 *                             Create at: https://developer.atlassian.com/console/myapps/
 *                             Callback URL: https://yourdomain.com/oauth/callback
 *                             Scopes: read:jira-work read:jira-user read:me offline_access
 *
 * ⚠️ Token exchange (code → access_token) requires a backend proxy because:
 *   - GitHub's token endpoint does not support CORS
 *   - Atlassian's token endpoint requires the client_secret (must stay server-side)
 *
 * Backend endpoints (all under /api/v1/ — Vercel rewrites forward to Railway):
 *   POST /api/v1/oauth/github/exchange  { code }           → { access_token }
 *   POST /api/v1/oauth/jira/exchange    { code, verifier }  → { access_token, refresh_token }
 *
 * Railway env vars required for exchange to work:
 *   GITHUB_CLIENT_ID, GITHUB_CLIENT_SECRET
 *   ATLASSIAN_CLIENT_ID, ATLASSIAN_CLIENT_SECRET
 *
 * When exchange fails, functions return null and caller falls back to demo-mode scanning.
 * Check browser console for [exchangeGitHubCode] errors to diagnose Railway env var issues.
 */

// ── Client IDs from environment ────────────────────────────────────────────────
export const GITHUB_CLIENT_ID = import.meta.env.VITE_GITHUB_CLIENT_ID ?? ''
export const JIRA_CLIENT_ID   = import.meta.env.VITE_JIRA_CLIENT_ID   ?? ''

// ── localStorage key constants ─────────────────────────────────────────────────
export const LS_KEYS = {
  GITHUB_TOKEN:    'taxlift_github_token',
  GITHUB_USER:     'taxlift_github_user',
  JIRA_TOKEN:      'taxlift_jira_token',
  JIRA_CLOUD_ID:   'taxlift_jira_cloud_id',
  JIRA_REFRESH:    'taxlift_jira_refresh',
  OAUTH_STATE:     'taxlift_oauth_state',   // format: "provider:randomState"
  PKCE_VERIFIER:   'taxlift_pkce_verifier',
}

// ── PKCE helpers ───────────────────────────────────────────────────────────────
export function generateState() {
  return Array.from(crypto.getRandomValues(new Uint8Array(16)))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')
}

export async function generatePKCE() {
  const verifier = Array.from(crypto.getRandomValues(new Uint8Array(32)))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')
  const encoder  = new TextEncoder()
  const digest   = await crypto.subtle.digest('SHA-256', encoder.encode(verifier))
  const challenge = btoa(String.fromCharCode(...new Uint8Array(digest)))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
  return { verifier, challenge }
}

// ── OAuth authorization URLs ───────────────────────────────────────────────────
export function getGitHubAuthUrl(state) {
  const params = new URLSearchParams({
    client_id:    GITHUB_CLIENT_ID,
    redirect_uri: `${window.location.origin}/oauth/callback`,
    scope:        'repo read:org read:user',
    state,
    allow_signup: 'false',
  })
  return `https://github.com/login/oauth/authorize?${params}`
}

export function getJiraAuthUrl(state, pkceChallenge) {
  const params = new URLSearchParams({
    audience:               'api.atlassian.com',
    client_id:              JIRA_CLIENT_ID,
    scope:                  'read:jira-work read:jira-user read:me offline_access',
    redirect_uri:           `${window.location.origin}/oauth/callback`,
    state,
    response_type:          'code',
    prompt:                 'consent',
    code_challenge:         pkceChallenge,
    code_challenge_method:  'S256',
  })
  return `https://auth.atlassian.com/authorize?${params}`
}

// ── Token exchange (requires backend proxy) ────────────────────────────────────

/**
 * exchangeGitHubCode — exchange an authorization code for an access token.
 *
 * ⚠️ BACKEND REQUIRED: GitHub's token endpoint (https://github.com/login/oauth/access_token)
 * blocks cross-origin requests from browsers.  This function calls a backend proxy at
 * POST /api/oauth/github/exchange which should:
 *   1. Accept { code } in the request body
 *   2. POST to https://github.com/login/oauth/access_token with
 *      { client_id, client_secret, code }  and header Accept: application/json
 *   3. Return { access_token } to the browser
 *
 * Returns null when the proxy is unreachable, triggering demo-mode fallback.
 */
export async function exchangeGitHubCode(code) {
  try {
    const res = await fetch('/api/v1/oauth/github/exchange', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ code }),
    })
    if (!res.ok) {
      const body = await res.json().catch(() => ({}))
      console.error('[exchangeGitHubCode] Exchange failed:', res.status, body)
      // 503 with demo:true means Railway is missing GITHUB_CLIENT_ID / GITHUB_CLIENT_SECRET env vars
      return null
    }
    const data = await res.json()
    return data.access_token ?? null
  } catch (err) {
    // Network error or JSON parse failure — caller falls back to demo mode
    console.error('[exchangeGitHubCode] Unexpected error:', err.message)
    return null
  }
}

/**
 * exchangeJiraCode — exchange an Atlassian authorization code for an access token.
 *
 * ⚠️ BACKEND REQUIRED: Atlassian requires client_secret to be kept server-side.
 * Implement POST /api/oauth/jira/exchange which should:
 *   1. Accept { code, verifier } in the request body
 *   2. POST to https://auth.atlassian.com/oauth/token with:
 *      { grant_type: "authorization_code", client_id, client_secret,
 *        code, redirect_uri, code_verifier: verifier }
 *   3. Return { access_token, refresh_token } to the browser
 *
 * Returns null when the proxy is unreachable.
 */
export async function exchangeJiraCode(code, verifier) {
  try {
    const res = await fetch('/api/v1/oauth/jira/exchange', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ code, verifier }),
    })
    if (!res.ok) {
      const body = await res.json().catch(() => ({}))
      console.error('[exchangeJiraCode] Exchange failed:', res.status, body)
      return null
    }
    const data = await res.json()
    return {
      accessToken:  data.access_token  ?? null,
      refreshToken: data.refresh_token ?? null,
    }
  } catch (err) {
    console.error('[exchangeJiraCode] Unexpected error:', err.message)
    return null
  }
}

// ── Token storage helpers ──────────────────────────────────────────────────────
export function getStoredToken(provider) {
  if (provider === 'github') return localStorage.getItem(LS_KEYS.GITHUB_TOKEN)
  if (provider === 'jira')   return localStorage.getItem(LS_KEYS.JIRA_TOKEN)
  return null
}

export function getStoredUser(provider) {
  if (provider === 'github') return localStorage.getItem(LS_KEYS.GITHUB_USER)
  return null
}

export function storeToken(provider, token, meta = {}) {
  if (provider === 'github') {
    localStorage.setItem(LS_KEYS.GITHUB_TOKEN, token)
    if (meta.login) localStorage.setItem(LS_KEYS.GITHUB_USER, meta.login)
  }
  if (provider === 'jira') {
    localStorage.setItem(LS_KEYS.JIRA_TOKEN, token)
    if (meta.cloudId) localStorage.setItem(LS_KEYS.JIRA_CLOUD_ID, meta.cloudId)
  }
}

export function clearToken(provider) {
  if (provider === 'github') {
    localStorage.removeItem(LS_KEYS.GITHUB_TOKEN)
    localStorage.removeItem(LS_KEYS.GITHUB_USER)
  }
  if (provider === 'jira') {
    localStorage.removeItem(LS_KEYS.JIRA_TOKEN)
    localStorage.removeItem(LS_KEYS.JIRA_CLOUD_ID)
    localStorage.removeItem(LS_KEYS.JIRA_REFRESH)
  }
}
