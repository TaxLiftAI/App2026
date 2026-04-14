/**
 * TaxLift API Client  (v2 — httpOnly cookie auth)
 *
 * Auth strategy:
 *  - Access token lives in an httpOnly, Secure, SameSite=Lax cookie (set by the server).
 *    The browser sends it automatically — no manual Authorization header needed.
 *  - On 401: silently calls POST /api/v1/auth/refresh (refresh token also httpOnly).
 *    If refresh succeeds, the original request is retried once.
 *    If refresh fails, 'taxlift:unauthorized' is dispatched and the caller sees a 401.
 *  - localStorage is NOT used for auth tokens (eliminates XSS exfiltration risk).
 *
 * API versioning:
 *  - All routes are under /api/v1/
 *  - In dev:  Vite proxy (vite.config.js server.proxy) forwards /api/* → localhost:3001
 *  - In prod: Vercel rewrite forwards /api/v1/* → Railway
 *
 * Mock-data fallback:
 *  If the backend is unreachable, callers catch ApiError with status === 0
 *  and use local mockData instead.  See hooks.js and CPAPortalPage for examples.
 */

// Empty string → requests are relative to the current origin (taxlift.ai in prod,
// localhost:5173 in dev where Vite proxy forwards /api/* to localhost:3001)
export const BASE_URL = (import.meta.env.VITE_API_URL ?? '').replace(/\/$/, '')

// ── Structured error ──────────────────────────────────────────────────────────
export class ApiError extends Error {
  constructor(status, message, detail) {
    super(message)
    this.name   = 'ApiError'
    this.status = status
    this.detail = detail
  }
}

// ── Token shim ────────────────────────────────────────────────────────────────
// Kept for backward compat so call-sites that import `token` don't break.
// Auth state now lives entirely in httpOnly cookies — DO NOT use localStorage.
export const token = {
  get:   () => null,
  set:   () => {},
  clear: () => {},
}

// ── Demo mode flag ────────────────────────────────────────────────────────────
// Set synchronously by AuthContext before loginDemo/loginCpaDemo commits state.
// When true, every request() call short-circuits to ApiError(0) so the existing
// mock-data fallbacks in useApiData and useMutation fire for ALL calls — both
// reads and writes — giving a fully functional demo with no real network traffic.
let _isDemoMode = false
export function setApiDemoMode(val) { _isDemoMode = Boolean(val) }

// ── Refresh state ─────────────────────────────────────────────────────────────
let _refreshing = false
let _refreshQueue = []

async function tryRefresh() {
  if (_refreshing) {
    return new Promise((resolve, reject) => {
      _refreshQueue.push({ resolve, reject })
    })
  }
  _refreshing = true
  try {
    const res = await fetch(`${BASE_URL}/api/v1/auth/refresh`, {
      method:      'POST',
      credentials: 'include',
    })
    if (!res.ok) throw new Error('Refresh failed')
    _refreshQueue.forEach(q => q.resolve())
  } catch (err) {
    _refreshQueue.forEach(q => q.reject(err))
    throw err
  } finally {
    _refreshing = false
    _refreshQueue = []
  }
}

// ── Core fetch wrapper ────────────────────────────────────────────────────────
async function request(method, path, { body, params, isForm = false, _isRetry = false } = {}) {
  // In demo mode skip all network traffic — the caller's mock-data fallback handles it.
  if (_isDemoMode) throw new ApiError(0, 'Demo mode — using local mock data')

  const url = new URL(`${BASE_URL}${path}`, window.location.origin)
  if (params) {
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined && v !== null) url.searchParams.set(k, String(v))
    })
  }

  const headers = {}
  if (body && !isForm) headers['Content-Type'] = 'application/json'

  let res
  try {
    res = await fetch(url.toString(), {
      method,
      headers,
      credentials: 'include',   // sends httpOnly auth cookies automatically
      body: isForm ? body : body ? JSON.stringify(body) : undefined,
    })
  } catch (err) {
    throw new ApiError(0, 'Network error — backend unreachable', err.message)
  }

  // ── Refresh flow on 401 ───────────────────────────────────────────────────
  if (res.status === 401 && !_isRetry && path !== '/api/v1/auth/refresh') {
    try {
      await tryRefresh()
      // Retry original request with fresh access token cookie
      return request(method, path, { body, params, isForm, _isRetry: true })
    } catch {
      // Refresh token also expired — user must log in again
      window.dispatchEvent(new CustomEvent('taxlift:unauthorized'))
      throw new ApiError(401, 'Session expired — please log in again')
    }
  }

  if (res.status === 401) {
    window.dispatchEvent(new CustomEvent('taxlift:unauthorized'))
    throw new ApiError(401, 'Unauthorized — please log in again')
  }

  const ct   = res.headers.get('content-type') ?? ''
  const data = ct.includes('application/json') ? await res.json() : await res.text()

  if (!res.ok) {
    const msg = (typeof data === 'object' ? data?.message ?? data?.detail : data) ?? `HTTP ${res.status}`
    throw new ApiError(res.status, msg, data)
  }

  return data
}

const get  = (path, opts) => request('GET',    path, opts)
const post = (path, opts) => request('POST',   path, opts)
const put  = (path, opts) => request('PUT',    path, opts)
const del  = (path, opts) => request('DELETE', path, opts)

// ── Generic escape hatch for one-off GET calls in page components ─────────────
// Usage: const data = await apiFetch('/api/v1/webhooks/build-runs?limit=10')
// Usage: const data = await apiFetch('/api/v1/webhooks/ci-token', { method: 'POST' })
export async function apiFetch(path, { method = 'GET', body } = {}) {
  return request(method, path, body ? { body } : {})
}

// ── Auth ──────────────────────────────────────────────────────────────────────
export const auth = {
  login:    (email, password) => post('/api/v1/auth/login',    { body: { email, password } }),
  register: (payload)         => post('/api/v1/auth/register', { body: payload }),
  logout:   ()                => post('/api/v1/auth/logout'),
  refresh:  ()                => post('/api/v1/auth/refresh'),

  me:             ()        => get('/api/v1/auth/me'),
  getProfile:     ()        => get('/api/v1/auth/profile'),
  updateProfile:  (payload) => request('PATCH', '/api/v1/auth/profile', { body: payload }),
  changePassword: (payload) => post('/api/v1/auth/change-password', { body: payload }),
}

// ── Clients (CPA portal) ──────────────────────────────────────────────────────
export const clients = {
  list:   (params)      => get('/api/v1/clients',         { params }),
  get:    (id)          => get(`/api/v1/clients/${id}`),
  create: (payload)     => post('/api/v1/clients',        { body: payload }),
  update: (id, payload) => put(`/api/v1/clients/${id}`,   { body: payload }),
  delete: (id)          => del(`/api/v1/clients/${id}`),
}

// ── Clusters ──────────────────────────────────────────────────────────────────
export const clusters = {
  list:    (params)             => get('/api/v1/clusters',                { params }),
  get:     (id)                 => get(`/api/v1/clusters/${id}`),
  create:  (payload)            => post('/api/v1/clusters',               { body: payload }),
  update:  (id, payload)        => put(`/api/v1/clusters/${id}`,          { body: payload }),
  delete:  (id)                 => del(`/api/v1/clusters/${id}`),
  approve: (id)                 => request('PATCH', `/api/v1/clusters/${id}/approve`),
  reject:  (id, reason)         => request('PATCH', `/api/v1/clusters/${id}/reject`,  { body: { reason } }),
  merge:   (id, targetId)       => request('PATCH', `/api/v1/clusters/${id}/merge`,   { body: { target_id: targetId } }),
  bulk:    (ids, action, reason) => post('/api/v1/clusters/bulk',         { body: { ids, action, reason } }),
}

// ── Narratives ────────────────────────────────────────────────────────────────
export const narratives = {
  list:     (params)      => get('/api/v1/narratives',                { params }),
  get:      (id)          => get(`/api/v1/narratives/${id}`),
  create:   (payload)     => post('/api/v1/narratives',               { body: payload }),
  update:   (id, payload) => request('PATCH', `/api/v1/narratives/${id}`, { body: payload }),
  approve:  (id)          => request('PATCH', `/api/v1/narratives/${id}/approve`),
  versions: (id)          => get(`/api/v1/narratives/${id}/versions`),
}

// ── Documents / Vault ─────────────────────────────────────────────────────────
export const documents = {
  list:   (params) => get('/api/v1/documents',          { params }),
  get:    (id)     => get(`/api/v1/documents/${id}`),
  verify: (id)     => request('PATCH', `/api/v1/documents/${id}/verify`),
  upload: (form)   => post('/api/v1/documents',         { body: form, isForm: true }),
  delete: (id)     => del(`/api/v1/documents/${id}`),
}

// ── Reports ───────────────────────────────────────────────────────────────────
export const reports = {
  summary:    (params) => get('/api/v1/reports/summary',    { params }),
  t661:       (params) => get('/api/v1/reports/t661',       { params }),
  developers: (params) => get('/api/v1/reports/developers', { params }),
  clusters:   (params) => get('/api/v1/reports/clusters',   { params }),
}

// ── Users ─────────────────────────────────────────────────────────────────────
export const users = {
  list:   (params)      => get('/api/v1/users',         { params }),
  get:    (id)          => get(`/api/v1/users/${id}`),
  update: (id, payload) => put(`/api/v1/users/${id}`,   { body: payload }),
}

// ── AI Agents ─────────────────────────────────────────────────────────────────
export const agents = {
  generateNarrative: (clusterId) =>
    post('/api/v1/agents/narrative', { body: { cluster_id: clusterId } }),
}

// ── Referrals ─────────────────────────────────────────────────────────────────
export const referrals = {
  list:   (params)      => get('/api/v1/referrals',         { params }),
  stats:  ()            => get('/api/v1/referrals/stats'),
  get:    (id)          => get(`/api/v1/referrals/${id}`),
  create: (payload)     => post('/api/v1/referrals',        { body: payload }),
  update: (id, payload) => put(`/api/v1/referrals/${id}`,   { body: payload }),
  intake: (payload)     => post('/api/v1/referrals/intake', { body: payload }),
}

// ── Billing / Stripe ──────────────────────────────────────────────────────────
export const billing = {
  createCheckoutSession: (plan, successUrl, cancelUrl) =>
    post('/api/v1/billing/create-checkout-session', { body: { plan, successUrl, cancelUrl } }),
  subscription: () => get('/api/v1/billing/subscription'),
}

// ── Leads ─────────────────────────────────────────────────────────────────────
export const leads = {
  capture: (payload) => post('/api/v1/leads',         { body: payload }),
  list:    (params)  => get('/api/v1/leads',           { params }),
  export:  ()        => `${BASE_URL}/api/v1/leads/export`,
}

// ── Integrations ──────────────────────────────────────────────────────────────
export const integrations = {
  list: () => get('/api/v1/integrations'),
}

// ── OAuth proxy ───────────────────────────────────────────────────────────────
export const oauthProxy = {
  githubCallback:     (code, state) => get('/api/v1/oauth/github/callback',    { params: { code, state } }),
  atlassianCallback:  (code, state) => get('/api/v1/oauth/atlassian/callback', { params: { code, state } }),
  githubUser:         ()            => get('/api/v1/oauth/github/user'),
  githubRepos:        ()            => get('/api/v1/oauth/github/repos'),
  githubCommits:      (repo, page)  => get('/api/v1/oauth/github/commits',     { params: { repo, page } }),
  atlassianResources: ()            => get('/api/v1/oauth/atlassian/resources'),
  atlassianIssues:    (cloudId, projectKey) =>
    get('/api/v1/oauth/atlassian/issues', { params: { cloudId, projectKey } }),
}

// ── Grants ────────────────────────────────────────────────────────────────────
export const grants = {
  eligibility:       (forceRefresh = false) =>
    get('/api/v1/grants/eligibility', forceRefresh ? { params: { refresh: 'true' } } : undefined),
  getGapAnswers:     ()        => get('/api/v1/grants/gap-answers'),
  saveGapAnswers:    (payload) => post('/api/v1/grants/gap-answers',            { body: payload }),
  listApplications:  ()        => get('/api/v1/grants/applications'),
  createApplication: (payload) => post('/api/v1/grants/applications',           { body: payload }),
  getApplication:    (id)      => get(`/api/v1/grants/applications/${id}`),
  triggerGeneration: (id)      => post(`/api/v1/grants/applications/${id}/generate`),
  getGenerationStatus:(id)     => get(`/api/v1/grants/applications/${id}/status`),
  approveSection:    (sId)     => request('PATCH', `/api/v1/grants/sections/${sId}/approve`),
  regenerateSection: (sId, note = '') =>
    post(`/api/v1/grants/sections/${sId}/regenerate`, { body: { feedback_note: note } }),
  exportApplication: (id)      => post(`/api/v1/grants/applications/${id}/export`),
  updateApplication: (id, payload) =>
    request('PATCH', `/api/v1/grants/applications/${id}`, { body: payload }),
  getSredContext:    ()        => get('/api/v1/grants/sred-context'),
  directory:         ()        => get('/api/v1/grants/directory'),
}

// ── Admin ─────────────────────────────────────────────────────────────────────
export const admin = {
  funnel:      ()        => get('/api/v1/admin/funnel'),
  triggerDrip: (payload) => post('/api/v1/admin/drip/trigger', { body: payload }),
}

// ── Health ────────────────────────────────────────────────────────────────────
export const health = {
  check: () => get('/healthz'),
}

// ── CPA handoff ───────────────────────────────────────────────────────────────
export const cpa = {
  smtpStatus:  () => get('/api/v1/cpa/smtp-status'),
  sendHandoff: (payload) => post('/api/v1/cpa/send-handoff', { body: payload }),
}

// ── isReachable — used by pages to decide mock vs real data ──────────────────
let _reachableCache = null
let _reachableAt    = 0

export async function isServerReachable() {
  if (_reachableCache !== null && Date.now() - _reachableAt < 10_000) return _reachableCache
  try {
    await health.check()
    _reachableCache = true
  } catch {
    _reachableCache = false
  }
  _reachableAt = Date.now()
  return _reachableCache
}

export default {
  auth, clients, clusters, narratives, documents, reports, users,
  agents, referrals, billing, leads, integrations, oauthProxy,
  health, grants, cpa, token, isServerReachable,
}
